import { jaccard, titleTokens } from "../dedupe";
import { tagFirms } from "../normalize";
import type { RawItem } from "../types";

/** Boilerplate that feeds append to excerpts: WordPress footers, podcast ad notices, CTAs. */
const BOILERPLATE: RegExp[] = [
  /The post .{0,300}? appeared first on .{0,120}?(\.|$)/gi,
  /(See|Visit) (omnystudio|megaphone|art19|podcastchoices)\.\w+\S* for privacy information\.?/gi,
  /Learn more about your ad choices\.?( Visit \S+)?/gi,
  /Hosted on Acast\. See acast\.com\/privacy for more information\.?/gi,
  /^[\w.-]+\.(net|com|org|co\.uk)\s+[—–-]\s+/i, // "HedgeCo.Net — " style bylines
  /^(TOP STORY|BREAKING|EXCLUSIVE|UPDATE|WATCH|LISTEN)\s*[:—–-]\s*/i,
  /^[A-Z][A-Z &'’-]{3,40}:\s+/, // all-caps rubrics: "STORIES OF TRANSFORMATION: "
  /\bKey takeaways?:\s*/gi,
  /\bArticle link\b\.?/gi,
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
const ABBREVIATIONS = /\b([A-Z](?=\.\s[A-Z][a-z])|J\.P|U\.S|U\.K|U\.N|E\.U|Inc|Corp|Co|Ltd|L\.P|LLC|Mr|Ms|Mrs|Dr|St|vs|No|approx|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|e\.g|i\.e|Jr|Sr)\./g;
const PLACEHOLDER = "\u0000";

export function cleanExcerpt(text: string): string {
  let s = text.replace(TRUNCATED, "… ").replace(/\.{3}/g, "…");
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

/** Pull quotes and attributed quotes ("“I presume these are…”") say who said something, not what happened. */
const QUOTE_FIRST = /^["“‘']/;

const MAX_SENTENCE = 300;

/**
 * A sentence the feed cut off ("…a $2.2bn shortfall, according…") is trimmed back to its last
 * complete clause and closed with a period. Never cuts inside a name list ("Welsh, Carson,
 * Anderson & Stowe"). Returns null when too little would remain.
 */
export function trimToClause(s: string): string | null {
  const body = s.replace(/[\s.…]+$/, "");
  // "X, part of BlackRock, will acquire…": a comma followed by the main verb ends the subject, so
  // any cut before it would leave a subject with no verb.
  const predicate = [...body.matchAll(/,\s(?:will|would|has|have|had|is|are|was|were|said|says|can|could|may)\b/g)].at(-1)?.index ?? -1;
  const cuts = [...body.matchAll(/[,;:]\s|\s[—–]\s/g)]
    .map((m) => m.index!)
    .filter((i) => i >= 40 && i > predicate && !(body[i] === "," && /[A-Z]\w*$/.test(body.slice(0, i)) && /^,\s[A-Z]/.test(body.slice(i))));
  const cut = cuts.at(-1);
  if (cut === undefined) return null;
  const out = body.slice(0, cut).replace(/[\s,;:–—-]+$/, "");
  // "The Housing Authority and Reid Park Partners, which includes …": the main clause needs a verb.
  const main = out.split(/,\s(?:which|who|whose|including|a|an|the)\b/)[0];
  if (!/\b(has|have|had|is|are|was|were|will|would|can|could|may|said|says|[a-z]+ed|[a-z]{3,}s)\b/.test(main.replace(/\b[A-Z]\w*/g, ""))) return null;
  return out.length >= 40 ? ensurePeriod(out) : null; // "…in the U.S." already ends with a period
}

// ── "So what" scoring ─────────────────────────────────────────────────────
// A useful takeaway names who, what changed and the key number. Each candidate sentence is scored
// on those three, and the best one wins (not simply the first).

/** A key number: money, percentages, basis points, multiples, or a count of deals, funds, clients… */
export const KEY_NUMBER =
  /(?:[$€£¥]|\b(?:US|A|C|HK|S)\$|\b(?:AUD|USD|EUR|GBP|CHF|JPY)\s?)\s?\d|\b\d[\d.,]*\s?(?:%|percent\b|bps\b|basis points\b|(?:bn|billion|mn|million|tn|trillion)\b|-?times\b|x\b)|\b\d[\d,]*\s(?:[a-z-]+\s){0,2}(?:deals|funds|companies|firms|transactions|investments|assets|properties|clients|advisors|employees|jobs|clinics|sectors|loans|homes|units)\b|\b\d[\d,.]*(?:-|\s)(?:units?|rooms?|keys|beds?|acres?|stor(?:y|ies)|square-f(?:oo|ee)t)\b|\b\d[\d,.]*\s?K?[- ]?(?:SF|sq\.? ?ft)\b/i;

/** What changed: deal, raise, launch, move, hire, result… (stems, so "acquires", "acquired" both match). */
const ACTION =
  /\b(acquir|buy|bought|sell|sold|rais|clos(e|es|ed|ing)\b|launch|invest(s|ed|ing)?\b|deploy|lend|lent\b|cut|hik|rose\b|rise|rising|fell\b|fall|surg(e|es|ed|ing)\b|jump|climb|drop|plung|slump|soar|tumbl|fil(e|ed|es|ing)\b|hir(e|ed|es|ing)\b|appoint|named\b|exit|agree|sign(s|ed|ing)?\b|report|post(s|ed)\b|reach|record(s|ed)\b|attract|dr(aw|ew|aws|awn)\b|shed|lost\b|los(e|es|ing)\b|gain|complet|announc|expand|merg|spin|leav|join|step(s|ped)? down|approv|block(s|ed|ing)?\b|charg|sue[sd]?\b|settl|grow|grew|doubl|tripl|exceed|beat|miss(es|ed)?\b|delay|halt|redeem|redemption|outflow|inflow|warn|boost|slash|shut|wins?\b|won\b|tak(e|es|ing) (over|private|a stake)|took\b|opens?\b|opened\b|hits?\b)/i;

/** Openers that name no one in particular ("Investors want…", "Lots of forces…"). */
const VAGUE_SUBJECT = /^(investors?|markets?|analysts?|traders?|experts?|advis[eo]rs?|economists?|many|some|most|lots of|the best|there (is|are|was|were)|it(['’]s| is| was)|this|these|that|those|we|you|they|everyone|people)\b/i;

/** Capitalised openers that are not a named actor. */
export const GENERIC_OPENER = /^(He|She|They|It|We|I|You|The|A|An|In|On|At|For|By|As|After|Before|While|With|From|This|These|That|Those|Its|Their|Our|His|Her|U\.S\.|US|UK|Investors?|Markets?|Analysts?|Traders?|Lots|Many|Some|Most|Every|Today|Yesterday|Last|Next|New)\b/;

/** A sentence that opens with a named actor: "Kartesia Asset Finance has…", "BlackRock reported…". */
const NAMED_OPENER = /^(?:[A-Z][\w’'&.-]*(?:\s|,\s)){1,5}?(?:has|have|had|is|are|was|were|will|would|said|says|\w+ed|\w+s)\b/;

export interface TakeawayScore {
  score: number;
  hasNumber: boolean;
  hasActor: boolean;
  hasAction: boolean;
}

export function scoreSentence(s: string, index = 0): TakeawayScore {
  const hasNumber = KEY_NUMBER.test(s);
  const hasActor = tagFirms(s).length > 0 || (!GENERIC_OPENER.test(s) && NAMED_OPENER.test(s));
  const hasAction = ACTION.test(s);
  let score = 0;
  if (hasNumber) score += 3;
  if (hasActor) score += 2;
  if (hasAction) score += 2;
  if (index < 2) score += 1;
  if (VAGUE_SUBJECT.test(s) && !hasNumber) score -= 3;
  if (/\?["”’]?$/.test(s)) score -= 2; // a question doesn't tell you what happened
  return { score, hasNumber, hasActor, hasAction };
}

/** Says what changed and either who or how much. */
export function isStrong(t: TakeawayScore): boolean {
  return t.hasAction && (t.hasNumber || t.hasActor);
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
 * we write ourselves). Skips sentences that repeat the headline, quotations and show-note filler,
 * repairs a sentence the feed cut off by trimming to its last full clause, and then picks the
 * sentence with the most "so what" (who, what changed, the key number); ties go to the earlier one.
 * Falls back to a sentence built from the headline (fromExcerpt: false) when nothing usable is left.
 * `strong` marks a takeaway that says what changed and either who or how much.
 */
export function takeawayFor(item: RawItem): { text: string; fromExcerpt: boolean; strong: boolean } {
  if (item.source.id === "fed-speeches") return { text: fedSpeech(item), fromExcerpt: true, strong: true };
  const titleSet = titleTokens(item.title);
  const excerpt = stripLeadingTitle(cleanExcerpt(item.excerpt), item.title);
  const candidates = splitSentences(excerpt).filter(
    (s) => s.length > 25 && !FILLER.test(s) && !QUOTE_FIRST.test(s) && jaccard(titleTokens(s), titleSet) < 0.75,
  );

  let best: { text: string; rating: TakeawayScore } | null = null;
  candidates.forEach((s, i) => {
    const sentence = isComplete(s) && s.length <= MAX_SENTENCE ? s : trimToClause(s.slice(0, MAX_SENTENCE));
    if (!sentence || sentence.length < 40) return;
    const rating = scoreSentence(sentence, i);
    if (!best || rating.score > best.rating.score) best = { text: sentence, rating };
  });
  if (best) {
    const { text, rating } = best as { text: string; rating: TakeawayScore };
    return { text, fromExcerpt: true, strong: isStrong(rating) };
  }
  return { text: fallback(item), fromExcerpt: false, strong: false };
}

/** The takeaway text alone; see takeawayFor for whether it came from the publisher's excerpt. */
export function extractTakeaway(item: RawItem): string {
  return takeawayFor(item).text;
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
