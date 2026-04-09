# services/orderflow/utils.py
from typing import Any, List, Optional
from datetime import datetime, timezone

def safe_div(numerator: float, denominator: float, default: float = 0.0) -> float:
    if denominator == 0 or denominator is None:
        return default
    return numerator / denominator

def safe_get(lst: List, index: int, default: Any = None) -> Any:
    try:
        return lst[index] if -len(lst) <= index < len(lst) else default
    except (IndexError, TypeError):
        return default

def format_number(v: float, signed: bool = True) -> str:
    if abs(v) >= 1e6:
        return f"{v/1e6:+.2f}M" if signed else f"{v/1e6:.2f}M"
    if abs(v) >= 1e3:
        return f"{v/1e3:+.1f}K" if signed else f"{v/1e3:.1f}K"
    return f"{v:+.0f}" if signed else f"{v:.0f}"

def format_price(v: float, inst: str) -> str:
    return f"{v:.3f}" if "JPY" in inst else f"{v:.5f}"

def pip_value(inst: str) -> float:
    return 0.01 if "JPY" in inst else 0.0001

def to_pips(inst: str, diff: float) -> float:
    return abs(diff) / pip_value(inst)

def progress_bar(pct: float, length: int = 10) -> str:
    pct = max(0, min(pct, 100))
    filled = int(pct / 100 * length)
    return "█" * filled + "░" * (length - filled)

def grade_confidence(conf: int) -> str:
    if conf >= 90: return "A+"
    if conf >= 80: return "A"
    if conf >= 70: return "B+"
    if conf >= 60: return "B"
    if conf >= 50: return "C"
    return "F"

def escape_html(text: str) -> str:
    return (str(text)
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;"))

def pair_name(inst: str) -> str:
    return inst.replace("_", "/")