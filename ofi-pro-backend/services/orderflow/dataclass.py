from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional, Tuple, Dict, Set, Any
from enum import Enum

class TimeFrame(Enum):
    S30 = ("S30", "30 Seconds", 30)
    S45 = ("S45", "45 Seconds", 45)
    M1 = ("M1", "1 Minute", 60)
    M5 = ("M5", "5 Minutes", 300)
    M15 = ("M15", "15 Minutes", 900)
    M30 = ("M30", "30 Minutes", 1800)
    H1 = ("H1", "1 Hour", 3600)
    H4 = ("H4", "4 Hours", 14400)
    D1 = ("D", "1 Day", 86400)

    def __init__(self, oanda_code: str, display_name: str, seconds: int):
        self.oanda_code = oanda_code
        self.display_name = display_name
        self.seconds = seconds

class AlertType(Enum):
    HIGH_VOLATILITY = "🔥 HIGH VOLATILITY"
    LIQUIDITY_SWEEP = "💧 LIQUIDITY SWEEP"
    SESSION_OPEN = "🌅 SESSION OPEN"
    SESSION_CLOSE = "🌆 SESSION CLOSE"
    INSTITUTIONAL_ACTIVITY = "🏦 INSTITUTIONAL ACTIVITY"
    VOLUME_SPIKE = "📊 VOLUME SPIKE"
    DELTA_DIVERGENCE = "🔄 DELTA DIVERGENCE"
    ABSORPTION_DETECTED = "🛡️ ABSORPTION DETECTED"
    BREAKOUT_POTENTIAL = "🚀 BREAKOUT POTENTIAL"
    REVERSAL_SIGNAL = "↩️ REVERSAL SIGNAL"
    ORDER_BOOK_IMBALANCE = "📖 ORDER BOOK IMBALANCE"
    STOP_HUNT = "🎯 STOP HUNT DETECTED"

class Session(Enum):
    SYDNEY = ("Sydney", 21, 6, "🇦🇺")
    TOKYO = ("Tokyo", 0, 9, "🇯🇵")
    LONDON = ("London", 7, 16, "🇬🇧")
    NEW_YORK = ("New York", 12, 21, "🇺🇸")

    def __init__(self, name: str, start_hour: int, end_hour: int, flag: str):
        self.session_name = name
        self.start_hour = start_hour
        self.end_hour = end_hour
        self.flag = flag

@dataclass
class Candle:
    time: str
    open: float
    high: float
    low: float
    close: float
    volume: float
    range: float
    body: float
    body_abs: float
    buy_vol: float
    sell_vol: float
    delta: float
    complete: bool

    @property
    def is_bullish(self) -> bool:
        return self.close > self.open

    @property
    def is_bearish(self) -> bool:
        return self.close < self.open

@dataclass
class OrderFlowData:
    buy_vol: float
    sell_vol: float
    total_vol: float
    cvd: float
    delta: float
    buy_pct: float
    sell_pct: float
    imbalance: float
    price: float
    vwap: float
    delta_momentum: float
    vol_trend: float
    candles: List[Candle]

@dataclass
class VolumeProfile:
    poc: float
    vah: float
    val: float
    hvn: List[float]
    lvn: List[float]
    total_vol: float
    levels: List[Dict]

@dataclass
class AbsorptionData:
    bullish: bool
    bearish: bool
    score: int
    detail: str
    rate: float

@dataclass
class DivergenceData:
    bullish_div: bool
    bearish_div: bool
    detail: str
    price_trend: str
    delta_trend: str

@dataclass
class MomentumData:
    strength: int
    trend: str
    bull_streak: int
    bear_streak: int
    vol_accel: float
    delta_accel: float
    price_chg: float

@dataclass
class TradingBias:
    direction: str
    confidence: int
    bull_score: int
    bear_score: int
    factors: List[Tuple[str, str, int]]
    emoji: str
    action: str
    strength: str
    grade: str

@dataclass
class TradeSignal:
    type: str
    price: float
    sl: float
    tp1: float
    tp2: float
    tp3: float
    sl_pips: float
    confidence: int
    strength: str
    validation: Dict

@dataclass
class Alert:
    alert_type: AlertType
    pair: str
    title: str
    message: str
    details: Dict
    timestamp: datetime
    severity: int

    def __hash__(self):
        return hash((self.alert_type, self.pair, self.timestamp.strftime("%Y%m%d%H%M")))

@dataclass
class UserState:
    selected_pairs: Set[str] = field(default_factory=set)
    selected_timeframe: Optional[TimeFrame] = None
    mode: str = "short"
    subscriptions: Set[str] = field(default_factory=set)
    last_activity: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    alert_history: List[str] = field(default_factory=list)