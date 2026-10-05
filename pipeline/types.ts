// Shared between the pipeline (Node) and the site (browser). No Node-only imports here.

export const SECTIONS = [
  { id: "markets", label: "Markets & Macro" },
  { id: "private-markets", label: "Private Markets" },
  { id: "family-offices", label: "Family Offices & Wealth" },
  { id: "private-equity", label: "Private Equity" },
  { id: "hedge-funds", label: "Hedge Funds" },
  { id: "voices", label: "Voices & Interviews" },
  { id: "filings", label: "Filings" },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];

/** The firms the digest is built around: boosted in ranking and listed first in the site's firm filter. */
export const CORE_FIRMS: readonly string[] = ["Blackstone", "KKR", "Apollo", "Carlyle", "Bridgewater"];

/**
 * Every firm the pipeline tags (core firms first), as plain names the browser can use for reader
 * preferences. Must match the keys of FIRM_PATTERNS in normalize.ts; a test enforces it.
 */
export const TRACKED_FIRMS: readonly string[] = [
  ...CORE_FIRMS,
  "Brookfield",
  "Ares",
  "Blue Owl",
  "TPG",
  "Oaktree",
  "BlackRock",
  "Goldman Sachs",
  "J.P. Morgan",
  "Morgan Stanley",
  "Citadel",
  "Millennium",
  "Elliott",
  "Pershing Square",
  "Berkshire",
  "Bain Capital",
  "Thoma Bravo",
  "Warburg Pincus",
  "EQT",
  "Vista Equity",
];

export type SourceKind = "rss" | "edgar" | "fred";
export type ContentType = "news" | "press-release" | "podcast" | "filing" | "regulator" | "research";

export interface SourceRef {
  id: string;
  name: string;
  homepage: string;
  contentType: ContentType;
}

/** A normalized item straight from a feed/API, before enrichment. */
export interface RawItem {
  id: string;
  title: string;
  url: string;
  publishedAt: string; // ISO 8601
  excerpt: string; // plain text, ≤ 600 chars, from the feed itself
  source: SourceRef;
  tier: 1 | 2 | 3;
  firms: string[];
  section: SectionId; // heuristic guess from keywords
}

export interface BeginnerNote {
  term: string;
  explanation: string;
}

export interface ThemeRef {
  id: string;
  label: string;
}

/** Reader-facing story type: reporting, someone's own words, a podcast, a filing or a letter. */
export type StoryType = "news" | "quote" | "podcast" | "filing" | "letter";

export interface DigestItem {
  id: string;
  title: string;
  url: string;
  publishedAt: string;
  source: SourceRef;
  section: SectionId;
  firms: string[];
  theme: ThemeRef;
  importance: number; // 1–5
  takeaway: string;
  whyItMatters: string;
  marketContext: string;
  beginnerNote: BeginnerNote | null;
  storyType?: StoryType; // absent in editions published before Sep 30, 2026
  aiSummarized?: boolean; // true when the takeaway was written by the AI writer
}

export interface MarketPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface MarketSeries {
  id: string; // FRED series id
  label: string;
  unit: "index" | "percent";
  value: number;
  previous: number | null;
  asOf: string; // YYYY-MM-DD
  history: MarketPoint[]; // oldest → newest, for sparklines
  sourceUrl: string;
}

export interface ExecutiveBrief {
  headline: string;
  bullets: string[];
  marketRead: string;
  themes: (ThemeRef & { count: number })[];
}

export interface Digest {
  date: string; // YYYY-MM-DD (America/New_York)
  generatedAt: string;
  engine: string; // e.g. "rules-v2", or "github-models:openai/gpt-4.1-mini + rules-v2" when the AI writer ran
  edition: number;
  brief: ExecutiveBrief;
  market: MarketSeries[];
  topStoryIds: string[];
  items: DigestItem[];
  stats: { sourcesChecked: number; sourcesOk: number; candidates: number; selected: number; aiWritten?: number };
}

export interface ArchiveEntry {
  date: string;
  edition: number;
  headline: string;
  items: number;
}

export interface ArchiveIndex {
  updatedAt: string;
  editions: ArchiveEntry[]; // newest first
}
