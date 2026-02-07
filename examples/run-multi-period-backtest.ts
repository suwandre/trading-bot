/**
 * Multi-Period Strategy Backtest Comparison
 * Tests all strategies across 3 different time periods
 */

import { MarketDataService } from '../src/data/market-data.service';
import { OrderSimulator } from '../src/backtesting/order-simulator';
import { MetricsCalculator } from '../src/backtesting/metrics-calculator';
import { BacktestEngine } from '../src/backtesting/backtest-engine';
import type { BacktestConfig, StrategyConfig } from '../src/types';

// Strategy Configurations
const strategies = {
  sma: {
    id: 'sma-crossover',
    name: 'SMA Crossover',
    type: 'trend-following',
    parameters: {
      fastPeriod: 9,
      slowPeriod: 21,
      positionSizePercent: 10,
      stopLossPercent: 3,
      trailingStopPercent: 2.5,
      confirmationCandles: 1,
      maxHoldPeriods: 96,
    },
    riskParams: {
      stopLossPercent: 3,
      trailingStopPercent: 2.5,
      maxPositionSize: 1000,
      maxOpenPositions: 2,
      maxDrawdownPercent: 15,
      positionSizePercent: 10,
    },
  },
  rsiBB: {
    id: 'rsi-bb',
    name: 'RSI + BB',
    type: 'mean-reversion',
    parameters: {
      rsiPeriod: 14,
      rsiOversold: 25,
      rsiOverbought: 65,
      bbPeriod: 20,
      bbStdDev: 2,
      atrPeriod: 14,
      positionSizePercent: 5,
      stopLossPercent: 4,
      trailingStopPercent: 2,
      takeProfitPercent: 6,
      minDropPercent: 3,
      confirmationCandles: 2,
      smaPeriod: 200,
      enableTrendFilter: true,
    },
    riskParams: {
      stopLossPercent: 4,
      takeProfitPercent: 6,
      trailingStopPercent: 2,
      maxPositionSize: 500,
      maxOpenPositions: 2,
      maxDrawdownPercent: 15,
      positionSizePercent: 5,
    },
  },
  grid: {
    id: 'grid',
    name: 'Grid Trading',
    type: 'grid',
    parameters: {
      gridLevels: 10,
      gridSpacingPercent: 1.5,
      upperPriceOffset: 10,
      lowerPriceOffset: 10,
      quantityPerGrid: 'equal',
      reinvestProfits: true,
    },
    riskParams: {
      maxPositionSize: 10000,
      maxOpenPositions: 1,
      maxDrawdownPercent: 15,
    },
  },
  dca: {
    id: 'dca',
    name: 'DCA',
    type: 'dca',
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
  },
};

// Test Periods (3 different 30-day periods)
const periods = [
  { name: 'Period 1 (Recent)', startDaysAgo: 30, endDaysAgo: 0 },
  { name: 'Period 2', startDaysAgo: 60, endDaysAgo: 30 },
  { name: 'Period 3', startDaysAgo: 90, endDaysAgo: 60 },
];

const initialCapital = 10000;
const feeRate = 0.001;
const slippagePercent = 0.05;

async function runMultiPeriodBacktest() {
  console.log('='.repeat(90));
  console.log('MULTI-PERIOD STRATEGY BACKTEST COMPARISON');
  console.log('='.repeat(90));
  console.log(`\nTesting 4 strategies across 3 different 30-day periods\n`);

  const allResults: Record<string, { period: string; metrics: any }[]> = {
    'SMA Crossover': [],
    'RSI + BB': [],
    'Grid Trading': [],
    'DCA': [],
  };

  for (const period of periods) {
    console.log('\n' + '='.repeat(90));
    console.log(`${period.name}: ${period.startDaysAgo} - ${period.endDaysAgo} days ago`);
    console.log('='.repeat(90));

    const now = Date.now();
    const startTime = now - period.startDaysAgo * 24 * 60 * 60 * 1000;
    const endTime = now - period.endDaysAgo * 24 * 60 * 60 * 1000;

    const marketDataService = new MarketDataService();
    await marketDataService.initialize();

    const orderSimulator = new OrderSimulator();
    const metricsCalculator = new MetricsCalculator();
    const backtestEngine = new BacktestEngine(
      marketDataService,
      orderSimulator,
      metricsCalculator
    );

    // Test each strategy
    for (const [key, strategy] of Object.entries(strategies)) {
      const strategyConfig: StrategyConfig = {
        ...strategy,
        symbol: 'BTC/USDT',
        timeframe: '15m',
        mode: 'backtest',
        status: 'active',
        initialCapital,
        currentCapital: initialCapital,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as StrategyConfig;

      const backtestConfig: BacktestConfig = {
        strategy: strategyConfig,
        symbol: 'BTC/USDT',
        timeframe: '15m',
        startTime,
        endTime,
        initialCapital,
        feeRate,
        slippagePercent,
      };

      console.log(`\n  Testing ${strategy.name}...`);

      try {
        const result = await backtestEngine.runBacktest(backtestConfig);
        
        allResults[strategy.name].push({
          period: period.name,
          metrics: result.metrics,
        });

        console.log(`    P&L: $${result.metrics.totalPnL.toFixed(2)} (${result.metrics.totalPnLPercent.toFixed(2)}%)`);
        console.log(`    Win Rate: ${(result.metrics.winRate * 100).toFixed(2)}%`);
        console.log(`    Trades: ${result.metrics.totalTrades}`);
        console.log(`    Sharpe: ${result.metrics.sharpeRatio.toFixed(2)}`);
        console.log(`    Max DD: ${result.metrics.maxDrawdownPercent.toFixed(2)}%`);
      } catch (error) {
        console.log(`    Error: ${error}`);
      }
    }

    await marketDataService.disconnect();
  }

  // Summary Table
  console.log('\n\n' + '='.repeat(90));
  console.log('SUMMARY COMPARISON TABLE');
  console.log('='.repeat(90));

  const summaryHeaders = ['Strategy', 'Period 1 P&L', 'Period 2 P&L', 'Period 3 P&L', 'Avg P&L', 'Total Trades', 'Avg Win Rate'];
  const colWidths = [15, 14, 14, 14, 12, 13, 12];

  // Print header
  console.log('\n' + summaryHeaders.map((h, i) => h.padEnd(colWidths[i])).join(''));
  console.log('-'.repeat(summaryHeaders.reduce((a, b) => a + b.length, 0) + 10));

  // Calculate and print results for each strategy
  for (const [name, results] of Object.entries(allResults)) {
    const pnlValues = results.map(r => r.metrics.totalPnL);
    const avgPnL = pnlValues.reduce((a, b) => a + b, 0) / pnlValues.length;
    const totalTrades = results.reduce((sum, r) => sum + r.metrics.totalTrades, 0);
    const avgWinRate = results.reduce((sum, r) => sum + r.metrics.winRate, 0) / results.length;

    const row = [
      name,
      `$${results[0]?.metrics.totalPnL.toFixed(2) || 'N/A'}`,
      `$${results[1]?.metrics.totalPnL.toFixed(2) || 'N/A'}`,
      `$${results[2]?.metrics.totalPnL.toFixed(2) || 'N/A'}`,
      `$${avgPnL.toFixed(2)}`,
      totalTrades.toString(),
      `${(avgWinRate * 100).toFixed(2)}%`,
    ];

    console.log(row.map((c, i) => c.padEnd(colWidths[i])).join(''));
  }

  // Determine best strategy
  console.log('\n' + '='.repeat(90));
  console.log('ANALYSIS & RANKING');
  console.log('='.repeat(90));

  const rankings = Object.entries(allResults).map(([name, results]) => {
    const pnlValues = results.map(r => r.metrics.totalPnL);
    const avgPnL = pnlValues.reduce((a, b) => a + b, 0) / pnlValues.length;
    const winRates = results.map(r => r.metrics.winRate);
    const avgWinRate = winRates.reduce((a, b) => a + b, 0) / winRates.length;
    const sharpeValues = results.map(r => r.metrics.sharpeRatio);
    const avgSharpe = sharpeValues.reduce((a, b) => a + b, 0) / sharpeValues.length;
    const totalTrades = results.reduce((sum, r) => sum + r.metrics.totalTrades, 0);

    return {
      name,
      avgPnL,
      avgWinRate,
      avgSharpe,
      totalTrades,
      positivePeriods: pnlValues.filter(p => p > 0).length,
    };
  });

  // Sort by average P&L
  rankings.sort((a, b) => b.avgPnL - a.avgPnL);

  console.log('\nRanking by Average P&L:');
  rankings.forEach((r, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
    console.log(`${medal} ${i + 1}. ${r.name}: Avg P&L $${r.avgPnL.toFixed(2)} (${r.positivePeriods}/3 periods positive)`);
  });

  console.log('\nDetailed Performance:');
  rankings.forEach((r, i) => {
    console.log(`\n  ${i + 1}. ${r.name}`);
    console.log(`     Average P&L: $${r.avgPnL.toFixed(2)}`);
    console.log(`     Average Win Rate: ${(r.avgWinRate * 100).toFixed(2)}%`);
    console.log(`     Average Sharpe Ratio: ${r.avgSharpe.toFixed(2)}`);
    console.log(`     Total Trades: ${r.totalTrades}`);
    console.log(`     Positive Periods: ${r.positivePeriods}/3`);
  });

  // Conclusion
  const best = rankings[0];
  console.log('\n' + '='.repeat(90));
  console.log('CONCLUSION');
  console.log('='.repeat(90));
  console.log(`\n  Best Overall Strategy: ${best.name}`);
  console.log(`  - Average P&L across 3 periods: $${best.avgPnL.toFixed(2)}`);
  console.log(`  - Won ${best.positivePeriods} out of 3 test periods`);
  console.log(`  - Average Win Rate: ${(best.avgWinRate * 100).toFixed(2)}%`);

  // Check consistency
  const consistency = best.positivePeriods >= 2 ? 'CONSISTENT' : 'INCONSISTENT';
  console.log(`  - Consistency: ${consistency}`);
}

runMultiPeriodBacktest().catch(console.error);
