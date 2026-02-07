/**
 * SMA Crossover Trend Following Strategy Backtest Example
 * 
 * This strategy is designed for:
 * - Uptrending markets
 * - Captures major trends
 * - Lower trade frequency, larger profits per trade
 */

import { MarketDataService } from '../src/data/market-data.service';
import { OrderSimulator } from '../src/backtesting/order-simulator';
import { MetricsCalculator } from '../src/backtesting/metrics-calculator';
import { BacktestEngine } from '../src/backtesting/backtest-engine';
import { ReportGenerator } from '../src/backtesting/report-generator';
import type { BacktestConfig, StrategyConfig } from '../src/types';

// SMA Crossover Trend Following Strategy Configuration
const smaStrategyConfig: StrategyConfig = {
  id: 'sma-crossover-btc-uptrend',
  name: 'SMA Crossover Trend Following BTC',
  type: 'trend-following',
  symbol: 'BTC/USDT',
  timeframe: '15m',
  mode: 'backtest',
  parameters: {
    // SMA Parameters
    fastPeriod: 9,
    slowPeriod: 21,
    
    // ATR Parameters
    atrPeriod: 14,
    
    // Trading Parameters
    positionSizePercent: 10,    // 10% of capital per trade
    stopLossPercent: 3,          // 3% stop loss
    trailingStopPercent: 2.5,    // 2.5% trailing stop
    confirmationCandles: 1,      // Confirm with 1 candle
    maxHoldPeriods: 96,          // Max hold: 96 periods (24h on 15m)
  },
  riskParams: {
    stopLossPercent: 3,
    trailingStopPercent: 2.5,
    maxPositionSize: 1000,       // Max $1000 per trade
    maxOpenPositions: 2,
    maxDrawdownPercent: 15,
    positionSizePercent: 10,
  },
  status: 'active',
  initialCapital: 10000,
  currentCapital: 10000,
  createdAt: new Date(),
  updatedAt: new Date(),
};

async function runSMABacktest() {
  console.log('='.repeat(80));
  console.log('SMA CROSSOVER TREND FOLLOWING BACKTEST');
  console.log('='.repeat(80));
  console.log('');
  console.log('Strategy Overview:');
  console.log('  - Buys when Fast SMA crosses above Slow SMA (Golden Cross)');
  console.log('  - Sells when Fast SMA crosses below Slow SMA (Death Cross)');
  console.log('  - Uses trailing stop to protect profits');
  console.log('  - Best for trending markets');
  console.log('');

  try {
    // Initialize services
    console.log('Initializing services...');
    const marketDataService = new MarketDataService();
    await marketDataService.initialize();

    const orderSimulator = new OrderSimulator();
    const metricsCalculator = new MetricsCalculator();
    const backtestEngine = new BacktestEngine(
      marketDataService,
      orderSimulator,
      metricsCalculator
    );
    const reportGenerator = new ReportGenerator();

    console.log('Services initialized successfully\n');

    // Configure backtest
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const backtestConfig: BacktestConfig = {
      strategy: smaStrategyConfig,
      symbol: 'BTC/USDT',
      timeframe: '15m',
      startTime: thirtyDaysAgo,
      endTime: now,
      initialCapital: 10000,
      feeRate: 0.001, // 0.1%
      slippagePercent: 0.05, // 0.05%
    };

    console.log('Backtest Configuration:');
    console.log(`  Strategy: ${backtestConfig.strategy.name}`);
    console.log(`  Symbol: ${backtestConfig.symbol}`);
    console.log(`  Timeframe: ${backtestConfig.timeframe}`);
    console.log(`  Period: ${new Date(backtestConfig.startTime).toISOString()} to ${new Date(backtestConfig.endTime).toISOString()}`);
    console.log(`  Initial Capital: $${backtestConfig.initialCapital}`);
    console.log(`  Fast SMA Period: ${smaStrategyConfig.parameters.fastPeriod}`);
    console.log(`  Slow SMA Period: ${smaStrategyConfig.parameters.slowPeriod}`);
    console.log(`  Position Size: ${smaStrategyConfig.parameters.positionSizePercent}% per trade`);
    console.log(`  Stop Loss: ${smaStrategyConfig.parameters.stopLossPercent}%`);
    console.log(`  Trailing Stop: ${smaStrategyConfig.parameters.trailingStopPercent}%`);
    console.log('');

    // Run backtest
    console.log('Running backtest...');
    console.log('This may take a few moments...\n');

    const result = await backtestEngine.runBacktest(backtestConfig);

    console.log('Backtest completed!\n');

    // Generate and display report
    const textReport = reportGenerator.generateTextReport(result);
    console.log(textReport);

    // Display key metrics with comparison
    console.log('\n' + '='.repeat(80));
    console.log('KEY METRICS COMPARISON');
    console.log('='.repeat(80));
    console.log(`                      Current DCA    SMA Crossover`);
    console.log(`  Total P&L:          $-911.95        $${result.metrics.totalPnL.toFixed(2)} (${result.metrics.totalPnLPercent.toFixed(2)}%)`);
    console.log(`  Win Rate:           0.00%           ${(result.metrics.winRate * 100).toFixed(2)}%`);
    console.log(`  Profit Factor:      0.00           ${result.metrics.profitFactor.toFixed(2)}`);
    console.log(`  Sharpe Ratio:        -0.93           ${result.metrics.sharpeRatio.toFixed(2)}`);
    console.log(`  Max Drawdown:       9.83%           ${result.metrics.maxDrawdownPercent.toFixed(2)}%`);
    console.log(`  Total Trades:       33              ${result.metrics.totalTrades}`);
    console.log(`  Average Trade:      -$27.63         $${(result.metrics.totalPnL / Math.max(1, result.metrics.totalTrades)).toFixed(2)}`);
    console.log('');

    // Save reports
    console.log('Generating reports...');
    const jsonReport = reportGenerator.generateJSONReport(result);
    const tradesCSV = reportGenerator.generateTradesCSV(result.trades);
    const equityCSV = reportGenerator.generateEquityCSV(result);

    console.log('Reports generated:');
    console.log('  - Text report (displayed above)');
    console.log('  - JSON report (available)');
    console.log('  - Trades CSV (available)');
    console.log('  - Equity CSV (available)');
    console.log('');

    // Strategy performance assessment
    console.log('='.repeat(80));
    console.log('STRATEGY ASSESSMENT');
    console.log('='.repeat(80));
    
    const improvements = [];
    if (result.metrics.totalPnL > 0) improvements.push('✓ Positive P&L');
    else improvements.push('✗ Still negative P&L');
    
    if (result.metrics.winRate > 0.4) improvements.push('✓ Good win rate (>40%)');
    else if (result.metrics.winRate > 0.3) improvements.push('~ Moderate win rate (>30%)');
    else improvements.push('✗ Low win rate');
    
    if (result.metrics.sharpeRatio > 0.5) improvements.push('✓ Good Sharpe Ratio (>0.5)');
    else if (result.metrics.sharpeRatio > 0) improvements.push('~ Positive Sharpe Ratio');
    else improvements.push('✗ Negative Sharpe Ratio');
    
    if (result.metrics.maxDrawdownPercent < 10) improvements.push('✓ Low drawdown (<10%)');
    else improvements.push('~ Moderate drawdown');

    improvements.forEach(item => console.log(`  ${item}`));
    console.log('');

    // Disconnect
    await marketDataService.disconnect();
    console.log('Disconnected from exchanges');

  } catch (error) {
    console.error('Backtest failed:', error);
    process.exit(1);
  }
}

// Run the example automatically
runSMABacktest().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { runSMABacktest };
