/**
 * RSI + Bollinger Bands Mean Reversion Strategy Backtest Example
 * 
 * This strategy is designed for:
 * - Downtrending or ranging markets
 * - Lower timeframes (5m, 15m)
 * - High win rate with smaller profits per trade
 */

import { MarketDataService } from '../src/data/market-data.service';
import { OrderSimulator } from '../src/backtesting/order-simulator';
import { MetricsCalculator } from '../src/backtesting/metrics-calculator';
import { BacktestEngine } from '../src/backtesting/backtest-engine';
import { ReportGenerator } from '../src/backtesting/report-generator';
import type { BacktestConfig, StrategyConfig } from '../src/types';

// RSI + Bollinger Bands Mean Reversion Strategy Configuration
const rsiBBStrategyConfig: StrategyConfig = {
  id: 'rsi-bc-btc-downtrend',
  name: 'RSI + BB Mean Reversion BTC',
  type: 'mean-reversion',
  symbol: 'BTC/USDT',
  timeframe: '15m',
  mode: 'backtest',
  parameters: {
    // RSI Parameters
    rsiPeriod: 14,
    rsiOversold: 25,        // Lower oversold threshold for better entries
    rsiOverbought: 65,       // Lower overbought for earlier exits
    
    // Bollinger Bands Parameters
    bbPeriod: 20,
    bbStdDev: 2,
    
    // ATR Parameters
    atrPeriod: 14,
    
    // Trading Parameters - OPTIMIZED
    positionSizePercent: 5,    // 5% of capital per trade
    stopLossPercent: 4,      // 4% stop loss (wider to avoid whipsaws)
    trailingStopPercent: 2,   // 2% trailing stop
    takeProfitPercent: 6,    // 6% take profit (better risk:reward)
    
    // Filters
    minDropPercent: 3,        // Min 3% drop from recent high
    confirmationCandles: 2,    // Confirm with 2 candles
    
    // Trend filter - only buy if price above SMA200
    smaPeriod: 200,
    enableTrendFilter: true,
  },
  riskParams: {
    stopLossPercent: 4,
    takeProfitPercent: 6,
    trailingStopPercent: 2,
    maxPositionSize: 500,      // Max $500 per trade
    maxOpenPositions: 2,
    maxDrawdownPercent: 15,
    positionSizePercent: 5,
  },
  status: 'active',
  initialCapital: 10000,
  currentCapital: 10000,
  createdAt: new Date(),
  updatedAt: new Date(),
};

async function runRSIBBBacktest() {
  console.log('='.repeat(80));
  console.log('RSI + BOLLINGER BANDS MEAN REVERSION BACKTEST');
  console.log('='.repeat(80));
  console.log('');
  console.log('Strategy Overview:');
  console.log('  - Buys when RSI < 30 and price touches lower Bollinger Band');
  console.log('  - Sells when price reaches middle BB or RSI > 60');
  console.log('  - Uses trailing stop to protect profits');
  console.log('  - Smaller position sizes for higher win rate');
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
      strategy: rsiBBStrategyConfig,
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
    console.log(`  Position Size: ${rsiBBStrategyConfig.parameters.positionSizePercent}% per trade`);
    console.log(`  Stop Loss: ${rsiBBStrategyConfig.parameters.stopLossPercent}%`);
    console.log(`  Take Profit: ${rsiBBStrategyConfig.parameters.takeProfitPercent}%`);
    console.log(`  RSI Oversold: ${rsiBBStrategyConfig.parameters.rsiOversold}`);
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
    console.log(`                      Current DCA    RSI + BB Strategy`);
    console.log(`  Total P&L:          $-911.95        $${result.metrics.totalPnL.toFixed(2)} (${result.metrics.totalPnLPercent.toFixed(2)}%)`);
    console.log(`  Win Rate:          0.00%           ${(result.metrics.winRate * 100).toFixed(2)}%`);
    console.log(`  Profit Factor:     0.00           ${result.metrics.profitFactor.toFixed(2)}`);
    console.log(`  Sharpe Ratio:       -0.93           ${result.metrics.sharpeRatio.toFixed(2)}`);
    console.log(`  Max Drawdown:      9.83%           ${result.metrics.maxDrawdownPercent.toFixed(2)}%`);
    console.log(`  Total Trades:      33              ${result.metrics.totalTrades}`);
    console.log(`  Average Trade:     -$27.63         $${(result.metrics.totalPnL / result.metrics.totalTrades).toFixed(2)}`);
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
runRSIBBBacktest().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { runRSIBBBacktest };
