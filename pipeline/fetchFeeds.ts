import Parser from "rss-parser";
import { FetchBlockedError, politeFetch } from "./http";
import { guessSection, INVESTMENT_RELEVANT, isPaywalled, itemId, tagFirms, toExcerpt } from "./normalize";
import type { RssSource } from "./sources";
import type { RawItem } from "./types";

const parser = new Parser({
  customFields: { item: [["itunes:summary", "itunesSummary"], ["description", "description"]] },
});

export interface SourceResult {
  sourceId: string;
  ok: boolean;
  status: string; // human-readable: "200", "304 (cached)", "blocked by robots.txt", error message
  items: RawItem[];
  dropped: { paywalled: number; excluded: number; offTopic: number };
}

type FeedItem = Parser.Item & { itunesSummary?: unknown; description?: unknown };

/** Feed fields are usually strings, but some feeds put attributes on them (xml2js yields `{ _: text }`). */
function asText(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return asText(v[0]);
  if (v && typeof v === "object" && "_" in v) return asText((v as { _: unknown })._);
  return "";
}

export function feedItemsToRaw(source: RssSource, items: FeedItem[], feedLink?: string): RawItem[] {
  const out: RawItem[] = [];
  for (const it of items) {
    const title = toExcerpt(asText(it.title), 300);
    if (!title) continue;
    const guid = asText(it.guid);
    const url = (asText(it.link) || (/^https?:\/\//.test(guid) ? guid : "") || feedLink || source.homepage).trim();
    const body =
      asText(it.contentSnippet) || asText(it.itunesSummary) || asText(it.description) || asText(it.content) || asText(it.summary);
    const excerpt = toExcerpt(body);
    const time = Date.parse(asText(it.isoDate) || asText(it.pubDate));
    if (Number.isNaN(time)) continue;
    const date = new Date(time).toISOString();
    const text = `${title} ${excerpt}`;
    out.push({
      id: itemId(url, title),
      title,
      url,
      publishedAt: date,
      excerpt,
      source: { id: source.id, name: source.name, homepage: source.homepage, contentType: source.contentType },
      tier: source.tier,
      firms: tagFirms(text, source.firms),
      section: guessSection(text, source.section),
    });
  }
  return out;
}

export async function fetchRssSource(source: RssSource): Promise<SourceResult> {
  const result: SourceResult = { sourceId: source.id, ok: false, status: "", items: [], dropped: { paywalled: 0, excluded: 0, offTopic: 0 } };
  try {
    const res = await politeFetch(source.url);
    result.status = res.fromCache ? "304 (cached)" : String(res.status);
    if (res.status !== 200 && res.status !== 304) return result;
    const feed = await parser.parseString(res.body);
    const items = feedItemsToRaw(source, feed.items as FeedItem[], feed.link);
    for (const item of items) {
      if (source.excludeUrl?.test(item.url)) result.dropped.excluded++;
      else if (isPaywalled(item.url)) result.dropped.paywalled++;
      else if (source.requireRelevance && !item.firms.length && !INVESTMENT_RELEVANT.test(`${item.title} ${item.excerpt}`)) result.dropped.offTopic++;
      else result.items.push(item);
    }
    result.ok = true;
  } catch (err) {
    result.status = err instanceof FetchBlockedError ? "blocked by robots.txt" : `error: ${(err as Error).message}`;
  }
  return result;
}
