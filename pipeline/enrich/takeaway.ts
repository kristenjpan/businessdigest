import { jaccard, titleTokens } from "../dedupe";
import type { RawItem } from "../types";

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

/** Podcast show-note openers that introduce rather than inform. */
const FILLER = /^(my guest (today )?is|today(['’]s)? guest is|in (this|today['’]s) (episode|conversation)|on (this|today['’]s) episode|welcome (back )?to|this week on)\b/i;

const MAX_SENTENCE = 300;

/**
 * A sentence the feed cut off ("…a $2.2bn shortfall, according…") is trimmed back to its last
 * complete clause and closed with a period. Returns null when too little would remain.
 */
export function trimToClause(s: string): string | null {
  const body = s.replace(/[\s.…]+$/, "");
  const cuts = [...body.matchAll(/[,;:]\s|\s[—–]\s/g)].map((m) => m.index!).filter((i) => i >= 40);
  const cut = cuts.at(-1);
  if (cut === undefined) return null;
  const out = body.slice(0, cut).replace(/[\s,;:–—-]+$/, "");
  return out.length >= 40 ? ensurePeriod(out) : null; // "…in the U.S." already ends with a period
}

function stripLeadingTitle(excerpt: string, title: string): string {
  const t = title.replace(/[.…]+$/, "").trim();
  if (t.length > 20 && excerpt.toLowerCase().startsWith(t.toLowerCase())) {
    return excerpt.slice(t.length).replace(/^[\s.:;,–—-]+/, "");
  }
  return excerpt;
}

/**
 * Rule-based key takeaway: exactly one complete sentence from the feed's own excerpt (never text
 * we write ourselves). Skips sentences that repeat the headline or are show-note filler, repairs a
 * sentence the feed cut off by trimming to its last full clause, and falls back to a sentence
 * built from the headline when nothing usable is left.
 */
export function extractTakeaway(item: RawItem): string {
  if (item.source.id === "fed-speeches") return fedSpeech(item);
  const titleSet = titleTokens(item.title);
  const excerpt = stripLeadingTitle(cleanExcerpt(item.excerpt), item.title);
  const candidates = splitSentences(excerpt).filter((s) => s.length > 25 && !FILLER.test(s) && jaccard(titleTokens(s), titleSet) < 0.75);

  for (const s of candidates) {
    const sentence = isComplete(s) && s.length <= MAX_SENTENCE ? s : trimToClause(s.slice(0, MAX_SENTENCE));
    if (sentence && sentence.length >= 40) return sentence;
  }
  return fallback(item);
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
