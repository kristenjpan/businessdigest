import type { SearchEntry } from "../../pipeline/types";

/** Stories whose title, takeaway, source or firms contain every word typed, and the chosen firm. */
export function searchArchive(entries: SearchEntry[], query: string, firm: string): SearchEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter((e) => {
    if (firm && !e.f.includes(firm)) return false;
    if (!words.length) return true;
    const hay = `${e.t} ${e.k} ${e.s} ${e.f.join(" ")}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** Firms that appear in the index, most-mentioned first. */
export function firmsInIndex(entries: SearchEntry[]): string[] {
  const counts = new Map<string, number>();
  for (const e of entries) for (const f of e.f) counts.set(f, (counts.get(f) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([f]) => f);
}
