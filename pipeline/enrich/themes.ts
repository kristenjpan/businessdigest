import type { RawItem, SectionId } from "../types";
import { type MarketView, sentence } from "./market";

/**
 * The rule-based "editor". Each theme knows how to recognise a story (patterns), how much it
 * matters to this audience (weight), why it matters (templates), and which market data frames it.
 */
export interface Theme {
  id: string;
  label: string;
  weight: number; // added to the relevance score; 0–2
  patterns: RegExp[];
  term: string; // default glossary term for beginners
  why: string[]; // rotated by item id so repeated themes don't read identically
  allocator: string; // one-line angle for allocators and family offices
  context: (m: MarketView) => string | null;
}

// ── Market-context builders shared across themes ──────────────────────────

function financing(m: MarketView): string | null {
  const facts = sentence([m.tenYear?.text, m.hy?.text]);
  if (!facts) return null;
  const hy = m.hy?.regime;
  const soWhat =
    hy === "calm" || hy === "normal"
      ? "Open debt markets make leveraged deals easier to finance and support valuations."
      : hy
        ? "Costlier debt tends to slow leveraged dealmaking and pressure purchase prices."
        : "The level of long-term rates sets the cost of leverage for buyouts.";
  return `${facts} ${soWhat}`;
}

function floatingRate(m: MarketView): string | null {
  const facts = sentence([m.fedFunds?.text, m.hy?.text]);
  if (!facts) return null;
  return `${facts} Most private loans pay a floating rate, so lender income tracks short-term rates while spreads show how much extra investors demand for credit risk.`;
}

function publicMarkets(m: MarketView): string | null {
  const facts = sentence([m.sp500?.text, m.vix?.text]);
  if (!facts) return null;
  const v = m.vix?.regime;
  const soWhat =
    v === "calm" || v === "normal"
      ? "Steady public markets keep the IPO window open and support private-company valuations."
      : v
        ? "Volatile public markets tend to shut the IPO window and delay exits."
        : "Public-market levels are the yardstick for private-company valuations.";
  return `${facts} ${soWhat}`;
}

function ratesBackdrop(m: MarketView): string | null {
  const facts = sentence([m.fedFunds?.text, m.tenYear?.text, m.curve?.text]);
  if (!facts) return null;
  return `${facts} Rates set the hurdle every investment has to clear and drive borrowing costs across the economy.`;
}

function realEstate(m: MarketView): string | null {
  const facts = sentence([m.tenYear?.text, m.curve?.text]);
  if (!facts) return null;
  return `${facts} Property values move inversely to long-term yields, because buyers compare rental income with what "safe" Treasuries pay.`;
}

function longDuration(m: MarketView): string | null {
  const facts = sentence([m.tenYear?.text, m.fedFunds?.text]);
  if (!facts) return null;
  return `${facts} Long-lived assets such as infrastructure, insurance portfolios and annuities are priced off these yields.`;
}

function riskTone(m: MarketView): string | null {
  const facts = sentence([m.vix?.text, m.hy?.text]);
  if (!facts) return null;
  const tone = m.tone;
  const soWhat =
    tone === "risk-on"
      ? "Overall risk appetite is healthy."
      : tone === "risk-off"
        ? "Investors are in a defensive, risk-off mood."
        : "Signals on risk appetite are mixed.";
  return `${facts} ${soWhat}`;
}

function allocation(m: MarketView): string | null {
  const facts = sentence([m.sp500?.text, m.tenYear?.text]);
  if (!facts) return null;
  return `${facts} Stock and bond levels change how much room investors have for private assets. When public holdings fall, private allocations look overweight (the "denominator effect").`;
}

// ── Theme registry ────────────────────────────────────────────────────────

export const THEMES: Theme[] = [
  {
    id: "fundraising",
    label: "Fundraising",
    weight: 1.5,
    patterns: [/\b(final|first) close\b/i, /\bfundrais/i, /\bhard cap\b/i, /\boversubscribed\b/i, /\bclos(es|ed|ing) .{0,40}\bfund\b/i, /\braise[sd]? \$[\d.,]+ ?(billion|bn|million|m)\b/i, /\blaunch(es|ed)? .{0,30}\bfund\b/i, /\bnew fund\b/i, /\bcapital commitments?\b/i],
    term: "Dry powder",
    why: [
      "Big fundraises show where institutional money is flowing and hand managers fresh dry powder to put to work over the next few years.",
      "Fundraising success is the clearest vote of confidence from pensions, endowments and family offices in a strategy or manager.",
      "When fundraising concentrates in a few large firms, smaller managers compete harder for capital, which can mean better terms for investors.",
    ],
    allocator: "For allocators: watch which strategies are attracting capital, because crowded areas can compress future returns.",
    context: allocation,
  },
  {
    id: "deals",
    label: "M&A & Buyouts",
    weight: 1.5,
    patterns: [/\bacquir(e|es|ed|ing)\b/i, /\bacquisition\b/i, /\btake[- ]private\b/i, /\bbuyouts?\b/i, /\bmerger\b/i, /\b(agrees?|agreed|deal) to (buy|acquire|sell)\b/i, /\bdeal valued\b/i, /\b(stake|investment) in\b/i, /\bcarve-?out\b/i, /\bLBO\b/],
    term: "Take-private",
    why: [
      "Deal activity is the heartbeat of private equity: it shows sponsors are willing to put capital to work at today's prices and financing costs.",
      "Large transactions reset valuation benchmarks for comparable companies, public and private.",
      "Each deal reveals where sponsors see value and which sectors they expect to outperform.",
    ],
    allocator: "For allocators: deployment pace drives when committed capital is actually called, so it matters for liquidity planning.",
    context: financing,
  },
  {
    id: "private-credit",
    label: "Private Credit",
    weight: 1.5,
    patterns: [/\bprivate credit\b/i, /\bdirect lending\b/i, /\bBDCs?\b/, /\basset[- ]based (finance|lending)\b/i, /\bequipment financ(e|ing)\b/i, /\bNAV (loan|lending|financing)\b/i, /\bcredit fund\b/i, /\bunitranche\b/i, /\bCLOs?\b/, /\bprivate (debt|lending)\b/i, /\bspecialty finance\b/i],
    term: "Direct lending",
    why: [
      "Private credit has grown into one of the fastest-growing corners of finance as non-bank lenders take share from banks.",
      "Developments here show how easily companies can borrow outside the banking system, and at what price.",
      "Private credit's rapid growth draws regulatory attention; loan quality and valuations are the key things to watch.",
    ],
    allocator: "For allocators: private credit offers high floating-rate income but less liquidity, so manager selection and underwriting discipline matter.",
    context: floatingRate,
  },
  {
    id: "exits",
    label: "Exits & Secondaries",
    weight: 1.5,
    patterns: [/\bIPOs?\b/, /\binitial public offering\b/i, /\bsecondar(y|ies)\b/i, /\bcontinuation (vehicle|fund)\b/i, /\bGP-led\b/i, /\bexits?\b/i, /\bspin-?off\b/i, /\b(sells?|sold|selling) (its |a )?(stake|business|unit|portfolio)\b/i, /\bgoes public\b|\blisting\b/i, /\bdistributions?\b/i],
    term: "Continuation vehicle",
    why: [
      "Exits return cash to investors. A slow exit market has left many LPs waiting on distributions, so every sale or IPO is closely watched.",
      "Secondaries and continuation vehicles have become key liquidity tools while traditional IPO and M&A exits recover.",
      "The pace of exits determines when investors get cash back and how much they can recommit to new funds.",
    ],
    allocator: "For allocators: distributions (DPI) are the ultimate scorecard, because paper gains only count once they turn into cash.",
    context: publicMarkets,
  },
  {
    id: "real-estate",
    label: "Real Estate",
    weight: 1,
    patterns: [/\breal estate\b/i, /\bREITs?\b/, /\bBREIT\b/, /\bproperty\b|\bproperties\b/i, /\boffice (market|buildings?|space)\b/i, /\b(housing|multifamily|apartments?|warehouses?|logistics)\b/i, /\bcommercial (real estate|mortgage)\b/i, /\bCRE\b/],
    term: "REIT",
    why: [
      "Real estate is highly sensitive to interest rates, so it is often the first place higher or lower borrowing costs show up in valuations.",
      "Property is a core holding for family offices and pensions; shifts in values or flows affect a large share of private portfolios.",
      "Real estate trends reveal where demand is strong (data centers, logistics, housing) and where it is weak (older offices).",
    ],
    allocator: "For allocators: check whether exposure is concentrated in sectors with structural demand or in those facing lasting headwinds.",
    context: realEstate,
  },
  {
    id: "infrastructure",
    label: "Infrastructure & Energy",
    weight: 1,
    patterns: [/\binfrastructure\b/i, /\bdata cent(er|re)s?\b/i, /\b(power|energy|utilit(y|ies)|electricity|grid)\b/i, /\brenewables?\b|\bsolar\b|\bwind\b/i, /\bLNG\b|\bpipelines?\b/i, /\bfiber\b|\btowers?\b/i],
    term: "Infrastructure fund",
    why: [
      "Demand for power, data centers and energy transition projects is pulling record private capital into infrastructure.",
      "Infrastructure assets offer long-dated, often inflation-linked cash flows, which appeals to investors seeking stability.",
      "The AI build-out depends on power and data-center capacity, making infrastructure one of private markets' biggest growth stories.",
    ],
    allocator: "For allocators: infrastructure can diversify a portfolio, but deal sizes are large and access often runs through the biggest managers.",
    context: longDuration,
  },
  {
    id: "earnings",
    label: "Earnings & AUM",
    weight: 1,
    patterns: [/\bearnings\b/i, /\b(quarterly|second[- ]quarter|third[- ]quarter|fourth[- ]quarter|first[- ]quarter|annual) results\b/i, /\bassets under management\b|\bAUM\b/i, /\bfee-related earnings\b|\bdistributable earnings\b/i, /\bresults of operations\b/i, /\bForm 10-[QK]\b/i, /\b(revenue|profit|net income)\b/i, /\binflows?\b/i],
    term: "Assets under management (AUM)",
    why: [
      "Results from listed alternative managers are a real-time read on private-market health: fundraising, deployment, exits and fees in one report.",
      "Asset growth and fee income show which managers are winning the race for capital, especially from wealthy individuals.",
      "Earnings from the big alternative managers often set the tone for the whole private-markets industry.",
    ],
    allocator: "For allocators: manager financials reveal momentum and business priorities, which help when evaluating a GP relationship.",
    context: publicMarkets,
  },
  {
    id: "rates",
    label: "Fed & Rates",
    weight: 1,
    patterns: [/\bFederal Reserve\b|\bthe Fed\b|\bFed(’|')s\b|\bFOMC\b/i, /\binterest rates?\b/i, /\brate (cut|hike|decision)s?\b/i, /\binflation\b|\bCPI\b|\bPCE\b/i, /\bTreasur(y|ies)\b.{0,20}\byields?\b|\byields?\b/i, /\bPowell\b/, /\bmonetary policy\b/i, /\bbalance sheet\b/i],
    term: "Basis point",
    why: [
      "Interest rates are the gravity of finance. They set borrowing costs for deals, the discount rate on every asset and the return on cash.",
      "Central-bank signals shape expectations for financing costs, valuations and the pace of dealmaking across public and private markets.",
      "Shifts in rate expectations ripple quickly into bond prices, real estate values and the appeal of floating-rate private credit.",
    ],
    allocator: "For allocators: the rate path changes the relative appeal of cash, bonds, private credit and leveraged equity.",
    context: ratesBackdrop,
  },
  {
    id: "regulation",
    label: "Regulation & Policy",
    weight: 1,
    patterns: [/\bSEC\b/, /\bregulat(or|ors|ion|ory)\b/i, /\b(rule|rules|rulemaking)\b/i, /\benforcement\b|\bcharges?\b|\bsettle(s|d|ment)\b/i, /\blawsuit\b|\bsues?\b/i, /\bCongress\b|\blegislation\b|\bbill\b/i, /\btax(es)?\b/i, /\bcarried interest\b/i, /\bDepartment of Labor\b/i],
    term: "Accredited investor",
    why: [
      "Rule changes can open new pools of capital, or raise compliance costs, for asset managers and their investors.",
      "Regulatory scrutiny of private funds is rising as the industry grows; new rules often reshape fees, disclosure and access.",
      "Policy decisions set the ground rules for who can invest in private markets and on what terms.",
    ],
    allocator: "For allocators: new rules can change fees, transparency and eligibility, so check with advisers how they affect existing commitments.",
    context: riskTone,
  },
  {
    id: "hedge-funds",
    label: "Hedge Funds",
    weight: 1,
    patterns: [/\bhedge funds?\b/i, /\bmulti-?strateg(y|ies)\b/i, /\bmacro (fund|trader|strategy)\b/i, /\bpod(s| shop)\b/i, /\bshort (seller|selling|bets?)\b/i, /\bactivist\b/i, /\b(returns?|gained|lost|performance)\b.{0,40}\b(fund|year|month)\b/i, /\bquant(itative)? funds?\b/i],
    term: "Multi-strategy fund",
    why: [
      "Hedge-fund performance and positioning show how sophisticated money is navigating current markets.",
      "Large multi-strategy and macro funds move significant capital; their moves can amplify market trends.",
      "Hedge funds are often the first to act on shifts in rates, currencies and volatility, so their behavior is an early signal.",
    ],
    allocator: "For allocators: hedge funds are judged on returns that don't simply track the stock market, so check what drove performance.",
    context: riskTone,
  },
  {
    id: "holdings",
    label: "13F & Positioning",
    weight: 0.5,
    patterns: [/\b13F\b/, /\bholdings\b/i, /\b(boosted|cut|trimmed|added|raised) (its |their )?(stake|position|holding)s?\b/i, /\bnew position\b/i, /\bportfolio (changes|moves)\b/i],
    term: "13F filing",
    why: [
      "13F filings reveal what large managers owned at quarter-end. They offer a delayed but useful window into institutional positioning.",
      "Tracking big-manager holdings shows which themes professionals are leaning into, though the data is up to 45 days old when published.",
    ],
    allocator: "For allocators: treat 13Fs as context, not trade signals. They exclude shorts, derivatives and non-U.S. positions.",
    context: publicMarkets,
  },
  {
    id: "family-office",
    label: "Family Offices & Wealth",
    weight: 1.5,
    patterns: [/\bfamily offices?\b/i, /\b(ultra-)?high-net-worth\b|\bUHNW\b|\bHNW\b/i, /\bwealth (manag\w*|channel|clients?)\b/i, /\bprivate wealth\b/i, /\bRIAs?\b/, /\b(individual|retail) investors?\b/i, /\bevergreen\b|\binterval funds?\b|\bsemi-liquid\b|\bperpetual\b/i, /\bmultifamily office\b/i, /\bendowments?\b|\bfoundations?\b/i],
    term: "Family office",
    why: [
      "Private-market firms are racing to reach wealthy families and individuals, their biggest new source of growth after pensions and endowments.",
      "Family offices are becoming more institutional, direct and influential investors, often competing alongside PE firms for deals.",
      "New products aimed at private wealth are changing how individuals access private equity, credit and real estate, including liquidity terms and fees.",
    ],
    allocator: "For family offices: compare liquidity terms, fees and valuation policies closely when evaluating new semi-liquid or evergreen products.",
    context: allocation,
  },
  {
    id: "people",
    label: "People & Leadership",
    weight: 0.25,
    patterns: [/\b(appoints?|appointed|names?|named|hires?|hired|promotes?|promoted|joins?)\b/i, /\b(CEO|CIO|CFO|chief \w+ officer|managing director|partner|chair(man|woman)?)\b/i, /\bsteps? down\b|\bretire(s|ment)?\b|\bsuccession\b|\bdeparts?\b/i, /\bdirector or officer change\b/i],
    term: "General partner (GP)",
    why: [
      "Leadership changes at major firms can signal strategic shifts, succession planning or a new push into a growth area.",
      "Where senior talent moves shows which strategies firms are prioritising, such as private credit, wealth or infrastructure.",
    ],
    allocator: "For allocators: key-person changes matter because many fund agreements tie commitments to specific investment leaders.",
    context: publicMarkets,
  },
  {
    id: "ai-tech",
    label: "AI & Technology",
    weight: 1,
    patterns: [/\bAI\b/, /\bartificial intelligence\b/i, /\b(software|semiconductors?|chips?|cloud|SaaS)\b/i, /\bgenerative\b|\bLLMs?\b/i, /\btech(nology)? (stocks?|investing|companies)\b/i],
    term: "Valuation multiple",
    why: [
      "AI is the dominant investment theme of the cycle, driving public-market leadership, data-center demand and venture valuations.",
      "Capital flowing into AI shapes returns across asset classes, from tech equities to power infrastructure and private credit for data centers.",
    ],
    allocator: "For allocators: AI exposure often builds up across several holdings at once, so check for concentration at the portfolio level.",
    context: publicMarkets,
  },
  {
    id: "insurance",
    label: "Insurance & Retirement",
    weight: 1,
    patterns: [/\binsur(ance|er|ers)\b/i, /\bannuit(y|ies)\b/i, /\bAthene\b|\bGlobal Atlantic\b/, /\bretirement\b|\b401\(k\)|\bdefined contribution\b/i, /\bpension\b/i],
    term: "Annuity",
    why: [
      "Alternative managers increasingly own or partner with insurers, using long-term policyholder capital to fund private credit.",
      "Opening 401(k)s and retirement accounts to private markets could unlock a huge new pool of capital, with implications for fees and investor protection.",
    ],
    allocator: "For allocators: the insurance–private credit link is a structural shift worth understanding for both its opportunity and its risks.",
    context: longDuration,
  },
  {
    id: "macro",
    label: "Macro & Geopolitics",
    weight: 1,
    patterns: [/\btariffs?\b|\btrade (war|deal|policy)\b/i, /\bgeopolitic/i, /\brecession\b|\bGDP\b|\bgrowth outlook\b/i, /\b(jobs|payrolls|unemployment|labor market)\b/i, /\bdollar\b|\bcurrenc(y|ies)\b/i, /\b(oil|crude|gold|commodit(y|ies))\b/i, /\belection\b|\bsanctions?\b|\bwar\b/i, /\bChina\b|\bEurope\b|\bJapan\b|\bemerging markets?\b/i],
    term: "Recession",
    why: [
      "Macro shocks such as trade, growth and geopolitics change the outlook for corporate earnings, rates and risk appetite all at once.",
      "Investors price the economy's direction long before it shows up in data; big macro headlines often move every asset class.",
    ],
    allocator: "For allocators: stress-test whether a portfolio relies on a single economic scenario.",
    context: riskTone,
  },
  {
    id: "voices",
    label: "Investor Outlook",
    weight: 0.75,
    patterns: [/\boutlook\b/i, /\binterview\b|\bconversation\b|\bepisode\b|\bpodcast\b/i, /\bmemo\b/i, /\b(says|warns|sees|expects|believes|predicts)\b/i, /\bview(s|point)?\b|\bperspective\b/i],
    term: "Market cycle",
    why: [
      "Commentary from leading investors shows how the people who allocate the most capital are thinking, often before it shows up in their portfolios.",
      "Hearing how top investors frame risk and opportunity is one of the fastest ways to build judgment about markets.",
    ],
    allocator: "For allocators: compare views across managers to see where consensus is forming and where it is not.",
    context: ratesBackdrop,
  },
  {
    id: "private-markets",
    label: "Private Markets",
    weight: 1,
    patterns: [/\bprivate (markets?|capital|equity)\b/i, /\balternative (assets?|investments?|asset managers?)\b/i, /\bLPs?\b|\blimited partners?\b/i, /\bGPs?\b|\bgeneral partners?\b/i, /\bsovereign wealth\b/i],
    term: "Limited partner (LP)",
    why: [
      "Private markets now hold a large and growing share of global investment capital; shifts here affect pensions, endowments and family offices alike.",
      "Developments in private markets show how capital is being raised, deployed and returned outside public exchanges.",
    ],
    allocator: "For allocators: private-market commitments tie up capital for years, so pacing and manager selection drive outcomes.",
    context: financing,
  },
  {
    id: "markets",
    label: "Market Moves",
    weight: 0.5,
    patterns: [/\b(stocks?|equities|S&P|Dow|Nasdaq|Russell)\b/i, /\brally\b|\bsell-?off\b|\brecord high\b/i, /\bbonds?\b/i, /\bvolatility\b|\bVIX\b/i],
    term: "Volatility (VIX)",
    why: [
      "Public-market swings feed directly into private-market valuations, IPO windows and investor sentiment.",
      "Big market moves change portfolio weights and can prompt rebalancing across asset classes.",
    ],
    allocator: "For allocators: short-term market moves matter most when they change long-term plans or liquidity needs.",
    context: riskTone,
  },
  {
    id: "disclosure",
    label: "Corporate Disclosure",
    weight: 0.25,
    patterns: [/\bForm 8-K\b|\b8-K\b/i, /\bmaterial (agreement|event)\b/i, /\bRegulation FD\b/i],
    term: "Form 8-K",
    why: [
      "Official filings are the primary record of what a listed manager has formally told investors: no spin, just disclosure.",
      "SEC filings often surface material events such as financing deals, leadership changes and results before they are widely reported.",
    ],
    allocator: "For allocators: primary filings are the most reliable source when headlines conflict.",
    context: publicMarkets,
  },
];

export const THEME_BY_ID = new Map(THEMES.map((t) => [t.id, t]));

const SECTION_DEFAULT: Record<SectionId, string> = {
  markets: "markets",
  "private-markets": "private-markets",
  "private-equity": "deals",
  "hedge-funds": "hedge-funds",
  voices: "voices",
  filings: "disclosure",
};

/** Themes whose clues are strong enough to override the "voices" default for podcasts. */
const PODCAST_OVERRIDES = new Set(["private-credit", "family-office", "real-estate", "infrastructure", "ai-tech", "insurance", "rates"]);

function hits(re: RegExp, text: string): boolean {
  return re.test(text);
}

/**
 * Picks the best theme by weighted keyword hits (title counts double). Filings and podcasts get
 * format-specific rules; anything without a clear signal falls back to its section's default.
 */
export function classify(item: RawItem): Theme {
  const title = item.title;
  const body = item.excerpt;

  // Filings: the form type is more reliable than keywords.
  if (item.source.contentType === "filing") {
    if (/13F/.test(title)) return THEME_BY_ID.get("holdings")!;
    if (/Results of operations|10-Q|10-K/i.test(`${title} ${body}`)) return THEME_BY_ID.get("earnings")!;
    if (/Director or officer change/i.test(title)) return THEME_BY_ID.get("people")!;
    if (/acquisition|disposition/i.test(title)) return THEME_BY_ID.get("deals")!;
    return THEME_BY_ID.get("disclosure")!;
  }

  let best: Theme | null = null;
  let bestScore = 0;
  for (const theme of THEMES) {
    if (theme.id === "disclosure") continue;
    let s = 0;
    for (const re of theme.patterns) {
      if (hits(re, title)) s += 2;
      else if (hits(re, body)) s += 1;
    }
    // Generic catch-all themes should only win when nothing specific matches.
    if (["voices", "markets", "private-markets", "people"].includes(theme.id)) s *= 0.6;
    if (s > bestScore) {
      best = theme;
      bestScore = s;
    }
  }

  const fallback = THEME_BY_ID.get(SECTION_DEFAULT[item.section])!;
  // Central-bank releases default to rates unless a specific theme clearly wins.
  if (item.source.contentType === "regulator" && item.source.id.startsWith("fed") && (!best || bestScore < 2 || ["voices", "markets", "people"].includes(best.id))) {
    return THEME_BY_ID.get("rates")!;
  }
  if (item.source.contentType === "podcast" && (!best || !PODCAST_OVERRIDES.has(best.id) || bestScore < 2)) {
    return THEME_BY_ID.get("voices")!;
  }
  return best && bestScore >= 1 ? best : fallback;
}

/** Deterministic pick so the same item always gets the same wording, but different items vary. */
export function pickBySeed<T>(options: T[], seed: string): T {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return options[h % options.length];
}

/** Where a theme's stories belong when the source's default section is only a guess. */
const THEME_SECTION: Partial<Record<string, SectionId>> = {
  deals: "private-equity",
  exits: "private-equity",
  fundraising: "private-markets",
  "private-credit": "private-markets",
  "family-office": "private-markets",
  "real-estate": "private-markets",
  infrastructure: "private-markets",
  insurance: "private-markets",
  "hedge-funds": "hedge-funds",
  holdings: "hedge-funds",
};

/**
 * Trade feeds file everything under one default section (e.g. HedgeCo → hedge funds, even for
 * buyouts). Moves an item to its theme's natural section; voices, filings and markets stay put.
 */
export function resolveSection(item: RawItem, theme: Theme): SectionId {
  if (item.section === "voices" || item.section === "filings" || item.section === "markets") return item.section;
  return THEME_SECTION[theme.id] ?? item.section;
}
