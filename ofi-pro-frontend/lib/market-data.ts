import type { UTCTimestamp } from "lightweight-charts";

export type CandlePoint = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  complete?: boolean;
};

export type LiveQuote = {
  time: number;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  spreadPips: number;
};

export type OrderflowSnapshot = {
  restingLong: number;
  restingShort: number;
  positionLong: number;
  positionShort: number;
  flowBias: number;
  inventoryBias: number;
  signal: string;
  note: string;
};

export type MarketClock = {
  weekday: string;
  utcTime: string;
  londonTime: string;
  newYorkTime: string;
  marketOpen: boolean;
  londonOpen: boolean;
  newYorkOpen: boolean;
  activeSession: string;
};

export type MarketHistoryResponse = {
  pair: string;
  timeframe: string;
  provider: string;
  candles: CandlePoint[];
  quote: LiveQuote;
  orderflow: OrderflowSnapshot;
  marketClock: MarketClock;
};

export type MarketStreamEvent =
  | ({ type: "snapshot" } & MarketHistoryResponse)
  | {
      type: "tick";
      pair: string;
      timeframe: string;
      quote: LiveQuote;
      candle: CandlePoint;
      replace: boolean;
      orderflow?: OrderflowSnapshot | null;
      marketClock: MarketClock;
    }
  | {
      type: "heartbeat";
      marketClock: MarketClock;
    }
  | {
      type: "error";
      detail: string;
    };

export type VolumeProfileRow = {
  price: string;
  buyShare: number;
  sellShare: number;
  total: number;
};

export function toWebSocketBaseUrl(baseUrl: string) {
  if (baseUrl.startsWith("https://")) {
    return baseUrl.replace("https://", "wss://");
  }
  if (baseUrl.startsWith("http://")) {
    return baseUrl.replace("http://", "ws://");
  }
  return baseUrl;
}

export function formatPrice(pair: string, price: number) {
  return price.toFixed(pair.includes("JPY") ? 3 : 5);
}

export function formatSigned(value: number, digits = 2) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

export function buildVolumeProfile(candles: CandlePoint[], pair: string, levels = 6): VolumeProfileRow[] {
  if (candles.length === 0) return [];

  const low = Math.min(...candles.map((candle) => candle.low));
  const high = Math.max(...candles.map((candle) => candle.high));
  if (!Number.isFinite(low) || !Number.isFinite(high) || low === high) return [];

  const bucketSize = (high - low) / levels;
  const buckets = Array.from({ length: levels }, (_, index) => ({
    center: low + bucketSize * index + bucketSize / 2,
    buyVolume: 0,
    sellVolume: 0,
  }));

  for (const candle of candles) {
    const relativeIndex = Math.min(
      levels - 1,
      Math.max(0, Math.floor((candle.close - low) / bucketSize))
    );
    const bucket = buckets[relativeIndex];
    const spread = candle.high - candle.low;
    const bodyRatio = spread > 0 ? Math.abs(candle.close - candle.open) / spread : 0;
    const buyShare = candle.close >= candle.open ? 0.5 + bodyRatio * 0.5 : 0.5 - bodyRatio * 0.5;
    bucket.buyVolume += candle.volume * buyShare;
    bucket.sellVolume += candle.volume * (1 - buyShare);
  }

  const maxTotal = Math.max(...buckets.map((bucket) => bucket.buyVolume + bucket.sellVolume), 0);
  if (maxTotal <= 0) return [];

  return buckets
    .map((bucket) => {
      const totalVolume = bucket.buyVolume + bucket.sellVolume;
      const buyShare = totalVolume > 0 ? (bucket.buyVolume / totalVolume) * 100 : 0;
      const sellShare = totalVolume > 0 ? (bucket.sellVolume / totalVolume) * 100 : 0;

      return {
        price: formatPrice(pair, bucket.center),
        buyShare: Number(buyShare.toFixed(1)),
        sellShare: Number(sellShare.toFixed(1)),
        total: Number(((totalVolume / maxTotal) * 100).toFixed(1)),
      };
    })
    .sort((left, right) => Number(right.price) - Number(left.price));
}
