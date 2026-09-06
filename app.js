/**
 * Crypto Futures Scanner - Top 15 Cryptos
 * FVG (15m & 4h) + 200 EMA Filter Engine
 * TradingView Lightweight Charts Integration & Keyboard Timeframe Shortcuts
 */

const TOP_15_CRYPTOS = [
    { symbol: 'BTCUSDT', name: 'Bitcoin Futures' },
    { symbol: 'ETHUSDT', name: 'Ethereum Futures' },
    { symbol: 'SOLUSDT', name: 'Solana Futures' },
    { symbol: 'BNBUSDT', name: 'BNB Futures' },
    { symbol: 'XRPUSDT', name: 'XRP Futures' },
    { symbol: 'DOGEUSDT', name: 'Dogecoin Futures' },
    { symbol: 'ADAUSDT', name: 'Cardano Futures' },
    { symbol: 'AVAXUSDT', name: 'Avalanche Futures' },
    { symbol: 'LINKUSDT', name: 'Chainlink Futures' },
    { symbol: 'DOTUSDT', name: 'Polkadot Futures' },
    { symbol: 'NEARUSDT', name: 'NEAR Protocol Futures' },
    { symbol: 'SUIUSDT', name: 'Sui Futures' },
    { symbol: 'PEPEUSDT', name: 'Pepe Futures' },
    { symbol: 'POLUSDT', name: 'Polygon Futures' },
    { symbol: 'LTCUSDT', name: 'Litecoin Futures' }
];

// App State
const state = {
    activeSymbol: 'BTCUSDT',
    activeTimeframe: '15m',
    activeFilter: 'all',
    tickers: {},
    signals: {},
    activeFvgs: {},
    chart: null,
    candleSeries: null,
    volumeSeries: null,
    ema200Series: null,
    priceLineTop: null,
    priceLineBottom: null,
    activePriceLines: [],
    typedShortcut: '',
    shortcutTimeout: null,
    backendUrl: 'https://crypto-futures-scanner-backend.onrender.com'
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
    ema200Val: document.getElementById('ema200Val'),
    signalBanner: document.getElementById('signalBanner'),
    bannerText: document.getElementById('bannerText'),
    chartContainer: document.getElementById('chartContainer'),
    chartLoader: document.getElementById('chartLoader'),
    timeframeSelector: document.getElementById('timeframeSelector'),
    filterTabs: document.getElementById('filterTabs'),
    val24hHigh: document.getElementById('val24hHigh'),
    val24hLow: document.getElementById('val24hLow'),
    valEma200: document.getElementById('valEma200'),
    valActiveFvgs: document.getElementById('valActiveFvgs'),
    shortcutHud: document.getElementById('shortcutHud'),
    hudValue: document.getElementById('hudValue')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initChart();
    renderCryptoSidebar();
    bindEvents();
    bindKeyboardShortcuts();
    fetchScannerData();
    loadCandleData(state.activeSymbol, state.activeTimeframe);

    // Auto-refresh scanner signals every 15 seconds
    setInterval(fetchScannerData, 15000);
});

/* ==========================================================================
   Chart Initialization & Configuration (200 EMA + FVG PriceLines)
   ========================================================================== */
function initChart() {
    if (!window.LightweightCharts) {
        console.error('TradingView Lightweight Charts library failed to load.');
        return;
    }

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
            vertLine: { color: 'rgba(0, 230, 118, 0.4)', width: 1, style: 3 },
            horzLine: { color: 'rgba(0, 230, 118, 0.4)', width: 1, style: 3 }
        },
        rightPriceScale: {
            borderColor: 'rgba(255, 255, 255, 0.08)',
            autoScale: true,
            scaleMargins: { top: 0.1, bottom: 0.25 }
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

    // 200 EMA Line Series (Orange Line)
    state.ema200Series = state.chart.addLineSeries({
        color: '#ff9800',
        lineWidth: 2,
        title: 'EMA 200',
        priceLineVisible: false
    });

    // Volume Series
    state.volumeSeries = state.chart.addHistogramSeries({
        priceScaleId: 'volume_scale',
        priceFormat: { type: 'volume' }
    });

    state.chart.priceScale('volume_scale').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 }
    });

    // Responsive Resize Observer
    const resizeObserver = new ResizeObserver(entries => {
        if (entries[0] && entries[0].contentRect) {
            const { width, height } = entries[0].contentRect;
            state.chart.applyOptions({ width, height });
        }
    });
    resizeObserver.observe(elements.chartContainer);
}

/* ==========================================================================
   TradingView Style Keyboard Timeframe Shortcuts (e.g. 5 -> Enter, 15 -> Enter)
   ========================================================================== */
function bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
        // Ignore if user is typing in an input element
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

        const key = e.key;

        // Number keys or 'd' for 1D
        if (/^[0-9]$/.test(key) || key.toLowerCase() === 'd') {
            state.typedShortcut += key;
            showShortcutHud(state.typedShortcut);

            clearTimeout(state.shortcutTimeout);
            state.shortcutTimeout = setTimeout(() => {
                state.typedShortcut = '';
                hideShortcutHud();
            }, 3000);
        } else if (key === 'Enter' && state.typedShortcut.length > 0) {
            e.preventDefault();
            applyShortcutTimeframe(state.typedShortcut);
            state.typedShortcut = '';
            hideShortcutHud();
        } else if (key === 'Escape') {
            state.typedShortcut = '';
            hideShortcutHud();
        }
    });
}

function applyShortcutTimeframe(input) {
    const lower = input.toLowerCase();
    let tf = '15m';

    if (lower === '1') tf = '1m';
    else if (lower === '5') tf = '5m';
    else if (lower === '15') tf = '15m';
    else if (lower === '60' || lower === '1h') tf = '1h';
    else if (lower === '240' || lower === '4h') tf = '4h';
    else if (lower === 'd' || lower === '1d') tf = '1d';
    else tf = `${input}m`;

    switchTimeframe(tf);
}

function showShortcutHud(val) {
    elements.hudValue.textContent = val + '...';
    elements.shortcutHud.classList.remove('hidden');
}

function hideShortcutHud() {
    elements.shortcutHud.classList.add('hidden');
}

/* ==========================================================================
   Event Bindings & Sidebar Filters
   ========================================================================== */
function bindEvents() {
    // Timeframe button clicks
    elements.timeframeSelector.querySelectorAll('.tf-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tf = e.target.dataset.tf;
            if (tf) switchTimeframe(tf);
        });
    });

    // Filter tabs click
    elements.filterTabs.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            elements.filterTabs.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            state.activeFilter = e.target.dataset.filter;
            renderCryptoSidebar();
        });
    });
}

function switchTimeframe(tf) {
    state.activeTimeframe = tf;
    elements.timeframeSelector.querySelectorAll('.tf-btn').forEach(b => {
        if (b.dataset.tf === tf) b.classList.add('active');
        else b.classList.remove('active');
    });
    loadCandleData(state.activeSymbol, tf);
}

function switchActiveCrypto(symbol, autoTf = null) {
    state.activeSymbol = symbol;
    elements.activeSymbol.textContent = symbol;

    // Highlight active sidebar card
    renderCryptoSidebar();

    // Auto switch timeframe if signal specifies 15m or 4h
    const targetTf = autoTf || state.activeTimeframe;
    switchTimeframe(targetTf);
}

/* ==========================================================================
   Crypto List & Sidebar Rendering
   ========================================================================== */
function renderCryptoSidebar() {
    elements.cryptoList.innerHTML = '';

    TOP_15_CRYPTOS.forEach(crypto => {
        const ticker = state.tickers[crypto.symbol] || { lastPrice: 0, change24h: 0 };
        const signal = state.signals[crypto.symbol];

        // Apply filter tab rules
        if (state.activeFilter === 'signal' && !signal) return;
        if (state.activeFilter === 'bullish' && (!signal || signal.type !== 'bullish')) return;
        if (state.activeFilter === 'bearish' && (!signal || signal.type !== 'bearish')) return;

        const isSelected = crypto.symbol === state.activeSymbol;
        const changeClass = ticker.change24h > 0 ? 'positive' : ticker.change24h < 0 ? 'negative' : 'neutral';
        const changeSign = ticker.change24h > 0 ? '+' : '';

        const card = document.createElement('div');
        card.className = `crypto-card ${isSelected ? 'active' : ''}`;
        card.dataset.symbol = crypto.symbol;

        let signalBadgeHtml = '';
        if (signal) {
            const badgeClass = signal.type === 'bullish' ? 'bullish' : 'bearish';
            const icon = signal.type === 'bullish' ? '🟢' : '🔴';
            signalBadgeHtml = `<span class="signal-pill ${badgeClass}">${icon} ${signal.timeframe} FVG</span>`;
        }

        card.innerHTML = `
            <div class="crypto-info">
                <div class="symbol-row">
                    <span class="crypto-symbol">${crypto.symbol}</span>
                    ${signalBadgeHtml}
                </div>
                <div class="crypto-name">${crypto.name}</div>
            </div>
            <div class="crypto-metrics">
                <div class="crypto-price">${formatPrice(ticker.lastPrice)}</div>
                <div class="badge-change ${changeClass}">
                    ${changeSign}${ticker.change24h.toFixed(2)}%
                </div>
            </div>
        `;

        card.addEventListener('click', () => {
            // Auto open in signal's timeframe if present
            const autoTf = signal ? signal.timeframe : null;
            switchActiveCrypto(crypto.symbol, autoTf);
        });

        elements.cryptoList.appendChild(card);
    });
}

/* ==========================================================================
   Data Fetching & FVG Processing Engine
   ========================================================================== */

/**
 * Fetch Scanner signals for Top 15 coins
 */
async function fetchScannerData() {
    try {
        // Fetch 24h tickers first
        const symbolsQuery = JSON.stringify(TOP_15_CRYPTOS.map(c => c.symbol));
        const resTicker = await fetch(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbols=${encodeURIComponent(symbolsQuery)}`);
        if (resTicker.ok) {
            const data = await resTicker.json();
            data.forEach(t => {
                state.tickers[t.symbol] = {
                    symbol: t.symbol,
                    lastPrice: parseFloat(t.lastPrice),
                    change24h: parseFloat(t.priceChangePercent),
                    high24h: parseFloat(t.highPrice),
                    low24h: parseFloat(t.lowPrice)
                };
            });
        }

        // Attempt Render Backend for 15m & 4h FVG signals
        try {
            const resScanner = await fetch(`${state.backendUrl}/api/scanner`, { timeout: 4000 });
            if (resScanner.ok) {
                const scannerData = await resScanner.json();
                processBackendScanner(scannerData.symbols);
                return;
            }
        } catch (e) {
            // Client-side fallback computation if backend server is starting
        }

        // Direct Client-Side FVG Computation Fallback
        await computeClientSideScanner();

    } catch (err) {
        console.warn('Scanner overview notice:', err);
    } finally {
        renderCryptoSidebar();
    }
}

function processBackendScanner(symbolResults) {
    state.signals = {};
    state.activeFvgs = {};

    symbolResults.forEach(item => {
        state.activeFvgs[item.symbol] = [
            ...(item.active_fvgs_15m || []),
            ...(item.active_fvgs_4h || [])
        ];

        if (item.signals && item.signals.length > 0) {
            state.signals[item.symbol] = item.signals[0]; // Most significant signal
        }
    });

    updateBanner();
}

/**
 * Client-Side FVG & 200 EMA Scanner Fallback
 */
async function computeClientSideScanner() {
    for (const crypto of TOP_15_CRYPTOS) {
        try {
            const candles15m = await fetchKlines(crypto.symbol, '15m', 250);
            if (candles15m.length >= 200) {
                const closes = candles15m.map(c => c.close);
                const ema200 = calculateEMA(closes, 200);
                const fvgs = detectFVGs(candles15m, ema200, '15m');
                const active15m = fvgs.filter(f => !f.mitigated);
                const aligned15m = active15m.filter(f => f.emaAligned);

                if (!state.activeFvgs[crypto.symbol]) state.activeFvgs[crypto.symbol] = [];
                state.activeFvgs[crypto.symbol].push(...active15m);

                if (aligned15m.length > 0) {
                    const latest = aligned15m[aligned15m.length - 1];
                    state.signals[crypto.symbol] = { timeframe: '15m', type: latest.type, fvg: latest };
                }
            }
        } catch (e) {}
    }
    updateBanner();
}

/**
 * Load Candlestick Data & Draw Persistent FVG Boxes + 200 EMA Line
 */
async function loadCandleData(symbol, timeframe) {
    showChartLoader(true);

    try {
        const candles = await fetchKlines(symbol, timeframe, 350);

        if (candles && candles.length > 0) {
            const candleFormatted = candles.map(c => ({
                time: c.time, open: c.open, high: c.high, low: c.low, close: c.close
            }));

            const volumeFormatted = candles.map(c => ({
                time: c.time, value: c.volume,
                color: c.close >= c.open ? 'rgba(0, 230, 118, 0.4)' : 'rgba(255, 82, 82, 0.4)'
            }));

            // Compute 200 EMA Line
            const closes = candles.map(c => c.close);
            const ema200Values = calculateEMA(closes, 200);
            const emaFormatted = candles.map((c, i) => ({
                time: c.time,
                value: ema200Values[i]
            })).filter(item => item.value !== null && !isNaN(item.value));

            // Set Chart Series Data
            state.candleSeries.setData(candleFormatted);
            state.volumeSeries.setData(volumeFormatted);
            state.ema200Series.setData(emaFormatted);

            // Re-scale Y-axis
            state.chart.priceScale('right').applyOptions({ autoScale: true });
            state.chart.timeScale().fitContent();

            // Header OHLC & EMA update
            const lastCandle = candleFormatted[candleFormatted.length - 1];
            const lastEma = emaFormatted.length > 0 ? emaFormatted[emaFormatted.length - 1].value : null;
            
            elements.currentPrice.textContent = formatPrice(lastCandle.close);
            elements.ema200Val.textContent = lastEma ? formatPrice(lastEma) : '--';
            elements.valEma200.textContent = lastEma ? formatPrice(lastEma) : '--';

            // Detect & Draw Persistent Active FVG Zones on Chart!
            const fvgs = detectFVGs(candles, ema200Values, timeframe);
            const activeUnmitigated = fvgs.filter(f => !f.mitigated);
            elements.valActiveFvgs.textContent = activeUnmitigated.length;

            drawFvgPriceLines(activeUnmitigated);
        }
    } catch (err) {
        console.error('Failed to load candle data:', err);
    } finally {
        showChartLoader(false);
    }
}

/**
 * Draw Persistent FVG Price Lines & Shaded Zones on TradingView Chart
 */
function drawFvgPriceLines(fvgs) {
    // Clear previous price lines
    state.activePriceLines.forEach(line => {
        try { state.candleSeries.removePriceLine(line); } catch (e) {}
    });
    state.activePriceLines = [];

    fvgs.forEach(fvg => {
        const color = fvg.type === 'bullish' ? '#00e676' : '#ff5252';
        const label = `${fvg.timeframe} ${fvg.type.toUpperCase()} FVG`;

        // Upper Boundary Line
        const topLine = state.candleSeries.createPriceLine({
            price: fvg.top,
            color: color,
            lineWidth: 2,
            lineStyle: LightweightCharts.LineStyle.Solid,
            axisLabelVisible: true,
            title: `${label} Top`
        });

        // Lower Boundary Line
        const bottomLine = state.candleSeries.createPriceLine({
            price: fvg.bottom,
            color: color,
            lineWidth: 2,
            lineStyle: LightweightCharts.LineStyle.Dashed,
            axisLabelVisible: true,
            title: `${label} Bottom`
        });

        state.activePriceLines.push(topLine, bottomLine);
    });
}

/* ==========================================================================
   FVG & 200 EMA Technical Math Helpers
   ========================================================================== */

function calculateEMA(closes, period = 200) {
    if (closes.length < period) return new Array(closes.length).fill(null);
    const k = 2 / (period + 1);
    const ema = new Array(closes.length).fill(null);

    // Initial SMA for first period
    let sum = 0;
    for (let i = 0; i < period; i++) sum += closes[i];
    ema[period - 1] = sum / period;

    for (let i = period; i < closes.length; i++) {
        ema[i] = (closes[i] * k) + (ema[i - 1] * (1 - k));
    }
    return ema;
}

function detectFVGs(candles, ema200, timeframe) {
    if (candles.length < 4) return [];
    const fvgs = [];
    const len = candles.length;

    // Evaluated ONLY AFTER 3rd candle closes (up to index len-1)
    for (let i = 2; i < len - 1; i++) {
        const c1 = candles[i - 2];
        const c2 = candles[i - 1];
        const c3 = candles[i];
        const c3Ema = ema200[i];

        if (!c3Ema) continue;

        // Bullish FVG: Candle 1 High < Candle 3 Low
        if (c1.high < c3.low) {
            const fvgBottom = c1.high;
            const fvgTop = c3.low;
            const emaAligned = c3.close > c3Ema;

            // Check mitigation by subsequent candles
            let mitigated = false;
            for (let j = i + 1; j < len; j++) {
                if (candles[j].low <= fvgBottom) {
                    mitigated = true;
                    break;
                }
            }

            fvgs.push({
                type: 'bullish', timeframe, time: c3.time,
                top: fvgTop, bottom: fvgBottom, emaAligned, mitigated
            });
        }
        // Bearish FVG: Candle 1 Low > Candle 3 High
        else if (c1.low > c3.high) {
            const fvgTop = c1.low;
            const fvgBottom = c3.high;
            const emaAligned = c3.close < c3Ema;

            let mitigated = false;
            for (let j = i + 1; j < len; j++) {
                if (candles[j].high >= fvgTop) {
                    mitigated = true;
                    break;
                }
            }

            fvgs.push({
                type: 'bearish', timeframe, time: c3.time,
                top: fvgTop, bottom: fvgBottom, emaAligned, mitigated
            });
        }
    }
    return fvgs;
}

async function fetchKlines(symbol, timeframe, limit = 350) {
    const intervalMap = { '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d' };
    const interval = intervalMap[timeframe] || '15m';

    const res = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
    if (res.ok) {
        const data = await res.json();
        return data.map(item => ({
            time: Math.floor(item[0] / 1000),
            open: parseFloat(item[1]), high: parseFloat(item[2]),
            low: parseFloat(item[3]), close: parseFloat(item[4]), volume: parseFloat(item[5])
        }));
    }
    return [];
}

function updateBanner() {
    const activeSignal = state.signals[state.activeSymbol];
    if (activeSignal) {
        const isBull = activeSignal.type === 'bullish';
        elements.signalBanner.className = `signal-banner ${isBull ? 'bullish' : 'bearish'}`;
        elements.bannerText.innerHTML = `<strong>${activeSignal.type.toUpperCase()} FVG SIGNAL (${activeSignal.timeframe}):</strong> Confirmed 3rd candle close & Price ${isBull ? 'above' : 'below'} 200 EMA! Active range: [${formatPrice(activeSignal.fvg.bottom)} - ${formatPrice(activeSignal.fvg.top)}]`;
    } else {
        elements.signalBanner.className = 'signal-banner neutral';
        elements.bannerText.textContent = `No active 200 EMA aligned FVG signal for ${state.activeSymbol}. Showing live chart & 200 EMA.`;
    }
}

function formatPrice(price) {
    if (price === undefined || price === null || isNaN(price)) return '--.--';
    const num = parseFloat(price);
    if (num >= 1000) return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (num >= 1) return num.toFixed(2);
    return num.toFixed(4);
}

function showChartLoader(show) {
    if (show) elements.chartLoader.classList.remove('hidden');
    else elements.chartLoader.classList.add('hidden');
}
