import { CORE_FIRMS, WEALTH_TOPIC } from "../normalize";
import type { RawItem } from "../types";
import { FIRM_PROFILES, leadFirm } from "./firms";
import { pickBySeed, type Theme } from "./themes";
import { GENERIC_OPENER } from "./takeaway";

/**
 * "Why it matters" in one specific sentence. Rules, not AI: detect what kind of event the story is
 * (a deal, a fundraise, a loan, outflows, a hire…), then fill that event's sentence with the
 * story's own facts: who (the company the headline opens with, or the lead firm), how much (the
 * first money figure in the headline) and what it's about (private credit, AI, crypto…).
 * Every sentence has a version without the who, the amount or the topic, so wording never breaks.
 * Stories with no recognisable event fall back to their theme's one-sentence explanation.
 */

export type EventKind =
  | "filing"
  | "interview"
  | "legal"
  | "credit-stress"
  | "retreat"
  | "fees"
  | "breakaway"
  | "advisor-move"
  | "deal-pushback"
  | "deal-talks"
  | "raise-target"
  | "venture"
  | "fundraise"
  | "secondaries"
  | "survey"
  | "policy"
  | "activism"
  | "paper-gain"
  | "outlook"
  | "index-move"
  | "exit"
  | "deal"
  | "financing"
  | "outflows"
  | "inflows"
  | "board"
  | "people"
  | "results"
  | "partnership"
  | "launch"
  | "rates"
  | "market-move";

// ── Facts pulled from the story ───────────────────────────────────────────

const MONEY = /(?:[$€£¥]|\b(?:US|A|C|HK|S)\$)\s?\d[\d.,]*(?:\s?(?:trillion|tn|billion|bn|million|mn|[mb])\b)?/gi;

/** First money figure in the text, tidied ("$2.8 Billion" → "$2.8 billion"); skips per-share prices. */
export function amountIn(text: string): string | null {
  for (const m of text.matchAll(MONEY)) {
    const after = text.slice(m.index! + m[0].length);
    if (/^\s?(-a-|a share|per share|-per-share|a-share|a security)/i.test(after)) continue;
    return m[0]
      .replace(/[.,]+$/, "")
      .replace(/\s?(Trillion|Billion|Million)$/i, (u) => ` ${u.trim().toLowerCase()}`)
      .replace(/(\d)\s?B$/, "$1bn")
      .replace(/(\d)\s?M$/, "$1m");
  }
  return null;
}

/** Verbs a headline's subject is followed by: "Macquarie hires…", "Tradeweb to Acquire…". */
const TITLE_VERB =
  /\s(?:to\s)?(?:hires?|hired|appoints?|appointed|names|named|taps|recruits|adds|buys|bought|acquires?|acquired|agreed|agrees|launch(?:es)?|raised|raises|raise|sues|invests|prices|closes|closed|reaches|draws|drew|deploys|opens|unveils|offers|completes|completed|sells?|sold|exits|cuts|halts?|halted|backs off|ends|pitch(?:es)?|forecasts|warns|sees|expects|surpassed|surpasses|tops|partners with)\b/i;

/** The headline's subject, when it is a short name: "Macquarie", "Wells Fargo Advisors", "SoftBank". */
export function titleActor(title: string): string | null {
  const m = title.match(TITLE_VERB);
  if (!m || m.index === undefined) return null;
  const head = title
    .slice(0, m.index)
    .split(/\s(?:Was|Is|Were|Are|Has|Had|In|Reportedly)\s/i)[0]
    .replace(/['’]s\b.*$/, "")
    .trim();
  // "Novavax critic Shah Capital" → "Shah Capital": keep the name, not the description before it.
  // "Apollo private credit fund" → "Apollo": the name is the leading capitalised run.
  if (/\s[a-z]/.test(head)) {
    const trailing = head.match(/\s((?:[A-Z][\w&.'’-]*\s?)+)$/)?.[1]?.trim();
    const leading = head.match(/^((?:[A-Z][\w&.'’-]*\s?)+?)(?=\s[a-z])/)?.[1]?.trim();
    return titleActorCheck(trailing ?? leading ?? head);
  }
  return titleActorCheck(head);
}

function titleActorCheck(head: string): string | null {
  const words = head.split(/\s+/);
  if (!head || words.length > 5 || !/^[A-Z]/.test(head) || GENERIC_OPENER.test(head) || /^(Hedge|Private|Investors?|Advisors?|Ex-|Former)\b/i.test(head) || /\b(ETFs?|Funds|Stocks|Shares|Investors)\b/.test(head)) return null;
  return head;
}

/** "Kartesia Asset Finance (KAF) has invested…" → "Kartesia Asset Finance". */
const OPENER = /^((?:[A-Z][\w&’'.-]*\s){0,3}[A-Z][\w&’'.-]*)(?=\s(?:\(|has|have|had|is|are|was|were|will|would|said|says|[a-z]+ed\b|[a-z]+s\b))/;

/**
 * Who the story is about: the headline's subject, else a tracked firm named in the headline, else
 * the company the takeaway opens with. A firm mentioned only in passing is never used.
 */
export function actorFor(item: RawItem, takeaway: string, fromExcerpt: boolean): string | null {
  const fromTitle = titleActor(item.title);
  if (fromTitle) return fromTitle;
  const firm = leadFirm(item.firms);
  if (firm && item.title.includes(firm.split(" ")[0])) return firm;
  if (fromExcerpt && !GENERIC_OPENER.test(takeaway)) {
    const m = takeaway.match(OPENER);
    if (m) return m[1].replace(/['’]s$/, "");
  }
  return null;
}

/** Words that show a headline phrase is not a person's name ("SEC Announces Roundtable", "South Korea"). */
const NOT_A_NAME = /\b(Announces?|Says|Holds|Launches|Names|Sees|Warns|Reports?|Plans?|SEC|Fed|Korea|China|Japan|America|Europe|India|Wealth|Fund|Capital|Markets?)\b/;

/** The person interviewed: "SoftBank CEO Masayoshi Son: …", "Jeff Yan's Plan…", "… – Tracy Britt Cool (EP.521)". */
export function speakerIn(title: string): string | null {
  const NAME = String.raw`[A-Z][A-Za-zÀ-ÿ'’.-]+(?:\s[A-Z][A-Za-zÀ-ÿ'’.-]+){1,2}`;
  const patterns = [
    new RegExp(String.raw`^(?:[A-Z][\w&.-]*['’]s\s)?(?:Dr\.\s)?(${NAME})\son\b`),
    new RegExp(String.raw`\s[-–—]\s(${NAME})\s\((?:EP|Ep)`),
    new RegExp(String.raw`\bwith\s(?:[A-Z][\w&.-]*(?:\s[A-Z][\w&.-]*)*['’]s\s)?(${NAME})$`),
    new RegExp(String.raw`^((?:[A-Z][A-Za-zÀ-ÿ'’.-]+\s?){2,5}?)(?:['’]s\b|\s[-–—]\s|:)`),
  ];
  for (const re of patterns) {
    const m = title.match(re);
    if (!m || GENERIC_OPENER.test(m[1]) || NOT_A_NAME.test(m[1])) continue;
    const words = m[1].trim().split(/\s+/);
    const role = words.findIndex((w) => /^(CEO|CIO|CFO|COO|Founder|Co-founder|Chair|Chairman|President|Economist|Strategist|Partner)$/i.test(w));
    const name = role >= 0 ? words.slice(role + 1) : words;
    if (name.length >= 2 && name.length <= 3) return name.join(" ");
  }
  return null;
}

/** Who is speaking in an outlook headline: "Citi Australia CEO says…", "…, says PMI". */
function outlookSource(title: string): string | null {
  const after = title.match(/,\s*(?:says|finds)\s([A-Z][\w&.'’ -]{1,40})$/);
  if (after) return after[1].trim();
  const before = title.match(/(?:^|[?.:]\s)([A-Z][\w&.'’-]*(?:\s[A-Z][\w&.'’-]*){0,3})\s(?:says|sees|warns|expects|predicts|forecasts|raises)\b/i);
  return before && !GENERIC_OPENER.test(before[1]) ? before[1] : null;
}

const TOPICS: [RegExp, string][] = [
  [/\basset[- ]based finance\b|\basset finance\b|\bABF\b/i, "asset-based finance"],
  [/\bdirect lending\b/i, "direct lending"],
  [/\bprivate (credit|debt|lending)\b/i, "private credit"],
  [/\bsecondar(y|ies)\b|\bcontinuation (fund|vehicle)s?\b/i, "secondaries"],
  [/\b60\/40\b/, "the classic 60/40 portfolio"],
  [/\bprivate markets?\b|\balts\b|\balternatives\b/i, "private markets"],
  [/\binfrastructure\b/i, "infrastructure"],
  [/\bdata cent(er|re)s?\b/i, "data centers"],
  [/\breal estate\b|\bREITs?\b|\bproperty\b|\bhousing\b|\bmortgage\b|\bapartments?\b/i, "real estate"],
  [/\bbitcoin\b|\bcrypto\b|\bether\b|\bstablecoin|\btokeni[sz]/i, "crypto"],
  [/\bhedge funds?\b|\bmulti-?strateg/i, "hedge funds"],
  [/\bAI\b|\bartificial intelligence\b|\bchips?\b|\bsemiconductor|\bNvidia\b|\bOpenAI\b|\bAnthropic\b|\bGPUs?\b/i, "AI"],
  [/\btech(nology)?\b/i, "tech"],
  [/\bprivate equity\b|\bbuyouts?\b/i, "private equity"],
  [/\bRIAs?\b|\bwealth\b|\bfinancial advis[eo]rs?\b|\badvisors?\b/i, "wealth management"],
  [/\binsur(ance|er|ers)\b|\bannuit/i, "insurance"],
  [/\bbonds?\b|\bTreasur(y|ies)\b/i, "bonds"],
];

/** The story's subject area, or null when nothing specific is named. */
export function topicFor(item: RawItem, takeaway: string): string | null {
  return (TOPICS.find(([re]) => re.test(item.title)) ?? TOPICS.find(([re]) => re.test(takeaway)))?.[1] ?? null;
}

// ── Event detection (first match wins; mostly on the headline) ─────────────

const DEAL =
  /\bacquir\w*|\bacquisition\b|\btake[- ]?private\b|\btaken private\b|\btakeover\b|\bmerg(e|er|es|ed|ing)\b|\b(buys|bought|to buy)\b|\b(majority|minority|significant)( minority)? stake\b|\bstake in\b|\btender offer for\b|\boffer for\b|\b(bid for|bids for|takeover bid|bid to)\b|\bcarve-?out\b|\binvests? in\b|\bin \$[\d.]+\w* deal\b/i;

/** A deal size stated in the takeaway: "The $1.97 bln deal…", "…valued at $2bn". */
function dealAmountIn(takeaway: string): string | null {
  const m = takeaway.match(/((?:[$€£]|\bUS\$)\s?\d[\d.,]*\s?(?:bln|billion|bn|mln|million|m)?)\s(?:deal|acquisition|takeover|transaction|purchase)\b|\b(?:valued at|for about|for roughly|for)\s((?:[$€£]|\bUS\$)\s?\d[\d.,]*\s?(?:bln|billion|bn|mln|million|m)?)\b/i);
  const raw = m?.[1] ?? m?.[2];
  return raw ? amountIn(raw.replace(/\bbln\b/i, "billion").replace(/\bmln\b/i, "million")) : null;
}

/** Words that say a market moved. */
const MOVE = /\bsell-?off\b|\brally\w*|\bplung\w+|\btumbl\w+|\bslump\w*|\bsinks?\b|\bsoar\w*|\bsurg\w+|\bjump\w*|\bfall(s|ing)?\b|\bfell\b|\bdrop\w*|\brout\b|\bwreck\b|\bdump\w+|\brecord high\b|\bclimbs?\b|\brises?\b|\bhigher\b|\blower\b|\bup sharply\b|\bcorrection\b/i;

const RULES: [EventKind, (title: string, text: string, item: RawItem) => boolean][] = [
  ["filing", (_t, _x, i) => i.source.contentType === "filing"],
  ["interview", (t, _x, i) => i.source.contentType === "podcast" || /\binterview\b|\bsits down\b|\bepisode\b|\(EP\.?\s?\d+\)/i.test(t) || (speakerIn(t) !== null && /^(?:[A-Z][\w&.-]*['’]s\s)?(?:Dr\.\s)?[A-Z][\w'’.-]+(?:\s[A-Z][\w'’.-]+){1,2}\son\s/.test(t))],
  ["legal", (t) => /\b(sues?|sued|lawsuit|class action|indict\w*|fined|fines|penalt\w+|settle(s|d|ment)|probe|fraud|investigat\w+|poach\w*|alleg\w+|money laundering|sanctions violations)\b/i.test(t)],
  ["credit-stress", (t) => /\b(stress|defaults?|distress\w*|PIK|downgrad\w+|restructur\w+|bankrupt\w*|writedowns?|red flags?)\b/i.test(t)],
  ["retreat", (t) => /\b(halt\w*|paus(e|es|ed)|suspend\w*|scrap\w*|abandon\w*|shelv\w*|backs? off|winds? down|cuts? staff|layoffs?)\b/i.test(t)],
  ["fees", (t) => /\b(cuts?|slash\w*|lower\w*|reduc\w+|rais(es|ed)|hikes?) .{0,30}\bfees?\b|\bfee (cuts?|war)\b/i.test(t)],
  ["breakaway", (t) => /\b(team|duo|advisors?)\b.{0,30}\b(launch\w*|departs?|leaves?|forms?|creat\w+)\b|\bex-[\w.]+ (team|duo|advisors?)\b.{0,30}\blaunch/i.test(t)],
  [
    "advisor-move",
    (t, _x, i) =>
      /\b(adds?|recruits?|lands?|lures?|stakes?|draws?|hires?)\b.{0,40}\badvisors?( teams?)?\b/i.test(t) ||
      (/\b(adds?|recruits?|lands?|lures?|stakes?)\b.{0,40}\bteams?\b/i.test(t) && (i.section === "family-offices" || WEALTH_TOPIC.test(t))),
  ],
  ["deal-pushback", (t) => DEAL.test(t) && /\b(oppos\w+|block\w*|reject\w*|pushback|scrutiny|challeng\w+)\b/i.test(t)],
  ["deal-talks", (t) => DEAL.test(t) && /\b(possible|potential|talks|explor\w+|consider\w+|weigh\w*|mull\w*|reported|clues)\b/i.test(t)],
  ["raise-target", (t) => /\b(aims|plans|seeks|looks|targets|hopes) to raise\b|\bseeks \S*\s?[$€£]|\btargets? \S*\s?[$€£][\d.]+\w* (for|fund)/i.test(t)],
  ["venture", (t) => /\bseries [A-H]\b|\bseed round\b|\bfunding round\b|\bventure (capital|round|funding)\b|\bgrowth (capital|equity)\b/i.test(t)],
  ["fundraise", (t) => /\b(final|first) close\b|\bfundrais|\bhard cap\b|\boversubscribed\b|\bclos(es|ed|ing)? .{0,40}\bfunds?\b|\brais(e|es|ed|ing) .{0,40}\b(funds?|for new)\b|\baims to raise\b|\bcapital commitments\b/i.test(t)],
  ["secondaries", (t) => /\bcontinuation (vehicle|fund)s?\b|\bGP-led\b|\bsecondar(y|ies)\b/i.test(t)],
  ["survey", (t) => /\bsurvey\b|\bstudy\b|\breport finds\b|\bfinds\b|\bnew report\b|\bdata shows?\b/i.test(t)],
  ["policy", (t) => /\bSEC\b|\bCFTC\b|\bFINRA\b|\bregulat\w+|\brule(s|making)?\b|\bcommittee\b|\blegislation\b|\bCongress\b|\bballot\b/i.test(t)],
  ["activism", (t) => /\bactivis\w+|\bnominat\w+ directors\b|\bproxy (fight|battle|contest)\b|\bboard seats?\b/i.test(t)],
  ["outflows", (t) => /\boutflows?\b|\bredemptions?\b|\bwithdrawals?\b/i.test(t)],
  ["paper-gain", (t) => /\bpaper gain\b|\bgain on\b|\bstake (worth|valued)\b/i.test(t)],
  ["outlook", (t) => /\b(forecasts?|predicts?|expects?|sees|warns?|outlook|says)\b/i.test(t)],
  ["index-move", (t) => /\b(Dow|S&P( 500)?|Nasdaq|Russell 2000|FTSE|Nikkei)\b/.test(t) && MOVE.test(t)],
  ["exit", (t) => /\bIPOs?\b|\binitial public offering\b|\bgoes public\b|\bexits?\b|\bspin-?off\b|\bsale of\b|\b(agreed|agrees) to sell\b|\b(sells?|sold|selling) (its |a )?(stake|business|unit|portfolio)\b/i.test(t)],
  ["deal", (t) => DEAL.test(t)],
  ["financing", (t) => /\b(term )?loans?\b|\bfinancing\b|\brefinanc\w+|\bdebt\b|\bdeploy\w*|\blend(s|ing)?\b|\bcredit facility\b|\bCLOs?\b/i.test(t)],
  ["outflows", (t, x) => /\boutflows?\b|\bredemptions?\b|\bwithdraw\w*/i.test(x) || /\bshed\b.{0,30}\b(ETFs?|funds?)\b/i.test(t)],
  ["inflows", (t) => /\binflows?\b|\bnet new assets\b|\b(drew|draws?|attract\w*|pull(s|ed)? in)\b.{0,15}[$€£]|\bnew cash\b|\b(piles?|pour\w*) into\b/i.test(t)],
  ["board", (t) => /\bboard of directors\b|\bto (its |the )?board\b/i.test(t)],
  ["people", (t) => /\b(appoints?|appointed|appointment|names?|named|hires?|hired|promotes?|promoted|joins?|joined|to join|recruits?|taps|steps? down|resigns?|retires|retiring|succession|succeeds?|departs?|leaves|leaving|moves to|co-CEO|new CEO|out at)\b/i.test(t)],
  ["results", (t) => /\bearnings\b|\bresults\b|\bprofits?\b|\brevenues?\b|\bAUM\b|\bassets under management\b|\bassets (swell|climb|rise|grow|hit|reach)|\btops estimates\b|\bbeats?\b|\brecord haul\b|\bsurpass\w*\b|\btops \$/i.test(t)],
  ["partnership", (t) => /\bpartners? with\b|\bpartnership\b|\bteams? up\b|\bcollaborat\w+|\bintegrat\w+|\bties? up\b/i.test(t)],
  ["launch", (t) => /\blaunch(es|ed)?\b|\bunveils?\b|\bintroduc\w+|\bdebuts?\b|\brolls? out\b|\brollout\b|\bgoes live\b|\bopens? .{0,40}\bto\b|\bETN\b|\boffers? .{0,30}\b(ETP|ETF|fund)\b|\btokeni[sz]ed\b|\bnew (fund|product|platform|strategy)\b|\bexpands? .{0,30}\bcapabilit/i.test(t)],
  ["rates", (t, _x, i) => i.source.id.startsWith("fed") || /\bFed\b|\bFederal Reserve\b|\bFOMC\b|\brate (cut|hike|decision)s?\b|\binterest rates?\b|\binflation\b|\bCPI\b|\bPPI\b|\byields?\b|\bmortgage rates\b/i.test(t)],
  [
    "market-move",
    (t) =>
      /\b(stocks?|shares|equities|bonds?|yields?|bitcoin|crypto|index|market)\b/i.test(t) && MOVE.test(t),
  ],
];

export function eventOf(item: RawItem, takeaway: string): EventKind | null {
  const text = `${item.title} ${takeaway}`;
  return RULES.find(([, test]) => test(item.title, text, item))?.[0] ?? null;
}

// ── The sentences ─────────────────────────────────────────────────────────

function poss(name: string): string {
  if (/['’]s$/.test(name)) return name; // "Moody's"
  return /s$/.test(name) ? `${name}'` : `${name}'s`;
}

/** "Apollo's £5.7bn deal" / "Apollo's deal" / "The £5.7bn deal" / "The deal". */
function subject(actor: string | null, amount: string | null, noun: string): string {
  if (actor && amount) return `${poss(actor)} ${amount} ${noun}`;
  if (actor) return `${poss(actor)} ${noun}`;
  if (amount) return `The ${amount} ${noun}`;
  return `The ${noun}`;
}

/** What moved, from the headline: "AI stocks", "tech stocks", "bonds", "crypto" or just "stocks". */
function assetLabel(title: string): string {
  if (/\bAI\b|\bchips?\b|\bsemiconductor/i.test(title)) return "AI stocks";
  if (/\btech\b/i.test(title)) return "tech stocks";
  if (/\bbonds?\b|\bTreasur(y|ies)\b|\byields?\b/i.test(title)) return "bonds";
  if (/\bbitcoin\b|\bcrypto\b|\bether\b/i.test(title)) return "crypto";
  return "stocks";
}

const isWealth = (item: RawItem, theme: Theme) => theme.id === "family-office" || item.section === "family-offices" || WEALTH_TOPIC.test(item.title);

/** A big listed manager whose results speak for the industry (vs. an ordinary company's earnings). */
const isManager = (actor: string | null, text: string) =>
  (actor !== null && (CORE_FIRMS.has(actor) || actor in FIRM_PROFILES)) ||
  /\bAUM\b|assets under management|\binflows?\b|net new assets|\bfees?\b|asset manager|investment manager|wealth|committed capital|private capital|\bRIA\b|\bfund\b/i.test(text);

export function whyItMatters(item: RawItem, theme: Theme, takeaway: string, fromExcerpt = true): string {
  const event = eventOf(item, takeaway);
  const actor = actorFor(item, takeaway, fromExcerpt);
  const amount = amountIn(item.title) ?? (event === "deal" || event === "exit" || event === "deal-pushback" ? dealAmountIn(takeaway) : null);
  const topic = topicFor(item, takeaway);
  const wealth = isWealth(item, theme);
  const text = `${item.title} ${takeaway}`;
  const inTopic = topic ? ` in ${topic}` : "";
  const onTopic = topic ? ` on ${topic}` : "";

  switch (event) {
    case "filing":
      if (/13F/.test(item.title)) return `${actor ? `${poss(actor)} 13F` : "This 13F"} shows what it owned at quarter-end, but it is about 45 days old and covers only U.S.-listed long positions.`;
      return `${actor ? `${poss(actor)} filing` : "This filing"} is the official record behind any headlines, and companies must file within four business days of a material event.`;
    case "interview": {
      const speaker = speakerIn(item.title);
      return `${speaker ? `${poss(speaker)} take` : "This take"}${onTopic} comes from someone close to the action, so use it as a check on your own assumptions rather than as a forecast.`;
    }
    case "legal":
      if (wealth && /poach|non-solicit|ex-advis|former advis|employment contract/i.test(text)) {
        return "Fights over departing advisors decide how freely clients can follow the person they trust, and how hard wealth firms can recruit from each other.";
      }
      return `${actor ? `For ${actor}, the` : "The"} outcome could mean fines or new limits, and cases like this often set the rules the rest of the industry has to follow.`;
    case "credit-stress":
      return `Signs of strain${inTopic} are an early warning for its investors: more defaults or deferred interest would cut income and push down the value of the loans.`;
    case "retreat":
      return `${actor ? `${poss(actor)} step back` : "This step back"}${topic ? ` from ${topic}` : ""} suggests the strategy has become harder to raise money for or profit from, which can mean better prices and terms for those who stay in.`;
    case "fees":
      return `${actor ? `${poss(actor)} fee cut` : "This fee cut"} shows the pressure on what private-markets managers can charge, which over time leaves more of the return with investors.`;
    case "breakaway":
      return "Advisors keep leaving big banks to set up independent firms, giving clients more choice and putting pressure on the big firms' fees and payouts.";
    case "advisor-move":
      return "Advisors who move usually take most of their clients' assets with them, so moves like this show which firms are winning the competition for advisors and client money.";
    case "deal-pushback":
      return `${subject(actor, amount, "deal")} now faces pushback, a reminder that shareholder, political or regulatory resistance can delay or reprice big deals even after terms are agreed.`;
    case "deal-talks":
      return `A possible deal${actor ? ` involving ${actor}` : ""} is an early signal of where buyers see value, though talks like this often change or fall apart before anything is signed.`;
    case "raise-target":
      return `${subject(actor, amount, "target")} is a test of investor appetite${topic ? ` for ${topic}` : ""}, and how much is actually raised will show whether money is still flowing to the strategy.`;
    case "venture":
      return `${actor && amount ? `${actor} raising ${amount}` : actor ? `${poss(actor)} new funding` : "This funding round"} shows where growth investors are placing bets${inTopic}, and its price becomes a marker for rivals raising next.`;
    case "fundraise":
      return `${subject(actor, amount, "raise")} shows investors are still committing money${topic ? ` to ${topic}` : ""}, and a strong raise makes it easier for other managers in the strategy to raise too.`;
    case "secondaries":
      return "Continuation funds let managers keep their best assets longer while giving existing investors a way out, so the key question for investors is whether the price is fair.";
    case "survey":
      return `Findings like this show where${topic ? ` ${topic}` : " the industry"} is heading before it shows up in results, though one survey is a snapshot, not a trend.`;
    case "policy":
      if (/\b(roundtable|dialogue|MOU|cooperation|meeting|committee)\b/i.test(item.title)) {
        return "Meetings like this rarely change rules on their own, but they show what regulators are prioritising, which is often where new rules come from.";
      }
      if (/\bapprov\w+/i.test(item.title)) return "Regulatory approval opens the door for the product to launch, though demand and pricing will decide whether it matters for investors.";
      return `If regulators act on it, the change would affect how${topic ? ` ${topic}` : " these"} products are offered and taxed, so the industry is pushing for clarity before rules are set.`;
    case "activism":
      return `${actor ? `${poss(actor)} campaign` : "Activist campaigns like this"} can push a company to sell assets, cut costs or change leaders, and the share price often moves before anything changes.`;
    case "paper-gain":
      return `${subject(actor, amount, "paper gain")} shows how much early stakes${topic ? ` in ${topic} leaders` : ""} have made, though it stays on paper until the stake can be sold.`;
    case "outlook": {
      const who = outlookSource(item.title) ?? actor;
      return `${who ? `${poss(who)} view` : "This view"}${onTopic} is a useful benchmark from someone close to the market, but it is a forecast to weigh against your own, not a guarantee.`;
    }
    case "index-move":
    case "market-move": {
      const down = /\bsell-?off\b|\bplung|\btumbl|\bslump|\bsink|\bfall|\bfell\b|\bdrop|\bpressure\b|\brout\b|\bwreck\b|\bdump|\blosses\b|\blower\b|\bcorrection\b/i.test(item.title);
      const assets = event === "index-move" ? "stocks" : assetLabel(item.title);
      return down
        ? `A lasting selloff in ${assets} would cut the value of private companies priced against them and make IPOs harder, so watch whether it spreads.`
        : `Rising ${assets} lift the value of private companies priced against public peers and help keep the IPO window open for exits.`;
    }
    case "exit":
      return `${subject(actor, amount, "sale")} gives a live read on what private assets are really worth, and every completed sale returns cash that investors can put into new funds.`;
    case "deal":
      if (wealth) return `${actor ? `${poss(actor)} deal` : "This deal"} adds to the consolidation of advisory firms, which gives clients bigger platforms but can change their advisor's fees, products and independence.`;
      return `${subject(actor, amount, "deal")} is a fresh marker for what buyers will pay right now, so owners of similar businesses, and the funds that hold them, may be valued against it.`;
    case "financing":
      return `${actor ? `${poss(actor)} ${amount ? `${amount} ` : ""}deal` : amount ? `This ${amount} deal` : "This deal"} shows private lenders are still putting money to work${inTopic}, and the terms they win set the bar for returns across the strategy.`;
    case "outflows":
      if (/\b(fall|falls|fell|drop\w*|eas\w+|slow\w*|declin\w+|lower|shrink\w*)\b/i.test(item.title)) {
        return `Fewer withdrawal requests suggest investors are growing more comfortable${topic ? ` with ${topic}` : ""}, which eases pressure on managers to sell assets to pay them out.`;
      }
      return `${amount ? `${amount} of withdrawals` : "These withdrawals"} show investors cooling${onTopic}, and if outflows continue they weigh on prices and on the managers' fee income.`;
    case "inflows": {
      const who = actor && amount ? `${actor} pulling in ${amount}` : actor ? `New money for ${actor}` : amount ? `${amount} of new money` : "New money flowing in";
      return `${who} shows demand${topic ? ` for ${topic}` : ""} is still growing, and money keeps flowing to the biggest managers, which gives them more say over fees and terms.`;
    }
    case "board":
      return `Board picks signal where ${actor ?? "a firm"} wants outside expertise, so a new director's background is a hint about its next priorities.`;
    case "people":
      if (wealth) return "Advisors who move usually take most of their clients' assets with them, so moves like this show which firms are winning the competition for advisors and client money.";
      if (/\b(trader|portfolio manager|PM)\b/.test(text) || /\bfrom hedge fund\b|\bat hedge fund\b/i.test(item.title)) {
        return `${actor ? `For ${actor} and its rivals, star` : "Star"} traders often take capital and teams with them, so moves like this show which platforms are winning the fight for talent.`;
      }
      return `${actor ? `Leadership changes at ${actor}` : "Leadership changes like this"} can reset strategy and priorities, so clients and fund investors will watch what the new team changes.`;
    case "results":
      if (actor && amount && /\bsurpass\w*|\btops [$€£]|\bcross(es|ed)\b|\breach(es|ed)? [$€£]/i.test(item.title)) {
        return `${actor} reaching ${amount} shows how fast money is concentrating in the largest managers, which gives them more say over fees and terms with investors.`;
      }
      if (isManager(actor, text)) {
        return `${actor ? `${poss(actor)} results` : "These results"} show where client money is flowing right now, and gains at the biggest managers often come at the expense of smaller rivals chasing the same clients.`;
      }
      return `${actor ? `${poss(actor)} results` : "These results"} reset expectations${topic ? ` for ${topic}` : " for the sector"}, and a big surprise either way changes how investors value similar public and private companies.`;
    case "partnership":
      return `${actor ? `${poss(actor)} tie-up` : "This tie-up"} is a sign of where${topic ? ` ${topic}` : " the business"} is heading, but its value to investors depends on how many customers actually use it.`;
    case "launch":
      if (wealth || /\b(wealth|retail|individual|advis\w+)\b/i.test(text)) {
        return `${actor ? `${poss(actor)} new offering` : "This launch"} gives wealth clients and advisors a new way into${topic && topic !== "wealth management" ? ` ${topic}` : " the market"}; compare its fees and how easily you can get your money out with existing options.`;
      }
      return `${actor ? `${poss(actor)} launch` : "This launch"} adds a new way to invest${inTopic}, and how quickly it attracts money will show how deep demand really is.`;
    case "rates":
      if (item.source.id.startsWith("fed")) return "Fed officials' comments move expectations for the next rate decision, which sets borrowing costs for deals and the yield on cash and bonds.";
      return "Moves in rates feed straight into borrowing costs for deals, bond prices and property values, so they change the hurdle every investment has to clear.";
    default:
      return pickBySeed(theme.why, item.id);
  }
}
