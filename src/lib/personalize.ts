import type { DigestItem, SectionId } from "../../pipeline/types";

export interface Prefs {
  sections: SectionId[];
  firms: string[];
}

export const EMPTY_PREFS: Prefs = { sections: [], firms: [] };

export function hasPrefs(p: Prefs): boolean {
  return p.sections.length > 0 || p.firms.length > 0;
}

/** A story is "for you" when it's in a chosen section or mentions a chosen firm. */
export function matchesPrefs(item: Pick<DigestItem, "section" | "firms">, p: Prefs): boolean {
  return p.sections.includes(item.section) || item.firms.some((f) => p.firms.includes(f));
}

/** Chosen sections first (in their usual order), then the rest. */
export function orderSections<T extends { id: string }>(sections: readonly T[], p: Prefs): T[] {
  const chosen = new Set<string>(p.sections);
  return [...sections.filter((s) => chosen.has(s.id)), ...sections.filter((s) => !chosen.has(s.id))];
}
