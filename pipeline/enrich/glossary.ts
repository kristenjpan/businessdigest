// Shared by the pipeline and the site's Glossary page. No Node-only imports.

export interface GlossaryTerm {
  term: string;
  match: RegExp; // how the term is spotted in a headline or excerpt
  explanation: string;
  category: "Private markets" | "Public markets" | "Credit" | "Hedge funds" | "Filings & rules" | "Wealth";
}

export const GLOSSARY: GlossaryTerm[] = [
  // Private markets
  { term: "Limited partner (LP)", match: /\bLPs?\b|\blimited partners?\b/i, category: "Private markets", explanation: "The investors in a private fund, such as pensions, endowments, insurers and family offices. They commit capital but do not manage the fund." },
  { term: "General partner (GP)", match: /\bGPs?\b|\bgeneral partners?\b/i, category: "Private markets", explanation: "The firm that runs a private fund, picks the investments and earns fees plus a share of profits." },
  { term: "Dry powder", match: /\bdry powder\b/i, category: "Private markets", explanation: "Money investors have committed to private funds that has not yet been invested. It is a measure of how much buying power is waiting on the sidelines." },
  { term: "Fund close", match: /\b(final|first) close\b/i, category: "Private markets", explanation: "A milestone in fundraising. The first close lets a fund start investing; the final close means no new investors can join." },
  { term: "Hard cap", match: /\bhard cap\b/i, category: "Private markets", explanation: "The maximum amount a private fund will accept from investors. Hitting it signals strong demand." },
  { term: "Carried interest", match: /\bcarried interest\b|\bcarry\b/i, category: "Private markets", explanation: "The share of a fund's profits (often 20%) paid to the manager once investors get their money back plus a minimum return." },
  { term: "Hurdle rate", match: /\bhurdle\b|\bpreferred return\b/i, category: "Private markets", explanation: "The minimum annual return investors must earn before the manager can collect carried interest, often around 8%." },
  { term: "Take-private", match: /\btake[- ]private\b|\btaken private\b/i, category: "Private markets", explanation: "When a private-equity firm buys all the shares of a listed company and removes it from the stock exchange." },
  { term: "Leveraged buyout (LBO)", match: /\bLBOs?\b|\bleveraged buyouts?\b|\bbuyouts?\b/i, category: "Private markets", explanation: "Buying a company using a large amount of borrowed money, secured against the company's own cash flows, to amplify returns." },
  { term: "Portfolio company", match: /\bportfolio compan(y|ies)\b/i, category: "Private markets", explanation: "A business owned by a private-equity fund." },
  { term: "Secondaries", match: /\bsecondar(y|ies)\b/i, category: "Private markets", explanation: "The market for buying and selling existing stakes in private funds or companies. It gives investors a way out before a fund ends." },
  { term: "Continuation vehicle", match: /\bcontinuation (vehicle|fund)s?\b|\bGP-led\b/i, category: "Private markets", explanation: "A new fund set up by a manager to keep holding its best assets longer, while giving existing investors the option to cash out." },
  { term: "Exit", match: /\bexits?\b/i, category: "Private markets", explanation: "How a private investor sells an investment and gets cash back, typically through a sale to another company, a sale to another fund, or an IPO." },
  { term: "Distributions (DPI)", match: /\bdistributions?\b|\bDPI\b/i, category: "Private markets", explanation: "Cash a fund actually returns to investors. DPI (distributions to paid-in capital) measures how much cash has come back per dollar invested." },
  { term: "IRR", match: /\bIRRs?\b|\binternal rate of return\b/i, category: "Private markets", explanation: "Internal rate of return, the annualized return on an investment that accounts for when cash went in and came out." },
  { term: "Infrastructure fund", match: /\binfrastructure (fund|investor|investing)\b/i, category: "Private markets", explanation: "A fund that owns essential physical assets such as power, pipelines, data centers, airports and fiber, which usually produce steady, long-term cash flows." },
  { term: "GP stakes", match: /\bGP stakes?\b/i, category: "Private markets", explanation: "Minority ownership stakes in the management companies of private-equity or hedge-fund firms, which earn a share of their fees and profits." },
  { term: "Denominator effect", match: /\bdenominator effect\b/i, category: "Private markets", explanation: "When public markets fall, private holdings suddenly make up a larger share of a portfolio, which can force investors to slow new private commitments." },
  { term: "Valuation multiple", match: /\bmultiples?\b|\bvaluations?\b/i, category: "Private markets", explanation: "How expensive a company is relative to its earnings or sales, for example 12× EBITDA. Higher multiples mean investors are paying more for each dollar of profit." },
  { term: "EBITDA", match: /\bEBITDA\b/, category: "Private markets", explanation: "Earnings before interest, taxes, depreciation and amortization, a common proxy for a company's operating cash flow used to price deals." },
  { term: "Market cycle", match: /\bcycles?\b/i, category: "Private markets", explanation: "The recurring pattern of expansion, peak, downturn and recovery in markets. Investors like Howard Marks argue that knowing where you are in the cycle matters more than prediction." },

  // Credit
  { term: "Private credit", match: /\bprivate credit\b|\bprivate debt\b/i, category: "Credit", explanation: "Loans made by investment funds rather than banks, usually to mid-sized companies. They often pay higher, floating interest rates." },
  { term: "Direct lending", match: /\bdirect lending\b|\bdirect lenders?\b/i, category: "Credit", explanation: "The largest form of private credit: a fund lends directly to a company, often one owned by private equity, without a bank in the middle." },
  { term: "BDC", match: /\bBDCs?\b|\bbusiness development compan(y|ies)\b/i, category: "Credit", explanation: "Business development company, a vehicle (often publicly listed) that lets ordinary investors own a portfolio of private loans." },
  { term: "Asset-based finance", match: /\basset-based (finance|lending)\b/i, category: "Credit", explanation: "Lending secured by pools of assets such as equipment, receivables or consumer loans rather than a company's overall cash flow." },
  { term: "NAV loan", match: /\bNAV (loans?|lending|financing)\b/i, category: "Credit", explanation: "A loan to a private fund secured by the value of its portfolio, often used to return cash to investors or support holdings." },
  { term: "CLO", match: /\bCLOs?\b|\bcollateralized loan obligations?\b/i, category: "Credit", explanation: "Collateralized loan obligation, a pool of corporate loans sliced into bonds with different levels of risk and return." },
  { term: "High-yield spread", match: /\bspreads?\b|\bhigh[- ]yield\b|\bjunk bonds?\b/i, category: "Credit", explanation: "The extra interest riskier companies pay over U.S. Treasuries. Wider spreads mean lenders are nervous; tighter spreads mean credit is easy to get." },
  { term: "Basis point", match: /\bbps\b|\bbasis points?\b/i, category: "Credit", explanation: "One hundredth of a percentage point (0.01%). A rate rising from 4.00% to 4.25% has risen 25 basis points." },

  // Public markets
  { term: "Volatility (VIX)", match: /\bVIX\b|\bvolatility\b/i, category: "Public markets", explanation: "The VIX measures how much the stock market expects prices to swing over the next month. Above about 20 signals nervousness; below about 15 signals calm." },
  { term: "Yield curve", match: /\byield curve\b|\binverted\b/i, category: "Public markets", explanation: "A comparison of short- and long-term interest rates. When short rates exceed long rates, the curve is inverted, which has often preceded recessions." },
  { term: "Treasury yield", match: /\bTreasury yields?\b|\b10-year\b/i, category: "Public markets", explanation: "The interest rate the U.S. government pays to borrow. The 10-year yield is the benchmark that influences mortgage rates, corporate borrowing and asset valuations." },
  { term: "Fed funds rate", match: /\bfed funds\b|\bfederal funds\b|\brate (cut|hike)s?\b/i, category: "Public markets", explanation: "The short-term interest rate set by the Federal Reserve. It drives borrowing costs across the economy, including floating-rate private loans." },
  { term: "Recession", match: /\brecession\b/i, category: "Public markets", explanation: "A broad, sustained decline in economic activity, commonly (though not officially) defined as two quarters of shrinking GDP." },
  { term: "IPO", match: /\bIPOs?\b|\binitial public offering\b/i, category: "Public markets", explanation: "Initial public offering, when a private company first sells shares on a stock exchange. It is a key exit route for private-equity and venture investors." },
  { term: "REIT", match: /\bREITs?\b|\bBREIT\b/, category: "Public markets", explanation: "Real estate investment trust, a company that owns income-producing property and must pay out most of its income to shareholders." },

  // Hedge funds
  { term: "Multi-strategy fund", match: /\bmulti-?strateg(y|ies)\b|\bpod(s| shop)\b/i, category: "Hedge funds", explanation: "A hedge fund that allocates money to many independent trading teams (pods) across strategies, aiming for steady returns with tight risk limits." },
  { term: "Global macro", match: /\bmacro (fund|investor|trader|strategy)\b|\bglobal macro\b/i, category: "Hedge funds", explanation: "A hedge-fund strategy that bets on big economic trends through interest rates, currencies, commodities and stock indices." },
  { term: "Activist investor", match: /\bactivists?\b/i, category: "Hedge funds", explanation: "An investor who buys a stake in a company and pushes management for changes such as new strategy, board seats or a sale, to unlock value." },
  { term: "Alpha", match: /\balpha\b/i, category: "Hedge funds", explanation: "Returns above what the overall market delivered, a measure of a manager's skill rather than just market exposure." },

  // Filings & rules
  { term: "13F filing", match: /\b13F\b/, category: "Filings & rules", explanation: "A quarterly SEC report listing the U.S. stocks held by managers with over $100 million. It is published up to 45 days after quarter-end and excludes short positions." },
  { term: "Form 8-K", match: /\b8-K\b/, category: "Filings & rules", explanation: "A report public companies must file with the SEC within days of a major event such as a deal, leadership change or earnings release." },
  { term: "Form 10-Q / 10-K", match: /\b10-[QK]\b/, category: "Filings & rules", explanation: "The quarterly (10-Q) and annual (10-K) financial reports that U.S.-listed companies file with the SEC." },
  { term: "Accredited investor", match: /\baccredited investors?\b|\bqualified purchasers?\b/i, category: "Filings & rules", explanation: "An individual or entity that meets SEC wealth or income tests and is therefore allowed to invest in most private funds." },

  // Wealth
  { term: "Family office", match: /\bfamily offices?\b/i, category: "Wealth", explanation: "A private firm that manages the investments and affairs of a wealthy family. A single-family office serves one family; a multi-family office serves several." },
  { term: "Assets under management (AUM)", match: /\bAUM\b|\bassets under management\b/i, category: "Wealth", explanation: "The total market value of money a firm invests on behalf of clients. It is the main yardstick of an asset manager's size." },
  { term: "Evergreen fund", match: /\bevergreen\b|\binterval funds?\b|\bsemi-liquid\b|\bperpetual\b/i, category: "Wealth", explanation: "A private-markets fund with no end date that accepts new money and allows limited periodic withdrawals. It is the main format for bringing private assets to wealthy individuals." },
  { term: "Annuity", match: /\bannuit(y|ies)\b/i, category: "Wealth", explanation: "An insurance product that pays a guaranteed income, often for life. Insurers invest the premiums, increasingly in private credit." },
  { term: "RIA", match: /\bRIAs?\b|\bregistered investment advis/i, category: "Wealth", explanation: "Registered investment adviser, an independent firm legally obliged to act in its clients' best interests when giving investment advice." },
  { term: "Endowment", match: /\bendowments?\b/i, category: "Wealth", explanation: "A pool of money owned by a university or charity and invested to fund its mission forever. The Yale-style endowment model popularized heavy private-market investing." },
];

const BY_TERM = new Map(GLOSSARY.map((g) => [g.term, g]));

/** Finds the first glossary term mentioned in the text, falling back to the theme's default. */
export function findTerm(text: string, fallbackTerm?: string): GlossaryTerm | null {
  // Prefer specific terms (earlier in their category, longer match) over broad ones like "valuation".
  const broad = new Set(["Valuation multiple", "Market cycle", "Exit", "High-yield spread", "Volatility (VIX)"]);
  const specific = GLOSSARY.find((g) => !broad.has(g.term) && g.match.test(text));
  if (specific) return specific;
  if (fallbackTerm && BY_TERM.has(fallbackTerm)) return BY_TERM.get(fallbackTerm)!;
  return GLOSSARY.find((g) => g.match.test(text)) ?? null;
}
