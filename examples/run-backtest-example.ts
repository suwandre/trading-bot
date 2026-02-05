/**
 * Example: How to run a backtest
 * 
 * This example demonstrates how to:
 * 1. Load a strategy configuration
 * 2. Set up the backtesting engine
 * 3. Run a backtest
 * 4. Generate and view results
 */

import { MarketDataService } from '../src/data/market-data.service';
import { OrderSimulator } from '../src/backtesting/order-simulator';
import { MetricsCalculator } from '../src/backtesting/metrics-calculator';
import { BacktestEngine } from '../src/backtesting/backtest-engine';
import { ReportGenerator } from '../src/backtesting/report-generator';
import type { BacktestConfig, StrategyConfig } from '../src/types';

// Example DCA strategy configuration
const dcaStrategyConfig: StrategyConfig = {
  id: 'dca-btc-test',
  name: 'BTC Daily DCA Test',
  type: 'dca',
  symbol: 'BTC/USDT',
  timeframe: '15m',
  mode: 'backtest',
  parameters: {
    investmentAmount: 100,
    interval: 'daily',
    takeProfitPercent: 10,
    averageDown: true,
    averageDownPercent: 5,
    maxAverageDowns: 3,
  },
  riskParams: {
    stopLossPercent: 15,
    maxPositionSize: 5000,
    maxOpenPositions: 1,
    maxDrawdownPercent: 20,
  },
  status: 'active',
  initialCapital: 10000,
  currentCapital: 10000,
  createdAt: new Date(),
  updatedAt: new Date(),
};

async function runBacktestExample() {
  console.log('='.repeat(80));
  console.log('BACKTEST EXAMPLE');
  console.log('='.repeat(80));
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
      strategy: dcaStrategyConfig,
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
    console.log('');

    // Run backtest
    console.log('Running backtest...');
    console.log('This may take a few moments...\n');

    const result = await backtestEngine.runBacktest(backtestConfig);

    console.log('Backtest completed!\n');

    // Generate and display report
    const textReport = reportGenerator.generateTextReport(result);
    console.log(textReport);

    // Save reports
    console.log('\nGenerating reports...');
    const jsonReport = reportGenerator.generateJSONReport(result);
    const tradesCSV = reportGenerator.generateTradesCSV(result.trades);
    const equityCSV = reportGenerator.generateEquityCSV(result);

    console.log('Reports generated:');
    console.log('  - Text report (displayed above)');
    console.log('  - JSON report (available)');
    console.log('  - Trades CSV (available)');
    console.log('  - Equity CSV (available)');
    console.log('');

    // Display key metrics
    console.log('KEY METRICS:');
    console.log(`  Total P&L: $${result.metrics.totalPnL.toFixed(2)} (${result.metrics.totalPnLPercent.toFixed(2)}%)`);
    console.log(`  Win Rate: ${(result.metrics.winRate * 100).toFixed(2)}%`);
    console.log(`  Profit Factor: ${result.metrics.profitFactor.toFixed(2)}`);
    console.log(`  Sharpe Ratio: ${result.metrics.sharpeRatio.toFixed(2)}`);
    console.log(`  Max Drawdown: ${result.metrics.maxDrawdownPercent.toFixed(2)}%`);
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
runBacktestExample().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { runBacktestExample };
