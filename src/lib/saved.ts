import type { DigestItem, SectionId, StoryType } from "../../pipeline/types";

/** A saved story is a snapshot, so it survives after its edition leaves the 90-day archive. */
export interface SavedStory {
  id: string;
  title: string;
  url: string;
  source: { name: string; homepage: string };
  publishedAt: string;
  section: SectionId;
  storyType?: StoryType;
  takeaway: string;
  editionDate: string;
  savedAt: string; // ISO 8601
}

const KEY = "tda-saved";

export function snapshot(item: DigestItem, editionDate: string, now = new Date()): SavedStory {
  return {
    id: item.id,
    title: item.title,
    url: item.url,
    source: { name: item.source.name, homepage: item.source.homepage },
    publishedAt: item.publishedAt,
    section: item.section,
    storyType: item.storyType,
    takeaway: item.takeaway,
    editionDate,
    savedAt: now.toISOString(),
  };
}

/** Union by story id (the account's copy wins), newest save first. */
export function mergeSaved(local: SavedStory[], remote: SavedStory[]): SavedStory[] {
  const byId = new Map<string, SavedStory>();
  for (const s of local) byId.set(s.id, s);
  for (const s of remote) byId.set(s.id, s);
  return [...byId.values()].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** Browser storage can be unavailable (private mode, blocked site data); never let that break the page. */
export function readLocalSaved(): SavedStory[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((s) => s && typeof s.id === "string" && typeof s.url === "string") : [];
  } catch {
    return [];
  }
}

export function writeLocalSaved(list: SavedStory[]): void {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: saves last for this visit only */
  }
}
