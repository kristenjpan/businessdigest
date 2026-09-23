# The Daily Allocation

A free daily investment-intelligence digest for business executives, family-office professionals and investment beginners.

Every morning it collects and summarizes:

- investment and market news
- private-markets and family-office developments
- private-equity and hedge-fund coverage
- SEC filings
- commentary and interviews from firms such as **Blackstone, KKR, Apollo, Carlyle, Bridgewater**, Oaktree, Goldman Sachs and J.P. Morgan

Each story shows:

| Field | What it is |
| --- | --- |
| **Source and date** | Publisher, publication time, and a link to the original |
| **Key takeaway** | What happened, quoted from the publisher's own summary |
| **Why it matters** | Significance for investors, allocators and family offices |
| **Market context** | That morning's real FRED numbers, framed for the story's theme |
| **New to this?** | A plain-English explainer of one jargon term (expanded in *Beginner mode*) |

There is also a Morning Brief, a market snapshot with sparklines, Top Stories, filters by section, firm, format and theme, a 90-day archive, a glossary, and full light/dark support.

## No API keys, no secrets

| Piece | How it works without keys |
| --- | --- |
| News and commentary | Public RSS, Atom and podcast feeds |
| SEC filings | EDGAR's public submissions API |
| Market data | FRED's public CSV endpoint |
| Summaries | A deterministic rule-based engine (`pipeline/enrich/`) instead of an LLM |
| Daily refresh | GitHub Actions using its built-in `GITHUB_TOKEN` |
| Hosting | A static Vite build on Vercel |

## Deploy (about 5 minutes)

**1. Push to GitHub**

```bash
git init && git add -A && git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

**2. Allow the Action to commit.** In the repo, open **Settings → Actions → General → Workflow permissions** and choose **Read and write permissions**. This is the default for personal repos; organizations may need to change it.

**3. Deploy on Vercel.** Click **Add New → Project**, import the repo, and click **Deploy**. `vercel.json` already sets the Vite build, so there are no environment variables to add.

**4. Done.** Every day at 10:15 UTC the **Daily digest** workflow builds a new edition and commits it to `public/data/`, and Vercel redeploys automatically. To publish immediately, open **Actions → Daily digest → Run workflow**.

*Optional:* add a repository **variable** (not a secret) named `SEC_CONTACT` with your email. SEC asks automated clients to identify themselves; without it, the repo URL is sent.

The repo ships with a first edition already generated, so the site has content the moment it deploys. If a daily run fails (for example, fewer than 8 usable stories), nothing is committed and yesterday's edition stays live.

## Run locally

```bash
npm install
npm run dev                    # site at http://localhost:5173
npm run digest                 # build today's edition → public/data/
npm run digest -- --dry-run    # print the edition without writing anything
npm run check-feeds            # health-check every source (status, robots.txt, recent items)
npm test                       # pipeline unit tests
```

## How an edition is built

```
37 public sources ─▶ ~180 recent items ─▶ drop advice columns, reruns, routine notices
   ─▶ dedupe (same URL, near-identical headline, same story across outlets)
   ─▶ classify into 20 themes ─▶ rank + pick ~24 balanced across sections
   ─▶ takeaway · why it matters · market context · glossary term ─▶ Morning Brief ─▶ JSON
```

**The rules engine** (`pipeline/enrich/`):

| File | What it does |
| --- | --- |
| `themes.ts` | 20 themes: fundraising, M&A, private credit, exits, real estate, infrastructure, rates, regulation, hedge funds, family offices and more. Each has keyword patterns, an importance weight, "why it matters" templates, an allocator angle, and a market-context builder. |
| `takeaway.ts` | Extracts the first complete sentences of the publisher's excerpt and strips feed boilerplate. It never writes new facts. |
| `market.ts` | Turns FRED data into sentences with regime labels, e.g. VIX *calm/normal/elevated/stressed*, HY spreads *tight/normal/wide*, and curve shape. |
| `firms.ts` | Qualitative profiles of about 25 firms. These deliberately contain no figures that could go stale. |
| `glossary.ts` | About 50 beginner terms. It is shared with the site's Glossary page. |
| `index.ts` | Selection, importance (1–5), Top Stories and the Morning Brief. |

To improve the writing, edit the templates in `themes.ts` and `firms.ts`. Tests in `pipeline/__tests__/` guard the behavior.

## Sourcing policy

- **Feeds and official APIs only.** Article pages are never scraped.
- **robots.txt is checked before every request.** An unreachable robots.txt is treated as "disallow" (RFC 9309).
- **Polite fetching.** Requests carry an identifying User-Agent, are throttled per host, and use ETag/If-Modified-Since.
- **No paywalled outlets.** Links to paywalled or login-required outlets are dropped (`PAYWALLED_DOMAINS` in `pipeline/sources.ts`).
- **Short excerpts only.** Each story shows its headline and a short excerpt, and always links to the publisher.

## Adding a source

Add an entry to `SOURCES` in `pipeline/sources.ts`, then run `npm run check-feeds`. Keep the source only if it returns 200, passes robots.txt and has recent items. For high-volume press wires, set `requireRelevance: true`.

## Project layout

```
pipeline/                 daily build (Node + tsx)
  sources.ts              source registry, FRED series, paywall list
  buildDigest.ts          entry point → public/data/latest.json + archive/
  enrich/                 keyless summary engine
  __tests__/              vitest suites
scripts/check-feeds.ts    source health check
src/                      React + Tailwind site (hash routing, static)
public/data/              generated editions (committed by the Action)
.github/workflows/        daily-digest.yml
vercel.json               static build settings
```

*Educational summaries, not investment advice. Content belongs to its publishers. Market data from FRED, Federal Reserve Bank of St. Louis.*
