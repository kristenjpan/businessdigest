import type { ContentType, SectionId } from "./types";

interface BaseSource {
  id: string;
  name: string;
  homepage: string;
  contentType: ContentType;
  section: SectionId; // default section for items from this source
  tier: 1 | 2 | 3; // 1 = official/primary, 2 = major outlet, 3 = trade/other
  firms?: string[]; // firms every item from this source is about
  description: string;
}

export interface RssSource extends BaseSource {
  kind: "rss";
  url: string;
  /** Items whose URL matches are dropped (e.g. subscriber-only sections). */
  excludeUrl?: RegExp;
  /** High-volume wires: keep only items that name a tracked firm or match investment keywords. */
  requireRelevance?: boolean;
}

export interface EdgarSource extends BaseSource {
  kind: "edgar";
  cik: number;
  company: string;
  forms: string[];
}

export type Source = RssSource | EdgarSource;

/**
 * Every source here is a public feed or API meant for automated access, and
 * `npm run check-feeds` confirms each one against robots.txt. The pipeline reads only
 * title/excerpt/link/date — it never fetches article pages.
 */
export const SOURCES: Source[] = [
  // ── Official firm channels ───────────────────────────────────────────────
  {
    kind: "rss",
    id: "apollo-ir",
    name: "Apollo — Press Releases",
    url: "https://ir.apollo.com/news-events/press-releases/rss",
    homepage: "https://ir.apollo.com/news-events/press-releases",
    contentType: "press-release",
    section: "private-markets",
    tier: 1,
    firms: ["Apollo"],
    description: "Apollo Global Management's official press-release feed.",
  },
  {
    kind: "rss",
    id: "inside-blackstone",
    name: "Inside Blackstone (podcast)",
    url: "https://feed.podbean.com/insideblackstone/feed.xml",
    homepage: "https://www.blackstone.com/insights/",
    contentType: "podcast",
    section: "voices",
    tier: 1,
    firms: ["Blackstone"],
    description: "Blackstone's official podcast featuring its leaders and investors.",
  },
  {
    kind: "rss",
    id: "apollo-podcast",
    name: "Apollo Global Management (podcast)",
    url: "https://feed.podbean.com/apolloglobalmanagement/feed.xml",
    homepage: "https://www.apollo.com/insights-news",
    contentType: "podcast",
    section: "voices",
    tier: 1,
    firms: ["Apollo"],
    description: "Apollo's official podcast on markets, credit and private capital.",
  },
  {
    kind: "rss",
    id: "carlyle-insights",
    name: "Carlyle — Insights & Indicators (podcast)",
    url: "https://feeds.castos.com/w62dm",
    homepage: "https://www.carlyle.com/global-insights",
    contentType: "podcast",
    section: "voices",
    tier: 1,
    firms: ["Carlyle"],
    description: "Carlyle's official podcast on the global economy and private markets.",
  },
  {
    kind: "rss",
    id: "oaktree-memo",
    name: "The Memo by Howard Marks (Oaktree)",
    url: "https://rss.art19.com/the-memo-by-howard-marks",
    homepage: "https://www.oaktreecapital.com/insights/memos",
    contentType: "podcast",
    section: "voices",
    tier: 1,
    firms: ["Oaktree"],
    description: "Audio editions of Howard Marks' client memos, published by Oaktree.",
  },
  {
    kind: "rss",
    id: "oaktree-insight",
    name: "The Insight (Oaktree)",
    url: "https://rss.art19.com/the-insight",
    homepage: "https://www.oaktreecapital.com/insights",
    contentType: "podcast",
    section: "voices",
    tier: 1,
    firms: ["Oaktree"],
    description: "Oaktree's podcast on credit and alternative investing.",
  },

  // ── Voices & interviews (public podcast feeds) ───────────────────────────
  {
    kind: "rss",
    id: "capital-allocators",
    name: "Capital Allocators with Ted Seides",
    url: "https://rss.libsyn.com/shows/94820/destinations/482814.xml",
    homepage: "https://www.capitalallocators.com/",
    contentType: "podcast",
    section: "voices",
    tier: 2,
    description: "Interviews with endowment, foundation, family-office and fund leaders.",
  },
  {
    kind: "rss",
    id: "invest-like-the-best",
    name: "Invest Like the Best",
    url: "https://feeds.megaphone.fm/CLS2859450455",
    homepage: "https://www.joincolossus.com/",
    contentType: "podcast",
    section: "voices",
    tier: 2,
    description: "Patrick O'Shaughnessy's interviews with investors and operators.",
  },
  {
    kind: "rss",
    id: "gs-exchanges",
    name: "Goldman Sachs Exchanges",
    url: "https://feeds.megaphone.fm/GLD9218176758",
    homepage: "https://www.goldmansachs.com/insights/podcasts/",
    contentType: "podcast",
    section: "voices",
    tier: 1,
    firms: ["Goldman Sachs"],
    description: "Goldman Sachs' podcast on markets and the economy.",
  },
  {
    kind: "rss",
    id: "eye-on-the-market",
    name: "Eye on the Market (J.P. Morgan)",
    url: "https://feed.podbean.com/eyeonthemarket/feed.xml",
    homepage: "https://privatebank.jpmorgan.com/nam/en/insights/markets-and-investing/eotm",
    contentType: "podcast",
    section: "voices",
    tier: 1,
    firms: ["J.P. Morgan"],
    description: "Michael Cembalest's market commentary for J.P. Morgan clients.",
  },
  {
    kind: "rss",
    id: "odd-lots",
    name: "Odd Lots (Bloomberg podcast)",
    url: "https://www.omnycontent.com/d/playlist/e73c998e-6e60-432f-8610-ae210140c5b1/8a94442e-5a74-4fa2-8b8d-ae27003a8d6b/982f5071-765c-403d-969d-ae27003a8d83/podcast.rss",
    homepage: "https://www.bloomberg.com/oddlots",
    contentType: "podcast",
    section: "voices",
    tier: 2,
    description: "Bloomberg's free podcast on markets, finance and economics.",
  },
  {
    kind: "rss",
    id: "masters-in-business",
    name: "Masters in Business (Bloomberg podcast)",
    url: "https://www.omnycontent.com/d/playlist/e73c998e-6e60-432f-8610-ae210140c5b1/4e4cd910-40a1-4619-a5f3-ae2b0012ffff/5873a3cb-298f-40bc-b71f-ae2b0013000d/podcast.rss",
    homepage: "https://www.bloomberg.com/podcasts/series/masters-in-business",
    contentType: "podcast",
    section: "voices",
    tier: 2,
    description: "Barry Ritholtz's long-form interviews with leading investors.",
  },
  {
    kind: "rss",
    id: "our-family-office",
    name: "The Our Family Office Podcast",
    url: "https://feeds.transistor.fm/the-our-family-office-podcast",
    homepage: "https://ourfamilyoffice.com/",
    contentType: "podcast",
    section: "private-markets",
    tier: 3,
    description: "Conversations on family-office governance, investing and operations.",
  },

  // ── Regulators & macro ───────────────────────────────────────────────────
  {
    kind: "rss",
    id: "fed-press",
    name: "Federal Reserve — Press Releases",
    url: "https://www.federalreserve.gov/feeds/press_all.xml",
    homepage: "https://www.federalreserve.gov/newsevents/pressreleases.htm",
    contentType: "regulator",
    section: "markets",
    tier: 1,
    description: "Official Federal Reserve Board press releases.",
  },
  {
    kind: "rss",
    id: "fed-speeches",
    name: "Federal Reserve — Speeches",
    url: "https://www.federalreserve.gov/feeds/speeches.xml",
    homepage: "https://www.federalreserve.gov/newsevents/speeches.htm",
    contentType: "regulator",
    section: "markets",
    tier: 1,
    description: "Speeches by Federal Reserve Board members.",
  },
  {
    kind: "rss",
    id: "sec-press",
    name: "SEC — Press Releases",
    url: "https://www.sec.gov/news/pressreleases.rss",
    homepage: "https://www.sec.gov/newsroom/press-releases",
    contentType: "regulator",
    section: "markets",
    tier: 1,
    description: "Official U.S. Securities and Exchange Commission press releases.",
  },

  // ── News (free, public RSS only) ─────────────────────────────────────────
  {
    kind: "rss",
    id: "marketwatch-top",
    name: "MarketWatch — Top Stories",
    url: "https://feeds.content.dowjones.io/public/rss/mw_topstories",
    homepage: "https://www.marketwatch.com/",
    contentType: "news",
    section: "markets",
    tier: 2,
    description: "MarketWatch's public top-stories feed.",
  },
  {
    kind: "rss",
    id: "marketwatch-bulletins",
    name: "MarketWatch — Bulletins",
    url: "https://feeds.content.dowjones.io/public/rss/mw_bulletins",
    homepage: "https://www.marketwatch.com/",
    contentType: "news",
    section: "markets",
    tier: 2,
    description: "MarketWatch's public breaking-news bulletins.",
  },
  {
    kind: "rss",
    id: "hedgeco",
    name: "HedgeCo Networks",
    url: "https://www.hedgeco.net/news/feed",
    homepage: "https://www.hedgeco.net/news/",
    contentType: "news",
    section: "hedge-funds",
    tier: 3,
    description: "Free trade news on hedge funds and alternative investments.",
  },
  {
    kind: "rss",
    id: "opalesque",
    name: "Opalesque",
    url: "https://www.opalesque.com/rss.xml",
    homepage: "https://www.opalesque.com/",
    contentType: "news",
    section: "hedge-funds",
    tier: 3,
    description: "Alternative-investment news briefs covering hedge funds and family offices.",
  },
  {
    kind: "rss",
    id: "alt-credit-investor",
    name: "Alternative Credit Investor",
    url: "https://alternativecreditinvestor.com/feed/",
    homepage: "https://alternativecreditinvestor.com/",
    contentType: "news",
    section: "private-markets",
    tier: 3,
    description: "Free trade news on private credit and direct lending.",
  },
  {
    kind: "rss",
    id: "markets-media",
    name: "Markets Media",
    url: "https://www.marketsmedia.com/feed/",
    homepage: "https://www.marketsmedia.com/",
    contentType: "news",
    section: "markets",
    tier: 3,
    description: "Institutional markets and asset-management industry news.",
  },
  {
    kind: "rss",
    id: "yahoo-finance",
    name: "Yahoo Finance",
    url: "https://finance.yahoo.com/news/rssindex",
    homepage: "https://finance.yahoo.com/",
    contentType: "news",
    section: "markets",
    tier: 2,
    description: "Yahoo Finance's public news index feed.",
  },
  {
    kind: "rss",
    id: "pe-wire",
    name: "Private Equity Wire",
    url: "https://www.privateequitywire.co.uk/feed",
    homepage: "https://www.privateequitywire.co.uk/",
    contentType: "news",
    section: "private-equity",
    tier: 3,
    description: "Free trade news on private equity funds, deals and fundraising.",
  },
  {
    kind: "rss",
    id: "aic",
    name: "American Investment Council",
    url: "https://www.investmentcouncil.org/feed/",
    homepage: "https://www.investmentcouncil.org/",
    contentType: "research",
    section: "private-equity",
    tier: 3,
    description: "The private-equity industry association's research and policy updates.",
  },
  {
    kind: "rss",
    id: "wealthmanagement",
    name: "WealthManagement.com",
    url: "https://www.wealthmanagement.com/rss.xml",
    homepage: "https://www.wealthmanagement.com/",
    contentType: "news",
    section: "family-offices",
    tier: 3,
    description: "Trade news for wealth managers, RIAs and family offices.",
  },
  {
    kind: "rss",
    id: "fa-mag",
    name: "Financial Advisor Magazine",
    url: "https://www.fa-mag.com/rss",
    homepage: "https://www.fa-mag.com/",
    contentType: "news",
    section: "family-offices",
    tier: 3,
    description: "Trade news on wealth management, alternatives and family offices.",
  },
  {
    kind: "rss",
    id: "prn-financial",
    name: "PR Newswire — Financial Services",
    url: "https://www.prnewswire.com/rss/financial-services-latest-news/financial-services-latest-news-list.rss",
    homepage: "https://www.prnewswire.com/news-releases/financial-services-latest-news/",
    contentType: "press-release",
    section: "private-markets",
    tier: 3,
    requireRelevance: true,
    description: "Company-issued financial-services press releases.",
  },
  {
    kind: "rss",
    id: "gnw-financials",
    name: "GlobeNewswire — Financials",
    url: "https://www.globenewswire.com/RssFeed/industry/8000-Financials/feedTitle/GlobeNewswire%20-%20Industry%20News%20on%20Financials",
    homepage: "https://www.globenewswire.com/",
    contentType: "press-release",
    section: "private-markets",
    tier: 3,
    requireRelevance: true,
    description: "Company-issued press releases from the financials industry.",
  },

  // ── SEC EDGAR (official public API) ──────────────────────────────────────
  ...(
    [
      ["edgar-bx", "Blackstone", "Blackstone Inc.", 1393818],
      ["edgar-kkr", "KKR", "KKR & Co. Inc.", 1404912],
      ["edgar-apo", "Apollo", "Apollo Global Management, Inc.", 1858681],
      ["edgar-cg", "Carlyle", "The Carlyle Group Inc.", 1527166],
      ["edgar-ares", "Ares", "Ares Management Corp.", 1176948],
      ["edgar-owl", "Blue Owl", "Blue Owl Capital Inc.", 1823945],
      ["edgar-tpg", "TPG", "TPG Inc.", 1880661],
    ] as const
  ).map(
    ([id, firm, company, cik]): EdgarSource => ({
      kind: "edgar",
      id,
      name: `SEC EDGAR — ${company}`,
      company,
      cik,
      forms: ["8-K", "10-Q", "10-K"],
      homepage: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}`,
      contentType: "filing",
      section: "filings",
      tier: 1,
      firms: [firm],
      description: `Official SEC filings (8-K, 10-Q, 10-K) by ${company}.`,
    }),
  ),
  {
    kind: "edgar",
    id: "edgar-bridgewater",
    name: "SEC EDGAR — Bridgewater Associates",
    company: "Bridgewater Associates, LP",
    cik: 1350694,
    forms: ["13F-HR", "13F-HR/A"],
    homepage: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=1350694",
    contentType: "filing",
    section: "hedge-funds",
    tier: 1,
    firms: ["Bridgewater"],
    description: "Bridgewater's quarterly 13F holdings disclosures.",
  },
];

/** FRED series for the market strip. Public CSV endpoint, no key required. */
export const FRED_SERIES = [
  { id: "SP500", label: "S&P 500", unit: "index" },
  { id: "DGS10", label: "10-Yr Treasury", unit: "percent" },
  { id: "DGS2", label: "2-Yr Treasury", unit: "percent" },
  { id: "T10Y2Y", label: "10Y–2Y Curve", unit: "percent" },
  { id: "VIXCLS", label: "VIX", unit: "index" },
  { id: "BAMLH0A0HYM2", label: "High-Yield Spread", unit: "percent" },
  { id: "DFF", label: "Fed Funds Rate", unit: "percent" },
] as const;

/** Links to these domains are dropped: paywalled or login-required. */
export const PAYWALLED_DOMAINS = [
  "wsj.com",
  "ft.com",
  "barrons.com",
  "economist.com",
  "pitchbook.com",
  "pehub.com",
  "privateequityinternational.com",
  "institutionalinvestor.com",
  "nytimes.com",
  "washingtonpost.com",
  "businessinsider.com",
  "theinformation.com",
  "bloomberg.com/news",
];
