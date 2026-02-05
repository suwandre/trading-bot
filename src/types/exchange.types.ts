/**
 * Exchange provider related types
 */

import type { Timeframe, ExchangeProvider } from './common.types';
import type { Candle, Ticker, TradingPair } from './market.types';
import type { Order, CreateOrderRequest } from './order.types';

// Exchange provider interface
export interface IExchangeProvider {
  readonly name: ExchangeProvider;

  // Connection
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Market data
  getCandles(
    symbol: string,
    timeframe: Timeframe,
    limit?: number,
    since?: number
  ): Promise<Candle[]>;
  getTicker(symbol: string): Promise<Ticker>;
  getTradingPair(symbol: string): Promise<TradingPair>;

  // Orders (live trading only)
  createOrder(request: CreateOrderRequest): Promise<Order>;
  cancelOrder(orderId: string): Promise<void>;
  getOrder(orderId: string): Promise<Order>;
  getOpenOrders(symbol?: string): Promise<Order[]>;

  // Account (live trading only)
  getBalance(asset: string): Promise<number>;
  getBalances(): Promise<Record<string, number>>;

  // WebSocket streams (optional)
  subscribeTicker?(symbol: string, callback: (ticker: Ticker) => void): void;
  subscribeCandles?(
    symbol: string,
    timeframe: Timeframe,
    callback: (candle: Candle) => void
  ): void;
  unsubscribe?(symbol: string): void;
}

// Exchange configuration
export interface ExchangeConfig {
  name: ExchangeProvider;
  apiKey?: string;
  apiSecret?: string;
  testnet?: boolean;
  options?: Record<string, any>;
}
