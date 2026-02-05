# Quick Start Guide - Trading Bot V2

Get up and running in 5 minutes!

## ⚡ Fastest Way to Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run a Backtest (No API Keys Needed!)

```bash
# Just run the example - it works out of the box!
npx tsx examples/run-backtest-example.ts
```

**That's it!** The bot will:
- Fetch public historical data from Binance (no API keys required)
- Run a DCA strategy backtest
- Show you comprehensive results

## 🔑 About API Keys

### For Backtesting: **NO API KEYS NEEDED** ✅

Backtesting only uses **public market data** (historical prices), which is freely available without authentication.

The bot fetches:
- Historical OHLCV candles
- Public ticker data
- Trading pair information

All of this is public and doesn't require API keys!

### When You DO Need API Keys:

**Binance API Keys** (optional):
- Only if you want to access your Binance account balance
- Only if you want to place orders on Binance
- **NOT needed for backtesting**

**MEXC API Keys** (for live trading):
- Only when you're ready to trade live
- Required for placing real orders
- Required for accessing your MEXC account

## 📝 Configuration

### Minimal Setup (Backtesting Only)

Create `.env` file:
```env
# That's it! Nothing else needed for backtesting
NODE_ENV=development
PORT=3000
```

### Full Setup (Live Trading)

```env
# Server
NODE_ENV=production
PORT=3000

# MEXC API (for live trading)
MEXC_API_KEY=your_mexc_api_key
MEXC_API_SECRET=your_mexc_api_secret

# Risk Management
MAX_TOTAL_EXPOSURE=10000
MAX_DAILY_LOSS=500
MAX_DRAWDOWN_PERCENT=20
```

## 🚀 What You Can Do Without API Keys

1. **Run Backtests**
   ```bash
   npx tsx examples/run-backtest-example.ts
   ```

2. **Test All Strategies**
   - DCA (Dollar Cost Averaging)
   - Grid Trading
   - Custom SMA Crossover

3. **Get Performance Metrics**
   - Win rate, profit factor
   - Sharpe ratio, Sortino ratio
   - Maximum drawdown
   - Equity curves

4. **Generate Reports**
   - Text reports
   - JSON exports
   - CSV data

5. **Start API Server**
   ```bash
   npm run dev
   ```

6. **Use REST API**
   ```bash
   curl http://localhost:3000/health
   curl http://localhost:3000/api/strategies
   ```

## 📊 Example Backtest Output

```
================================================================================
BACKTEST REPORT
================================================================================

PERFORMANCE METRICS
--------------------------------------------------------------------------------
Total P&L: $1250.50 (12.51%)
Total Trades: 45
Winning Trades: 30 (66.67%)
Sharpe Ratio: 1.85
Max Drawdown: 4.50%

Execution Time: 2.45s
Processing Speed: 1175 candles/second
```

## 🎯 Next Steps

### 1. Test Different Strategies

Edit the example configs in [`examples/`](examples/):
- [`dca-strategy-example.json`](examples/dca-strategy-example.json)
- [`grid-strategy-example.json`](examples/grid-strategy-example.json)
- [`custom-sma-strategy-example.json`](examples/custom-sma-strategy-example.json)

### 2. Create Your Own Strategy

Copy [`custom-strategy-template.ts`](src/strategies/custom/custom-strategy-template.ts) and implement your logic!

### 3. Paper Trading

Once you're confident with backtesting:
```json
{
  "mode": "paper"  // Change from "backtest" to "paper"
}
```

### 4. Live Trading

When ready for real trading:
1. Add MEXC API keys to `.env`
2. Change mode to `"live"`
3. Start small!

## ⚠️ Important Notes

1. **Backtesting is Offline**: No internet required after initial data fetch
2. **No MongoDB Needed**: Backtesting runs entirely in-memory
3. **Deterministic Results**: Same config = same results every time
4. **Realistic Simulation**: Includes slippage and fees
5. **No Look-Ahead Bias**: Uses only historical data available at each point

## 🆘 Troubleshooting

### "Cannot connect to Binance"
- Check your internet connection
- Binance API might be temporarily down
- Try again in a few minutes

### "No historical data available"
- Check the date range in your backtest config
- Ensure the symbol exists (e.g., BTC/USDT)
- Try a different time period

### TypeScript Errors
- Run `npm install` to ensure all dependencies are installed
- Some type errors are expected and won't affect runtime

## 📚 Learn More

- [`README.md`](README.md): Full documentation
- [`API.md`](API.md): API reference
- [`DEPLOYMENT.md`](DEPLOYMENT.md): Deployment guide
- [`examples/README.md`](examples/README.md): More examples
- [`plans/`](plans/): Architecture documentation

---

**Ready to backtest?** Just run `npx tsx examples/run-backtest-example.ts` - no setup required!
