import { useMemo, useState } from "react";
import { CORE_FIRMS, SECTIONS, type Digest, type DigestItem, type SectionId, type StoryType } from "../../pipeline/types";
import { publishedLabel, STORY_TYPE_LABEL, STORY_TYPES, storyTypeOf } from "../lib/format";
import { DigestCard } from "./DigestCard";
import { MarketStrip } from "./MarketStrip";
import { MorningBrief } from "./MorningBrief";

interface Filters {
  section: SectionId | "all";
  firm: string;
  type: StoryType | "";
  theme: string | null;
  q: string;
}

const EMPTY: Filters = { section: "all", firm: "", type: "", theme: null, q: "" };

function matches(item: DigestItem, f: Filters): boolean {
  if (f.section !== "all" && item.section !== f.section) return false;
  if (f.firm && !item.firms.includes(f.firm)) return false;
  if (f.type && storyTypeOf(item) !== f.type) return false;
  if (f.theme && item.theme.id !== f.theme) return false;
  if (f.q) {
    const hay = `${item.title} ${item.takeaway} ${item.whyItMatters} ${item.source.name} ${item.firms.join(" ")} ${item.theme.label}`.toLowerCase();
    if (!f.q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w))) return false;
  }
  return true;
}

function scrollToItem(id: string) {
  const el = document.getElementById(`item-${id}`);
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
  el?.querySelector<HTMLAnchorElement>("h3 a")?.focus({ preventScroll: true });
}

export function DigestView({ digest, archived }: { digest: Digest; archived?: boolean }) {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const active = JSON.stringify(filters) !== JSON.stringify(EMPTY);

  const visible = useMemo(() => digest.items.filter((i) => matches(i, filters)), [digest.items, filters]);
  const byId = useMemo(() => new Map(digest.items.map((i) => [i.id, i])), [digest.items]);
  const tops = (digest.topStoryIds ?? []).map((id) => byId.get(id)).filter((i): i is DigestItem => Boolean(i));

  const sectionCounts = useMemo(() => {
    const m = new Map<SectionId, number>();
    for (const i of digest.items) m.set(i.section, (m.get(i.section) ?? 0) + 1);
    return m;
  }, [digest.items]);

  const firms = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of digest.items) for (const f of i.firms) m.set(f, (m.get(f) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => Number(CORE_FIRMS.includes(b[0])) - Number(CORE_FIRMS.includes(a[0])) || b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [digest.items]);

  const types = useMemo(() => {
    const present = new Set(digest.items.map(storyTypeOf));
    return STORY_TYPES.filter((t) => present.has(t));
  }, [digest.items]);

  return (
    <>
      <MarketStrip market={digest.market} />
      <MorningBrief digest={digest} activeTheme={filters.theme} onTheme={(theme) => set({ theme })} />

      {tops.length > 0 && (
        <section aria-labelledby="top-heading" className="mt-10">
          <h2 id="top-heading" className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
            Top stories
          </h2>
          <ol className="mt-3 grid gap-4 md:grid-cols-3">
            {tops.map((t, n) => (
              <li key={t.id} data-section={t.section} className="flex">
                <button
                  type="button"
                  onClick={() => {
                    setFilters(EMPTY);
                    requestAnimationFrame(() => scrollToItem(t.id));
                  }}
                  className="group flex w-full flex-col rounded-xl border border-rule bg-surface p-5 text-left transition-colors hover:border-rule-strong"
                >
                  <span className="flex items-center gap-2 text-[12px] font-semibold">
                    <span className="font-display sec-text text-[28px] leading-none">{n + 1}</span>
                    <span className="sec-text">{SECTIONS.find((s) => s.id === t.section)?.label}</span>
                  </span>
                  <span className="font-display mt-3 text-[18px] leading-snug font-semibold text-ink group-hover:underline">{t.title}</span>
                  <span className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-ink-soft">{t.takeaway}</span>
                  <span className="mt-auto pt-3 text-[12px] text-muted">
                    {t.source.name} · {publishedLabel(t.publishedAt)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="mt-10 lg:grid lg:grid-cols-[1fr_260px] lg:gap-10">
        <div className="min-w-0">
          <div className="print-hidden z-10 -mx-4 border-b sm:sticky sm:top-0 border-rule bg-paper/95 px-4 pt-3 pb-3 backdrop-blur sm:mx-0 sm:px-0">
            <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Sections">
              <SectionTab label="All" count={digest.items.length} active={filters.section === "all"} onClick={() => set({ section: "all" })} />
              {SECTIONS.filter((s) => sectionCounts.get(s.id)).map((s) => (
                <SectionTab
                  key={s.id}
                  section={s.id}
                  label={s.label}
                  count={sectionCounts.get(s.id) ?? 0}
                  active={filters.section === s.id}
                  onClick={() => set({ section: s.id })}
                />
              ))}
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_auto_auto]">
              <label className="col-span-2 sm:col-span-1">
                <span className="sr-only">Search stories</span>
                <input
                  type="search"
                  value={filters.q}
                  onChange={(e) => set({ q: e.target.value })}
                  placeholder="Search stories, firms, themes…"
                  className="w-full rounded-lg border border-rule bg-surface px-3 py-2 text-[14px] text-ink placeholder:text-muted focus:border-accent focus:outline-none"
                />
              </label>
              <select
                value={filters.firm}
                onChange={(e) => set({ firm: e.target.value })}
                aria-label="Filter by firm"
                className="min-w-0 rounded-lg border border-rule bg-surface px-2.5 py-2 text-[14px] text-ink"
              >
                <option value="">All firms</option>
                {firms.map(([f, n]) => (
                  <option key={f} value={f}>
                    {f} ({n})
                  </option>
                ))}
              </select>
              <select
                value={filters.type}
                onChange={(e) => set({ type: e.target.value as StoryType | "" })}
                aria-label="Filter by story type"
                className="min-w-0 rounded-lg border border-rule bg-surface px-2.5 py-2 text-[14px] text-ink"
              >
                <option value="">All story types</option>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {STORY_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            {active && (
              <p className="mt-2 flex items-center justify-between text-[13px] text-muted" aria-live="polite">
                <span>
                  Showing {visible.length} of {digest.items.length} stories
                  {filters.theme && ` · theme: ${digest.items.find((i) => i.theme.id === filters.theme)?.theme.label}`}
                </span>
                <button type="button" onClick={() => setFilters(EMPTY)} className="font-medium text-accent hover:underline">
                  Clear filters
                </button>
              </p>
            )}
          </div>

          {visible.length === 0 ? (
            <p className="py-16 text-center text-muted">No stories match these filters.</p>
          ) : (
            SECTIONS.map((s) => {
              const items = visible.filter((i) => i.section === s.id);
              if (!items.length) return null;
              return (
                <section key={s.id} data-section={s.id} aria-labelledby={`sec-${s.id}`} className="mt-8 scroll-mt-40" id={`section-${s.id}`}>
                  <h2 id={`sec-${s.id}`} className="flex items-center gap-3">
                    <span aria-hidden className="sec-bg h-2.5 w-2.5 rounded-sm" />
                    <span className="font-display text-[22px] font-semibold text-ink">{s.label}</span>
                    <span className="tabular text-[13px] text-muted">{items.length}</span>
                    <span aria-hidden className="h-px flex-1 bg-rule" />
                  </h2>
                  <div className="mt-4 space-y-4">
                    {items.map((item) => (
                      <div key={item.id} id={`item-${item.id}`} className="scroll-mt-44">
                        <DigestCard item={item} onFirm={(firm) => set({ firm })} />
                      </div>
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </div>

        <aside className="print-hidden mt-10 lg:mt-0" aria-label="About this edition">
          <div className="space-y-6 lg:sticky lg:top-6">
            <div className="rounded-xl border border-rule bg-surface p-5">
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">In this edition</p>
              <dl className="mt-3 grid grid-cols-2 gap-3">
                <Stat label="Stories" value={digest.items.length} />
                <Stat label="Sources checked" value={digest.stats.sourcesChecked} />
                <Stat label="Candidates" value={digest.stats.candidates} />
                <Stat label="Edition" value={`#${digest.edition}`} />
              </dl>
              <ul className="mt-4 space-y-1.5 border-t border-rule pt-3">
                {SECTIONS.filter((s) => sectionCounts.get(s.id)).map((s) => (
                  <li key={s.id} data-section={s.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setFilters(EMPTY);
                        requestAnimationFrame(() => document.getElementById(`section-${s.id}`)?.scrollIntoView({ behavior: "smooth" }));
                      }}
                      className="flex w-full items-center gap-2 text-left text-[14px] text-ink-soft hover:text-ink"
                    >
                      <span aria-hidden className="sec-bg h-2 w-2 rounded-sm" />
                      <span className="flex-1">{s.label}</span>
                      <span className="tabular text-muted">{sectionCounts.get(s.id)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {firms.length > 0 && (
              <div className="rounded-xl border border-rule bg-surface p-5">
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">Firms in the news</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {firms.map(([f, n]) => (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={filters.firm === f}
                      onClick={() => set({ firm: filters.firm === f ? "" : f })}
                      className={`rounded-md border px-2 py-0.5 text-[12px] font-medium ${
                        filters.firm === f ? "border-accent bg-accent text-accent-ink" : "border-rule text-ink-soft hover:bg-surface-muted"
                      }`}
                    >
                      {f} <span className="tabular opacity-60">{n}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!archived && (
              <p className="px-1 text-[12px] leading-relaxed text-muted">
                Updated automatically every morning from public feeds, SEC EDGAR and FRED. Takeaways are written by AI from each
                publisher's own excerpt, with automatic checks and a rule-based fallback. <a href="#/about" className="underline hover:text-ink">How it works →</a>
              </p>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

function SectionTab({ label, count, active, onClick, section }: { label: string; count: number; active: boolean; onClick: () => void; section?: SectionId }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-section={section}
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
        active ? "border-ink bg-ink text-paper" : "border-rule bg-surface text-ink-soft hover:border-rule-strong"
      }`}
    >
      {section && <span aria-hidden className="sec-bg h-2 w-2 rounded-sm" />}
      {label}
      <span className="tabular opacity-60">{count}</span>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="tabular font-display text-[22px] font-semibold text-ink">{value}</dd>
    </div>
  );
}
