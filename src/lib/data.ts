import type { ArchiveIndex, Digest } from "../../pipeline/types";

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}${path}`, { cache: "no-cache" });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Today's edition, committed to the repo daily by the GitHub Action. Null if none exists yet. */
export const loadLatest = () => getJson<Digest>("data/latest.json");

/** A past edition from the archive (kept for 90 days). */
export const loadEdition = (date: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) ? getJson<Digest>(`data/archive/${date}.json`) : Promise.resolve(null);

export const loadArchiveIndex = () => getJson<ArchiveIndex>("data/archive/index.json");
