import { LOW_VALUE } from "../normalize";
import { score, shortlist } from "../score";
import { SECTIONS, type DigestItem, type ExecutiveBrief, type RawItem } from "../types";
import { findTerm } from "./glossary";
import { cap, MarketView, sentence } from "./market";
import { classify, resolveSection, type Theme } from "./themes";
import { storyTypeOf } from "./storyType";
import { cleanTitle, takeawayFor } from "./takeaway";
import { whyItMatters } from "./whyItMatters";

export { whyItMatters };

/**
 * The keyless enrichment engine. Deterministic, rule-based and free: no LLM, no API key.
 * Given the same feed items and market data it always produces the same digest.
 */
export const ENGINE = "rules-v5";

export function marketContext(theme: Theme, market: MarketView): string {
  if (market.empty) return "Live market data was unavailable for this edition. See the Sources page for FRED links.";
  const text = theme.context(market) ?? sentence([market.sp500?.text, market.tenYear?.text]) ?? "";
  return market.asOf ? `${text} (FRED data as of ${market.asOf}.)` : text;
}

/** Maps a raw relevance score plus theme weight onto a 1–5 importance scale. */
export function importanceOf(rawScore: number, theme: Theme): number {
  const s = rawScore + theme.weight;
  if (s >= 9) return 5;
  if (s >= 7) return 4;
  if (s >= 5) return 3;
  if (s >= 3) return 2;
  return 1;
}

export function enrichItem(item: RawItem, market: MarketView, now: Date): DigestItem & { rank: number } {
  const theme = classify(item);
  const raw = score(item, now);
  const section = resolveSection(item, theme);
  const term = findTerm(`${item.title} ${item.excerpt}`, theme.term, section === "real-estate" ? "Real estate & hotels" : undefined);
  const takeaway = takeawayFor(item);
  return {
    id: item.id,
    title: cleanTitle(item.title),
    url: item.url,
    publishedAt: item.publishedAt,
    source: item.source,
    section,
    firms: item.firms,
    theme: { id: theme.id, label: theme.label },
    importance: importanceOf(raw, theme),
    takeaway: takeaway.text,
    whyItMatters: whyItMatters(item, theme, takeaway.text, takeaway.fromExcerpt),
    marketContext: marketContext(theme, market),
    beginnerNote: term ? { term: term.term, explanation: term.explanation } : null,
    storyType: storyTypeOf(item),
    aiSummarized: false,
    rank: raw + theme.weight,
  };
}

export interface Selection {
  items: DigestItem[];
  topStoryIds: string[];
}

/**
 * Picks a diverse edition from the deduplicated pool, enriches each item, orders by section then
 * importance, and chooses three Top Stories (different sections; no filings or podcasts).
 */
export function selectAndEnrich(unique: RawItem[], market: MarketView, now: Date, total = 27): Selection {
  // Drop advice columns, reruns and routine notices outright, then re-home items by theme so the
  // shortlist's per-section diversity works on the sections readers will actually see.
  const pool = unique
    .filter((i) => !LOW_VALUE.test(i.title))
    .map((i) => ({ ...i, section: resolveSection(i, classify(i)) }));
  // Tiered fill: stories whose takeaway has a "so what" (what changed, plus who or how much) first,
  // then other stories with a real summary, then headline-only stories (which would show the
  // headline twice) only when there aren't enough of the others to fill the edition.
  const tier = new Map(pool.map((i) => {
    const t = takeawayFor(i);
    return [i, t.strong ? 2 : t.fromExcerpt ? 1 : 0] as const;
  }));
  const rich = pool.filter((i) => tier.get(i)! > 0);
  const picked = shortlist(rich.length >= total ? rich : pool, now, { total, perSection: 5, perSource: 4, sectionCaps: { "real-estate": 4 } }, (i) => tier.get(i) ?? 0);
  const enriched = picked.map((i) => enrichItem(i, market, now));

  const byRank = [...enriched].sort((a, b) => b.rank - a.rank || b.publishedAt.localeCompare(a.publishedAt));
  const top: typeof enriched = [];
  for (const it of byRank) {
    if (top.length === 3) break;
    if (it.source.contentType === "filing" || it.source.contentType === "podcast") continue;
    if (top.some((t) => t.section === it.section)) continue;
    top.push(it);
  }

  const order = new Map<string, number>(SECTIONS.map((s, i) => [s.id, i]));
  const items = enriched
    .sort((a, b) => order.get(a.section)! - order.get(b.section)! || b.rank - a.rank || b.publishedAt.localeCompare(a.publishedAt))
    .map(({ rank: _rank, ...rest }) => rest);
  return { items, topStoryIds: top.map((t) => t.id) };
}

export function buildMarketRead(market: MarketView): string {
  if (market.empty) return "Market data was unavailable for this edition.";
  const parts: string[] = [];
  const equities = sentence([market.sp500?.text, market.vix?.text]);
  const rates = sentence([market.fedFunds?.text, market.tenYear?.text, market.curve?.text]);
  const credit = market.hy ? `${cap(market.hy.text)}.` : null;
  // Lead with the conclusion, then the numbers behind it.
  const tone = market.tone;
  if (tone === "risk-on") parts.push("Bottom line: calm volatility and open credit markets are a supportive backdrop for dealmaking, fundraising and exits.");
  else if (tone === "risk-off") parts.push("Bottom line: stressed volatility and credit conditions tend to slow deals and IPOs and favor defensive positioning.");
  else if (tone === "mixed") parts.push("Bottom line: signals are mixed, with some markets calm and others showing strain, so expect selective risk-taking.");
  if (equities) parts.push(equities);
  if (rates) parts.push(rates);
  if (credit) parts.push(credit);
  return parts.join(" ");
}

export function buildBrief(sel: Selection, market: MarketView): ExecutiveBrief {
  const byId = new Map(sel.items.map((i) => [i.id, i]));
  const tops = sel.topStoryIds.map((id) => byId.get(id)).filter((i): i is DigestItem => Boolean(i));
  const rest = [...sel.items]
    .filter((i) => !sel.topStoryIds.includes(i.id) && i.source.contentType !== "filing")
    .sort((a, b) => b.importance - a.importance || b.publishedAt.localeCompare(a.publishedAt));
  const bulletItems = [...tops, ...rest].slice(0, 5);

  const counts = new Map<string, { id: string; label: string; count: number }>();
  for (const i of sel.items) {
    const c = counts.get(i.theme.id) ?? { ...i.theme, count: 0 };
    c.count++;
    counts.set(i.theme.id, c);
  }
  const themes = [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 6);

  return {
    headline: tops[0]?.title ?? sel.items[0]?.title ?? "Today's investment intelligence",
    // Takeaways are a single complete sentence, so bullets use them whole (no clipping).
    bullets: bulletItems.map((i) => `${i.theme.label}: ${i.takeaway}`),
    marketRead: buildMarketRead(market),
    themes,
  };
}

