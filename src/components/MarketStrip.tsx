import { useEffect, useRef, useState } from "react";
import { termSlug } from "../../pipeline/enrich/glossary";
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

/** Plain-English explanation for each tile, and the Glossary term that goes deeper. */
const EXPLAIN: Record<string, { text: string; term?: string }> = {
  SP500: { text: "The S&P 500 tracks 500 large U.S. companies. It's the standard gauge of how the U.S. stock market is doing." },
  DGS10: {
    text: "What the U.S. government pays to borrow for 10 years. It sets the tone for mortgage rates, corporate borrowing and how investors value assets.",
    term: "Treasury yield",
  },
  DGS2: {
    text: "What the U.S. government pays to borrow for 2 years. It moves closely with where investors expect the Fed to set rates.",
    term: "Treasury yield",
  },
  T10Y2Y: {
    text: "The 10-year yield minus the 2-year yield. Above zero is normal; below zero, an \"inverted\" curve, has often come before recessions.",
    term: "Yield curve",
  },
  VIXCLS: {
    text: "Wall Street's \"fear gauge\": how much stocks are expected to swing over the next month. Below about 15 is calm; above about 20 signals nerves.",
    term: "Volatility (VIX)",
  },
  BAMLH0A0HYM2: {
    text: "The extra interest riskier companies pay to borrow compared with the U.S. government. Wider means lenders are nervous; tighter means credit is easy to get.",
    term: "High-yield spread",
  },
  DFF: {
    text: "The overnight interest rate the Federal Reserve targets. It drives borrowing costs across the economy, including floating-rate private loans.",
    term: "Fed funds rate",
  },
};

const BP_NOTE = "bp means basis point, one hundredth of a percentage point. +6 bp means the rate rose by 0.06 percentage points.";

/**
 * Color by meaning: stocks up is good (green); volatility and credit spreads up is a warning (red);
 * interest rates have no "good" direction, so they stay neutral.
 */
const POLARITY: Record<string, 1 | -1 | 0> = { SP500: 1, VIXCLS: -1, BAMLH0A0HYM2: -1 };

export function MarketStrip({ market }: { market: MarketSeries[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close the explainer with Esc or a click anywhere outside it and its ⓘ buttons.
  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenId(null);
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!panelRef.current?.contains(t) && !t.closest("[data-explain-button]")) setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [openId]);

  if (!market.length) return null;
  const asOf = market.map((m) => m.asOf).sort().at(-1)!;
  const open = market.find((m) => m.id === openId);
  const info = open ? EXPLAIN[open.id] : undefined;

  return (
    <section aria-labelledby="market-heading" className="mt-6">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="market-heading" className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
          Market snapshot
        </h2>
        <span className="text-[12px] text-muted">
          <a href="#/glossary" className="font-medium text-accent hover:underline">
            What do these mean? Glossary →
          </a>
          <span aria-hidden> · </span>
          <a href="https://fred.stlouisfed.org/" target="_blank" rel="noreferrer" className="hover:text-ink">
            FRED · as of {shortDate(asOf)}
          </a>
        </span>
      </div>
      <ul className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-7">
        {market.map((m) => (
          <MarketTile key={m.id} m={m} open={openId === m.id} onExplain={() => setOpenId((id) => (id === m.id ? null : m.id))} />
        ))}
      </ul>
      {open && info && (
        <div
          ref={panelRef}
          id="market-explain"
          role="region"
          aria-label={`About ${open.label}`}
          className="mt-2 rounded-lg border border-accent/40 bg-accent-soft px-4 py-3 text-[14px] leading-relaxed text-ink"
        >
          <div className="flex items-start justify-between gap-3">
            <p>
              <strong className="font-semibold">{open.label}:</strong> {info.text}
            </p>
            <button type="button" onClick={() => setOpenId(null)} aria-label="Close" className="-mt-1 -mr-1 rounded p-1 text-muted hover:text-ink">
              ×
            </button>
          </div>
          {open.unit === "percent" && (
            <p className="mt-1 text-[13px] text-ink-soft">
              {BP_NOTE}{" "}
              <a href={`#/glossary/${termSlug("Basis point")}`} className="font-medium text-accent hover:underline">
                Basis point →
              </a>
            </p>
          )}
          {info.term && (
            <a href={`#/glossary/${termSlug(info.term)}`} className="mt-1 inline-block text-[13px] font-semibold text-accent hover:underline">
              More in the Glossary: {info.term} →
            </a>
          )}
        </div>
      )}
    </section>
  );
}

function MarketTile({ m, open, onExplain }: { m: MarketSeries; open: boolean; onExplain: () => void }) {
  const change = formatChange(m);
  const values = m.history?.map((p) => p.value) ?? [];
  const first = values[0];
  const last = values.at(-1);
  const trendUp = first !== undefined && last !== undefined && last >= first;
  const polarity = POLARITY[m.id] ?? 0;
  const tone = (dir: "up" | "down" | "flat") =>
    dir === "flat" || polarity === 0 ? "text-muted" : (dir === "up") === (polarity === 1) ? "text-up" : "text-down";

  return (
    <li className={`relative w-[150px] shrink-0 snap-start rounded-lg border bg-surface px-3 py-2.5 sm:w-auto ${open ? "border-accent" : "border-rule"}`}>
      <button
        type="button"
        data-explain-button
        onClick={onExplain}
        aria-expanded={open}
        aria-controls="market-explain"
        aria-label={`What is ${m.label}?`}
        className="absolute top-1.5 right-1.5 grid h-5 w-5 place-items-center rounded-full text-[11px] font-semibold text-muted hover:bg-surface-muted hover:text-ink"
      >
        <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="6.25" />
          <path d="M8 7.25v4M8 4.9v.01" strokeLinecap="round" />
        </svg>
      </button>
      <a href={m.sourceUrl} target="_blank" rel="noreferrer" className="block" title={HINTS[m.id]}>
        <p className="truncate pr-5 text-[12px] font-medium text-muted">{m.label}</p>
        <div className="mt-0.5 flex items-baseline justify-between gap-2">
          <span className="tabular text-[17px] font-semibold text-ink">{formatValue(m)}</span>
          {change && (
            <span
              className={`tabular text-[12px] font-medium ${tone(change.direction)} ${m.unit === "percent" ? "underline decoration-dotted underline-offset-2" : ""}`}
              title={m.unit === "percent" ? BP_NOTE : undefined}
            >
              {change.text}
            </span>
          )}
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
