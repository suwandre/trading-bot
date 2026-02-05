/**
 * Backtesting Engine
 * Runs accurate historical simulations of trading strategies
 */

import type {
  IBacktestEngine,
  BacktestConfig,
  BacktestResult,
  BacktestProgress,
  IStrategy,
  Candle,
  Order,
  Trade,
  EquityPoint,
  DrawdownPoint,
  OrderStatus,
} from '../types';
import { MarketDataService } from '../data/market-data.service';
import { OrderSimulator } from './order-simulator';
import { MetricsCalculator } from './metrics-calculator';
import { StrategyFactory } from '../strategies/strategy-factory';
import { BacktestError } from '../utils/errors';
import { createLogger } from '../utils/logger';

const logger = createLogger('BacktestEngine');

export class BacktestEngine implements IBacktestEngine {
  private isRunning = false;
  private isPaused = false;
  private shouldStop = false;
  private progress: BacktestProgress = {
    currentTimestamp: 0,
    totalCandles: 0,
    processedCandles: 0,
    percentComplete: 0,
    estimatedTimeRemaining: 0,
  };

  constructor(
    private marketDataService: MarketDataService,
    private orderSimulator: OrderSimulator,
    private metricsCalculator: MetricsCalculator
  ) {
    logger.info('Backtest Engine initialized');
  }

  /**
   * Run a backtest
   */
  async runBacktest(config: BacktestConfig): Promise<BacktestResult> {
    if (this.isRunning) {
      throw new BacktestError('A backtest is already running');
    }

    this.isRunning = true;
    this.shouldStop = false;
    this.isPaused = false;

    const startTime = Date.now();

    logger.info('Starting backtest', {
      symbol: config.symbol,
      timeframe: config.timeframe,
      startTime: new Date(config.startTime).toISOString(),
      endTime: new Date(config.endTime).toISOString(),
      initialCapital: config.initialCapital,
    });

    try {
      // Fetch historical data
      logger.info('Fetching historical data...');
      const candles = await this.marketDataService.getHistoricalCandles(
        config.symbol,
        config.timeframe,
        config.startTime,
        config.endTime,
        'binance' // Use Binance for backtesting
      );

      if (candles.length === 0) {
        throw new BacktestError('No historical data available for the specified period');
      }

      logger.info('Historical data fetched', {
        candles: candles.length,
        firstCandle: new Date(candles[0].timestamp).toISOString(),
        lastCandle: new Date(candles[candles.length - 1].timestamp).toISOString(),
      });

      this.progress.totalCandles = candles.length;

      // Create strategy instance
      const strategy = StrategyFactory.createStrategy(config.strategy);
      await strategy.initialize();
      await strategy.start();

      // Tracking
      const trades: Trade[] = [];
      const equity: EquityPoint[] = [];
      const openOrders: Order[] = [];
      let currentCapital = config.initialCapital;
      let orderCounter = 0;

      // Initial equity point
      equity.push({
        timestamp: config.startTime,
        equity: currentCapital,
      });

      // Process each candle
      for (let i = 0; i < candles.length; i++) {
        // Check for stop signal
        if (this.shouldStop) {
          logger.warn('Backtest stopped by user');
          break;
        }

        // Handle pause
        while (this.isPaused) {
          await this.sleep(100);
        }

        const candle = candles[i];

        // Update progress
        this.progress.currentTimestamp = candle.timestamp;
        this.progress.processedCandles = i + 1;
        this.progress.percentComplete = ((i + 1) / candles.length) * 100;

        // Estimate time remaining
        if (i > 0) {
          const elapsed = Date.now() - startTime;
          const avgTimePerCandle = elapsed / i;
          this.progress.estimatedTimeRemaining = avgTimePerCandle * (candles.length - i);
        }

        // Check and fill open orders
        for (let j = openOrders.length - 1; j >= 0; j--) {
          const order = openOrders[j];
          const fill = this.orderSimulator.simulateFill(order, candle, config);

          if (fill) {
            // Order filled
            order.status = 'filled';
            order.filledQuantity = fill.quantity;
            order.averageFillPrice = fill.price;
            order.fee = fill.fee;
            order.filledAt = new Date(candle.timestamp);

            // Create trade record
            const trade: Trade = {
              id: `trade-${Date.now()}-${trades.length}`,
              strategyId: strategy.id,
              orderId: order.id,
              symbol: order.symbol,
              side: order.side,
              quantity: fill.quantity,
              price: fill.price,
              fee: fill.fee,
              feeAsset: fill.feeAsset,
              timestamp: new Date(candle.timestamp),
            };

            trades.push(trade);

            // Update capital
            if (order.side === 'buy') {
              currentCapital -= fill.quantity * fill.price + fill.fee;
            } else {
              currentCapital += fill.quantity * fill.price - fill.fee;

              // Calculate P&L for sell orders
              // Find corresponding buy trade(s) to calculate profit
              const buyTrades = trades.filter(
                (t) => t.strategyId === strategy.id && t.side === 'buy'
              );

              if (buyTrades.length > 0) {
                // Simple P&L calculation (can be enhanced with FIFO/LIFO)
                const avgBuyPrice =
                  buyTrades.reduce((sum, t) => sum + t.price * t.quantity, 0) /
                  buyTrades.reduce((sum, t) => sum + t.quantity, 0);

                trade.pnl = (fill.price - avgBuyPrice) * fill.quantity - fill.fee;
              }
            }

            // Remove from open orders
            openOrders.splice(j, 1);

            // Notify strategy
            await strategy.onOrderFilled(order);

            logger.debug('Order filled in backtest', {
              orderId: order.id,
              side: order.side,
              quantity: fill.quantity,
              price: fill.price,
              fee: fill.fee,
            });
          }
        }

        // Get signals from strategy
        const signals = await strategy.onCandle(candle);

        // Process signals and create orders
        for (const signal of signals) {
          if (signal.type === 'buy' || signal.type === 'sell') {
            orderCounter++;

            const order: Order = {
              id: `order-${Date.now()}-${orderCounter}`,
              strategyId: strategy.id,
              symbol: signal.symbol,
              side: signal.type === 'buy' ? 'buy' : 'sell',
              type: signal.price ? 'limit' : 'market',
              quantity: signal.quantity || 0,
              price: signal.price,
              status: 'pending',
              filledQuantity: 0,
              averageFillPrice: 0,
              fee: 0,
              feeAsset: 'USDT',
              createdAt: new Date(candle.timestamp),
              updatedAt: new Date(candle.timestamp),
            };

            openOrders.push(order);

            logger.debug('Order created from signal', {
              orderId: order.id,
              type: signal.type,
              quantity: order.quantity,
              price: order.price || 'market',
            });
          }
        }

        // Record equity
        equity.push({
          timestamp: candle.timestamp,
          equity: currentCapital,
        });

        // Log progress periodically
        if (i % 100 === 0) {
          logger.debug('Backtest progress', {
            processed: i + 1,
            total: candles.length,
            percent: this.progress.percentComplete.toFixed(2),
          });
        }
      }

      // Stop strategy
      await strategy.stop();

      // Calculate metrics
      const metrics = this.metricsCalculator.calculateMetrics(
        strategy.id,
        trades,
        equity,
        config.initialCapital
      );

      // Calculate drawdown points
      const drawdown = this.calculateDrawdownPoints(equity);

      const duration = Date.now() - startTime;

      logger.info('Backtest completed', {
        duration: `${(duration / 1000).toFixed(2)}s`,
        candlesProcessed: this.progress.processedCandles,
        totalTrades: trades.length,
        finalCapital: currentCapital.toFixed(2),
        totalPnL: metrics.totalPnL.toFixed(2),
        totalPnLPercent: metrics.totalPnLPercent.toFixed(2),
      });

      const result: BacktestResult = {
        config,
        metrics,
        trades,
        equity,
        drawdown,
        duration,
        candlesProcessed: this.progress.processedCandles,
      };

      this.isRunning = false;

      return result;
    } catch (error) {
      this.isRunning = false;
      logger.error('Backtest failed', { error });
      throw error;
    }
  }

  /**
   * Pause the backtest
   */
  pauseBacktest(): void {
    if (!this.isRunning) {
      throw new BacktestError('No backtest is running');
    }

    this.isPaused = true;
    logger.info('Backtest paused');
  }

  /**
   * Resume the backtest
   */
  resumeBacktest(): void {
    if (!this.isRunning) {
      throw new BacktestError('No backtest is running');
    }

    this.isPaused = false;
    logger.info('Backtest resumed');
  }

  /**
   * Stop the backtest
   */
  stopBacktest(): void {
    if (!this.isRunning) {
      throw new BacktestError('No backtest is running');
    }

    this.shouldStop = true;
    logger.info('Backtest stop requested');
  }

  /**
   * Get backtest progress
   */
  getProgress(): BacktestProgress {
    return { ...this.progress };
  }

  /**
   * Calculate drawdown points from equity curve
   */
  private calculateDrawdownPoints(equity: EquityPoint[]): DrawdownPoint[] {
    const drawdown: DrawdownPoint[] = [];
    let peak = equity[0]?.equity || 0;

    for (const point of equity) {
      if (point.equity > peak) {
        peak = point.equity;
      }

      const dd = peak - point.equity;
      const ddPercent = peak > 0 ? (dd / peak) * 100 : 0;

      drawdown.push({
        timestamp: point.timestamp,
        drawdown: dd,
        drawdownPercent: ddPercent,
      });
    }

    return drawdown;
  }

  /**
   * Sleep utility for pause functionality
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if backtest is running
   */
  isBacktestRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Check if backtest is paused
   */
  isBacktestPaused(): boolean {
    return this.isPaused;
  }
}

// Export singleton instance
export const backtestEngine = new BacktestEngine(
  {} as MarketDataService, // Will be injected
  {} as OrderSimulator,
  {} as MetricsCalculator
);
