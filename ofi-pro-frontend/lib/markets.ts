export const FOREX_PAIRS = [
  "EUR_USD",
  "GBP_USD",
  "USD_JPY",
  "AUD_USD",
  "NZD_USD",
  "USD_CAD",
  "USD_CHF",
  "EUR_GBP",
  "EUR_JPY",
  "EUR_CHF",
  "EUR_CAD",
  "EUR_AUD",
  "EUR_NZD",
  "GBP_JPY",
  "GBP_CHF",
  "GBP_CAD",
  "GBP_AUD",
  "GBP_NZD",
  "AUD_JPY",
  "AUD_CHF",
  "AUD_CAD",
  "AUD_NZD",
  "NZD_JPY",
  "NZD_CHF",
  "NZD_CAD",
  "CAD_JPY",
  "CAD_CHF",
  "CHF_JPY",
] as const;

export const EXTENDED_ASSETS = ["BTC_USD", "XAU_USD", "XAG_USD", "NAS100_USD"] as const;
export const TRADEABLE_ASSETS = [...FOREX_PAIRS, ...EXTENDED_ASSETS] as const;
export const ANALYSIS_TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4"] as const;
export const FUNDAMENTALS_TIMEFRAMES = ["H1", "H4", "D1"] as const;

export const CHART_MODES = [
  { value: "candlestick", label: "Candlestick" },
] as const;

export type ForexPair = (typeof FOREX_PAIRS)[number];
export type TradeableAsset = (typeof TRADEABLE_ASSETS)[number];
export type AnalysisTimeframe = (typeof ANALYSIS_TIMEFRAMES)[number];
export type FundamentalsTimeframe = (typeof FUNDAMENTALS_TIMEFRAMES)[number];
export type ChartMode = (typeof CHART_MODES)[number]["value"];

const pairLabels: Record<string, string> = {
  BTC_USD: "BTC/USD",
  XAU_USD: "Gold (XAU/USD)",
  XAG_USD: "Silver (XAG/USD)",
  NAS100_USD: "NASDAQ",
};

export function pairLabel(pair: string) {
  return pairLabels[pair] ?? pair.replace("_", "/");
}

export function timeframeLabel(timeframe: string) {
  switch (timeframe) {
    case "M1":
      return "1 min";
    case "M5":
      return "5 min";
    case "M15":
      return "15 min";
    case "M30":
      return "30 min";
    case "H1":
      return "1 hour";
    case "H4":
      return "4 hour";
    case "D1":
      return "1 day";
    default:
      return timeframe;
  }
}

export function isForexPair(value: string): value is ForexPair {
  return FOREX_PAIRS.includes(value as ForexPair);
}

export function isTradeableAsset(value: string): value is TradeableAsset {
  return TRADEABLE_ASSETS.includes(value as TradeableAsset);
}

export function isAnalysisTimeframe(value: string): value is AnalysisTimeframe {
  return ANALYSIS_TIMEFRAMES.includes(value as AnalysisTimeframe);
}

export function isFundamentalsTimeframe(value: string): value is FundamentalsTimeframe {
  return FUNDAMENTALS_TIMEFRAMES.includes(value as FundamentalsTimeframe);
}
