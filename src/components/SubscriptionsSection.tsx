import { useEffect, useState } from "react";
import { SUBSCRIPTION_PUBLISHERS, type SubscriberFeed, type SubscriberHeadline } from "../../pipeline/types";
import { useAccount } from "../lib/account";
import { loadSubscriberFeed } from "../lib/data";
import { hostOf, publishedLabel } from "../lib/format";
import { hasPrefs, matchesPrefs, type Prefs } from "../lib/personalize";

const FIRST_SHOWN = 2;

/**
 * Only headlines that match what the reader follows. Files written before headlines carried a
 * section (Oct 15, 2026) fall back to matching firms only.
 */
export function followedHeadlines(items: SubscriberHeadline[], prefs: Prefs): SubscriberHeadline[] {
  return items.filter((h) => (h.section ? matchesPrefs({ section: h.section, firms: h.firms }, prefs) : h.firms.some((f) => prefs.firms.includes(f))));
}

/**
 * "From your subscriptions": headlines from the paywalled publishers a signed-in reader ticked on
 * their Account page, limited to their sections and firms. Only the headline and the publisher's
 * own first sentence are shown; every link opens the article on the publisher's site.
 */
export function SubscriptionsSection() {
  const { user, prefs } = useAccount();
  const [feed, setFeed] = useState<SubscriberFeed | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const chosen = user ? prefs.subscriptions : [];

  useEffect(() => {
    if (chosen.length && !feed) loadSubscriberFeed().then(setFeed);
  }, [chosen.length, feed]);

  if (!chosen.length || !feed) return null;

  const follows = hasPrefs(prefs);
  const publishers = SUBSCRIPTION_PUBLISHERS.filter((p) => chosen.includes(p.id))
    .map((p) => ({ ...p, items: followedHeadlines(feed.publishers.find((f) => f.id === p.id)?.items ?? [], prefs) }))
    .filter((p) => p.items.length);

  return (
    <section aria-labelledby="subs-heading" className="mt-12 border-t border-rule pt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="subs-heading" className="font-display text-[22px] font-semibold text-ink">
          From your subscriptions
        </h2>
        <a href="#/account" className="text-[12px] text-muted hover:text-ink">
          Edit subscriptions
        </a>
      </div>

      {!follows ? (
        <p className="mt-3 rounded-lg border border-rule bg-surface px-4 py-3 text-[14px] text-ink-soft">
          Pick sections or firms on your{" "}
          <a href="#/account" className="font-semibold text-accent hover:underline">
            Account page
          </a>{" "}
          to see matching headlines from your subscriptions.
        </p>
      ) : publishers.length === 0 ? (
        <p className="mt-3 rounded-lg border border-rule bg-surface px-4 py-3 text-[14px] text-ink-soft">
          None of today's headlines from your subscriptions match the sections and firms you follow.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {publishers.map((p) => {
            const open = expanded.has(p.id);
            const shown = open ? p.items : p.items.slice(0, FIRST_SHOWN);
            const more = p.items.length - FIRST_SHOWN;
            return (
              <div key={p.id} className="rounded-xl border border-rule bg-surface p-5">
                <div className="flex items-center justify-between gap-3">
                  <a href={p.homepage} target="_blank" rel="noreferrer" className="font-display text-[17px] font-semibold text-ink hover:underline">
                    {p.name}
                  </a>
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">Subscriber</span>
                </div>
                <ul className="mt-3 divide-y divide-rule">
                  {shown.map((h) => (
                    <li key={h.id} className="py-3 first:pt-0 last:pb-0">
                      <a href={h.url} target="_blank" rel="noreferrer" className="text-[15px] leading-snug font-semibold text-ink hover:underline">
                        {h.title}
                      </a>
                      {h.teaser && <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{h.teaser}</p>}
                      <p className="mt-1 text-[12px] text-muted">
                        {publishedLabel(h.publishedAt)} ·{" "}
                        <a href={h.url} target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">
                          Read on {hostOf(h.url)} ↗
                        </a>
                      </p>
                    </li>
                  ))}
                </ul>
                {more > 0 && (
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() =>
                      setExpanded((s) => {
                        const next = new Set(s);
                        if (open) next.delete(p.id);
                        else next.add(p.id);
                        return next;
                      })
                    }
                    className="mt-3 text-[13px] font-semibold text-accent hover:underline"
                  >
                    {open ? "Show less" : `Show more (${more})`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-2 text-[12px] text-muted">Headlines and summaries from each publisher's public feed. Full articles need your own subscription.</p>
    </section>
  );
}
