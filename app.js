/**
 * Crypto Futures Scanner Prototype - Top 5 Cryptos
 * GitHub Pages Compatible - Real-Time WebSocket & Lightweight Charts Engine
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
    ws: null,
    wsTicker: null,
    currentCandle: null,
    dataSource: 'Futures Real-time Feed'
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
    initAllTickersWebSocket();

    // Auto refresh tickers every 10 seconds as backup
    setInterval(fetchMarketOverview, 10000);
});

/* ==========================================================================
   Chart Initialization & Configuration (Isolated Volume & AutoScale)
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
            autoScale: true,
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

    // Candlestick Series on main price scale ('right')
    state.candleSeries = state.chart.addCandlestickSeries({
        upColor: '#00e676',
        downColor: '#ff5252',
        borderUpColor: '#00e676',
        borderDownColor: '#ff5252',
        wickUpColor: '#00e676',
        wickDownColor: '#ff5252'
    });

    // Volume Series on isolated 'volume' price scale to prevent scale overlap
    state.volumeSeries = state.chart.addHistogramSeries({
        priceScaleId: 'volume_scale',
        priceFormat: { type: 'volume' }
    });

    // Configure dedicated volume scale margins at the bottom
    state.chart.priceScale('volume_scale').applyOptions({
        scaleMargins: {
            top: 0.8,
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

    // Crosshair movement listener to update OHLC header
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
   Event Bindings & Switching
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

    // Load candle chart for new symbol
    loadCandleData(symbol, state.activeTimeframe);
}

/* ==========================================================================
   Data Fetching & WebSocket Real-Time Stream Engine
   ========================================================================== */

/**
 * Fetch Market Tickers overview
 */
async function fetchMarketOverview() {
    try {
        const symbolsQuery = JSON.stringify(TOP_5_CRYPTOS.map(c => c.symbol));
        const res = await fetch(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbols=${encodeURIComponent(symbolsQuery)}`);
        
        if (res.ok) {
            const data = await res.json();
            data.forEach(item => {
                const tickerData = {
                    symbol: item.symbol,
                    lastPrice: parseFloat(item.lastPrice),
                    change24h: parseFloat(item.priceChangePercent),
                    high24h: parseFloat(item.highPrice),
                    low24h: parseFloat(item.lowPrice),
                    volume24h: parseFloat(item.quoteVolume)
                };
                state.tickers[item.symbol] = tickerData;
                updateSidebarCard(tickerData);
            });

            const activeTicker = state.tickers[state.activeSymbol];
            if (activeTicker) {
                updateActiveHeader(activeTicker);
            }

            elements.valLastUpdated.textContent = new Date().toLocaleTimeString();
        }
    } catch (err) {
        console.warn('Ticker update note:', err);
    }
}

/**
 * Load Historical Candlestick Data & Connect Real-Time Stream
 */
async function loadCandleData(symbol, timeframe) {
    showChartLoader(true);

    // Disconnect existing chart websocket stream
    if (state.ws) {
        state.ws.close();
        state.ws = null;
    }

    try {
        const candles = await fetchKlines(symbol, timeframe);

        if (candles && candles.length > 0) {
            // Reset series and apply autoScale
            state.candleSeries.setData([]);
            state.volumeSeries.setData([]);

            const candleFormatted = candles.map(c => ({
                time: c.time,
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

            // Re-scale right axis for exact price range of selected crypto
            state.chart.priceScale('right').applyOptions({ autoScale: true });
            state.chart.timeScale().fitContent();

            // Set OHLC summary to latest candle
            const lastCandle = candleFormatted[candleFormatted.length - 1];
            state.currentCandle = lastCandle;
            updateOHLCDisplay(lastCandle.open, lastCandle.high, lastCandle.low, lastCandle.close);

            // Connect Live WebSocket Stream for active symbol & timeframe!
            connectLiveStream(symbol, timeframe);
        }
    } catch (err) {
        console.error('Failed to load candle data:', err);
    } finally {
        showChartLoader(false);
    }
}

/**
 * Fetch Klines from CORS-enabled endpoint
 */
async function fetchKlines(symbol, timeframe) {
    const intervalMap = { '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d' };
    const interval = intervalMap[timeframe] || '1h';

    const res = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=300`);
    if (res.ok) {
        const data = await res.json();
        return data.map(item => ({
            time: Math.floor(item[0] / 1000),
            open: parseFloat(item[1]),
            high: parseFloat(item[2]),
            low: parseFloat(item[3]),
            close: parseFloat(item[4]),
            volume: parseFloat(item[5])
        }));
    }
    return [];
}

/**
 * Real-Time WebSocket Streaming Engine for Live Candle Updates
 */
function connectLiveStream(symbol, timeframe) {
    const intervalMap = { '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d' };
    const interval = intervalMap[timeframe] || '1h';
    const streamName = `${symbol.toLowerCase()}@kline_${interval}`;

    const wsUrl = `wss://fstream.binance.com/ws/${streamName}`;

    try {
        state.ws = new WebSocket(wsUrl);

        state.ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg && msg.e === 'kline') {
                const k = msg.k;
                const candleTime = Math.floor(k.t / 1000);
                const open = parseFloat(k.o);
                const high = parseFloat(k.h);
                const low = parseFloat(k.l);
                const close = parseFloat(k.c);
                const volume = parseFloat(k.v);

                // Live Update Candlestick Chart in Real-Time!
                const liveCandle = { time: candleTime, open, high, low, close };
                state.candleSeries.update(liveCandle);

                // Live Update Volume Series
                const volumeColor = close >= open ? 'rgba(0, 230, 118, 0.4)' : 'rgba(255, 82, 82, 0.4)';
                state.volumeSeries.update({ time: candleTime, value: volume, color: volumeColor });

                // Update Header Live Price & OHLC
                elements.currentPrice.textContent = formatPrice(close);
                updateOHLCDisplay(open, high, low, close);

                // Update Sidebar Price Card live
                if (state.tickers[symbol]) {
                    state.tickers[symbol].lastPrice = close;
                    updateSidebarCard(state.tickers[symbol]);
                }

                elements.valLastUpdated.textContent = new Date().toLocaleTimeString() + ' (Live)';
            }
        };

        state.ws.onerror = (err) => {
            console.warn('WebSocket stream notice:', err);
        };
    } catch (e) {
        console.warn('WebSocket connection error:', e);
    }
}

/**
 * WebSocket Stream for All Top 5 Tickers
 */
function initAllTickersWebSocket() {
    const streams = TOP_5_CRYPTOS.map(c => `${c.symbol.toLowerCase()}@ticker`).join('/');
    const wsUrl = `wss://fstream.binance.com/stream?streams=${streams}`;

    try {
        state.wsTicker = new WebSocket(wsUrl);

        state.wsTicker.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg && msg.data && msg.data.e === '24hrTicker') {
                const item = msg.data;
                const tickerData = {
                    symbol: item.s,
                    lastPrice: parseFloat(item.c),
                    change24h: parseFloat(item.P),
                    high24h: parseFloat(item.h),
                    low24h: parseFloat(item.l),
                    volume24h: parseFloat(item.q)
                };

                state.tickers[item.s] = tickerData;
                updateSidebarCard(tickerData);

                if (item.s === state.activeSymbol) {
                    updateActiveHeader(tickerData);
                }
            }
        };
    } catch (e) {
        console.warn('Ticker stream error:', e);
    }
}

/* ==========================================================================
   UI Formatters & Helpers
   ========================================================================== */

function updateSidebarCard(ticker) {
    const priceEl = document.getElementById(`card-price-${ticker.symbol}`);
    const changeEl = document.getElementById(`card-change-${ticker.symbol}`);

    if (priceEl) priceEl.textContent = formatPrice(ticker.lastPrice);
    if (changeEl) {
        const changeClass = ticker.change24h > 0 ? 'positive' : ticker.change24h < 0 ? 'negative' : 'neutral';
        const changeSign = ticker.change24h > 0 ? '+' : '';
        changeEl.className = `badge-change ${changeClass}`;
        changeEl.textContent = `${changeSign}${ticker.change24h.toFixed(2)}%`;
    }
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
