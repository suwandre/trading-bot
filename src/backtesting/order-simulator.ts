/**
 * Order Simulator
 * Simulates realistic order execution for backtesting
 */

import type { Order, OrderFill, Candle, BacktestConfig, OrderSide } from '../types';
import { createLogger } from '../utils/logger';

const logger = createLogger('OrderSimulator');

export class OrderSimulator {
  constructor() {
    logger.info('Order Simulator initialized');
  }

  /**
   * Simulate order fill based on candle data
   * Returns OrderFill if order can be filled, null otherwise
   */
  simulateFill(order: Order, candle: Candle, config: BacktestConfig): OrderFill | null {
    // Market orders fill at next candle open (with slippage)
    if (order.type === 'market') {
      return this.simulateMarketOrderFill(order, candle, config);
    }

    // Limit orders fill if price reaches limit within candle range
    if (order.type === 'limit' && order.price) {
      return this.simulateLimitOrderFill(order, candle, config);
    }

    // Stop-loss orders
    if (order.type === 'stop_loss' && order.stopPrice) {
      return this.simulateStopLossOrderFill(order, candle, config);
    }

    // Take-profit orders
    if (order.type === 'take_profit' && order.price) {
      return this.simulateTakeProfitOrderFill(order, candle, config);
    }

    return null;
  }

  /**
   * Simulate market order fill
   * Market orders fill at the open price of the next candle with slippage
   */
  private simulateMarketOrderFill(
    order: Order,
    candle: Candle,
    config: BacktestConfig
  ): OrderFill {
    // Use candle open price as fill price
    const basePrice = candle.open;

    // Apply slippage
    const fillPrice = this.applySlippage(basePrice, order.side, config.slippagePercent);

    // Calculate fee
    const fee = this.calculateFee(order.quantity, fillPrice, config.feeRate);

    logger.debug('Market order filled', {
      orderId: order.id,
      side: order.side,
      quantity: order.quantity,
      fillPrice,
      fee,
      slippage: ((fillPrice - basePrice) / basePrice) * 100,
    });

    return {
      orderId: order.id,
      quantity: order.quantity,
      price: fillPrice,
      fee,
      feeAsset: 'USDT',
      timestamp: new Date(candle.timestamp),
    };
  }

  /**
   * Simulate limit order fill
   * Limit orders fill if price reaches the limit within the candle's range
   */
  private simulateLimitOrderFill(
    order: Order,
    candle: Candle,
    config: BacktestConfig
  ): OrderFill | null {
    const limitPrice = order.price!;

    // Check if limit price was reached during this candle
    let canFill = false;

    if (order.side === 'buy') {
      // Buy limit: fill if candle low <= limit price
      canFill = candle.low <= limitPrice;
    } else {
      // Sell limit: fill if candle high >= limit price
      canFill = candle.high >= limitPrice;
    }

    if (!canFill) {
      return null; // Order not filled this candle
    }

    // Fill at limit price (no slippage for limit orders)
    const fillPrice = limitPrice;

    // Calculate fee
    const fee = this.calculateFee(order.quantity, fillPrice, config.feeRate);

    logger.debug('Limit order filled', {
      orderId: order.id,
      side: order.side,
      quantity: order.quantity,
      limitPrice,
      fillPrice,
      fee,
    });

    return {
      orderId: order.id,
      quantity: order.quantity,
      price: fillPrice,
      fee,
      feeAsset: 'USDT',
      timestamp: new Date(candle.timestamp),
    };
  }

  /**
   * Simulate stop-loss order fill
   * Stop-loss triggers when price reaches stop price
   */
  private simulateStopLossOrderFill(
    order: Order,
    candle: Candle,
    config: BacktestConfig
  ): OrderFill | null {
    const stopPrice = order.stopPrice!;

    // Check if stop price was reached
    let triggered = false;

    if (order.side === 'sell') {
      // Stop-loss sell: trigger if price drops to stop price
      triggered = candle.low <= stopPrice;
    } else {
      // Stop-loss buy: trigger if price rises to stop price
      triggered = candle.high >= stopPrice;
    }

    if (!triggered) {
      return null;
    }

    // Stop-loss fills at stop price with slippage (market order after trigger)
    const fillPrice = this.applySlippage(stopPrice, order.side, config.slippagePercent);

    // Calculate fee
    const fee = this.calculateFee(order.quantity, fillPrice, config.feeRate);

    logger.debug('Stop-loss order filled', {
      orderId: order.id,
      side: order.side,
      quantity: order.quantity,
      stopPrice,
      fillPrice,
      fee,
    });

    return {
      orderId: order.id,
      quantity: order.quantity,
      price: fillPrice,
      fee,
      feeAsset: 'USDT',
      timestamp: new Date(candle.timestamp),
    };
  }

  /**
   * Simulate take-profit order fill
   * Take-profit triggers when price reaches target price
   */
  private simulateTakeProfitOrderFill(
    order: Order,
    candle: Candle,
    config: BacktestConfig
  ): OrderFill | null {
    const targetPrice = order.price!;

    // Check if target price was reached
    let triggered = false;

    if (order.side === 'sell') {
      // Take-profit sell: trigger if price rises to target
      triggered = candle.high >= targetPrice;
    } else {
      // Take-profit buy: trigger if price drops to target
      triggered = candle.low <= targetPrice;
    }

    if (!triggered) {
      return null;
    }

    // Take-profit fills at target price (limit order behavior)
    const fillPrice = targetPrice;

    // Calculate fee
    const fee = this.calculateFee(order.quantity, fillPrice, config.feeRate);

    logger.debug('Take-profit order filled', {
      orderId: order.id,
      side: order.side,
      quantity: order.quantity,
      targetPrice,
      fillPrice,
      fee,
    });

    return {
      orderId: order.id,
      quantity: order.quantity,
      price: fillPrice,
      fee,
      feeAsset: 'USDT',
      timestamp: new Date(candle.timestamp),
    };
  }

  /**
   * Apply slippage to price
   * Slippage is worse for the trader (higher for buys, lower for sells)
   */
  private applySlippage(price: number, side: OrderSide, slippagePercent: number): number {
    const slippage = price * (slippagePercent / 100);

    if (side === 'buy') {
      // Buying: pay more due to slippage
      return price + slippage;
    } else {
      // Selling: receive less due to slippage
      return price - slippage;
    }
  }

  /**
   * Calculate trading fee
   */
  private calculateFee(quantity: number, price: number, feeRate: number): number {
    return quantity * price * feeRate;
  }

  /**
   * Estimate if order would fill in real market
   * This is a more sophisticated check that considers order book depth
   * For now, we use the simple candle-based approach
   */
  estimateFillProbability(order: Order, candle: Candle): number {
    // This could be enhanced with:
    // - Volume analysis
    // - Order book depth simulation
    // - Market impact modeling
    // For now, return 1.0 (100%) if price is within candle range

    if (order.type === 'market') {
      return 1.0; // Market orders always fill
    }

    if (order.type === 'limit' && order.price) {
      if (order.side === 'buy' && candle.low <= order.price) {
        return 1.0;
      }
      if (order.side === 'sell' && candle.high >= order.price) {
        return 1.0;
      }
    }

    return 0.0;
  }

  /**
   * Calculate realistic fill price considering volume
   * This is a more advanced feature for future implementation
   */
  calculateVolumeWeightedPrice(candle: Candle, targetQuantity: number): number {
    // For now, return the average of OHLC
    // In a real implementation, this would consider:
    // - Order book depth
    // - Volume distribution
    // - Market impact
    return (candle.open + candle.high + candle.low + candle.close) / 4;
  }
}

// Export singleton instance
export const orderSimulator = new OrderSimulator();
