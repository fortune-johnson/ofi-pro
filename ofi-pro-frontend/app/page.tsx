"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, BrainCircuit, CandlestickChart, Gauge, Globe2, Radar, Sparkles, Waves } from "lucide-react";

import { PageShell } from "@/components/page-shell";
import { VolumeProfileChart } from "@/components/volume-profile-chart";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatConfidenceScore } from "@/lib/analysis";
import { useMarketHistory, usePairSnapshots } from "@/lib/live-market";
import { ANALYSIS_TIMEFRAMES, CHART_MODES, pairLabel } from "@/lib/markets";
import { cn } from "@/lib/utils";

const livePairs = ["EUR_USD", "GBP_USD", "USD_JPY", "AUD_USD"];

const features = [
  {
    icon: Radar,
    title: "Quick Analysis",
    description: "Fast directional context for when you need a clean read without losing time.",
  },
  {
    icon: BrainCircuit,
    title: "Deep Analysis",
    description: "Expanded context, factor breakdowns, and a stronger picture of what price may do next.",
  },
  {
    icon: Gauge,
    title: "Our Expert Advisor",
    description: "Rules-based signals built around liquidity sweeps, MSS logic, and risk discipline.",
  },
  {
    icon: Waves,
    title: "Our Quant",
    description: "AI direction informed by repeated market training across multiple timeframes and regimes.",
  },
  {
    icon: Globe2,
    title: "Fundamentals AI",
    description: "Market context that translates current conditions into practical timeframe expectations.",
  },
];

const productNotes = [
  "Live market data first.",
  "Only trader-useful tools in the main workflow.",
  "Built to stay sharp on desktop and mobile.",
];

export default function HomePage() {
  const { data: pairSnapshots, error: snapshotError } = usePairSnapshots(livePairs, "M15");
  const { data: marketView, error: marketViewError } = useMarketHistory("EUR_USD", "M15", 120);

  const averageConfidence = useMemo(() => {
    if (pairSnapshots.length === 0) return "--";
    const average =
      pairSnapshots.reduce((sum, snapshot) => sum + snapshot.confidence, 0) / pairSnapshots.length;
    return formatConfidenceScore(average);
  }, [pairSnapshots]);

  return (
    <PageShell transparentHeader>
      <section className="relative overflow-hidden px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pb-20 lg:pt-10">
        <div className="absolute inset-x-0 top-0 -z-10 h-[30rem] bg-[radial-gradient(circle_at_18%_10%,rgba(16,185,129,0.16),transparent_24%),radial-gradient(circle_at_82%_16%,rgba(14,165,233,0.14),transparent_20%),radial-gradient(circle_at_62%_38%,rgba(245,158,11,0.08),transparent_18%)]" />

        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-wrap gap-3">
            {pairSnapshots.map((item) => (
              <div
                key={item.pair}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-slate-300"
              >
                <span className="font-medium text-white">{pairLabel(item.pair)}</span>
                <span className="mx-2 text-slate-500">/</span>
                <span className="text-emerald-200">{item.bias}</span>
                <span className="mx-2 text-slate-500">/</span>
                <span>{formatConfidenceScore(item.confidence)}</span>
              </div>
            ))}
            {pairSnapshots.length === 0 ? (
              <div className="rounded-full border border-dashed border-white/10 bg-white/[0.03] px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Waiting for live market snapshot
              </div>
            ) : null}
          </div>
          {snapshotError ? (
            <div className="mb-6 rounded-3xl border border-amber-400/20 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
              {snapshotError}
            </div>
          ) : null}

          <div className="grid gap-10 lg:grid-cols-[1fr_0.98fr] lg:items-center">
            <div className="max-w-3xl">
              <Badge className="border border-emerald-400/20 bg-emerald-500/10 px-4 py-1 text-[11px] uppercase tracking-[0.24em] text-emerald-200">
                Forex Market Intelligence
              </Badge>

              <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
                Trade forex with order flow clarity.
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                OFI Pro keeps the workflow centered on live data, trader-ready analysis, and execution context instead of filler.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/analyze"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "h-12 rounded-full bg-emerald-500 px-6 text-sm font-semibold text-slate-950 shadow-[0_20px_60px_rgba(16,185,129,0.24)] hover:bg-emerald-400"
                  )}
                >
                  Start Quick Analysis
                  <ArrowRight className="ml-2 size-4" />
                </Link>
                <Link
                  href="/chart"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "h-12 rounded-full border-white/15 bg-white/5 px-6 text-sm text-white hover:bg-white/10"
                  )}
                >
                  Open Chart
                </Link>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {productNotes.map((note) => (
                  <div key={note} className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-300">
                    <Sparkles className="mb-3 size-4 text-emerald-200" />
                    {note}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle,_rgba(16,185,129,0.18),_transparent_58%)] blur-3xl" />
              <VolumeProfileChart
                pair="EUR_USD"
                title="Live market view"
                subtitle="A minimal chart surface with a clear trading hierarchy."
                candles={marketView?.candles ?? []}
                liveLabel="Live Surface"
                chartLabel="Candles + Volume"
                panelTitle="Auction Profile"
                panelTag="Chart"
                className="shadow-[0_40px_120px_rgba(2,6,23,0.8)]"
              />
              {marketViewError ? (
                <div className="mt-4 rounded-3xl border border-amber-400/20 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
                  {marketViewError}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-4">
          {[
            { value: `${livePairs.length}`, label: "Pairs in the live homepage snapshot" },
            { value: "60s", label: "Automatic market refresh interval" },
            { value: averageConfidence, label: "Average live confidence read" },
            { value: `${CHART_MODES.length} / ${ANALYSIS_TIMEFRAMES.length}`, label: "Chart modes and analysis timeframes" },
          ].map((stat) => (
            <Card key={stat.label} className="border border-white/10 bg-white/[0.04]">
              <CardContent className="px-5 py-5">
                <div className="text-3xl font-semibold text-white">{stat.value}</div>
                <div className="mt-2 text-sm text-slate-400">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <Badge className="border border-white/10 bg-white/5 text-slate-300">Core Product</Badge>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Clear reads. Fast decisions.
            </h2>
            <p className="mt-4 text-base leading-8 text-slate-400">
              OFI Pro is designed to keep the market readable, the workflow light, and the screen easy to trust under pressure.
            </p>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {features.map((feature) => (
              <Card key={feature.title} className="border border-white/10 bg-white/[0.04]">
                <CardHeader>
                  <div className="flex size-11 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-500/10">
                    <feature.icon className="size-5 text-emerald-200" />
                  </div>
                  <CardTitle className="pt-4 text-lg text-white">{feature.title}</CardTitle>
                  <CardDescription className="text-sm leading-7 text-slate-400">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="border border-white/10 bg-white/[0.04]">
            <CardHeader>
              <Badge className="w-fit border border-white/10 bg-white/5 text-slate-300">Tools</Badge>
            <CardTitle className="pt-4 text-2xl text-white">Five focused tools for traders</CardTitle>
              <CardDescription className="text-sm leading-7 text-slate-400">
                Each tool has a clear job so the platform stays useful under pressure.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: Radar,
                  title: "Quick Analysis",
                  copy: "Fast directional read for immediate market context.",
                },
                {
                  icon: BrainCircuit,
                  title: "Deep Analysis",
                  copy: "Expanded breakdown when you need fuller context before execution.",
                },
                {
                  icon: Gauge,
                  title: "Our Expert Advisor",
                  copy: "Signal logic grounded in liquidity sweeps and market structure shifts.",
                },
                {
                  icon: CandlestickChart,
                  title: "Our Quant",
                  copy: "AI direction trained from repeated market behavior across timeframes.",
                },
                {
                  icon: Globe2,
                  title: "Fundamentals AI",
                  copy: "Higher-timeframe context distilled into actionable H1, H4, and D1 expectations.",
                },
              ].map((item) => (
                <div key={item.title} className="rounded-3xl border border-white/10 bg-slate-950/45 p-5">
                  <item.icon className="size-5 text-emerald-200" />
                  <div className="mt-4 text-sm font-medium text-white">{item.title}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-400">{item.copy}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border border-emerald-400/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.16),rgba(15,23,42,0.72))]">
            <CardHeader>
              <Badge className="w-fit border border-emerald-300/20 bg-emerald-500/10 text-emerald-100">Focus</Badge>
              <CardTitle className="pt-4 text-2xl text-white">Built around what traders actually need</CardTitle>
              <CardDescription className="text-sm leading-7 text-emerald-50/80">
                Live data, clear analysis paths, and strategy tooling without decorative clutter.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-[1.6rem] border border-white/10 bg-slate-950/60 p-6">
                <div className="mt-5 space-y-3">
                  {[
                    "Quick Analysis for fast directional decisions.",
                    "Deep Analysis when more structure and evidence matter.",
                    "Expert Advisor and Quant pages to keep strategy work visible and organized.",
                  ].map((point) => (
                    <div key={point} className="flex items-start gap-3 text-sm leading-6 text-slate-300">
                      <ArrowRight className="mt-1 size-4 text-emerald-200" />
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/tools/expert-advisor"
                    className={cn(
                      buttonVariants({ size: "lg" }),
                      "h-11 rounded-full bg-emerald-500 px-5 text-slate-950 hover:bg-emerald-400"
                    )}
                  >
                    View Expert Advisor
                  </Link>
                  <Link
                    href="/tools/quant"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "lg" }),
                      "h-11 rounded-full border-white/15 bg-white/5 px-5 text-white hover:bg-white/10"
                    )}
                  >
                    View Quant
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </PageShell>
  );
}
