import { describe, expect, it } from "vitest";
import { dedupe } from "../dedupe";
import { describeItems, filingsToRaw } from "../edgar";
import { feedItemsToRaw } from "../fetchFeeds";
import { parseFredCsv } from "../fred";
import { canonicalUrl, guessSection, INVESTMENT_RELEVANT, isPaywalled, LOW_VALUE, stripHtml, tagFirms, toExcerpt } from "../normalize";
import { verdictFromRobots } from "../robots";
import { isRecent, lookbackHours, shortlist } from "../score";
import type { EdgarSource, RssSource } from "../sources";
import type { RawItem } from "../types";

const rss: RssSource = {
  kind: "rss",
  id: "test-feed",
  name: "Test Feed",
  url: "https://example.com/feed",
  homepage: "https://example.com/",
  contentType: "news",
  section: "markets",
  tier: 2,
  description: "",
};

function raw(overrides: Partial<RawItem>): RawItem {
  return {
    id: "x",
    title: "Untitled",
    url: "https://example.com/a",
    publishedAt: "2026-09-23T12:00:00.000Z",
    excerpt: "An excerpt that is long enough to count as substantive text.",
    source: { id: "test-feed", name: "Test Feed", homepage: "https://example.com/", contentType: "news" },
    tier: 2,
    firms: [],
    section: "markets",
    ...overrides,
  };
}

describe("normalize", () => {
  it("strips HTML and decodes entities", () => {
    expect(stripHtml("<p>KKR &amp; Co.&nbsp;<b>raises</b> fund&#8217;s</p><script>x()</script>")).toBe("KKR & Co. raises fund’s");
  });

  it("truncates excerpts on a word boundary", () => {
    const out = toExcerpt("word ".repeat(200), 50);
    expect(out.length).toBeLessThanOrEqual(51);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/wor…$/);
  });

  it("canonicalizes URLs by dropping tracking params and fragments", () => {
    expect(canonicalUrl("https://Example.com/story/?utm_source=x&id=7#top")).toBe("https://example.com/story/?id=7");
  });

  it("flags paywalled domains, including path-scoped entries", () => {
    expect(isPaywalled("https://www.wsj.com/articles/x")).toBe(true);
    expect(isPaywalled("https://markets.ft.com/data")).toBe(true);
    expect(isPaywalled("https://www.bloomberg.com/news/articles/x")).toBe(true);
    expect(isPaywalled("https://www.bloomberg.com/oddlots")).toBe(false);
    expect(isPaywalled("https://www.microsoft.com/")).toBe(false); // "ft.com" suffix must be a real subdomain
    expect(isPaywalled("not a url")).toBe(true);
  });

  it("tags firms without false positives on common words", () => {
    expect(tagFirms("Blackstone and KKR bid for Carlyle-backed asset")).toEqual(expect.arrayContaining(["Blackstone", "KKR", "Carlyle"]));
    expect(tagFirms("Apollo Global Management launches credit fund")).toContain("Apollo");
    expect(tagFirms("NASA marks Apollo 11 anniversary")).not.toContain("Apollo");
    expect(tagFirms("Bridgewater Associates cuts China exposure")).toContain("Bridgewater");
    expect(tagFirms("Bridgewater, New Jersey town council meets")).not.toContain("Bridgewater");
    expect(tagFirms("Anything", ["Oaktree"])).toContain("Oaktree");
  });

  it("guesses sections from keywords but never overrides voices/filings", () => {
    expect(guessSection("Hedge funds pile into yen shorts", "markets")).toBe("hedge-funds");
    expect(guessSection("Private credit fund closes at $5bn", "markets")).toBe("private-markets");
    expect(guessSection("Take-private deal for software maker", "markets")).toBe("private-equity");
    expect(guessSection("Private equity talk", "voices")).toBe("voices");
  });

  it("filters low-value headlines and keeps investment ones", () => {
    expect(LOW_VALUE.test("3 Stocks to Buy Before October")).toBe(true);
    expect(LOW_VALUE.test("My husband and I are in our 50s. Do we really need an advisor?")).toBe(true);
    expect(LOW_VALUE.test("Prediction: This Dividend Stock Could Soar")).toBe(true);
    expect(LOW_VALUE.test("Apollo private credit fund sees redemptions fall")).toBe(false);
    expect(INVESTMENT_RELEVANT.test("Firm closes second buyout fund")).toBe(true);
    expect(INVESTMENT_RELEVANT.test("TechDigital Labs Introduces Enhanced SEO Audits")).toBe(false);
  });
});

describe("feed parsing", () => {
  it("maps feed items to RawItems, falling back to URL-shaped guids and the feed link", () => {
    const items = feedItemsToRaw(
      rss,
      [
        { title: "KKR raises infra fund", link: "https://example.com/kkr", isoDate: "2026-09-23T10:00:00Z", contentSnippet: "<p>Details</p>" },
        { title: "No link item", guid: "https://example.com/guid-link", pubDate: "Tue, 22 Sep 2026 08:00:00 GMT" },
        { title: "Opaque guid", guid: "abc-123", pubDate: "Tue, 22 Sep 2026 08:00:00 GMT" },
        { title: "Bad date", link: "https://example.com/bad", pubDate: "not a date" },
        { title: { _: "Object title" } as unknown as string, link: "https://example.com/obj", isoDate: "2026-09-23T10:00:00Z" },
      ],
      "https://example.com/show",
    );
    expect(items.map((i) => i.url)).toEqual([
      "https://example.com/kkr",
      "https://example.com/guid-link",
      "https://example.com/show",
      "https://example.com/obj",
    ]);
    expect(items[0].firms).toContain("KKR");
    expect(items[0].excerpt).toBe("Details");
    expect(items[3].title).toBe("Object title");
  });
});

describe("dedupe", () => {
  it("removes same-URL and near-identical headlines, preferring the higher tier", () => {
    const items = [
      raw({ id: "a", title: "Blackstone agrees to buy data center operator for $16 billion", tier: 3, url: "https://a.com/1" }),
      raw({ id: "b", title: "Blackstone agrees to buy data-center operator for $16 billion", tier: 1, url: "https://b.com/1" }),
      raw({ id: "c", title: "Fed holds rates steady", url: "https://c.com/1?utm_source=rss" }),
      raw({ id: "d", title: "Different headline, same link", url: "https://c.com/1" }),
      raw({ id: "e", title: "Unrelated story about hedge funds", url: "https://e.com/1" }),
    ];
    expect(dedupe(items).map((i) => i.id).sort()).toEqual(["b", "c", "e"]);
  });

  it("does not collapse podcast episodes that share the show homepage as their link", () => {
    const home = "https://example.com/";
    const items = [raw({ id: "p1", title: "Episode one on credit", url: home }), raw({ id: "p2", title: "Episode two on venture", url: home })];
    expect(dedupe(items)).toHaveLength(2);
  });
});

describe("EDGAR", () => {
  const source: EdgarSource = {
    kind: "edgar",
    id: "edgar-bx",
    name: "SEC EDGAR — Blackstone",
    company: "Blackstone Inc.",
    cik: 1393818,
    forms: ["8-K", "10-Q"],
    homepage: "https://www.sec.gov/",
    contentType: "filing",
    section: "filings",
    tier: 1,
    firms: ["Blackstone"],
    description: "",
  };

  it("describes 8-K item codes in plain English", () => {
    expect(describeItems("2.02,9.01")).toEqual(["Results of operations (earnings) (Item 2.02)", "Financial statements and exhibits (Item 9.01)"]);
  });

  it("builds filing items with archive URLs and filters forms", () => {
    const items = filingsToRaw(source, {
      accessionNumber: ["0001393818-26-000123", "0001393818-26-000100"],
      filingDate: ["2026-09-22", "2026-09-01"],
      reportDate: ["2026-09-22", ""],
      acceptanceDateTime: ["2026-09-22T16:05:00.000Z", "2026-09-01T12:00:00.000Z"],
      form: ["8-K", "4"],
      items: ["2.02,9.01", ""],
      primaryDocument: ["bx-8k.htm", "form4.xml"],
    });
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe("https://www.sec.gov/Archives/edgar/data/1393818/000139381826000123/bx-8k.htm");
    expect(items[0].title).toBe("Blackstone Inc. 8-K: Results of operations (earnings)");
    expect(items[0].excerpt).toContain("Item 2.02");
    expect(items[0].firms).toEqual(["Blackstone"]);
  });
});

describe("robots.txt", () => {
  const robots = "User-agent: *\nDisallow: /private/\n\nUser-agent: DailyAllocationDigest\nDisallow: /nodigest/\n";

  it("obeys rules for our product token and the wildcard group", () => {
    const allowed = verdictFromRobots("https://x.com/robots.txt", 200, robots);
    expect(allowed("https://x.com/feed.xml")).toBe(true);
    expect(allowed("https://x.com/nodigest/feed.xml")).toBe(false);
  });

  it("treats a missing robots.txt as allow-all and server errors as disallow-all", () => {
    expect(verdictFromRobots("https://x.com/robots.txt", 404, "")("https://x.com/a")).toBe(true);
    expect(verdictFromRobots("https://x.com/robots.txt", 503, "")("https://x.com/a")).toBe(false);
    expect(verdictFromRobots("https://x.com/robots.txt", null, "")("https://x.com/a")).toBe(false);
  });
});

describe("FRED", () => {
  it("parses CSV and skips missing observations", () => {
    const csv = "observation_date,DGS10\n2026-09-18,4.10\n2026-09-19,.\n2026-09-22,4.05\n";
    expect(parseFredCsv(csv)).toEqual([
      { date: "2026-09-18", value: 4.1 },
      { date: "2026-09-22", value: 4.05 },
    ]);
  });
});

describe("recency and shortlist", () => {
  const now = new Date("2026-09-23T15:00:00Z"); // a Wednesday

  it("widens the lookback on Mondays", () => {
    expect(lookbackHours(now)).toBe(36);
    expect(lookbackHours(new Date("2026-09-21T15:00:00Z"))).toBe(76);
  });

  it("gives podcasts a longer window than news", () => {
    const old = "2026-09-21T15:00:00Z"; // 48h before `now`
    expect(isRecent(raw({ publishedAt: old }), now, 36)).toBe(false);
    expect(isRecent(raw({ publishedAt: old, source: { ...raw({}).source, contentType: "podcast" } }), now, 36)).toBe(true);
  });

  it("caps items per source and keeps section diversity", () => {
    const flood = Array.from({ length: 20 }, (_, i) => raw({ id: `m${i}`, title: `Market story ${i}`, url: `https://m.com/${i}` }));
    const pe = raw({ id: "pe", title: "Buyout", section: "private-equity", tier: 3, source: { ...raw({}).source, id: "pe-feed" } });
    const out = shortlist([...flood, pe], now, { total: 10, perSection: 3, perSource: 5 });
    expect(out.filter((i) => i.source.id === "test-feed")).toHaveLength(5);
    expect(out.map((i) => i.id)).toContain("pe");
  });
});
