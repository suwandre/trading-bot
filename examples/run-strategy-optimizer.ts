/**
 * Strategy Optimization Framework
 * Tests multiple parameter combinations for all strategies using grid search
 */

import { MarketDataService } from '../src/data/market-data.service';
import { OrderSimulator } from '../src/backtesting/order-simulator';
import { MetricsCalculator } from '../src/backtesting/metrics-calculator';
import { BacktestEngine } from '../src/backtesting/backtest-engine';
import type { BacktestConfig, StrategyConfig } from '../src/types';

// ============================================================================
// PARAMETER SEARCH SPACES
// ============================================================================

interface ParameterSpace {
  name: string;
  values: any[];
}

const parameterSpaces = {
  // RSI + Bollinger Bands Parameter Space
  rsiBB: {
    rsiPeriod: [7, 14, 21],
    rsiOversold: [20, 25, 30, 35],
    rsiOverbought: [60, 65, 70, 75],
    bbPeriod: [14, 20, 30],
    bbStdDev: [1.5, 2, 2.5],
    positionSizePercent: [3, 5, 7, 10],
    stopLossPercent: [3, 4, 5, 6],
    takeProfitPercent: [5, 6, 8, 10],
    enableTrendFilter: [true, false],
  },

  // SMA Crossover Parameter Space
  smaCrossover: {
    fastPeriod: [5, 7, 9, 12],
    slowPeriod: [15, 21, 30, 50],
    positionSizePercent: [5, 10, 15],
    stopLossPercent: [2, 3, 4, 5],
    trailingStopPercent: [1.5, 2, 2.5, 3],
    confirmationCandles: [1, 2, 3],
    maxHoldPeriods: [48, 72, 96, 144],
  },

  // DCA Parameter Space
  dca: {
    investmentAmount: [50, 100, 150, 200],
    interval: ['daily', '2days'],
    takeProfitPercent: [5, 8, 10, 15],
    averageDown: [true, false],
    averageDownPercent: [3, 5, 7, 10],
    maxAverageDowns: [2, 3, 5],
  },

  // Grid Trading Parameter Space
  grid: {
    gridLevels: [5, 10, 15, 20],
    gridSpacingPercent: [1, 1.5, 2, 2.5],
    upperPriceOffset: [5, 10, 15, 20],
    lowerPriceOffset: [5, 10, 15, 20],
    reinvestProfits: [true, false],
  },
};

// Generate all combinations for a parameter space
function generateCombinations(obj: Record<string, any[]>, prefix = ''): Record<string, any>[] {
  const keys = Object.keys(obj);
  if (keys.length === 0) return [{}];

  const firstKey = keys[0];
  const restKeys = keys.slice(1);
  const firstValues = obj[firstKey];

  const restCombinations = generateCombinations(
    restKeys.reduce((acc, key) => ({ ...acc, [key]: obj[key] }), {}),
    prefix
  );

  const combinations: Record<string, any>[] = [];

  for (const value of firstValues) {
    for (const rest of restCombinations) {
      combinations.push({ ...rest, [firstKey]: value });
    }
  }

  return combinations;
}

// ============================================================================
// OPTIMIZER CLASS
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
  score: number; // Composite score
}

interface OptimizationReport {
  strategy: string;
  totalCombinations: number;
  bestParams: Record<string, any>;
  bestMetrics: OptimizationResult['metrics'];
  topResults: OptimizationResult[];
  parameterImportance: Record<string, { best: any; worst: any }>;
}

class StrategyOptimizer {
  private marketDataService: MarketDataService;
  private orderSimulator: OrderSimulator;
  private metricsCalculator: MetricsCalculator;
  private backtestEngine: BacktestEngine;
  private results: OptimizationResult[] = [];

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
    console.log('Optimizer initialized');
  }

  // Calculate composite score (higher is better)
  calculateScore(metrics: OptimizationResult['metrics']): number {
    // Weight: P&L (40%), Win Rate (20%), Sharpe (20%), Drawdown (10%), Trades (10%)
    const pnlScore = Math.max(0, metrics.totalPnL) / 100; // Normalize
    const winRateScore = metrics.winRate * 100;
    const sharpeScore = Math.max(0, metrics.sharpeRatio) * 50;
    const drawdownScore = Math.max(0, 10 - metrics.maxDrawdownPercent) * 10;
    const tradeScore = Math.min(metrics.totalTrades / 50, 1) * 100; // Cap at 50 trades

    return (
      pnlScore * 0.4 +
      winRateScore * 0.2 +
      sharpeScore * 0.2 +
      drawdownScore * 0.1 +
      tradeScore * 0.1
    );
  }

  // Run single backtest with given parameters
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
      const score = this.calculateScore(result.metrics);

      return {
        params,
        metrics: result.metrics,
        score,
      };
    } catch (error) {
      return null;
    }
  }

  // Get base configuration for each strategy
  private getBaseConfig(strategyType: string): Partial<StrategyConfig> {
    const configs: Record<string, Partial<StrategyConfig>> = {
      rsiBB: {
        id: 'rsi-bb-optimized',
        name: 'RSI + BB Optimized',
        type: 'mean-reversion',
        symbol: 'BTC/USDT',
        timeframe: '15m',
        mode: 'backtest',
        status: 'active',
        initialCapital: 10000,
        currentCapital: 10000,
        createdAt: new Date(),
        updatedAt: new Date(),
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
      smaCrossover: {
        id: 'sma-crossover-optimized',
        name: 'SMA Crossover Optimized',
        type: 'trend-following',
        symbol: 'BTC/USDT',
        timeframe: '15m',
        mode: 'backtest',
        status: 'active',
        initialCapital: 10000,
        currentCapital: 10000,
        createdAt: new Date(),
        updatedAt: new Date(),
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
      dca: {
        id: 'dca-optimized',
        name: 'DCA Optimized',
        type: 'dca',
        symbol: 'BTC/USDT',
        timeframe: '15m',
        mode: 'backtest',
        status: 'active',
        initialCapital: 10000,
        currentCapital: 10000,
        createdAt: new Date(),
        updatedAt: new Date(),
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
      grid: {
        id: 'grid-optimized',
        name: 'Grid Optimized',
        type: 'grid',
        symbol: 'BTC/USDT',
        timeframe: '15m',
        mode: 'backtest',
        status: 'active',
        initialCapital: 10000,
        currentCapital: 10000,
        createdAt: new Date(),
        updatedAt: new Date(),
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
    };

    return configs[strategyType] || configs.rsiBB;
  }

  // Optimize a single strategy
  async optimizeStrategy(
    strategyType: string,
    combinations: Record<string, any>[],
    startTime: number,
    endTime: number
  ): Promise<OptimizationReport> {
    console.log(`\nOptimizing ${strategyType}...`);
    console.log(`Testing ${combinations.length} parameter combinations...\n`);

    this.results = [];

    for (let i = 0; i < combinations.length; i++) {
      const combo = combinations[i];
      process.stdout.write(`\r  Progress: ${i + 1}/${combinations.length}`);

      const result = await this.runBacktest(strategyType, combo, startTime, endTime);
      if (result) {
        this.results.push(result);
      }
    }

    console.log('\n');

    // Sort by score
    this.results.sort((a, b) => b.score - a.score);

    // Calculate parameter importance
    const importance = this.calculateParameterImportance();

    return {
      strategy: strategyType,
      totalCombinations: combinations.length,
      bestParams: this.results[0]?.params || {},
      bestMetrics: this.results[0]?.metrics || {
        totalPnL: 0,
        totalPnLPercent: 0,
        winRate: 0,
        profitFactor: 0,
        sharpeRatio: 0,
        maxDrawdownPercent: 0,
        totalTrades: 0,
      },
      topResults: this.results.slice(0, 5),
      parameterImportance: importance,
    };
  }

  // Calculate which parameter values work best vs worst
  private calculateParameterImportance(): Record<string, { best: any; worst: any }> {
    const importance: Record<string, { values: Map<any, number[]> }> = {};

    // Group scores by parameter value
    for (const result of this.results) {
      for (const [key, value] of Object.entries(result.params)) {
        if (!importance[key]) {
          importance[key] = { values: new Map() };
        }
        const scores = importance[key].values.get(value) || [];
        scores.push(result.score);
        importance[key].values.set(value, scores);
      }
    }

    // Calculate average score for each value
    const result: Record<string, { best: any; worst: any }> = {};
    for (const [key, data] of Object.entries(importance)) {
      let bestValue: any = null;
      let bestScore = -Infinity;
      let worstValue: any = null;
      let worstScore = Infinity;

      for (const [value, scores] of data.values) {
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        if (avgScore > bestScore) {
          bestScore = avgScore;
          bestValue = value;
        }
        if (avgScore < worstScore) {
          worstScore = avgScore;
          worstValue = value;
        }
      }

      result[key] = { best: bestValue, worst: worstValue };
    }

    return result;
  }

  async cleanup(): Promise<void> {
    await this.marketDataService.disconnect();
  }
}

// ============================================================================
// MAIN OPTIMIZATION RUNNER
// ============================================================================

async function runOptimization() {
  console.log('='.repeat(90));
  console.log('STRATEGY OPTIMIZATION FRAMEWORK');
  console.log('='.repeat(90));
  console.log('\nTesting multiple parameter combinations for each strategy...\n');

  const optimizer = new StrategyOptimizer();
  await optimizer.initialize();

  // Test period (last 30 days)
  const now = Date.now();
  const startTime = now - 30 * 24 * 60 * 60 * 1000;
  const endTime = now;

  const allReports: Record<string, OptimizationReport> = {};

  // Optimize each strategy
  const strategies = [
    { name: 'RSI + BB', type: 'rsiBB', space: parameterSpaces.rsiBB },
    { name: 'SMA Crossover', type: 'smaCrossover', space: parameterSpaces.smaCrossover },
    { name: 'DCA', type: 'dca', space: parameterSpaces.dca },
    { name: 'Grid', type: 'grid', space: parameterSpaces.grid },
  ];

  for (const strategy of strategies) {
    console.log('\n' + '='.repeat(90));
    console.log(`OPTIMIZING: ${strategy.name}`);
    console.log('='.repeat(90));

    const combinations = generateCombinations(strategy.space);
    console.log(`Parameter combinations to test: ${combinations.length}\n`);

    const report = await optimizer.optimizeStrategy(
      strategy.type,
      combinations,
      startTime,
      endTime
    );

    allReports[strategy.name] = report;

    // Print results
    console.log(`\n--- ${strategy.name} Optimization Results ---`);
    console.log(`Total combinations tested: ${report.totalCombinations}`);
    console.log(`\nBest Parameters:`);
    for (const [key, value] of Object.entries(report.bestParams)) {
      console.log(`  ${key}: ${value}`);
    }
    console.log(`\nBest Metrics:`);
    console.log(`  P&L: $${report.bestMetrics.totalPnL.toFixed(2)} (${report.bestMetrics.totalPnLPercent.toFixed(2)}%)`);
    console.log(`  Win Rate: ${(report.bestMetrics.winRate * 100).toFixed(2)}%`);
    console.log(`  Sharpe Ratio: ${report.bestMetrics.sharpeRatio.toFixed(2)}`);
    console.log(`  Max Drawdown: ${report.bestMetrics.maxDrawdownPercent.toFixed(2)}%`);
    console.log(`  Total Trades: ${report.bestMetrics.totalTrades}`);

    console.log(`\nTop 5 Parameter Combinations:`);
    report.topResults.forEach((result, i) => {
      console.log(`  ${i + 1}. Score: ${result.score.toFixed(2)} | P&L: $${result.metrics.totalPnL.toFixed(2)} | Win: ${(result.metrics.winRate * 100).toFixed(0)}%`);
    });
  }

  await optimizer.cleanup();

  // ==========================================================================
  // FINAL SUMMARY
  // ==========================================================================
  console.log('\n\n' + '='.repeat(90));
  console.log('FINAL OPTIMIZATION SUMMARY');
  console.log('='.repeat(90));

  const summary: { name: string; pnl: number; winRate: number; sharpe: number; trades: number }[] = [];

  for (const [name, report] of Object.entries(allReports)) {
    summary.push({
      name,
      pnl: report.bestMetrics.totalPnL,
      winRate: report.bestMetrics.winRate,
      sharpe: report.bestMetrics.sharpeRatio,
      trades: report.bestMetrics.totalTrades,
    });
  }

  // Sort by P&L
  summary.sort((a, b) => b.pnl - a.pnl);

  console.log('\nRanking by P&L:');
  summary.forEach((s, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
    console.log(`${medal} ${i + 1}. ${s.name}: P&L $${s.pnl.toFixed(2)} | Win: ${(s.winRate * 100).toFixed(0)}% | Sharpe: ${s.sharpe.toFixed(2)}`);
  });

  console.log('\n' + '='.repeat(90));
  console.log('BEST PARAMETERS FOR EACH STRATEGY');
  console.log('='.repeat(90));

  for (const [name, report] of Object.entries(allReports)) {
    console.log(`\n${name}:`);
    const params = report.bestParams;
    if (Object.keys(params).length > 0) {
      for (const [key, value] of Object.entries(params)) {
        console.log(`  ${key}: ${value}`);
      }
    } else {
      console.log('  No successful combinations');
    }
  }

  console.log('\n' + '='.repeat(90));
  console.log('OPTIMIZATION COMPLETE');
  console.log('='.repeat(90));
}

runOptimization().catch(console.error);
