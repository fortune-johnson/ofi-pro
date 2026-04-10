"use client";

import { startTransition, useEffect, useState } from "react";
import { Activity, BrainCircuit, Gauge, LoaderCircle, Radar, ShieldCheck, Waves } from "lucide-react";

import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TRADEABLE_ASSETS, pairLabel, timeframeLabel } from "@/lib/markets";
import {
  fetchEASignals,
  fetchScoreboard,
  fetchStrategies,
  runBacktest,
  type BacktestResponse,
  type EAScanResponse,
  type ScoreboardResponse,
  type StrategiesResponse,
} from "@/lib/trading-lab";
import { cn } from "@/lib/utils";

const dayOptions = ["5", "10", "20", "30", "60", "100"];

export default function ExpertAdvisorPage() {
  const [engineState, setEngineState] = useState<StrategiesResponse | null>(null);
  const [engineLoading, setEngineLoading] = useState(true);
  const [engineError, setEngineError] = useState("");
  const [selectedPair, setSelectedPair] = useState("EUR_USD");
  const [selectedTf, setSelectedTf] = useState("M5");
  const [backtestDays, setBacktestDays] = useState("30");
  const [signals, setSignals] = useState<EAScanResponse | null>(null);
  const [signalsLoading, setSignalsLoading] = useState(true);
  const [signalsError, setSignalsError] = useState("");
  const [scoreboard, setScoreboard] = useState<ScoreboardResponse | null>(null);
  const [scoreboardLoading, setScoreboardLoading] = useState(true);
  const [scoreboardError, setScoreboardError] = useState("");
  const [backtest, setBacktest] = useState<BacktestResponse | null>(null);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestError, setBacktestError] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");

  useEffect(() => {
    let active = true;
    void fetchStrategies()
      .then((payload) => {
        if (active) startTransition(() => setEngineState(payload));
      })
      .catch((error) => {
        if (active) setEngineError(error instanceof Error ? error.message : "Unable to load EA engine.");
      })
      .finally(() => {
        if (active) setEngineLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadSignals() {
      try {
        setSignalsError("");
        const payload = await fetchEASignals(selectedTf, "ict_smc_engine", selectedPair);
        if (!active) return;
        startTransition(() => setSignals(payload));
      } catch (error) {
        if (!active) return;
        setSignalsError(error instanceof Error ? error.message : "Unable to load EA signals.");
      } finally {
        if (active) setSignalsLoading(false);
      }
    }
    setSignalsLoading(true);
    void loadSignals();
    const intervalId = window.setInterval(() => {
      void loadSignals();
    }, 30_000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [selectedPair, selectedTf]);

  useEffect(() => {
    let active = true;
    async function loadScoreboard() {
      try {
        setScoreboardError("");
        const payload = await fetchScoreboard(selectedPair, selectedTf);
        if (!active) return;
        startTransition(() => setScoreboard(payload));
      } catch (error) {
        if (!active) return;
        setScoreboardError(error instanceof Error ? error.message : "Unable to load learning scoreboard.");
      } finally {
        if (active) setScoreboardLoading(false);
      }
    }
    setScoreboardLoading(true);
    void loadScoreboard();
    return () => {
      active = false;
    };
  }, [selectedPair, selectedTf]);

  async function handleBacktest() {
    try {
      setBacktestLoading(true);
      setBacktestError("");
      const payload = await runBacktest(selectedPair, selectedTf, Number(backtestDays), "ict_smc_engine");
      startTransition(() => setBacktest(payload));
    } catch (error) {
      setBacktestError(error instanceof Error ? error.message : "Unable to run the EA backtest.");
      setBacktest(null);
    } finally {
      setBacktestLoading(false);
    }
  }

  const engine = engineState?.strategies[0] ?? null;
  const liveSignalRow = signals?.signals.find((item) => item.pair === selectedPair) ?? null;
  const learningRow = scoreboard?.rows[0] ?? engine?.scoreboard ?? null;

  useEffect(() => {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      return;
    }
    if (!notificationsEnabled || Notification.permission !== "granted" || !liveSignalRow?.signal) {
      return;
    }
    const signal = liveSignalRow.signal;
    const body = `${pairLabel(selectedPair)} ${timeframeLabel(selectedTf)} ${signal.direction} setup at ${signal.entry}. Confidence ${signal.confidence}%.`;
    const cacheKey = `ofi-pro-notified:${selectedPair}:${selectedTf}:${signal.time}:${signal.entry}`;
    if (window.sessionStorage.getItem(cacheKey)) {
      return;
    }
    window.sessionStorage.setItem(cacheKey, "1");
    new Notification("OFI Pro signal detected", { body });
  }, [liveSignalRow, notificationsEnabled, selectedPair, selectedTf]);

  async function handleEnableNotifications() {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      setNotificationMessage("Browser notifications are not available in this environment.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setNotificationsEnabled(true);
      setNotificationMessage("Signal notifications enabled for this browser.");
      return;
    }
    setNotificationsEnabled(false);
    setNotificationMessage("Signal notifications were not enabled. Please allow browser notifications to receive alerts.");
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <Badge className="border border-emerald-400/20 bg-emerald-500/10 px-4 py-1 text-[11px] uppercase tracking-[0.24em] text-emerald-200">
            Our Expert Advisor
          </Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            One ICT and SMC execution engine, synchronized with order flow.
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            The EA now focuses on ICT and SMC concepts together: FVG, order blocks, CISD, MSS, mitigation blocks, breaker blocks,
            breakaway gaps, dealing range logic, and liquidity sweeps, with order-flow confirmation layered on top.
          </p>
        </div>

        <Card className="mt-8 border border-white/10 bg-white/[0.04]">
          <CardContent className="grid gap-4 px-4 py-4 md:grid-cols-3">
            <Select value={selectedPair} onValueChange={(value) => value && setSelectedPair(value)}>
              <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-slate-950/60 text-white"><SelectValue /></SelectTrigger>
              <SelectContent>{TRADEABLE_ASSETS.map((pair) => <SelectItem key={pair} value={pair}>{pairLabel(pair)}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={selectedTf} onValueChange={(value) => value && setSelectedTf(value)}>
              <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-slate-950/60 text-white"><SelectValue /></SelectTrigger>
              <SelectContent>{["M1", "M5", "M15", "H1", "H4"].map((item) => <SelectItem key={item} value={item}>{timeframeLabel(item)}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={backtestDays} onValueChange={(value) => value && setBacktestDays(value)}>
              <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-slate-950/60 text-white"><SelectValue /></SelectTrigger>
              <SelectContent>{dayOptions.map((item) => <SelectItem key={item} value={item}>{item} days</SelectItem>)}</SelectContent>
            </Select>
          </CardContent>
        </Card>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="overflow-hidden border border-cyan-400/20 bg-[linear-gradient(135deg,rgba(8,20,36,0.96),rgba(3,10,20,0.92))]">
            <CardHeader>
              <Badge className="border border-cyan-400/20 bg-cyan-500/10 text-cyan-200">Engine Profile</Badge>
              <CardTitle className="pt-4 text-2xl text-white">{engine?.name ?? "Loading EA engine"}</CardTitle>
              <CardDescription className="text-slate-300">{engine?.tagline ?? "Waiting for engine data."}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {engine ? (
                <>
                  <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4 text-sm leading-7 text-slate-300">{engine.description}</div>
                  {engine.intelligenceNote ? <div className="rounded-2xl border border-cyan-400/15 bg-cyan-500/10 px-4 py-3 text-sm leading-7 text-cyan-50">{engine.intelligenceNote}</div> : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ["Framework", engine.style],
                      ["Supported timeframes", engine.preferredTimeframes.map((item) => timeframeLabel(item)).join(", ")],
                      ["Learning window", `${engine.lookback} candles`],
                      ["Risk model", engine.riskModel],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-4">
                        <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</div>
                        <div className="mt-2 text-sm font-medium text-white">{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-3xl border border-amber-400/20 bg-amber-500/10 px-4 py-4 text-sm leading-7 text-amber-100">
                    Risk management remains non-negotiable. The EA is modeled around 1% risk per trade and learning from disciplined execution, not overexposure.
                  </div>
                </>
              ) : engineLoading ? (
                <div className="flex items-center gap-3 text-sm text-slate-300"><LoaderCircle className="size-4 animate-spin text-cyan-300" />Loading engine profile</div>
              ) : null}
              {engineError ? <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{engineError}</div> : null}
            </CardContent>
          </Card>

          <Card className="border border-white/10 bg-white/[0.04]">
            <CardHeader>
              <Badge className="w-fit border border-white/10 bg-white/5 text-slate-300">Live Signal</Badge>
              <CardTitle className="pt-4 text-2xl text-white">{pairLabel(selectedPair)} · {timeframeLabel(selectedTf)}</CardTitle>
              <CardDescription className="text-slate-400">
                Current ICT and SMC signal state for the selected asset and timeframe.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={() => void handleEnableNotifications()} variant="outline" className="h-11 w-full rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10">
                Enable Signal Notifications
              </Button>
              {notificationMessage ? <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 text-sm text-slate-300">{notificationMessage}</div> : null}
              {signalsLoading ? (
                <div className="flex items-center gap-3 text-sm text-slate-300"><LoaderCircle className="size-4 animate-spin text-cyan-300" />Loading live signal</div>
              ) : liveSignalRow?.signal ? (
                <div className={cn("rounded-3xl border p-4", liveSignalRow.signal.direction === "bullish" ? "border-emerald-400/25 bg-emerald-500/10" : "border-rose-400/25 bg-rose-500/10")}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{liveSignalRow.signal.direction}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{liveSignalRow.signal.confidence}% confidence</div>
                    </div>
                    <div className="text-right text-sm text-slate-200">Last price {liveSignalRow.lastPrice}</div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 text-sm text-slate-200">
                    <div>Entry: {liveSignalRow.signal.entry}</div>
                    <div>Reference: {liveSignalRow.signal.referenceLevel}</div>
                    <div>SL: {liveSignalRow.signal.stopLoss}</div>
                    <div>TP: {liveSignalRow.signal.takeProfit}</div>
                  </div>
                  <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/35 px-3 py-3 text-xs leading-6 text-slate-300">{liveSignalRow.signal.reason}</div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/35 px-4 py-6 text-sm leading-7 text-slate-400">
                  No active ICT and SMC signal right now. The EA is still reading structure, liquidity, and order-flow conditions.
                </div>
              )}
              {signalsError ? <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{signalsError}</div> : null}
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card className="border border-white/10 bg-white/[0.04]">
            <CardHeader>
              <Badge className="w-fit border border-white/10 bg-white/5 text-slate-300">Learning Scoreboard</Badge>
              <CardTitle className="pt-4 text-2xl text-white">How the EA has been learning</CardTitle>
              <CardDescription className="text-slate-400">
                Simulated since January 1, 2026 on a $100,000 account with 1% risk per trade.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {scoreboardLoading ? (
                <div className="flex items-center gap-3 text-sm text-slate-300"><LoaderCircle className="size-4 animate-spin text-cyan-300" />Loading learning scoreboard</div>
              ) : (
                <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-white">{engine?.name ?? "ICT SMC Precision Engine"}</div>
                      <div className="mt-1 text-xs text-slate-400">One synchronized EA trained across ICT and SMC concepts with order-flow confluence.</div>
                    </div>
                    <Badge className="border border-white/10 bg-white/5 text-slate-300">Adaptive engine</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3 text-sm text-slate-300">
                    <div>Balance: {learningRow ? `$${learningRow.currentBalance.toLocaleString()}` : "Not loaded"}</div>
                    <div>PnL: {learningRow ? `${learningRow.pnlPercentage}%` : "Not loaded"}</div>
                    <div>Trades: {learningRow ? learningRow.trades : "Not loaded"}</div>
                    <div>Win rate: {learningRow ? `${learningRow.winRate}%` : "Not loaded"}</div>
                    <div>Risk: 1% per trade</div>
                    <div>Max DD: {learningRow ? `${learningRow.maxDrawdown}%` : "Not loaded"}</div>
                  </div>
                </div>
              )}
              {scoreboardError ? <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{scoreboardError}</div> : null}
            </CardContent>
          </Card>

          <Card className="border border-white/10 bg-white/[0.04]">
            <CardHeader>
              <Badge className="w-fit border border-white/10 bg-white/5 text-slate-300">Backtest Engine</Badge>
              <CardTitle className="pt-4 text-2xl text-white">Run the ICT and SMC engine</CardTitle>
              <CardDescription className="text-slate-400">
                Backtest days range from 5 to 100, and the results show how the EA has been learning from market structure and order-flow context.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={() => void handleBacktest()} disabled={backtestLoading} className="h-12 w-full rounded-full bg-cyan-500 font-semibold text-slate-950 hover:bg-cyan-400">
                {backtestLoading ? <><LoaderCircle className="mr-2 size-4 animate-spin" />Running backtest</> : <><Radar className="mr-2 size-4" />Run Backtest</>}
              </Button>

              {backtest ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ["Current balance", `$${backtest.summary.currentBalance.toLocaleString()}`],
                      ["PnL", `${backtest.summary.pnlPercentage}%`],
                      ["Trades", String(backtest.summary.totalTrades)],
                      ["Win rate", `${backtest.summary.winRate}%`],
                      ["Net R", String(backtest.summary.netR)],
                      ["Max drawdown", `${backtest.summary.maxDrawdownPercentage}%`],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-4">
                        <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</div>
                        <div className="mt-2 text-xl font-semibold text-white">{value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    {backtest.trades.slice(-6).reverse().map((trade) => (
                      <div key={`${trade.time}-${trade.entry}`} className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-300">
                        <div className="flex items-center justify-between">
                          <span>{trade.direction} setup</span>
                          <span>{trade.outcome}</span>
                        </div>
                        <div className="mt-2 text-xs text-slate-400">
                          Entry {trade.entry} | Exit {trade.exitPrice} | {trade.pnlPips} pips | {trade.rMultiple}R
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {backtestError ? <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{backtestError}</div> : null}
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-4">
          {[
            { icon: Waves, title: "ICT and SMC core", copy: "The EA now focuses on fair value gaps, order blocks, CISD, MSS, breakers, mitigation, breakaway gaps, and dealing range logic." },
            { icon: BrainCircuit, title: "Learning loop", copy: "Backtests are used as a learning reference so the engine improves with more reviewed market history." },
            { icon: ShieldCheck, title: "Risk-forward", copy: "Every signal and learning metric is framed around strict 1% risk per trade." },
            { icon: Gauge, title: "Order-flow aligned", copy: "Signals only become more aggressive when structure and order-flow are moving in sync." },
          ].map((item) => (
            <Card key={item.title} className="border border-white/10 bg-white/[0.04]">
              <CardHeader>
                <div className="flex size-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10"><item.icon className="size-5 text-cyan-200" /></div>
                <CardTitle className="pt-4 text-lg text-white">{item.title}</CardTitle>
                <CardDescription className="text-sm leading-7 text-slate-400">{item.copy}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-sm leading-7 text-slate-300">
          <div className="flex items-center gap-2 text-white"><Activity className="size-4 text-cyan-200" />Engine note</div>
          Signals, backtests, and learning stats are now centered on one ICT and SMC engine so the whole workflow stays in sync and easier to trust.
        </div>
      </div>
    </PageShell>
  );
}
