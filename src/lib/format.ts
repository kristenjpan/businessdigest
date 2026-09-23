import type { ContentType, MarketSeries } from "../../pipeline/types";

const TZ = "America/New_York";

/** "Wednesday, September 23, 2026" from a YYYY-MM-DD edition date. */
export function longDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function shortDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** "Sep 22 · 6:00 AM ET" */
export function publishedLabel(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: TZ });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ });
  return `${day} · ${time} ET`;
}

export function generatedLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ, timeZoneName: "short" });
}

export function formatValue(m: MarketSeries): string {
  return m.unit === "percent"
    ? `${m.value.toFixed(2)}%`
    : m.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Rates move in basis points; indices in percent. */
export function formatChange(m: MarketSeries): { text: string; direction: "up" | "down" | "flat" } | null {
  if (m.previous === null) return null;
  const diff = m.value - m.previous;
  if (m.unit === "percent") {
    const bps = Math.round(diff * 100);
    return { text: `${bps > 0 ? "+" : bps < 0 ? "−" : "±"}${Math.abs(bps)} bp`, direction: bps > 0 ? "up" : bps < 0 ? "down" : "flat" };
  }
  const pct = (diff / m.previous) * 100;
  const rounded = Math.abs(pct) < 0.005 ? 0 : pct;
  return {
    text: `${rounded > 0 ? "+" : rounded < 0 ? "−" : "±"}${Math.abs(rounded).toFixed(2)}%`,
    direction: rounded > 0 ? "up" : rounded < 0 ? "down" : "flat",
  };
}

export const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  news: "News",
  "press-release": "Press release",
  podcast: "Podcast",
  filing: "SEC filing",
  regulator: "Regulator",
  research: "Research",
};

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** "3h ago", "2d ago" relative to the edition's generation time. */
export function ageLabel(iso: string, from: string): string {
  const hours = Math.max(0, (Date.parse(from) - Date.parse(iso)) / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** SVG polyline points for a sparkline scaled into a width × height box. */
export function sparkPoints(values: number[], width: number, height: number, pad = 2): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (width - pad * 2);
      const y = pad + (1 - (v - min) / span) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
