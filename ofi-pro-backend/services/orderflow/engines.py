# services/orderflow/engines.py
from typing import Dict, List, Optional, Tuple

import aiohttp

from .dataclass import Candle, OrderFlowData
from .oanda_client import OandaClient
from .utils import format_price, grade_confidence, pair_name, safe_div


def parse_candle(candle: dict) -> Optional[Candle]:
    try:
        mid = candle.get("mid")
        if not mid:
            return None

        open_price = float(mid["o"])
        high = float(mid["h"])
        low = float(mid["l"])
        close = float(mid["c"])
        volume = max(float(candle.get("volume", 1)), 1)
        spread = high - low
        body = close - open_price

        if spread > 0:
            body_pct = abs(body) / spread
            buy_share = 0.5 + body_pct * 0.5 if body > 0 else 0.5 - body_pct * 0.5
        else:
            buy_share = 0.5

        buy_volume = volume * buy_share
        sell_volume = volume * (1 - buy_share)

        return Candle(
            time=candle.get("time", ""),
            open=open_price,
            high=high,
            low=low,
            close=close,
            volume=volume,
            range=spread,
            body=body,
            body_abs=abs(body),
            buy_vol=buy_volume,
            sell_vol=sell_volume,
            delta=buy_volume - sell_volume,
            complete=candle.get("complete", True),
        )
    except Exception:
        return None


def parse_candles(raw_candles: List[dict]) -> List[Candle]:
    return [candle for candle in (parse_candle(item) for item in raw_candles) if candle]


class OrderFlowEngine:
    @staticmethod
    def calculate(candles: List[Candle]) -> OrderFlowData:
        if not candles:
            return OrderFlowData(0, 0, 0, 0, 0, 50, 50, 0, 0, 0, 0, 0, [])

        total_buy = sum(c.buy_vol for c in candles)
        total_sell = sum(c.sell_vol for c in candles)
        total_volume = total_buy + total_sell
        cumulative_delta = sum(c.delta for c in candles)

        return OrderFlowData(
            buy_vol=total_buy,
            sell_vol=total_sell,
            total_vol=total_volume,
            cvd=cumulative_delta,
            delta=sum(c.delta for c in candles[-20:]),
            buy_pct=safe_div(total_buy, total_volume, 0.5) * 100,
            sell_pct=safe_div(total_sell, total_volume, 0.5) * 100,
            imbalance=safe_div(total_buy - total_sell, total_volume, 0.0) * 100,
            price=candles[-1].close,
            vwap=candles[-1].close,
            delta_momentum=0,
            vol_trend=0,
            candles=candles,
        )


class AnalysisRunner:
    @staticmethod
    def _clamp(value: float, lower: float, upper: float) -> float:
        return max(lower, min(value, upper))

    @classmethod
    def _signed_score(cls, value: float, threshold: float, cap: float, weight: float) -> float:
        if abs(value) <= threshold or cap <= 0:
            return 0.0
        scaled = min(abs(value), cap) / cap
        return scaled * weight if value > 0 else -scaled * weight

    @classmethod
    def _build_summary(cls, instrument: str, candles: List[Candle], flow: OrderFlowData) -> Dict:
        recent = candles[-20:]
        previous = candles[-40:-20] or candles[-20:]

        recent_delta = sum(c.delta for c in recent)
        previous_delta = sum(c.delta for c in previous)
        recent_volume = sum(c.volume for c in recent)
        previous_volume = sum(c.volume for c in previous) or recent_volume

        reference_open = recent[0].open
        price_change = recent[-1].close - reference_open
        price_change_pct = safe_div(price_change, reference_open, 0.0) * 100
        delta_share = safe_div(recent_delta, recent_volume, 0.0) * 100
        previous_delta_share = safe_div(previous_delta, previous_volume, 0.0) * 100
        volume_ratio = safe_div(recent_volume, previous_volume, 1.0)
        body_ratio = safe_div(sum(c.body_abs for c in recent), sum(c.range for c in recent), 0.0)
        recent_high = max(c.high for c in recent)
        recent_low = min(c.low for c in recent)
        pip_factor = 100 if "JPY" in instrument else 10000
        range_pips = abs(recent_high - recent_low) * pip_factor

        flow_signal = cls._signed_score(flow.imbalance, 2.0, 18.0, 30.0)
        delta_signal = cls._signed_score(delta_share, 1.0, 12.0, 24.0)
        price_signal = cls._signed_score(price_change_pct, 0.02, 0.8, 22.0)
        momentum_signal = cls._signed_score(recent_delta - previous_delta, 0.0, max(recent_volume, 1.0), 10.0)

        aggregate_signal = flow_signal + delta_signal + price_signal + momentum_signal
        bull_score = cls._clamp(50 + aggregate_signal, 0, 100)
        bear_score = cls._clamp(50 - aggregate_signal, 0, 100)
        score_gap = abs(bull_score - bear_score)

        bullish_alignment = sum(1 for value in (flow.imbalance, delta_share, price_change_pct) if value > 0)
        bearish_alignment = sum(1 for value in (flow.imbalance, delta_share, price_change_pct) if value < 0)

        if bull_score - bear_score >= 8:
            bias = "Bullish"
            alignment_bonus = bullish_alignment * 4
        elif bear_score - bull_score >= 8:
            bias = "Bearish"
            alignment_bonus = bearish_alignment * 4
        else:
            bias = "Neutral"
            alignment_bonus = 0

        strength_bonus = min(abs(flow.imbalance), 20) * 0.6
        strength_bonus += min(abs(delta_share), 12) * 0.8
        strength_bonus += min(abs(price_change_pct), 0.8) * 18
        strength_bonus += max(0.0, volume_ratio - 1.0) * 18
        strength_bonus += body_ratio * 10

        if bias == "Neutral":
            confidence_percent = cls._clamp(42 + score_gap * 0.3 + min(body_ratio * 10, 6), 35, 68)
            bias_label = "Neutral Bias"
        else:
            confidence_percent = cls._clamp(48 + score_gap * 0.45 + alignment_bonus + strength_bonus, 45, 95)
            bias_label = f"{bias} Bias"

        confidence_percent = int(round(confidence_percent))
        confidence_score = round(confidence_percent / 10, 1)

        drivers = [
            f"Order flow imbalance is {flow.imbalance:+.1f}% with {flow.buy_pct:.1f}% buyer participation.",
            f"Recent delta share is {delta_share:+.1f}% across the latest {len(recent)} candles.",
            f"Price moved {price_change_pct:+.2f}% while volume ran at {volume_ratio:.2f}x of the prior block.",
        ]

        if range_pips > 0:
            drivers.append(
                f"Observed range spans {range_pips:.1f} pips between {format_price(recent_low, instrument)} and {format_price(recent_high, instrument)}."
            )

        factors = [
            {
                "label": "Order Flow",
                "score": int(round(cls._clamp(50 + flow_signal, 5, 95))),
                "note": f"Imbalance {flow.imbalance:+.1f}% with CVD {flow.cvd:+.0f}.",
            },
            {
                "label": "Delta",
                "score": int(round(cls._clamp(50 + delta_signal, 5, 95))),
                "note": f"Recent delta share {delta_share:+.1f}% versus previous block {previous_delta_share:+.1f}%.",
            },
            {
                "label": "Price Structure",
                "score": int(round(cls._clamp(50 + price_signal, 5, 95))),
                "note": f"Window move {price_change_pct:+.2f}% from {format_price(reference_open, instrument)} to {format_price(recent[-1].close, instrument)}.",
            },
            {
                "label": "Participation",
                "score": int(round(cls._clamp(45 + max(0.0, volume_ratio - 1.0) * 40 + body_ratio * 20, 5, 95))),
                "note": f"Volume ratio {volume_ratio:.2f}x with body efficiency {body_ratio:.2f}.",
            },
        ]

        return {
            "bias": bias,
            "biasLabel": bias_label,
            "confidencePercent": confidence_percent,
            "confidenceScore": confidence_score,
            "grade": grade_confidence(confidence_percent),
            "price": round(flow.price, 3 if "JPY" in instrument else 5),
            "drivers": drivers,
            "factors": factors,
            "stats": {
                "buyPercent": round(flow.buy_pct, 1),
                "sellPercent": round(flow.sell_pct, 1),
                "imbalance": round(flow.imbalance, 1),
                "delta": round(flow.delta, 1),
                "cvd": round(flow.cvd, 1),
                "priceChangePercent": round(price_change_pct, 2),
                "volumeRatio": round(volume_ratio, 2),
                "rangePips": round(range_pips, 1),
            },
        }

    @staticmethod
    async def run_analysis(
        session: aiohttp.ClientSession,
        instrument: str,
        timeframe: str = "M5",
        detailed: bool = False,
    ) -> Tuple[Optional[Dict], Optional[str]]:
        try:
            oanda = OandaClient(session)
            raw_candles = await oanda.fetch_candles(instrument, timeframe, 200)

            if not raw_candles:
                return None, oanda.last_error or "Failed to fetch candle data from OANDA"

            candles = parse_candles(raw_candles)
            if len(candles) < 30:
                return None, "Insufficient data for analysis"

            flow = OrderFlowEngine.calculate(candles)
            summary = AnalysisRunner._build_summary(instrument, candles, flow)
            stats = summary["stats"]

            messages = [
                f"{pair_name(instrument)} Analysis",
                f"Price: {format_price(flow.price, instrument)}",
                f"Bias: {summary['biasLabel']}",
                f"Confidence Score: {summary['confidenceScore']:.1f}/10 ({summary['confidencePercent']}%)",
                f"Order Flow Imbalance: {stats['imbalance']:+.1f}%",
                f"Recent Delta: {stats['delta']:+.0f}",
                f"Buyer Participation: {stats['buyPercent']:.1f}% vs Seller Participation: {stats['sellPercent']:.1f}%",
            ]

            for driver in summary["drivers"]:
                messages.append(f"- {driver}")

            if detailed:
                messages.extend(
                    [
                        f"Volume Ratio: {stats['volumeRatio']:.2f}x",
                        f"Window Price Change: {stats['priceChangePercent']:+.2f}%",
                        f"Observed Range: {stats['rangePips']:.1f} pips",
                    ]
                )

            return {"messages": messages, "summary": summary}, None
        except Exception as error:
            return None, f"Error during analysis: {str(error)}"
