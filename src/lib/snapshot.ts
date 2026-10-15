import type { DigestItem, SectionId } from "../../pipeline/types";

/**
 * The section-by-section snapshot that structures Today: per section, one lead story, two short
 * headlines and a one-line summary. Built in the browser from each edition's stories, which the
 * pipeline already stores in importance order within each section, so the first story is the lead.
 * Works for archived editions too, with no change to the data.
 */

export interface SectionSnapshot {
  id: SectionId;
  label: string;
  lead: DigestItem;
  headlines: DigestItem[];
  total: number;
  summary: string;
}

const LEAD_PLUS = 2; // short headlines after the lead

/** Readable phrases for the themes the rules engine assigns (pipeline/enrich/themes.ts). */
const THEME_PHRASE: Record<string, string> = {
  fundraising: "fundraising",
  deals: "deals and buyouts",
  "private-credit": "private credit",
  exits: "exits and secondaries",
  "real-estate": "real estate",
  infrastructure: "infrastructure and energy",
  earnings: "earnings and asset flows",
  rates: "the Fed and rates",
  regulation: "regulation and policy",
  "hedge-funds": "hedge fund moves",
  holdings: "13F positioning",
  "family-office": "family-office and wealth news",
  people: "leadership changes",
  "ai-tech": "AI and technology",
  insurance: "insurance and retirement capital",
  macro: "macro and geopolitics",
  voices: "investor interviews",
  "private-markets": "private-markets news",
  markets: "market moves",
  disclosure: "company filings",
};

function phraseFor(item: DigestItem): string {
  return THEME_PHRASE[item.theme.id] ?? item.theme.label.toLowerCase();
}

/** Quotes a headline as a sentence ending: “Title.” (no doubled punctuation). */
function quoted(title: string): string {
  const t = title.trim();
  return /[.!?…]$/.test(t) ? `“${t}”` : `“${t}.”`;
}

/** The catch-all theme each section falls back to; naming it would just repeat the section title. */
const SECTION_THEME: Partial<Record<SectionId, string>> = {
  markets: "markets",
  "private-markets": "private-markets",
  "family-offices": "family-office",
  "hedge-funds": "hedge-funds",
  voices: "voices",
  filings: "disclosure",
};

/**
 * One-line gist of a section, built only from its own stories:
 * "Private Equity today: mostly deals and buyouts, led by “Apollo’s … opposition.”"
 * Themes that merely restate the section ("Hedge Funds today: mostly hedge fund moves") are skipped.
 */
export function sectionSummary(label: string, items: DigestItem[], section?: SectionId): string {
  const lead = items[0];
  if (!lead) return "";
  const led = `led by ${quoted(lead.title)}`;
  if (items.length === 1) return `${label} today: ${led}`;

  const restates = section ? SECTION_THEME[section] : undefined;
  const counts = new Map<string, { phrase: string; n: number; firstIndex: number }>();
  items.forEach((item, i) => {
    if (item.theme.id === restates) return;
    const c = counts.get(item.theme.id) ?? { phrase: phraseFor(item), n: 0, firstIndex: i };
    c.n++;
    counts.set(item.theme.id, c);
  });
  // Most common first; ties go to the theme that appears earliest (the more important story).
  const [top, second] = [...counts.values()].sort((a, b) => b.n - a.n || a.firstIndex - b.firstIndex);
  if (!top) return `${label} today: ${led}`;
  const gist =
    top.n * 2 >= items.length
      ? `mostly ${top.phrase}`
      : second
        ? `a mix of ${top.phrase} and ${second.phrase}`
        : `${top.phrase} in focus`;
  return `${label} today: ${gist}, ${led}`;
}

/** Per section (in the given order, empty sections skipped): lead, two headlines, total, summary. */
export function sectionSnapshots(items: DigestItem[], sections: readonly { id: SectionId; label: string }[]): SectionSnapshot[] {
  return sections.flatMap((s) => {
    const inSection = items.filter((i) => i.section === s.id);
    if (!inSection.length) return [];
    return [
      {
        id: s.id,
        label: s.label,
        lead: inSection[0],
        headlines: inSection.slice(1, 1 + LEAD_PLUS),
        total: inSection.length,
        summary: sectionSummary(s.label, inSection, s.id),
      },
    ];
  });
}

/** The 60-Second Version: one line per section naming its single biggest story. */
export function sixtySecondVersion(snapshots: SectionSnapshot[]): { id: SectionId; label: string; headline: string; storyId: string }[] {
  return snapshots.map((s) => ({ id: s.id, label: s.label, headline: s.lead.title, storyId: s.lead.id }));
}
