/**
 * Market data related types
 */

import type { Timeframe } from './common.types';

// OHLCV Candle
export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Trading pair
export interface TradingPair {
  symbol: string; // e.g., "BTC/USDT"
  base: string; // e.g., "BTC"
  quote: string; // e.g., "USDT"
  minOrderSize: number;
  maxOrderSize: number;
  pricePrecision: number;
  quantityPrecision: number;
}

// Market ticker
export interface Ticker {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  timestamp: number;
}

// Historical data request
export interface HistoricalDataRequest {
  symbol: string;
  timeframe: Timeframe;
  startTime: number;
  endTime: number;
  limit?: number;
}
