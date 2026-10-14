import { useEffect, useState } from "react";
import { SUBSCRIPTION_PUBLISHERS, type SubscriberFeed } from "../../pipeline/types";
import { useAccount } from "../lib/account";
import { loadSubscriberFeed } from "../lib/data";
import { hostOf, publishedLabel } from "../lib/format";

const PER_PUBLISHER = 5;

/**
 * "From your subscriptions": headlines from the paywalled publishers a signed-in reader ticked on
 * their Account page. Only the headline and the publisher's own first sentence are shown; every
 * link opens the article on the publisher's site, where the reader's own subscription applies.
 */
export function SubscriptionsSection() {
  const { user, prefs } = useAccount();
  const [feed, setFeed] = useState<SubscriberFeed | null>(null);
  const chosen = user ? prefs.subscriptions : [];

  useEffect(() => {
    if (chosen.length && !feed) loadSubscriberFeed().then(setFeed);
  }, [chosen.length, feed]);

  if (!chosen.length || !feed) return null;
  const publishers = SUBSCRIPTION_PUBLISHERS.filter((p) => chosen.includes(p.id))
    .map((p) => ({ ...p, items: (feed.publishers.find((f) => f.id === p.id)?.items ?? []).slice(0, PER_PUBLISHER) }))
    .filter((p) => p.items.length);
  if (!publishers.length) return null;

  return (
    <section aria-labelledby="subs-heading" className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="subs-heading" className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
          From your subscriptions
        </h2>
        <a href="#/account" className="text-[12px] text-muted hover:text-ink">
          Edit subscriptions
        </a>
      </div>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {publishers.map((p) => (
          <div key={p.id} className="rounded-xl border border-rule bg-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <a href={p.homepage} target="_blank" rel="noreferrer" className="font-display text-[17px] font-semibold text-ink hover:underline">
                {p.name}
              </a>
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">Subscriber</span>
            </div>
            <ul className="mt-3 divide-y divide-rule">
              {p.items.map((h) => (
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
          </div>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-muted">Headlines and summaries from each publisher's public feed. Full articles need your own subscription.</p>
    </section>
  );
}
