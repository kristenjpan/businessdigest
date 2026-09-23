import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isAllowedByRobots } from "./robots";
import { userAgent } from "./ua";

const CACHE_DIR = path.resolve(".cache/http");
const MIN_GAP_MS_DEFAULT = 1000;
const MIN_GAP_MS: Record<string, number> = {
  // SEC's fair-access policy allows 10 req/s; stay well under it.
  "www.sec.gov": 250,
  "data.sec.gov": 250,
};

const lastRequestAt = new Map<string, number>();

async function throttle(host: string) {
  const gap = MIN_GAP_MS[host] ?? MIN_GAP_MS_DEFAULT;
  // Reserve the next slot before waiting so concurrent callers queue up instead of bunching.
  const slot = Math.max(Date.now(), (lastRequestAt.get(host) ?? 0) + gap);
  lastRequestAt.set(host, slot);
  const wait = slot - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

interface CacheEntry {
  etag?: string;
  lastModified?: string;
  body: string;
}

function cachePath(url: string) {
  return path.join(CACHE_DIR, createHash("sha1").update(url).digest("hex") + ".json");
}

async function readCache(url: string): Promise<CacheEntry | null> {
  try {
    return JSON.parse(await readFile(cachePath(url), "utf8")) as CacheEntry;
  } catch {
    return null;
  }
}

async function writeCache(url: string, entry: CacheEntry) {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(cachePath(url), JSON.stringify(entry));
}

export class FetchBlockedError extends Error {}

export interface FetchResult {
  status: number;
  body: string;
  fromCache: boolean;
}

/**
 * Polite GET: checks robots.txt, throttles per host, sends an identifying UA,
 * and uses ETag / Last-Modified so unchanged feeds cost the publisher a 304.
 */
export async function politeFetch(url: string, opts: { timeoutMs?: number } = {}): Promise<FetchResult> {
  const { host } = new URL(url);
  if (!(await isAllowedByRobots(url))) {
    throw new FetchBlockedError(`robots.txt disallows ${url}`);
  }
  await throttle(host);

  const cached = await readCache(url);
  const headers: Record<string, string> = {
    "User-Agent": userAgent(),
    Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, application/json, text/csv;q=0.9, */*;q=0.5",
  };
  if (cached?.etag) headers["If-None-Match"] = cached.etag;
  if (cached?.lastModified) headers["If-Modified-Since"] = cached.lastModified;

  const res = await fetch(url, {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
  });

  if (res.status === 304 && cached) {
    return { status: 304, body: cached.body, fromCache: true };
  }
  const body = await res.text();
  if (res.ok) {
    await writeCache(url, {
      etag: res.headers.get("etag") ?? undefined,
      lastModified: res.headers.get("last-modified") ?? undefined,
      body,
    });
  }
  return { status: res.status, body, fromCache: false };
}
