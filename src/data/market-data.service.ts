/**
 * Market Data Service
 * Coordinates data fetching from different providers with caching
 */

import type {
  Candle,
  Ticker,
  TradingPair,
  Timeframe,
  ExchangeProvider,
  IExchangeProvider,
} from '../types';
import { BinanceProvider } from './providers/binance-provider';
import { MEXCProvider } from './providers/mexc-provider';
import { CacheService } from './cache.service';
import { ExchangeError } from '../utils/errors';
import { createLogger } from '../utils/logger';

const logger = createLogger('MarketDataService');

export class MarketDataService {
  private providers: Map<ExchangeProvider, IExchangeProvider> = new Map();
  private cache: CacheService;
  private defaultProvider: ExchangeProvider = 'binance';

  constructor(cacheService?: CacheService) {
    this.cache = cacheService || new CacheService();
    logger.info('Market Data Service initialized');
  }

  /**
   * Initialize providers
   */
  async initialize(): Promise<void> {
    logger.info('Initializing exchange providers...');

    try {
      // Initialize Binance provider (for backtesting)
      const binanceProvider = new BinanceProvider();
      await binanceProvider.connect();
      this.providers.set('binance', binanceProvider);
      logger.info('Binance provider initialized');

      // Initialize MEXC provider (for live trading)
      const mexcProvider = new MEXCProvider();
      await mexcProvider.connect();
      this.providers.set('mexc', mexcProvider);
      logger.info('MEXC provider initialized');

      logger.info('All providers initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize providers', { error });
      throw error;
    }
  }

  /**
   * Disconnect all providers
   */
  async disconnect(): Promise<void> {
    logger.info('Disconnecting providers...');

    for (const [name, provider] of this.providers.entries()) {
      await provider.disconnect();
      logger.info(`${name} provider disconnected`);
    }

    this.providers.clear();
  }

  /**
   * Get provider by name
   */
  private getProvider(provider?: ExchangeProvider): IExchangeProvider {
    const providerName = provider || this.defaultProvider;
    const exchangeProvider = this.providers.get(providerName);

    if (!exchangeProvider) {
      throw new ExchangeError(`Provider ${providerName} not initialized`);
    }

    return exchangeProvider;
  }

  /**
   * Get historical candles with caching
   */
  async getHistoricalCandles(
    symbol: string,
    timeframe: Timeframe,
    startTime: number,
    endTime: number,
    provider?: ExchangeProvider
  ): Promise<Candle[]> {
    logger.debug('Fetching historical candles', {
      symbol,
      timeframe,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      provider: provider || this.defaultProvider,
    });

    // For historical data, we can't use simple caching
    // Fetch directly from provider
    const exchangeProvider = this.getProvider(provider);

    // Use Binance's batch fetching if available
    if (exchangeProvider instanceof BinanceProvider) {
      return await exchangeProvider.fetchHistoricalCandles(
        symbol,
        timeframe,
        startTime,
        endTime
      );
    }

    // Fallback: fetch in batches manually
    return await this.fetchCandlesBatch(
      exchangeProvider,
      symbol,
      timeframe,
      startTime,
      endTime
    );
  }

  /**
   * Get latest candles with caching
   */
  async getLatestCandles(
    symbol: string,
    timeframe: Timeframe,
    limit: number = 100,
    provider?: ExchangeProvider
  ): Promise<Candle[]> {
    // Check cache first
    const cached = this.cache.get({ symbol, timeframe, limit });
    if (cached) {
      return cached;
    }

    // Fetch from provider
    const exchangeProvider = this.getProvider(provider);
    const candles = await exchangeProvider.getCandles(symbol, timeframe, limit);

    // Cache the result
    this.cache.set({ symbol, timeframe, limit }, candles);

    return candles;
  }

  /**
   * Get latest candle
   */
  async getLatestCandle(
    symbol: string,
    timeframe: Timeframe,
    provider?: ExchangeProvider
  ): Promise<Candle> {
    const candles = await this.getLatestCandles(symbol, timeframe, 1, provider);

    if (candles.length === 0) {
      throw new ExchangeError(`No candles available for ${symbol}`);
    }

    return candles[0];
  }

  /**
   * Get current price
   */
  async getCurrentPrice(symbol: string, provider?: ExchangeProvider): Promise<number> {
    const ticker = await this.getTicker(symbol, provider);
    return ticker.last;
  }

  /**
   * Get ticker
   */
  async getTicker(symbol: string, provider?: ExchangeProvider): Promise<Ticker> {
    const exchangeProvider = this.getProvider(provider);
    return await exchangeProvider.getTicker(symbol);
  }

  /**
   * Get trading pair information
   */
  async getTradingPair(symbol: string, provider?: ExchangeProvider): Promise<TradingPair> {
    const exchangeProvider = this.getProvider(provider);
    return await exchangeProvider.getTradingPair(symbol);
  }

  /**
   * Clear cache for a symbol
   */
  clearCache(symbol?: string): void {
    if (symbol) {
      this.cache.clearSymbol(symbol);
    } else {
      this.cache.clearAll();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Fetch candles in batches for large date ranges
   */
  private async fetchCandlesBatch(
    provider: IExchangeProvider,
    symbol: string,
    timeframe: Timeframe,
    startTime: number,
    endTime: number
  ): Promise<Candle[]> {
    const allCandles: Candle[] = [];
    const limit = 1000;
    let currentTime = startTime;

    while (currentTime < endTime) {
      const candles = await provider.getCandles(symbol, timeframe, limit, currentTime);

      if (candles.length === 0) {
        break;
      }

      const filteredCandles = candles.filter(
        (c) => c.timestamp >= startTime && c.timestamp <= endTime
      );

      allCandles.push(...filteredCandles);

      const lastCandle = candles[candles.length - 1];
      currentTime = lastCandle.timestamp + 1;

      // Small delay to avoid rate limits
      await this.sleep(100);
    }

    return allCandles;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const marketDataService = new MarketDataService();
