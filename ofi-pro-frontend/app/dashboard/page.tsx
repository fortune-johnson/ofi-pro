"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  CandlestickChart,
  ChevronRight,
  Gauge,
  LayoutDashboard,
  LoaderCircle,
  Radar,
  RefreshCcw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { formatConfidenceScore } from "@/lib/analysis";
import { usePairSnapshots, type PairSnapshot } from "@/lib/live-market";
import { pairLabel } from "@/lib/markets";
import { cn } from "@/lib/utils";

const seedPairs = ["EUR_USD", "GBP_USD", "USD_JPY", "AUD_USD", "USD_CAD", "USD_CHF"];

const appLinks = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Analyzer", href: "/analyze", icon: Radar },
  { label: "Chart", href: "/chart", icon: CandlestickChart },
  { label: "Backtest", href: "/backtest", icon: Activity },
  { label: "Pricing", href: "/pricing", icon: Gauge },
  { label: "About", href: "/about", icon: ShieldCheck },
];

function pairTone(bias: PairSnapshot["bias"]) {
  if (bias === "Bullish") {
    return {
      label: "text-emerald-300",
      badge: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
      bar: "bg-emerald-400",
      icon: TrendingUp,
    };
  }

  if (bias === "Bearish") {
    return {
      label: "text-rose-300",
      badge: "border-rose-400/20 bg-rose-500/10 text-rose-200",
      bar: "bg-rose-400",
      icon: TrendingDown,
    };
  }

  return {
    label: "text-slate-200",
    badge: "border-white/10 bg-white/5 text-slate-200",
    bar: "bg-slate-300",
    icon: Radar,
  };
}

export default function DashboardPage() {
  const { user, planLabel } = useAuth();
  const [selectedPair, setSelectedPair] = useState(seedPairs[0]);
  const { data: pairCards, loading, error: loadError, reload: loadMarketSnapshot } = usePairSnapshots(seedPairs, "M15");

  useEffect(() => {
    if (!pairCards.some((pair) => pair.pair === selectedPair) && pairCards[0]) {
      setSelectedPair(pairCards[0].pair);
    }
  }, [pairCards, selectedPair]);

  const selectedMarket = useMemo(
    () => pairCards.find((pair) => pair.pair === selectedPair) ?? null,
    [pairCards, selectedPair]
  );

  const marketStats = useMemo(() => {
    const bullish = pairCards.filter((pair) => pair.bias === "Bullish").length;
    const bearish = pairCards.filter((pair) => pair.bias === "Bearish").length;
    const averageConfidence =
      pairCards.length > 0
        ? Math.round(pairCards.reduce((sum, pair) => sum + pair.confidence, 0) / pairCards.length)
        : 0;

    return {
      bullish,
      bearish,
      averageConfidence,
    };
  }, [pairCards]);

  const selectedTone = selectedMarket ? pairTone(selectedMarket.bias) : pairTone("Neutral");
  const SelectedIcon = selectedTone.icon;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,_#020617_0%,_#061018_48%,_#020617_100%)] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.08),transparent_28%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.06),transparent_22%)]" />

      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col lg:flex-row">
        <aside className="border-b border-white/10 bg-slate-950/85 p-5 backdrop-blur-xl lg:min-h-screen lg:w-72 lg:border-b-0 lg:border-r">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-500/10">
                <CandlestickChart className="size-5 text-emerald-200" />
              </div>
              <div>
                <div className="text-lg font-semibold tracking-[0.18em] uppercase">OFI Pro</div>
                <div className="text-xs text-slate-400">Market Desk</div>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-emerald-400/15 bg-[linear-gradient(180deg,rgba(16,185,129,0.12),rgba(15,23,42,0.6))] p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-emerald-200/80">Trading Workspace</div>
              <div className="mt-3 text-lg font-semibold text-white">Minimal market overview</div>
              <div className="mt-2 text-sm leading-6 text-slate-300">
                Scan majors, compare conviction, and move straight into analysis or charts.
              </div>
              {user ? (
                <Badge className="mt-4 border border-white/10 bg-white/5 text-slate-200">
                  Signed in / {planLabel}
                </Badge>
              ) : null}
            </div>
          </div>

          <nav className="mt-6 space-y-2">
            {appLinks.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300 transition hover:bg-white/[0.06]",
                  item.href === "/dashboard" && "border-emerald-400/25 bg-emerald-500/10 text-white"
                )}
              >
                <span className="flex items-center gap-3">
                  <item.icon className="size-4" />
                  {item.label}
                </span>
                <ChevronRight className="size-4 text-slate-500" />
              </Link>
            ))}
          </nav>

          <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <Activity className="size-4 text-emerald-200" />
              Desk note
            </div>
            <div className="mt-3 text-sm leading-6 text-slate-400">
              Refresh the snapshot to update the market matrix, then open the pair that deserves attention.
            </div>
            <Link href="/analyze" className="mt-4 inline-flex text-sm font-medium text-emerald-200 transition hover:text-emerald-100">
              Open analyzer
            </Link>
          </div>
        </aside>

        <section className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Badge className="border border-emerald-400/20 bg-emerald-500/10 text-emerald-200">Market Desk</Badge>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">Dashboard</h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
                A clean trading overview with quick pair selection and direct chart access.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                variant="outline"
                className="rounded-full border-white/10 bg-white/5 px-5 text-white hover:bg-white/10"
                onClick={() => void loadMarketSnapshot()}
              >
                {loading ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <RefreshCcw className="mr-2 size-4" />}
                Refresh Snapshot
              </Button>
              <Link href={`/analyze?pair=${selectedMarket?.pair ?? seedPairs[0]}&timeframe=M1`}>
                <Button size="lg" className="rounded-full bg-emerald-500 px-5 text-slate-950 hover:bg-emerald-400">
                  Open Analyzer
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              </Link>
              <Link href={`/chart?pair=${selectedMarket?.pair ?? seedPairs[0]}&timeframe=M1`}>
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full border-white/10 bg-white/5 px-5 text-white hover:bg-white/10"
                >
                  Open Chart
                </Button>
              </Link>
            </div>
          </div>

          {loadError ? (
            <Card className="mt-6 border border-amber-400/20 bg-amber-500/10">
              <CardContent className="px-5 py-4 text-sm text-amber-100">{loadError}</CardContent>
            </Card>
          ) : null}

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              {
                label: "Tracked pairs",
                value: `${pairCards.length}`,
                tone: "text-white",
              },
              {
                label: "Bullish vs bearish",
                value: `${marketStats.bullish} / ${marketStats.bearish}`,
                tone: "text-emerald-300",
              },
              {
                label: "Average confidence",
                value: pairCards.length > 0 ? formatConfidenceScore(marketStats.averageConfidence) : "--",
                tone: "text-amber-300",
              },
            ].map((item) => (
              <Card key={item.label} className="border border-white/10 bg-white/[0.04]">
                <CardContent className="px-5 py-5">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{item.label}</div>
                  <div className={cn("mt-3 text-2xl font-semibold", item.tone)}>{item.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <Card className="border border-white/10 bg-white/[0.04]">
              <CardHeader>
                <CardTitle className="text-xl text-white">Market Matrix</CardTitle>
                <CardDescription className="text-slate-400">
                  Scan major pairs by bias, confidence, and current driver.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {pairCards.map((pair) => {
                  const tone = pairTone(pair.bias);
                  const ToneIcon = tone.icon;

                  return (
                    <button
                      key={pair.pair}
                      type="button"
                      onClick={() => setSelectedPair(pair.pair)}
                      className={cn(
                        "rounded-3xl border p-5 text-left transition",
                        selectedPair === pair.pair
                          ? "border-emerald-400/25 bg-emerald-500/10"
                          : "border-white/10 bg-slate-950/45 hover:bg-white/[0.03]"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-lg font-semibold text-white">{pairLabel(pair.pair)}</div>
                        <Badge className={cn("border", tone.badge)}>
                          <ToneIcon className="mr-1 size-3.5" />
                          {pair.bias}
                        </Badge>
                      </div>
                      <div className="mt-4 font-mono text-2xl font-semibold text-white">{pair.price}</div>
                      <div className="mt-4 text-sm leading-6 text-slate-400">{pair.driver}</div>
                      <Progress value={pair.confidence} className="mt-5">
                        <ProgressLabel className="text-slate-300">Confidence</ProgressLabel>
                        <div className="ml-auto text-xs text-slate-400">{formatConfidenceScore(pair.confidence)}</div>
                      </Progress>
                      <div className="mt-3 h-2 rounded-full bg-white/10">
                        <div className={cn("h-2 rounded-full", tone.bar)} style={{ width: `${pair.confidence}%` }} />
                      </div>
                      <div className="mt-3 text-xs uppercase tracking-[0.24em] text-slate-500">Grade {pair.grade}</div>
                    </button>
                  );
                })}
                {pairCards.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/45 p-5 text-sm leading-6 text-slate-400">
                    Live market cards will appear as soon as the backend returns current pair data.
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="border border-white/10 bg-white/[0.04]">
                <CardHeader>
                  <CardDescription className="text-slate-400">Selected Pair</CardDescription>
                  <CardTitle className="text-2xl text-white">
                    {selectedMarket ? pairLabel(selectedMarket.pair) : "Waiting for live market data"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center justify-between rounded-3xl border border-white/10 bg-slate-950/50 p-5">
                    <div>
                      <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Bias</div>
                      <div className={cn("mt-3 text-3xl font-semibold", selectedTone.label)}>
                        {selectedMarket?.bias ?? "Loading"}
                      </div>
                    </div>
                    <div className={cn("rounded-2xl p-3", selectedTone.badge)}>
                      <SelectedIcon className="size-5" />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
                      <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Last Price</div>
                      <div className="mt-3 font-mono text-3xl font-semibold text-white">{selectedMarket?.price ?? "--"}</div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
                      <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Confidence</div>
                      <div className="mt-3 text-3xl font-semibold text-white">
                        {selectedMarket ? formatConfidenceScore(selectedMarket.confidence) : "--"}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Primary Driver</div>
                    <div className="mt-3 text-sm leading-7 text-slate-300">
                      {selectedMarket?.driver ?? "Waiting for current market drivers."}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Link href={`/analyze?pair=${selectedMarket?.pair ?? seedPairs[0]}&timeframe=M1`}>
                      <Button className="h-12 w-full rounded-full bg-emerald-500 text-slate-950 hover:bg-emerald-400">
                        Analyze {pairLabel(selectedMarket?.pair ?? seedPairs[0])}
                        <ArrowRight className="ml-2 size-4" />
                      </Button>
                    </Link>
                    <Link href={`/chart?pair=${selectedMarket?.pair ?? seedPairs[0]}&timeframe=M1`}>
                      <Button
                        variant="outline"
                        className="h-12 w-full rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10"
                      >
                        Open Chart
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-white/10 bg-white/[0.04]">
                <CardHeader>
                  <CardTitle className="text-xl text-white">Quick Read</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    {
                      icon: Gauge,
                      title: "Signal grade",
                      copy: `Current grade: ${selectedMarket?.grade ?? "--"}`,
                    },
                    {
                      icon: ShieldCheck,
                      title: "Plan access",
                      copy: user ? `Signed in on ${planLabel}.` : "Browsing the public trading workspace.",
                    },
                    {
                      icon: Activity,
                      title: "Focus",
                      copy: "Use the matrix to compare conviction first, then drill into the best setup.",
                    },
                  ].map((item) => (
                    <div key={item.title} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                      <div className="flex items-center gap-3 text-white">
                        <item.icon className="size-4 text-emerald-200" />
                        <span className="font-medium">{item.title}</span>
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-400">{item.copy}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
