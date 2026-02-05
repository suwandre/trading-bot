/**
 * Strategy related types
 */

import type {
  StrategyType,
  StrategyStatus,
  TradingMode,
  Timeframe,
  SignalType,
} from './common.types';
import type { Candle } from './market.types';
import type { Order } from './order.types';
import type { Position } from './position.types';

// Trading signal
export interface Signal {
  type: SignalType;
  symbol: string;
  quantity?: number;
  price?: number; // For limit orders
  stopLoss?: number;
  takeProfit?: number;
  reason?: string; // Why this signal was generated
  metadata?: Record<string, any>;
}

// Risk parameters
export interface RiskParameters {
  stopLossPercent?: number;
  takeProfitPercent?: number;
  trailingStopPercent?: number;
  maxPositionSize: number; // Max position size in quote currency
  maxOpenPositions: number; // Max concurrent positions
  maxDrawdownPercent: number; // Max allowed drawdown
  positionSizePercent?: number; // % of capital per position
}

// Strategy configuration
export interface StrategyConfig {
  id: string;
  name: string;
  type: StrategyType;
  symbol: string;
  timeframe: Timeframe;
  mode: TradingMode;
  parameters: Record<string, any>; // Strategy-specific params
  riskParams: RiskParameters;
  status: StrategyStatus;
  initialCapital: number;
  currentCapital: number;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  stoppedAt?: Date;
}

// Strategy state (runtime state)
export interface StrategyState {
  lastProcessedCandle?: number;
  indicators?: Record<string, any>;
  customState?: Record<string, any>;
}

// Strategy performance metrics
export interface StrategyMetrics {
  strategyId: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  totalPnLPercent: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  averageTradeDuration: number; // in milliseconds
  currentDrawdown: number;
  currentDrawdownPercent: number;
}

// Strategy interface
export interface IStrategy {
  // Metadata
  readonly id: string;
  readonly name: string;
  readonly type: StrategyType;
  readonly config: StrategyConfig;

  // Lifecycle methods
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;

  // Event handlers
  onCandle(candle: Candle): Promise<Signal[]>;
  onOrderFilled(order: Order): Promise<void>;
  onOrderCancelled(order: Order): Promise<void>;
  onPositionUpdate(position: Position): Promise<void>;
  onError(error: Error): Promise<void>;

  // State management
  getState(): StrategyState;
  setState(state: StrategyState): void;

  // Configuration
  getConfig(): StrategyConfig;
  updateConfig(config: Partial<StrategyConfig>): Promise<void>;

  // Risk parameters
  getRiskParams(): RiskParameters;
  updateRiskParams(params: Partial<RiskParameters>): Promise<void>;

  // Metrics
  getMetrics(): StrategyMetrics;
}

// DCA Strategy Parameters
export interface DCAStrategyParams {
  investmentAmount: number; // Amount to invest per interval
  interval: 'hourly' | 'daily' | 'weekly' | 'monthly' | number; // Or custom in ms
  takeProfitPercent?: number; // Optional take profit
  averageDown?: boolean; // Buy more when price drops
  averageDownPercent?: number; // Price drop % to trigger average down
  maxAverageDowns?: number; // Max number of average downs
}

// Grid Strategy Parameters
export interface GridStrategyParams {
  gridLevels: number; // Number of grid levels
  gridSpacingPercent: number; // Spacing between grids
  upperPrice: number; // Upper bound of grid
  lowerPrice: number; // Lower bound of grid
  quantityPerGrid: number; // Quantity to trade per grid
  reinvestProfits: boolean; // Reinvest profits into grid
}

// Custom Strategy Parameters
export interface CustomStrategyParams {
  [key: string]: any;
}
