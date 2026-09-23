/**
 * Verifies every configured source: reachable, allowed by robots.txt, parseable, and how many
 * items are recent. Run before adding a source and whenever a feed looks stale.
 */
import { fetchEdgarSource } from "../pipeline/edgar";
import { fetchRssSource } from "../pipeline/fetchFeeds";
import { fetchMarketSnapshot } from "../pipeline/fred";
import { isRecent, lookbackHours } from "../pipeline/score";
import { SOURCES } from "../pipeline/sources";

const now = new Date();
const base = lookbackHours(now);
let failures = 0;

console.log(`Checking ${SOURCES.length} sources (base window ${base}h)\n`);
const rows = await Promise.all(
  SOURCES.map(async (s) => {
    const r = s.kind === "edgar" ? await fetchEdgarSource(s) : await fetchRssSource(s);
    const recent = r.items.filter((i) => isRecent(i, now, base)).length;
    const newest = r.items.map((i) => i.publishedAt).sort().at(-1)?.slice(0, 10) ?? "—";
    if (!r.ok) failures++;
    return { id: s.id, ok: r.ok ? "✓" : "✗", status: r.status, items: r.items.length, recent, newest, paywalled: r.dropped.paywalled, excluded: r.dropped.excluded, offTopic: r.dropped.offTopic };
  }),
);
console.table(rows);

const market = await fetchMarketSnapshot(now);
console.log("\nFRED market series:");
console.table(market.map((m) => ({ id: m.id, value: m.value, previous: m.previous, asOf: m.asOf })));

console.log(`\n${SOURCES.length - failures}/${SOURCES.length} sources OK`);
process.exitCode = failures ? 1 : 0;
