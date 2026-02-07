/**
 * DCA (Dollar Cost Averaging) Strategy Backtest Example
 * 
 * This strategy is designed for:
 * - Long-term investing
 * - Reducing average entry price
 * - Capturing gains when price rises
 */

import { MarketDataService } from '../src/data/market-data.service';
import { OrderSimulator } from '../src/backtesting/order-simulator';
import { MetricsCalculator } from '../src/backtesting/metrics-calculator';
import { BacktestEngine } from '../src/backtesting/backtest-engine';
import { ReportGenerator } from '../src/backtesting/report-generator';
import type { BacktestConfig, StrategyConfig } from '../src/types';

// DCA Strategy Configuration
const dcaStrategyConfig: StrategyConfig = {
  id: 'dca-btc-backtest',
  name: 'BTC DCA Backtest',
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
    positionSizePercent: 10,
  },
  status: 'active',
  initialCapital: 10000,
  currentCapital: 10000,
  createdAt: new Date(),
  updatedAt: new Date(),
};

async function runDCABacktest() {
  console.log('='.repeat(80));
  console.log('DCA (DOLLAR COST AVERAGING) BACKTEST');
  console.log('='.repeat(80));
  console.log('');
  console.log('Strategy Overview:');
  console.log('  - Invests fixed amount at regular intervals (daily)');
  console.log('  - Averages down when price drops 5% from average');
  console.log('  - Takes profit when price rises 10% from average');
  console.log('  - Long-term accumulation strategy');
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
    console.log(`  Investment Amount: $${dcaStrategyConfig.parameters.investmentAmount} per DCA`);
    console.log(`  Interval: ${dcaStrategyConfig.parameters.interval}`);
    console.log(`  Take Profit: ${dcaStrategyConfig.parameters.takeProfitPercent}%`);
    console.log(`  Average Down: ${dcaStrategyConfig.parameters.averageDown ? 'Yes' : 'No'} (${dcaStrategyConfig.parameters.averageDownPercent}% drop)`);
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
    console.log(`                      Current DCA    DCA Strategy`);
    console.log(`  Total P&L:          $-911.95        $${result.metrics.totalPnL.toFixed(2)} (${result.metrics.totalPnLPercent.toFixed(2)}%)`);
    console.log(`  Win Rate:           0.00%           ${(result.metrics.winRate * 100).toFixed(2)}%`);
    console.log(`  Profit Factor:     0.00           ${result.metrics.profitFactor.toFixed(2)}`);
    console.log(`  Sharpe Ratio:        -0.93           ${result.metrics.sharpeRatio.toFixed(2)}`);
    console.log(`  Max Drawdown:      9.83%           ${result.metrics.maxDrawdownPercent.toFixed(2)}%`);
    console.log(`  Total Trades:      33              ${result.metrics.totalTrades}`);
    console.log(`  Average Trade:     -$27.63         $${(result.metrics.totalPnL / Math.max(1, result.metrics.totalTrades)).toFixed(2)}`);
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
    
    if (result.metrics.winRate > 0.5) improvements.push('✓ High win rate (>50%)');
    else if (result.metrics.winRate > 0.3) improvements.push('~ Moderate win rate (>30%)');
    else improvements.push('~ DCA is a long-term strategy, win rate less relevant');
    
    if (result.metrics.sharpeRatio > 0.5) improvements.push('✓ Good Sharpe Ratio (>0.5)');
    else if (result.metrics.sharpeRatio > 0) improvements.push('~ Positive Sharpe Ratio');
    else improvements.push('~ DCA reduces timing risk, Sharpe may be lower');
    
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
runDCABacktest().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { runDCABacktest };
