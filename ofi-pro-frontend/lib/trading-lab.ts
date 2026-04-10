import { API_BASE_URL } from "@/lib/live-market";

export type EASignal = {
  pair: string;
  time: string;
  direction: "bullish" | "bearish";
  entry: number;
  referenceLevel: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  session: string;
  sweep: string;
  confidence: number;
  reason: string;
};

export type EASignalRow = {
  pair: string;
  strategyId: string;
  strategyName: string;
  signal: EASignal | null;
  lastPrice: number;
  status: "signal" | "waiting";
};

export type EAScanResponse = {
  timeframe: string;
  generatedAt: string;
  signals: EASignalRow[];
};

export type StrategySummary = {
  strategyId: string;
  currentBalance: number;
  pnlPercentage: number;
  trades: number;
  winRate: number;
  maxDrawdown: number;
  lastBacktestedAt: string;
};

export type StrategyDefinition = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  style: string;
  preferredTimeframes: string[];
  lookback: number;
  rr: number;
  min_confidence: number;
  riskModel: string;
  intelligenceNote?: string;
  scoreboard?: StrategySummary | null;
};

export type StrategiesResponse = {
  generatedAt: string;
  strategies: StrategyDefinition[];
};

export type ScoreboardResponse = {
  pair: string;
  timeframe: string;
  generatedAt: string;
  rows: StrategySummary[];
};

export type BacktestTrade = EASignal & {
  outcome: string;
  exitPrice: number;
  exitTime: string;
  pnlPips: number;
  rMultiple: number;
  balanceChange: number;
  maxFavorablePips: number;
  maxAdversePips: number;
};

export type BacktestResponse = {
  pair: string;
  timeframe: string;
  days: number;
  strategyId: string;
  strategyName: string;
  testedBars: number;
  generatedAt: string;
  summary: {
    totalTrades: number;
    wins: number;
    losses: number;
    winRate: number;
    netR: number;
    avgR: number;
    currentBalance: number;
    pnlPercentage: number;
    riskPerTrade: string;
    maxDrawdownPercentage: number;
  };
  trades: BacktestTrade[];
};

export type PredictionResponse = {
  pair: string;
  timeframe: string;
  trainedSamples: number;
  currentPrice: number;
  forecastBias: "Bullish" | "Bearish" | "Neutral";
  confidence: number;
  projectedPrice: number;
  expectedMovePips?: number;
  trainedAt: string;
  queriedLevel?: number;
  mayReachProbability: number;
  mayNotReachProbability: number;
  invalidationLevel: number;
  guidance?: string;
  watchZone?: number;
  message?: string;
  orderflowBias?: string;
  modelArchitecture?: string;
  callId?: string;
};

export type AutomaticPredictionResponse = {
  timeframe: string;
  generatedAt: string;
  alerts: PredictionResponse[];
};

export type TrainModelsResponse = {
  trainedModels: Array<{
    pair: string;
    timeframe: string;
    samples: number;
    architecture: string;
    trainedAt: string;
  }>;
  count: number;
  generatedAt: string;
};

export type QuantPreviousCall = PredictionResponse & {
  id: string;
  createdAt: string;
  mode: "manual" | "automatic";
  outcomeStatus: "played_out" | "missed" | "mixed";
};

export type PreviousCallsResponse = {
  generatedAt: string;
  calls: QuantPreviousCall[];
};

export type QuantSummaryResponse = {
  pair: string;
  timeframe: string;
  date: string;
  marketOpen: boolean;
  message: string;
  orderflowBreakdown: string;
  buyersVsSellers: string;
  quantLearnt: string;
  nextDayWatchout: string;
};

export type FundamentalsResponse = {
  pair: string;
  timeframe: string;
  generatedAt: string;
  macroBias: string;
  summary: string;
  drivers: string[];
  timeframeExpectations: Record<
    string,
    {
      expectedBias: string;
      impact: string;
      watch: string;
    }
  >;
  learningState: {
    retrainedAt?: string | null;
    runs: number;
    note: string;
  };
};

export type FundamentalsRetrainResponse = {
  runs: number;
  retrainedAt: string;
  message: string;
};

async function getJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.detail || "Request failed.");
  }
  return payload as T;
}

export function fetchEASignals(timeframe = "M5", strategyId?: string, pair?: string) {
  const params = new URLSearchParams({ timeframe });
  if (strategyId) params.set("strategyId", strategyId);
  if (pair) params.set("pair", pair);
  return getJson<EAScanResponse>(`${API_BASE_URL}/ea/signals?${params.toString()}`);
}

export function fetchStrategies() {
  return getJson<StrategiesResponse>(`${API_BASE_URL}/ea/strategies`);
}

export function fetchScoreboard(pair: string, timeframe: string) {
  return getJson<ScoreboardResponse>(`${API_BASE_URL}/ea/scoreboard?pair=${pair}&timeframe=${timeframe}`);
}

export function runBacktest(pair: string, timeframe: string, days: number, strategyId = "ict_smc_engine") {
  return getJson<BacktestResponse>(`${API_BASE_URL}/ea/backtest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pair, timeframe, days, strategyId }),
  });
}

export function fetchManualPrediction(pair: string, timeframe: string, level: number) {
  return getJson<PredictionResponse>(`${API_BASE_URL}/ai/manual`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pair, timeframe, level }),
  });
}

export function fetchAutomaticPredictions(timeframe: string, pairs: string[]) {
  return getJson<AutomaticPredictionResponse>(`${API_BASE_URL}/ai/automatic`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ timeframe, pairs }),
  });
}

export function trainPredictionModels(pairs: string[], timeframes: string[]) {
  return getJson<TrainModelsResponse>(`${API_BASE_URL}/ai/train`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pairs, timeframes }),
  });
}

export function fetchPreviousCalls(pair?: string, timeframe?: string) {
  const params = new URLSearchParams();
  if (pair) params.set("pair", pair);
  if (timeframe) params.set("timeframe", timeframe);
  return getJson<PreviousCallsResponse>(`${API_BASE_URL}/ai/previous-calls?${params.toString()}`);
}

export function fetchQuantSummary(pair: string, timeframe: string, dayMode: string, date?: string) {
  return getJson<QuantSummaryResponse>(`${API_BASE_URL}/ai/summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pair, timeframe, dayMode, date }),
  });
}

export function fetchFundamentals(pair: string, timeframe: string) {
  return getJson<FundamentalsResponse>(`${API_BASE_URL}/fundamentals/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pair, timeframe }),
  });
}

export function retrainFundamentals() {
  return getJson<FundamentalsRetrainResponse>(`${API_BASE_URL}/fundamentals/retrain`, {
    method: "POST",
  });
}
