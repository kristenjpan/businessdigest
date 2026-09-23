import type { ArchiveEntry, ArchiveIndex } from "./types";

export const KEEP_DAYS = 90;

/** Edition number for `date`: reuse it when re-running the same day, otherwise one past the latest. */
export function editionFor(index: ArchiveIndex | null, date: string): number {
  const existing = index?.editions.find((e) => e.date === date);
  if (existing) return existing.edition;
  return Math.max(0, ...(index?.editions.map((e) => e.edition) ?? [])) + 1;
}

/**
 * Adds or replaces today's entry, sorts newest first and drops editions older than `keepDays`.
 * Returns the new index and the dates whose archive files should be deleted.
 */
export function updateArchiveIndex(
  index: ArchiveIndex | null,
  entry: ArchiveEntry,
  now: Date,
  keepDays = KEEP_DAYS,
): { index: ArchiveIndex; removed: string[] } {
  const cutoff = new Date(now.getTime() - keepDays * 86_400_000).toISOString().slice(0, 10);
  const all = [entry, ...(index?.editions ?? []).filter((e) => e.date !== entry.date)].sort((a, b) => b.date.localeCompare(a.date));
  const kept = all.filter((e) => e.date >= cutoff);
  const removed = all.filter((e) => e.date < cutoff).map((e) => e.date);
  return { index: { updatedAt: now.toISOString(), editions: kept }, removed };
}
