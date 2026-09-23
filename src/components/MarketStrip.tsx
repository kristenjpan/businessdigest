import type { MarketSeries } from "../../pipeline/types";
import { formatChange, formatValue, shortDate, sparkPoints } from "../lib/format";

const HINTS: Record<string, string> = {
  SP500: "Large U.S. stocks",
  DGS10: "Long-term borrowing cost",
  DGS2: "Expected Fed path",
  T10Y2Y: "Below 0 = inverted",
  VIXCLS: "Expected volatility",
  BAMLH0A0HYM2: "Risky-debt premium",
  DFF: "Fed policy rate",
};

/**
 * Color by meaning: stocks up is good (green); volatility and credit spreads up is a warning (red);
 * interest rates have no "good" direction, so they stay neutral.
 */
const POLARITY: Record<string, 1 | -1 | 0> = { SP500: 1, VIXCLS: -1, BAMLH0A0HYM2: -1 };

export function MarketStrip({ market }: { market: MarketSeries[] }) {
  if (!market.length) return null;
  const asOf = market.map((m) => m.asOf).sort().at(-1)!;
  return (
    <section aria-labelledby="market-heading" className="mt-6">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id="market-heading" className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
          Market snapshot
        </h2>
        <a href="https://fred.stlouisfed.org/" target="_blank" rel="noreferrer" className="text-[12px] text-muted hover:text-ink">
          FRED · as of {shortDate(asOf)}
        </a>
      </div>
      <ul className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-7">
        {market.map((m) => (
          <MarketTile key={m.id} m={m} />
        ))}
      </ul>
    </section>
  );
}

function MarketTile({ m }: { m: MarketSeries }) {
  const change = formatChange(m);
  const values = m.history?.map((p) => p.value) ?? [];
  const first = values[0];
  const last = values.at(-1);
  const trendUp = first !== undefined && last !== undefined && last >= first;
  const polarity = POLARITY[m.id] ?? 0;
  const tone = (dir: "up" | "down" | "flat") =>
    dir === "flat" || polarity === 0 ? "text-muted" : (dir === "up") === (polarity === 1) ? "text-up" : "text-down";

  return (
    <li className="w-[150px] shrink-0 snap-start rounded-lg border border-rule bg-surface px-3 py-2.5 sm:w-auto">
      <a href={m.sourceUrl} target="_blank" rel="noreferrer" className="block" title={HINTS[m.id]}>
        <p className="truncate text-[12px] font-medium text-muted">{m.label}</p>
        <div className="mt-0.5 flex items-baseline justify-between gap-2">
          <span className="tabular text-[17px] font-semibold text-ink">{formatValue(m)}</span>
          {change && <span className={`tabular text-[12px] font-medium ${tone(change.direction)}`}>{change.text}</span>}
        </div>
        {values.length > 2 && (
          <svg viewBox="0 0 120 26" className="mt-1.5 h-[26px] w-full" preserveAspectRatio="none" aria-hidden>
            <polyline
              points={sparkPoints(values, 120, 26)}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
              className={polarity === 0 ? "text-accent" : tone(trendUp ? "up" : "down")}
            />
          </svg>
        )}
        <p className="mt-1 truncate text-[11px] text-muted">{HINTS[m.id] ?? ""}</p>
      </a>
    </li>
  );
}
