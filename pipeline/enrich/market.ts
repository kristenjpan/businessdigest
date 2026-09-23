import type { MarketSeries } from "../types";

/**
 * Turns the FRED snapshot into plain-English fragments ("the 10-year Treasury yield is 4.12%,
 * up 3 bps") and regime labels. Every number here comes straight from FRED — nothing is invented.
 */

export type Regime = "calm" | "normal" | "elevated" | "stressed";

export function vixRegime(v: number): Regime {
  if (v < 13) return "calm";
  if (v < 20) return "normal";
  if (v < 30) return "elevated";
  return "stressed";
}

export function hyRegime(spread: number): Regime {
  if (spread < 3) return "calm"; // historically tight
  if (spread < 4.5) return "normal";
  if (spread < 6) return "elevated";
  return "stressed";
}

const VIX_WORDS: Record<Regime, string> = {
  calm: "a very calm reading",
  normal: "a normal-volatility reading",
  elevated: "an elevated reading that signals nervous markets",
  stressed: "a stressed reading typical of market sell-offs",
};

const HY_WORDS: Record<Regime, string> = {
  calm: "historically tight",
  normal: "near long-run norms",
  elevated: "wider than normal",
  stressed: "at stressed levels",
};

export function formatValue(s: Pick<MarketSeries, "unit" | "value">): string {
  return s.unit === "percent" ? `${s.value.toFixed(2)}%` : s.value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** "up 3 bps", "down 0.4%", "unchanged" — bps for rates, % for index levels. */
export function describeMove(s: Pick<MarketSeries, "unit" | "value" | "previous">): string {
  if (s.previous === null) return "";
  if (s.unit === "percent") {
    const bps = Math.round((s.value - s.previous) * 100);
    if (bps === 0) return "unchanged";
    return `${bps > 0 ? "up" : "down"} ${Math.abs(bps)} bp${Math.abs(bps) === 1 ? "" : "s"}`;
  }
  const pct = ((s.value - s.previous) / s.previous) * 100;
  if (Math.abs(pct) < 0.05) return "roughly unchanged";
  return `${pct > 0 ? "up" : "down"} ${Math.abs(pct).toFixed(1)}%`;
}

function withMove(base: string, s: MarketSeries): string {
  const move = describeMove(s);
  return move ? `${base} (${move} on the prior reading)` : base;
}

export function shortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export class MarketView {
  private byId: Map<string, MarketSeries>;
  constructor(readonly series: MarketSeries[]) {
    this.byId = new Map(series.map((s) => [s.id, s]));
  }

  get empty() {
    return this.series.length === 0;
  }
  get(id: string) {
    return this.byId.get(id);
  }
  /** Latest FRED date across the snapshot, e.g. "Sep 22". */
  get asOf(): string | null {
    const d = this.series.map((s) => s.asOf).sort().at(-1);
    return d ? shortDate(d) : null;
  }

  get vix() {
    const s = this.get("VIXCLS");
    return s ? { value: s.value, regime: vixRegime(s.value), text: `the VIX is ${s.value.toFixed(1)}, ${VIX_WORDS[vixRegime(s.value)]}` } : null;
  }
  get hy() {
    const s = this.get("BAMLH0A0HYM2");
    return s ? { value: s.value, regime: hyRegime(s.value), text: withMove(`high-yield credit spreads are ${formatValue(s)}, ${HY_WORDS[hyRegime(s.value)]}`, s) } : null;
  }
  get tenYear() {
    const s = this.get("DGS10");
    return s ? { value: s.value, text: withMove(`the 10-year Treasury yield is ${formatValue(s)}`, s), rising: s.previous !== null && s.value > s.previous } : null;
  }
  get twoYear() {
    const s = this.get("DGS2");
    return s ? { value: s.value, text: `the 2-year yield is ${formatValue(s)}` } : null;
  }
  get fedFunds() {
    const s = this.get("DFF");
    return s ? { value: s.value, text: `the effective fed funds rate is ${formatValue(s)}` } : null;
  }
  get curve() {
    const s = this.get("T10Y2Y");
    if (!s) return null;
    const shape = s.value < 0 ? "inverted" : s.value < 0.25 ? "nearly flat" : "positively sloped";
    return { value: s.value, shape, text: `the 10Y–2Y yield curve is ${s.value >= 0 ? "+" : ""}${s.value.toFixed(2)} pts (${shape})` };
  }
  get sp500() {
    const s = this.get("SP500");
    return s ? { value: s.value, text: withMove(`the S&P 500 stands at ${formatValue(s)}`, s), move: describeMove(s) } : null;
  }

  /** Overall risk tone from volatility and credit spreads. */
  get tone(): "risk-on" | "risk-off" | "mixed" | null {
    const regimes = [this.vix?.regime, this.hy?.regime].filter((r): r is Regime => Boolean(r));
    if (!regimes.length) return null;
    const stressed = regimes.filter((r) => r === "elevated" || r === "stressed").length;
    if (stressed === 0) return "risk-on";
    return stressed === regimes.length ? "risk-off" : "mixed";
  }
}

export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Joins non-empty fragments into one sentence: "A, B and C." */
export function sentence(parts: (string | null | undefined | false)[]): string | null {
  const p = parts.filter((x): x is string => Boolean(x));
  if (!p.length) return null;
  const body = p.length === 1 ? p[0] : `${p.slice(0, -1).join(", ")} and ${p.at(-1)}`;
  return `${cap(body)}.`;
}
