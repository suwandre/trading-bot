/**
 * Execution Engine
 * Routes order execution based on trading mode (backtest/paper/live)
 */

import type {
  Order,
  Signal,
  IStrategy,
  TradingMode,
  CreateOrderRequest,
  OrderSide,
  OrderType,
} from '../types';
import { MarketDataService } from '../data/market-data.service';
import { RiskManager } from './risk-manager';
import { OrderExecutionError, ValidationError } from '../utils/errors';
import { createLogger } from '../utils/logger';

const logger = createLogger('ExecutionEngine');

export class ExecutionEngine {
  private orders: Map<string, Order> = new Map();
  private orderCounter = 0;

  constructor(
    private marketDataService: MarketDataService,
    private riskManager: RiskManager
  ) {
    logger.info('Execution Engine initialized');
  }

  /**
   * Execute a trading signal
   */
  async executeSignal(signal: Signal, strategy: IStrategy): Promise<Order | null> {
    logger.debug('Executing signal', {
      strategyId: strategy.id,
      signalType: signal.type,
      symbol: signal.symbol,
    });

    // Validate signal with risk manager
    const validation = await this.riskManager.validateSignal(signal, strategy);

    if (!validation.valid) {
      logger.warn('Signal rejected by risk manager', {
        strategyId: strategy.id,
        reason: validation.reason,
      });
      return null;
    }

    // Adjust quantity if needed
    const quantity = validation.adjustedQuantity || signal.quantity || 0;

    // Create order from signal
    const order = await this.createOrder({
      strategyId: strategy.id,
      symbol: signal.symbol,
      side: signal.type === 'buy' ? 'buy' : 'sell',
      type: signal.price ? 'limit' : 'market',
      quantity,
      price: signal.price,
    });

    // Execute order based on mode
    return await this.executeOrder(order, strategy.config.mode);
  }

  /**
   * Create an order
   */
  async createOrder(request: CreateOrderRequest): Promise<Order> {
    this.orderCounter++;

    const order: Order = {
      id: `order-${Date.now()}-${this.orderCounter}`,
      strategyId: request.strategyId,
      symbol: request.symbol,
      side: request.side,
      type: request.type,
      quantity: request.quantity,
      price: request.price,
      stopPrice: request.stopPrice,
      status: 'pending',
      filledQuantity: 0,
      averageFillPrice: 0,
      fee: 0,
      feeAsset: 'USDT',
      createdAt: new Date(),
      updatedAt: new Date(),
      clientOrderId: `client-${this.orderCounter}`,
    };

    this.orders.set(order.id, order);

    logger.info('Order created', {
      orderId: order.id,
      strategyId: order.strategyId,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      quantity: order.quantity,
    });

    return order;
  }

  /**
   * Execute order based on trading mode
   */
  async executeOrder(order: Order, mode: TradingMode): Promise<Order> {
    logger.debug('Executing order', {
      orderId: order.id,
      mode,
      side: order.side,
      type: order.type,
    });

    try {
      switch (mode) {
        case 'backtest':
          // Backtesting mode: orders are simulated by the backtest engine
          // Just mark as pending and return
          order.status = 'pending';
          break;

        case 'paper':
          // Paper trading: simulate execution with current market price
          return await this.paperExecute(order);

        case 'live':
          // Live trading: execute on real exchange
          return await this.liveExecute(order);

        default:
          throw new OrderExecutionError(`Unknown trading mode: ${mode}`, order.id);
      }

      return order;
    } catch (error) {
      order.status = 'rejected';
      logger.error('Order execution failed', {
        orderId: order.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Execute order in paper trading mode
   */
  private async paperExecute(order: Order): Promise<Order> {
    logger.debug('Paper trading execution', { orderId: order.id });

    try {
      // Get current market price
      const ticker = await this.marketDataService.getTicker(order.symbol);
      const currentPrice = order.side === 'buy' ? ticker.ask : ticker.bid;

      // For market orders, fill immediately at current price
      if (order.type === 'market') {
        order.status = 'filled';
        order.filledQuantity = order.quantity;
        order.averageFillPrice = currentPrice;
        order.fee = order.quantity * currentPrice * 0.001; // 0.1% fee
        order.filledAt = new Date();

        logger.info('Paper order filled (market)', {
          orderId: order.id,
          fillPrice: currentPrice,
          quantity: order.quantity,
        });
      } else {
        // For limit orders, mark as open
        order.status = 'open';

        logger.info('Paper order placed (limit)', {
          orderId: order.id,
          limitPrice: order.price,
        });
      }

      order.updatedAt = new Date();
      return order;
    } catch (error) {
      throw new OrderExecutionError(
        `Paper execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        order.id
      );
    }
  }

  /**
   * Execute order on live exchange
   */
  private async liveExecute(order: Order): Promise<Order> {
    logger.info('Live trading execution', { orderId: order.id });

    try {
      // Get MEXC provider
      // Note: This requires the market data service to expose the provider
      // For now, throw an error as live trading needs more setup

      throw new OrderExecutionError(
        'Live trading not yet fully implemented. Use paper trading mode for now.',
        order.id
      );

      // TODO: Implement live execution
      // const mexcProvider = this.marketDataService.getProvider('mexc');
      // const exchangeOrder = await mexcProvider.createOrder({
      //   strategyId: order.strategyId,
      //   symbol: order.symbol,
      //   side: order.side,
      //   type: order.type,
      //   quantity: order.quantity,
      //   price: order.price,
      // });
      //
      // return exchangeOrder;
    } catch (error) {
      throw new OrderExecutionError(
        `Live execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        order.id
      );
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string, mode: TradingMode): Promise<void> {
    const order = this.orders.get(orderId);

    if (!order) {
      throw new ValidationError(`Order ${orderId} not found`);
    }

    if (order.status === 'filled' || order.status === 'cancelled') {
      throw new ValidationError(`Order ${orderId} cannot be cancelled (status: ${order.status})`);
    }

    switch (mode) {
      case 'backtest':
        // In backtest mode, just mark as cancelled
        order.status = 'cancelled';
        order.cancelledAt = new Date();
        break;

      case 'paper':
        // In paper mode, mark as cancelled
        order.status = 'cancelled';
        order.cancelledAt = new Date();
        break;

      case 'live':
        // In live mode, cancel on exchange
        // TODO: Implement live cancellation
        throw new OrderExecutionError('Live order cancellation not yet implemented', orderId);

      default:
        throw new OrderExecutionError(`Unknown trading mode: ${mode}`, orderId);
    }

    logger.info('Order cancelled', { orderId, mode });
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string): Promise<Order | null> {
    return this.orders.get(orderId) || null;
  }

  /**
   * Get orders by strategy
   */
  async getOrdersByStrategy(strategyId: string): Promise<Order[]> {
    const orders: Order[] = [];

    for (const order of this.orders.values()) {
      if (order.strategyId === strategyId) {
        orders.push(order);
      }
    }

    return orders;
  }

  /**
   * Get open orders
   */
  async getOpenOrders(strategyId?: string): Promise<Order[]> {
    const orders: Order[] = [];

    for (const order of this.orders.values()) {
      if (order.status === 'open' || order.status === 'pending') {
        if (!strategyId || order.strategyId === strategyId) {
          orders.push(order);
        }
      }
    }

    return orders;
  }

  /**
   * Update order status (for paper trading monitoring)
   */
  async updateOrderStatus(orderId: string, status: Order['status']): Promise<Order> {
    const order = this.orders.get(orderId);

    if (!order) {
      throw new ValidationError(`Order ${orderId} not found`);
    }

    order.status = status;
    order.updatedAt = new Date();

    if (status === 'filled') {
      order.filledAt = new Date();
    } else if (status === 'cancelled') {
      order.cancelledAt = new Date();
    }

    logger.debug('Order status updated', { orderId, status });

    return order;
  }

  /**
   * Clear all orders (for testing)
   */
  clearAll(): void {
    this.orders.clear();
    this.orderCounter = 0;
    logger.info('All orders cleared');
  }

  /**
   * Get execution statistics
   */
  getStats(strategyId?: string): {
    totalOrders: number;
    pendingOrders: number;
    openOrders: number;
    filledOrders: number;
    cancelledOrders: number;
    rejectedOrders: number;
  } {
    let totalOrders = 0;
    let pendingOrders = 0;
    let openOrders = 0;
    let filledOrders = 0;
    let cancelledOrders = 0;
    let rejectedOrders = 0;

    for (const order of this.orders.values()) {
      if (strategyId && order.strategyId !== strategyId) {
        continue;
      }

      totalOrders++;

      switch (order.status) {
        case 'pending':
          pendingOrders++;
          break;
        case 'open':
          openOrders++;
          break;
        case 'filled':
          filledOrders++;
          break;
        case 'cancelled':
          cancelledOrders++;
          break;
        case 'rejected':
          rejectedOrders++;
          break;
      }
    }

    return {
      totalOrders,
      pendingOrders,
      openOrders,
      filledOrders,
      cancelledOrders,
      rejectedOrders,
    };
  }
}
