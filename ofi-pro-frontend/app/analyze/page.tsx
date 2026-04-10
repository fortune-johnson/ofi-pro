"use client";

import Link from "next/link";
import { startTransition, useEffect, useEffectEvent, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  CircleHelp,
  Clock3,
  LoaderCircle,
  Radar,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Waves,
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { PageShell } from "@/components/page-shell";
import { VolumeProfileChart } from "@/components/volume-profile-chart";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  extractBias,
  extractConfidence,
  extractDrivers,
  formatConfidenceScore,
  inferFactorScores,
  type AnalyzeResponse,
} from "@/lib/analysis";
import { AUTO_REFRESH_INTERVAL_MS, API_BASE_URL, fetchMarketHistory } from "@/lib/live-market";
import {
  ANALYSIS_TIMEFRAMES,
  FOREX_PAIRS,
  isAnalysisTimeframe,
  isForexPair,
  pairLabel,
  timeframeLabel,
} from "@/lib/markets";
import { hasPlan } from "@/lib/plans";
import { cn } from "@/lib/utils";

const pairs = [...FOREX_PAIRS];

const termHelp = {
  bias: "Bias is the directional read synthesized from multiple order flow and market structure factors.",
  confidence: "Confidence measures how strongly the engine supports the current verdict from live inputs.",
  profile:
    "Volume profile shows where business was done by price level so acceptance, rejection, and imbalance stand out more clearly.",
};

const profileTimeframes = [
  {
    timeframe: "M1",
    title: "Micro Rotation",
    subtitle: "Fast clustering for immediate acceptance and rejection.",
  },
  {
    timeframe: "M15",
    title: "Intraday Auction",
    subtitle: "Current session participation distribution.",
  },
  {
    timeframe: "H1",
    title: "Session Structure",
    subtitle: "Broader value and rejection zones across the active session.",
  },
  {
    timeframe: "H4",
    title: "Higher-Timeframe Inventory",
    subtitle: "Slower participation map for the larger structure.",
  },
] as const;

function resultToneClasses(tone: "bullish" | "bearish" | "neutral") {
  if (tone === "bullish") {
    return {
      badge: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
      bar: "bg-emerald-400",
      icon: TrendingUp,
      iconClass: "text-emerald-300",
    };
  }
  if (tone === "bearish") {
    return {
      badge: "border-rose-400/20 bg-rose-500/10 text-rose-200",
      bar: "bg-rose-400",
      icon: TrendingDown,
      iconClass: "text-rose-300",
    };
  }
  return {
    badge: "border-white/15 bg-white/5 text-slate-200",
    bar: "bg-slate-300",
    icon: Radar,
    iconClass: "text-slate-200",
  };
}

function TermLabel({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <div className="flex items-center gap-2">
      <span>{label}</span>
      <Tooltip>
        <TooltipTrigger render={<button type="button" className="text-slate-500 hover:text-slate-200" />}>
          <CircleHelp className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-6">
      <Card className="border border-white/10 bg-white/[0.04]">
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-32 w-full rounded-3xl" />
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-2xl" />
        </CardContent>
      </Card>
      <Card className="border border-white/10 bg-white/[0.04]">
        <CardContent className="space-y-5 pt-6">
          <Skeleton className="h-[380px] w-full rounded-3xl" />
          <Skeleton className="h-24 w-full rounded-3xl" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function AnalyzePage() {
  const { user, plan } = useAuth();
  const [selectedPair, setSelectedPair] = useState("EUR_USD");
  const [selectedTf, setSelectedTf] = useState("M1");
  const [detailed, setDetailed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState("");
  const [profileData, setProfileData] = useState<Record<string, Awaited<ReturnType<typeof fetchMarketHistory>> | null>>({});
  const [profileError, setProfileError] = useState("");
  const canUseDetailed = hasPlan(plan, "pro");

  useEffect(() => {
    if (!canUseDetailed && detailed) {
      setDetailed(false);
    }
  }, [canUseDetailed, detailed]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pair = params.get("pair");
    const timeframe = params.get("timeframe");
    const mode = params.get("mode");

    if (pair && isForexPair(pair)) {
      setSelectedPair(pair);
    }

    if (timeframe && isAnalysisTimeframe(timeframe)) {
      setSelectedTf(timeframe);
    }

    if (mode === "quick") {
      setDetailed(false);
    }

    if (mode === "deep") {
      setDetailed(true);
    }
  }, []);

  const insight = useMemo(() => {
    if (!result) return null;
    const confidence = extractConfidence(result.messages, result.summary);
    const bias = extractBias(result.messages, result.summary);
    const drivers = extractDrivers(result.messages, result.summary);
    const factorScores = inferFactorScores(result.messages, result.summary);
    return { confidence, bias, drivers, factorScores };
  }, [result]);

  const loadProfiles = useEffectEvent(async (pair: string) => {
    try {
      setProfileError("");
      const entries = await Promise.all(
        profileTimeframes.map(async (config) => [
          config.timeframe,
          await fetchMarketHistory(pair, config.timeframe, 160),
        ] as const)
      );

      startTransition(() => {
        setProfileData(Object.fromEntries(entries));
      });
    } catch (nextError) {
      setProfileError(nextError instanceof Error ? nextError.message : "Unable to refresh live profile data.");
    }
  });

  useEffect(() => {
    if (!result?.pair) return undefined;

    void loadProfiles(result.pair);
    const intervalId = window.setInterval(() => {
      void loadProfiles(result.pair);
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadProfiles, result?.pair]);

  async function runAnalysis() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pair: selectedPair,
          timeframe: selectedTf,
          detailed: canUseDetailed ? detailed : false,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.detail || "Analysis failed");
      }

      startTransition(() => {
        setResult(data);
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to connect to the backend.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  const tone = insight ? resultToneClasses(insight.bias.tone) : null;
  const ToneIcon = tone?.icon;

  return (
    <TooltipProvider>
      <PageShell>
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-2 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <Badge className="border border-violet-400/20 bg-violet-500/10 px-4 py-1 text-[11px] uppercase tracking-[0.24em] text-violet-200">
                Trader Analysis
              </Badge>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Quick reads when you need speed. Deep reads when you need context.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">
                Choose a pair, run the engine, read the bias, and inspect live market structure without unnecessary clutter.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={`/chart?pair=${selectedPair}&timeframe=${selectedTf}`}
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "rounded-full border-white/15 bg-white/5 px-5 text-white hover:bg-white/10"
                )}
              >
                Open Chart
              </Link>
              <Link
                href="/dashboard"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "rounded-full border-white/15 bg-white/5 px-5 text-white hover:bg-white/10"
                )}
              >
                Back to Dashboard
              </Link>
            </div>
          </div>

          {!user ? (
            <Card className="mt-8 border border-white/10 bg-white/[0.04]">
              <CardContent className="flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium text-white">Sign in for saved access and upgrades</div>
                  <div className="mt-2 text-sm leading-6 text-slate-400">
                    You can explore quick analysis now, then sign in to unlock paid tiers and persistent access.
                  </div>
                </div>
                <div className="flex gap-3">
                  <Link
                    href="/login"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "lg" }),
                      "rounded-full border-white/15 bg-white/5 px-5 text-white hover:bg-white/10"
                    )}
                  >
                    Login
                  </Link>
                  <Link
                    href="/signup"
                    className={cn(buttonVariants({ size: "lg" }), "rounded-full bg-violet-500 px-5 text-white hover:bg-violet-400")}
                  >
                    Sign Up
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {!canUseDetailed ? (
            <Card className="mt-8 border border-violet-400/20 bg-violet-500/10">
              <CardContent className="flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium text-white">Free tier is active</div>
                  <div className="mt-2 text-sm leading-6 text-violet-50/80">
                    Quick analysis is available now. Upgrade to Pro for deeper breakdowns and the full transcript.
                  </div>
                </div>
                <Link
                  href="/pricing"
                  className={cn(buttonVariants({ size: "lg" }), "rounded-full bg-violet-500 px-5 text-white hover:bg-violet-400")}
                >
                  Upgrade to Pro
                </Link>
              </CardContent>
            </Card>
          ) : null}

          <div className="mt-10 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
            <Card className="border border-white/10 bg-white/[0.04]">
              <CardHeader>
                <CardTitle className="text-lg text-white">Analysis Controls</CardTitle>
                <CardDescription className="text-slate-400">Pair, timeframe, and depth.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.24em] text-slate-500">Pair</label>
                    <Select value={selectedPair} onValueChange={(value) => value && setSelectedPair(value)}>
                      <SelectTrigger className="h-12 rounded-2xl border-white/10 bg-slate-950/60 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {pairs.map((pair) => (
                          <SelectItem key={pair} value={pair}>
                            {pairLabel(pair)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.24em] text-slate-500">Timeframe</label>
                    <Select value={selectedTf} onValueChange={(value) => value && setSelectedTf(value)}>
                      <SelectTrigger className="h-12 rounded-2xl border-white/10 bg-slate-950/60 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ANALYSIS_TIMEFRAMES.map((timeframe) => (
                          <SelectItem key={timeframe} value={timeframe}>
                            {timeframeLabel(timeframe)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Analysis Depth</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setDetailed(false)}
                      className={cn(
                        "rounded-3xl border p-4 text-left transition",
                        !detailed ? "border-violet-400/30 bg-violet-500/10" : "border-white/10 bg-slate-950/50 hover:bg-white/[0.03]"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Activity className="size-4 text-violet-300" />
                        <span className="font-medium text-white">Quick Analysis</span>
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-400">Fast directional read for immediate context.</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => canUseDetailed && setDetailed(true)}
                      disabled={!canUseDetailed}
                      className={cn(
                        "rounded-3xl border p-4 text-left transition",
                        detailed && canUseDetailed
                          ? "border-violet-400/30 bg-violet-500/10"
                          : "border-white/10 bg-slate-950/50 hover:bg-white/[0.03]",
                        !canUseDetailed && "cursor-not-allowed opacity-60"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <BrainCircuit className="size-4 text-violet-300" />
                        <span className="font-medium text-white">Deep Analysis</span>
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-400">
                        {canUseDetailed ? "Expanded engine output with richer trading context." : "Upgrade to Pro to unlock deeper analysis."}
                      </div>
                    </button>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
                  <div className="flex items-start gap-3">
                    <Search className="mt-0.5 size-4 text-violet-300" />
                    <div>
                      <div className="font-medium text-white">Ready to analyze</div>
                      <div className="mt-1 text-sm leading-6 text-slate-400">
                        Frontend requests are sent directly to <span className="mx-1 text-slate-200">{`${API_BASE_URL}/analyze`}</span> using your existing FastAPI backend.
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => void runAnalysis()}
                  disabled={loading}
                  size="lg"
                  className="h-12 w-full rounded-full bg-violet-500 text-sm font-semibold text-white hover:bg-violet-400 disabled:bg-violet-500/60"
                >
                  {loading ? (
                    <>
                      <LoaderCircle className="mr-2 size-4 animate-spin" />
                      Running analysis
                    </>
                  ) : (
                    <>
                      Run Analysis
                      <ArrowRight className="ml-2 size-4" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-6">
              {loading ? (
                <LoadingState />
              ) : result && insight && tone && ToneIcon ? (
                <>
                  <Card className="border border-white/10 bg-white/[0.04]">
                    <CardHeader className="border-b border-white/10 pb-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <CardDescription className="text-slate-400">Analysis Result</CardDescription>
                          <CardTitle className="mt-1 text-2xl text-white">
                            {pairLabel(result.pair)} • {timeframeLabel(result.timeframe)}
                          </CardTitle>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <Badge className={cn("border", tone.badge)}>
                            <ToneIcon className={cn("mr-2 size-3.5", tone.iconClass)} />
                            {insight.bias.label}
                          </Badge>
                          <Badge className="border border-white/10 bg-white/5 text-slate-200">
                            {result.detailed ? "Deep Mode" : "Quick Mode"}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                        <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                                <TermLabel label="Confidence Score" tooltip={termHelp.confidence} />
                              </div>
                              <div className="mt-3 text-4xl font-semibold text-white">
                                {formatConfidenceScore(insight.confidence)}
                              </div>
                            </div>
                            <div className={cn("rounded-2xl p-3", tone.badge)}>
                              <ToneIcon className={cn("size-5", tone.iconClass)} />
                            </div>
                          </div>
                          <Progress value={insight.confidence} className="mt-5">
                            <ProgressLabel className="text-slate-300">Signal Strength</ProgressLabel>
                            <div className="ml-auto text-xs/relaxed text-slate-400 tabular-nums">
                              {formatConfidenceScore(insight.confidence)}
                            </div>
                          </Progress>
                          <div className="mt-3 h-2 rounded-full bg-white/10">
                            <div className={cn("h-2 rounded-full", tone.bar)} style={{ width: `${insight.confidence}%` }} />
                          </div>
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5">
                          <div className="flex items-center gap-3">
                            <Sparkles className="size-4 text-violet-300" />
                            <div className="text-sm font-medium text-white">Factor Breakdown</div>
                          </div>
                          <div className="mt-4 space-y-3">
                            {insight.drivers.map((driver, index) => (
                              <div
                                key={`${driver}-${index}`}
                                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-slate-300"
                              >
                                {driver}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                          <div className="flex items-center gap-2 text-slate-300">
                            <Clock3 className="size-4 text-violet-300" />
                            <span className="text-sm font-medium">Timeframe</span>
                          </div>
                          <div className="mt-3 text-lg font-semibold text-white">{result.timeframe}</div>
                          <div className="mt-1 text-xs text-slate-500">{timeframeLabel(result.timeframe)}</div>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                          <div className="flex items-center gap-2 text-slate-300">
                            <BrainCircuit className="size-4 text-violet-300" />
                            <span className="text-sm font-medium">Analysis Mode</span>
                          </div>
                          <div className="mt-3 text-lg font-semibold text-white">{result.detailed ? "Deep" : "Quick"}</div>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                          <div className="flex items-center gap-2 text-slate-300">
                            <Radar className="size-4 text-violet-300" />
                            <span className="text-sm font-medium">
                              <TermLabel label="Market Verdict" tooltip={termHelp.bias} />
                            </span>
                          </div>
                          <div className="mt-3 text-lg font-semibold text-white">{insight.bias.label}</div>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {insight.factorScores.map((factor) => (
                          <div key={factor.label} className="min-h-[190px] rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                            <div className="flex items-center justify-between">
                              <div className="max-w-[70%] text-sm font-medium leading-6 text-white">{factor.label}</div>
                              <div className="shrink-0 text-sm text-slate-300">{formatConfidenceScore(factor.score)}</div>
                            </div>
                            <div className="mt-3 h-2 rounded-full bg-white/10">
                              <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${factor.score}%` }} />
                            </div>
                            <div className="mt-3 break-words text-sm leading-7 text-slate-400">{factor.note}</div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border border-white/10 bg-white/[0.04]">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <Waves className="size-4 text-emerald-300" />
                        <div>
                          <CardTitle className="text-xl text-white">
                            <TermLabel label="Volume-at-Price Analysis" tooltip={termHelp.profile} />
                          </CardTitle>
                          <CardDescription className="text-slate-400">
                            Live profile charts refresh automatically every 30 seconds.
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Tabs defaultValue="M1" className="space-y-5">
                        <TabsList className="rounded-full border border-white/10 bg-white/5 p-1">
                          {profileTimeframes.map((config) => (
                            <TabsTrigger
                              key={config.timeframe}
                              value={config.timeframe}
                              className="rounded-full px-4 text-xs uppercase tracking-[0.2em]"
                            >
                              {config.timeframe}
                            </TabsTrigger>
                          ))}
                        </TabsList>

                        {profileTimeframes.map((config) => (
                          <TabsContent key={config.timeframe} value={config.timeframe}>
                            <VolumeProfileChart
                              pair={result.pair}
                              title={`${pairLabel(result.pair)} ${config.timeframe} Profile`}
                              subtitle={config.subtitle}
                              candles={profileData[config.timeframe]?.candles ?? []}
                            />
                          </TabsContent>
                        ))}
                      </Tabs>
                      {profileError ? (
                        <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
                          {profileError}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>

                  {result.detailed ? (
                    <Card className="border border-white/10 bg-white/[0.04]">
                      <CardHeader>
                        <CardTitle className="text-xl text-white">Deep Analysis Output</CardTitle>
                        <CardDescription className="text-slate-400">
                          Original backend analysis preserved in a clean, readable layout.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {result.messages.map((message, index) => (
                          <div key={`${index}-${message.slice(0, 12)}`} className="rounded-3xl border border-white/10 bg-slate-950/55 p-5">
                            <div className="mb-3 text-xs uppercase tracking-[0.24em] text-slate-500">Insight {index + 1}</div>
                            <div className="text-sm leading-7 whitespace-pre-wrap text-slate-200">{message}</div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="border border-white/10 bg-white/[0.04]">
                      <CardContent className="px-6 py-6">
                        <div className="font-medium text-white">Detailed output is available on Pro.</div>
                        <div className="mt-2 text-sm leading-6 text-slate-400">
                          Free users get the verdict, confidence, factor cards, and live profile views. Upgrade to Pro for the deeper transcript.
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : error ? (
                <Card className="border border-rose-400/20 bg-rose-500/10">
                  <CardContent className="flex items-start gap-3 pt-6 text-rose-100">
                    <ShieldAlert className="mt-0.5 size-4 text-rose-300" />
                    <div>
                      <div className="font-medium">Analysis request failed</div>
                      <div className="mt-1 text-sm leading-6 text-rose-100/80">{error}</div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border border-white/10 bg-white/[0.04]">
                  <CardContent className="px-6 py-8 text-sm leading-7 text-slate-400">
                    Run the analyzer to generate a live bias read, confidence score, factor cards, and auto-refreshing volume-at-price charts.
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </PageShell>
    </TooltipProvider>
  );
}
