/**
 * DCA (Dollar Cost Averaging) Strategy
 * Invests a fixed amount at regular intervals
 */

import { BaseStrategy } from '../base/base-strategy';
import type { Candle, Signal, Order, DCAStrategyParams } from '../../types';

interface DCAState {
  lastInvestmentTime: number;
  totalInvested: number;
  averageEntryPrice: number;
  investmentCount: number;
  averageDownCount: number;
  totalQuantity: number;
}

export class DCAStrategy extends BaseStrategy {
  private dcaState: DCAState = {
    lastInvestmentTime: 0,
    totalInvested: 0,
    averageEntryPrice: 0,
    investmentCount: 0,
    averageDownCount: 0,
    totalQuantity: 0,
  };

  private params: DCAStrategyParams;

  constructor(config: any) {
    super(config);
    this.params = config.parameters as DCAStrategyParams;
  }

  async initialize(): Promise<void> {
    await super.initialize();

    // Load state if resuming
    const savedState = this.getState();
    if (savedState.customState?.dca) {
      this.dcaState = savedState.customState.dca;
    }

    this.log('info', 'DCA Strategy initialized', {
      symbol: this.config.symbol,
      investmentAmount: this.params.investmentAmount,
      interval: this.params.interval,
      takeProfitPercent: this.params.takeProfitPercent,
      averageDown: this.params.averageDown,
    });
  }

  async onCandle(candle: Candle): Promise<Signal[]> {
    if (!this.isActive()) {
      return [];
    }

    const signals: Signal[] = [];

    // Check if it's time to invest
    if (this.shouldInvest(candle.timestamp)) {
      const buySignal = this.createBuySignal(candle);
      if (buySignal) {
        signals.push(buySignal);
        this.log('info', 'Regular DCA buy signal generated', {
          price: candle.close,
          quantity: buySignal.quantity,
          investmentCount: this.dcaState.investmentCount + 1,
        });
      }
    }

    // Check for average down opportunity
    if (this.shouldAverageDown(candle.close)) {
      const averageDownSignal = this.createAverageDownSignal(candle);
      if (averageDownSignal) {
        signals.push(averageDownSignal);
        this.log('info', 'Average down signal generated', {
          price: candle.close,
          quantity: averageDownSignal.quantity,
          averageDownCount: this.dcaState.averageDownCount + 1,
        });
      }
    }

    // Check for take profit
    if (this.shouldTakeProfit(candle.close)) {
      const sellSignal = this.createSellSignal(candle);
      if (sellSignal) {
        signals.push(sellSignal);
        this.log('info', 'Take profit signal generated', {
          price: candle.close,
          quantity: sellSignal.quantity,
          profit: ((candle.close - this.dcaState.averageEntryPrice) / this.dcaState.averageEntryPrice) * 100,
        });
      }
    }

    // Update state
    this.setState({
      lastProcessedCandle: candle.timestamp,
      customState: { dca: this.dcaState },
    });

    return signals;
  }

  async onOrderFilled(order: Order): Promise<void> {
    await super.onOrderFilled(order);

    // Update DCA state based on filled order
    if (order.side === 'buy') {
      // Update investment tracking
      const investmentAmount = order.filledQuantity * order.averageFillPrice;
      this.dcaState.totalInvested += investmentAmount;
      this.dcaState.totalQuantity += order.filledQuantity;

      // Recalculate average entry price
      if (this.dcaState.totalQuantity > 0) {
        this.dcaState.averageEntryPrice = this.dcaState.totalInvested / this.dcaState.totalQuantity;
      }

      this.log('info', 'Buy order filled, state updated', {
        totalInvested: this.dcaState.totalInvested,
        totalQuantity: this.dcaState.totalQuantity,
        averageEntryPrice: this.dcaState.averageEntryPrice,
      });
    } else if (order.side === 'sell') {
      // Reset state after selling
      this.resetState();
      this.log('info', 'Sell order filled, state reset');
    }
  }

  /**
   * Check if it's time to make a regular investment
   */
  private shouldInvest(timestamp: number): boolean {
    // First investment
    if (this.dcaState.lastInvestmentTime === 0) {
      return true;
    }

    const timeSinceLastInvestment = timestamp - this.dcaState.lastInvestmentTime;
    const intervalMs = this.getIntervalMs(this.params.interval);

    return timeSinceLastInvestment >= intervalMs;
  }

  /**
   * Check if we should average down (buy more when price drops)
   */
  private shouldAverageDown(currentPrice: number): boolean {
    // Average down is disabled
    if (!this.params.averageDown) {
      return false;
    }

    // No position yet
    if (this.dcaState.averageEntryPrice === 0) {
      return false;
    }

    // Max average downs reached
    if (this.dcaState.averageDownCount >= (this.params.maxAverageDowns || 0)) {
      return false;
    }

    // Calculate price drop percentage
    const priceDropPercent =
      ((this.dcaState.averageEntryPrice - currentPrice) / this.dcaState.averageEntryPrice) * 100;

    // Price has dropped enough to trigger average down
    return priceDropPercent >= (this.params.averageDownPercent || 0);
  }

  /**
   * Check if we should take profit
   */
  private shouldTakeProfit(currentPrice: number): boolean {
    // Take profit is disabled
    if (!this.params.takeProfitPercent) {
      return false;
    }

    // No position yet
    if (this.dcaState.averageEntryPrice === 0) {
      return false;
    }

    // Calculate profit percentage
    const profitPercent =
      ((currentPrice - this.dcaState.averageEntryPrice) / this.dcaState.averageEntryPrice) * 100;

    // Profit target reached
    return profitPercent >= this.params.takeProfitPercent;
  }

  /**
   * Create buy signal for regular DCA investment
   */
  private createBuySignal(candle: Candle): Signal | null {
    const quantity = this.params.investmentAmount / candle.close;

    // Update state
    this.dcaState.lastInvestmentTime = candle.timestamp;
    this.dcaState.investmentCount++;

    // Calculate stop-loss if configured
    const stopLoss = this.config.riskParams.stopLossPercent
      ? candle.close * (1 - this.config.riskParams.stopLossPercent / 100)
      : undefined;

    // Calculate take-profit based on average entry price (will be updated after fill)
    const takeProfit = this.params.takeProfitPercent
      ? candle.close * (1 + this.params.takeProfitPercent / 100)
      : undefined;

    return this.createSignal(
      'buy',
      quantity,
      undefined, // Market order
      stopLoss,
      takeProfit,
      `Regular DCA investment #${this.dcaState.investmentCount}`
    );
  }

  /**
   * Create buy signal for averaging down
   */
  private createAverageDownSignal(candle: Candle): Signal | null {
    const quantity = this.params.investmentAmount / candle.close;

    // Update state
    this.dcaState.averageDownCount++;

    return this.createSignal(
      'buy',
      quantity,
      undefined, // Market order
      undefined,
      undefined,
      `Average down #${this.dcaState.averageDownCount} at ${candle.close.toFixed(2)}`
    );
  }

  /**
   * Create sell signal for taking profit
   */
  private createSellSignal(candle: Candle): Signal | null {
    // Sell entire position
    const quantity = this.dcaState.totalQuantity;

    if (quantity <= 0) {
      return null;
    }

    return this.createSignal(
      'sell',
      quantity,
      undefined, // Market order
      undefined,
      undefined,
      `Take profit at ${candle.close.toFixed(2)} (${this.calculateProfitPercent(candle.close).toFixed(2)}% profit)`
    );
  }

  /**
   * Calculate current profit percentage
   */
  private calculateProfitPercent(currentPrice: number): number {
    if (this.dcaState.averageEntryPrice === 0) {
      return 0;
    }

    return ((currentPrice - this.dcaState.averageEntryPrice) / this.dcaState.averageEntryPrice) * 100;
  }

  /**
   * Convert interval to milliseconds
   */
  private getIntervalMs(interval: string | number): number {
    if (typeof interval === 'number') {
      return interval;
    }

    const intervals: Record<string, number> = {
      hourly: 60 * 60 * 1000,
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000,
    };

    return intervals[interval] || intervals['daily'];
  }

  /**
   * Reset DCA state after selling
   */
  private resetState(): void {
    this.dcaState = {
      lastInvestmentTime: Date.now(),
      totalInvested: 0,
      averageEntryPrice: 0,
      investmentCount: 0,
      averageDownCount: 0,
      totalQuantity: 0,
    };
  }

  /**
   * Get current DCA state (for monitoring)
   */
  getDCAState(): DCAState {
    return { ...this.dcaState };
  }
}
