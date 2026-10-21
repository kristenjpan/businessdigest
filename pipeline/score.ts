import { CORE_FIRMS, LOW_VALUE } from "./normalize";
import { SECTIONS, type RawItem, type SectionId } from "./types";

const TIER_WEIGHT = { 1: 3, 2: 2, 3: 1 } as const;

/** Heuristic relevance score used only to shortlist candidates before Claude does the real selection. */
export function score(item: RawItem, now: Date): number {
  let s = TIER_WEIGHT[item.tier];
  if (item.firms.some((f) => CORE_FIRMS.has(f))) s += 3;
  else if (item.firms.length) s += 1.5;
  if (item.section !== "markets") s += 1;
  const hours = (now.getTime() - Date.parse(item.publishedAt)) / 3_600_000;
  s += 2 * Math.max(0, 1 - hours / 48);
  if (LOW_VALUE.test(item.title)) s -= 4;
  if (item.excerpt.length < 40) s -= 1;
  // Wire releases from unknown companies are mostly noise; firm-named ones already got a boost above.
  if (item.source.contentType === "press-release" && item.tier === 3 && !item.firms.length) s -= 1.5;
  if (item.section === "real-estate") s += propertyDealSize(item.title);
  return s;
}

const UNIT: Record<string, number> = { k: 1e3, m: 1e6, mn: 1e6, mil: 1e6, million: 1e6, b: 1e9, bn: 1e9, bil: 1e9, billion: 1e9, tn: 1e12, trillion: 1e12 };

/** Largest money figure in a headline, in plain units ("$2 Billion" → 2e9, "A$6.3bn" → 6.3e9, "€88m" → 8.8e7). */
export function moneyValue(text: string): number {
  let best = 0;
  for (const m of text.matchAll(/(?:[$€£¥]|\b(?:US|A|C|HK|S)\$)\s?(\d[\d,]*(?:\.\d+)?)\s?(k|mn|m|mil|million|bn|b|bil|billion|tn|trillion)?\b/gi)) {
    const value = Number(m[1].replace(/,/g, "")) * (UNIT[(m[2] ?? "").toLowerCase()] ?? 1);
    if (value > best) best = value;
  }
  return best;
}

/**
 * Real Estate & Hotels ranks its biggest stories first: a lift for $100m+ and $1bn+ deals, and a
 * penalty for routine small leases and sales ("Takes 12K SF in Meatpacking", "$7.5M Sale of Restaurant").
 */
export function propertyDealSize(title: string): number {
  const value = moneyValue(title);
  if (value >= 1e9) return 3;
  if (value >= 1e8) return 1.5;
  if (value > 0 && value < 2e7) return -2;
  const sf = title.match(/\b(\d[\d,.]*)\s?(K)?[- ]?(SF|sq\.? ?ft|square[- ]f(?:oo|ee)t)\b/i);
  if (sf && /\b(lease|leases|takes|signs|inks|renews|expands|relocat\w*)\b/i.test(title)) {
    const size = Number(sf[1].replace(/,/g, "")) * (sf[2] ? 1e3 : 1);
    if (size < 50_000) return -2;
  }
  return 0;
}

/** Hours of news to consider: wider after weekends so Monday's digest covers Fri–Sun. */
export function lookbackHours(now: Date): number {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(now);
  if (weekday === "Mon") return 76;
  if (weekday === "Sun" || weekday === "Sat") return 52;
  return 36;
}

/** Longer windows for slower-moving formats (podcasts, research, filings). Kept short so they don't repeat for days. */
export function windowFor(item: RawItem, baseHours: number): number {
  const slow = ["podcast", "research", "filing"].includes(item.source.contentType);
  return slow ? Math.max(baseHours, 3 * 24) : baseHours;
}

export function isRecent(item: RawItem, now: Date, baseHours: number): boolean {
  const age = now.getTime() - Date.parse(item.publishedAt);
  return age >= -3_600_000 && age <= windowFor(item, baseHours) * 3_600_000;
}

/**
 * Picks a diverse shortlist: up to `perSection` of the best items from each section first (taken in turns),
 * then fills by score, never taking more than `perSource` from one source. An optional `priority`
 * ranks ahead of score, so within each section higher-priority stories are taken first.
 */
export function shortlist(
  items: RawItem[],
  now: Date,
  opts: { total: number; perSection: number; perSource: number; sectionCaps?: Partial<Record<SectionId, number>> } = { total: 80, perSection: 6, perSource: 8 },
  priority: (item: RawItem) => number = () => 0,
): RawItem[] {
  // Higher priority always comes first (e.g. stories whose takeaway has a real "so what"), then score.
  const ranked = items
    .map((item) => ({ item, p: priority(item), s: score(item, now) }))
    .sort((a, b) => b.p - a.p || b.s - a.s);
  const picked = new Set<RawItem>();
  const perSource = new Map<string, number>();
  const perSection = new Map<SectionId, number>();
  const filingsIn = new Map<SectionId, number>();
  const take = (item: RawItem) => {
    const n = perSource.get(item.source.id) ?? 0;
    if (n >= opts.perSource || picked.has(item)) return false;
    const inSection = perSection.get(item.section) ?? 0;
    if (inSection >= (opts.sectionCaps?.[item.section] ?? Infinity)) return false;
    // Outside the Filings section, at most one SEC filing per section, so news leads.
    const filing = item.source.contentType === "filing" && item.section !== "filings";
    if (filing && (filingsIn.get(item.section) ?? 0) >= 1) return false;
    perSource.set(item.source.id, n + 1);
    perSection.set(item.section, inSection + 1);
    if (filing) filingsIn.set(item.section, (filingsIn.get(item.section) ?? 0) + 1);
    picked.add(item);
    return true;
  };
  // Round-robin across sections (best remaining story from each in turn), so every section gets
  // its share before any one fills up — later sections such as Voices are never crowded out.
  const bySection = SECTIONS.map(({ id }) => ranked.filter((r) => r.item.section === id).map((r) => r.item));
  const taken = bySection.map(() => 0);
  for (let round = 0; round < opts.perSection && picked.size < opts.total; round++) {
    bySection.forEach((items, s) => {
      if (picked.size >= opts.total || taken[s] > round) return;
      const next = items.find((it) => !picked.has(it) && take(it));
      if (next) taken[s]++;
    });
  }
  for (const { item } of ranked) {
    if (picked.size >= opts.total) break;
    take(item);
  }
  return ranked.filter((r) => picked.has(r.item)).map((r) => r.item);
}
