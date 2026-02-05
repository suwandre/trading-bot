/**
 * Base Exchange Provider
 * Abstract class that all exchange providers extend
 */

import type {
  IExchangeProvider,
  ExchangeProvider,
  Timeframe,
  Candle,
  Ticker,
  TradingPair,
  Order,
  CreateOrderRequest,
} from '../../types';
import { ExchangeError } from '../../utils/errors';
import { createLogger } from '../../utils/logger';

export abstract class BaseExchangeProvider implements IExchangeProvider {
  protected connected: boolean = false;
  protected logger;

  constructor(public readonly name: ExchangeProvider) {
    this.logger = createLogger(`${name}Provider`);
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;

  isConnected(): boolean {
    return this.connected;
  }

  // Market data methods
  abstract getCandles(
    symbol: string,
    timeframe: Timeframe,
    limit?: number,
    since?: number
  ): Promise<Candle[]>;

  abstract getTicker(symbol: string): Promise<Ticker>;
  abstract getTradingPair(symbol: string): Promise<TradingPair>;

  // Order methods (for live trading)
  abstract createOrder(request: CreateOrderRequest): Promise<Order>;
  abstract cancelOrder(orderId: string): Promise<void>;
  abstract getOrder(orderId: string): Promise<Order>;
  abstract getOpenOrders(symbol?: string): Promise<Order[]>;

  // Account methods (for live trading)
  abstract getBalance(asset: string): Promise<number>;
  abstract getBalances(): Promise<Record<string, number>>;

  /**
   * Ensure provider is connected before operations
   */
  protected ensureConnected(): void {
    if (!this.connected) {
      throw new ExchangeError(`${this.name} provider is not connected`, this.name);
    }
  }

  /**
   * Convert timeframe to exchange-specific format
   */
  protected abstract convertTimeframe(timeframe: Timeframe): string;

  /**
   * Parse symbol to exchange format
   */
  protected parseSymbol(symbol: string): string {
    // Default: remove slash (BTC/USDT -> BTCUSDT)
    return symbol.replace('/', '');
  }

  /**
   * Format symbol from exchange format
   */
  protected formatSymbol(symbol: string): string {
    // This should be overridden by specific providers if needed
    return symbol;
  }
}
