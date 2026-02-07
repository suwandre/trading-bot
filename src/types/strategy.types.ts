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

// Smart DCA Strategy Parameters
export interface DCAStrategyParams {
  investmentAmount: number;           // Base amount to invest per interval
  interval: 'hourly' | 'daily' | 'weekly' | 'monthly' | number; // Or custom in ms
  takeProfitPercent: number;          // Take profit target % (5)
  
  // Average Down (buy more when price drops)
  averageDown: boolean;               // Enable average down
  averageDownPercent: number;         // Price drop % to trigger (5)
  maxAverageDowns: number;            // Max number of average downs (3)
  averageDownScaling: number;         // Multiply amount by this per level (1.5)
  
  // Market Awareness — pause buying in crashes
  enableCrashDetection: boolean;      // Default: true
  crashRSIPeriod: number;             // RSI period for crash detection (14)
  crashRSIThreshold: number;          // Pause if RSI < this (25)
  crashSMAPeriod: number;             // SMA period for crash detection (200)
  crashSMADropPercent: number;        // Pause if price < SMA * (1 - this/100) (10)
  
  // Partial Take Profit
  enablePartialTakeProfit: boolean;   // Default: true
  partialTakeProfitPercent: number;   // Sell this % at first target (50)
  trailingStopPercent: number;        // Trail remaining position at this % (2)
  
  // Investment Limits
  maxTotalInvestment: number;         // Max total investment amount (0 = unlimited)
  
  // Dip Buying Enhancement
  enableDipBuying: boolean;           // Default: true — buy extra on RSI oversold
  dipRSIThreshold: number;            // Buy extra when RSI < this (35)
  dipBuyMultiplier: number;           // Multiply investmentAmount by this on dips (1.5)
}

// Adaptive Grid Strategy Parameters (v3)
export interface GridStrategyParams {
  // Grid Structure
  gridLevels: number;               // Number of grid levels (10-20, default: 20)
  gridSpacingPercent: number;       // Spacing between grids as % (0.5-2, default: 0.5)

  // Adaptive Grid — auto-centers on current price
  useAdaptiveGrid: boolean;         // Default: true — auto-calculate upper/lower from ATR
  atrPeriod: number;                // ATR period for grid spacing (14)
  atrGridMultiplier: number;        // Grid range = ATR * this * gridLevels (0.2-0.5, default: 0.2)
  recenterThreshold: number;        // Recenter when price moves this many grid spacings from center (2)

  // Static Grid (fallback if useAdaptiveGrid is false)
  upperPrice: number;               // Upper bound of grid
  lowerPrice: number;               // Lower bound of grid

  // Position Sizing
  quantityPerGrid: number;          // Quantity to trade per grid level
  maxPositionsPerSide: number;      // Max buy positions at once (5-10, default: 8)
  positionSizePercent: number;      // % of capital per grid level (3-10, default: 5)

  // Risk Management
  stopLossATRMultiplier: number;    // Close all if price drops below lowest grid - ATR * this (2-4, default: 3)
  enableStopLoss: boolean;          // Default: true

  // ADX Regime Filter — only trade in ranging markets
  adxPeriod: number;                // ADX period (14)
  adxMaxThreshold: number;          // Only trade when ADX < this (20-30, default: 25)
  enableADXFilter: boolean;         // Default: true

  // Profit Management
  reinvestProfits: boolean;         // Reinvest profits into grid
  reinvestPercent: number;          // % of profits to reinvest (50)

  // v3: Multi-level Trading
  levelsPerBuy: number;             // How many lower grid levels to buy at once (1-5, default: 3)
  levelsToSellAbove: number;       // How many levels above to trigger take profit (1-3, default: 2)

  // v3: Trailing Stop
  enableTrailingStop: boolean;      // Enable trailing stop to lock in profits (default: true)
  trailingStopPercent: number;      // Trailing stop distance in % (0.5-2, default: 1)
}

// Custom Strategy Parameters
export interface CustomStrategyParams {
  [key: string]: any;
}

// Mean Reversion Strategy Parameters (RSI + Bollinger Bands + ADX)
export interface MeanReversionParams {
  // RSI Parameters
  rsiPeriod: number;              // Default: 14
  rsiOversold: number;            // Default: 30 — buy below this
  rsiOverbought: number;          // Default: 70 — sell above this
  rsiPartialExitLevel: number;    // Default: 55 — sell half at this RSI level
  
  // Bollinger Bands Parameters
  bbPeriod: number;               // Default: 20
  bbStdDev: number;               // Default: 2
  
  // ATR Parameters for dynamic stop loss (uses real OHLC data)
  atrPeriod: number;              // Default: 14
  atrStopMultiplier: number;      // Default: 2.0 — stop loss = entry - ATR * this
  atrTrailMultiplier: number;     // Default: 1.5 — trailing stop = price - ATR * this
  
  // ADX Regime Filter — only trade in ranging markets
  adxPeriod: number;              // Default: 14
  adxMaxThreshold: number;        // Default: 25 — only trade when ADX < this
  enableADXFilter: boolean;       // Default: true
  
  // Volume Confirmation
  volumeMAPeriod: number;         // Default: 20
  volumeSpikeMultiplier: number;  // Default: 1.5 — volume must be > avg * this
  enableVolumeFilter: boolean;    // Default: true
  
  // Trading Parameters
  positionSizePercent: number;    // % of capital per trade (5-10)
  stopLossPercent: number;        // Fallback fixed stop loss % (2)
  takeProfitPercent: number;      // Fallback fixed take profit % (3)
  
  // Partial Exit — sell half at middle BB, rest at upper BB
  enablePartialExit: boolean;     // Default: true
  partialExitPercent: number;     // Default: 50 — sell this % at first target
  
  // Filters
  minDropPercent: number;         // Min price drop before buying (2)
  confirmationCandles: number;    // Confirmation candles (1)
  cooldownCandles: number;        // Min candles between trades (3)
  maxHoldCandles: number;         // Max candles to hold position (96 = 24h on 15m)
  
  // Trend Filter Parameters
  smaPeriod?: number;             // SMA period for trend filter (200)
  enableTrendFilter?: boolean;    // Enable trend filter — buy dips in uptrends (false)
}

// Trend Following Strategy Parameters (EMA + MACD + ADX)
export interface TrendFollowingParams {
  // EMA Parameters
  fastEMAPeriod: number;          // Fast EMA period (12)
  slowEMAPeriod: number;          // Slow EMA period (26)
  trendEMAPeriod: number;         // Medium-term trend EMA (50)

  // MACD Parameters
  macdFastPeriod: number;         // MACD fast period (12)
  macdSlowPeriod: number;         // MACD slow period (26)
  macdSignalPeriod: number;       // MACD signal period (9)

  // ADX Regime Filter — only trade in trending markets
  adxPeriod: number;              // ADX period (14)
  adxMinThreshold: number;        // Only trade when ADX > this (25)
  enableADXFilter: boolean;       // Default: true

  // ATR for dynamic stops (uses real OHLC data)
  atrPeriod: number;              // ATR period (14)
  atrStopMultiplier: number;      // Stop loss = entry - ATR * this (2.0)
  atrTrailMultiplier: number;     // Trailing stop = price - ATR * this (3.0)

  // Volume Confirmation
  volumeMAPeriod: number;         // Volume MA period (20)
  volumeSpikeMultiplier: number;  // Volume must be > avg * this (1.2)
  enableVolumeFilter: boolean;    // Default: true

  // Trading Parameters
  positionSizePercent: number;    // % of capital per trade (7-10)
  stopLossPercent: number;        // Fallback fixed stop loss % (5)

  // Exit Parameters
  confirmationCandles: number;    // Candles below EMA before exit (2)
  maxHoldCandles: number;         // Max candles to hold (192 = 48h on 15m)
  cooldownCandles: number;        // Min candles between trades (5)
}
