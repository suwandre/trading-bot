/**
 * Custom Strategy Template
 * Use this as a starting point for creating your own trading strategies
 * 
 * Example: Simple Moving Average (SMA) Crossover Strategy
 */

import { BaseStrategy } from '../base/base-strategy';
import type { Candle, Signal, Order } from '../../types';
import { SMA } from 'technicalindicators';

interface CustomStrategyParams {
  // Define your strategy parameters here
  fastPeriod: number;
  slowPeriod: number;
  positionSizePercent: number;
}

interface CustomState {
  fastSMA: number[];
  slowSMA: number[];
  closePrices: number[];
  inPosition: boolean;
}

/**
 * Example: SMA Crossover Strategy
 * - Buy when fast SMA crosses above slow SMA
 * - Sell when fast SMA crosses below slow SMA
 */
export class CustomStrategyTemplate extends BaseStrategy {
  private customState: CustomState = {
    fastSMA: [],
    slowSMA: [],
    closePrices: [],
    inPosition: false,
  };

  private params: CustomStrategyParams;

  constructor(config: any) {
    super(config);
    this.params = config.parameters as CustomStrategyParams;
  }

  async initialize(): Promise<void> {
    await super.initialize();

    // Load state if resuming
    const savedState = this.getState();
    if (savedState.customState?.custom) {
      this.customState = savedState.customState.custom;
    }

    this.log('info', 'Custom Strategy initialized', {
      symbol: this.config.symbol,
      fastPeriod: this.params.fastPeriod,
      slowPeriod: this.params.slowPeriod,
    });
  }

  async onCandle(candle: Candle): Promise<Signal[]> {
    if (!this.isActive()) {
      return [];
    }

    const signals: Signal[] = [];

    // Add current close price to history
    this.customState.closePrices.push(candle.close);

    // Keep only necessary history (slow period + buffer)
    const maxHistory = this.params.slowPeriod + 10;
    if (this.customState.closePrices.length > maxHistory) {
      this.customState.closePrices = this.customState.closePrices.slice(-maxHistory);
    }

    // Need enough data to calculate indicators
    if (this.customState.closePrices.length < this.params.slowPeriod) {
      return [];
    }

    // Calculate SMAs
    const fastSMA = SMA.calculate({
      period: this.params.fastPeriod,
      values: this.customState.closePrices,
    });

    const slowSMA = SMA.calculate({
      period: this.params.slowPeriod,
      values: this.customState.closePrices,
    });

    // Need at least 2 values to detect crossover
    if (fastSMA.length < 2 || slowSMA.length < 2) {
      return [];
    }

    // Get current and previous SMA values
    const currentFastSMA = fastSMA[fastSMA.length - 1];
    const previousFastSMA = fastSMA[fastSMA.length - 2];
    const currentSlowSMA = slowSMA[slowSMA.length - 1];
    const previousSlowSMA = slowSMA[slowSMA.length - 2];

    // Store SMAs in state
    this.customState.fastSMA = fastSMA;
    this.customState.slowSMA = slowSMA;

    // Detect crossover
    const bullishCrossover =
      previousFastSMA <= previousSlowSMA && currentFastSMA > currentSlowSMA;
    const bearishCrossover =
      previousFastSMA >= previousSlowSMA && currentFastSMA < currentSlowSMA;

    // Generate signals
    if (bullishCrossover && !this.customState.inPosition) {
      // Buy signal
      const quantity = this.calculatePositionSize(candle.close);

      const stopLoss = this.config.riskParams.stopLossPercent
        ? candle.close * (1 - this.config.riskParams.stopLossPercent / 100)
        : undefined;

      const takeProfit = this.config.riskParams.takeProfitPercent
        ? candle.close * (1 + this.config.riskParams.takeProfitPercent / 100)
        : undefined;

      const buySignal = this.createSignal(
        'buy',
        quantity,
        undefined, // Market order
        stopLoss,
        takeProfit,
        `Bullish crossover: Fast SMA (${currentFastSMA.toFixed(2)}) > Slow SMA (${currentSlowSMA.toFixed(2)})`
      );

      signals.push(buySignal);
      this.customState.inPosition = true;

      this.log('info', 'Bullish crossover detected', {
        fastSMA: currentFastSMA.toFixed(2),
        slowSMA: currentSlowSMA.toFixed(2),
        price: candle.close,
      });
    } else if (bearishCrossover && this.customState.inPosition) {
      // Sell signal
      const quantity = this.calculatePositionSize(candle.close);

      const sellSignal = this.createSignal(
        'sell',
        quantity,
        undefined, // Market order
        undefined,
        undefined,
        `Bearish crossover: Fast SMA (${currentFastSMA.toFixed(2)}) < Slow SMA (${currentSlowSMA.toFixed(2)})`
      );

      signals.push(sellSignal);
      this.customState.inPosition = false;

      this.log('info', 'Bearish crossover detected', {
        fastSMA: currentFastSMA.toFixed(2),
        slowSMA: currentSlowSMA.toFixed(2),
        price: candle.close,
      });
    }

    // Update state
    this.setState({
      lastProcessedCandle: candle.timestamp,
      indicators: {
        fastSMA: currentFastSMA,
        slowSMA: currentSlowSMA,
      },
      customState: { custom: this.customState },
    });

    return signals;
  }

  async onOrderFilled(order: Order): Promise<void> {
    await super.onOrderFilled(order);

    // Update position state
    if (order.side === 'buy') {
      this.customState.inPosition = true;
    } else if (order.side === 'sell') {
      this.customState.inPosition = false;
    }
  }

  /**
   * Calculate position size based on risk parameters
   */
  private calculatePositionSize(currentPrice: number): number {
    const capital = this.config.currentCapital;
    const positionSizePercent = this.params.positionSizePercent || 10;

    const positionValue = capital * (positionSizePercent / 100);
    return positionValue / currentPrice;
  }

  /**
   * Get current indicator values (for monitoring)
   */
  getIndicators(): {
    fastSMA: number | null;
    slowSMA: number | null;
    inPosition: boolean;
  } {
    return {
      fastSMA:
        this.customState.fastSMA.length > 0
          ? this.customState.fastSMA[this.customState.fastSMA.length - 1]
          : null,
      slowSMA:
        this.customState.slowSMA.length > 0
          ? this.customState.slowSMA[this.customState.slowSMA.length - 1]
          : null,
      inPosition: this.customState.inPosition,
    };
  }
}

/**
 * HOW TO CREATE YOUR OWN STRATEGY:
 * 
 * 1. Copy this template file
 * 2. Rename the class and file
 * 3. Define your strategy parameters interface
 * 4. Define your custom state interface
 * 5. Implement the onCandle() method with your trading logic
 * 6. Optionally override onOrderFilled() for state updates
 * 7. Add any helper methods you need
 * 
 * TIPS:
 * - Use this.log() for logging
 * - Use this.createSignal() to generate trading signals
 * - Use this.isActive() to check if strategy is running
 * - Store state in this.setState() for persistence
 * - Access config with this.config
 * - Access risk params with this.getRiskParams()
 * 
 * AVAILABLE INDICATORS (from technicalindicators package):
 * - SMA, EMA, WMA, VWMA
 * - RSI, MACD, Stochastic
 * - Bollinger Bands, ATR
 * - And many more...
 */
