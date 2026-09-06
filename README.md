# Top 5 Crypto Futures Scanner - GitHub Pages Prototype

A fast, responsive, modern dark-themed web application that lists the **Top 5 Crypto Futures** (BTC, ETH, SOL, BNB, XRP) and renders live interactive candlestick charts using TradingView's Lightweight Charts library.

Designed to be hosted **100% free on GitHub Pages** with zero server overhead or complex setup.

---

## Features

- ⚡ **GitHub Pages Ready:** Built using static HTML5, CSS3, and JavaScript.
- 📈 **TradingView Charts:** High-performance canvas charting with candlestick series, volume histogram, crosshair inspection, and OHLC tracking.
- 🪙 **Top 5 Crypto Futures:** Instant switching between `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `BNBUSDT`, and `XRPUSDT`.
- ⏱️ **Multi-Timeframe Controls:** Switch between 15m, 1h, 4h, and 1D candle timeframes.
- 🛡️ **CORS Resilient:** Built-in automatic fallback so your site functions reliably on public GitHub Pages URLs without browser CORS errors.

---

## 🚀 How to Deploy on GitHub Pages (Step-by-Step)

### Option A: Via GitHub Desktop or Web Interface
1. Create a new repository on GitHub (e.g. `crypto-futures-scanner`).
2. Upload `index.html`, `styles.css`, `app.js`, and `README.md` to the main branch.
3. In your repository on GitHub, go to **Settings** -> **Pages**.
4. Under **Build and deployment** -> **Branch**, select `main` (or `master`) and `/ (root)`.
5. Click **Save**. Within 1-2 minutes, your live site link will be ready at:
   `https://<your-username>.github.io/<repository-name>/`

### Option B: Via Command Line (Git)
```bash
git init
git add .
git commit -m "Deploy crypto scanner prototype"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/crypto-futures-scanner.git
git push -u origin main
```
Then enable GitHub Pages under Repository Settings!

---

## 📁 File Structure

```text
├── index.html     # Semantic HTML layout and chart container
├── styles.css     # Dark mode glassmorphism styles & responsive design
├── app.js         # Market ticker logic, CORS resilience, and Lightweight Charts engine
└── README.md      # Deployment guide & overview
```
