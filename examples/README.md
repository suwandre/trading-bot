# Trading Bot Examples

This directory contains example configurations and usage scripts for the trading bot.

## 📁 Files

### Strategy Configurations

1. **[`dca-strategy-example.json`](./dca-strategy-example.json)**
   - Dollar Cost Averaging strategy for BTC/USDT
   - Daily investments of $100
   - 10% take profit target
   - Average down feature enabled

2. **[`grid-strategy-example.json`](./grid-strategy-example.json)**
   - Grid trading strategy for ETH/USDT
   - 10 grid levels between $2000-$2500
   - 2% spacing between grids
   - Profit reinvestment enabled

3. **[`custom-sma-strategy-example.json`](./custom-sma-strategy-example.json)**
   - Custom SMA crossover strategy for BTC/USDT
   - Fast SMA: 10 periods
   - Slow SMA: 30 periods
   - 10% position sizing

### Usage Scripts

4. **[`run-backtest-example.ts`](./run-backtest-example.ts)**
   - Complete example of running a backtest
   - Shows how to initialize services
   - Demonstrates report generation
   - Can be run directly with `tsx`

## 🚀 How to Use

### Running a Backtest

```bash
# Using tsx (development)
npx tsx examples/run-backtest-example.ts

# Or compile and run
npm run build
node dist/examples/run-backtest-example.js
```

### Loading a Strategy Configuration

```typescript
import fs from 'fs';
import { StrategyFactory } from '../src/strategies/strategy-factory';

// Load configuration from JSON
const configJson = fs.readFileSync('examples/dca-strategy-example.json', 'utf-8');
const config = JSON.parse(configJson);

// Validate configuration
const validation = StrategyFactory.validateConfig(config);
if (!validation.valid) {
  console.error('Invalid configuration:', validation.errors);
  process.exit(1);
}

// Create strategy instance
const strategy = StrategyFactory.createStrategy(config);
await strategy.initialize();
await strategy.start();
```

### Creating a Custom Strategy

1. Copy [`custom-sma-strategy-example.json`](./custom-sma-strategy-example.json)
2. Modify the parameters to suit your needs
3. Implement your strategy logic in a new file extending `BaseStrategy`
4. Register your strategy in the `StrategyFactory`

## 📊 Example Backtest Output

```
================================================================================
BACKTEST REPORT
================================================================================

STRATEGY INFORMATION
--------------------------------------------------------------------------------
Strategy Name: BTC Daily DCA
Strategy Type: DCA
Symbol: BTC/USDT
Timeframe: 15m
Period: 2026-01-05T00:00:00.000Z to 2026-02-04T00:00:00.000Z
Initial Capital: $10000.00
Fee Rate: 0.100%
Slippage: 0.050%

PERFORMANCE METRICS
--------------------------------------------------------------------------------
Total P&L: $1250.50 (12.51%)
Total Trades: 45
Winning Trades: 30 (66.67%)
Losing Trades: 15
Average Win: $75.25
Average Loss: $35.10
Profit Factor: 2.14

RISK METRICS
--------------------------------------------------------------------------------
Sharpe Ratio: 1.85
Max Drawdown: $450.00 (4.50%)

TRADE STATISTICS
--------------------------------------------------------------------------------
Total Volume: $45000.00
Total Fees: $45.00
Average Trade Size: $1000.00

EXECUTION STATISTICS
--------------------------------------------------------------------------------
Candles Processed: 2880
Execution Time: 2.45s
Processing Speed: 1175 candles/second
```

## 🎯 Strategy Comparison

You can run multiple backtests with different configurations to compare strategies:

```typescript
const strategies = [
  dcaStrategyConfig,
  gridStrategyConfig,
  smaStrategyConfig,
];

for (const strategyConfig of strategies) {
  const result = await backtestEngine.runBacktest({
    strategy: strategyConfig,
    symbol: strategyConfig.symbol,
    timeframe: strategyConfig.timeframe,
    startTime: thirtyDaysAgo,
    endTime: now,
    initialCapital: 10000,
    feeRate: 0.001,
    slippagePercent: 0.05,
  });

  console.log(`${strategyConfig.name}: ${result.metrics.totalPnLPercent.toFixed(2)}%`);
}
```

## 💡 Tips

1. **Start with backtesting**: Always backtest your strategy before paper or live trading
2. **Use realistic fees**: Set fee rates matching your exchange (MEXC: ~0.1%)
3. **Account for slippage**: Especially important for market orders
4. **Test different periods**: Bull markets, bear markets, ranging markets
5. **Compare strategies**: Run multiple backtests to find the best performer
6. **Monitor drawdown**: Ensure max drawdown is acceptable for your risk tolerance

## 📝 Notes

- Backtesting uses Binance data (more historical data available)
- No MongoDB connection required for backtesting
- Results are deterministic (same config = same results)
- All calculations use real historical data (no look-ahead bias)

## 🔗 Related Documentation

- [Architecture Overview](../plans/architecture-overview.md)
- [Technical Specification](../plans/technical-specification.md)
- [Implementation Guide](../plans/implementation-guide.md)
- [Main README](../README.md)
