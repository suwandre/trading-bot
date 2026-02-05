/**
 * Binance Exchange Provider
 * Used primarily for fetching historical data for backtesting
 */

import ccxt from 'ccxt';
import type {
  Timeframe,
  Candle,
  Ticker,
  TradingPair,
  Order,
  CreateOrderRequest,
} from '../../types';
import { BaseExchangeProvider } from './base-provider';
import { ExchangeError } from '../../utils/errors';
import { appConfig } from '../../config/app.config';

export class BinanceProvider extends BaseExchangeProvider {
  private exchange: ccxt.binance;

  constructor() {
    super('binance');
    
    this.exchange = new ccxt.binance({
      apiKey: appConfig.binanceApiKey,
      secret: appConfig.binanceApiSecret,
      enableRateLimit: true,
      options: {
        defaultType: 'spot',
        adjustForTimeDifference: true,
      },
    });

    if (appConfig.binanceTestnet) {
      this.exchange.setSandboxMode(true);
    }
  }

  async connect(): Promise<void> {
    try {
      this.logger.info('Connecting to Binance...');
      await this.exchange.loadMarkets();
      this.connected = true;
      this.logger.info('Connected to Binance successfully');
    } catch (error) {
      this.logger.error('Failed to connect to Binance', { error });
      throw new ExchangeError(
        `Failed to connect to Binance: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'binance'
      );
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.logger.info('Disconnected from Binance');
  }

  async getCandles(
    symbol: string,
    timeframe: Timeframe,
    limit: number = 500,
    since?: number
  ): Promise<Candle[]> {
    this.ensureConnected();

    try {
      const ccxtTimeframe = this.convertTimeframe(timeframe);
      const ccxtSymbol = symbol; // CCXT uses BTC/USDT format

      this.logger.debug('Fetching candles', { symbol, timeframe, limit, since });

      const ohlcv = await this.exchange.fetchOHLCV(
        ccxtSymbol,
        ccxtTimeframe,
        since,
        limit
      );

      const candles: Candle[] = ohlcv.map((data) => ({
        timestamp: data[0],
        open: data[1],
        high: data[2],
        low: data[3],
        close: data[4],
        volume: data[5],
      }));

      this.logger.debug('Candles fetched successfully', {
        symbol,
        count: candles.length,
      });

      return candles;
    } catch (error) {
      this.logger.error('Failed to fetch candles', { symbol, timeframe, error });
      throw new ExchangeError(
        `Failed to fetch candles from Binance: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'binance'
      );
    }
  }

  async getTicker(symbol: string): Promise<Ticker> {
    this.ensureConnected();

    try {
      const ticker = await this.exchange.fetchTicker(symbol);

      return {
        symbol,
        bid: ticker.bid || 0,
        ask: ticker.ask || 0,
        last: ticker.last || 0,
        volume: ticker.baseVolume || 0,
        timestamp: ticker.timestamp || Date.now(),
      };
    } catch (error) {
      this.logger.error('Failed to fetch ticker', { symbol, error });
      throw new ExchangeError(
        `Failed to fetch ticker from Binance: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'binance'
      );
    }
  }

  async getTradingPair(symbol: string): Promise<TradingPair> {
    this.ensureConnected();

    try {
      const market = this.exchange.market(symbol);

      return {
        symbol,
        base: market.base,
        quote: market.quote,
        minOrderSize: market.limits.amount?.min || 0,
        maxOrderSize: market.limits.amount?.max || Number.MAX_SAFE_INTEGER,
        pricePrecision: market.precision.price || 8,
        quantityPrecision: market.precision.amount || 8,
      };
    } catch (error) {
      this.logger.error('Failed to fetch trading pair', { symbol, error });
      throw new ExchangeError(
        `Failed to fetch trading pair from Binance: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'binance'
      );
    }
  }

  // Order methods (not typically used for backtesting, but required by interface)
  async createOrder(request: CreateOrderRequest): Promise<Order> {
    throw new Error('Order creation not supported in Binance provider (backtesting mode)');
  }

  async cancelOrder(orderId: string): Promise<void> {
    throw new Error('Order cancellation not supported in Binance provider (backtesting mode)');
  }

  async getOrder(orderId: string): Promise<Order> {
    throw new Error('Get order not supported in Binance provider (backtesting mode)');
  }

  async getOpenOrders(symbol?: string): Promise<Order[]> {
    throw new Error('Get open orders not supported in Binance provider (backtesting mode)');
  }

  async getBalance(asset: string): Promise<number> {
    throw new Error('Get balance not supported in Binance provider (backtesting mode)');
  }

  async getBalances(): Promise<Record<string, number>> {
    throw new Error('Get balances not supported in Binance provider (backtesting mode)');
  }

  protected convertTimeframe(timeframe: Timeframe): string {
    const timeframeMap: Record<Timeframe, string> = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '30m': '30m',
      '1h': '1h',
      '4h': '4h',
      '1d': '1d',
      '1w': '1w',
    };

    return timeframeMap[timeframe];
  }

  /**
   * Fetch historical candles in batches for large date ranges
   */
  async fetchHistoricalCandles(
    symbol: string,
    timeframe: Timeframe,
    startTime: number,
    endTime: number
  ): Promise<Candle[]> {
    this.ensureConnected();

    const allCandles: Candle[] = [];
    const limit = 1000; // Binance max limit
    let currentTime = startTime;

    this.logger.info('Fetching historical candles in batches', {
      symbol,
      timeframe,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
    });

    while (currentTime < endTime) {
      const candles = await this.getCandles(symbol, timeframe, limit, currentTime);

      if (candles.length === 0) {
        break;
      }

      // Filter candles within the requested range
      const filteredCandles = candles.filter(
        (c) => c.timestamp >= startTime && c.timestamp <= endTime
      );

      allCandles.push(...filteredCandles);

      // Move to next batch
      const lastCandle = candles[candles.length - 1];
      currentTime = lastCandle.timestamp + 1;

      // Avoid hitting rate limits
      await this.sleep(100);

      this.logger.debug('Batch fetched', {
        batchSize: candles.length,
        totalFetched: allCandles.length,
      });
    }

    this.logger.info('Historical candles fetched successfully', {
      symbol,
      totalCandles: allCandles.length,
    });

    return allCandles;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
