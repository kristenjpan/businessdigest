import { describe, expect, it } from "vitest";
import { editionFor, updateArchiveIndex } from "../archive";
import { dedupeStories } from "../dedupe";
import { buildBrief, buildMarketRead, enrichItem, selectAndEnrich } from "../enrich";
import { findTerm, GLOSSARY } from "../enrich/glossary";
import { describeMove, hyRegime, MarketView, vixRegime } from "../enrich/market";
import { cleanExcerpt, extractTakeaway, splitSentences } from "../enrich/takeaway";
import { classify, THEMES } from "../enrich/themes";
import type { ArchiveIndex, MarketSeries, RawItem, SourceRef } from "../types";

const now = new Date("2026-09-23T15:00:00Z");

const news: SourceRef = { id: "pe-wire", name: "Private Equity Wire", homepage: "https://example.com/", contentType: "news" };

function raw(o: Partial<RawItem> = {}): RawItem {
  return {
    id: Math.random().toString(36).slice(2),
    title: "Untitled",
    url: `https://example.com/${Math.random().toString(36).slice(2)}`,
    publishedAt: "2026-09-23T12:00:00.000Z",
    excerpt: "An excerpt that is long enough to count as substantive text for the takeaway.",
    source: news,
    tier: 2,
    firms: [],
    section: "private-equity",
    ...o,
  };
}

function series(id: string, value: number, previous: number | null, unit: "index" | "percent" = "percent"): MarketSeries {
  return { id, label: id, unit, value, previous, asOf: "2026-09-22", history: [], sourceUrl: "" };
}

const market = new MarketView([
  series("SP500", 7764.64, 7760, "index"),
  series("DGS10", 4.96, 5.01),
  series("DGS2", 4.76, 4.76),
  series("T10Y2Y", 0.25, 0.2),
  series("VIXCLS", 14.2, 14.9, "index"),
  series("BAMLH0A0HYM2", 2.68, 2.66),
  series("DFF", 3.88, 3.88),
]);

describe("theme classification", () => {
  it("recognises core investment themes from headlines", () => {
    expect(classify(raw({ title: "Blackstone agrees to acquire software maker in $4bn take-private" })).id).toBe("deals");
    expect(classify(raw({ title: "Ares holds final close on sixth direct lending fund" })).id).toMatch(/fundraising|private-credit/);
    expect(classify(raw({ title: "Apollo private credit fund sees redemption requests fall" })).id).toBe("private-credit");
    expect(classify(raw({ title: "Family offices boost allocations to private credit", section: "private-markets" })).id).toMatch(/family-office|private-credit/);
    expect(classify(raw({ title: "Fed holds interest rates steady, signals patience on inflation", section: "markets" })).id).toBe("rates");
  });

  it("uses form type for filings and the voices theme for podcasts", () => {
    const filing: SourceRef = { id: "edgar-bx", name: "SEC EDGAR", homepage: "", contentType: "filing" };
    expect(classify(raw({ title: "Blackstone Inc. 8-K: Results of operations (earnings)", source: filing, section: "filings" })).id).toBe("earnings");
    expect(classify(raw({ title: "Bridgewater Associates, LP files Form 13F-HR", source: filing, section: "hedge-funds" })).id).toBe("holdings");
    const pod: SourceRef = { id: "pod", name: "A Podcast", homepage: "", contentType: "podcast" };
    expect(classify(raw({ title: "A conversation with a legendary investor", source: pod, section: "voices" })).id).toBe("voices");
  });

  it("falls back to the section default when nothing matches", () => {
    expect(classify(raw({ title: "Quarterly newsletter", excerpt: "Nothing specific here at all to see.", section: "hedge-funds" })).id).toBe("hedge-funds");
  });

  it("every theme's default glossary term exists", () => {
    const terms = new Set(GLOSSARY.map((g) => g.term));
    for (const t of THEMES) expect(terms.has(t.term), `${t.id} → ${t.term}`).toBe(true);
  });
});

describe("takeaway extraction", () => {
  it("strips feed boilerplate", () => {
    expect(cleanExcerpt("Big news today. The post Big news appeared first on Example Site.")).toBe("Big news today.");
    expect(cleanExcerpt("HedgeCo.Net — KKR announced a deal for Akrapoint Commerc… Continue reading →")).toBe("KKR announced a deal for Akrapoint…");
    expect(cleanExcerpt("Penalty for violations (SCI).According to the order")).toBe("Penalty for violations (SCI). According to the order");
  });

  it("does not split on abbreviations", () => {
    expect(splitSentences("The U.S. economy grew. Mr. Smith agreed.")).toEqual(["The U.S. economy grew.", "Mr. Smith agreed."]);
  });

  it("takes the first complete sentences, skipping a repeated headline and filler", () => {
    const t = extractTakeaway(
      raw({
        title: "KKR raises $5bn for Asia fund",
        excerpt: "KKR raises $5bn for Asia fund. The firm said demand came from pensions and family offices across the region. More details inside.",
      }),
    );
    expect(t).toBe("The firm said demand came from pensions and family offices across the region.");
  });

  it("falls back to the headline when the excerpt is thin", () => {
    expect(extractTakeaway(raw({ title: "Carlyle names new CIO", excerpt: "" }))).toBe("Private Equity Wire reports: Carlyle names new CIO.");
  });

  it("turns Fed speech metadata into a sentence", () => {
    const fed: SourceRef = { id: "fed-speeches", name: "Federal Reserve — Speeches", homepage: "", contentType: "regulator" };
    expect(extractTakeaway(raw({ source: fed, title: "Barr, The Costs of Shelter", excerpt: "Speech At a summit in Chicago" }))).toBe(
      "Federal Reserve official Barr spoke on “The Costs of Shelter” at a summit in Chicago.",
    );
  });
});

describe("market context", () => {
  it("labels regimes", () => {
    expect(vixRegime(12)).toBe("calm");
    expect(vixRegime(18)).toBe("normal");
    expect(vixRegime(27)).toBe("elevated");
    expect(hyRegime(2.7)).toBe("calm");
    expect(hyRegime(5.2)).toBe("elevated");
    expect(market.tone).toBe("risk-on");
    expect(new MarketView([series("VIXCLS", 35, 30, "index"), series("BAMLH0A0HYM2", 6.5, 6)]).tone).toBe("risk-off");
  });

  it("describes moves in bps for rates and % for indices", () => {
    expect(describeMove(series("DGS10", 4.96, 5.01))).toBe("down 5 bps");
    expect(describeMove(series("DGS10", 4.0, 4.0))).toBe("unchanged");
    expect(describeMove(series("SP500", 101, 100, "index"))).toBe("up 1.0%");
  });

  it("grounds every item's context in the real numbers with a date", () => {
    const item = enrichItem(raw({ title: "Apollo private credit fund sees redemption requests fall", firms: ["Apollo"] }), market, now);
    expect(item.marketContext).toContain("3.88%");
    expect(item.marketContext).toContain("2.68%");
    expect(item.marketContext).toContain("as of Sep 22");
    expect(item.whyItMatters).toMatch(/^Apollo is/);
    expect(item.beginnerNote?.term).toBe("Private credit");
  });

  it("degrades gracefully without market data", () => {
    const item = enrichItem(raw({ title: "KKR buys a company" }), new MarketView([]), now);
    expect(item.marketContext).toMatch(/unavailable/);
    expect(buildMarketRead(new MarketView([]))).toMatch(/unavailable/);
  });
});

describe("glossary", () => {
  it("prefers specific terms over broad ones and falls back to the theme default", () => {
    expect(findTerm("Valuations rise as the fund held a final close")?.term).toBe("Fund close");
    expect(findTerm("Nothing relevant", "Dry powder")?.term).toBe("Dry powder");
  });
});

describe("selection and brief", () => {
  it("builds a diverse edition with three top stories and a brief", () => {
    const pool: RawItem[] = [
      ...Array.from({ length: 6 }, (_, i) => raw({ title: `Blackstone acquires company number ${i} in take-private`, firms: ["Blackstone"], tier: 1 })),
      ...Array.from({ length: 6 }, (_, i) => raw({ title: `Private credit lender ${i} launches direct lending fund`, section: "private-markets", source: { ...news, id: `s${i}` } })),
      ...Array.from({ length: 6 }, (_, i) => raw({ title: `Hedge fund ${i} posts gains in macro strategy`, section: "hedge-funds", source: { ...news, id: `h${i}` } })),
      raw({ title: "3 questions to ask your parents about their estate plan", section: "markets" }),
    ];
    const sel = selectAndEnrich(pool, market, now);
    expect(sel.items.length).toBeGreaterThanOrEqual(12);
    expect(sel.items.some((i) => i.title.startsWith("3 questions"))).toBe(false);
    expect(sel.topStoryIds).toHaveLength(3);
    expect(new Set(sel.topStoryIds.map((id) => sel.items.find((i) => i.id === id)!.section)).size).toBe(3);
    const brief = buildBrief(sel, market);
    expect(brief.bullets.length).toBe(5);
    expect(brief.marketRead).toMatch(/Bottom line/);
    expect(brief.themes[0].count).toBeGreaterThan(0);
  });
});

describe("story-level dedupe", () => {
  it("merges the same story from two outlets but keeps unrelated stories", () => {
    const a = raw({ title: "KKR Committed $350 Million to Launch Akrapoint Commercial Capital", firms: ["KKR"], tier: 3, excerpt: "KKR will commit $350 million." });
    const b = raw({ title: "KKR launches $350m equipment finance platform", firms: ["KKR"], tier: 2, excerpt: "KKR has launched Akrapoint, backed by $350m." });
    const c = raw({ title: "KKR closes record infrastructure fund", firms: ["KKR"], excerpt: "The fund drew strong demand." });
    const out = dedupeStories([a, b, c]);
    expect(out).toContain(b);
    expect(out).not.toContain(a);
    expect(out).toContain(c);
  });
});

describe("archive", () => {
  const index: ArchiveIndex = {
    updatedAt: "",
    editions: [
      { date: "2026-09-22", edition: 41, headline: "Yesterday", items: 20 },
      { date: "2026-06-01", edition: 1, headline: "Old", items: 18 },
    ],
  };

  it("numbers editions and reuses the number on same-day reruns", () => {
    expect(editionFor(index, "2026-09-23")).toBe(42);
    expect(editionFor(index, "2026-09-22")).toBe(41);
    expect(editionFor(null, "2026-09-23")).toBe(1);
  });

  it("adds today, sorts newest first and prunes editions older than 90 days", () => {
    const { index: next, removed } = updateArchiveIndex(index, { date: "2026-09-23", edition: 42, headline: "Today", items: 24 }, now);
    expect(next.editions.map((e) => e.date)).toEqual(["2026-09-23", "2026-09-22"]);
    expect(removed).toEqual(["2026-06-01"]);
  });
});
