import { CORE_FIRMS, LOW_VALUE } from "./normalize";
import { SECTIONS, type RawItem } from "./types";

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
  return s;
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
 * then fills by score, never taking more than `perSource` from one source.
 */
export function shortlist(items: RawItem[], now: Date, opts = { total: 80, perSection: 6, perSource: 8 }): RawItem[] {
  const ranked = items.map((item) => ({ item, s: score(item, now) })).sort((a, b) => b.s - a.s);
  const picked = new Set<RawItem>();
  const perSource = new Map<string, number>();
  const take = (item: RawItem) => {
    const n = perSource.get(item.source.id) ?? 0;
    if (n >= opts.perSource || picked.has(item)) return false;
    perSource.set(item.source.id, n + 1);
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
