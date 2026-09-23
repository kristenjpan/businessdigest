/**
 * Daily digest pipeline: fetch → normalize → dedupe → select → enrich (rule-based) → write JSON.
 * No API keys: feeds are public, FRED is read via its public CSV endpoint, and summaries come
 * from the deterministic engine in ./enrich. Run daily by .github/workflows/daily-digest.yml.
 *
 *   npm run digest               full run; writes public/data/latest.json + archive
 *   npm run digest -- --dry-run  fetch + enrich, print the edition, write nothing
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { editionFor, updateArchiveIndex } from "./archive";
import { dedupe, dedupeStories } from "./dedupe";
import { fetchEdgarSource } from "./edgar";
import { buildBrief, ENGINE, selectAndEnrich } from "./enrich";
import { MarketView } from "./enrich/market";
import { fetchRssSource } from "./fetchFeeds";
import { fetchMarketSnapshot } from "./fred";
import { isRecent, lookbackHours } from "./score";
import { SOURCES } from "./sources";
import type { ArchiveIndex, Digest } from "./types";

const DATA_DIR = path.resolve("public/data");
const ARCHIVE_DIR = path.join(DATA_DIR, "archive");
const MIN_ITEMS = 8;
const dryRun = process.argv.includes("--dry-run");

function easternDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

async function main() {
  const now = new Date();
  const date = easternDate(now);
  console.log(`Building digest for ${date}${dryRun ? " (dry run)" : ""} · engine ${ENGINE} (no API keys)`);

  // 1. Fetch
  const results = await Promise.all(SOURCES.map((s) => (s.kind === "edgar" ? fetchEdgarSource(s) : fetchRssSource(s))));
  for (const r of results.filter((r) => !r.ok)) console.warn(`  ✗ ${r.sourceId}: ${r.status}`);
  const sourcesOk = results.filter((r) => r.ok).length;
  const market = await fetchMarketSnapshot(now);
  console.log(`  ${sourcesOk}/${SOURCES.length} sources OK · ${market.length} market series`);

  // 2. Filter + dedupe
  const base = lookbackHours(now);
  const recent = results.flatMap((r) => r.items).filter((i) => isRecent(i, now, base));
  const unique = dedupeStories(dedupe(recent));
  console.log(`  ${recent.length} recent → ${unique.length} unique`);

  // 3. Select + enrich
  const view = new MarketView(market);
  const selection = selectAndEnrich(unique, view, now);
  if (selection.items.length < MIN_ITEMS) {
    throw new Error(`Only ${selection.items.length} items (minimum ${MIN_ITEMS}). Keeping the previous edition.`);
  }
  const brief = buildBrief(selection, view);

  const indexFile = path.join(ARCHIVE_DIR, "index.json");
  const archiveIndex = await readJson<ArchiveIndex>(indexFile);
  const digest: Digest = {
    date,
    generatedAt: now.toISOString(),
    engine: ENGINE,
    edition: editionFor(archiveIndex, date),
    brief,
    market,
    topStoryIds: selection.topStoryIds,
    items: selection.items,
    stats: { sourcesChecked: SOURCES.length, sourcesOk, candidates: unique.length, selected: selection.items.length },
  };

  if (dryRun) {
    console.log(`\n${brief.headline}\n`);
    for (const b of brief.bullets) console.log(`  • ${b}`);
    console.log(`\n  ${brief.marketRead}\n`);
    for (const i of digest.items) {
      const star = digest.topStoryIds.includes(i.id) ? "★" : " ";
      console.log(`${star} [${i.section} · ${i.theme.label} · ${i.importance}] ${i.title}\n    ${i.source.name} · ${i.publishedAt.slice(0, 16)}\n    → ${i.takeaway}\n`);
    }
    return;
  }

  // 4. Write latest + archive
  await mkdir(ARCHIVE_DIR, { recursive: true });
  const json = JSON.stringify(digest, null, 2);
  await writeFile(path.join(DATA_DIR, "latest.json"), json);
  await writeFile(path.join(ARCHIVE_DIR, `${date}.json`), json);
  const { index, removed } = updateArchiveIndex(
    archiveIndex,
    { date, edition: digest.edition, headline: brief.headline, items: digest.items.length },
    now,
  );
  await writeFile(indexFile, JSON.stringify(index, null, 2));
  for (const d of removed) await rm(path.join(ARCHIVE_DIR, `${d}.json`), { force: true });
  console.log(`✓ Edition #${digest.edition}: ${digest.items.length} items → public/data/latest.json (+ archive, ${index.editions.length} kept)`);
}

main().catch((err) => {
  console.error(`✗ Digest failed: ${(err as Error).message}`);
  process.exit(1);
});
