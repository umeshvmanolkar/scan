import asyncio
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import scanner

app = FastAPI(title="Crypto Futures FVG & 200 EMA Scanner API", version="1.0.0")

# Enable CORS for GitHub Pages frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache scanner results in memory
scanner_cache = {
    "data": [],
    "last_updated": 0
}

@app.get("/api/health")
def health_check():
    """Health check endpoint for Render.com"""
    return {"status": "ok", "service": "Crypto Futures Scanner Backend"}

@app.get("/api/scanner")
def get_scanner_results():
    """Returns Top 15 crypto futures scan results with active FVG & 200 EMA signals."""
    results = []
    for symbol in scanner.TOP_15_SYMBOLS:
        try:
            res = scanner.scan_symbol(symbol)
            results.append(res)
        except Exception as e:
            print(f"Error scanning {symbol}: {e}")
            results.append({
                "symbol": symbol,
                "signals": [],
                "active_fvgs_15m": [],
                "active_fvgs_4h": [],
                "lastPrice": 0.0,
                "ema200_15m": None,
                "ema200_4h": None
            })
    return {"symbols": results}

@app.get("/api/candles")
def get_candles_data(symbol: str = Query("BTCUSDT"), timeframe: str = Query("15m")):
    """Returns candlestick data, 200 EMA array, and active FVGs for a symbol and timeframe."""
    candles = scanner.fetch_binance_klines(symbol, timeframe, limit=400)
    if not candles:
        return {"candles": [], "ema200": [], "fvgs": []}
    
    closes = [c["close"] for c in candles]
    ema200 = scanner.calculate_ema(closes, 200)
    fvgs = scanner.detect_fvgs(candles, ema200, timeframe)
    
    # Filter unmitigated FVGs
    active_fvgs = [f for f in fvgs if not f["mitigated"]]

    return {
        "symbol": symbol,
        "timeframe": timeframe,
        "candles": candles,
        "ema200": ema200,
        "fvgs": active_fvgs,
        "all_fvgs": fvgs
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
