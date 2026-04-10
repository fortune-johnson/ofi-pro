"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  CandlestickData,
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramData,
  HistogramSeries,
  type IChartApi,
} from "lightweight-charts";

import { type ChartMode } from "@/lib/markets";
import { buildVolumeProfile, type CandlePoint, type VolumeProfileRow } from "@/lib/market-data";
import { cn } from "@/lib/utils";

type VolumeProfileChartProps = {
  pair: string;
  title: string;
  subtitle?: string;
  candles?: CandlePoint[];
  profile?: VolumeProfileRow[];
  mode?: ChartMode;
  interactive?: boolean;
  height?: number;
  liveLabel?: string;
  chartLabel?: string;
  panelTitle?: string;
  panelTag?: string;
  className?: string;
};

export function VolumeProfileChart({
  pair,
  title,
  subtitle,
  candles = [],
  profile,
  mode = "candlestick",
  interactive = false,
  height = 420,
  liveLabel = "Live Chart",
  chartLabel,
  panelTitle = "Volume at Price",
  panelTag = "Profile",
  className,
}: VolumeProfileChartProps) {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const candleData = useMemo<CandlestickData[]>(
    () =>
      candles.map((candle) => ({
        time: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      })),
    [candles]
  );

  const profileRows = useMemo(() => profile ?? buildVolumeProfile(candles, pair), [candles, pair, profile]);
  const hasChartData = candleData.length > 0;

  const volumeData = useMemo<HistogramData[]>(
    () =>
      candles.map((candle) => ({
        time: candle.time,
        value: candle.volume,
        color: candle.close >= candle.open ? "rgba(16,185,129,0.55)" : "rgba(244,63,94,0.55)",
      })),
    [candles]
  );

  const chartTone = {
    up: "#10b981",
    down: "#f43f5e",
    badge: "Candles + Volume",
  };

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container || candleData.length === 0) return undefined;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(226, 232, 240, 0.82)",
      },
      grid: {
        vertLines: { color: "rgba(167,139,250,0.08)" },
        horzLines: { color: "rgba(167,139,250,0.08)" },
      },
      rightPriceScale: {
        borderVisible: false,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
      },
      crosshair: {
        vertLine: { color: "rgba(168,85,247,0.32)" },
        horzLine: { color: "rgba(255,255,255,0.12)" },
      },
      handleScroll: interactive,
      handleScale: interactive,
    });

    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: chartTone.up,
      downColor: chartTone.down,
      borderVisible: false,
      wickUpColor: chartTone.up,
      wickDownColor: chartTone.down,
    });

    candleSeries.setData(candleData);

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
      base: 0,
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.72,
        bottom: 0,
      },
    });
    volumeSeries.setData(volumeData);
    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      chart.applyOptions({
        width: entry.contentRect.width,
        height: Math.max(320, entry.contentRect.height),
      });
      chart.timeScale().fitContent();
    });

    resizeObserver.observe(container);
    chart.applyOptions({ width: container.clientWidth, height });

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [candleData, chartTone.down, chartTone.up, height, interactive, volumeData]);

  return (
    <div className={cn("rounded-[1.5rem] border border-white/10 bg-slate-950/60 p-4", className)}>
      <div className="flex flex-col gap-3 pb-4">
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <div>
            <div className="text-sm font-medium text-white">{title}</div>
            {subtitle ? <div className="mt-1 text-xs text-slate-400">{subtitle}</div> : null}
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-violet-200 md:flex">
            {liveLabel}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,10,20,0.92),rgba(8,10,25,0.82))] p-3">
          <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3 text-xs text-slate-400">
            <span>TradingView-style price action</span>
            <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-violet-200">
              {chartLabel ?? chartTone.badge}
            </span>
          </div>
          {hasChartData ? (
            <div ref={chartContainerRef} className="w-full" style={{ height }} />
          ) : (
            <div
              className="flex items-center justify-center rounded-[1.25rem] border border-dashed border-white/10 text-sm text-slate-400"
              style={{ height }}
            >
              Live chart data is unavailable right now.
            </div>
          )}
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-medium text-white">{panelTitle}</div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{panelTag}</div>
          </div>
          <div className="space-y-3">
            {profileRows.length > 0 ? (
              profileRows.map((row) => (
                <div key={row.price}>
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                    <span>{row.price}</span>
                    <span>{row.total}% node</span>
                  </div>
                  <div className="h-9 overflow-hidden rounded-2xl bg-white/5">
                    <div className="flex h-full">
                      <div
                        className="flex items-center justify-start bg-emerald-500/35 pl-3 text-[11px] font-medium text-emerald-100"
                        style={{ width: `${row.buyShare}%` }}
                      >
                        {row.buyShare}%
                      </div>
                      <div
                        className="flex items-center justify-end bg-rose-500/35 pr-3 text-[11px] font-medium text-rose-100"
                        style={{ width: `${row.sellShare}%` }}
                      >
                        {row.sellShare}%
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm leading-6 text-slate-400">
                Volume-at-price data will appear after live candles load.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
