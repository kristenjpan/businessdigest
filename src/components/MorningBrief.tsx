import type { Digest } from "../../pipeline/types";

interface Props {
  digest: Digest;
  activeTheme: string | null;
  onTheme: (id: string | null) => void;
}

export function MorningBrief({ digest, activeTheme, onTheme }: Props) {
  const { brief } = digest;
  return (
    <section aria-labelledby="brief-heading" className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div className="rounded-xl border border-rule bg-surface p-5 sm:p-7">
        <p id="brief-heading" className="text-[12px] font-semibold uppercase tracking-[0.16em] text-accent">
          The Morning Brief
        </p>
        <h2 className="font-display mt-2 text-[26px] leading-tight font-semibold text-ink sm:text-[32px]">{brief.headline}</h2>
        <ul className="mt-5 space-y-3">
          {brief.bullets.map((b, i) => {
            const idx = b.indexOf(": ");
            const label = idx > 0 ? b.slice(0, idx) : null;
            const text = idx > 0 ? b.slice(idx + 2) : b;
            return (
              <li key={i} className="grid grid-cols-[22px_1fr] gap-2 text-[15px] leading-relaxed text-ink-soft">
                <span aria-hidden className="tabular pt-px text-[13px] font-semibold text-brass">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  {label && <strong className="font-semibold text-ink">{label}: </strong>}
                  {text}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-col gap-6">
        <div className="rounded-xl border border-rule bg-surface-muted p-5 sm:p-6">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">Market read</p>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{brief.marketRead}</p>
        </div>
        {brief.themes.length > 0 && (
          <div className="rounded-xl border border-rule bg-surface p-5 sm:p-6">
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">Themes today</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {brief.themes.map((t) => {
                const active = activeTheme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onTheme(active ? null : t.id)}
                    className={`print-hidden rounded-full border px-3 py-1 text-[13px] font-medium transition-colors ${
                      active ? "border-accent bg-accent text-accent-ink" : "border-rule text-ink-soft hover:border-rule-strong hover:bg-surface-muted"
                    }`}
                  >
                    {t.label} <span className="tabular opacity-70">{t.count}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-[12px] text-muted">Tap a theme to filter the stories below.</p>
          </div>
        )}
      </div>
    </section>
  );
}
