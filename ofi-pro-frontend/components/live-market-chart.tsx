"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineStyle,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
} from "lightweight-charts";

import { pairLabel, timeframeLabel, type ChartMode } from "@/lib/markets";
import { formatPrice, type CandlePoint, type LiveQuote, type MarketClock } from "@/lib/market-data";
import { cn } from "@/lib/utils";

type LiveMarketChartProps = {
  pair: string;
  timeframe: string;
  mode: ChartMode;
  candles: CandlePoint[];
  quote: LiveQuote | null;
  marketClock: MarketClock | null;
  connectionLabel: string;
  className?: string;
};

type CandleSeriesHandle = {
  setData(data: CandlestickData[]): void;
};

type VolumeSeriesHandle = {
  setData(data: HistogramData[]): void;
  priceScale(): {
    applyOptions(options: {
      scaleMargins: {
        top: number;
        bottom: number;
      };
    }): void;
  };
};

export function LiveMarketChart({
  pair,
  timeframe,
  mode,
  candles,
  quote,
  marketClock,
  connectionLabel,
  className,
}: LiveMarketChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<CandleSeriesHandle | null>(null);
  const volumeSeriesRef = useRef<VolumeSeriesHandle | null>(null);

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

  const volumeData = useMemo<HistogramData[]>(
    () =>
      candles.map((candle) => ({
        time: candle.time,
        value: candle.volume,
        color: candle.close >= candle.open ? "rgba(41, 181, 126, 0.72)" : "rgba(229, 83, 75, 0.72)",
      })),
    [candles]
  );

  const chartTone = {
    up: "#22ab94",
    down: "#f23645",
    volume: "Volume",
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#131722" },
        textColor: "#9aa4ad",
        fontFamily: "Manrope, sans-serif",
      },
      grid: {
        vertLines: { color: "#1e222d", style: LineStyle.Solid, visible: true },
        horzLines: { color: "#1e222d", style: LineStyle.Solid, visible: true },
      },
      rightPriceScale: {
        borderColor: "#2a2e39",
        scaleMargins: {
          top: 0.06,
          bottom: 0.24,
        },
      },
      leftPriceScale: {
        visible: false,
      },
      timeScale: {
        borderColor: "#2a2e39",
        timeVisible: true,
        secondsVisible: timeframe === "M1",
        rightOffset: 10,
        barSpacing: 8,
      },
      crosshair: {
        vertLine: { color: "#758696", width: 1, labelBackgroundColor: "#202838" },
        horzLine: { color: "#758696", width: 1, labelBackgroundColor: "#202838" },
      },
      handleScroll: true,
      handleScale: true,
    });

    chartRef.current = chart;

    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: chartTone.up,
      downColor: chartTone.down,
      borderUpColor: chartTone.up,
      borderDownColor: chartTone.down,
      wickUpColor: chartTone.up,
      wickDownColor: chartTone.down,
      priceLineVisible: true,
      lastValueVisible: true,
    }) as CandleSeriesHandle;

    volumeSeriesRef.current = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    }) as VolumeSeriesHandle;

    volumeSeriesRef.current.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [chartTone.down, chartTone.up, timeframe]);

  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || candleData.length === 0) return;
    candleSeriesRef.current.setData(candleData);
    volumeSeriesRef.current.setData(volumeData);
    chartRef.current?.timeScale().scrollToRealTime();
  }, [candleData, volumeData]);

  const latest = candles[candles.length - 1];
  const change = latest ? latest.close - latest.open : 0;
  const changePct = latest && latest.open ? ((latest.close - latest.open) / latest.open) * 100 : 0;

  return (
    <div className={cn("overflow-hidden rounded-[26px] border border-[#2a2e39] bg-[#131722] shadow-[0_30px_100px_rgba(0,0,0,0.45)]", className)}>
      <div className="border-b border-[#2a2e39] bg-[#131722] px-4 py-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="font-semibold text-white">{pairLabel(pair)}</div>
            <div className="rounded-full bg-[#1c2030] px-2.5 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-300">
              {timeframeLabel(timeframe)}
            </div>
            <div className="rounded-full bg-[#1c2030] px-2.5 py-1 text-[11px] uppercase tracking-[0.22em] text-violet-200">
              {mode}
            </div>
            <div className="rounded-full bg-[#1c2030] px-2.5 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-300">
              {connectionLabel}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400">
            <span>
              O <span className="text-slate-200">{latest ? formatPrice(pair, latest.open) : "--"}</span>
            </span>
            <span>
              H <span className="text-slate-200">{latest ? formatPrice(pair, latest.high) : "--"}</span>
            </span>
            <span>
              L <span className="text-slate-200">{latest ? formatPrice(pair, latest.low) : "--"}</span>
            </span>
            <span>
              C <span className="text-slate-200">{latest ? formatPrice(pair, latest.close) : "--"}</span>
            </span>
            <span className={change >= 0 ? "text-emerald-300" : "text-rose-300"}>
              {change >= 0 ? "+" : ""}
              {formatPrice(pair, Math.abs(change))} ({changePct >= 0 ? "+" : ""}
              {changePct.toFixed(2)}%)
            </span>
            <span>
              Spread <span className="text-slate-200">{quote ? `${quote.spreadPips.toFixed(2)} pips` : "--"}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="flex min-h-[620px] min-w-0 flex-col">
          <div ref={containerRef} className="min-h-[540px] flex-1" />

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#2a2e39] bg-[#0f1320] px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
            <div className="flex flex-wrap items-center gap-3">
              <span>{marketClock?.weekday ?? "--"}</span>
              <span className={marketClock?.marketOpen ? "text-emerald-300" : "text-rose-300"}>
                {marketClock?.marketOpen ? "Market Open" : "Market Closed"}
              </span>
              <span>{marketClock?.activeSession ?? "Session --"}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span>London {marketClock?.londonTime ?? "--"}</span>
              <span className={marketClock?.londonOpen ? "text-emerald-300" : "text-slate-500"}>London</span>
              <span>New York {marketClock?.newYorkTime ?? "--"}</span>
              <span className={marketClock?.newYorkOpen ? "text-emerald-300" : "text-slate-500"}>New York</span>
              <span>{chartTone.volume}</span>
            </div>
          </div>
      </div>
    </div>
  );
}
