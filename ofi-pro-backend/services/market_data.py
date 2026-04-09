from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import AsyncIterator, Dict, List, Optional, Tuple

import aiohttp

from services.orderflow.oanda_client import OandaClient

TIMEFRAME_SECONDS = {
    "M1": 60,
    "M5": 300,
    "M15": 900,
    "M30": 1800,
    "H1": 3600,
    "H4": 14400,
}


class MarketDataService:
    def __init__(self, session: aiohttp.ClientSession):
        self.session = session
        self.oanda = OandaClient(session)

    async def history(self, pair: str, timeframe: str = "M1", count: int = 240) -> Tuple[Optional[Dict], Optional[str]]:
        candles = await self.oanda.fetch_candles(pair, timeframe, count=count)
        if not candles:
            return None, self.oanda.last_error or "No candle data returned from OANDA."

        normalized = [self._normalize_candle(candle) for candle in candles if candle.get("mid")]
        if not normalized:
            return None, "OANDA returned candles without usable price data."

        quote = self._quote_from_candle(normalized[-1])
        orderflow = await self._build_orderflow_snapshot(pair, quote["mid"])
        return {
            "pair": pair,
            "timeframe": timeframe,
            "provider": "oanda",
            "candles": normalized,
            "quote": quote,
            "orderflow": orderflow,
            "marketClock": self._market_clock(),
        }, None

    async def stream(self, pair: str, timeframe: str = "M1") -> AsyncIterator[Dict]:
        history_payload, error = await self.history(pair, timeframe, count=240)
        if error or not history_payload:
            yield {"type": "error", "detail": error or "Unable to load market data."}
            return

        candles = history_payload["candles"]
        yield {"type": "snapshot", **history_payload}

        last_book_refresh = datetime.now(timezone.utc)
        async for event in self.oanda.stream_prices(pair):
            if event.get("type") == "HEARTBEAT":
                yield {
                    "type": "heartbeat",
                    "marketClock": self._market_clock(),
                }
                continue

            quote = self._normalize_price_event(event)
            if not quote:
                continue

            candle, replace = self._apply_quote(candles, quote["mid"], quote["time"], timeframe)
            orderflow = None

            now_utc = datetime.now(timezone.utc)
            if now_utc - last_book_refresh >= timedelta(seconds=30):
                orderflow = await self._build_orderflow_snapshot(pair, quote["mid"])
                last_book_refresh = now_utc

            yield {
                "type": "tick",
                "pair": pair,
                "timeframe": timeframe,
                "quote": quote,
                "candle": candle,
                "replace": replace,
                "orderflow": orderflow,
                "marketClock": self._market_clock(),
            }

        if self.oanda.last_error:
            yield {"type": "error", "detail": self.oanda.last_error}

    def _normalize_candle(self, candle: Dict) -> Dict:
        mid = candle["mid"]
        return {
            "time": self._to_unix(candle["time"]),
            "open": float(mid["o"]),
            "high": float(mid["h"]),
            "low": float(mid["l"]),
            "close": float(mid["c"]),
            "volume": int(candle.get("volume", 0)),
            "complete": bool(candle.get("complete", True)),
        }

    def _quote_from_candle(self, candle: Dict) -> Dict:
        close = float(candle["close"])
        return {
            "time": candle["time"],
            "bid": close,
            "ask": close,
            "mid": close,
            "spread": 0.0,
            "spreadPips": 0.0,
        }

    def _normalize_price_event(self, payload: Dict) -> Optional[Dict]:
        bids = payload.get("bids") or []
        asks = payload.get("asks") or []
        if not bids or not asks:
            return None

        bid = float(bids[0]["price"])
        ask = float(asks[0]["price"])
        mid = (bid + ask) / 2
        spread = ask - bid
        pair = payload.get("instrument", "")
        pip = 0.01 if "JPY" in pair else 0.0001

        return {
            "time": self._to_unix(payload["time"]),
            "bid": bid,
            "ask": ask,
            "mid": mid,
            "spread": spread,
            "spreadPips": round(spread / pip, 3) if pip else 0.0,
        }

    def _apply_quote(self, candles: List[Dict], price: float, timestamp: int, timeframe: str) -> Tuple[Dict, bool]:
        step = TIMEFRAME_SECONDS.get(timeframe, 60)
        bucket = timestamp - (timestamp % step)

        if candles and candles[-1]["time"] == bucket:
            last = candles[-1]
            last["high"] = max(float(last["high"]), price)
            last["low"] = min(float(last["low"]), price)
            last["close"] = price
            last["volume"] = int(last.get("volume", 0)) + 1
            last["complete"] = False
            return last, True

        if candles:
            candles[-1]["complete"] = True
            open_price = float(candles[-1]["close"])
        else:
            open_price = price

        candle = {
            "time": bucket,
            "open": open_price,
            "high": max(open_price, price),
            "low": min(open_price, price),
            "close": price,
            "volume": 1,
            "complete": False,
        }
        candles.append(candle)
        if len(candles) > 400:
            del candles[0]
        return candle, False

    async def _build_orderflow_snapshot(self, pair: str, reference_price: float) -> Dict:
        order_book = await self.oanda.fetch_order_book(pair)
        position_book = await self.oanda.fetch_position_book(pair)

        resting_long, resting_short = self._extract_book_balance(order_book, reference_price)
        position_long, position_short = self._extract_book_balance(position_book, reference_price)
        flow_bias = resting_long - resting_short
        inventory_bias = position_long - position_short

        if flow_bias > 6 and inventory_bias > 0:
            signal = "Bullish liquidity skew"
        elif flow_bias < -6 and inventory_bias < 0:
            signal = "Bearish liquidity skew"
        else:
            signal = "Balanced book conditions"

        return {
            "restingLong": round(resting_long, 1),
            "restingShort": round(resting_short, 1),
            "positionLong": round(position_long, 1),
            "positionShort": round(position_short, 1),
            "flowBias": round(flow_bias, 1),
            "inventoryBias": round(inventory_bias, 1),
            "signal": signal,
            "note": "OTC forex has no central tape, so this view blends OANDA books with live quote flow.",
        }

    def _extract_book_balance(self, book: Optional[Dict], reference_price: float) -> Tuple[float, float]:
        if not book:
            return 50.0, 50.0

        buckets = book.get("buckets") or []
        if not buckets:
            return 50.0, 50.0

        nearby = sorted(
            buckets,
            key=lambda bucket: abs(float(bucket.get("price", reference_price)) - reference_price),
        )[:6]

        if not nearby:
            return 50.0, 50.0

        long_sum = sum(float(bucket.get("longCountPercent", 50)) for bucket in nearby)
        short_sum = sum(float(bucket.get("shortCountPercent", 50)) for bucket in nearby)
        return long_sum / len(nearby), short_sum / len(nearby)

    def _market_clock(self) -> Dict:
        now_utc = datetime.now(timezone.utc)
        london = self._london_time(now_utc)
        new_york = self._new_york_time(now_utc)
        market_open = self._is_market_open(new_york)
        london_open = market_open and 8 <= london.hour < 17
        new_york_open = market_open and 8 <= new_york.hour < 17

        if london_open and new_york_open:
            active_session = "London + New York overlap"
        elif london_open:
            active_session = "London session"
        elif new_york_open:
            active_session = "New York session"
        else:
            active_session = "Off session"

        return {
            "weekday": now_utc.strftime("%A"),
            "utcTime": now_utc.strftime("%H:%M:%S UTC"),
            "londonTime": london.strftime("%H:%M:%S"),
            "newYorkTime": new_york.strftime("%H:%M:%S"),
            "marketOpen": market_open,
            "londonOpen": london_open,
            "newYorkOpen": new_york_open,
            "activeSession": active_session,
        }

    def _is_market_open(self, new_york_time: datetime) -> bool:
        weekday = new_york_time.weekday()
        if weekday == 5:
            return False
        if weekday == 6:
            return new_york_time.hour >= 17
        if weekday == 4:
            return new_york_time.hour < 17
        return True

    def _to_unix(self, value: str) -> int:
        normalized = value.replace("Z", "+00:00")
        if "." in normalized:
            head, tail = normalized.split(".", 1)
            offset_index = max(tail.find("+"), tail.find("-"))
            if offset_index != -1:
                fraction = tail[:offset_index]
                offset = tail[offset_index:]
                normalized = f"{head}.{fraction[:6]}{offset}"
        return int(datetime.fromisoformat(normalized).timestamp())

    def _london_time(self, now_utc: datetime) -> datetime:
        offset = 1 if self._is_uk_dst(now_utc) else 0
        return now_utc + timedelta(hours=offset)

    def _new_york_time(self, now_utc: datetime) -> datetime:
        offset = -4 if self._is_us_dst(now_utc) else -5
        return now_utc + timedelta(hours=offset)

    def _is_us_dst(self, now_utc: datetime) -> bool:
        year = now_utc.year
        start_day = self._nth_weekday(year, 3, 6, 2)
        end_day = self._nth_weekday(year, 11, 6, 1)
        start = datetime(year, 3, start_day, 7, 0, tzinfo=timezone.utc)
        end = datetime(year, 11, end_day, 6, 0, tzinfo=timezone.utc)
        return start <= now_utc < end

    def _is_uk_dst(self, now_utc: datetime) -> bool:
        year = now_utc.year
        start_day = self._last_weekday(year, 3, 6)
        end_day = self._last_weekday(year, 10, 6)
        start = datetime(year, 3, start_day, 1, 0, tzinfo=timezone.utc)
        end = datetime(year, 10, end_day, 1, 0, tzinfo=timezone.utc)
        return start <= now_utc < end

    def _nth_weekday(self, year: int, month: int, weekday: int, occurrence: int) -> int:
        day = 1
        hits = 0
        while True:
            current = datetime(year, month, day)
            if current.weekday() == weekday:
                hits += 1
                if hits == occurrence:
                    return day
            day += 1

    def _last_weekday(self, year: int, month: int, weekday: int) -> int:
        if month == 12:
            next_month = datetime(year + 1, 1, 1)
        else:
            next_month = datetime(year, month + 1, 1)

        current = next_month - timedelta(days=1)
        while current.weekday() != weekday:
            current -= timedelta(days=1)
        return current.day
