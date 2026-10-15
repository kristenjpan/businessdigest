import { describe, expect, it } from "vitest";
import { editionFor, updateArchiveIndex } from "../archive";
import { dedupeStories } from "../dedupe";
import { buildBrief, buildMarketRead, enrichItem, selectAndEnrich } from "../enrich";
import { findTerm, GLOSSARY } from "../enrich/glossary";
import { describeMove, hyRegime, MarketView, vixRegime } from "../enrich/market";
import { cleanExcerpt, extractTakeaway, splitSentences, takeawayFor, trimToClause } from "../enrich/takeaway";
import { storyTypeOf } from "../enrich/storyType";
import { classify, resolveSection, THEMES } from "../enrich/themes";
import { guessSection } from "../normalize";
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

  it("returns exactly one sentence even when the first is short", () => {
    const t = extractTakeaway(raw({ excerpt: "Apollo raised a new $5bn credit fund on Monday. It drew strong demand from insurers and pensions worldwide." }));
    expect(t).toBe("Apollo raised a new $5bn credit fund on Monday.");
  });

  it("repairs a sentence the feed cut off instead of showing an ellipsis", () => {
    const t = extractTakeaway(
      raw({ excerpt: "Golden Gate Capital faces a lawsuit alleging it contributed to a $2.2bn capital shortfall, according to a report by the Wall…" }),
    );
    expect(t).toBe("Golden Gate Capital faces a lawsuit alleging it contributed to a $2.2bn capital shortfall.");
    expect(trimToClause("Too short, cut…")).toBeNull();
    expect(trimToClause("The SEC charged overseas entities with defrauding retail investors, including many in the U.S., through scams where…")).toBe(
      "The SEC charged overseas entities with defrauding retail investors, including many in the U.S.",
    );
  });

  it("skips podcast filler and never adds a 'New episode' prefix", () => {
    const pod: SourceRef = { id: "pod", name: "Invest Like the Best", homepage: "", contentType: "podcast" };
    const t = extractTakeaway(raw({ source: pod, excerpt: "My guest today is Noah Shinn. Noah is the founder of Instinct, a personal assistant you text like a person." }));
    expect(t).toBe("Noah is the founder of Instinct, a personal assistant you text like a person.");
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

describe("story type", () => {
  const src = (id: string, contentType: SourceRef["contentType"]): SourceRef => ({ id, name: id, homepage: "", contentType });

  it("labels filings, letters, podcasts, direct quotes and news", () => {
    expect(storyTypeOf(raw({ source: src("edgar-bx", "filing"), title: "Blackstone Inc. files Form 10-Q" }))).toBe("filing");
    expect(storyTypeOf(raw({ source: src("oaktree-memo", "podcast"), title: "Shall We Repeal the Laws of Economics" }))).toBe("letter");
    expect(storyTypeOf(raw({ title: "Pershing Square publishes annual letter to shareholders" }))).toBe("letter");
    expect(storyTypeOf(raw({ source: src("capital-allocators", "podcast"), title: "Nancy Zimmerman on fixed income arbitrage" }))).toBe("podcast");
    expect(storyTypeOf(raw({ source: src("fed-speeches", "regulator"), title: "Cook, An Update on AI and the Economy" }))).toBe("quote");
    expect(storyTypeOf(raw({ title: "Dimon warns private credit is heading for trouble" }))).toBe("quote");
    expect(storyTypeOf(raw({ title: "‘There is no need for urgency,’ Williams tells investors" }))).toBe("quote");
    expect(storyTypeOf(raw({ title: "AAR to acquire 65% of Bain-backed MRO Holdings in $1.8bn deal" }))).toBe("news");
    expect(storyTypeOf(raw({ source: src("sec-press", "regulator"), title: "SEC Charges Adviser for Undisclosed Conflicts" }))).toBe("news");
  });
});

describe("Private Markets vs Family Offices & Wealth", () => {
  it("routes wealth and family-office stories to their own section", () => {
    expect(guessSection("Northwestern Mutual launches family office services", "markets")).toBe("family-offices");
    expect(guessSection("Captrust buys two RIAs with $1.2B AUM", "markets")).toBe("family-offices");
    expect(guessSection("Ares closes direct lending fund", "markets")).toBe("private-markets");
    expect(guessSection("Sovereign wealth fund boosts private credit allocation", "markets")).toBe("private-markets");
  });

  it("keeps wealth stories in place but moves general market news out of wealth feeds", () => {
    const wealth = raw({ title: "Captrust Adds $1.2B in Double Deal for Long Island Firms", section: "family-offices" });
    expect(resolveSection(wealth, classify(wealth))).toBe("family-offices");
    const macro = raw({ title: "Goldman Says High-Yield Debt Deluge Overwhelming Investors", excerpt: "Higher bond yields have made corporate bonds attractive.", section: "family-offices" });
    expect(resolveSection(macro, classify(macro))).not.toBe("family-offices");
  });
});

describe("browser-safe firm list", () => {
  it("TRACKED_FIRMS lists exactly the firms the pipeline tags", async () => {
    const { FIRM_PATTERNS } = await import("../normalize");
    const { TRACKED_FIRMS } = await import("../types");
    expect([...TRACKED_FIRMS].sort()).toEqual(Object.keys(FIRM_PATTERNS).sort());
  });
});

describe("subscriber headlines", () => {
  it("keeps only the publisher's first complete sentence as the teaser", async () => {
    const { teaserOf } = await import("../subscriptions");
    expect(teaserOf("U.S. stocks slid as rising inflation bolstered the case for a rate increase. More inside.")).toBe(
      "U.S. stocks slid as rising inflation bolstered the case for a rate increase.",
    );
    expect(teaserOf("A sentence the feed cut off before it could finish…")).toBe("");
    expect(teaserOf("")).toBe("");
  });

  it("groups by publisher, keeps recent relevant headlines, and never mixes into the free edition", async () => {
    const { buildSubscriberFeed } = await import("../subscriptions");
    const { SUBSCRIPTION_SOURCES, SOURCES } = await import("../sources");
    const ft = SUBSCRIPTION_SOURCES.find((s) => s.subscription === "ft")!;
    const econ = SUBSCRIPTION_SOURCES.find((s) => s.subscription === "economist")!;
    const at = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
    const feed = buildSubscriberFeed(
      [
        { source: ft, items: [raw({ title: "Fresh FT deal story", publishedAt: at(2) }), raw({ title: "Old FT story from last week", publishedAt: at(100) })] },
        { source: econ, items: [raw({ title: "Economist weekly piece on private credit", publishedAt: at(100) })] },
      ],
      now,
    );
    expect(feed.publishers.find((p) => p.id === "ft")!.items.map((i) => i.title)).toEqual(["Fresh FT deal story"]);
    expect(feed.publishers.find((p) => p.id === "economist")!.items).toHaveLength(1); // 7-day window
    expect(feed.publishers.find((p) => p.id === "wsj")!.items).toHaveLength(0);
    expect(SOURCES.some((s) => s.kind === "rss" && s.subscription)).toBe(false);
  });
});

describe("takeaway quality", () => {
  it("skips pull quotes and uses the next factual sentence", () => {
    const t = takeawayFor(
      raw({
        title: "Retirees pile into private credit funds",
        excerpt: "“I presume these are sophisticated investors taking a profit.” Flows into semi-liquid private credit funds hit a record in September.",
      }),
    );
    expect(t).toEqual({ text: "Flows into semi-liquid private credit funds hit a record in September.", fromExcerpt: true });
  });

  it("flags stories whose feed offers nothing beyond quotes or the headline", () => {
    expect(takeawayFor(raw({ title: "Will mortgage rates stay above 7%?", excerpt: "“I’m in my 60s, recently retired and living my best life.”" })).fromExcerpt).toBe(false);
    expect(takeawayFor(raw({ title: "KKR adds solar portfolio", excerpt: "" })).fromExcerpt).toBe(false);
  });

  it("leaves headline-only stories out when there are enough stories with real summaries", () => {
    const rich = Array.from({ length: 5 }, (_, i) =>
      raw({ title: `Apollo closes credit fund number ${i}`, excerpt: `Apollo closed credit fund number ${i} with strong demand from insurers and pensions.`, source: { ...news, id: `r${i}` } }),
    );
    const thin = raw({ title: "MarketWatch headline with no summary", excerpt: "", source: { ...news, id: "thin" } });
    expect(selectAndEnrich([...rich, thin], market, now, 4).items.map((i) => i.title)).not.toContain(thin.title);
    expect(selectAndEnrich([rich[0], thin], market, now, 4).items.map((i) => i.title)).toContain(thin.title);
  });
});

describe("Market Read", () => {
  it("leads with the bottom line, then the numbers", () => {
    const read = buildMarketRead(market);
    expect(read.startsWith("Bottom line:")).toBe(true);
    expect(read).toContain("7,764.64");
  });
});
