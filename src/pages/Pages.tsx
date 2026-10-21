import { useEffect, useMemo, useState } from "react";
import { GLOSSARY, termSlug } from "../../pipeline/enrich/glossary";
import { FRED_SERIES, PAYWALLED_DOMAINS, SOURCES } from "../../pipeline/sources";
import type { ArchiveIndex, ContentType, SearchIndex } from "../../pipeline/types";
import { firmsInIndex, searchArchive } from "../lib/archiveSearch";
import { loadArchiveIndex, loadSearchIndex } from "../lib/data";
import { CONTENT_TYPE_LABEL, longDate } from "../lib/format";
import { SITE } from "../lib/site";

export function PageHeader({ kicker, title, children }: { kicker: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="pt-10 pb-6">
      <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-accent">{kicker}</p>
      <h2 className="font-display mt-2 text-[32px] leading-tight font-semibold text-ink sm:text-[40px]">{title}</h2>
      {children && <div className="mt-3 max-w-2xl text-[16px] leading-relaxed text-ink-soft">{children}</div>}
    </header>
  );
}

// ── Archive ──────────────────────────────────────────────────────────────

const RESULTS_SHOWN = 50;

export function ArchivePage() {
  const [index, setIndex] = useState<ArchiveIndex | null | undefined>(undefined);
  const [search, setSearch] = useState<SearchIndex | null>(null);
  const [q, setQ] = useState("");
  const [firm, setFirm] = useState("");
  useEffect(() => {
    loadArchiveIndex().then(setIndex);
    loadSearchIndex().then(setSearch);
  }, []);

  const searching = q.trim().length >= 2 || Boolean(firm);
  const results = useMemo(() => (search && searching ? searchArchive(search.entries, q.trim(), firm) : []), [search, searching, q, firm]);
  const firmOptions = useMemo(() => (search ? firmsInIndex(search.entries) : []), [search]);

  const byMonth = useMemo(() => {
    const m = new Map<string, ArchiveIndex["editions"]>();
    for (const e of index?.editions ?? []) {
      const key = new Date(`${e.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
      m.set(key, [...(m.get(key) ?? []), e]);
    }
    return [...m.entries()];
  }, [index]);

  return (
    <div className="max-w-3xl">
      <PageHeader kicker="Archive" title="Past editions">
        Every morning's digest is saved here for 90 days. Search by keyword or firm to find a past story.
      </PageHeader>
      {search && (
        <div className="mb-8 grid gap-2 sm:grid-cols-[1fr_auto]">
          <label>
            <span className="sr-only">Search past stories</span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search past stories by keyword, firm or source…"
              className="w-full rounded-lg border border-rule bg-surface px-3 py-2.5 text-[15px] text-ink placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </label>
          <select
            value={firm}
            onChange={(e) => setFirm(e.target.value)}
            aria-label="Filter past stories by firm"
            className="min-w-0 rounded-lg border border-rule bg-surface px-2.5 py-2.5 text-[15px] text-ink"
          >
            <option value="">All firms</option>
            {firmOptions.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      )}

      {searching ? (
        <section aria-live="polite">
          <p className="mb-3 text-[14px] text-muted">
            {results.length === 0
              ? "No past stories match. Try another keyword or firm."
              : `${results.length} ${results.length === 1 ? "story" : "stories"}${results.length > RESULTS_SHOWN ? `, showing the newest ${RESULTS_SHOWN}` : ""}`}
            {" · "}
            <button
              type="button"
              onClick={() => {
                setQ("");
                setFirm("");
              }}
              className="font-medium text-accent hover:underline"
            >
              Clear search
            </button>
          </p>
          <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
            {results.slice(0, RESULTS_SHOWN).map((r) => (
              <li key={`${r.d}-${r.id}`} data-section={r.sec}>
                <a href={`#/edition/${r.d}?story=${r.id}`} className="block px-5 py-4 hover:bg-surface-muted">
                  <span className="text-[13px] text-muted">
                    {longDate(r.d)} · {r.s}
                  </span>
                  <span className="font-display mt-0.5 block text-[17px] leading-snug font-semibold text-ink">{r.t}</span>
                  {r.f.length > 0 && (
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      {r.f.map((f) => (
                        <span key={f} className="rounded-md border border-rule px-2 py-0.5 text-[12px] font-medium text-ink-soft">
                          {f}
                        </span>
                      ))}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <>
      {index === undefined && <p className="text-muted">Loading…</p>}
      {index === null && <p className="text-muted">No archived editions yet. The first one appears after the daily update runs.</p>}
      {byMonth.map(([month, editions]) => (
        <section key={month} className="mb-8">
          <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-muted">{month}</h3>
          <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
            {editions.map((e) => (
              <li key={e.date}>
                <a href={`#/edition/${e.date}`} className="flex items-start gap-4 px-5 py-4 hover:bg-surface-muted">
                  <span className="tabular w-16 shrink-0 pt-0.5 text-[13px] text-muted">No. {e.edition}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-ink-soft">{longDate(e.date)}</span>
                    <span className="font-display mt-0.5 block text-[18px] leading-snug font-semibold text-ink">{e.headline}</span>
                  </span>
                  <span className="tabular hidden shrink-0 pt-0.5 text-[13px] text-muted sm:block">{e.items} stories</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
        </>
      )}
    </div>
  );
}

// ── Glossary ─────────────────────────────────────────────────────────────

export function GlossaryPage({ term }: { term?: string }) {
  const [q, setQ] = useState("");

  // Deep links such as #/glossary/high-yield-spread scroll to that term and briefly highlight it.
  useEffect(() => {
    if (!term) return;
    const el = document.getElementById(`term-${term}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("term-highlight");
    const t = window.setTimeout(() => el.classList.remove("term-highlight"), 2400);
    return () => window.clearTimeout(t);
  }, [term]);
  const categories = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const hits = GLOSSARY.filter((g) => !needle || `${g.term} ${g.explanation}`.toLowerCase().includes(needle));
    const m = new Map<string, typeof GLOSSARY>();
    for (const g of hits) m.set(g.category, [...(m.get(g.category) ?? []), g]);
    return [...m.entries()];
  }, [q]);

  return (
    <div className="max-w-3xl">
      <PageHeader kicker="Glossary" title="Investing terms, in plain English">
        The jargon you'll meet in private equity, private credit, hedge funds and family-office investing, explained without assuming a
        finance degree.
      </PageHeader>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search terms…"
        aria-label="Search glossary"
        className="mb-8 w-full rounded-lg border border-rule bg-surface px-3 py-2.5 text-[15px] text-ink placeholder:text-muted focus:border-accent focus:outline-none"
      />
      {categories.length === 0 && <p className="text-muted">No terms match “{q}”.</p>}
      {categories.map(([cat, terms]) => (
        <section key={cat} className="mb-10">
          <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-muted">{cat}</h3>
          <dl className="divide-y divide-rule rounded-xl border border-rule bg-surface">
            {terms.map((t) => (
              <div key={t.term} id={`term-${termSlug(t.term)}`} className="scroll-mt-24 px-5 py-4 transition-colors duration-700">
                <dt className="font-display text-[18px] font-semibold text-ink">{t.term}</dt>
                <dd className="mt-1 text-[15px] leading-relaxed text-ink-soft">{t.explanation}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

// ── Sources ──────────────────────────────────────────────────────────────

const TYPE_ORDER: ContentType[] = ["press-release", "podcast", "filing", "regulator", "news", "research"];

export function SourcesPage() {
  const groups = TYPE_ORDER.map((t) => [t, SOURCES.filter((s) => s.contentType === t)] as const).filter(([, s]) => s.length);
  return (
    <div className="max-w-4xl">
      <PageHeader kicker="Sources" title={`${SOURCES.length} public sources, checked every morning`}>
        Only feeds and official APIs built for automated access are used. robots.txt is checked before every request, paywalled outlets are
        excluded, and each story links back to its publisher.
      </PageHeader>
      {groups.map(([type, sources]) => (
        <section key={type} className="mb-8">
          <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-muted">
            {CONTENT_TYPE_LABEL[type]} · {sources.length}
          </h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {sources.map((s) => (
              <li key={s.id} className="rounded-xl border border-rule bg-surface p-4">
                <a href={s.homepage} target="_blank" rel="noreferrer" className="font-semibold text-ink hover:underline">
                  {s.name}
                </a>
                <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{s.description}</p>
                {s.tier === 1 && <p className="mt-2 text-[12px] font-medium text-accent">Official / primary source</p>}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section className="mb-8">
        <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-muted">Market data · FRED (Federal Reserve Bank of St. Louis)</h3>
        <ul className="flex flex-wrap gap-2">
          {FRED_SERIES.map((s) => (
            <li key={s.id}>
              <a
                href={`https://fred.stlouisfed.org/series/${s.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-block rounded-lg border border-rule bg-surface px-3 py-1.5 text-[14px] text-ink-soft hover:underline"
              >
                {s.label} <span className="text-muted">({s.id})</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
      <section className="mb-8 rounded-xl border border-rule bg-surface-muted p-5 text-[14px] leading-relaxed text-ink-soft">
        <p className="font-semibold text-ink">Excluded (paywalled or login-required)</p>
        <p className="mt-1">{PAYWALLED_DOMAINS.join(" · ")}</p>
      </section>
    </div>
  );
}

// ── About ────────────────────────────────────────────────────────────────

const STEPS = [
  ["Collect", "Each morning a scheduled GitHub Action reads about 37 public RSS feeds, podcast feeds, SEC EDGAR filings and FRED market data. No API keys or paid services are involved."],
  ["Filter", "Stories from the last 36 hours (76 on Mondays) are kept. Duplicates across outlets are merged, and advice columns, reruns and routine notices are dropped."],
  ["Rank", "Each story is scored on source authority, whether it involves major firms (Blackstone, KKR, Apollo, Carlyle, Bridgewater and others), topic and freshness. About 24 are picked, balanced across sections. The page opens with the 60-Second Version, one line per section, and each section shows a one-line summary, its lead story and two more headlines."],
  ["Explain", "A transparent rules engine picks each key takeaway: one complete sentence from the publisher's own summary, skipping quotes, filler and anything that just repeats the headline. Stories whose feed offers nothing beyond a headline are usually left out. The same engine sorts each story into one of 20 themes and writes \"Why it matters\", and market context uses that morning's real FRED numbers."],
  ["Publish", "The edition is saved to the repository, which triggers Vercel to redeploy the site. Past editions stay in the archive for 90 days."],
] as const;

export function AboutPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader kicker="About" title={`How ${SITE.name} works`}>
        A free daily briefing on investing, private markets, private equity, hedge funds and family offices. It is written for business
        executives, family-office professionals and people just starting to invest.
      </PageHeader>
      <ol className="space-y-4">
        {STEPS.map(([title, body], i) => (
          <li key={title} className="grid grid-cols-[40px_1fr] gap-3 rounded-xl border border-rule bg-surface p-5">
            <span className="font-display tabular text-[26px] leading-none font-semibold text-brass">{i + 1}</span>
            <div>
              <p className="font-semibold text-ink">{title}</p>
              <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">{body}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-10 space-y-3 text-[15px] leading-relaxed text-ink-soft">
        <h3 className="font-display text-[22px] font-semibold text-ink">How summaries are written</h3>
        <p>
          The site uses no AI. Each key takeaway is a sentence taken directly from the publisher's own summary, so it never adds facts. Of
          the sentences available, it picks the one that best says who did what and the key number, and stories with a clear takeaway are
          preferred for the edition. "Why it matters" is one sentence chosen for the kind of news (a deal, a fundraise, a loan, a hire,
          outflows and so on) and filled in with the story's own firm, amount and subject. Beginner explainers come from a fixed library,
          and market context uses that morning's real data. The trade-off is that the wording is more formulaic than a human editor's, so
          read the source for the full story.
        </p>
        <h3 className="font-display pt-4 text-[22px] font-semibold text-ink">Important disclaimer</h3>
        <p>
          This site is for education and general information only. It is <strong>not investment, legal or tax advice</strong> and does not
          recommend buying or selling any security or fund. Content belongs to its publishers. We show headlines and short excerpts with links
          to the original. Market data comes from FRED, courtesy of the Federal Reserve Bank of St. Louis. Talk to a qualified adviser before
          making investment decisions.
        </p>
      </section>
    </div>
  );
}

// ── Shared states ────────────────────────────────────────────────────────

export function EmptyState() {
  return (
    <div className="mx-auto max-w-xl py-24 text-center">
      <p className="font-display text-[28px] font-semibold text-ink">No edition yet</p>
      <p className="mt-3 text-ink-soft">
        The first digest is created when the daily GitHub Action runs. Trigger it from the repository's <strong>Actions</strong> tab (“Daily
        digest” → Run workflow), or run <code className="rounded bg-surface-muted px-1.5 py-0.5">npm run digest</code> locally.
      </p>
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="animate-pulse py-8" aria-busy="true" aria-label="Loading the digest">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="h-24 rounded-lg bg-surface-muted" />
        ))}
      </div>
      <div className="mt-8 h-64 rounded-xl bg-surface-muted" />
    </div>
  );
}

export function Footer({ generatedAt, engine }: { generatedAt?: string; engine?: string }) {
  return (
    <footer className="mt-16 border-t border-rule">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-[13px] leading-relaxed text-muted sm:flex-row sm:justify-between sm:px-6">
        <p className="max-w-2xl">
          <strong className="font-semibold text-ink-soft">{SITE.name}</strong> is an educational digest, not investment advice. Headlines and
          excerpts belong to their publishers; every story links to its source. Market data: FRED, Federal Reserve Bank of St. Louis.
        </p>
        <p className="shrink-0 sm:text-right">
          {generatedAt && <>Generated {new Date(generatedAt).toUTCString().replace(" GMT", " UTC")}</>}
          {engine && (
            <>
              <br />
              Summary engine: {engine.startsWith("github-models") ? `${engine.replace("github-models:", "GitHub Models · ")}` : `${engine} (rule-based)`}
            </>
          )}
        </p>
      </div>
    </footer>
  );
}
