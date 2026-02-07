/**
 * Grid Trading Strategy v3 Backtest
 * Tests the improved Grid v3 with tighter spacing, more levels, and trailing stop
 */

import { MarketDataService } from '../src/data/market-data.service';
import { OrderSimulator } from '../src/backtesting/order-simulator';
import { MetricsCalculator } from '../src/backtesting/metrics-calculator';
import { BacktestEngine } from '../src/backtesting/backtest-engine';
import { ReportGenerator } from '../src/backtesting/report-generator';
import type { BacktestConfig, StrategyConfig } from '../src/types';

// Grid v3 Strategy Configuration
const gridV3Config: StrategyConfig = {
  id: 'grid-v3-btc',
  name: 'Grid v3 - Improved Adaptive Grid',
  type: 'grid',
  symbol: 'BTC/USDT',
  timeframe: '15m',
  mode: 'backtest',
  parameters: {
    // v3: Tighter grid with more levels
    gridLevels: 20,              // Increased from 10
    gridSpacingPercent: 0.5,     // Tighter spacing
    
    // Adaptive Grid
    useAdaptiveGrid: true,
    atrPeriod: 14,
    atrGridMultiplier: 0.2,      // Tighter from 0.5
    recenterThreshold: 2,
    
    // Static fallback
    upperPrice: 0,
    lowerPrice: 0,
    
    // Position Sizing - v3: larger
    quantityPerGrid: 0,
    maxPositionsPerSide: 8,      // Increased from 5
    positionSizePercent: 5,      // Increased from 3%
    
    // Risk - v3: wider stop
    stopLossATRMultiplier: 3,     // Increased from 2
    enableStopLoss: true,
    
    // ADX - v3: relaxed
    adxPeriod: 14,
    adxMaxThreshold: 25,          // Relaxed from 20
    enableADXFilter: true,
    
    // Profits
    reinvestProfits: true,
    reinvestPercent: 50,
    
    // v3: Multi-level Trading
    levelsPerBuy: 3,             // Buy at 3 lower levels
    levelsToSellAbove: 2,         // Sell at 2+ levels above
    
    // v3: Trailing Stop
    enableTrailingStop: true,
    trailingStopPercent: 1,
  },
  riskParams: {
    maxPositionSize: 5000,
    maxOpenPositions: 8,
    maxDrawdownPercent: 15,
  },
  status: 'active',
  initialCapital: 10000,
  currentCapital: 10000,
  createdAt: new Date(),
  updatedAt: new Date(),
};

async function runGridV3Backtest() {
  console.log('='.repeat(80));
  console.log('GRID TRADING v3 BACKTEST - IMPROVED VERSION');
  console.log('='.repeat(80));
  console.log('');
  console.log('v3 Improvements:');
  console.log('  - Tighter ATR spacing (0.2 instead of 0.5)');
  console.log('  - More grid levels (20 instead of 10)');
  console.log('  - Multi-level buying (3 levels at once)');
  console.log('  - Multi-level profit taking');
  console.log('  - Dynamic position sizing');
  console.log('  - Trailing stop (1%)');
  console.log('  - Relaxed ADX filter (25 instead of 20)');
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

    // Configure backtest - 30 days
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const backtestConfig: BacktestConfig = {
      strategy: gridV3Config,
      symbol: 'BTC/USDT',
      timeframe: '15m',
      startTime: thirtyDaysAgo,
      endTime: now,
      initialCapital: 10000,
      feeRate: 0.001,
      slippagePercent: 0.05,
    };

    console.log('Backtest Configuration:');
    console.log(`  Strategy: ${backtestConfig.strategy.name}`);
    console.log(`  Symbol: ${backtestConfig.symbol}`);
    console.log(`  Timeframe: ${backtestConfig.timeframe}`);
    console.log(`  Period: ${new Date(backtestConfig.startTime).toISOString()} to ${new Date(backtestConfig.endTime).toISOString()}`);
    console.log(`  Initial Capital: $${backtestConfig.initialCapital}`);
    console.log(`  Grid Levels: ${gridV3Config.parameters.gridLevels}`);
    console.log(`  ATR Multiplier: ${gridV3Config.parameters.atrGridMultiplier}`);
    console.log(`  Max Positions: ${gridV3Config.parameters.maxPositionsPerSide}`);
    console.log('');

    // Run backtest
    console.log('Running backtest...');
    console.log('');

    const result = await backtestEngine.runBacktest(backtestConfig);

    console.log('Backtest completed!\n');

    // Generate and display report
    const textReport = reportGenerator.generateTextReport(result);
    console.log(textReport);

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('GRID v3 PERFORMANCE SUMMARY');
    console.log('='.repeat(80));
    console.log(`  Total P&L: $${result.metrics.totalPnL.toFixed(2)} (${result.metrics.totalPnLPercent.toFixed(2)}%)`);
    console.log(`  Win Rate: ${(result.metrics.winRate * 100).toFixed(2)}%`);
    console.log(`  Total Trades: ${result.metrics.totalTrades}`);
    console.log(`  Sharpe Ratio: ${result.metrics.sharpeRatio.toFixed(2)}`);
    console.log(`  Max Drawdown: ${result.metrics.maxDrawdownPercent.toFixed(2)}%`);
    console.log(`  Profit Factor: ${result.metrics.profitFactor.toFixed(2)}`);
    console.log('');

    // Disconnect
    await marketDataService.disconnect();
    console.log('Disconnected from exchanges');

  } catch (error) {
    console.error('Backtest failed:', error);
    process.exit(1);
  }
}

// Run the backtest
runGridV3Backtest().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { runGridV3Backtest };
