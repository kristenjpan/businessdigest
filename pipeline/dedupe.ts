import { canonicalUrl, FIRM_PATTERNS } from "./normalize";
import type { RawItem } from "./types";

const STOPWORDS = new Set(
  "a an and are as at be by for from has have in into is it its of on or says said than that the their this to was were will with after over new".split(
    " ",
  ),
);

export function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[’']s\b/g, "")
      .replace(/[^a-z0-9$%.\s]/g, " ")
      .split(/\s+/)
      .map((t) => t.replace(/\.+$/, "")) // "demand." at a sentence end is the same word as "demand"
      .filter((t) => t.length > 1 && !STOPWORDS.has(t)),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * Removes duplicates by canonical URL, then by near-identical headline.
 * When two items collide, the one from the more authoritative tier (then the earlier one) wins.
 */
export function dedupe(items: RawItem[], threshold = 0.6): RawItem[] {
  const sorted = [...items].sort((a, b) => a.tier - b.tier || a.publishedAt.localeCompare(b.publishedAt));
  const seenUrls = new Set<string>();
  const kept: { item: RawItem; tokens: Set<string> }[] = [];
  for (const item of sorted) {
    const key = canonicalUrl(item.url);
    // Podcast items without their own link fall back to the show homepage; don't collapse those.
    const urlIsSpecific = key !== canonicalUrl(item.source.homepage);
    if (urlIsSpecific && seenUrls.has(key)) continue;
    const tokens = titleTokens(item.title);
    if (kept.some((k) => jaccard(k.tokens, tokens) >= threshold)) continue;
    if (urlIsSpecific) seenUrls.add(key);
    kept.push({ item, tokens });
  }
  return kept.map((k) => k.item);
}

const COMMON_CAPS = new Set(
  "about according after announced announces capital commercial company committed completes exclusive federal fund funds global group growth holdings investment investments launch launches management million billion partners private equity credit report reports says series strategy venture wealth president executive chief officer founder chair advisors adviser hires names appoints team reuters bloomberg opalesque hedgeco press release statement january february march april june july august september october november december monday tuesday wednesday thursday friday".split(
    " ",
  ),
);

// Firm names are shared by unrelated stories about the same firm; title-case verbs are noise too.
const FIRM_WORDS = new Set(Object.keys(FIRM_PATTERNS).flatMap((f) => f.toLowerCase().split(/\W+/)));
const TITLE_VERBS = new Set(
  "acquires adds agrees backs buys closes emerges expands files hires joins launches names opens plans raises recruits rejects sells signs taps takes wins".split(" "),
);

/** Distinctive proper nouns: capitalized words of 5+ letters that aren't boilerplate. */
function properNouns(text: string): Set<string> {
  return new Set((text.match(/\b[A-Z][A-Za-z&]{4,}\b/g) ?? []).map((w) => w.toLowerCase()).filter((w) => !COMMON_CAPS.has(w) && !FIRM_WORDS.has(w) && !TITLE_VERBS.has(w)));
}

function amounts(text: string): Set<string> {
  return new Set((text.match(/\$\s?\d[\d.,]*/g) ?? []).map((a) => a.replace(/[\s,]/g, "").replace(/\.0+$/, "")));
}

/**
 * Catches the same story told by two outlets with different headlines ("KKR Committed $350 Million
 * to Launch Akrapoint…" vs "KKR launches $350m equipment finance platform"). Two items are the same
 * story when they share a rare proper noun (mentioned by no other item) that appears in a headline,
 * and either share a dollar amount, or the noun is in both headlines alongside a firm, an amount or a
 * second rare noun. The more authoritative (then earlier) item is kept.
 */
export function dedupeStories(items: RawItem[]): RawItem[] {
  const titleNouns = items.map((i) => properNouns(i.title));
  const nouns = items.map((i, k) => new Set([...titleNouns[k], ...properNouns(i.excerpt.slice(0, 200))]));
  const df = new Map<string, number>();
  for (const set of nouns) for (const n of set) df.set(n, (df.get(n) ?? 0) + 1);

  const order = items.map((_, i) => i).sort((a, b) => items[a].tier - items[b].tier || items[a].publishedAt.localeCompare(items[b].publishedAt));
  const dropped = new Set<number>();
  for (const a of order) {
    if (dropped.has(a)) continue;
    for (const b of order) {
      if (a === b || dropped.has(b)) continue;
      const rare = [...nouns[a]].filter((n) => nouns[b].has(n) && df.get(n) === 2);
      const inBothTitles = rare.filter((n) => titleNouns[a].has(n) && titleNouns[b].has(n));
      const inATitle = rare.some((n) => titleNouns[a].has(n) || titleNouns[b].has(n));
      if (!inATitle) continue;
      const sharedFirm = items[a].firms.some((f) => items[b].firms.includes(f));
      const amtA = amounts(`${items[a].title} ${items[a].excerpt}`);
      const sharedAmount = [...amounts(`${items[b].title} ${items[b].excerpt}`)].some((x) => amtA.has(x));
      if ((inBothTitles.length && (rare.length >= 2 || sharedFirm || sharedAmount)) || sharedAmount) dropped.add(b);
    }
  }
  return items.filter((_, i) => !dropped.has(i));
}
