/**
 * Crypto Futures Scanner Prototype - Top 5 Cryptos
 * GitHub Pages Compatible - Lightweight Charts Integration
 */

// Top 5 Futures Assets
const TOP_5_CRYPTOS = [
    { symbol: 'BTCUSDT', name: 'Bitcoin Futures', icon: '₿' },
    { symbol: 'ETHUSDT', name: 'Ethereum Futures', icon: 'Ξ' },
    { symbol: 'SOLUSDT', name: 'Solana Futures', icon: '◎' },
    { symbol: 'BNBUSDT', name: 'BNB Futures', icon: '◈' },
    { symbol: 'XRPUSDT', name: 'XRP Futures', icon: '✕' }
];

// App State
const state = {
    activeSymbol: 'BTCUSDT',
    activeTimeframe: '1h',
    tickers: {},
    chart: null,
    candleSeries: null,
    volumeSeries: null,
    isLoading: false,
    dataSource: 'Shark / Public Stream'
};

// DOM Element Selectors
const elements = {
    cryptoList: document.getElementById('cryptoList'),
    activeSymbol: document.getElementById('activeSymbol'),
    currentPrice: document.getElementById('currentPrice'),
    priceChange: document.getElementById('priceChange'),
    ohlcOpen: document.getElementById('ohlcOpen'),
    ohlcHigh: document.getElementById('ohlcHigh'),
    ohlcLow: document.getElementById('ohlcLow'),
    ohlcClose: document.getElementById('ohlcClose'),
    chartContainer: document.getElementById('chartContainer'),
    chartLoader: document.getElementById('chartLoader'),
    timeframeSelector: document.getElementById('timeframeSelector'),
    dataSourceName: document.getElementById('dataSourceName'),
    val24hHigh: document.getElementById('val24hHigh'),
    val24hLow: document.getElementById('val24hLow'),
    val24hVolume: document.getElementById('val24hVolume'),
    valLastUpdated: document.getElementById('valLastUpdated')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initChart();
    renderCryptoSidebar();
    bindEvents();
    fetchMarketOverview();
    loadCandleData(state.activeSymbol, state.activeTimeframe);

    // Auto refresh market overview ticker every 5 seconds
    setInterval(fetchMarketOverview, 5000);
});

/* ==========================================================================
   Chart Initialization & Configuration
   ========================================================================== */
function initChart() {
    if (!window.LightweightCharts) {
        console.error('TradingView Lightweight Charts library failed to load.');
        return;
    }

    // Chart Configuration
    const chartOptions = {
        layout: {
            background: { type: 'solid', color: '#0b0e14' },
            textColor: '#8a99ad',
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace"
        },
        grid: {
            vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
            horzLines: { color: 'rgba(255, 255, 255, 0.04)' }
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
            vertLine: {
                color: 'rgba(0, 230, 118, 0.4)',
                width: 1,
                style: 3,
                labelBackgroundColor: '#1c2333'
            },
            horzLine: {
                color: 'rgba(0, 230, 118, 0.4)',
                width: 1,
                style: 3,
                labelBackgroundColor: '#1c2333'
            }
        },
        rightPriceScale: {
            borderColor: 'rgba(255, 255, 255, 0.08)',
            scaleMargins: {
                top: 0.1,
                bottom: 0.25
            }
        },
        timeScale: {
            borderColor: 'rgba(255, 255, 255, 0.08)',
            timeVisible: true,
            secondsVisible: false
        }
    };

    state.chart = LightweightCharts.createChart(elements.chartContainer, chartOptions);

    // Candlestick Series
    state.candleSeries = state.chart.addCandlestickSeries({
        upColor: '#00e676',
        downColor: '#ff5252',
        borderUpColor: '#00e676',
        borderDownColor: '#ff5252',
        wickUpColor: '#00e676',
        wickDownColor: '#ff5252'
    });

    // Volume Histogram Series
    state.volumeSeries = state.chart.addHistogramSeries({
        color: '#26a69a',
        priceFormat: { type: 'volume' },
        priceScaleId: '',
        scaleMargins: {
            top: 0.75,
            bottom: 0
        }
    });

    // Responsive Resize Observer
    const resizeObserver = new ResizeObserver(entries => {
        if (entries[0] && entries[0].contentRect) {
            const { width, height } = entries[0].contentRect;
            state.chart.applyOptions({ width, height });
        }
    });
    resizeObserver.observe(elements.chartContainer);

    // Crosshair movement listener to update OHLC header in real-time
    state.chart.subscribeCrosshairMove(param => {
        if (!param || !param.time || !param.seriesPrices) return;
        const data = param.seriesPrices.get(state.candleSeries);
        if (data) {
            updateOHLCDisplay(data.open, data.high, data.low, data.close);
        }
    });
}

/* ==========================================================================
   Crypto List & Sidebar Rendering
   ========================================================================== */
function renderCryptoSidebar() {
    elements.cryptoList.innerHTML = '';

    TOP_5_CRYPTOS.forEach(crypto => {
        const ticker = state.tickers[crypto.symbol] || {
            lastPrice: '--.--',
            change24h: 0
        };

        const isSelected = crypto.symbol === state.activeSymbol;
        const changeClass = ticker.change24h > 0 ? 'positive' : ticker.change24h < 0 ? 'negative' : 'neutral';
        const changeSign = ticker.change24h > 0 ? '+' : '';

        const card = document.createElement('div');
        card.className = `crypto-card ${isSelected ? 'active' : ''}`;
        card.dataset.symbol = crypto.symbol;

        card.innerHTML = `
            <div class="crypto-info">
                <div class="crypto-symbol">${crypto.symbol}</div>
                <div class="crypto-name">${crypto.name}</div>
            </div>
            <div class="crypto-metrics">
                <div class="crypto-price" id="card-price-${crypto.symbol}">${formatPrice(ticker.lastPrice)}</div>
                <div class="badge-change ${changeClass}" id="card-change-${crypto.symbol}">
                    ${changeSign}${ticker.change24h.toFixed(2)}%
                </div>
            </div>
        `;

        card.addEventListener('click', () => {
            if (state.activeSymbol !== crypto.symbol) {
                switchActiveCrypto(crypto.symbol);
            }
        });

        elements.cryptoList.appendChild(card);
    });
}

/* ==========================================================================
   Event Bindings
   ========================================================================== */
function bindEvents() {
    // Timeframe selector clicks
    elements.timeframeSelector.querySelectorAll('.tf-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tf = e.target.dataset.tf;
            if (tf && state.activeTimeframe !== tf) {
                elements.timeframeSelector.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                state.activeTimeframe = tf;
                loadCandleData(state.activeSymbol, state.activeTimeframe);
            }
        });
    });
}

function switchActiveCrypto(symbol) {
    state.activeSymbol = symbol;
    elements.activeSymbol.textContent = symbol;

    // Highlight active card
    document.querySelectorAll('.crypto-card').forEach(card => {
        if (card.dataset.symbol === symbol) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    });

    // Update active ticker header metrics if available
    const ticker = state.tickers[symbol];
    if (ticker) {
        updateActiveHeader(ticker);
    }

    // Load candle chart
    loadCandleData(symbol, state.activeTimeframe);
}

/* ==========================================================================
   Data Fetching & CORS Fallback Logic
   ========================================================================== */

/**
 * Fetch Market Tickers for Top 5 Cryptos
 */
async function fetchMarketOverview() {
    try {
        // Attempt fetch with fallback mechanisms for CORS safety on GitHub Pages
        const tickersData = await getTickersWithFallback();
        
        tickersData.forEach(t => {
            state.tickers[t.symbol] = t;

            // Update sidebar elements live
            const priceEl = document.getElementById(`card-price-${t.symbol}`);
            const changeEl = document.getElementById(`card-change-${t.symbol}`);

            if (priceEl) priceEl.textContent = formatPrice(t.lastPrice);
            if (changeEl) {
                const changeClass = t.change24h > 0 ? 'positive' : t.change24h < 0 ? 'negative' : 'neutral';
                const changeSign = t.change24h > 0 ? '+' : '';
                changeEl.className = `badge-change ${changeClass}`;
                changeEl.textContent = `${changeSign}${t.change24h.toFixed(2)}%`;
            }
        });

        // Update active header metrics
        const activeTicker = state.tickers[state.activeSymbol];
        if (activeTicker) {
            updateActiveHeader(activeTicker);
        }

        elements.valLastUpdated.textContent = new Date().toLocaleTimeString();
    } catch (err) {
        console.warn('Ticker fetch notification:', err);
    }
}

/**
 * Fetch Historical Candle (Kline) Data
 */
async function loadCandleData(symbol, timeframe) {
    showChartLoader(true);

    try {
        const candles = await getCandlesWithFallback(symbol, timeframe);

        if (candles && candles.length > 0) {
            // Format for TradingView Lightweight Charts
            const candleFormatted = candles.map(c => ({
                time: c.time, // Unix timestamp in seconds
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close
            }));

            const volumeFormatted = candles.map(c => ({
                time: c.time,
                value: c.volume,
                color: c.close >= c.open ? 'rgba(0, 230, 118, 0.4)' : 'rgba(255, 82, 82, 0.4)'
            }));

            state.candleSeries.setData(candleFormatted);
            state.volumeSeries.setData(volumeFormatted);
            state.chart.timeScale().fitContent();

            // Set OHLC summary to latest candle
            const lastCandle = candleFormatted[candleFormatted.length - 1];
            updateOHLCDisplay(lastCandle.open, lastCandle.high, lastCandle.low, lastCandle.close);
        }
    } catch (err) {
        console.error('Failed to load candle data:', err);
    } finally {
        showChartLoader(false);
    }
}

/* ==========================================================================
   Fallback Endpoint Providers (CORS Resilient)
   ========================================================================== */

async function getTickersWithFallback() {
    // Primary: Shark Exchange public ticker endpoint (or fallback)
    try {
        const res = await fetch('https://api.sharkexchange.in/v1/market/ticker24Hr');
        if (res.ok) {
            const data = await res.json();
            state.dataSource = 'Shark Futures API';
            elements.dataSourceName.textContent = state.dataSource;
            return parseTickersResponse(data);
        }
    } catch (e) {
        // Fallback for client-side GitHub Pages execution
    }

    // Direct Browser Fallback: Binance Public Futures API
    try {
        const symbolsQuery = JSON.stringify(TOP_5_CRYPTOS.map(c => c.symbol));
        const res = await fetch(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbols=${encodeURIComponent(symbolsQuery)}`);
        if (res.ok) {
            const data = await res.json();
            state.dataSource = 'Futures Public Stream (CORS Direct)';
            elements.dataSourceName.textContent = state.dataSource;
            return data.map(item => ({
                symbol: item.symbol,
                lastPrice: parseFloat(item.lastPrice),
                change24h: parseFloat(item.priceChangePercent),
                high24h: parseFloat(item.highPrice),
                low24h: parseFloat(item.lowPrice),
                volume24h: parseFloat(item.quoteVolume)
            }));
        }
    } catch (e) {
        console.warn('Fallback ticker fetch failed:', e);
    }

    // Mock data generator for offline testing or fail-safe fallback
    return generateMockTickers();
}

async function getCandlesWithFallback(symbol, timeframe) {
    // Interval mapping
    const intervalMap = { '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d' };
    const interval = intervalMap[timeframe] || '1h';

    // Primary Attempt: Shark Exchange Klines Endpoint
    try {
        const res = await fetch(`https://api.sharkexchange.in/v1/market/klines?symbol=${symbol}&interval=${interval}&limit=200`);
        if (res.ok) {
            const data = await res.json();
            return parseKlinesResponse(data);
        }
    } catch (e) {
        // Fallback to CORS-enabled public futures data stream
    }

    // Fallback: Binance Futures Public Klines Endpoint
    try {
        const res = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=200`);
        if (res.ok) {
            const data = await res.json();
            return data.map(item => ({
                time: Math.floor(item[0] / 1000), // convert ms to seconds
                open: parseFloat(item[1]),
                high: parseFloat(item[2]),
                low: parseFloat(item[3]),
                close: parseFloat(item[4]),
                volume: parseFloat(item[5])
            }));
        }
    } catch (e) {
        console.warn('Kline fallback fetch failed:', e);
    }

    // Generate fallback mock candles if offline
    return generateMockCandles(symbol, interval);
}

/* ==========================================================================
   Helper Functions & UI Formatters
   ========================================================================== */

function parseTickersResponse(data) {
    if (!Array.isArray(data)) return generateMockTickers();
    return data
        .filter(item => TOP_5_CRYPTOS.some(c => c.symbol === item.symbol))
        .map(item => ({
            symbol: item.symbol,
            lastPrice: parseFloat(item.lastPrice || item.price || 0),
            change24h: parseFloat(item.priceChangePercent || item.change || 0),
            high24h: parseFloat(item.highPrice || 0),
            low24h: parseFloat(item.lowPrice || 0),
            volume24h: parseFloat(item.quoteVolume || item.volume || 0)
        }));
}

function parseKlinesResponse(data) {
    if (!Array.isArray(data)) return [];
    return data.map(item => ({
        time: Math.floor((item.time || item[0]) / 1000),
        open: parseFloat(item.open || item[1]),
        high: parseFloat(item.high || item[2]),
        low: parseFloat(item.low || item[3]),
        close: parseFloat(item.close || item[4]),
        volume: parseFloat(item.volume || item[5])
    }));
}

function updateActiveHeader(ticker) {
    elements.currentPrice.textContent = formatPrice(ticker.lastPrice);
    
    const changeClass = ticker.change24h > 0 ? 'positive' : ticker.change24h < 0 ? 'negative' : 'neutral';
    const changeSign = ticker.change24h > 0 ? '+' : '';
    elements.priceChange.className = `price-change-badge ${changeClass}`;
    elements.priceChange.textContent = `${changeSign}${ticker.change24h.toFixed(2)}%`;

    if (ticker.high24h) elements.val24hHigh.textContent = formatPrice(ticker.high24h);
    if (ticker.low24h) elements.val24hLow.textContent = formatPrice(ticker.low24h);
    if (ticker.volume24h) elements.val24hVolume.textContent = '$' + formatCompactNumber(ticker.volume24h);
}

function updateOHLCDisplay(o, h, l, c) {
    elements.ohlcOpen.textContent = formatPrice(o);
    elements.ohlcHigh.textContent = formatPrice(h);
    elements.ohlcLow.textContent = formatPrice(l);
    elements.ohlcClose.textContent = formatPrice(c);
}

function formatPrice(price) {
    if (price === undefined || price === null || isNaN(price)) return '--.--';
    const num = parseFloat(price);
    if (num >= 1000) return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (num >= 1) return num.toFixed(2);
    return num.toFixed(4);
}

function formatCompactNumber(num) {
    if (!num) return '0';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
}

function showChartLoader(show) {
    if (show) {
        elements.chartLoader.classList.remove('hidden');
    } else {
        elements.chartLoader.classList.add('hidden');
    }
}

/* Fallback Mock Data Generators */
function generateMockTickers() {
    return [
        { symbol: 'BTCUSDT', lastPrice: 89450.50, change24h: 2.34, high24h: 90200, low24h: 87500, volume24h: 18500000000 },
        { symbol: 'ETHUSDT', lastPrice: 3420.75, change24h: -1.12, high24h: 3510, low24h: 3380, volume24h: 8400000000 },
        { symbol: 'SOLUSDT', lastPrice: 198.40, change24h: 5.67, high24h: 204, low24h: 185, volume24h: 4200000000 },
        { symbol: 'BNBUSDT', lastPrice: 615.20, change24h: 0.85, high24h: 622, low24h: 605, volume24h: 1100000000 },
        { symbol: 'XRPUSDT', lastPrice: 1.45, change24h: -3.20, high24h: 1.54, low24h: 1.41, volume24h: 2900000000 }
    ];
}

function generateMockCandles(symbol, interval) {
    const basePriceMap = { BTCUSDT: 89000, ETHUSDT: 3400, SOLUSDT: 195, BNBUSDT: 610, XRPUSDT: 1.42 };
    let currentPrice = basePriceMap[symbol] || 100;

    const candles = [];
    const now = Math.floor(Date.now() / 1000);
    const stepSeconds = interval === '15m' ? 900 : interval === '1h' ? 3600 : interval === '4h' ? 14400 : 86400;

    for (let i = 150; i >= 0; i--) {
        const time = now - (i * stepSeconds);
        const changePct = (Math.random() - 0.49) * 0.02;
        const open = currentPrice;
        const close = open * (1 + changePct);
        const high = Math.max(open, close) * (1 + Math.random() * 0.005);
        const low = Math.min(open, close) * (1 - Math.random() * 0.005);
        const volume = Math.random() * 500 + 100;

        candles.push({ time, open, high, low, close, volume });
        currentPrice = close;
    }

    return candles;
}
