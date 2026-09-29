import { createHash } from "node:crypto";
import { PAYWALLED_DOMAINS } from "./sources";
import { CORE_FIRMS as CORE_FIRM_LIST, type SectionId } from "./types";

const EXCERPT_MAX = 600;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  mdash: "—",
  ndash: "–",
  hellip: "…",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

export function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/p>|<\/li>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** Trims to a word boundary so excerpts never end mid-word. */
export function toExcerpt(text: string, max = EXCERPT_MAX): string {
  const clean = stripHtml(text);
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.-]+$/, "") + "…";
}

export function itemId(url: string, title: string): string {
  return createHash("sha1").update(canonicalUrl(url) || title).digest("hex").slice(0, 12);
}

/** Lowercases host, drops tracking params and fragments so the same story dedupes. */
export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|__source|cmpid|mod$|ref$|src$|yptr$|guccounter)/i.test(key)) u.searchParams.delete(key);
    }
    u.hostname = u.hostname.toLowerCase();
    return u.toString().replace(/\/$/, "");
  } catch {
    return raw.trim();
  }
}

export function isPaywalled(url: string): boolean {
  try {
    const u = new URL(url);
    const hostPath = (u.hostname.replace(/^www\./, "") + u.pathname).toLowerCase();
    return PAYWALLED_DOMAINS.some((d) => {
      const [domain, ...rest] = d.split("/");
      const host = u.hostname.replace(/^www\./, "").toLowerCase();
      const hostMatch = host === domain || host.endsWith("." + domain);
      return hostMatch && (rest.length === 0 || hostPath.startsWith(d));
    });
  } catch {
    return true; // unparseable links are not shown
  }
}

/** Firm name → patterns that identify it in a headline or excerpt. */
export const FIRM_PATTERNS: Record<string, RegExp> = {
  Blackstone: /\bBlackstone\b(?! Laboratories)|\bBREIT\b|\bBCRED\b/,
  KKR: /\bKKR\b|Kohlberg Kravis/,
  Apollo: /\bApollo (Global|Management|Asset|Capital|Funds?|Debt|Credit)\b|\bAthene\b|\bApollo[’']s\b(?=.*\b(fund|credit|deal|invest|asset|private))/i,
  Carlyle: /\bCarlyle\b(?! Group Hotel)/,
  Bridgewater: /\bBridgewater Associates\b|\bBridgewater\b(?=.*\b(fund|hedge|Dalio|Prince|Jensen|invest|macro|portfolio))/i,
  Brookfield: /\bBrookfield (Asset|Corp|Infrastructure|Renewable|Properties|Wealth)\b|\bBrookfield\b(?=.*\b(fund|invest|deal|asset))/,
  Ares: /\bAres Management\b|\bAres Capital\b|\bAres\b(?=.*\b(credit|fund|private))/,
  "Blue Owl": /\bBlue Owl\b/,
  TPG: /\bTPG\b/,
  Oaktree: /\bOaktree\b|\bHoward Marks\b/,
  BlackRock: /\bBlackRock\b|\bLarry Fink\b/,
  "Goldman Sachs": /\bGoldman Sachs\b|\bGoldman\b/,
  "J.P. Morgan": /\bJ\.?P\.? ?Morgan\b|\bJPMorgan\b|\bJamie Dimon\b/,
  "Morgan Stanley": /\bMorgan Stanley\b/,
  Citadel: /\bCitadel\b(?! Securities)|\bKen Griffin\b/,
  Millennium: /\bMillennium Management\b|\bIzzy Englander\b/,
  Elliott: /\bElliott (Management|Investment)\b|\bPaul Singer\b/,
  "Pershing Square": /\bPershing Square\b|\bBill Ackman\b|\bAckman\b/,
  Berkshire: /\bBerkshire Hathaway\b|\bWarren Buffett\b|\bBuffett\b/,
  "Bain Capital": /\bBain Capital\b/,
  "Thoma Bravo": /\bThoma Bravo\b/,
  "Warburg Pincus": /\bWarburg Pincus\b/,
  EQT: /\bEQT (AB|Partners|Group)\b|\bEQT\b(?=.*\b(private equity|fund|buyout))/,
  "Vista Equity": /\bVista Equity\b/,
};

export const CORE_FIRMS = new Set(CORE_FIRM_LIST);

export function tagFirms(text: string, fixed: string[] = []): string[] {
  const found = new Set(fixed);
  for (const [firm, re] of Object.entries(FIRM_PATTERNS)) {
    if (re.test(text)) found.add(firm);
  }
  return [...found];
}

/** Family-office and private-wealth vocabulary: routes stories to "Family Offices & Wealth". */
export const WEALTH_TOPIC = /\bfamily offices?\b|\bmulti-?family office|\b(ultra-)?high-net-worth\b|\bU?HNW\b|\bwealth manag|\bprivate wealth\b|\bRIAs?\b|\bwealthy (families|individuals|investors)\b|\bfinancial advis[eo]rs?\b/i;

const SECTION_KEYWORDS: [SectionId, RegExp][] = [
  ["hedge-funds", /\bhedge funds?\b|\bmulti-?strateg|\bmacro fund|\bactivist investor|\bshort seller|\b13F\b|\bpod shop/i],
  ["private-equity", /\bprivate equity\b|\bbuyouts?\b|\bLBO\b|\btake[- ]private\b|\bportfolio compan|\bsponsor-backed|\bcarve-?out/i],
  ["family-offices", WEALTH_TOPIC],
  ["private-markets", /\bprivate (credit|markets?|capital)\b|\bendowments?\b|\bsecondar(y|ies) (market|fund)|\binfrastructure fund|\balternative (assets?|investments?)|\bdirect lending|\bLPs?\b|\bGPs?\b|\bsovereign wealth|\bpension fund/i],
];

export function guessSection(text: string, fallback: SectionId): SectionId {
  if (fallback === "voices" || fallback === "filings") return fallback;
  for (const [section, re] of SECTION_KEYWORDS) if (re.test(text)) return section;
  return fallback;
}

/** Signals that a headline is low-value for this audience (stock tips, advice columns, listicles, promos). */
export const LOW_VALUE = new RegExp(
  [
    String.raw`\bstocks? to (buy|sell|watch)\b`,
    String.raw`\bcramer\b`,
    String.raw`\bbest (credit card|savings|CDs?)\b`,
    String.raw`\bmortgage rates today\b`,
    String.raw`\b(sponsored|promo code|coupon|presale|meme coin|price prediction)\b`,
    String.raw`^my (wife|husband|friend|partner|parents?|sister|brother|mother|father|mom|dad|son|daughter|boss)\b`,
    String.raw`\b(should i|how can i|do (i|we) really need)\b`,
    String.raw`\b\d+ (best|top) \w+`,
    String.raw`^prediction:|\bbetter (buy|stock)\b|\bone is a (much )?better\b`,
    // Personal-finance advice columns written in the first person.
    String.raw`\bmy (\d+-year-old|wife|husband|partner|parents?|mother|father|mom|dad|son|daughter|sister|brother|kids?|children)\b|\bplease help\b|^\d+ (places|ways|things|reasons|signs|mistakes|questions|tips)\b|\b(I['’]m|I['’]ve|I have|can['’]t I|should I|I want)\b|\bSocial Security\b|\bcredit cards?\b`,
    // Podcast reruns and routine regulatory/listing notices.
    String.raw`^\[?(replay|rerun|rebroadcast|encore)\b`,
    String.raw`\b(major shareholder announcement|transactions? in own shares|total voting rights|managers['’] transactions|notification of major holdings|form 8\.3|approval of (application|proposal|notice)s?)\b`,
    // Non-English duplicates of wire releases (Nordic/German characters in the headline).
    String.raw`[æøåÆØÅß]`,
  ].join("|"),
  "i",
);

/** Topical filter for high-volume wire feeds, which carry every kind of corporate release. */
export const INVESTMENT_RELEVANT =
  /\b(private equity|private credit|private markets?|buyouts?|hedge funds?|family offices?|endowments?|asset manag\w*|wealth manag\w*|fund(s|raise|raising)?|acquisitions?|acquires?|merger|capital|invest\w*|credit|IPO|portfolio|AUM|assets under management|secondar(y|ies)|infrastructure|real estate|REIT)\b/i;
