/**
 * Common types used throughout the trading bot
 */

// Timeframe options
export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';

// Trading mode
export type TradingMode = 'backtest' | 'paper' | 'live';

// Strategy type
export type StrategyType = 'dca' | 'grid' | 'custom' | 'mean-reversion' | 'trend-following';

// Strategy status
export type StrategyStatus = 'active' | 'paused' | 'stopped' | 'error';

// Order side
export type OrderSide = 'buy' | 'sell';

// Order type
export type OrderType = 'market' | 'limit' | 'stop_loss' | 'take_profit';

// Order status
export type OrderStatus =
  | 'pending'
  | 'open'
  | 'filled'
  | 'partially_filled'
  | 'cancelled'
  | 'rejected'
  | 'expired';

// Position side
export type PositionSide = 'long' | 'short';

// Position status
export type PositionStatus = 'open' | 'closed';

// Signal type
export type SignalType = 'buy' | 'sell' | 'close_long' | 'close_short' | 'hold';

// Log level
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Exchange provider name
export type ExchangeProvider = 'binance' | 'mexc';
