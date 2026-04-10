"use client";

import { startTransition, useEffect, useEffectEvent, useState } from "react";

import {
  extractBias,
  extractConfidence,
  extractDrivers,
  extractPrice,
  type AnalyzeResponse,
  type PairBias,
} from "@/lib/analysis";
import { formatPrice, type MarketHistoryResponse } from "@/lib/market-data";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const AUTO_REFRESH_INTERVAL_MS = 60_000;

export type PairSnapshot = {
  pair: string;
  price: string;
  bias: PairBias;
  confidence: number;
  driver: string;
  grade: string;
};

function gradeConfidence(confidence: number) {
  if (confidence >= 90) return "A+";
  if (confidence >= 80) return "A";
  if (confidence >= 70) return "B+";
  if (confidence >= 60) return "B";
  if (confidence >= 50) return "C";
  return "F";
}

export async function fetchAnalysis(pair: string, timeframe: string, detailed = false) {
  const response = await fetch(`${API_BASE_URL}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pair, timeframe, detailed }),
    cache: "no-store",
  });

  const payload = (await response.json()) as AnalyzeResponse | { detail?: string };
  if (!response.ok) {
    throw new Error("detail" in payload ? payload.detail || "Analysis unavailable" : "Analysis unavailable");
  }

  return payload as AnalyzeResponse;
}

export function toPairSnapshot(response: AnalyzeResponse): PairSnapshot {
  const confidence = extractConfidence(response.messages, response.summary);
  const bias = extractBias(response.messages, response.summary).compact;
  const drivers = extractDrivers(response.messages, response.summary);
  const price =
    response.summary?.price !== undefined
      ? formatPrice(response.pair, response.summary.price)
      : extractPrice(response.messages, response.summary);

  return {
    pair: response.pair,
    price,
    bias,
    confidence,
    driver: drivers[0] ?? "Live analysis available.",
    grade: response.summary?.grade ?? gradeConfidence(confidence),
  };
}

export async function fetchMarketHistory(pair: string, timeframe: string, count = 240) {
  const response = await fetch(
    `${API_BASE_URL}/market-data/history?pair=${pair}&timeframe=${timeframe}&count=${count}`,
    { cache: "no-store" }
  );

  const payload = (await response.json()) as MarketHistoryResponse | { detail?: string };
  if (!response.ok) {
    throw new Error("detail" in payload ? payload.detail || "Unable to load market data." : "Unable to load market data.");
  }

  return payload as MarketHistoryResponse;
}

export function usePairSnapshots(pairs: string[], timeframe: string, refreshMs = AUTO_REFRESH_INTERVAL_MS) {
  const [data, setData] = useState<PairSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSnapshots = useEffectEvent(async () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
    try {
      setError("");
      const results = await Promise.all(pairs.map(async (pair) => toPairSnapshot(await fetchAnalysis(pair, timeframe))));
      startTransition(() => {
        setData(results);
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load market snapshot.");
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    setLoading(true);
    void loadSnapshots();

    const intervalId = window.setInterval(() => {
      void loadSnapshots();
    }, refreshMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadSnapshots, pairs, refreshMs, timeframe]);

  return { data, loading, error, reload: loadSnapshots };
}

export function useMarketHistory(pair: string, timeframe: string, count = 240, refreshMs = AUTO_REFRESH_INTERVAL_MS) {
  const [data, setData] = useState<MarketHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadHistory = useEffectEvent(async () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
    try {
      setError("");
      const payload = await fetchMarketHistory(pair, timeframe, count);
      startTransition(() => {
        setData(payload);
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load market data.");
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    setLoading(true);
    void loadHistory();

    const intervalId = window.setInterval(() => {
      void loadHistory();
    }, refreshMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [count, loadHistory, pair, refreshMs, timeframe]);

  return { data, loading, error, reload: loadHistory };
}
