"use client";

import { startTransition, useEffect, useState } from "react";
import { Activity, FlaskConical, History, LineChart, LoaderCircle, Radar } from "lucide-react";

import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TRADEABLE_ASSETS, pairLabel, timeframeLabel } from "@/lib/markets";
import { fetchStrategies, runBacktest, type BacktestResponse, type StrategiesResponse } from "@/lib/trading-lab";

function BacktestContent() {
  const [pair, setPair] = useState("EUR_USD");
  const [timeframe, setTimeframe] = useState("M5");
  const [days, setDays] = useState("30");
  const [strategyId, setStrategyId] = useState("ict_smc_engine");
  const [strategies, setStrategies] = useState<StrategiesResponse | null>(null);
  const [result, setResult] = useState<BacktestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetchStrategies().then((payload) => {
      if (active) setStrategies(payload);
    }).catch(() => null);
    return () => {
      active = false;
    };
  }, []);

  async function handleRun() {
    try {
      setLoading(true);
      setError("");
      const payload = await runBacktest(pair, timeframe, Number(days), strategyId);
      startTransition(() => {
        setResult(payload);
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to run backtest.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <Badge className="border border-white/10 bg-white/5 text-slate-300">Backtesting</Badge>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Run the Expert Advisor across recent market history.
        </h1>
        <p className="mt-4 text-lg leading-8 text-slate-300">
          Replay the same EA logic used by the live signal desk and study how it performed over the last 100 days at maximum.
        </p>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {[
          {
            icon: History,
            title: "Historical replay",
            copy: "Rebuild recent opportunity flow from the exact strategy rules instead of guessing by eye.",
          },
          {
            icon: LineChart,
            title: "Trade outcome review",
            copy: "Study win rate, R multiple, drawdown, and recent execution examples from the EA.",
          },
          {
            icon: FlaskConical,
            title: "Strategy lab",
            copy: "Switch pair, timeframe, and day range to compare how the same logic behaves in different contexts.",
          },
        ].map((item) => (
          <Card key={item.title} className="border border-white/10 bg-white/[0.04]">
            <CardHeader>
              <item.icon className="size-5 text-emerald-300" />
              <CardTitle className="pt-4 text-lg text-white">{item.title}</CardTitle>
              <CardDescription className="text-sm leading-7 text-slate-400">{item.copy}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="mt-8 border border-emerald-400/20 bg-emerald-500/10">
        <CardContent className="space-y-5 px-6 py-6">
          <div>
            <div className="flex items-center gap-2 text-white">
              <Activity className="size-4 text-emerald-200" />
              <span className="font-medium">Run a real EA backtest</span>
            </div>
            <div className="mt-2 text-sm leading-6 text-emerald-50/80">
              Choose pair, timeframe, and day range. The engine replays the same liquidity-sweep strategy logic behind the live dashboard.
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <Select value={pair} onValueChange={(value) => value && setPair(value)}>
              <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-slate-950/60 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRADEABLE_ASSETS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {pairLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={timeframe} onValueChange={(value) => value && setTimeframe(value)}>
              <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-slate-950/60 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["M1", "M5", "M15", "H1", "H4"].map((item) => (
                  <SelectItem key={item} value={item}>
                    {timeframeLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={days} onValueChange={(value) => value && setDays(value)}>
              <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-slate-950/60 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["5", "10", "20", "30", "60", "100"].map((item) => (
                  <SelectItem key={item} value={item}>
                    {item} days
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={() => void handleRun()} disabled={loading} className="h-11 rounded-2xl bg-slate-950 text-white hover:bg-slate-900">
              {loading ? <LoaderCircle className="size-4 animate-spin" /> : <Radar className="size-4" />}
              <span className="ml-2">Run</span>
            </Button>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm leading-7 text-slate-300">
            {strategies?.strategies[0]?.name ?? "ICT SMC Precision Engine"} is the active EA model here. It combines ICT and SMC concepts with order-flow confirmation and a learning-backed backtest workflow.
          </div>

          {result ? (
            <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Trades", String(result.summary.totalTrades)],
                  ["Win rate", `${result.summary.winRate}%`],
                  ["Net R", String(result.summary.netR)],
                  ["Avg R", String(result.summary.avgR)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</div>
                    <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                {result.trades.slice(-6).reverse().map((trade) => (
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

          {error ? (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {error}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

export default function BacktestPage() {
  return (
    <PageShell>
      <BacktestContent />
    </PageShell>
  );
}
