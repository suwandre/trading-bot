/**
 * Fast Strategy Optimizer using Random Sampling
 * Tests 500 random parameter combinations per strategy for quick results
 */

import { MarketDataService } from '../src/data/market-data.service';
import { OrderSimulator } from '../src/backtesting/order-simulator';
import { MetricsCalculator } from '../src/backtesting/metrics-calculator';
import { BacktestEngine } from '../src/backtesting/backtest-engine';
import type { BacktestConfig, StrategyConfig } from '../src/types';

// Sample size per strategy
const SAMPLE_SIZE = 500;

// ============================================================================
// PARAMETER SEARCH SPACES (Reduced for faster testing)
// ============================================================================

interface ParamRange {
  name: string;
  values: any[];
}

const parameterSpaces: Record<string, { ranges: ParamRange[]; base: Record<string, any> }> = {
  rsiBB: {
    ranges: [
      { name: 'rsiPeriod', values: [7, 14, 21] },
      { name: 'rsiOversold', values: [20, 25, 30] },
      { name: 'rsiOverbought', values: [60, 65, 70] },
      { name: 'bbPeriod', values: [14, 20] },
      { name: 'bbStdDev', values: [1.5, 2, 2.5] },
      { name: 'positionSizePercent', values: [3, 5, 7] },
      { name: 'stopLossPercent', values: [3, 4, 5] },
      { name: 'takeProfitPercent', values: [5, 6, 8, 10] },
      { name: 'enableTrendFilter', values: [true, false] },
    ],
    base: { rsiPeriod: 14, rsiOversold: 25, rsiOverbought: 65, bbPeriod: 20, bbStdDev: 2, atrPeriod: 14, positionSizePercent: 5, stopLossPercent: 4, trailingStopPercent: 2, takeProfitPercent: 6, minDropPercent: 3, confirmationCandles: 2, smaPeriod: 200, enableTrendFilter: true }
  },
  smaCrossover: {
    ranges: [
      { name: 'fastPeriod', values: [5, 9, 12, 21] },
      { name: 'slowPeriod', values: [15, 21, 50] },
      { name: 'positionSizePercent', values: [5, 10, 15] },
      { name: 'stopLossPercent', values: [2, 3, 4] },
      { name: 'trailingStopPercent', values: [1.5, 2, 2.5] },
      { name: 'confirmationCandles', values: [1, 2] },
    ],
    base: { fastPeriod: 9, slowPeriod: 21, positionSizePercent: 10, stopLossPercent: 3, trailingStopPercent: 2.5, confirmationCandles: 1, maxHoldPeriods: 96 }
  },
  dca: {
    ranges: [
      { name: 'investmentAmount', values: [50, 100, 150] },
      { name: 'takeProfitPercent', values: [5, 8, 10] },
      { name: 'averageDown', values: [true, false] },
      { name: 'averageDownPercent', values: [3, 5, 7] },
      { name: 'maxAverageDowns', values: [2, 3, 5] },
    ],
    base: { investmentAmount: 100, interval: 'daily', takeProfitPercent: 10, averageDown: true, averageDownPercent: 5, maxAverageDowns: 3 }
  },
  grid: {
    ranges: [
      { name: 'gridLevels', values: [5, 10, 15] },
      { name: 'gridSpacingPercent', values: [1, 1.5, 2] },
      { name: 'upperPriceOffset', values: [5, 10, 15] },
      { name: 'lowerPriceOffset', values: [5, 10, 15] },
      { name: 'reinvestProfits', values: [true, false] },
    ],
    base: { gridLevels: 10, gridSpacingPercent: 1.5, upperPriceOffset: 10, lowerPriceOffset: 10, quantityPerGrid: 'equal', reinvestProfits: true }
  },
};

// Generate random sample from parameter space
function generateRandomParams(space: { ranges: ParamRange[]; base: Record<string, any> }): Record<string, any> {
  const params: Record<string, any> = { ...space.base };
  
  for (const range of space.ranges) {
    params[range.name] = range.values[Math.floor(Math.random() * range.values.length)];
  }
  
  return params;
}

// ============================================================================
// OPTIMIZER
// ============================================================================

interface OptimizationResult {
  params: Record<string, any>;
  metrics: {
    totalPnL: number;
    totalPnLPercent: number;
    winRate: number;
    profitFactor: number;
    sharpeRatio: number;
    maxDrawdownPercent: number;
    totalTrades: number;
  };
  score: number;
}

class FastOptimizer {
  private marketDataService: MarketDataService;
  private orderSimulator: OrderSimulator;
  private metricsCalculator: MetricsCalculator;
  private backtestEngine: BacktestEngine;

  constructor() {
    this.marketDataService = new MarketDataService();
    this.orderSimulator = new OrderSimulator();
    this.metricsCalculator = new MetricsCalculator();
    this.backtestEngine = new BacktestEngine(
      this.marketDataService,
      this.orderSimulator,
      this.metricsCalculator
    );
  }

  async initialize(): Promise<void> {
    await this.marketDataService.initialize();
  }

  calculateScore(metrics: OptimizationResult['metrics']): number {
    const pnlScore = Math.max(0, metrics.totalPnL) / 100;
    const winRateScore = metrics.winRate * 100;
    const sharpeScore = Math.max(0, metrics.sharpeRatio) * 50;
    const drawdownScore = Math.max(0, 10 - metrics.maxDrawdownPercent) * 10;
    const tradeScore = Math.min(metrics.totalTrades / 50, 1) * 100;

    return pnlScore * 0.4 + winRateScore * 0.2 + sharpeScore * 0.2 + drawdownScore * 0.1 + tradeScore * 0.1;
  }

  async runBacktest(
    strategyType: string,
    params: Record<string, any>,
    startTime: number,
    endTime: number
  ): Promise<OptimizationResult | null> {
    const baseConfig = this.getBaseConfig(strategyType);
    const strategyConfig = {
      ...baseConfig,
      id: `${strategyType}-optimized`,
      name: `${strategyType} Optimized`,
      parameters: { ...baseConfig.parameters, ...params },
    } as StrategyConfig;

    const backtestConfig: BacktestConfig = {
      strategy: strategyConfig,
      symbol: 'BTC/USDT',
      timeframe: '15m',
      startTime,
      endTime,
      initialCapital: 10000,
      feeRate: 0.001,
      slippagePercent: 0.05,
    };

    try {
      const result = await this.backtestEngine.runBacktest(backtestConfig);
      return {
        params,
        metrics: result.metrics,
        score: this.calculateScore(result.metrics),
      };
    } catch {
      return null;
    }
  }

  private getBaseConfig(strategyType: string): Partial<StrategyConfig> {
    const configs: Record<string, Partial<StrategyConfig>> = {
      rsiBB: {
        id: 'rsi-bb-optimized', name: 'RSI + BB Optimized', type: 'mean-reversion',
        symbol: 'BTC/USDT', timeframe: '15m', mode: 'backtest', status: 'active',
        initialCapital: 10000, currentCapital: 10000, createdAt: new Date(), updatedAt: new Date(),
        parameters: { rsiPeriod: 14, rsiOversold: 25, rsiOverbought: 65, bbPeriod: 20, bbStdDev: 2, atrPeriod: 14, positionSizePercent: 5, stopLossPercent: 4, trailingStopPercent: 2, takeProfitPercent: 6, minDropPercent: 3, confirmationCandles: 2, smaPeriod: 200, enableTrendFilter: true },
        riskParams: { stopLossPercent: 4, takeProfitPercent: 6, trailingStopPercent: 2, maxPositionSize: 500, maxOpenPositions: 2, maxDrawdownPercent: 15, positionSizePercent: 5 },
      },
      smaCrossover: {
        id: 'sma-crossover-optimized', name: 'SMA Crossover Optimized', type: 'trend-following',
        symbol: 'BTC/USDT', timeframe: '15m', mode: 'backtest', status: 'active',
        initialCapital: 10000, currentCapital: 10000, createdAt: new Date(), updatedAt: new Date(),
        parameters: { fastPeriod: 9, slowPeriod: 21, positionSizePercent: 10, stopLossPercent: 3, trailingStopPercent: 2.5, confirmationCandles: 1, maxHoldPeriods: 96 },
        riskParams: { stopLossPercent: 3, trailingStopPercent: 2.5, maxPositionSize: 1000, maxOpenPositions: 2, maxDrawdownPercent: 15, positionSizePercent: 10 },
      },
      dca: {
        id: 'dca-optimized', name: 'DCA Optimized', type: 'dca',
        symbol: 'BTC/USDT', timeframe: '15m', mode: 'backtest', status: 'active',
        initialCapital: 10000, currentCapital: 10000, createdAt: new Date(), updatedAt: new Date(),
        parameters: { investmentAmount: 100, interval: 'daily', takeProfitPercent: 10, averageDown: true, averageDownPercent: 5, maxAverageDowns: 3 },
        riskParams: { stopLossPercent: 15, maxPositionSize: 5000, maxOpenPositions: 1, maxDrawdownPercent: 20 },
      },
      grid: {
        id: 'grid-optimized', name: 'Grid Optimized', type: 'grid',
        symbol: 'BTC/USDT', timeframe: '15m', mode: 'backtest', status: 'active',
        initialCapital: 10000, currentCapital: 10000, createdAt: new Date(), updatedAt: new Date(),
        parameters: { gridLevels: 10, gridSpacingPercent: 1.5, upperPriceOffset: 10, lowerPriceOffset: 10, quantityPerGrid: 'equal', reinvestProfits: true },
        riskParams: { maxPositionSize: 10000, maxOpenPositions: 1, maxDrawdownPercent: 15 },
      },
    };
    return configs[strategyType] || configs.rsiBB;
  }

  async optimize(strategyType: string, space: { ranges: ParamRange[]; base: Record<string, any> }, startTime: number, endTime: number): Promise<OptimizationResult[]> {
    const results: OptimizationResult[] = [];

    for (let i = 0; i < SAMPLE_SIZE; i++) {
      process.stdout.write(`\r  Testing: ${i + 1}/${SAMPLE_SIZE}`);
      const params = generateRandomParams(space);
      const result = await this.runBacktest(strategyType, params, startTime, endTime);
      if (result) results.push(result);
    }
    console.log('');

    return results.sort((a, b) => b.score - a.score);
  }

  async cleanup(): Promise<void> {
    await this.marketDataService.disconnect();
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function runFastOptimization() {
  console.log('='.repeat(90));
  console.log('FAST STRATEGY OPTIMIZER (Random Sampling)');
  console.log(`Testing ${SAMPLE_SIZE} random combinations per strategy`);
  console.log('='.repeat(90));

  const optimizer = new FastOptimizer();
  await optimizer.initialize();

  const now = Date.now();
  const startTime = now - 30 * 24 * 60 * 60 * 1000;
  const endTime = now;

  const allResults: Record<string, OptimizationResult[]> = {};
  const strategies = [
    { name: 'RSI + BB', type: 'rsiBB', space: parameterSpaces.rsiBB },
    { name: 'SMA Crossover', type: 'smaCrossover', space: parameterSpaces.smaCrossover },
    { name: 'DCA', type: 'dca', space: parameterSpaces.dca },
    { name: 'Grid', type: 'grid', space: parameterSpaces.grid },
  ];

  for (const s of strategies) {
    console.log(`\n--- Optimizing ${s.name} ---`);
    const results = await optimizer.optimize(s.type, s.space, startTime, endTime);
    allResults[s.name] = results;

    if (results.length > 0) {
      const best = results[0];
      console.log(`\n  Best Result for ${s.name}:`);
      console.log(`    P&L: $${best.metrics.totalPnL.toFixed(2)} (${best.metrics.totalPnLPercent.toFixed(2)}%)`);
      console.log(`    Win Rate: ${(best.metrics.winRate * 100).toFixed(2)}%`);
      console.log(`    Sharpe: ${best.metrics.sharpeRatio.toFixed(2)}`);
      console.log(`    Max DD: ${best.metrics.maxDrawdownPercent.toFixed(2)}%`);
      console.log(`    Trades: ${best.metrics.totalTrades}`);
      console.log(`    Best Params: ${JSON.stringify(best.params)}`);
    }
  }

  await optimizer.cleanup();

  // ==========================================================================
  // SUMMARY
  // ==========================================================================
  console.log('\n\n' + '='.repeat(90));
  console.log('FINAL RANKING (by Best P&L)');
  console.log('='.repeat(90));

  const rankings = Object.entries(allResults)
    .map(([name, results]) => ({
      name,
      bestPnL: results[0]?.metrics.totalPnL || 0,
      avgWinRate: results.reduce((sum, r) => sum + r.metrics.winRate, 0) / results.length,
      bestParams: results[0]?.params || {},
    }))
    .sort((a, b) => b.bestPnL - a.bestPnL);

  rankings.forEach((r, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
    console.log(`${medal} ${i + 1}. ${r.name}: Best P&L $${r.bestPnL.toFixed(2)} | Avg Win Rate ${(r.avgWinRate * 100).toFixed(1)}%`);
  });

  console.log('\n' + '='.repeat(90));
  console.log('BEST PARAMETERS FOR EACH STRATEGY');
  console.log('='.repeat(90));

  for (const r of rankings) {
    console.log(`\n${r.name}:`);
    console.log(JSON.stringify(r.bestParams, null, 2));
  }
}

runFastOptimization().catch(console.error);
