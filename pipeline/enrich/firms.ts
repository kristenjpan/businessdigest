import { CORE_FIRMS } from "../types";

/**
 * Qualitative one-line profiles used to explain why a firm's news carries weight.
 * Deliberately free of AUM or other figures that would go stale.
 */
export const FIRM_PROFILES: Record<string, string> = {
  Blackstone:
    "Blackstone is the world's largest alternative asset manager and a leader in real estate and private-wealth products, so its moves are widely read as a bellwether for private markets.",
  KKR: "KKR pioneered the leveraged buyout and now spans private equity, infrastructure, credit and insurance, so its activity is a barometer for global dealmaking.",
  Apollo:
    "Apollo is a private-credit heavyweight whose insurance arm, Athene, supplies long-term capital, which makes it central to the fusion of insurance and private lending.",
  Carlyle: "Carlyle is one of the largest global private-equity firms, with major credit and secondaries businesses, and a closely watched signal for fundraising and exits.",
  Bridgewater:
    "Bridgewater is the world's largest hedge fund by assets and a leading macro investor, so its positioning and views are closely tracked by institutions.",
  Brookfield: "Brookfield is a global leader in infrastructure, renewable power and real assets, so its deals shape the market for long-lived hard assets.",
  Ares: "Ares is among the largest private-credit managers, which makes it a key read on direct-lending conditions and the non-bank lending boom.",
  "Blue Owl": "Blue Owl specialises in direct lending, GP stakes and digital infrastructure, sitting at the center of private credit and data-center financing.",
  TPG: "TPG is a major global private-equity firm known for growth, impact and healthcare investing, and a useful signal for sponsor appetite.",
  Oaktree: "Oaktree, co-founded by Howard Marks, is a leading credit and distressed-debt investor whose views on risk cycles are followed across the industry.",
  BlackRock: "BlackRock is the world's largest asset manager and is expanding aggressively into private markets, so its moves shape how mainstream investors access alternatives.",
  "Goldman Sachs": "Goldman Sachs is a top global investment bank and growing alternatives manager, with a front-row view of deal, capital-markets and client flows.",
  "J.P. Morgan": "J.P. Morgan is the largest U.S. bank and a major wealth manager, so its research and commentary carry weight with executives and families.",
  "Morgan Stanley": "Morgan Stanley runs one of the largest wealth-management businesses, a key distribution channel for private-market products.",
  Citadel: "Citadel is one of the largest and most successful multi-strategy hedge funds, making it a benchmark for the pod-based model.",
  Millennium: "Millennium is a leading multi-strategy hedge fund whose growth and talent moves influence the whole pod-shop industry.",
  Elliott: "Elliott Management is one of the most influential activist investors, and its campaigns can force strategy changes at large companies.",
  "Pershing Square": "Pershing Square, led by Bill Ackman, runs concentrated, high-conviction bets that often move markets and headlines.",
  Berkshire: "Berkshire Hathaway's capital allocation is studied as a model of long-term, patient investing.",
  "Bain Capital": "Bain Capital is a major private-equity and credit investor whose deals are a read on sponsor appetite in its sectors.",
  "Thoma Bravo": "Thoma Bravo is the largest software-focused private-equity firm, so its deals signal how sponsors value tech businesses.",
  "Warburg Pincus": "Warburg Pincus is a veteran growth-equity investor, a useful read on growth-stage private valuations.",
  EQT: "EQT is Europe's largest private-equity firm, and a bellwether for European dealmaking and infrastructure.",
  "Vista Equity": "Vista Equity Partners is a leading enterprise-software buyout firm, and a signal for software valuations.",
};

/** The most significant firm on an item: core firms first, then any profiled firm. */
export function leadFirm(firms: string[]): string | null {
  return firms.find((f) => CORE_FIRMS.includes(f)) ?? firms.find((f) => f in FIRM_PROFILES) ?? null;
}
