import { LOW_VALUE } from "../normalize";
import { score, shortlist } from "../score";
import { SECTIONS, type DigestItem, type ExecutiveBrief, type RawItem } from "../types";
import { FIRM_PROFILES, leadFirm } from "./firms";
import { findTerm } from "./glossary";
import { cap, MarketView, sentence } from "./market";
import { classify, pickBySeed, resolveSection, type Theme } from "./themes";
import { cleanTitle, extractTakeaway } from "./takeaway";

/**
 * The keyless enrichment engine. Deterministic, rule-based and free: no LLM, no API key.
 * Given the same feed items and market data it always produces the same digest.
 */
export const ENGINE = "rules-v1";

export function whyItMatters(item: RawItem, theme: Theme): string {
  const firm = leadFirm(item.firms);
  const parts = [firm ? FIRM_PROFILES[firm] : null, pickBySeed(theme.why, item.id), theme.allocator];
  return parts.filter(Boolean).join(" ");
}

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
  const term = findTerm(`${item.title} ${item.excerpt}`, theme.term);
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
    takeaway: extractTakeaway(item),
    whyItMatters: whyItMatters(item, theme),
    marketContext: marketContext(theme, market),
    beginnerNote: term ? { term: term.term, explanation: term.explanation } : null,
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
export function selectAndEnrich(unique: RawItem[], market: MarketView, now: Date, total = 24): Selection {
  // Drop advice columns, reruns and routine notices outright, then re-home items by theme so the
  // shortlist's per-section diversity works on the sections readers will actually see.
  const pool = unique
    .filter((i) => !LOW_VALUE.test(i.title))
    .map((i) => ({ ...i, section: resolveSection(i, classify(i)) }));
  const picked = shortlist(pool, now, { total, perSection: 5, perSource: 4 });
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

function firstSentence(text: string, max = 170): string {
  const s = text.replace(/^New episode: /, "");
  const end = s.search(/[.!?](\s|$)/);
  const one = end > 0 ? s.slice(0, end + 1) : s;
  if (one.length <= max) return one;
  const cut = one.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

export function buildMarketRead(market: MarketView): string {
  if (market.empty) return "Market data was unavailable for this edition.";
  const parts: string[] = [];
  const equities = sentence([market.sp500?.text, market.vix?.text]);
  const rates = sentence([market.fedFunds?.text, market.tenYear?.text, market.curve?.text]);
  const credit = market.hy ? `${cap(market.hy.text)}.` : null;
  if (equities) parts.push(equities);
  if (rates) parts.push(rates);
  if (credit) parts.push(credit);
  const tone = market.tone;
  if (tone === "risk-on") parts.push("Bottom line: calm volatility and open credit markets are a supportive backdrop for dealmaking, fundraising and exits.");
  else if (tone === "risk-off") parts.push("Bottom line: stressed volatility and credit conditions tend to slow deals and IPOs and favor defensive positioning.");
  else if (tone === "mixed") parts.push("Bottom line: signals are mixed, with some markets calm and others showing strain, so expect selective risk-taking.");
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
    bullets: bulletItems.map((i) => `${i.theme.label}: ${firstSentence(i.takeaway)}`),
    marketRead: buildMarketRead(market),
    themes,
  };
}

