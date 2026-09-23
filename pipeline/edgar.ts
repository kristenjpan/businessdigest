import { FetchBlockedError, politeFetch } from "./http";
import { itemId } from "./normalize";
import type { SourceResult } from "./fetchFeeds";
import type { EdgarSource } from "./sources";
import type { RawItem } from "./types";

/** Plain-English names for Form 8-K item codes (SEC Form 8-K General Instructions). */
export const EIGHT_K_ITEMS: Record<string, string> = {
  "1.01": "Entry into a material agreement",
  "1.02": "Termination of a material agreement",
  "1.05": "Material cybersecurity incident",
  "2.01": "Completed acquisition or disposition of assets",
  "2.02": "Results of operations (earnings)",
  "2.03": "New direct financial obligation (debt)",
  "2.04": "Triggering event accelerating an obligation",
  "2.05": "Exit or restructuring costs",
  "2.06": "Material impairment",
  "3.01": "Listing or delisting notice",
  "3.02": "Unregistered sale of equity",
  "3.03": "Change to shareholder rights",
  "4.01": "Change of auditor",
  "5.01": "Change in control",
  "5.02": "Director or officer change / compensation",
  "5.03": "Charter or bylaw amendment",
  "5.07": "Shareholder vote results",
  "7.01": "Regulation FD disclosure (investor communication)",
  "8.01": "Other material event",
  "9.01": "Financial statements and exhibits",
};

const FORM_DESCRIPTIONS: Record<string, string> = {
  "8-K": "a current report disclosing a material event",
  "10-Q": "the quarterly financial report",
  "10-K": "the annual report with audited financials",
  "13F-HR": "the quarterly report of U.S. equity holdings required of managers with over $100M in 13F securities",
  "13F-HR/A": "an amendment to a quarterly 13F holdings report",
};

export function describeItems(items: string): string[] {
  return items
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((code) => `${EIGHT_K_ITEMS[code] ?? "Item"} (Item ${code})`);
}

interface SubmissionsRecent {
  accessionNumber: string[];
  filingDate: string[];
  reportDate: string[];
  acceptanceDateTime: string[];
  form: string[];
  items: string[];
  primaryDocument: string[];
}

export function filingsToRaw(source: EdgarSource, recent: SubmissionsRecent, limit = 25): RawItem[] {
  const out: RawItem[] = [];
  for (let i = 0; i < recent.form.length && out.length < limit; i++) {
    const form = recent.form[i];
    if (!source.forms.includes(form)) continue;
    const acc = recent.accessionNumber[i];
    const url = `https://www.sec.gov/Archives/edgar/data/${source.cik}/${acc.replace(/-/g, "")}/${recent.primaryDocument[i]}`;
    const itemDescs = form === "8-K" ? describeItems(recent.items[i] ?? "") : [];
    const title =
      form === "8-K" && itemDescs.length
        ? `${source.company} 8-K: ${itemDescs.filter((d) => !d.includes("9.01")).map((d) => d.replace(/ \(Item.*\)$/, "")).join("; ") || "Financial statements and exhibits"}`
        : `${source.company} files Form ${form}${recent.reportDate[i] ? ` for period ending ${recent.reportDate[i]}` : ""}`;
    const excerptParts = [
      `${source.company} filed Form ${form} — ${FORM_DESCRIPTIONS[form] ?? "an SEC filing"} — with the SEC on ${recent.filingDate[i]}.`,
    ];
    if (itemDescs.length) excerptParts.push(`Items reported: ${itemDescs.join("; ")}.`);
    if (recent.reportDate[i] && form !== "8-K") excerptParts.push(`Reporting period: ${recent.reportDate[i]}.`);
    const accepted = recent.acceptanceDateTime[i] || `${recent.filingDate[i]}T12:00:00Z`;
    out.push({
      id: itemId(url, title),
      title,
      url,
      publishedAt: new Date(accepted).toISOString(),
      excerpt: excerptParts.join(" "),
      source: { id: source.id, name: source.name, homepage: source.homepage, contentType: source.contentType },
      tier: source.tier,
      firms: source.firms ?? [],
      section: source.section,
    });
  }
  return out;
}

export async function fetchEdgarSource(source: EdgarSource): Promise<SourceResult> {
  const result: SourceResult = { sourceId: source.id, ok: false, status: "", items: [], dropped: { paywalled: 0, excluded: 0, offTopic: 0 } };
  const url = `https://data.sec.gov/submissions/CIK${String(source.cik).padStart(10, "0")}.json`;
  try {
    const res = await politeFetch(url);
    result.status = res.fromCache ? "304 (cached)" : String(res.status);
    if (res.status !== 200 && res.status !== 304) return result;
    const json = JSON.parse(res.body) as { filings: { recent: SubmissionsRecent } };
    result.items = filingsToRaw(source, json.filings.recent);
    result.ok = true;
  } catch (err) {
    result.status = err instanceof FetchBlockedError ? "blocked by robots.txt" : `error: ${(err as Error).message}`;
  }
  return result;
}
