import { afterEach, describe, expect, it, vi } from "vitest";
import { editionFor, updateArchiveIndex } from "../archive";
import { dedupeStories } from "../dedupe";
import { applyAI, buildBrief, buildMarketRead, enrichItem, selectAndEnrich } from "../enrich";
import { validTakeaway, writeWithAI } from "../enrich/ai";
import { findTerm, GLOSSARY } from "../enrich/glossary";
import { describeMove, hyRegime, MarketView, vixRegime } from "../enrich/market";
import { cleanExcerpt, extractTakeaway, splitSentences, trimToClause } from "../enrich/takeaway";
import { storyTypeOf } from "../enrich/storyType";
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

describe("AI writer (GitHub Models)", () => {
  const item = raw({
    id: "a1",
    title: "Millennium's new cash raise draws USD30 billion in client demand",
    excerpt: "Millennium Management's capital raise attracted more than USD30bn of commitments, above the USD20bn it initially sought.",
  });

  it("validates takeaways: one grounded, complete sentence that adds to the headline", () => {
    expect(validTakeaway("Millennium drew more than $30bn of commitments, well above the $20bn it set out to raise.", item)).toBe(true);
    expect(validTakeaway("Millennium drew $35bn of commitments against a $20bn target.", item)).toBe(false); // 35 not in source
    expect(validTakeaway("Millennium drew strong demand. Investors piled in.", item)).toBe(false); // two sentences
    expect(validTakeaway("Millennium drew more than $30bn of commitments, well above…", item)).toBe(false); // cut off
    expect(validTakeaway("Millennium's new cash raise draws USD30 billion in client demand.", item)).toBe(false); // headline copy
    expect(validTakeaway(42, item)).toBe(false);
  });

  afterEach(() => vi.unstubAllEnvs());

  function reply(content: unknown, status = 200) {
    return vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), { status }));
  }

  it("keeps only validated answers and skips failed batches", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test");
    const good = reply({ items: [{ ref: 1, takeaway: "Millennium drew more than $30bn of commitments, well above its $20bn goal." }] });
    expect((await writeWithAI([item], good)).get("a1")?.takeaway).toMatch(/^Millennium drew/);

    const invented = reply({ items: [{ ref: 1, takeaway: "Millennium drew $99bn of commitments from new clients worldwide." }] });
    expect((await writeWithAI([item], invented)).size).toBe(0);

    const broken = vi.fn(async () => new Response("not json", { status: 200 }));
    expect((await writeWithAI([item], broken)).size).toBe(0);

    const down = vi.fn(async () => new Response("", { status: 500 }));
    expect((await writeWithAI([item], down)).size).toBe(0);
  });

  it("overlays AI takeaways and leaves the rest on rules", async () => {
    const sel = selectAndEnrich(
      [
        raw({ title: "Blackstone acquires software maker in take-private", firms: ["Blackstone"] }),
        raw({ title: "Hedge fund posts gains in macro strategy", section: "hedge-funds", source: { ...news, id: "h" } }),
      ],
      market,
      now,
    );
    const [first, second] = sel.items;
    const before = second.takeaway;
    const n = await applyAI(sel, async () => new Map([[first.id, { takeaway: "Blackstone agreed to buy a software maker and take it private." }]]));
    expect(n).toBe(1);
    expect(first.takeaway).toBe("Blackstone agreed to buy a software maker and take it private.");
    expect(first.aiSummarized).toBe(true);
    expect(second.takeaway).toBe(before);
    expect(second.aiSummarized).toBe(false);
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
