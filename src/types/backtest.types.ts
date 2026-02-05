/**
 * Backtesting related types
 */

import type { Timeframe } from './common.types';
import type { StrategyConfig, StrategyMetrics } from './strategy.types';
import type { Trade } from './trade.types';

// Backtest configuration
export interface BacktestConfig {
  strategy: StrategyConfig;
  symbol: string;
  timeframe: Timeframe;
  startTime: number;
  endTime: number;
  initialCapital: number;
  feeRate: number; // e.g., 0.001 for 0.1%
  slippagePercent: number; // e.g., 0.05 for 0.05%
}

// Equity point for equity curve
export interface EquityPoint {
  timestamp: number;
  equity: number;
}

// Drawdown point
export interface DrawdownPoint {
  timestamp: number;
  drawdown: number;
  drawdownPercent: number;
}

// Backtest result
export interface BacktestResult {
  config: BacktestConfig;
  metrics: StrategyMetrics;
  trades: Trade[];
  equity: EquityPoint[];
  drawdown: DrawdownPoint[];
  duration: number; // Backtest execution time in ms
  candlesProcessed: number;
}

// Backtest progress
export interface BacktestProgress {
  currentTimestamp: number;
  totalCandles: number;
  processedCandles: number;
  percentComplete: number;
  estimatedTimeRemaining: number;
}

// Backtest engine interface
export interface IBacktestEngine {
  runBacktest(config: BacktestConfig): Promise<BacktestResult>;
  pauseBacktest(): void;
  resumeBacktest(): void;
  stopBacktest(): void;
  getProgress(): BacktestProgress;
}
