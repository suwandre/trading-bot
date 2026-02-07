/**
 * Grid v3 Additional Periods Backtest
 * Tests Grid v3 across 5 NEW 30-day periods (150-270 days ago)
 */

import { MarketDataService } from '../src/data/market-data.service';
import { OrderSimulator } from '../src/backtesting/order-simulator';
import { MetricsCalculator } from '../src/backtesting/metrics-calculator';
import { BacktestEngine } from '../src/backtesting/backtest-engine';
import type { BacktestConfig, StrategyConfig } from '../src/types';

// Grid v3 Strategy Configuration
const gridV3Config: StrategyConfig = {
  id: 'grid-v3-additional-periods',
  name: 'Grid v3 - Additional Periods Test',
  type: 'grid',
  symbol: 'BTC/USDT',
  timeframe: '15m',
  mode: 'backtest',
  parameters: {
    gridLevels: 20,
    gridSpacingPercent: 0.5,
    useAdaptiveGrid: true,
    atrPeriod: 14,
    atrGridMultiplier: 0.2,
    recenterThreshold: 2,
    upperPrice: 0,
    lowerPrice: 0,
    quantityPerGrid: 0,
    maxPositionsPerSide: 8,
    positionSizePercent: 5,
    stopLossATRMultiplier: 3,
    enableStopLoss: true,
    adxPeriod: 14,
    adxMaxThreshold: 25,
    enableADXFilter: true,
    levelsPerBuy: 3,
    levelsToSellAbove: 2,
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

interface PeriodResult {
  period: string;
  startDate: string;
  endDate: string;
  pnl: number;
  pnlPercent: number;
  winRate: number;
  sharpe: number;
  maxDD: number;
  trades: number;
}

async function runAdditionalPeriodsBacktest() {
  console.log('='.repeat(80));
  console.log('GRID v3 ADDITIONAL PERIODS BACKTEST');
  console.log('='.repeat(80));
  console.log('');
  console.log('Testing Grid v3 across 5 NEW 30-day periods (150-270 days ago)');
  console.log('These are DIFFERENT periods from the previous test!');
  console.log('');

  const results: PeriodResult[] = [];

  // Define 5 NEW periods further back
  const periods = [
    { name: 'Period 6', daysAgo: 150 },
    { name: 'Period 7', daysAgo: 180 },
    { name: 'Period 8', daysAgo: 210 },
    { name: 'Period 9', daysAgo: 240 },
    { name: 'Period 10', daysAgo: 270 },
  ];

  try {
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

    console.log('Services initialized successfully\n');

    for (const period of periods) {
      const now = Date.now();
      const endTime = now - period.daysAgo * 24 * 60 * 60 * 1000;
      const startTime = endTime - 30 * 24 * 60 * 60 * 1000;

      console.log(`Testing ${period.name}: ${new Date(startTime).toISOString().split('T')[0]} to ${new Date(endTime).toISOString().split('T')[0]}`);

      const backtestConfig: BacktestConfig = {
        strategy: gridV3Config,
        symbol: 'BTC/USDT',
        timeframe: '15m',
        startTime,
        endTime,
        initialCapital: 10000,
        feeRate: 0.001,
        slippagePercent: 0.05,
      };

      const result = await backtestEngine.runBacktest(backtestConfig);

      results.push({
        period: period.name,
        startDate: new Date(startTime).toISOString().split('T')[0],
        endDate: new Date(endTime).toISOString().split('T')[0],
        pnl: result.metrics.totalPnL,
        pnlPercent: result.metrics.totalPnLPercent,
        winRate: result.metrics.winRate,
        sharpe: result.metrics.sharpeRatio,
        maxDD: result.metrics.maxDrawdownPercent,
        trades: result.metrics.totalTrades,
      });

      const pnlEmoji = result.metrics.totalPnL >= 0 ? '✅' : '❌';
      console.log(`  ${pnlEmoji} P&L: $${result.metrics.totalPnL.toFixed(2)} (${result.metrics.totalPnLPercent.toFixed(2)}%)`);
      console.log(`  Win Rate: ${(result.metrics.winRate * 100).toFixed(2)}%`);
      console.log(`  Sharpe: ${result.metrics.sharpeRatio.toFixed(2)}`);
      console.log(`  Max DD: ${result.metrics.maxDrawdownPercent.toFixed(2)}%`);
      console.log(`  Trades: ${result.metrics.totalTrades}`);
      console.log('');
    }

    // Summary
    console.log('='.repeat(80));
    console.log('ADDITIONAL PERIODS SUMMARY');
    console.log('='.repeat(80));

    const profitablePeriods = results.filter(r => r.pnl > 0);
    const totalPnL = results.reduce((sum, r) => sum + r.pnl, 0);
    const avgWinRate = results.reduce((sum, r) => sum + r.winRate, 0) / results.length;
    const avgSharpe = results.reduce((sum, r) => sum + r.sharpe, 0) / results.length;

    console.log(`\nResults across ${results.length} NEW periods:`);
    console.log(`  Profitable Periods: ${profitablePeriods.length}/${results.length} (${(profitablePeriods.length / results.length * 100).toFixed(0)}%)`);
    console.log(`  Total P&L: $${totalPnL.toFixed(2)}`);
    console.log(`  Average Win Rate: ${(avgWinRate * 100).toFixed(2)}%`);
    console.log(`  Average Sharpe: ${avgSharpe.toFixed(2)}`);

    console.log('\nDetailed Results:');
    console.log('--------------------------------------------------------------------------------');
    console.log('Period  | Date Range          | P&L         | Win Rate | Sharpe | Max DD | Trades');
    console.log('--------------------------------------------------------------------------------');

    for (const r of results) {
      const pnlStr = `$${r.pnl.toFixed(2)} (${r.pnlPercent.toFixed(2)}%)`;
      const periodStr = r.period.padEnd(7);
      const dateStr = `${r.startDate} to ${r.endDate}`;
      const pnlStrPad = pnlStr.padEnd(12);
      const winRateStr = `${(r.winRate * 100).toFixed(1)}%`.padEnd(8);
      const sharpeStr = r.sharpe.toFixed(2).padEnd(7);
      const maxDDStr = `${r.maxDD.toFixed(2)}%`.padEnd(8);
      const tradesStr = r.trades.toString();

      console.log(`${periodStr} | ${dateStr} | ${pnlStrPad} | ${winRateStr} | ${sharpeStr} | ${maxDDStr} | ${tradesStr}`);
    }

    console.log('--------------------------------------------------------------------------------');

    // Combined with previous results
    console.log('\n' + '='.repeat(80));
    console.log('COMBINED RESULTS (10 Periods Total)');
    console.log('='.repeat(80));

    // Previous periods summary (from first test)
    const prevProfitable = 4;
    const prevTotalPnL = 4597.36;
    const prevAvgSharpe = 0.20;

    const combinedProfitable = prevProfitable + profitablePeriods.length;
    const combinedTotalPnL = prevTotalPnL + totalPnL;
    const combinedAvgSharpe = (prevAvgSharpe + avgSharpe) / 2;

    console.log(`\nCombined across 10 periods:`);
    console.log(`  Profitable Periods: ${combinedProfitable}/10 (${(combinedProfitable / 10 * 100).toFixed(0)}%)`);
    console.log(`  Total P&L: $${combinedTotalPnL.toFixed(2)}`);
    console.log(`  Average Sharpe: ${combinedAvgSharpe.toFixed(2)}`);

    // Assessment
    console.log('\n' + '='.repeat(80));
    console.log('ASSESSMENT');
    console.log('='.repeat(80));

    if (profitablePeriods.length >= 3) {
      console.log(`✅ ${profitablePeriods.length}/5 NEW periods profitable - Grid v3 WORKS`);
    } else {
      console.log(`❌ Only ${profitablePeriods.length}/5 NEW periods profitable - Needs improvement`);
    }

    if (combinedProfitable >= 6) {
      console.log(`✅ COMBINED: ${combinedProfitable}/10 periods profitable (${(combinedProfitable / 10 * 100).toFixed(0)}%)`);
    }

    if (combinedTotalPnL > 0) {
      console.log(`✅ COMBINED Total P&L: $${combinedTotalPnL.toFixed(2)}`);
    }

    await marketDataService.disconnect();
    console.log('\nDisconnected from exchanges');

  } catch (error) {
    console.error('Backtest failed:', error);
    process.exit(1);
  }
}

runAdditionalPeriodsBacktest().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { runAdditionalPeriodsBacktest };
