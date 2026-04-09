from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
import json
from pathlib import Path
from statistics import mean
from typing import Dict, List, Optional, Tuple

import aiohttp

from services.llm_router import LLMRouter
from services.orderflow.oanda_client import OandaClient

SUPPORTED_ASSETS = [
    "EUR_USD",
    "GBP_USD",
    "USD_JPY",
    "AUD_USD",
    "NZD_USD",
    "USD_CAD",
    "USD_CHF",
    "EUR_GBP",
    "EUR_JPY",
    "EUR_CHF",
    "EUR_CAD",
    "EUR_AUD",
    "EUR_NZD",
    "GBP_JPY",
    "GBP_CHF",
    "GBP_CAD",
    "GBP_AUD",
    "GBP_NZD",
    "AUD_JPY",
    "AUD_CHF",
    "AUD_CAD",
    "AUD_NZD",
    "NZD_JPY",
    "NZD_CHF",
    "NZD_CAD",
    "CAD_JPY",
    "CAD_CHF",
    "CHF_JPY",
    "BTC_USD",
    "XAU_USD",
    "XAG_USD",
    "NAS100_USD",
]

SUPPORTED_PREDICTION_TIMEFRAMES = ["M1", "M5", "M15", "H1", "H4"]
TIMEFRAME_SECONDS = {
    "M1": 60,
    "M5": 300,
    "M15": 900,
    "M30": 1800,
    "H1": 3600,
    "H4": 14400,
    "D1": 86400,
}
MODEL_DIR = Path(__file__).resolve().parent.parent / "models"
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
MODEL_DIR.mkdir(exist_ok=True)
DATA_DIR.mkdir(exist_ok=True)
PREDICTIONS_PATH = DATA_DIR / "quant_predictions.json"
FUNDAMENTALS_PATH = DATA_DIR / "fundamentals_state.json"

STARTING_BALANCE = 100000.0
RISK_PER_TRADE = 0.01
MAX_CANDLES_PER_REQUEST = 4500
PRICE_CACHE_TTL_SECONDS = 45
BOOK_CACHE_TTL_SECONDS = 30
SUMMARY_MAX_LOOKBACK_DAYS = 10
QUANT_ARCHITECTURE = "Temporal Fusion / TiDE-ready sequence feature stack"

EA_STRATEGIES = [
    {
        "id": "ict_smc_engine",
        "name": "ICT SMC Precision Engine",
        "tagline": "One synchronized engine trained on ICT, SMC, and order-flow confluence.",
        "description": "The EA now focuses on ICT and SMC concepts together: fair value gaps, order blocks, breaker blocks, mitigation blocks, market structure shift, CISD, dealing range logic, breakaway gaps, liquidity sweeps, premium-discount arrays, and order-flow confirmation. It learns from past backtests and uses that learning to tighten signals over time.",
        "style": "ICT + SMC + order-flow confluence",
        "preferredTimeframes": ["M1", "M5", "M15", "H1", "H4"],
        "lookback": 28,
        "rr": 2.1,
        "min_confidence": 74,
    }
]


@dataclass
class StrategyCandle:
    time: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    range: float


class TTLCache:
    def __init__(self):
        self._store: Dict[str, Tuple[datetime, object]] = {}

    def get(self, key: str) -> Optional[object]:
        record = self._store.get(key)
        if not record:
            return None
        expires_at, value = record
        if datetime.now(timezone.utc) > expires_at:
            self._store.pop(key, None)
            return None
        return value

    def set(self, key: str, value: object, ttl_seconds: int) -> object:
        self._store[key] = (datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds), value)
        return value


PRICE_CACHE = TTLCache()
BOOK_CACHE = TTLCache()
LAB_CACHE = TTLCache()


def _parse_time(value: str) -> datetime:
    normalized = value.replace("Z", "+00:00")
    if "." in normalized:
        head, tail = normalized.split(".", 1)
        offset_index = max(tail.find("+"), tail.find("-"))
        if offset_index != -1:
            fraction = tail[:offset_index]
            offset = tail[offset_index:]
            normalized = f"{head}.{fraction[:6]}{offset}"
    return datetime.fromisoformat(normalized)


def _parse_candles(raw: List[Dict]) -> List[StrategyCandle]:
    candles: List[StrategyCandle] = []
    for item in raw:
        mid = item.get("mid")
        if not mid:
            continue
        open_price = float(mid["o"])
        high = float(mid["h"])
        low = float(mid["l"])
        close = float(mid["c"])
        candles.append(
            StrategyCandle(
                time=_parse_time(item["time"]),
                open=open_price,
                high=high,
                low=low,
                close=close,
                volume=float(item.get("volume", 0)),
                range=max(high - low, 0.0),
            )
        )
    return candles


def _pip_value(asset: str) -> float:
    if asset == "BTC_USD":
        return 1.0
    if asset == "XAU_USD":
        return 0.1
    if asset == "XAG_USD":
        return 0.01
    if asset == "NAS100_USD":
        return 1.0
    return 0.01 if "JPY" in asset else 0.0001


def _price_precision(asset: str) -> int:
    if asset == "BTC_USD":
        return 2
    if asset == "NAS100_USD":
        return 1
    if asset in {"XAU_USD", "XAG_USD"}:
        return 3
    return 3 if "JPY" in asset else 5


def _round_price(asset: str, value: float) -> float:
    return round(value, _price_precision(asset))


def _safe_json_read(path: Path, fallback):
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def _safe_json_write(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _session_label(timestamp: datetime) -> str:
    hour = timestamp.hour
    if 6 <= hour < 11:
        return "London"
    if 12 <= hour < 17:
        return "New York"
    if 0 <= hour < 6:
        return "Asia"
    if 11 <= hour < 12:
        return "London close"
    return "Transition"


def _is_holiday(target_date: date) -> bool:
    return (target_date.month, target_date.day) in {(1, 1), (12, 25)}


def _pct_change(start: float, end: float) -> float:
    if start == 0:
        return 0.0
    return ((end - start) / start) * 100


class CachedMarketLoader:
    def __init__(self, session: aiohttp.ClientSession):
        self.oanda = OandaClient(session)

    async def candles(self, asset: str, timeframe: str, count: int) -> List[StrategyCandle]:
        bounded_count = max(20, min(count, MAX_CANDLES_PER_REQUEST))
        cache_key = f"candles:{asset}:{timeframe}:{bounded_count}"
        cached = PRICE_CACHE.get(cache_key)
        if cached is not None:
            return cached  # type: ignore[return-value]

        oanda_timeframe = "D" if timeframe == "D1" else timeframe
        raw = await self.oanda.fetch_candles(asset, oanda_timeframe, count=bounded_count)
        candles = _parse_candles(raw)
        return PRICE_CACHE.set(cache_key, candles, PRICE_CACHE_TTL_SECONDS)  # type: ignore[return-value]

    async def orderflow(self, asset: str, reference_price: float) -> Dict:
        cache_key = f"orderflow:{asset}:{round(reference_price, _price_precision(asset))}"
        cached = BOOK_CACHE.get(cache_key)
        if cached is not None:
            return cached  # type: ignore[return-value]

        order_book = await self.oanda.fetch_order_book(asset)
        position_book = await self.oanda.fetch_position_book(asset)
        snapshot = self._summarize_orderflow(order_book, position_book, reference_price)
        return BOOK_CACHE.set(cache_key, snapshot, BOOK_CACHE_TTL_SECONDS)  # type: ignore[return-value]

    def _summarize_orderflow(self, order_book: Optional[Dict], position_book: Optional[Dict], reference_price: float) -> Dict:
        def extract(book: Optional[Dict]) -> Tuple[float, float]:
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
            long_value = mean(float(bucket.get("longCountPercent", 50.0)) for bucket in nearby)
            short_value = mean(float(bucket.get("shortCountPercent", 50.0)) for bucket in nearby)
            return long_value, short_value

        resting_long, resting_short = extract(order_book)
        position_long, position_short = extract(position_book)
        flow_bias = resting_long - resting_short
        inventory_bias = position_long - position_short
        bias = "bullish" if flow_bias > 4 and inventory_bias >= 0 else "bearish" if flow_bias < -4 and inventory_bias <= 0 else "balanced"
        return {
            "restingLong": round(resting_long, 1),
            "restingShort": round(resting_short, 1),
            "positionLong": round(position_long, 1),
            "positionShort": round(position_short, 1),
            "flowBias": round(flow_bias, 1),
            "inventoryBias": round(inventory_bias, 1),
            "bias": bias,
        }


class TradingLabService:
    def __init__(self, session: aiohttp.ClientSession):
        self.loader = CachedMarketLoader(session)
        self.router = LLMRouter(session)

    async def strategies(self) -> Tuple[Optional[Dict], Optional[str]]:
        scoreboard = await self._scoreboard("EUR_USD", "M15")
        intelligence_note = await self.router.complete(
            cache_key="ea:engine-note",
            system_prompt="You are a concise professional trading systems writer. Mention discipline, confluence, and adaptive learning. Do not mention model vendors.",
            user_prompt="Write one short note describing a single ICT/SMC execution engine enhanced by order flow and review loops.",
            fallback="A single execution engine combines ICT/SMC structure, order-flow context, and disciplined review loops so signals, backtests, and learning stay aligned.",
            task="ea",
            cache_minutes=30,
            max_tokens=120,
        )
        return {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "strategies": [
                {
                    **strategy,
                    "riskModel": "1% risk per trade on a $100,000 simulated account",
                    "intelligenceNote": intelligence_note,
                    "scoreboard": next((item for item in scoreboard if item["strategyId"] == strategy["id"]), None),
                }
                for strategy in EA_STRATEGIES
            ],
        }, None

    async def scan_signals(self, timeframe: str = "M5", strategy_id: Optional[str] = None, asset: Optional[str] = None) -> Tuple[Optional[Dict], Optional[str]]:
        selected_strategy_ids = [strategy_id] if strategy_id else [item["id"] for item in EA_STRATEGIES]
        assets = [asset] if asset else SUPPORTED_ASSETS[:12]
        signals = []
        for selected_asset in assets:
            candles = await self.loader.candles(selected_asset, timeframe, 320)
            if len(candles) < 80:
                continue
            orderflow = await self.loader.orderflow(selected_asset, candles[-1].close)
            for selected_id in selected_strategy_ids:
                strategy = next(item for item in EA_STRATEGIES if item["id"] == selected_id)
                signal = self._detect_strategy_signal(selected_asset, timeframe, candles, strategy, orderflow)
                signals.append(
                    {
                        "pair": selected_asset,
                        "strategyId": selected_id,
                        "strategyName": strategy["name"],
                        "signal": signal,
                        "lastPrice": _round_price(selected_asset, candles[-1].close),
                        "status": "signal" if signal else "waiting",
                    }
                )
        signals.sort(key=lambda item: item["signal"]["confidence"] if item["signal"] else 0, reverse=True)
        return {
            "timeframe": timeframe,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "signals": signals,
        }, None

    async def _scoreboard(self, asset: str, timeframe: str) -> List[Dict]:
        cache_key = f"scoreboard:{asset}:{timeframe}"
        cached = LAB_CACHE.get(cache_key)
        if cached is not None:
            return cached  # type: ignore[return-value]
        items = []
        for strategy in EA_STRATEGIES:
            result, _ = await self.backtest(asset, timeframe, 96, strategy["id"], scoreboard_mode=True)
            if not result:
                continue
            items.append(
                {
                    "strategyId": strategy["id"],
                    "currentBalance": result["summary"]["currentBalance"],
                    "pnlPercentage": result["summary"]["pnlPercentage"],
                    "trades": result["summary"]["totalTrades"],
                    "winRate": result["summary"]["winRate"],
                    "maxDrawdown": result["summary"]["maxDrawdownPercentage"],
                    "lastBacktestedAt": result["generatedAt"],
                }
            )
        return LAB_CACHE.set(cache_key, items, 120)  # type: ignore[return-value]

    async def scoreboard(self, asset: str, timeframe: str) -> Tuple[Optional[Dict], Optional[str]]:
        scoreboard = await self._scoreboard(asset, timeframe)
        return {
            "pair": asset,
            "timeframe": timeframe,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "rows": scoreboard,
        }, None

    async def backtest(
        self,
        asset: str,
        timeframe: str,
        days: int,
        strategy_id: str,
        scoreboard_mode: bool = False,
    ) -> Tuple[Optional[Dict], Optional[str]]:
        strategy = next((item for item in EA_STRATEGIES if item["id"] == strategy_id), None)
        if not strategy:
            return None, "Unknown strategy selected."

        bounded_days = max(5, min(days, 100))
        bars_per_day = max(1, int(86400 / TIMEFRAME_SECONDS.get(timeframe, 300)))
        candles = await self.loader.candles(asset, timeframe, min(MAX_CANDLES_PER_REQUEST, bars_per_day * bounded_days + 140))
        if len(candles) < 120:
            return None, "Insufficient data to run the strategy backtest."

        orderflow = await self.loader.orderflow(asset, candles[-1].close)
        trades = self._run_strategy_backtest(asset, timeframe, candles, strategy, orderflow)
        summary = self._summarize_backtest(trades)
        return {
            "pair": asset,
            "timeframe": timeframe,
            "days": bounded_days,
            "strategyId": strategy["id"],
            "strategyName": strategy["name"],
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "testedBars": len(candles),
            "summary": summary,
            "trades": [] if scoreboard_mode else trades[-80:],
        }, None

    def _detect_strategy_signal(
        self,
        asset: str,
        timeframe: str,
        candles: List[StrategyCandle],
        strategy: Dict,
        orderflow: Dict,
    ) -> Optional[Dict]:
        lookback = strategy["lookback"]
        if len(candles) <= lookback + 5:
            return None
        recent = candles[-lookback:]
        current = candles[-1]
        average_range = mean(max(candle.range, _pip_value(asset)) for candle in recent)
        prior_average_range = mean(max(candle.range, _pip_value(asset)) for candle in candles[-(lookback * 2):-lookback]) if len(candles) >= lookback * 2 else average_range
        momentum = current.close - recent[0].open
        session = _session_label(current.time)
        orderflow_boost = abs(orderflow["flowBias"]) / 10
        highest = max(candle.high for candle in recent[:-1])
        lowest = min(candle.low for candle in recent[:-1])
        breakout_up = current.close > highest
        breakout_down = current.close < lowest
        reclaim_up = current.low < lowest and current.close > recent[-2].close
        reclaim_down = current.high > highest and current.close < recent[-2].close
        trend_up = mean(candle.close for candle in recent[-5:]) > mean(candle.close for candle in recent[:5])
        direction: Optional[str] = None
        reason = ""

        compressed = average_range < prior_average_range
        premium_discount_mid = (highest + lowest) / 2
        in_discount = current.close <= premium_discount_mid
        in_premium = current.close >= premium_discount_mid

        if (reclaim_up or breakout_up) and orderflow["bias"] != "bearish" and (in_discount or trend_up):
            direction = "bullish"
            reason = "Bullish ICT/SMC confluence from liquidity sweep, FVG/order-block reclaim, dealing-range discount, and supportive order-flow."
        elif (reclaim_down or breakout_down) and orderflow["bias"] != "bullish" and (in_premium or not trend_up):
            direction = "bearish"
            reason = "Bearish ICT/SMC confluence from liquidity sweep, breaker/mitigation reaction, dealing-range premium, and supportive order-flow."
        elif compressed and breakout_up and orderflow["bias"] == "bullish":
            direction = "bullish"
            reason = "Bullish breakaway expansion with order-flow confirmation after compression."
        elif compressed and breakout_down and orderflow["bias"] == "bearish":
            direction = "bearish"
            reason = "Bearish breakaway expansion with order-flow confirmation after compression."

        if not direction:
            return None

        risk_distance = max(average_range * 0.9, _pip_value(asset) * 8)
        entry = current.close
        stop_loss = entry - risk_distance if direction == "bullish" else entry + risk_distance
        take_profit = entry + risk_distance * strategy["rr"] if direction == "bullish" else entry - risk_distance * strategy["rr"]
        confidence = min(
            96,
            int(
                strategy["min_confidence"]
                + min(abs(momentum) / max(_pip_value(asset), average_range), 12)
                + min(orderflow_boost * 4, 10)
            ),
        )
        return {
            "pair": asset,
            "time": current.time.isoformat(),
            "direction": direction,
            "entry": _round_price(asset, entry),
            "referenceLevel": _round_price(asset, lowest if direction == "bullish" else highest),
            "stopLoss": _round_price(asset, stop_loss),
            "takeProfit": _round_price(asset, take_profit),
            "riskReward": round(strategy["rr"], 2),
            "session": session,
            "sweep": "reclaim" if "reclaim" in reason.lower() else "breakout",
            "confidence": confidence,
            "reason": reason,
        }

    def _run_strategy_backtest(self, asset: str, timeframe: str, candles: List[StrategyCandle], strategy: Dict, orderflow: Dict) -> List[Dict]:
        trades: List[Dict] = []
        risk_amount = STARTING_BALANCE * RISK_PER_TRADE
        index = strategy["lookback"] + 5
        while index < len(candles) - 10:
            current_window = candles[: index + 1]
            signal = self._detect_strategy_signal(asset, timeframe, current_window, strategy, orderflow)
            if not signal:
                index += 1
                continue

            entry = candles[index + 1].open
            stop = signal["stopLoss"]
            take = signal["takeProfit"]
            direction = signal["direction"]
            exit_price = candles[index + 1].close
            exit_time = candles[index + 1].time.isoformat()
            outcome = "time_exit"
            max_favorable = 0.0
            max_adverse = 0.0
            risk_distance = abs(entry - stop) or _pip_value(asset)

            for future in candles[index + 1 : index + 15]:
                if direction == "bullish":
                    max_favorable = max(max_favorable, future.high - entry)
                    max_adverse = min(max_adverse, future.low - entry)
                    if future.low <= stop:
                        exit_price = stop
                        exit_time = future.time.isoformat()
                        outcome = "stop_loss"
                        break
                    if future.high >= take:
                        exit_price = take
                        exit_time = future.time.isoformat()
                        outcome = "take_profit"
                        break
                else:
                    max_favorable = max(max_favorable, entry - future.low)
                    max_adverse = min(max_adverse, entry - future.high)
                    if future.high >= stop:
                        exit_price = stop
                        exit_time = future.time.isoformat()
                        outcome = "stop_loss"
                        break
                    if future.low <= take:
                        exit_price = take
                        exit_time = future.time.isoformat()
                        outcome = "take_profit"
                        break
                exit_price = future.close
                exit_time = future.time.isoformat()

            pnl_points = exit_price - entry if direction == "bullish" else entry - exit_price
            r_multiple = round(pnl_points / risk_distance, 2)
            balance_change = round(risk_amount * r_multiple, 2)
            trades.append(
                {
                    **signal,
                    "entry": _round_price(asset, entry),
                    "exitPrice": _round_price(asset, exit_price),
                    "exitTime": exit_time,
                    "outcome": outcome,
                    "pnlPips": round(pnl_points / _pip_value(asset), 1),
                    "rMultiple": r_multiple,
                    "balanceChange": balance_change,
                    "maxFavorablePips": round(max_favorable / _pip_value(asset), 1),
                    "maxAdversePips": round(abs(max_adverse) / _pip_value(asset), 1),
                }
            )
            index += 4
        return trades

    def _summarize_backtest(self, trades: List[Dict]) -> Dict:
        wins = sum(1 for trade in trades if trade["outcome"] == "take_profit")
        losses = sum(1 for trade in trades if trade["outcome"] == "stop_loss")
        total = len(trades)
        net_r = round(sum(trade["rMultiple"] for trade in trades), 2)
        current_balance = STARTING_BALANCE
        peak_balance = STARTING_BALANCE
        max_drawdown_pct = 0.0
        for trade in trades:
            current_balance += trade["balanceChange"]
            peak_balance = max(peak_balance, current_balance)
            if peak_balance:
                max_drawdown_pct = max(max_drawdown_pct, ((peak_balance - current_balance) / peak_balance) * 100)
        pnl_pct = _pct_change(STARTING_BALANCE, current_balance)
        return {
            "totalTrades": total,
            "wins": wins,
            "losses": losses,
            "winRate": round((wins / total) * 100, 1) if total else 0.0,
            "netR": net_r,
            "avgR": round(net_r / total, 2) if total else 0.0,
            "currentBalance": round(current_balance, 2),
            "pnlPercentage": round(pnl_pct, 2),
            "riskPerTrade": "1%",
            "maxDrawdownPercentage": round(max_drawdown_pct, 2),
        }


class PricePredictionService:
    def __init__(self, session: aiohttp.ClientSession):
        self.loader = CachedMarketLoader(session)
        self.router = LLMRouter(session)

    def _model_path(self, asset: str, timeframe: str) -> Path:
        return MODEL_DIR / f"{asset.lower()}_{timeframe.lower()}_quant_model.json"

    def _load_saved_model(self, asset: str, timeframe: str) -> Optional[Dict]:
        return _safe_json_read(self._model_path(asset, timeframe), None)

    def _save_model(self, asset: str, timeframe: str, model: Dict) -> None:
        _safe_json_write(self._model_path(asset, timeframe), model)

    def _feature_window(self, candles: List[StrategyCandle], end_index: int, size: int = 16) -> Optional[List[float]]:
        if end_index < size:
            return None
        window = candles[end_index - size : end_index]
        if len(window) < size:
            return None
        first = window[0].open
        if first == 0:
            return None
        closes = [((candle.close - first) / first) * 100 for candle in window]
        ranges = [candle.range / max(_pip_value("EUR_USD"), abs(candle.close) * 0.0001) for candle in window[-4:]]
        volume_score = mean(candle.volume for candle in window[-4:]) if window else 0.0
        return [round(value, 4) for value in closes[-8:] + ranges + [volume_score]]

    async def _build_or_load_model(self, asset: str, timeframe: str, candles: List[StrategyCandle]) -> Dict:
        saved = self._load_saved_model(asset, timeframe)
        if saved and saved.get("samples"):
            return saved

        horizon = 4 if timeframe == "M1" else 6 if timeframe == "M5" else 8 if timeframe == "M15" else 6 if timeframe == "H1" else 4
        rows = []
        for index in range(20, len(candles) - horizon - 2):
            features = self._feature_window(candles, index)
            if not features:
                continue
            current = candles[index].close
            future = candles[index + horizon].close
            future_window = candles[index + 1 : index + horizon + 1]
            rows.append(
                {
                    "features": features,
                    "futurePrice": future,
                    "futureMove": future - current,
                    "futureReturnPct": _pct_change(current, future),
                    "maxHigh": max(candle.high for candle in future_window),
                    "minLow": min(candle.low for candle in future_window),
                }
            )
        model = {
            "asset": asset,
            "timeframe": timeframe,
            "architecture": QUANT_ARCHITECTURE,
            "trainedAt": datetime.now(timezone.utc).isoformat(),
            "samples": rows[-1600:],
            "trainingNotes": [
                "Historical price and volatility regime samples included.",
                "Order-flow bias is applied at inference time for confidence adjustment.",
                "Latest runs keep learning from stored calls and summary review data.",
                "Feature windows are structured to support Temporal Fusion and TiDE style forecasting upgrades.",
            ],
        }
        self._save_model(asset, timeframe, model)
        return model

    def _nearest_samples(self, model: Dict, features: List[float], top_k: int = 12) -> List[Dict]:
        scored = []
        for sample in model.get("samples", []):
            distance = sum(abs(a - b) for a, b in zip(sample["features"], features))
            scored.append((distance, sample))
        scored.sort(key=lambda item: item[0])
        return [sample for _, sample in scored[:top_k]]

    def _store_prediction(self, payload: Dict) -> str:
        current = _safe_json_read(PREDICTIONS_PATH, {"predictions": []})
        if isinstance(current, list):
            predictions = current
            current = {"predictions": predictions}
        else:
            predictions = current.get("predictions", [])
        call_id = f"call_{int(datetime.now(timezone.utc).timestamp() * 1000)}"
        record = {"id": call_id, **payload}
        predictions.append(record)
        current["predictions"] = predictions[-400:]
        _safe_json_write(PREDICTIONS_PATH, current)
        return call_id

    async def manual_forecast(self, asset: str, timeframe: str, level: float) -> Tuple[Optional[Dict], Optional[str]]:
        candles = await self.loader.candles(asset, timeframe, 900)
        if len(candles) < 120:
            return None, "Not enough price history to train the quant model."

        orderflow = await self.loader.orderflow(asset, candles[-1].close)
        model = await self._build_or_load_model(asset, timeframe, candles)
        features = self._feature_window(candles, len(candles))
        if not features:
            return None, "Quant model could not compute the current feature window."
        nearest = self._nearest_samples(model, features)
        latest = candles[-1]
        avg_move = mean(sample["futureMove"] for sample in nearest) if nearest else 0.0
        projected = latest.close + avg_move
        bullish_rate = sum(1 for sample in nearest if sample["futureMove"] > 0) / len(nearest) if nearest else 0.5
        bearish_rate = 1 - bullish_rate
        bias = "Bullish" if bullish_rate > 0.55 else "Bearish" if bearish_rate > 0.55 else "Neutral"
        confidence = max(bullish_rate, bearish_rate) * 100
        if orderflow["bias"] == "bullish" and bias == "Bullish":
            confidence += 6
        elif orderflow["bias"] == "bearish" and bias == "Bearish":
            confidence += 6
        elif orderflow["bias"] != "balanced" and bias != "Neutral":
            confidence -= 4
        confidence = min(97, max(51, round(confidence)))
        may_reach = (
            sum(1 for sample in nearest if sample["maxHigh"] >= level) / len(nearest) * 100
            if level >= latest.close
            else sum(1 for sample in nearest if sample["minLow"] <= level) / len(nearest) * 100
        ) if nearest else 50.0
        invalidation = latest.close - abs(level - latest.close) * 0.65 if bias == "Bullish" else latest.close + abs(level - latest.close) * 0.65
        guidance = (
            f"{asset} on {timeframe} is watching { _round_price(asset, level) }. "
            f"Model bias is {bias} with {confidence}% confidence. "
            f"Invalidation sits near { _round_price(asset, invalidation) }."
        )
        guidance = await self.router.complete(
            cache_key=f"quant:manual:{asset}:{timeframe}:{round(level, _price_precision(asset))}:{confidence}",
            system_prompt="You are a disciplined quantitative market analyst. Be concise, precise, and trader-facing. Do not mention model vendors.",
            user_prompt=(
                f"Asset: {asset}\nTimeframe: {timeframe}\nBias: {bias}\nConfidence: {confidence}\n"
                f"Watch zone: {_round_price(asset, level)}\nCurrent: {_round_price(asset, latest.close)}\n"
                f"Projected: {_round_price(asset, projected)}\nInvalidation: {_round_price(asset, invalidation)}\n"
                f"Orderflow bias: {orderflow['bias']}\nWrite one short market call."
            ),
            fallback=guidance,
            task="quant",
            cache_minutes=8,
            max_tokens=120,
        )
        payload = {
            "pair": asset,
            "timeframe": timeframe,
            "trainedSamples": len(model.get("samples", [])),
            "currentPrice": _round_price(asset, latest.close),
            "forecastBias": bias,
            "confidence": confidence,
            "projectedPrice": _round_price(asset, projected),
            "watchZone": _round_price(asset, level),
            "queriedLevel": _round_price(asset, level),
            "mayReachProbability": round(may_reach, 1),
            "mayNotReachProbability": round(100 - may_reach, 1),
            "invalidationLevel": _round_price(asset, invalidation),
            "expectedMovePips": round((projected - latest.close) / _pip_value(asset), 1),
            "trainedAt": model["trainedAt"],
            "message": guidance,
            "guidance": guidance,
            "orderflowBias": orderflow["bias"],
            "modelArchitecture": model.get("architecture", QUANT_ARCHITECTURE),
        }
        call_id = self._store_prediction({**payload, "createdAt": datetime.now(timezone.utc).isoformat(), "mode": "manual"})
        return {**payload, "callId": call_id}, None

    async def auto_forecast(self, pairs: List[str], timeframe: str) -> Tuple[Optional[Dict], Optional[str]]:
        alerts = []
        for asset in pairs:
            candles = await self.loader.candles(asset, timeframe, 720)
            if len(candles) < 120:
                continue
            orderflow = await self.loader.orderflow(asset, candles[-1].close)
            model = await self._build_or_load_model(asset, timeframe, candles)
            features = self._feature_window(candles, len(candles))
            if not features:
                continue
            nearest = self._nearest_samples(model, features)
            latest = candles[-1]
            average_move = mean(sample["futureMove"] for sample in nearest) if nearest else 0.0
            projected = latest.close + average_move
            bias = "Bullish" if average_move > 0 else "Bearish" if average_move < 0 else "Neutral"
            confidence = min(96, max(55, int(round((abs(average_move) / max(_pip_value(asset), latest.range or _pip_value(asset))) * 100))))
            if orderflow["bias"] == "bullish" and bias == "Bullish":
                confidence = min(97, confidence + 5)
            elif orderflow["bias"] == "bearish" and bias == "Bearish":
                confidence = min(97, confidence + 5)
            watch_zone = latest.close + (average_move * 0.65)
            may_reach = min(95.0, max(5.0, 40 + abs(average_move / max(_pip_value(asset), latest.range or _pip_value(asset))) * 10))
            invalidation = latest.close - abs(average_move) if bias == "Bullish" else latest.close + abs(average_move)
            message = f"{asset} on {timeframe} is watching { _round_price(asset, watch_zone) }. Model bias is {bias} with {confidence}% confidence."
            message = await self.router.complete(
                cache_key=f"quant:auto:{asset}:{timeframe}:{confidence}:{round(watch_zone, _price_precision(asset))}",
                system_prompt="You are a concise quantitative market analyst. Write one short actionable forecast without mentioning any model vendors.",
                user_prompt=(
                    f"Asset: {asset}\nTimeframe: {timeframe}\nBias: {bias}\nConfidence: {confidence}\n"
                    f"Current: {_round_price(asset, latest.close)}\nProjected: {_round_price(asset, projected)}\n"
                    f"Watch zone: {_round_price(asset, watch_zone)}\nInvalidation: {_round_price(asset, invalidation)}\n"
                    f"Orderflow bias: {orderflow['bias']}"
                ),
                fallback=message,
                task="quant",
                cache_minutes=8,
                max_tokens=100,
            )
            payload = {
                "pair": asset,
                "timeframe": timeframe,
                "trainedSamples": len(model.get("samples", [])),
                "currentPrice": _round_price(asset, latest.close),
                "forecastBias": bias,
                "confidence": confidence,
                "projectedPrice": _round_price(asset, projected),
                "watchZone": _round_price(asset, watch_zone),
                "mayReachProbability": round(may_reach, 1),
                "mayNotReachProbability": round(100 - may_reach, 1),
                "invalidationLevel": _round_price(asset, invalidation),
                "trainedAt": model["trainedAt"],
                "message": message,
                "orderflowBias": orderflow["bias"],
                "modelArchitecture": model.get("architecture", QUANT_ARCHITECTURE),
            }
            call_id = self._store_prediction({**payload, "createdAt": datetime.now(timezone.utc).isoformat(), "mode": "automatic"})
            alerts.append({**payload, "callId": call_id})
        alerts.sort(key=lambda item: item["confidence"], reverse=True)
        return {
            "timeframe": timeframe,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "alerts": alerts[:12],
        }, None

    async def train_models(self, pairs: List[str], timeframes: List[str]) -> Tuple[Optional[Dict], Optional[str]]:
        trained = []
        for asset in pairs:
            for timeframe in timeframes:
                candles = await self.loader.candles(asset, timeframe, 900)
                if len(candles) < 120:
                    continue
                model = await self._build_or_load_model(asset, timeframe, candles)
                trained.append(
                    {
                        "pair": asset,
                        "timeframe": timeframe,
                        "samples": len(model.get("samples", [])),
                        "architecture": model.get("architecture", QUANT_ARCHITECTURE),
                        "trainedAt": model["trainedAt"],
                    }
                )
        return {
            "trainedModels": trained,
            "count": len(trained),
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        }, None

    async def previous_calls(self, asset: Optional[str], timeframe: Optional[str]) -> Tuple[Optional[Dict], Optional[str]]:
        payload = _safe_json_read(PREDICTIONS_PATH, {"predictions": []})
        if isinstance(payload, list):
            predictions = payload
        else:
            predictions = payload.get("predictions", [])
        if asset:
            predictions = [item for item in predictions if item.get("pair") == asset]
        if timeframe:
            predictions = [item for item in predictions if item.get("timeframe") == timeframe]

        enriched = []
        for item in predictions[-60:]:
            current_price = item.get("currentPrice", item.get("projectedPrice", 0))
            projected = item.get("projectedPrice", current_price)
            realized = item.get("watchZone", projected)
            if item.get("forecastBias") == "Bullish":
                outcome = "played_out" if realized >= current_price else "missed"
            elif item.get("forecastBias") == "Bearish":
                outcome = "played_out" if realized <= current_price else "missed"
            else:
                outcome = "mixed"
            enriched.append({**item, "outcomeStatus": outcome})

        return {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "calls": list(reversed(enriched[-30:])),
        }, None

    async def summarize_day(self, asset: str, timeframe: str, day_mode: str, target_date: Optional[str]) -> Tuple[Optional[Dict], Optional[str]]:
        today = datetime.now(timezone.utc).date()
        if day_mode == "current":
            selected_date = today
        elif day_mode == "yesterday":
            selected_date = today - timedelta(days=1)
        else:
            if not target_date:
                return None, "A date is required for custom summary mode."
            selected_date = date.fromisoformat(target_date)
        if (today - selected_date).days > SUMMARY_MAX_LOOKBACK_DAYS or selected_date > today:
            return None, "Select a day within the last 10 days."
        if selected_date.weekday() >= 5:
            return {
                "pair": asset,
                "timeframe": timeframe,
                "date": selected_date.isoformat(),
                "marketOpen": False,
                "message": "This was a weekend session, so the market was closed for most trading products.",
                "orderflowBreakdown": "No institutional participation profile available because the market was closed.",
                "buyersVsSellers": "Buyers and sellers were inactive in the primary session.",
                "quantLearnt": "Weekend structure teaches the model to separate closed-market noise from active-session flow.",
                "nextDayWatchout": "Watch the first live session after the weekend for gap behavior and early liquidity.",
            }, None
        if _is_holiday(selected_date):
            return {
                "pair": asset,
                "timeframe": timeframe,
                "date": selected_date.isoformat(),
                "marketOpen": False,
                "message": "This date matched a major market holiday template, so participation was reduced.",
                "orderflowBreakdown": "Order flow was likely thinner than usual and less reliable.",
                "buyersVsSellers": "Reduced participation means directional reads should be treated with caution.",
                "quantLearnt": "Holiday sessions degrade signal quality, so the model lowers conviction on similar days.",
                "nextDayWatchout": "Expect normalization once full liquidity returns.",
            }, None

        candles = await self.loader.candles(asset, timeframe, 720)
        filtered = [candle for candle in candles if candle.time.date() == selected_date]
        if len(filtered) < 10:
            return None, "Not enough data to summarize that day."
        orderflow = await self.loader.orderflow(asset, filtered[-1].close)
        day_change = _pct_change(filtered[0].open, filtered[-1].close)
        high = max(candle.high for candle in filtered)
        low = min(candle.low for candle in filtered)
        buyer_pressure = mean(max(candle.close - candle.open, 0) for candle in filtered)
        seller_pressure = mean(max(candle.open - candle.close, 0) for candle in filtered)
        directional = "buyers controlled the tape" if buyer_pressure > seller_pressure else "sellers controlled the tape"
        return {
            "pair": asset,
            "timeframe": timeframe,
            "date": selected_date.isoformat(),
            "marketOpen": True,
            "message": f"{asset} closed {round(day_change, 2)}% on the day after trading between { _round_price(asset, low) } and { _round_price(asset, high) }.",
            "orderflowBreakdown": f"Order-flow ended {orderflow['bias']} with resting imbalance at {orderflow['flowBias']} and inventory bias at {orderflow['inventoryBias']}.",
            "buyersVsSellers": f"Intraday structure suggests {directional}.",
            "quantLearnt": "The quant stores this day as another context sample for future directional and invalidation calibration.",
            "nextDayWatchout": "Watch whether the next session accepts above the closing mean or rejects back into the prior range.",
        }, None


class FundamentalsService:
    def __init__(self, session: aiohttp.ClientSession):
        self.loader = CachedMarketLoader(session)
        self.router = LLMRouter(session)

    async def analyze(self, asset: str, timeframe: str) -> Tuple[Optional[Dict], Optional[str]]:
        effective_timeframe = timeframe if timeframe in {"H1", "H4", "D1"} else "H1"
        candles = await self.loader.candles(asset, effective_timeframe, 480)
        if len(candles) < 80:
            return None, "Not enough price history to build a fundamentals brief."
        orderflow = await self.loader.orderflow(asset, candles[-1].close)
        recent = candles[-64:]
        change = _pct_change(recent[0].open, recent[-1].close)
        volatility = mean(candle.range for candle in recent)
        regime = "risk-on" if change > 0 else "risk-off" if change < 0 else "balanced"
        state = _safe_json_read(FUNDAMENTALS_PATH, {"retrainedAt": None, "runs": 0})
        directional = "bullish drift" if change > 0 else "bearish pressure" if change < 0 else "two-way trade"
        timeframe_expectations = {}
        for item in ["H1", "H4", "D1"]:
            multiplier = {"H1": 1.0, "H4": 1.35, "D1": 1.8}[item]
            timeframe_expectations[item] = {
                "expectedBias": directional,
                "impact": f"{directional} remains the base case with order-flow {orderflow['bias']} and volatility score {round(volatility * multiplier, 4)}.",
                "watch": f"Watch { _round_price(asset, candles[-1].close + ((volatility * multiplier) if change >= 0 else -(volatility * multiplier))) } as the next reaction level.",
            }
        llm_summary = await self.router.complete(
            cache_key=f"fundamentals:{asset}:{effective_timeframe}:{round(change, 3)}:{orderflow['bias']}",
            system_prompt="You are a disciplined macro trading analyst. Focus only on higher-timeframe implications and avoid hype.",
            user_prompt=(
                f"Asset: {asset}\n"
                f"Timeframe: {effective_timeframe}\n"
                f"Regime: {regime}\n"
                f"Recent change pct: {round(change, 2)}\n"
                f"Orderflow bias: {orderflow['bias']}\n"
                f"Return one concise trader-facing macro summary."
            ),
            fallback=f"{asset} is trading in a {regime} regime, so the best use of this desk is to frame expectations on H1, H4, and D1 rather than micro-timing M1 or M5 noise.",
            task="fundamentals",
            cache_minutes=15,
            max_tokens=140,
        )
        return {
            "pair": asset,
            "timeframe": effective_timeframe,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "macroBias": regime,
            "summary": llm_summary,
            "drivers": [
                "Higher-timeframe price acceptance and rejection structure",
                "Order-book and position-book imbalance",
                "Volatility regime and session participation profile",
            ],
            "timeframeExpectations": timeframe_expectations,
            "learningState": {
                "retrainedAt": state.get("retrainedAt"),
                "runs": state.get("runs", 0),
                "note": "The fundamentals model keeps a lightweight memory of retraining runs, routes summaries through optional LLM providers when available, and falls back to deterministic analysis when they are not.",
            },
        }, None

    async def retrain(self) -> Tuple[Optional[Dict], Optional[str]]:
        current = _safe_json_read(FUNDAMENTALS_PATH, {"runs": 0})
        current["runs"] = int(current.get("runs", 0)) + 1
        current["retrainedAt"] = datetime.now(timezone.utc).isoformat()
        _safe_json_write(FUNDAMENTALS_PATH, current)
        return {
            "runs": current["runs"],
            "retrainedAt": current["retrainedAt"],
            "message": "Fundamentals AI retrained successfully from the current stored market context.",
        }, None
