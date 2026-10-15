import { describe, expect, it } from "vitest";
import { SECTIONS } from "../../pipeline/types";
import { EMPTY_PREFS, hasPrefs, matchesPrefs, orderSections } from "./personalize";
import { mergeSaved, type SavedStory } from "./saved";
import { enabledProviders } from "./supabase";

describe("reader preferences", () => {
  const prefs = { sections: ["hedge-funds" as const], firms: ["Apollo"], subscriptions: [] };

  it("matches stories in a chosen section or mentioning a chosen firm", () => {
    expect(matchesPrefs({ section: "hedge-funds", firms: [] }, prefs)).toBe(true);
    expect(matchesPrefs({ section: "private-equity", firms: ["KKR", "Apollo"] }, prefs)).toBe(true);
    expect(matchesPrefs({ section: "markets", firms: ["KKR"] }, prefs)).toBe(false);
    expect(matchesPrefs({ section: "markets", firms: ["KKR"] }, EMPTY_PREFS)).toBe(false);
  });

  it("knows whether a reader has set any preferences", () => {
    expect(hasPrefs(EMPTY_PREFS)).toBe(false);
    expect(hasPrefs({ sections: [], firms: ["KKR"], subscriptions: [] })).toBe(true);
    expect(hasPrefs({ sections: [], firms: [], subscriptions: ["ft"] })).toBe(false);
  });

  it("puts chosen sections first, keeping the usual order otherwise", () => {
    const ordered = orderSections(SECTIONS, { sections: ["voices", "private-markets"], firms: [], subscriptions: [] }).map((s) => s.id);
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

describe("Google sign-in button", () => {
  it("shows only when Google is switched on in Supabase", () => {
    expect(enabledProviders({ external: { email: true, google: true } })).toEqual({ google: true });
    expect(enabledProviders({ external: { email: true, google: false } })).toEqual({ google: false });
    expect(enabledProviders({})).toEqual({ google: false });
    expect(enabledProviders(null)).toEqual({ google: false });
  });
});

describe("first-timer helpers", () => {
  it("makes glossary terms linkable", async () => {
    const { termSlug } = await import("../../pipeline/enrich/glossary");
    const { parseHash } = await import("./hooks");
    expect(termSlug("High-yield spread")).toBe("high-yield-spread");
    expect(termSlug("Volatility (VIX)")).toBe("volatility-vix");
    expect(termSlug("Form 10-Q / 10-K")).toBe("form-10-q-10-k");
    expect(parseHash("#/glossary/high-yield-spread")).toEqual({ page: "glossary", term: "high-yield-spread" });
    expect(parseHash("#/glossary")).toEqual({ page: "glossary" });
    expect(parseHash("#/account?welcome=1")).toEqual({ page: "account" });
  });

  it("pulls the bottom line to the front, whatever order the edition stored", async () => {
    const { splitBottomLine } = await import("./format");
    const oldOrder = "The S&P 500 stands at 7,718. High-yield credit spreads are 3.25%. Bottom line: calm volatility and open credit markets are supportive.";
    const newOrder = "Bottom line: calm volatility and open credit markets are supportive. The S&P 500 stands at 7,718. High-yield credit spreads are 3.25%.";
    for (const text of [oldOrder, newOrder]) {
      expect(splitBottomLine(text)).toEqual({
        bottomLine: "Calm volatility and open credit markets are supportive.",
        rest: "The S&P 500 stands at 7,718. High-yield credit spreads are 3.25%.",
      });
    }
    expect(splitBottomLine("Market data was unavailable for this edition.")).toEqual({ bottomLine: null, rest: "Market data was unavailable for this edition." });
  });

  it("treats an account as new for 10 minutes after sign-up", async () => {
    const { isNewAccount } = await import("./account");
    const now = Date.parse("2026-10-15T12:00:00Z");
    expect(isNewAccount({ id: "u", email: "a@b.c", createdAt: "2026-10-15T11:55:00Z" }, now)).toBe(true);
    expect(isNewAccount({ id: "u", email: "a@b.c", createdAt: "2026-10-14T11:55:00Z" }, now)).toBe(false);
    expect(isNewAccount(null, now)).toBe(false);
  });
});
