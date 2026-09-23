import { jaccard, titleTokens } from "../dedupe";
import type { RawItem } from "../types";

const MAX_LEN = 280;

/** Boilerplate that feeds append to excerpts: WordPress footers, podcast ad notices, CTAs. */
const BOILERPLATE: RegExp[] = [
  /The post .{0,300}? appeared first on .{0,120}?(\.|$)/gi,
  /(See|Visit) (omnystudio|megaphone|art19|podcastchoices)\.\w+\S* for privacy information\.?/gi,
  /Learn more about your ad choices\.?( Visit \S+)?/gi,
  /Hosted on Acast\. See acast\.com\/privacy for more information\.?/gi,
  /^[\w.-]+\.(net|com|org|co\.uk)\s+[—–-]\s+/i, // "HedgeCo.Net — " style bylines
  /^(TOP STORY|BREAKING|EXCLUSIVE|UPDATE|WATCH|LISTEN)\s*[:—–-]\s*/i,
  /\b(Read|Continue reading|Read more|Click here|Listen now|Subscribe)( here| now| to [^.]{0,60})?[.:…]*\s*$/gi,
  /\[(…|\.\.\.|&#8230;)\]/g,
  /https?:\/\/\S+/g,
  /\(?\b\d{1,2}:\d{2}(:\d{2})?\)?/g, // podcast timestamps
  /\b(Sponsored by|This episode is (brought to you|sponsored) by)[^.]*\./gi,
  /\s*\|\s*/g,
];

/** "…launch of Akrapoint Commerc… Continue reading →": drop the cut-off word, keep an ellipsis. */
const TRUNCATED = /\s*\S*…?\s*Continue reading\s*(→|&rarr;)?\.?/gi;

/** Abbreviations whose period should not end a sentence. */
const ABBREVIATIONS = /\b(U\.S|U\.K|U\.N|E\.U|Inc|Corp|Co|Ltd|L\.P|LLC|Mr|Ms|Mrs|Dr|St|vs|No|approx|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|e\.g|i\.e|Jr|Sr)\./g;
const PLACEHOLDER = "\u0000";

export function cleanExcerpt(text: string): string {
  let s = text.replace(TRUNCATED, "… ");
  for (const re of BOILERPLATE) s = s.replace(re, " ");
  return s
    .replace(/([a-z)])\.([A-Z][a-z])/g, "$1. $2") // "(SCI).According" → "(SCI). According"
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

export function splitSentences(text: string): string[] {
  const protectedText = text.replace(ABBREVIATIONS, (m) => m.replace(/\./g, PLACEHOLDER));
  return protectedText
    .split(/(?<=[.!?])["”’]?\s+(?=["“(]?[A-Z0-9$])/)
    .map((s) => s.replaceAll(PLACEHOLDER, ".").trim())
    .filter(Boolean);
}

function isComplete(s: string): boolean {
  return /[.!?]["”’)]?$/.test(s) && !s.endsWith("…");
}

function ensurePeriod(s: string): string {
  return /[.!?…]["”’)]?$/.test(s) ? s : `${s}.`;
}

/** Trims to a word boundary when a single sentence is too long. */
function clip(s: string, max = MAX_LEN): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,;:–—-]+$/, "")}…`;
}

function stripLeadingTitle(excerpt: string, title: string): string {
  const t = title.replace(/[.…]+$/, "").trim();
  if (t.length > 20 && excerpt.toLowerCase().startsWith(t.toLowerCase())) {
    return excerpt.slice(t.length).replace(/^[\s.:;,–—-]+/, "");
  }
  return excerpt;
}

/**
 * Extractive key takeaway: the first one or two complete sentences of the feed's own excerpt
 * (never text we write ourselves), skipping any sentence that just repeats the headline.
 * Falls back to a sentence built from the headline when the excerpt is empty or thin.
 */
export function extractTakeaway(item: RawItem): string {
  if (item.source.id === "fed-speeches") return fedSpeech(item);
  const titleSet = titleTokens(item.title);
  const excerpt = stripLeadingTitle(cleanExcerpt(item.excerpt), item.title);
  const sentences = splitSentences(excerpt).filter((s) => s.length > 25 && jaccard(titleTokens(s), titleSet) < 0.75);

  const complete = sentences.filter(isComplete);
  const pool = complete.length ? complete : sentences;
  if (!pool.length) return fallback(item);

  let out = pool[0];
  if (out.length < 110 && pool[1] && out.length + pool[1].length + 1 <= MAX_LEN) out = `${out} ${pool[1]}`;
  out = clip(out);
  if (out.length < 40) return fallback(item);

  if (item.source.contentType === "podcast" && !/\b(episode|podcast|conversation|interview|joins|guest|talks?)\b/i.test(out)) {
    out = `New episode: ${out}`;
  }
  return ensurePeriod(out);
}

/** Fed speech feeds give "Speaker, Title" plus a venue line; turn that into a readable sentence. */
function fedSpeech(item: RawItem): string {
  const [speaker, ...rest] = item.title.split(", ");
  const topic = rest.join(", ").trim();
  const venue = cleanExcerpt(item.excerpt).replace(/^Speech\s+/i, "").replace(/\.$/, "");
  const venueText = venue ? ` ${venue.charAt(0).toLowerCase()}${venue.slice(1)}` : "";
  if (!topic) return ensurePeriod(`Federal Reserve speech: ${item.title}${venueText}`);
  return ensurePeriod(`Federal Reserve official ${speaker} spoke on “${topic}”${venueText}`);
}

/** Headline tidy-up: drops trailing colons/commas that some feeds leave on titles. */
export function cleanTitle(title: string): string {
  return title.replace(/^(TOP STORY|BREAKING|EXCLUSIVE)\s*[:—–-]\s*/i, "").replace(/[\s:,;–—-]+$/, "").trim();
}

function fallback(item: RawItem): string {
  const title = cleanTitle(item.title).replace(/[.…]+$/, "");
  const org = item.source.name.split(" — ")[0];
  switch (item.source.contentType) {
    case "podcast":
      return `New episode of ${item.source.name.replace(/ \(.*\)$/, "")}: “${title}.”`;
    case "regulator":
      return title.startsWith(org.split(" ")[0]) ? `${title}.` : `${org} announced: ${title}.`;
    case "press-release":
      return `In a press release: ${title}.`;
    default:
      return `${org} reports: ${title}.`;
  }
}
