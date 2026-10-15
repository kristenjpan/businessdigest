import { dedupe } from "./dedupe";
import { cleanExcerpt, cleanTitle, splitSentences } from "./enrich/takeaway";
import { classify, sectionForTheme } from "./enrich/themes";
import { LOW_VALUE } from "./normalize";
import type { RssSource } from "./sources";
import { SUBSCRIPTION_PUBLISHERS, type RawItem, type SubscriberFeed, type SubscriberHeadline, type SubscriptionId } from "./types";

/** The publisher's own first complete sentence, or "" — never a sentence cut off mid-way. */
export function teaserOf(excerpt: string): string {
  const first = splitSentences(cleanExcerpt(excerpt))[0] ?? "";
  return /[.!?]["”’)]?$/.test(first) && first.length >= 30 && first.length <= 260 ? first : "";
}

/** The Economist publishes most pieces in one weekly batch, so it gets a week; daily papers get 48 hours. */
const WINDOW_HOURS: Partial<Record<SubscriptionId, number>> = { economist: 7 * 24 };

/**
 * Builds the "From your subscriptions" file: per publisher, the newest relevant headlines from
 * its public feeds over its window (48 hours by default), deduplicated, at most `perPublisher` each.
 */
export function buildSubscriberFeed(
  fetched: { source: RssSource; items: RawItem[] }[],
  now: Date,
  opts = { hours: 48, perPublisher: 8 },
): SubscriberFeed {
  const publishers = SUBSCRIPTION_PUBLISHERS.map(({ id }) => {
    const cutoff = now.getTime() - (WINDOW_HOURS[id] ?? opts.hours) * 3_600_000;
    const pool = fetched
      .filter((f) => f.source.subscription === id)
      .flatMap((f) => f.items)
      .filter((i) => {
        const t = Date.parse(i.publishedAt);
        return t >= cutoff && t <= now.getTime() + 3_600_000 && !LOW_VALUE.test(i.title);
      });
    const items: SubscriberHeadline[] = dedupe(pool)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, opts.perPublisher)
      .map((i) => ({
        id: i.id,
        title: cleanTitle(i.title),
        url: i.url,
        publishedAt: i.publishedAt,
        teaser: teaserOf(i.excerpt),
        firms: i.firms,
        // Subscriber feeds default to Markets, so let keywords or the story's theme pick the real
        // section (a take-private is Private Equity), letting readers' section picks filter them.
        section: i.section !== "markets" ? i.section : (sectionForTheme(classify(i)) ?? "markets"),
      }));
    return { id, items };
  });
  return { generatedAt: now.toISOString(), publishers };
}
