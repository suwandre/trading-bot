/**
 * Strategy Manager
 * Orchestrates multiple trading strategies running in parallel
 */

import type { IStrategy, StrategyConfig, StrategyMetrics, Candle, Order } from '../types';
import { ExecutionEngine } from './execution-engine';
import { MarketDataService } from '../data/market-data.service';
import { StrategyFactory } from '../strategies/strategy-factory';
import { StrategyError, ValidationError } from '../utils/errors';
import { createLogger } from '../utils/logger';

const logger = createLogger('StrategyManager');

export class StrategyManager {
  private strategies: Map<string, IStrategy> = new Map();
  private candleSubscriptions: Map<string, Set<string>> = new Map(); // symbol:timeframe -> strategyIds

  constructor(
    private executionEngine: ExecutionEngine,
    private marketDataService: MarketDataService
  ) {
    logger.info('Strategy Manager initialized');
  }

  /**
   * Register a new strategy
   */
  async registerStrategy(config: StrategyConfig): Promise<IStrategy> {
    // Validate configuration
    const validation = StrategyFactory.validateConfig(config);
    if (!validation.valid) {
      throw new ValidationError(`Invalid strategy configuration: ${validation.errors.join(', ')}`);
    }

    // Check if strategy already exists
    if (this.strategies.has(config.id)) {
      throw new StrategyError(`Strategy ${config.id} already exists`, config.id);
    }

    // Create strategy instance
    const strategy = StrategyFactory.createStrategy(config);

    // Initialize strategy
    await strategy.initialize();

    // Store strategy
    this.strategies.set(config.id, strategy);

    // Subscribe to candle updates
    this.subscribeToCandles(strategy);

    // Set up event listeners
    this.setupStrategyListeners(strategy);

    logger.info('Strategy registered', {
      strategyId: config.id,
      type: config.type,
      symbol: config.symbol,
      timeframe: config.timeframe,
    });

    return strategy;
  }

  /**
   * Unregister a strategy
   */
  async unregisterStrategy(strategyId: string): Promise<void> {
    const strategy = this.strategies.get(strategyId);

    if (!strategy) {
      throw new StrategyError(`Strategy ${strategyId} not found`, strategyId);
    }

    // Stop strategy if running
    if (strategy.config.status === 'active') {
      await this.stopStrategy(strategyId);
    }

    // Unsubscribe from candles
    this.unsubscribeFromCandles(strategy);

    // Remove strategy
    this.strategies.delete(strategyId);

    logger.info('Strategy unregistered', { strategyId });
  }

  /**
   * Start a strategy
   */
  async startStrategy(strategyId: string): Promise<void> {
    const strategy = this.strategies.get(strategyId);

    if (!strategy) {
      throw new StrategyError(`Strategy ${strategyId} not found`, strategyId);
    }

    await strategy.start();

    logger.info('Strategy started', { strategyId });
  }

  /**
   * Stop a strategy
   */
  async stopStrategy(strategyId: string): Promise<void> {
    const strategy = this.strategies.get(strategyId);

    if (!strategy) {
      throw new StrategyError(`Strategy ${strategyId} not found`, strategyId);
    }

    await strategy.stop();

    logger.info('Strategy stopped', { strategyId });
  }

  /**
   * Pause a strategy
   */
  async pauseStrategy(strategyId: string): Promise<void> {
    const strategy = this.strategies.get(strategyId);

    if (!strategy) {
      throw new StrategyError(`Strategy ${strategyId} not found`, strategyId);
    }

    await strategy.pause();

    logger.info('Strategy paused', { strategyId });
  }

  /**
   * Resume a strategy
   */
  async resumeStrategy(strategyId: string): Promise<void> {
    const strategy = this.strategies.get(strategyId);

    if (!strategy) {
      throw new StrategyError(`Strategy ${strategyId} not found`, strategyId);
    }

    await strategy.resume();

    logger.info('Strategy resumed', { strategyId });
  }

  /**
   * Get strategy by ID
   */
  getStrategy(strategyId: string): IStrategy | null {
    return this.strategies.get(strategyId) || null;
  }

  /**
   * Get all strategies
   */
  getAllStrategies(): IStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Get active strategies
   */
  getActiveStrategies(): IStrategy[] {
    return Array.from(this.strategies.values()).filter(
      (s) => s.config.status === 'active'
    );
  }

  /**
   * Update strategy configuration
   */
  async updateStrategyConfig(
    strategyId: string,
    updates: Partial<StrategyConfig>
  ): Promise<void> {
    const strategy = this.strategies.get(strategyId);

    if (!strategy) {
      throw new StrategyError(`Strategy ${strategyId} not found`, strategyId);
    }

    await strategy.updateConfig(updates);

    logger.info('Strategy configuration updated', { strategyId, updates });
  }

  /**
   * Distribute candle to relevant strategies
   */
  async distributeCandle(candle: Candle, symbol: string, timeframe: string): Promise<void> {
    const subscriptionKey = `${symbol}:${timeframe}`;
    const strategyIds = this.candleSubscriptions.get(subscriptionKey);

    if (!strategyIds || strategyIds.size === 0) {
      return;
    }

    logger.debug('Distributing candle', {
      symbol,
      timeframe,
      timestamp: new Date(candle.timestamp).toISOString(),
      strategies: strategyIds.size,
    });

    // Process each strategy in parallel
    const promises: Promise<void>[] = [];

    for (const strategyId of strategyIds) {
      const strategy = this.strategies.get(strategyId);

      if (strategy && strategy.config.status === 'active') {
        promises.push(this.processCandle(strategy, candle));
      }
    }

    await Promise.all(promises);
  }

  /**
   * Process candle for a strategy
   */
  private async processCandle(strategy: IStrategy, candle: Candle): Promise<void> {
    try {
      // Get signals from strategy
      const signals = await strategy.onCandle(candle);

      // Execute each signal
      for (const signal of signals) {
        try {
          const order = await this.executionEngine.executeSignal(signal, strategy);

          if (order) {
            logger.info('Signal executed', {
              strategyId: strategy.id,
              orderId: order.id,
              signalType: signal.type,
            });
          }
        } catch (error) {
          logger.error('Failed to execute signal', {
            strategyId: strategy.id,
            signalType: signal.type,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    } catch (error) {
      logger.error('Error processing candle for strategy', {
        strategyId: strategy.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      await strategy.onError(error as Error);
    }
  }

  /**
   * Distribute order fill event to strategy
   */
  async distributeOrderFill(order: Order): Promise<void> {
    const strategy = this.strategies.get(order.strategyId);

    if (!strategy) {
      logger.warn('Strategy not found for order fill', {
        orderId: order.id,
        strategyId: order.strategyId,
      });
      return;
    }

    try {
      await strategy.onOrderFilled(order);

      logger.debug('Order fill distributed to strategy', {
        orderId: order.id,
        strategyId: order.strategyId,
      });
    } catch (error) {
      logger.error('Error distributing order fill', {
        orderId: order.id,
        strategyId: order.strategyId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get strategy metrics
   */
  getStrategyMetrics(strategyId: string): StrategyMetrics {
    const strategy = this.strategies.get(strategyId);

    if (!strategy) {
      throw new StrategyError(`Strategy ${strategyId} not found`, strategyId);
    }

    return strategy.getMetrics();
  }

  /**
   * Get all strategy metrics
   */
  getAllMetrics(): Record<string, StrategyMetrics> {
    const metrics: Record<string, StrategyMetrics> = {};

    for (const [id, strategy] of this.strategies.entries()) {
      metrics[id] = strategy.getMetrics();
    }

    return metrics;
  }

  /**
   * Subscribe strategy to candle updates
   */
  private subscribeToCandles(strategy: IStrategy): void {
    const subscriptionKey = `${strategy.config.symbol}:${strategy.config.timeframe}`;

    if (!this.candleSubscriptions.has(subscriptionKey)) {
      this.candleSubscriptions.set(subscriptionKey, new Set());
    }

    this.candleSubscriptions.get(subscriptionKey)!.add(strategy.id);

    logger.debug('Strategy subscribed to candles', {
      strategyId: strategy.id,
      subscriptionKey,
    });
  }

  /**
   * Unsubscribe strategy from candle updates
   */
  private unsubscribeFromCandles(strategy: IStrategy): void {
    const subscriptionKey = `${strategy.config.symbol}:${strategy.config.timeframe}`;
    const subscribers = this.candleSubscriptions.get(subscriptionKey);

    if (subscribers) {
      subscribers.delete(strategy.id);

      if (subscribers.size === 0) {
        this.candleSubscriptions.delete(subscriptionKey);
      }
    }

    logger.debug('Strategy unsubscribed from candles', {
      strategyId: strategy.id,
      subscriptionKey,
    });
  }

  /**
   * Set up event listeners for a strategy
   */
  private setupStrategyListeners(strategy: IStrategy): void {
    // Listen to strategy events
    strategy.on('log', (data) => {
      logger[data.level](data.message, data);
    });

    strategy.on('error', async (data) => {
      logger.error('Strategy error event', {
        strategyId: data.strategyId,
        error: data.error.message,
      });

      // Could trigger alerts, notifications, etc.
    });

    strategy.on('metrics:updated', (data) => {
      logger.debug('Strategy metrics updated', {
        strategyId: data.strategyId,
        totalPnL: data.metrics.totalPnL,
      });
    });
  }

  /**
   * Stop all strategies
   */
  async stopAll(): Promise<void> {
    logger.info('Stopping all strategies...');

    const promises: Promise<void>[] = [];

    for (const strategy of this.strategies.values()) {
      if (strategy.config.status === 'active') {
        promises.push(strategy.stop());
      }
    }

    await Promise.all(promises);

    logger.info('All strategies stopped');
  }

  /**
   * Get manager statistics
   */
  getStats(): {
    totalStrategies: number;
    activeStrategies: number;
    pausedStrategies: number;
    stoppedStrategies: number;
    errorStrategies: number;
    subscriptions: number;
  } {
    let activeStrategies = 0;
    let pausedStrategies = 0;
    let stoppedStrategies = 0;
    let errorStrategies = 0;

    for (const strategy of this.strategies.values()) {
      switch (strategy.config.status) {
        case 'active':
          activeStrategies++;
          break;
        case 'paused':
          pausedStrategies++;
          break;
        case 'stopped':
          stoppedStrategies++;
          break;
        case 'error':
          errorStrategies++;
          break;
      }
    }

    return {
      totalStrategies: this.strategies.size,
      activeStrategies,
      pausedStrategies,
      stoppedStrategies,
      errorStrategies,
      subscriptions: this.candleSubscriptions.size,
    };
  }
}
