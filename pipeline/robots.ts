import robotsParser from "robots-parser";
import { PRODUCT_TOKEN, userAgent } from "./ua";

type Verdict = (url: string) => boolean;

const cache = new Map<string, Promise<Verdict>>();

/**
 * Builds an allow/deny check from a robots.txt response, following RFC 9309:
 * 2xx → obey the rules; 4xx → no restrictions; 5xx or unreachable → assume full disallow.
 */
export function verdictFromRobots(robotsUrl: string, status: number | null, body: string): Verdict {
  if (status !== null && status >= 200 && status < 300) {
    const robots = robotsParser(robotsUrl, body);
    return (url) => robots.isAllowed(url, PRODUCT_TOKEN) !== false;
  }
  if (status !== null && status >= 400 && status < 500) return () => true;
  return () => false;
}

async function loadVerdict(origin: string): Promise<Verdict> {
  const robotsUrl = `${origin}/robots.txt`;
  try {
    const res = await fetch(robotsUrl, {
      headers: { "User-Agent": userAgent() },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    return verdictFromRobots(robotsUrl, res.status, await res.text());
  } catch {
    return verdictFromRobots(robotsUrl, null, "");
  }
}

export async function isAllowedByRobots(url: string): Promise<boolean> {
  const { origin } = new URL(url);
  let verdict = cache.get(origin);
  if (!verdict) {
    verdict = loadVerdict(origin);
    cache.set(origin, verdict);
  }
  return (await verdict)(url);
}
