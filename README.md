# The Daily Digest

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
| **Key takeaway** | One sentence on what's new, written by AI from the publisher's headline and excerpt |
| **Why it matters** | Significance for investors, allocators and family offices |
| **Market context** | That morning's real FRED numbers, framed for the story's theme |
| **New to this?** | A plain-English explainer of one jargon term, tap to expand |

There is also a Morning Brief, a market snapshot with sparklines, Top Stories, filters by section, firm, format and theme, a 90-day archive, a glossary, and full light/dark support.

## No API keys, no secrets

| Piece | How it works without keys |
| --- | --- |
| News and commentary | Public RSS, Atom and podcast feeds |
| SEC filings | EDGAR's public submissions API |
| Market data | FRED's public CSV endpoint |
| Summaries | GitHub Models, called with the Action's built-in `GITHUB_TOKEN` (`models: read`), plus a rule-based fallback (`pipeline/enrich/`) |
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

**The AI writer** (`pipeline/enrich/ai.ts`). In the GitHub Action it sends the selected stories to GitHub Models (`openai/gpt-4.1-mini`, free tier, about 4 requests a day) using the built-in token. The model sees only each story's headline and excerpt. Every answer is validated, and a takeaway is rejected if it is:

- more than one sentence, or cut off
- too similar to the headline
- carrying a number that isn't in the source

Rejected or missing answers keep the rule-based text. Locally there is no token, so `npm run digest` uses rules only. Set `DIGEST_AI=off` to force rules in the Action.

**The rules engine** (`pipeline/enrich/`):

| File | What it does |
| --- | --- |
| `themes.ts` | 20 themes: fundraising, M&A, private credit, exits, real estate, infrastructure, rates, regulation, hedge funds, family offices and more. Each has keyword patterns, an importance weight, "why it matters" templates, an allocator angle, and a market-context builder. |
| `takeaway.ts` | Fallback takeaway: the first complete, informative sentence of the publisher's excerpt, with boilerplate stripped and cut-off sentences trimmed to their last full clause. It never writes new facts. |
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
