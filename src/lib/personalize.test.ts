import { describe, expect, it } from "vitest";
import { SECTIONS } from "../../pipeline/types";
import { EMPTY_PREFS, hasPrefs, matchesPrefs, orderSections } from "./personalize";
import { mergeSaved, type SavedStory } from "./saved";

describe("reader preferences", () => {
  const prefs = { sections: ["hedge-funds" as const], firms: ["Apollo"] };

  it("matches stories in a chosen section or mentioning a chosen firm", () => {
    expect(matchesPrefs({ section: "hedge-funds", firms: [] }, prefs)).toBe(true);
    expect(matchesPrefs({ section: "private-equity", firms: ["KKR", "Apollo"] }, prefs)).toBe(true);
    expect(matchesPrefs({ section: "markets", firms: ["KKR"] }, prefs)).toBe(false);
    expect(matchesPrefs({ section: "markets", firms: ["KKR"] }, EMPTY_PREFS)).toBe(false);
  });

  it("knows whether a reader has set any preferences", () => {
    expect(hasPrefs(EMPTY_PREFS)).toBe(false);
    expect(hasPrefs({ sections: [], firms: ["KKR"] })).toBe(true);
  });

  it("puts chosen sections first, keeping the usual order otherwise", () => {
    const ordered = orderSections(SECTIONS, { sections: ["voices", "private-markets"], firms: [] }).map((s) => s.id);
    expect(ordered.slice(0, 2)).toEqual(["private-markets", "voices"]);
    expect(ordered).toHaveLength(SECTIONS.length);
    expect(orderSections(SECTIONS, EMPTY_PREFS).map((s) => s.id)).toEqual(SECTIONS.map((s) => s.id));
  });
});

describe("moving browser saves into an account", () => {
  const story = (id: string, savedAt: string, title = id): SavedStory => ({
    id,
    title,
    url: `https://example.com/${id}`,
    source: { name: "Example", homepage: "https://example.com" },
    publishedAt: "2026-10-05T10:00:00.000Z",
    section: "markets",
    takeaway: "A takeaway.",
    editionDate: "2026-10-05",
    savedAt,
  });

  it("unions by story id, prefers the account's copy, and sorts newest first", () => {
    const local = [story("a", "2026-10-05T09:00:00Z", "local a"), story("b", "2026-10-05T11:00:00Z")];
    const remote = [story("a", "2026-10-04T09:00:00Z", "account a"), story("c", "2026-10-05T10:00:00Z")];
    const merged = mergeSaved(local, remote);
    expect(merged.map((s) => s.id)).toEqual(["b", "c", "a"]);
    expect(merged.find((s) => s.id === "a")?.title).toBe("account a");
  });
});
