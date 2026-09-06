import requests
import pandas as pd
import numpy as np
from typing import List, Dict, Any

TOP_15_SYMBOLS = [
    "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT",
    "DOGEUSDT", "ADAUSDT", "AVAXUSDT", "LINKUSDT", "DOTUSDT",
    "NEARUSDT", "SUIUSDT", "PEPEUSDT", "POLUSDT", "LTCUSDT"
]

def fetch_binance_klines(symbol: str, interval: str, limit: int = 500) -> List[Dict[str, Any]]:
    """Fetch futures candlestick data from Binance API."""
    url = f"https://fapi.binance.com/fapi/v1/klines?symbol={symbol}&interval={interval}&limit={limit}"
    try:
        res = requests.get(url, timeout=10)
        if res.status_code == 200:
            data = res.json()
            candles = []
            for item in data:
                candles.append({
                    "time": int(item[0] // 1000),
                    "open": float(item[1]),
                    "high": float(item[2]),
                    "low": float(item[3]),
                    "close": float(item[4]),
                    "volume": float(item[5])
                })
            return candles
    except Exception as e:
        print(f"Error fetching klines for {symbol} {interval}: {e}")
    return []

def calculate_ema(closes: List[float], period: int = 200) -> List[float]:
    """Calculate Exponential Moving Average (EMA)."""
    if len(closes) < period:
        return [None] * len(closes)
    
    df = pd.DataFrame({"close": closes})
    ema_series = df["close"].ewm(span=period, adjust=False).mean()
    return ema_series.tolist()

def detect_fvgs(candles: List[Dict[str, Any]], ema_200: List[float], timeframe: str) -> List[Dict[str, Any]]:
    """
    Detects 3-candle Fair Value Gaps (FVG) and checks 200 EMA alignment & mitigation state.
    Rule: FVG is confirmed ONLY after 3rd candle closes.
    """
    if len(candles) < 4:
        return []

    fvgs = []
    num_candles = len(candles)

    # We iterate up to num_candles - 1 (since last candle at index num_candles-1 is live/unclosed)
    for i in range(2, num_candles - 1):
        c1 = candles[i - 2]
        c2 = candles[i - 1]
        c3 = candles[i]
        
        c3_ema = ema_200[i]
        if c3_ema is None:
            continue

        c3_close = c3["close"]

        # Bullish FVG: Candle 1 High < Candle 3 Low
        if c1["high"] < c3["low"]:
            fvg_bottom = c1["high"]
            fvg_top = c3["low"]
            
            # Check 200 EMA Filter: Price above 200 EMA
            ema_aligned = c3_close > c3_ema
            
            # Check mitigation state by subsequent closed candles
            mitigated = False
            mitigated_time = None
            for j in range(i + 1, num_candles):
                if candles[j]["low"] <= fvg_top:
                    mitigated = True
                    mitigated_time = candles[j]["time"]
                    break

            fvgs.append({
                "id": f"bullish_{c3['time']}",
                "type": "bullish",
                "timeframe": timeframe,
                "time": c3["time"],
                "startTime": c1["time"],
                "top": fvg_top,
                "bottom": fvg_bottom,
                "ema200": c3_ema,
                "emaAligned": ema_aligned,
                "mitigated": mitigated,
                "mitigatedTime": mitigated_time
            })

        # Bearish FVG: Candle 1 Low > Candle 3 High
        elif c1["low"] > c3["high"]:
            fvg_top = c1["low"]
            fvg_bottom = c3["high"]
            
            # Check 200 EMA Filter: Price below 200 EMA
            ema_aligned = c3_close < c3_ema
            
            # Check mitigation state
            mitigated = False
            mitigated_time = None
            for j in range(i + 1, num_candles):
                if candles[j]["high"] >= fvg_bottom:
                    mitigated = True
                    mitigated_time = candles[j]["time"]
                    break

            fvgs.append({
                "id": f"bearish_{c3['time']}",
                "type": "bearish",
                "timeframe": timeframe,
                "time": c3["time"],
                "startTime": c1["time"],
                "top": fvg_top,
                "bottom": fvg_bottom,
                "ema200": c3_ema,
                "emaAligned": ema_aligned,
                "mitigated": mitigated,
                "mitigatedTime": mitigated_time
            })

    return fvgs

def scan_symbol(symbol: str) -> Dict[str, Any]:
    """Scans a single symbol across 15m and 4h timeframes."""
    result = {
        "symbol": symbol,
        "signals": [],
        "active_fvgs_15m": [],
        "active_fvgs_4h": [],
        "lastPrice": 0.0,
        "ema200_15m": None,
        "ema200_4h": None
    }

    # 15m Scan
    candles_15m = fetch_binance_klines(symbol, "15m", 350)
    if candles_15m:
        closes_15m = [c["close"] for c in candles_15m]
        ema200_15m = calculate_ema(closes_15m, 200)
        fvgs_15m = detect_fvgs(candles_15m, ema200_15m, "15m")
        
        result["lastPrice"] = candles_15m[-1]["close"]
        result["ema200_15m"] = ema200_15m[-1]

        # Active unmitigated FVGs
        unmitigated_15m = [f for f in fvgs_15m if not f["mitigated"]]
        result["active_fvgs_15m"] = unmitigated_15m

        # Filtered signal (most recent unmitigated & EMA aligned FVG)
        aligned_15m = [f for f in unmitigated_15m if f["emaAligned"]]
        if aligned_15m:
            latest_signal = aligned_15m[-1]
            result["signals"].append({
                "timeframe": "15m",
                "type": latest_signal["type"],
                "fvg": latest_signal
            })

    # 4h Scan
    candles_4h = fetch_binance_klines(symbol, "4h", 350)
    if candles_4h:
        closes_4h = [c["close"] for c in candles_4h]
        ema200_4h = calculate_ema(closes_4h, 200)
        fvgs_4h = detect_fvgs(candles_4h, ema200_4h, "4h")
        result["ema200_4h"] = ema200_4h[-1]

        unmitigated_4h = [f for f in fvgs_4h if not f["mitigated"]]
        result["active_fvgs_4h"] = unmitigated_4h

        aligned_4h = [f for f in unmitigated_4h if f["emaAligned"]]
        if aligned_4h:
            latest_signal = aligned_4h[-1]
            result["signals"].append({
                "timeframe": "4h",
                "type": latest_signal["type"],
                "fvg": latest_signal
            })

    return result
