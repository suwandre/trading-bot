/**
 * Data caching service for market data
 * Improves performance by caching frequently accessed data
 */

import type { Candle, Timeframe } from '../types';
import { createLogger } from '../utils/logger';

const logger = createLogger('CacheService');

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface CacheKey {
  symbol: string;
  timeframe: Timeframe;
  limit?: number;
}

export class CacheService {
  private cache: Map<string, CacheEntry<Candle[]>> = new Map();
  private readonly ttl: number; // Time to live in milliseconds
  private readonly maxSize: number;

  constructor(ttl: number = 60000, maxSize: number = 1000) {
    this.ttl = ttl;
    this.maxSize = maxSize;
    logger.info('Cache service initialized', { ttl, maxSize });
  }

  /**
   * Generate cache key from parameters
   */
  private generateKey(key: CacheKey): string {
    return `${key.symbol}:${key.timeframe}:${key.limit || 'all'}`;
  }

  /**
   * Get data from cache
   */
  get(key: CacheKey): Candle[] | null {
    const cacheKey = this.generateKey(key);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      logger.debug('Cache miss', { key: cacheKey });
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.ttl) {
      logger.debug('Cache entry expired', { key: cacheKey });
      this.cache.delete(cacheKey);
      return null;
    }

    logger.debug('Cache hit', { key: cacheKey, dataLength: entry.data.length });
    return entry.data;
  }

  /**
   * Set data in cache
   */
  set(key: CacheKey, data: Candle[]): void {
    const cacheKey = this.generateKey(key);

    // Check cache size limit
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
        logger.debug('Cache full, removed oldest entry', { removedKey: oldestKey });
      }
    }

    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });

    logger.debug('Cache set', { key: cacheKey, dataLength: data.length });
  }

  /**
   * Clear specific cache entry
   */
  clear(key: CacheKey): void {
    const cacheKey = this.generateKey(key);
    this.cache.delete(cacheKey);
    logger.debug('Cache cleared', { key: cacheKey });
  }

  /**
   * Clear all cache entries for a symbol
   */
  clearSymbol(symbol: string): void {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${symbol}:`)) {
        this.cache.delete(key);
        count++;
      }
    }
    logger.info('Symbol cache cleared', { symbol, entriesCleared: count });
  }

  /**
   * Clear all cache entries
   */
  clearAll(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.info('All cache cleared', { entriesCleared: size });
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    ttl: number;
    entries: string[];
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
      entries: Array.from(this.cache.keys()),
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    let count = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        count++;
      }
    }

    if (count > 0) {
      logger.info('Cache cleanup completed', { expiredEntries: count });
    }
  }

  /**
   * Start automatic cleanup interval
   */
  startCleanupInterval(intervalMs: number = 60000): NodeJS.Timeout {
    logger.info('Starting cache cleanup interval', { intervalMs });
    return setInterval(() => this.cleanup(), intervalMs);
  }
}

// Export singleton instance
export const cacheService = new CacheService();
