"use client";

import Link from "next/link";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  LoaderCircle,
  Radar,
  RefreshCcw,
} from "lucide-react";

import { LiveMarketChart } from "@/components/live-market-chart";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { extractBias, extractConfidence, extractDrivers, formatConfidenceScore, type AnalyzeResponse } from "@/lib/analysis";
import { AUTO_REFRESH_INTERVAL_MS, API_BASE_URL } from "@/lib/live-market";
import {
  formatPrice,
  formatSigned,
  toWebSocketBaseUrl,
  type CandlePoint,
  type MarketClock,
  type MarketHistoryResponse,
  type MarketStreamEvent,
  type LiveQuote,
} from "@/lib/market-data";
import {
  CHART_MODES,
  FOREX_PAIRS,
  isAnalysisTimeframe,
  isForexPair,
  pairLabel,
  timeframeLabel,
  type AnalysisTimeframe,
  type ChartMode,
  type ForexPair,
} from "@/lib/markets";
import { cn } from "@/lib/utils";

const WS_BASE_URL = toWebSocketBaseUrl(API_BASE_URL);
function normalizeCandles(candles: CandlePoint[]) {
  return candles.map((candle) => ({
    ...candle,
    time: Number(candle.time) as CandlePoint["time"],
  }));
}

function sessionChange(candles: CandlePoint[]) {
  if (candles.length < 2) return { value: 0, percent: 0 };
  const first = candles[0];
  const last = candles[candles.length - 1];
  const value = last.close - first.open;
  const percent = first.open ? (value / first.open) * 100 : 0;
  return { value, percent };
}

export default function ChartPage() {
  const [pair, setPair] = useState<ForexPair>("EUR_USD");
  const [timeframe, setTimeframe] = useState<AnalysisTimeframe>("M1");
  const [mode, setMode] = useState<ChartMode>("candlestick");
  const [live, setLive] = useState(true);
  const [candles, setCandles] = useState<CandlePoint[]>([]);
  const [quote, setQuote] = useState<LiveQuote | null>(null);
  const [marketClock, setMarketClock] = useState<MarketClock | null>(null);
  const [connectionLabel, setConnectionLabel] = useState("Loading");
  const [loadingChart, setLoadingChart] = useState(false);
  const [streamError, setStreamError] = useState("");
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const reconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlPair = params.get("pair");
    const urlTimeframe = params.get("timeframe");

    if (urlPair && isForexPair(urlPair)) {
      setPair(urlPair);
    }

    if (urlTimeframe && isAnalysisTimeframe(urlTimeframe)) {
      setTimeframe(urlTimeframe);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setLoadingChart(true);
    setStreamError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/market-data/history?pair=${pair}&timeframe=${timeframe}&count=240`
      );
      const raw = (await response.json()) as MarketHistoryResponse | { detail?: string };

      if (!response.ok) {
        throw new Error("detail" in raw ? raw.detail || "Unable to load chart history." : "Unable to load chart history.");
      }

      const data = raw as MarketHistoryResponse;
      setCandles(normalizeCandles(data.candles));
      setQuote(data.quote);
      setMarketClock(data.marketClock);
      setConnectionLabel("History Loaded");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load chart history.";
      setStreamError(message);
      setConnectionLabel("Load Failed");
    } finally {
      setLoadingChart(false);
    }
  }, [pair, timeframe]);

  const loadAnalysis = useCallback(async () => {
    setAnalysisLoading(true);
    setAnalysisError("");

    try {
      const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pair,
          timeframe,
          detailed: false,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.detail || "Analysis unavailable");
      }

      startTransition(() => {
        setAnalysis(data);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to refresh analysis.";
      setAnalysisError(message);
    } finally {
      setAnalysisLoading(false);
    }
  }, [pair, timeframe]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    void loadAnalysis();
    const intervalId = window.setInterval(() => {
      void loadAnalysis();
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadAnalysis]);

  useEffect(() => {
    if (!live) {
      setConnectionLabel("Paused");
      return undefined;
    }

    let socket: WebSocket | null = null;
    let shouldReconnect = true;

    const connect = () => {
      setConnectionLabel("Connecting");
      socket = new WebSocket(`${WS_BASE_URL}/ws/market-data/${pair}?timeframe=${timeframe}`);

      socket.onopen = () => {
        setConnectionLabel("Live Stream");
        setStreamError("");
      };

      socket.onmessage = (message) => {
        const payload = JSON.parse(message.data) as MarketStreamEvent;

        if (payload.type === "snapshot") {
          setCandles(normalizeCandles(payload.candles));
          setQuote(payload.quote);
          setMarketClock(payload.marketClock);
          return;
        }

        if (payload.type === "tick") {
          setQuote(payload.quote);
          setMarketClock(payload.marketClock);

          setCandles((current) => {
            const next = [...current];
            const candle = { ...payload.candle, time: Number(payload.candle.time) as CandlePoint["time"] };

            if (payload.replace && next.length > 0) {
              next[next.length - 1] = candle;
              return next;
            }

            if (next.length > 400) {
              next.shift();
            }

            next.push(candle);
            return next;
          });
          return;
        }

        if (payload.type === "heartbeat") {
          setMarketClock(payload.marketClock);
          return;
        }

        if (payload.type === "error") {
          setStreamError(payload.detail);
          setConnectionLabel("Stream Error");
        }
      };

      socket.onclose = () => {
        if (!shouldReconnect) return;
        setConnectionLabel("Reconnecting");
        reconnectTimerRef.current = window.setTimeout(connect, 1500);
      };

      socket.onerror = () => {
        setConnectionLabel("Connection Error");
      };
    };

    connect();

    return () => {
      shouldReconnect = false;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      socket?.close();
    };
  }, [live, pair, timeframe]);

  const bias = analysis ? extractBias(analysis.messages, analysis.summary) : { label: "Waiting for analysis", tone: "neutral" as const };
  const confidence = analysis ? extractConfidence(analysis.messages, analysis.summary) : null;
  const drivers = analysis
    ? extractDrivers(analysis.messages, analysis.summary).slice(0, 3)
    : [];

  const latest = candles[candles.length - 1];
  const change = useMemo(() => sessionChange(candles), [candles]);

  return (
    <PageShell transparentHeader>
      <div className="mx-auto max-w-[1540px] px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <Badge className="border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-violet-200">
              OFI Pro Live Charts
            </Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Broker-fed charting with live sessions, quote flow, and cleaner execution context.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              History loads first, then the live stream keeps the chart moving in real time while session status,
              day of week, and London/New York context stay visible on the screen.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/analyze?pair=${pair}&timeframe=${timeframe}`}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "rounded-full border-white/15 bg-white/5 px-5 text-white hover:bg-white/10"
              )}
            >
              Open Analyzer
            </Link>
            <Button
              size="lg"
              onClick={() => void loadAnalysis()}
              className="rounded-full bg-violet-500 px-5 text-white hover:bg-violet-400"
            >
              {analysisLoading ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <RefreshCcw className="mr-2 size-4" />}
              Refresh Bias
            </Button>
          </div>
        </div>

        <Card className="mt-8 border border-white/10 bg-white/[0.04]">
          <CardContent className="grid gap-4 px-4 py-4 md:grid-cols-2 xl:grid-cols-[1fr_0.75fr_0.9fr_0.45fr]">
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Pair</div>
              <Select value={pair} onValueChange={(value) => value && setPair(value as ForexPair)}>
                <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-slate-950/60 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FOREX_PAIRS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {pairLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Timeframe</div>
              <Select value={timeframe} onValueChange={(value) => value && setTimeframe(value as AnalysisTimeframe)}>
                <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-slate-950/60 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["M1", "M5", "M15", "M30", "H1", "H4"].map((item) => (
                    <SelectItem key={item} value={item}>
                      {timeframeLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Chart Mode</div>
              <div className="flex h-11 items-center rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm text-white">
                {CHART_MODES[0].label}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Live</div>
              <button
                type="button"
                onClick={() => setLive((value) => !value)}
                className={cn(
                  "flex h-11 w-full items-center justify-between rounded-2xl border px-4 text-sm transition",
                  live
                    ? "border-violet-400/25 bg-violet-500/10 text-white"
                    : "border-white/10 bg-slate-950/60 text-slate-300"
                )}
              >
                <span>{live ? "Streaming" : "Paused"}</span>
                <span className={cn("size-2.5 rounded-full", live ? "bg-emerald-300" : "bg-slate-500")} />
              </button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.34fr_0.66fr]">
          <div className="space-y-6">
            <LiveMarketChart
              pair={pair}
              timeframe={timeframe}
              mode={mode}
              candles={candles}
              quote={quote}
              marketClock={marketClock}
              connectionLabel={connectionLabel}
            />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Last Price",
                  value: latest ? formatPrice(pair, latest.close) : "--",
                  tone: "text-white",
                },
                {
                  label: "Session Move",
                  value: `${formatSigned(change.percent)}%`,
                  tone: change.percent >= 0 ? "text-emerald-300" : "text-rose-300",
                },
                {
                  label: "Spread",
                  value: quote ? `${quote.spreadPips.toFixed(2)} pips` : "--",
                  tone: "text-violet-200",
                },
                {
                  label: "Feed",
                  value: connectionLabel,
                  tone: connectionLabel === "Live Stream" ? "text-emerald-300" : "text-slate-200",
                },
              ].map((stat) => (
                <Card key={stat.label} className="border border-white/10 bg-white/[0.04]">
                  <CardContent className="px-5 py-4">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{stat.label}</div>
                    <div className={cn("mt-3 text-2xl font-semibold", stat.tone)}>{stat.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <Card className="border border-white/10 bg-white/[0.04]">
              <CardHeader>
                <CardDescription className="text-slate-400">Market Status</CardDescription>
                <CardTitle className="text-2xl text-white">{marketClock?.activeSession ?? "Loading session..."}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  {[
                    {
                      label: "Day",
                      value: marketClock?.weekday ?? "--",
                      tone: "text-white",
                    },
                    {
                      label: "Market",
                      value: marketClock?.marketOpen ? "Open" : "Closed",
                      tone: marketClock?.marketOpen ? "text-emerald-300" : "text-rose-300",
                    },
                    {
                      label: "London",
                      value: marketClock?.londonOpen ? `Open • ${marketClock.londonTime}` : `Closed • ${marketClock?.londonTime ?? "--"}`,
                      tone: marketClock?.londonOpen ? "text-emerald-300" : "text-slate-300",
                    },
                    {
                      label: "New York",
                      value: marketClock?.newYorkOpen ? `Open • ${marketClock.newYorkTime}` : `Closed • ${marketClock?.newYorkTime ?? "--"}`,
                      tone: marketClock?.newYorkOpen ? "text-emerald-300" : "text-slate-300",
                    },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                      <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{item.label}</div>
                      <div className={cn("mt-3 text-lg font-semibold", item.tone)}>{item.value}</div>
                    </div>
                  ))}
                </div>

                {streamError ? (
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
                    {streamError}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border border-white/10 bg-white/[0.04]">
              <CardHeader>
                <CardDescription className="text-slate-400">Bias Snapshot</CardDescription>
                <CardTitle className="text-2xl text-white">{bias.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Confidence</div>
                      <div className="mt-3 text-4xl font-semibold text-white">
                        {confidence !== null ? formatConfidenceScore(confidence) : "--"}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 p-3">
                      <Radar className="size-5 text-violet-200" />
                    </div>
                  </div>
                  <Progress value={confidence ?? 0} className="mt-5">
                    <ProgressLabel className="text-slate-300">Signal Strength</ProgressLabel>
                    <div className="ml-auto text-xs text-slate-400">
                      {confidence !== null ? formatConfidenceScore(confidence) : "--"}
                    </div>
                  </Progress>
                </div>

                <div className="space-y-3">
                  {drivers.length > 0 ? (
                    drivers.map((driver, index) => (
                      <div key={`${driver}-${index}`} className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm leading-6 text-slate-300">
                        {driver}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/45 px-4 py-3 text-sm leading-6 text-slate-400">
                      Analysis drivers will appear after the next live refresh.
                    </div>
                  )}
                </div>

                {analysisError ? (
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
                    {analysisError}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border border-white/10 bg-white/[0.04]">
              <CardContent className="px-5 py-5">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <Activity className="size-4 text-violet-200" />
                  Quick navigation
                </div>
                <Separator className="my-4 bg-white/10" />
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/analyze?pair=${pair}&timeframe=${timeframe}`}
                    className={cn(
                      buttonVariants({ size: "lg" }),
                      "rounded-full bg-violet-500 px-5 text-white hover:bg-violet-400"
                    )}
                  >
                    Full Analyzer
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                  <Link
                    href="/dashboard"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "lg" }),
                      "rounded-full border-white/10 bg-white/5 px-5 text-white hover:bg-white/10"
                    )}
                  >
                    Dashboard
                  </Link>
                </div>
                {loadingChart ? (
                  <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
                    <LoaderCircle className="size-4 animate-spin" />
                    Loading live market history
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
