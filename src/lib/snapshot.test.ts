import { describe, expect, it } from "vitest";
import { SECTIONS, type DigestItem, type SectionId } from "../../pipeline/types";
import { orderSections } from "./personalize";
import { sectionSnapshots, sectionSummary, sixtySecondVersion } from "./snapshot";

const item = (id: string, section: SectionId, themeId: string, title = `Story ${id}`): DigestItem =>
  ({
    id,
    title,
    url: `https://x/${id}`,
    publishedAt: "2026-10-15T10:00:00Z",
    source: { id: "s", name: "Source", homepage: "https://x", contentType: "news" },
    section,
    firms: [],
    theme: { id: themeId, label: themeId },
    importance: 3,
    takeaway: "Takeaway.",
    whyItMatters: "Why.",
    marketContext: null,
    beginnerNote: null,
  }) as unknown as DigestItem;

const items = [
  item("pe1", "private-equity", "deals", "Apollo’s £5.7bn easyJet takeover faces union opposition"),
  item("pe2", "private-equity", "deals"),
  item("pe3", "private-equity", "exits"),
  item("pe4", "private-equity", "deals"),
  item("hf1", "hedge-funds", "hedge-funds", "Millennium raise draws $30bn"),
  item("hf2", "hedge-funds", "ai-tech"),
  item("hf3", "hedge-funds", "markets"),
  item("m1", "markets", "rates", "Fed holds rates steady."),
];

describe("section snapshot", () => {
  it("gives each section one lead, up to two headlines and its total, skipping empty sections", () => {
    const snaps = sectionSnapshots(items, SECTIONS);
    expect(snaps.map((s) => s.id)).toEqual(["markets", "private-equity", "hedge-funds"]);
    const pe = snaps.find((s) => s.id === "private-equity")!;
    expect(pe.lead.id).toBe("pe1");
    expect(pe.headlines.map((h) => h.id)).toEqual(["pe2", "pe3"]);
    expect(pe.total).toBe(4);
  });

  it("puts a reader's chosen sections first", () => {
    const ordered = orderSections(SECTIONS, { sections: ["hedge-funds"], firms: [], subscriptions: [] });
    expect(sectionSnapshots(items, ordered)[0].id).toBe("hedge-funds");
  });

  it("summarizes each section in one line from its own stories", () => {
    const pe = items.filter((i) => i.section === "private-equity");
    expect(sectionSummary("Private Equity", pe)).toBe(
      "Private Equity today: mostly deals and buyouts, led by “Apollo’s £5.7bn easyJet takeover faces union opposition.”",
    );
    const hf = items.filter((i) => i.section === "hedge-funds");
    expect(sectionSummary("Hedge Funds", hf)).toBe("Hedge Funds today: a mix of hedge fund moves and AI and technology, led by “Millennium raise draws $30bn.”");
    // Within its own section, "hedge fund moves" would just restate the title, so it's skipped.
    expect(sectionSummary("Hedge Funds", hf, "hedge-funds")).toBe("Hedge Funds today: a mix of AI and technology and market moves, led by “Millennium raise draws $30bn.”");
    const voices = [item("v1", "voices", "voices", "Son on superintelligence"), item("v2", "voices", "voices")];
    expect(sectionSummary("Voices & Interviews", voices, "voices")).toBe("Voices & Interviews today: led by “Son on superintelligence.”");
    expect(sectionSummary("Markets & Macro", [items[7]])).toBe("Markets & Macro today: led by “Fed holds rates steady.”");
  });

  it("builds the 60-Second Version: one line per section, naming its lead story", () => {
    const lines = sixtySecondVersion(sectionSnapshots(items, SECTIONS));
    expect(lines).toEqual([
      { id: "markets", label: "Markets & Macro", headline: "Fed holds rates steady.", storyId: "m1" },
      { id: "private-equity", label: "Private Equity", headline: "Apollo’s £5.7bn easyJet takeover faces union opposition", storyId: "pe1" },
      { id: "hedge-funds", label: "Hedge Funds", headline: "Millennium raise draws $30bn", storyId: "hf1" },
    ]);
  });
});
