import { describe, expect, it } from "vitest";
import { editionFor, updateArchiveIndex } from "../archive";
import { dedupeStories } from "../dedupe";
import { buildBrief, buildMarketRead, enrichItem, selectAndEnrich } from "../enrich";
import { findTerm, GLOSSARY } from "../enrich/glossary";
import { describeMove, hyRegime, MarketView, vixRegime } from "../enrich/market";
import { cleanExcerpt, extractTakeaway, splitSentences, takeawayFor, trimToClause } from "../enrich/takeaway";
import { storyTypeOf } from "../enrich/storyType";
import { actorFor, amountIn, eventOf, isCompanyDeal, marketOf, propertyTypeOf, speakerIn, whyItMatters } from "../enrich/whyItMatters";
import { classify, resolveSection, THEMES } from "../enrich/themes";
import { guessSection } from "../normalize";
import { propertyDealSize } from "../score";
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
    expect(item.whyItMatters).toMatch(/^Fewer withdrawal requests .* private credit/);
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
  it("merges the same story when only the figure and the names in the summary match", () => {
    const a = raw({ title: "J.P. Morgan Team Departs to Create $18.6B Independent Firm", excerpt: "Phil Scott and Jim Atwood are forming Latigo Peak Partners." });
    const b = raw({ title: "Ex-J.P. Morgan Duo Launches $18.6B AUM RIA In Palm Beach", excerpt: "Phil Scott and Jim Atwood created Latigo Peak, with hubs in Boston." });
    const c = raw({ title: "Another firm crosses $18.6B in assets", excerpt: "Unrelated Partners reported growth." });
    expect(dedupeStories([a, b, c])).toHaveLength(2);
  });

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
    expect(t).toEqual({ text: "Flows into semi-liquid private credit funds hit a record in September.", fromExcerpt: true, strong: false });
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

describe("current-user improvements", () => {
  it("drops rankings, roundups and how-to columns but keeps real deal news", async () => {
    const { LOW_VALUE } = await import("../normalize");
    expect(LOW_VALUE.test("11 of the Best Financial Advisor Companies: Well-Known Fiduciary Investment Firms to Consider")).toBe(true);
    expect(LOW_VALUE.test("Energy & Utilities Roundup: Market Talk")).toBe(true);
    expect(LOW_VALUE.test("How to Invest for the Middle Class Blues")).toBe(true);
    expect(LOW_VALUE.test("GTCR, Elliott Acquire Software Firm CCC for $4.6 Billion")).toBe(false);
  });

  it("gives subscriber headlines the section their story belongs to", async () => {
    const { buildSubscriberFeed } = await import("../subscriptions");
    const { SUBSCRIPTION_SOURCES } = await import("../sources");
    const wsj = SUBSCRIPTION_SOURCES.find((s) => s.subscription === "wsj")!;
    const at = new Date(now.getTime() - 3_600_000).toISOString();
    const feed = buildSubscriberFeed(
      [
        {
          source: wsj,
          items: [
            raw({ title: "Penske Automotive Group to Be Taken Private by Penske, Mitsui", publishedAt: at, section: "markets" }),
            raw({ title: "Fed holds interest rates steady as inflation cools", publishedAt: at, section: "markets" }),
          ],
        },
      ],
      now,
    );
    const items = feed.publishers.find((p) => p.id === "wsj")!.items;
    expect(items.find((i) => i.title.startsWith("Penske"))!.section).toBe("private-equity");
    expect(items.find((i) => i.title.startsWith("Fed"))!.section).toBe("markets");
  });

  it("builds the Archive search index newest first, listing each story once", async () => {
    const { buildSearchIndex } = await import("../archive");
    const story = (id: string, title: string) => ({ ...enrichItem(raw({ id, title }), market, now) });
    const older = { date: "2026-10-13", items: [story("a", "KKR closes fund"), story("b", "Apollo buys lender")] };
    const newer = { date: "2026-10-14", items: [story("a", "KKR closes fund"), story("c", "Carlyle exits stake")] };
    const idx = buildSearchIndex([older, newer] as never, now);
    expect(idx.entries.map((e) => [e.d, e.id])).toEqual([
      ["2026-10-14", "a"],
      ["2026-10-14", "c"],
      ["2026-10-13", "b"],
    ]);
  });
});

describe("so-what takeaways", () => {
  it("picks the sentence with who, what changed and the number, not just the first one", () => {
    const t = takeawayFor(
      raw({
        title: "Kartesia deploys capital from third asset finance fund",
        excerpt:
          "Investors want more exposure to real assets. Kartesia Asset Finance has invested €88m across the first three transactions from its KAF III fund, financing aviation and maritime assets.",
      }),
    );
    expect(t.text).toMatch(/^Kartesia Asset Finance has invested €88m/);
    expect(t.strong).toBe(true);
  });

  it("marks vague takeaways as weak", () => {
    const t = takeawayFor(raw({ title: "SGX FX expands integration", excerpt: "Investors want FX execution to connect more seamlessly with portfolio and risk systems." }));
    expect(t.fromExcerpt).toBe(true);
    expect(t.strong).toBe(false);
  });

  it("does not trim a cut-off sentence into a subject with no verb", () => {
    const t = takeawayFor(
      raw({
        title: "HPS to buy clinic stake",
        excerpt: "HedgeCo.Net — Humana said funds and accounts managed by HPS Investment Partners, part of BlackRock, will acquire Welsh, Carson, Anderson & Stowe's equity ownership in a network of … Continue reading →",
      }),
    );
    expect(t.text).not.toMatch(/part of BlackRock\.$|Welsh, Carson\.$/);
  });

  it("fills the edition with strong takeaways first", () => {
    const strong = Array.from({ length: 4 }, (_, i) =>
      raw({ title: `Ares deal ${i}`, excerpt: `Ares has acquired a $${i + 2}bn portfolio of loans from a regional bank this week.`, source: { ...news, id: `st${i}` } }),
    );
    const weak = Array.from({ length: 4 }, (_, i) =>
      raw({ title: `Musings ${i}`, excerpt: `Investors want more clarity on what comes next for markets this autumn, number ${i}.`, tier: 1, firms: ["KKR"], source: { ...news, id: `wk${i}` } }),
    );
    const picked = selectAndEnrich([...weak, ...strong], market, now, 4).items.map((i) => i.title);
    expect(picked.every((t) => t.startsWith("Ares deal"))).toBe(true);
    expect(selectAndEnrich([...weak, ...strong.slice(0, 2)], market, now, 4).items).toHaveLength(4); // weaker ones fill the gap
  });
});

describe("why it matters: one specific sentence", () => {
  const why = (o: Partial<RawItem>, takeaway = "") => {
    const item = raw(o);
    return whyItMatters(item, classify(item), takeaway || takeawayFor(item).text, Boolean(takeaway) || takeawayFor(item).fromExcerpt);
  };

  it("detects the kind of event from the headline", () => {
    const ev = (title: string) => eventOf(raw({ title }), "");
    expect(ev("Blackstone agrees to acquire software maker in $4bn take-private")).toBe("deal");
    expect(ev("Hg reaches €1bn first close for debut secondaries fund")).toBe("fundraise");
    expect(ev("KKR Agreed to Sell Railcar Lessor to Ares for About $2.9 Billion")).toBe("exit");
    expect(ev("GTCR Leads $200 Million Second Lien Term Loan for Sophos")).toBe("financing");
    expect(ev("U.S. Spot Bitcoin ETFs Shed $261.4 Million as BlackRock Led Redemptions")).toBe("outflows");
    expect(ev("Citizens Sues Ameriprise, Accusing Ex-Advisor of Breaking Employment Contracts")).toBe("legal");
    expect(ev("Macquarie hires credit head from Blackstone")).toBe("people");
    expect(ev("Partners Group Cuts Management Fees Before Fund Overhaul")).toBe("fees");
    expect(ev("Tenstorrent Raised a $1.5 Billion Series E")).toBe("venture");
    expect(ev("Hedge funds dumped tech stocks at fastest pace since 2016")).toBe("market-move");
  });

  it("names the actor and the amount when the story has them", () => {
    expect(why({ title: "Apollo’s £5.7bn easyJet takeover faces union opposition", firms: ["Apollo"] })).toMatch(/^Apollo's £5\.7bn deal now faces pushback/);
    expect(why({ title: "Kartesia Asset Finance deploys €88m across first three KAF III investments", section: "private-markets" })).toMatch(
      /^Kartesia Asset Finance's €88m deal shows private lenders .* asset-based finance/,
    );
    expect(why({ title: "Macquarie hires credit head from Blackstone", firms: ["Blackstone"] })).toMatch(/Macquarie/);
    expect(why({ title: "Macquarie hires credit head from Blackstone", firms: ["Blackstone"] })).not.toMatch(/Blackstone/);
  });

  it("is exactly one sentence, with no firm biography or allocator line", () => {
    const titles = [
      "Blackstone agrees to acquire software maker in $4bn take-private",
      "Ares holds final close on sixth direct lending fund",
      "Fed holds interest rates steady, signals patience on inflation",
      "A conversation with a legendary investor",
      "Something with no clear event at all",
    ];
    for (const title of titles) {
      const w = why({ title, firms: ["Blackstone"] });
      expect(w.split(/(?<=[.!?])\s+(?=[A-Z])/)).toHaveLength(1);
      expect(w).not.toMatch(/For allocators|largest alternative asset manager/);
    }
  });

  it("pulls clean facts from headlines", () => {
    expect(amountIn("BlackRock’s HPS Agreed to Buy Welsh Carson’s Roughly $2.8 Billion Stake")).toBe("$2.8 billion");
    expect(amountIn("Palliser Opposing CVC’s Revised €53-a-Share Offer")).toBeNull();
    expect(amountIn("Osaic Adds $2.3B N.J. Advisor Team")).toBe("$2.3bn");
    expect(speakerIn("SoftBank CEO Masayoshi Son: Superintelligence and AI Investing")).toBe("Masayoshi Son");
    expect(speakerIn("SEC Announces Roundtable on Machine-Understandable Data")).toBeNull();
    expect(actorFor(raw({ title: "Novavax critic Shah Capital ends its activism campaign" }), "", false)).toBe("Shah Capital");
  });

  it("classifies asset finance as private credit, not real estate", () => {
    const item = raw({
      title: "Kartesia Asset Finance deploys €88m across first three KAF III investments",
      excerpt: "Kartesia Asset Finance has invested €88m, financing aviation, maritime and logistics assets in Europe and the US.",
    });
    expect(classify(item).id).toBe("private-credit");
  });
});

describe("Real Estate & Hotels section", () => {
  const route = (o: Partial<RawItem>) => {
    const item = raw(o);
    return resolveSection(item, classify(item));
  };

  it("routes real estate and hotel stories to the new section", () => {
    const hedgeco: SourceRef = { id: "hedgeco", name: "HedgeCo", homepage: "", contentType: "news" };
    expect(route({ title: "Brookfield Agreed to Buy a Portfolio of 12 Luxury Hotels for $2.1 Billion", section: "hedge-funds", source: hedgeco })).toBe("real-estate");
    expect(route({ title: "BREIT repurchase requests fall as property values recover", section: "private-markets" })).toBe("real-estate");
    expect(route({ title: "Sonesta cuts jobs as a $2 billion bid puts many of its best hotels in play", section: "markets" })).toBe("markets"); // general-news feeds keep their section
    // Real estate sources keep everything they publish, even a data-center financing.
    const re: SourceRef = { id: "connect-cre", name: "Connect CRE", homepage: "", contentType: "news" };
    expect(route({ title: "JLL arranges $120M construction loan for Phoenix data center", section: "real-estate", source: re })).toBe("real-estate");
  });

  it("keeps travel feeds to hotel and real estate topics", async () => {
    const { SOURCES } = await import("../sources");
    const skift = SOURCES.find((s) => s.id === "skift")!;
    const topic = skift.kind === "rss" ? skift.topic! : /$^/;
    expect(topic.test("United Airlines Cuts Profit Outlook as Jet Fuel Costs Rise")).toBe(false);
    expect(topic.test("Sonesta Cuts Jobs as a $2 Billion Bid Puts Many of Its Best Hotels in Play")).toBe(true);
  });

  it("ranks the biggest property deals first and sinks small leases and sales", () => {
    expect(propertyDealSize("Daiichi Life Bids $4.4B for Challenger")).toBe(3);
    expect(propertyDealSize("JLL Arranges $120M Construction Loan for Phoenix Data Center")).toBe(1.5);
    expect(propertyDealSize("Marcus & Millichap Brokers $7.5M Sale of Restaurant Building in Katy, Texas")).toBe(-2);
    expect(propertyDealSize("Personal Training Studio LIV Method Takes 12K SF in Meatpacking District")).toBe(-2);
    expect(propertyDealSize("Amazon Signs 400,000 SF Lease in Dallas")).toBe(0);
  });

  it("gives the section 3 to 4 of 27 stories, with at most one filing", () => {
    const reNews: SourceRef = { id: "re-news", name: "RE News", homepage: "", contentType: "news" };
    const reFiling: SourceRef = { id: "edgar-mar", name: "SEC EDGAR — Marriott", homepage: "", contentType: "filing" };
    const others = (["markets", "private-markets", "family-offices", "private-equity", "hedge-funds", "voices", "filings"] as const).flatMap((section, k) =>
      Array.from({ length: 5 }, (_, i) =>
        raw({ title: `Story ${section} ${i} acquires company`, excerpt: `Firm ${k}${i} has acquired a $${i + 2}bn business this week.`, section, source: { ...news, id: `${section}-${i}` } }),
      ),
    );
    const realEstate = [
      ...Array.from({ length: 6 }, (_, i) =>
        raw({ title: `Owner ${i} sells $${i + 2}bn office tower`, excerpt: `Owner ${i} has sold a $${i + 2}bn office tower to a pension fund.`, section: "real-estate", source: { ...reNews, id: `re-${i}` } }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        raw({ title: `Marriott International, Inc. 8-K: Results ${i}`, excerpt: "Marriott filed Form 8-K with the SEC.", section: "real-estate", tier: 1, source: { ...reFiling, id: `edgar-${i}` } }),
      ),
    ];
    const sel = selectAndEnrich([...others, ...realEstate], market, now);
    const inSection = sel.items.filter((i) => i.section === "real-estate");
    expect(sel.items).toHaveLength(27);
    expect(inSection.length).toBeGreaterThanOrEqual(3);
    expect(inSection.length).toBeLessThanOrEqual(4);
    expect(inSection.filter((i) => i.source.contentType === "filing").length).toBeLessThanOrEqual(1);
  });
});

describe("Real Estate & Hotels story cards", () => {
  const reSource: SourceRef = { id: "connect-cre", name: "Connect CRE", homepage: "", contentType: "news" };
  const why = (title: string, excerpt = "") => {
    const item = raw({ title, excerpt, section: "real-estate", source: reSource });
    const t = takeawayFor(item);
    return whyItMatters(item, classify(item), t.text, t.fromExcerpt);
  };
  const oneSentence = (s: string) => expect(s.split(/(?<=[.!?])\s+(?=[A-Z])/)).toHaveLength(1);

  it("explains what each kind of property news means, naming the property type and market", () => {
    const cases: [string, string, RegExp][] = [
      ["Sonesta Cuts Jobs as a $2 Billion Bid Puts Many of Its Best Hotels in Play", "", /^A \$2 billion bid for these hotels shows what buyers will pay for hotels/],
      ["Blackstone’s 2021 $1.3B CMBS Multifamily Loan Hits Special Servicing", "", /^A troubled \$1\.3bn apartment loan shows which owners can't refinance/],
      ["JLL Arranges $50M Bridge Loan for Thousand Oaks Office Campus", "", /^A \$50m loan on this office property shows lenders will still back/],
      ["Hyatt Announces Opening of New Hyatt Centric Hotel in St. Louis, Missouri", "", /grows its fee income without owning the buildings|grow fee income without owning the buildings/],
      ["Wee Hur Adds Third Student Housing Market With 1,398-Bed Singapore Campus Project", "", /^New student housing supply like this in Singapore/],
      ["Tokyo Tatemono Selling $207M in Office Stakes to REIT", "", /^The \$207m deal for this office property in Japan is a fresh price point for office values/],
      ["Trammell Crow Breaks Ground On Office-To-Resi Conversion In Dallas: The DFW Deal Sheet", "", /^Office-to-residential conversions/],
      ["Life Sciences Vacancy Near 27% for Three Biggest U.S. Hubs", "", /^Life science vacancy and rent trends/],
      ["Hotel asset managers anticipate RevPAR growth for full-year 2026: survey", "", /RevPAR trends show whether travel demand is holding up/],
      ["Design Firm Twelve Doubles HQ at Two Trees’ 45 Main Street to 14K SF", "", /^A 14,000-square-foot lease is a vote of confidence/],
      ["Brooklyn Powerhouse Sports Takes 11K-SF Facility Lease in Sunset Park", "", /^An 11,000-square-foot lease/],
    ];
    for (const [title, excerpt, expected] of cases) {
      const w = why(title, excerpt);
      expect(w, title).toMatch(expected);
      oneSentence(w);
      expect(w).not.toMatch(/owners of similar businesses|For allocators|apartments values|offices values/);
    }
  });

  it("treats company takeovers as company deals, not property sales", () => {
    expect(isCompanyDeal("CBRE Acquires Data Center Equipment Provider Onnec Group for $610M")).toBe(true);
    expect(isCompanyDeal("Stephen Ross Buys Second Boca Raton Office Property for $64M")).toBe(false);
    expect(isCompanyDeal("Related Lands $750M Loan To Keep 'Broadway's Bedroom' Affordable: The N.Y. Deal Sheet")).toBe(false);
    expect(why("CBRE Acquires Data Center Equipment Provider Onnec Group for $610M")).toMatch(/^CBRE's \$610m deal/);
  });

  it("names property types and Asia-Pacific markets", () => {
    expect(propertyTypeOf("BlackRock, Dash Living Japan JV Buys Fourth Tokyo Rental Asset", "a 26-unit residential building")).toBe("apartment");
    expect(propertyTypeOf("Hilco Lists Burlington, VT-Area Warehouse for Sale")).toBe("industrial");
    expect(marketOf("Sole $351M Bid for Luxury Condo Site in Singapore’s Marina Bay")).toBe(" in Singapore");
    expect(marketOf("Daiichi Life Bids $4.4B for Australia’s Challenger")).toBe(" in Australia");
    expect(marketOf("Stephen Ross Buys Boca Raton Office")).toBe("");
  });

  it("counts property sizes and unit counts as key numbers in takeaways", () => {
    const t = takeawayFor(
      raw({ title: "Anaheim sale closes", excerpt: "The deal closed this week after months of talks. Marcus & Millichap completed the sale of Empire Apartments, a 29-unit multifamily property in Anaheim." }),
    );
    expect(t.text).toMatch(/29-unit/);
    expect(t.strong).toBe(true);
  });

  it("keeps stories that only mention hotels or housing in passing out of the section", () => {
    const fo: SourceRef = { id: "fa-mag", name: "FA Mag", homepage: "", contentType: "news" };
    const item = raw({ title: "Rising Healthcare Costs Squeeze Low-Income And Wealthy Voters Alike", excerpt: "Healthcare costs outranked food, housing and real estate taxes.", section: "family-offices", source: fo });
    expect(resolveSection(item, classify(item))).not.toBe("real-estate");
  });

  it("does not split sentences at initials or keep a cut-off clause with no verb", () => {
    expect(splitSentences("Williams Equities is run by Michael T. Cohen and partners. It owns towers.")).toHaveLength(2);
    expect(trimToClause("The New York City Housing Authority (NYCHA) and Reid Park Rock PACT Partners, which includes Fairstead, BRP Companies, Urbane, cut the ribbon…")).toBeNull();
  });
});

describe("real estate and hotel firms", () => {
  it("tags each firm and avoids look-alikes", async () => {
    const { tagFirms } = await import("../normalize");
    const cases: [string, string[]][] = [
      ["Hilton and Scandic Sign New Nordics Strategic Agreement", ["Hilton"]],
      ["DoubleTree by Hilton opens in Austin", ["Hilton"]],
      ["Paris Hilton launches a fragrance at a Las Vegas hotel", []],
      ["Hilton Head Island home prices rise", []],
      ["Hyatt opens first Hyatt Centric hotel in Missouri", ["Hyatt"]],
      ["How Marriott Bonvoy got scale", ["Marriott"]],
      ["IHG signs 30 hotels in China", ["IHG"]],
      ["Accor and Ennismore expand lifestyle brands", ["Accor"]],
      ["Accordingly, investors rebalanced", []],
      ["Barry Sternlicht says office is bottoming", ["Starwood Capital"]],
      ["Prologis raises guidance", ["Prologis"]],
      ["Host Hotels & Resorts sells two resorts", ["Host Hotels"]],
      ["Intercontinental Exchange reports volumes", []],
    ];
    for (const [text, firms] of cases) expect(tagFirms(text), text).toEqual(firms);
  });

  it("lists them for readers to follow", async () => {
    const { TRACKED_FIRMS } = await import("../types");
    for (const f of ["Starwood Capital", "Prologis", "Marriott", "Hilton", "Hyatt", "IHG", "Accor", "Host Hotels", "Blackstone", "Brookfield"]) {
      expect(TRACKED_FIRMS).toContain(f);
    }
  });
});
