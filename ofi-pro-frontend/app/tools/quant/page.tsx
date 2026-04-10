"use client";

import { startTransition, useEffect, useState } from "react";
import { BarChart3, BrainCircuit, History, LoaderCircle, Radar, ScrollText, Sparkles } from "lucide-react";

import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ANALYSIS_TIMEFRAMES, TRADEABLE_ASSETS, pairLabel, timeframeLabel } from "@/lib/markets";
import {
  fetchAutomaticPredictions,
  fetchManualPrediction,
  fetchPreviousCalls,
  fetchQuantSummary,
  trainPredictionModels,
  type AutomaticPredictionResponse,
  type PredictionResponse,
  type PreviousCallsResponse,
  type QuantSummaryResponse,
  type TrainModelsResponse,
} from "@/lib/trading-lab";

const summaryModes = [
  { value: "current", label: "Current day" },
  { value: "yesterday", label: "Yesterday" },
  { value: "custom", label: "Custom date" },
] as const;

export default function QuantPage() {
  const [manualPair, setManualPair] = useState("EUR_USD");
  const [manualTf, setManualTf] = useState("M5");
  const [level, setLevel] = useState("");
  const [manualResult, setManualResult] = useState<PredictionResponse | null>(null);
  const [manualError, setManualError] = useState("");
  const [manualLoading, setManualLoading] = useState(false);

  const [autoTf, setAutoTf] = useState("M5");
  const [autoResult, setAutoResult] = useState<AutomaticPredictionResponse | null>(null);
  const [autoError, setAutoError] = useState("");
  const [autoLoading, setAutoLoading] = useState(true);

  const [trainingState, setTrainingState] = useState<TrainModelsResponse | null>(null);
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [trainingError, setTrainingError] = useState("");

  const [historyPair, setHistoryPair] = useState("EUR_USD");
  const [historyTf, setHistoryTf] = useState("M5");
  const [previousCalls, setPreviousCalls] = useState<PreviousCallsResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const [summaryPair, setSummaryPair] = useState("EUR_USD");
  const [summaryTf, setSummaryTf] = useState("M15");
  const [summaryMode, setSummaryMode] = useState("current");
  const [summaryDate, setSummaryDate] = useState("");
  const [summaryResult, setSummaryResult] = useState<QuantSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadAutomatic() {
      try {
        setAutoError("");
        const payload = await fetchAutomaticPredictions(autoTf, [...TRADEABLE_ASSETS.slice(0, 12)]);
        if (!active) return;
        startTransition(() => setAutoResult(payload));
      } catch (error) {
        if (!active) return;
        setAutoError(error instanceof Error ? error.message : "Unable to load automatic AI forecasts.");
      } finally {
        if (active) setAutoLoading(false);
      }
    }

    setAutoLoading(true);
    void loadAutomatic();
    const intervalId = window.setInterval(() => {
      void loadAutomatic();
    }, 45_000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [autoTf]);

  async function handleManualAsk() {
    const numericLevel = Number(level);
    if (!Number.isFinite(numericLevel)) {
      setManualError("Enter a valid price level first.");
      return;
    }

    try {
      setManualLoading(true);
      setManualError("");
      const payload = await fetchManualPrediction(manualPair, manualTf, numericLevel);
      startTransition(() => setManualResult(payload));
    } catch (error) {
      setManualError(error instanceof Error ? error.message : "Unable to run the manual AI forecast.");
      setManualResult(null);
    } finally {
      setManualLoading(false);
    }
  }

  async function handleTrainModels() {
    try {
      setTrainingLoading(true);
      setTrainingError("");
      const payload = await trainPredictionModels([...TRADEABLE_ASSETS], [...ANALYSIS_TIMEFRAMES.filter((item) => item !== "M30")]);
      startTransition(() => setTrainingState(payload));
    } catch (error) {
      setTrainingError(error instanceof Error ? error.message : "Unable to train prediction models.");
    } finally {
      setTrainingLoading(false);
    }
  }

  async function handleLoadHistory() {
    try {
      setHistoryLoading(true);
      setHistoryError("");
      const payload = await fetchPreviousCalls(historyPair, historyTf);
      startTransition(() => setPreviousCalls(payload));
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "Unable to load previous calls.");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleSummary() {
    try {
      setSummaryLoading(true);
      setSummaryError("");
      const payload = await fetchQuantSummary(summaryPair, summaryTf, summaryMode, summaryMode === "custom" ? summaryDate : undefined);
      startTransition(() => setSummaryResult(payload));
    } catch (error) {
      setSummaryError(error instanceof Error ? error.message : "Unable to summarize that day.");
      setSummaryResult(null);
    } finally {
      setSummaryLoading(false);
    }
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <Badge className="border border-sky-400/20 bg-sky-500/10 px-4 py-1 text-[11px] uppercase tracking-[0.24em] text-sky-200">
            Our Quant
          </Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            A surgical quant desk learning from price, structure, and order flow.
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            Manual mode lets traders query a precise level with invalidation. Automatic mode watches markets continuously,
            stores calls, and grows from each review cycle with a Temporal Fusion and TiDE-ready forecasting pipeline.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card className="border border-fuchsia-400/20 bg-[linear-gradient(135deg,rgba(29,9,48,0.94),rgba(8,8,22,0.92))]">
            <CardHeader>
              <Badge className="w-fit border border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-200">Manual Mode</Badge>
              <CardTitle className="pt-4 text-2xl text-white">Ask about a level</CardTitle>
              <CardDescription className="text-slate-300">
                The quant now combines pattern memory and order-flow bias before giving a call.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Select value={manualPair} onValueChange={(value) => value && setManualPair(value)}>
                  <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-slate-950/60 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>{TRADEABLE_ASSETS.map((pair) => <SelectItem key={pair} value={pair}>{pairLabel(pair)}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={manualTf} onValueChange={(value) => value && setManualTf(value)}>
                  <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-slate-950/60 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>{["M1", "M5", "M15", "H1", "H4"].map((item) => <SelectItem key={item} value={item}>{timeframeLabel(item)}</SelectItem>)}</SelectContent>
                </Select>
                <input value={level} onChange={(event) => setLevel(event.target.value)} placeholder="Price level" className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-white outline-none placeholder:text-slate-500" />
              </div>

              <Button onClick={() => void handleManualAsk()} disabled={manualLoading} className="h-12 w-full rounded-full bg-fuchsia-500 font-semibold text-white hover:bg-fuchsia-400">
                {manualLoading ? <><LoaderCircle className="mr-2 size-4 animate-spin" />Asking the model</> : <><BrainCircuit className="mr-2 size-4" />Run Quant Call</>}
              </Button>

              {manualResult ? (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ["Bias", manualResult.forecastBias],
                      ["Confidence", `${manualResult.confidence}%`],
                      ["Watch zone", String(manualResult.watchZone)],
                      ["Current", String(manualResult.currentPrice)],
                      ["Projected", String(manualResult.projectedPrice)],
                      ["May reach", `${manualResult.mayReachProbability}%`],
                      ["May not reach", `${manualResult.mayNotReachProbability}%`],
                      ["Invalidation", String(manualResult.invalidationLevel)],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-4">
                        <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</div>
                        <div className="mt-2 text-lg font-semibold text-white">{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-slate-950/45 px-4 py-4 text-sm leading-7 text-slate-300">
                    {manualResult.message}
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 text-xs uppercase tracking-[0.18em] text-slate-400">
                    Model architecture: {manualResult.modelArchitecture ?? "Temporal Fusion / TiDE-ready sequence feature stack"}
                  </div>
                </div>
              ) : null}

              {manualError ? <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{manualError}</div> : null}
            </CardContent>
          </Card>

          <Card className="border border-white/10 bg-white/[0.04]">
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Badge className="w-fit border border-white/10 bg-white/5 text-slate-300">Automatic Mode</Badge>
                  <CardTitle className="pt-4 text-2xl text-white">The quant watches markets for you</CardTitle>
                  <CardDescription className="text-slate-400">
                    Auto mode scans multiple assets and pushes the strongest surgical watch zones first.
                  </CardDescription>
                </div>
                <div className="w-32">
                  <Select value={autoTf} onValueChange={(value) => value && setAutoTf(value)}>
                    <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-slate-950/60 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>{["M1", "M5", "M15", "H1", "H4"].map((item) => <SelectItem key={item} value={item}>{timeframeLabel(item)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-3xl border border-fuchsia-400/15 bg-[linear-gradient(135deg,rgba(217,70,239,0.09),rgba(59,130,246,0.06))] p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Persistent model training</div>
                    <div className="mt-1 text-sm leading-6 text-slate-400">
                      Retrain the quant across forex, BTC, gold, silver, and NASDAQ timeframes.
                    </div>
                  </div>
                  <Button onClick={() => void handleTrainModels()} disabled={trainingLoading} className="rounded-full bg-fuchsia-500 px-5 text-white hover:bg-fuchsia-400">
                    {trainingLoading ? <><LoaderCircle className="mr-2 size-4 animate-spin" />Training</> : <><Sparkles className="mr-2 size-4" />Train Models</>}
                  </Button>
                </div>
                {trainingState ? <div className="mt-4 text-sm text-slate-300">Trained {trainingState.count} model snapshots. Latest run: {new Date(trainingState.generatedAt).toLocaleString()}. Architecture: {trainingState.trainedModels[0]?.architecture ?? "Temporal Fusion / TiDE-ready sequence feature stack"}.</div> : null}
                {trainingError ? <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{trainingError}</div> : null}
              </div>

              {autoLoading ? (
                <div className="flex items-center gap-3 text-sm text-slate-300">
                  <LoaderCircle className="size-4 animate-spin text-fuchsia-300" />
                  Scanning automatic forecasts
                </div>
              ) : (
                <div className="grid gap-3">
                  {autoResult?.alerts.map((alert) => (
                    <div key={`${alert.pair}-${alert.timeframe}`} className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white">{pairLabel(alert.pair)}</div>
                          <div className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-500">{timeframeLabel(alert.timeframe)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-white">{alert.forecastBias}</div>
                          <div className="text-xs text-fuchsia-200">{alert.confidence}% confidence</div>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3 text-sm text-slate-300">
                        <div>Watch zone: {alert.watchZone}</div>
                        <div>Current: {alert.currentPrice}</div>
                        <div>Projected: {alert.projectedPrice}</div>
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2 text-xs text-slate-400">
                        <div>May reach: {alert.mayReachProbability}%</div>
                        <div>May not reach: {alert.mayNotReachProbability}%</div>
                      </div>
                      <div className="mt-2 text-xs uppercase tracking-[0.18em] text-sky-200">Invalidation: {alert.invalidationLevel}</div>
                      <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm leading-6 text-slate-300">{alert.message}</div>
                    </div>
                  ))}
                </div>
              )}

              {autoError ? <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{autoError}</div> : null}
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card className="border border-white/10 bg-white/[0.04]">
            <CardHeader>
              <Badge className="w-fit border border-white/10 bg-white/5 text-slate-300">Summary</Badge>
              <CardTitle className="pt-4 text-2xl text-white">Summarize a market day</CardTitle>
              <CardDescription className="text-slate-400">
                Review what happened, what buyers and sellers did, what the quant learnt, and what to watch next.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Select value={summaryPair} onValueChange={(value) => value && setSummaryPair(value)}>
                  <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-slate-950/60 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>{TRADEABLE_ASSETS.map((pair) => <SelectItem key={pair} value={pair}>{pairLabel(pair)}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={summaryTf} onValueChange={(value) => value && setSummaryTf(value)}>
                  <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-slate-950/60 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>{["M1", "M5", "M15", "H1", "H4"].map((item) => <SelectItem key={item} value={item}>{timeframeLabel(item)}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={summaryMode} onValueChange={(value) => value && setSummaryMode(value)}>
                  <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-slate-950/60 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>{summaryModes.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                </Select>
                <input type="date" value={summaryDate} onChange={(event) => setSummaryDate(event.target.value)} disabled={summaryMode !== "custom"} className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-white outline-none disabled:opacity-50" />
              </div>
              <Button onClick={() => void handleSummary()} disabled={summaryLoading} className="h-12 w-full rounded-full bg-sky-500 font-semibold text-slate-950 hover:bg-sky-400">
                {summaryLoading ? <><LoaderCircle className="mr-2 size-4 animate-spin" />Building summary</> : <><ScrollText className="mr-2 size-4" />Summary</>}
              </Button>
              {summaryResult ? (
                <div className="space-y-3">
                  {[summaryResult.message, summaryResult.orderflowBreakdown, summaryResult.buyersVsSellers, summaryResult.quantLearnt, summaryResult.nextDayWatchout].map((item) => (
                    <div key={item} className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm leading-7 text-slate-300">{item}</div>
                  ))}
                </div>
              ) : null}
              {summaryError ? <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{summaryError}</div> : null}
            </CardContent>
          </Card>

          <Card className="border border-white/10 bg-white/[0.04]">
            <CardHeader>
              <Badge className="w-fit border border-white/10 bg-white/5 text-slate-300">Previous Calls</Badge>
              <CardTitle className="pt-4 text-2xl text-white">See how the quant called it</CardTitle>
              <CardDescription className="text-slate-400">
                Pull stored calls by asset and timeframe to review what played out and what missed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Select value={historyPair} onValueChange={(value) => value && setHistoryPair(value)}>
                  <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-slate-950/60 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>{TRADEABLE_ASSETS.map((pair) => <SelectItem key={pair} value={pair}>{pairLabel(pair)}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={historyTf} onValueChange={(value) => value && setHistoryTf(value)}>
                  <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-slate-950/60 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>{["M1", "M5", "M15", "H1", "H4"].map((item) => <SelectItem key={item} value={item}>{timeframeLabel(item)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button onClick={() => void handleLoadHistory()} disabled={historyLoading} className="h-12 w-full rounded-full bg-white text-slate-950 hover:bg-slate-200">
                {historyLoading ? <><LoaderCircle className="mr-2 size-4 animate-spin" />Loading calls</> : <><History className="mr-2 size-4" />Previous Calls</>}
              </Button>
              <div className="space-y-3">
                {previousCalls?.calls.map((call) => (
                  <div key={call.id} className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{pairLabel(call.pair)} · {timeframeLabel(call.timeframe)}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{call.forecastBias} · {call.confidence}%</div>
                      </div>
                      <div className="text-right text-xs">
                        <div className={call.outcomeStatus === "played_out" ? "text-emerald-300" : call.outcomeStatus === "missed" ? "text-rose-300" : "text-amber-300"}>
                          {call.outcomeStatus.replace("_", " ")}
                        </div>
                        <div className="text-slate-500">{new Date(call.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3 text-sm text-slate-300">
                      <div>Watch: {call.watchZone}</div>
                      <div>Projected: {call.projectedPrice}</div>
                      <div>Invalidation: {call.invalidationLevel}</div>
                    </div>
                  </div>
                ))}
                {previousCalls && previousCalls.calls.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-400">No stored calls for this asset and timeframe yet.</div> : null}
              </div>
              {historyError ? <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{historyError}</div> : null}
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {[
            { icon: Radar, title: "Order-flow enhanced", copy: "Confidence is adjusted with live order-book and position-book context instead of price-only pattern memory." },
            { icon: BarChart3, title: "Multi-timeframe", copy: "Manual and automatic quant now work on 1 min, 5 min, 15 min, 1 hour, and 4 hour views." },
            { icon: Sparkles, title: "Learning loop", copy: "Stored calls and summary reviews turn each session into another training reference for the desk." },
          ].map((item) => (
            <Card key={item.title} className="border border-white/10 bg-white/[0.04]">
              <CardHeader>
                <div className="flex size-11 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-500/10"><item.icon className="size-5 text-sky-200" /></div>
                <CardTitle className="pt-4 text-lg text-white">{item.title}</CardTitle>
                <CardDescription className="text-sm leading-7 text-slate-400">{item.copy}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
