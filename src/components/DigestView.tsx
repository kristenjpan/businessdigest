import { useEffect, useMemo, useState } from "react";
import { CORE_FIRMS, SECTIONS, type Digest, type DigestItem, type SectionId, type StoryType } from "../../pipeline/types";
import { useAccount } from "../lib/account";
import { publishedLabel, splitBottomLine, STORY_TYPE_LABEL, STORY_TYPES, storyTypeOf } from "../lib/format";
import { hasPrefs, matchesPrefs, orderSections, type Prefs } from "../lib/personalize";
import { sectionSnapshots, sixtySecondVersion, type SectionSnapshot } from "../lib/snapshot";
import { DigestCard, StoryTypeBadge } from "./DigestCard";
import { MarketStrip } from "./MarketStrip";
import { SignInPreview } from "./SignInPreview";
import { SubscriptionsSection } from "./SubscriptionsSection";
import { WelcomeNote } from "./WelcomeNote";

interface Filters {
  section: SectionId | "all" | "foryou";
  firm: string;
  type: StoryType | "";
  q: string;
}

const EMPTY: Filters = { section: "all", firm: "", type: "", q: "" };

function matches(item: DigestItem, f: Filters, prefs: Prefs): boolean {
  if (f.section === "foryou") {
    if (!matchesPrefs(item, prefs)) return false;
  } else if (f.section !== "all" && item.section !== f.section) return false;
  if (f.firm && !item.firms.includes(f.firm)) return false;
  if (f.type && storyTypeOf(item) !== f.type) return false;
  if (f.q) {
    const hay = `${item.title} ${item.takeaway} ${item.whyItMatters} ${item.source.name} ${item.firms.join(" ")} ${item.theme.label}`.toLowerCase();
    if (!f.q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w))) return false;
  }
  return true;
}

export function DigestView({ digest, archived, onSignIn }: { digest: Digest; archived?: boolean; onSignIn?: () => void }) {
  const { prefs, authEnabled, ready, user } = useAccount();
  // Signed-out readers see a locked For you pill that opens sign-in, so they know it exists.
  const showLockedForYou = Boolean(onSignIn && authEnabled && ready && !user);
  const personalized = hasPrefs(prefs);
  // A reader's chosen sections lead the page; everyone else sees the usual order.
  const sections = useMemo(() => orderSections(SECTIONS, prefs), [prefs]);
  const forYouCount = useMemo(() => digest.items.filter((i) => matchesPrefs(i, prefs)).length, [digest.items, prefs]);
  const [rawFilters, setFilters] = useState<Filters>(EMPTY);
  // If preferences are cleared while "For you" is selected, fall back to All.
  const filters = rawFilters.section === "foryou" && !personalized ? { ...rawFilters, section: "all" as const } : rawFilters;
  // A link from Archive search names a story to jump to (…?story=<id>); open on All so it's visible.
  const storyParam = new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("story");
  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const resetFilters = () => setFilters(EMPTY);

  useEffect(() => {
    if (!storyParam) return;
    const t = window.setTimeout(() => {
      const el = document.getElementById(`item-${storyParam}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("story-highlight");
      window.setTimeout(() => el.classList.remove("story-highlight"), 2400);
    }, 150);
    return () => window.clearTimeout(t);
  }, [storyParam, digest.date]);
  const active = JSON.stringify(filters) !== JSON.stringify(EMPTY);
  // Snapshot (lead + two headlines per section) unless the reader filters, searches, picks a pill,
  // or arrives from an Archive search link, which needs every card on the page.
  const snapshotMode = !active && !storyParam;
  const snapshots = useMemo(() => sectionSnapshots(digest.items, sections), [digest.items, sections]);
  const marketLine = splitBottomLine(digest.brief.marketRead).bottomLine;

  const seeAll = (id: SectionId) => {
    set({ section: id });
    requestAnimationFrame(() => document.getElementById("section-filters")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const visible = useMemo(() => digest.items.filter((i) => matches(i, filters, prefs)), [digest.items, filters, prefs]);

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
      <div className="mx-auto max-w-4xl">
      {!archived && <WelcomeNote />}
      <MarketStrip market={digest.market} />
      {marketLine && (
        <p className="mt-3 flex items-start gap-2 text-[15px] leading-snug font-semibold text-ink">
          <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
          {marketLine}
        </p>
      )}

      <SixtySecondVersion snapshots={snapshots} />

      {!archived && onSignIn && <SignInPreview onSignIn={onSignIn} className="mt-6" />}

      <div className="mt-10">
        <div className="min-w-0">
          <div className="print-hidden z-10 -mx-4 border-b sm:sticky sm:top-0 border-rule bg-paper/95 px-4 pt-3 pb-3 backdrop-blur sm:mx-0 sm:px-0">
            <div
              id="section-filters"
              className="no-scrollbar -mx-4 flex scroll-mt-24 gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
              role="tablist"
              aria-label="Sections"
            >
              {showLockedForYou && (
                <button
                  type="button"
                  onClick={onSignIn}
                  title="Sign in to choose sections and firms"
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-rule-strong bg-surface px-3 py-1.5 text-[13px] font-medium text-muted hover:border-accent hover:text-ink"
                >
                  <svg aria-hidden viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
                    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
                  </svg>
                  For you
                  <span className="sr-only">(sign in to choose sections and firms)</span>
                </button>
              )}
              {personalized && (
                <SectionTab label="For you" count={forYouCount} active={filters.section === "foryou"} onClick={() => set({ section: "foryou" })} forYou />
              )}
              <SectionTab label="All" count={digest.items.length} active={filters.section === "all"} onClick={() => set({ section: "all" })} />
              {sections.filter((s) => sectionCounts.get(s.id)).map((s) => (
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
                </span>
                <button type="button" onClick={() => resetFilters()} className="font-medium text-accent hover:underline">
                  Clear filters
                </button>
              </p>
            )}
          </div>

          {snapshotMode ? (
            snapshots.map((snap) => (
              <SectionBlock key={snap.id} snap={snap} editionDate={digest.date} onFirm={(firm) => set({ firm })} onSeeAll={() => seeAll(snap.id)} />
            ))
          ) : visible.length === 0 ? (
            <p className="py-16 text-center text-muted">No stories match these filters.</p>
          ) : (
            sections.map((s) => {
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
                        <DigestCard item={item} editionDate={digest.date} onFirm={(firm) => set({ firm })} />
                      </div>
                    ))}
                  </div>
                </section>
              );
            })
          )}

          {/* Subscriber headlines sit after the reader's stories, filtered to what they follow. */}
          {!archived && <SubscriptionsSection />}
        </div>

      </div>
      </div>
    </>
  );
}

function SectionTab({
  label,
  count,
  active,
  onClick,
  section,
  forYou,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  section?: SectionId;
  forYou?: boolean;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-section={section}
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
        active
          ? "border-ink bg-ink text-paper"
          : forYou
            ? "border-accent bg-accent-soft text-ink hover:border-accent"
            : "border-rule bg-surface text-ink-soft hover:border-rule-strong"
      }`}
    >
      {section && <span aria-hidden className="sec-bg h-2 w-2 rounded-sm" />}
      {forYou && (
        <svg aria-hidden viewBox="0 0 16 16" className="h-3 w-3 text-accent" fill="currentColor">
          <path d="M8 1.5l1.9 4 4.4.5-3.3 3 .9 4.4L8 11.2l-3.9 2.2.9-4.4-3.3-3 4.4-.5Z" />
        </svg>
      )}
      {label}
      <span className="tabular opacity-60">{count}</span>
    </button>
  );
}

/** The 60-Second Version: one line per section naming its single biggest story. */
function SixtySecondVersion({ snapshots }: { snapshots: SectionSnapshot[] }) {
  const lines = sixtySecondVersion(snapshots);
  if (!lines.length) return null;
  return (
    <section id="sixty-second" aria-labelledby="sixty-heading" className="mt-6 scroll-mt-6 rounded-xl border border-rule bg-surface p-5 sm:p-6">
      <h2 id="sixty-heading" className="text-[12px] font-semibold uppercase tracking-[0.16em] text-accent">
        The 60-Second Version
      </h2>
      <ul className="mt-3 space-y-2.5">
        {lines.map((l) => (
          <li key={l.id} data-section={l.id}>
            <button
              type="button"
              onClick={() => document.getElementById(`section-${l.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="grid w-full grid-cols-[10px_1fr] items-baseline gap-2.5 text-left text-[15px] leading-snug text-ink-soft hover:text-ink"
            >
              <span aria-hidden className="sec-bg h-2 w-2 translate-y-[-1px] rounded-sm" />
              <span>
                <strong className="font-semibold text-ink">{l.label}:</strong> {l.headline}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One section in snapshot mode: summary line, lead story card, two short headlines, See all. */
function SectionBlock({
  snap,
  editionDate,
  onFirm,
  onSeeAll,
}: {
  snap: SectionSnapshot;
  editionDate: string;
  onFirm: (firm: string) => void;
  onSeeAll: () => void;
}) {
  const rest = snap.total - 1 - snap.headlines.length;
  return (
    <section data-section={snap.id} aria-labelledby={`sec-${snap.id}`} id={`section-${snap.id}`} className="mt-10 scroll-mt-40">
      <h2 id={`sec-${snap.id}`} className="flex items-center gap-3">
        <span aria-hidden className="sec-bg h-2.5 w-2.5 rounded-sm" />
        <span className="font-display text-[22px] font-semibold text-ink">{snap.label}</span>
        <span className="tabular text-[13px] text-muted">{snap.total}</span>
        <span aria-hidden className="h-px flex-1 bg-rule" />
      </h2>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{snap.summary}</p>
      <div id={`item-${snap.lead.id}`} className="mt-4 scroll-mt-44">
        <DigestCard item={snap.lead} editionDate={editionDate} onFirm={onFirm} />
      </div>
      {snap.headlines.length > 0 && (
        <ul className="mt-3 divide-y divide-rule rounded-xl border border-rule bg-surface">
          {snap.headlines.map((h) => (
            <HeadlineRow key={h.id} item={h} />
          ))}
        </ul>
      )}
      {rest > 0 && (
        <button type="button" onClick={onSeeAll} className="mt-3 text-[14px] font-semibold text-accent hover:underline">
          See all {snap.total} in {snap.label} →
        </button>
      )}
    </section>
  );
}

/** A short headline: title linking to the original, story type, source and time. */
function HeadlineRow({ item }: { item: DigestItem }) {
  return (
    <li id={`item-${item.id}`} className="scroll-mt-44 px-4 py-3">
      <a href={item.url} target="_blank" rel="noreferrer" className="text-[15px] leading-snug font-semibold text-ink hover:underline">
        {item.title}
      </a>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
        <StoryTypeBadge item={item} />
        <span>
          {item.source.name} · {publishedLabel(item.publishedAt)}
        </span>
      </p>
    </li>
  );
}
