"use client";

import { startTransition, useState } from "react";
import { Globe2, LoaderCircle, RefreshCcw, Radar, ScanSearch } from "lucide-react";

import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FUNDAMENTALS_TIMEFRAMES, TRADEABLE_ASSETS, pairLabel, timeframeLabel } from "@/lib/markets";
import { fetchFundamentals, retrainFundamentals, type FundamentalsResponse, type FundamentalsRetrainResponse } from "@/lib/trading-lab";

export default function FundamentalsPage() {
  const [pair, setPair] = useState("EUR_USD");
  const [timeframe, setTimeframe] = useState("H1");
  const [result, setResult] = useState<FundamentalsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retrainState, setRetrainState] = useState<FundamentalsRetrainResponse | null>(null);
  const [retrainLoading, setRetrainLoading] = useState(false);
  const [retrainError, setRetrainError] = useState("");

  async function handleAnalyze() {
    try {
      setLoading(true);
      setError("");
      const payload = await fetchFundamentals(pair, timeframe);
      startTransition(() => setResult(payload));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to build fundamentals brief.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleRetrain() {
    try {
      setRetrainLoading(true);
      setRetrainError("");
      const payload = await retrainFundamentals();
      startTransition(() => setRetrainState(payload));
    } catch (nextError) {
      setRetrainError(nextError instanceof Error ? nextError.message : "Unable to retrain fundamentals AI.");
    } finally {
      setRetrainLoading(false);
    }
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <Badge className="border border-amber-400/20 bg-amber-500/10 px-4 py-1 text-[11px] uppercase tracking-[0.24em] text-amber-200">
            Fundamentals AI
          </Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            A fundamentals desk that translates market context into trader-ready expectations.
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            Select an asset and timeframe to see the current macro bias, the main drivers, and what to expect on H1, H4, and D1.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <Card className="border border-white/10 bg-white/[0.04]">
            <CardHeader>
              <Badge className="w-fit border border-white/10 bg-white/5 text-slate-300">Scanner</Badge>
              <CardTitle className="pt-4 text-2xl text-white">Build the brief</CardTitle>
              <CardDescription className="text-slate-400">
                The tool reads higher-timeframe structure and order-flow context, then turns that into a practical macro brief.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={pair} onValueChange={(value) => value && setPair(value)}>
                <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-slate-950/60 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>{TRADEABLE_ASSETS.map((item) => <SelectItem key={item} value={item}>{pairLabel(item)}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={timeframe} onValueChange={(value) => value && setTimeframe(value)}>
                <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-slate-950/60 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>{FUNDAMENTALS_TIMEFRAMES.map((item) => <SelectItem key={item} value={item}>{timeframeLabel(item)}</SelectItem>)}</SelectContent>
              </Select>
              <Button onClick={() => void handleAnalyze()} disabled={loading} className="h-12 w-full rounded-full bg-amber-500 font-semibold text-slate-950 hover:bg-amber-400">
                {loading ? <><LoaderCircle className="mr-2 size-4 animate-spin" />Analyzing</> : <><ScanSearch className="mr-2 size-4" />Run Fundamentals AI</>}
              </Button>
              <Button onClick={() => void handleRetrain()} disabled={retrainLoading} variant="outline" className="h-12 w-full rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10">
                {retrainLoading ? <><LoaderCircle className="mr-2 size-4 animate-spin" />Retraining</> : <><RefreshCcw className="mr-2 size-4" />Retrain AI</>}
              </Button>
              {retrainState ? <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-300">{retrainState.message} Runs: {retrainState.runs}</div> : null}
              {retrainError ? <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{retrainError}</div> : null}
              {error ? <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{error}</div> : null}
            </CardContent>
          </Card>

          <Card className="border border-amber-400/20 bg-[linear-gradient(135deg,rgba(71,37,4,0.92),rgba(10,10,18,0.94))]">
            <CardHeader>
              <Badge className="w-fit border border-amber-400/20 bg-amber-500/10 text-amber-200">Live Brief</Badge>
              <CardTitle className="pt-4 text-2xl text-white">{result ? `${pairLabel(result.pair)} · ${timeframeLabel(result.timeframe)}` : "Waiting for a fundamentals brief"}</CardTitle>
              <CardDescription className="text-slate-300">
                {result?.summary ?? "Run the AI brief to load macro bias, key drivers, and multi-timeframe expectations."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {result ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Macro bias</div>
                      <div className="mt-2 text-2xl font-semibold text-white">{result.macroBias}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Retrained</div>
                      <div className="mt-2 text-sm font-medium text-white">{result.learningState.retrainedAt ? new Date(result.learningState.retrainedAt).toLocaleString() : "Not yet retrained"}</div>
                    </div>
                  </div>
                  <div className="grid gap-3">
                    {result.drivers.map((driver) => (
                      <div key={driver} className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm leading-7 text-slate-300">{driver}</div>
                    ))}
                  </div>
                </>
              ) : loading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-slate-950/40" />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/35 px-4 py-8 text-sm text-slate-400">
                  Fundamentals output will appear here. This desk is focused on higher-timeframe macro context, not 1-minute or 5-minute noise.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {result
            ? Object.entries(result.timeframeExpectations).map(([key, item]) => (
                <Card key={key} className="border border-white/10 bg-white/[0.04]">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex size-11 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-500/10">
                        {key === "M1" ? <Radar className="size-5 text-amber-200" /> : <Globe2 className="size-5 text-amber-200" />}
                      </div>
                      <div>
                        <CardTitle className="text-lg text-white">{timeframeLabel(key)}</CardTitle>
                        <CardDescription className="text-slate-400">{item.expectedBias}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm leading-7 text-slate-300">
                    <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3">{item.impact}</div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3">{item.watch}</div>
                  </CardContent>
                </Card>
              ))
            : !loading ? (
                <Card className="border border-dashed border-white/10 bg-white/[0.03] md:col-span-2 xl:col-span-3">
                  <CardContent className="px-6 py-8 text-sm leading-7 text-slate-400">
                    Run a fundamentals brief to load the higher-timeframe outlook cards.
                  </CardContent>
                </Card>
              ) : null}
        </div>
      </div>
    </PageShell>
  );
}
