import { politeFetch } from "./http";
import { FRED_SERIES } from "./sources";
import type { MarketPoint, MarketSeries } from "./types";

const HISTORY_POINTS = 22; // about one trading month, for sparklines

/** Parses FRED's CSV (header row, then `date,value`; missing values are "." or empty). */
export function parseFredCsv(csv: string): MarketPoint[] {
  return csv
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split(","))
    .map(([date, value]) => ({ date: date?.trim(), raw: value?.trim() ?? "" }))
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.raw !== "" && Number.isFinite(Number(r.raw)))
    .map((r) => ({ date: r.date, value: Number(r.raw) }));
}

/** Public FRED CSV endpoint — no API key required. */
export async function fetchMarketSnapshot(today = new Date()): Promise<MarketSeries[]> {
  const start = new Date(today.getTime() - 45 * 86_400_000).toISOString().slice(0, 10);
  const out: MarketSeries[] = [];
  for (const s of FRED_SERIES) {
    const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${s.id}&cosd=${start}`;
    try {
      const res = await politeFetch(url);
      if (res.status !== 200 && res.status !== 304) {
        console.warn(`  FRED ${s.id}: HTTP ${res.status}`);
        continue;
      }
      const rows = parseFredCsv(res.body);
      const last = rows.at(-1);
      if (!last) continue;
      out.push({
        id: s.id,
        label: s.label,
        unit: s.unit,
        value: last.value,
        previous: rows.at(-2)?.value ?? null,
        asOf: last.date,
        history: rows.slice(-HISTORY_POINTS),
        sourceUrl: `https://fred.stlouisfed.org/series/${s.id}`,
      });
    } catch (err) {
      console.warn(`  FRED ${s.id}: ${(err as Error).message}`);
    }
  }
  return out;
}
