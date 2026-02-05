/**
 * Unit Tests for Order Simulator
 */

import { describe, it, expect } from 'vitest';
import { OrderSimulator } from '../../src/backtesting/order-simulator';
import type { Order, Candle, BacktestConfig } from '../../src/types';

describe('OrderSimulator', () => {
  const simulator = new OrderSimulator();

  const mockConfig: BacktestConfig = {
    strategy: {} as any,
    symbol: 'BTC/USDT',
    timeframe: '15m',
    startTime: 0,
    endTime: 0,
    initialCapital: 10000,
    feeRate: 0.001,
    slippagePercent: 0.05,
  };

  const mockCandle: Candle = {
    timestamp: Date.now(),
    open: 45000,
    high: 46000,
    low: 44000,
    close: 45500,
    volume: 100,
  };

  describe('simulateFill - Market Orders', () => {
    it('should fill market buy order at candle open with slippage', () => {
      const order: Order = {
        id: 'order-1',
        strategyId: 'test',
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        status: 'pending',
        filledQuantity: 0,
        averageFillPrice: 0,
        fee: 0,
        feeAsset: 'USDT',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const fill = simulator.simulateFill(order, mockCandle, mockConfig);

      expect(fill).toBeDefined();
      expect(fill!.price).toBeGreaterThan(mockCandle.open); // Slippage applied
      expect(fill!.quantity).toBe(0.1);
      expect(fill!.fee).toBeGreaterThan(0);
    });

    it('should fill market sell order at candle open with slippage', () => {
      const order: Order = {
        id: 'order-1',
        strategyId: 'test',
        symbol: 'BTC/USDT',
        side: 'sell',
        type: 'market',
        quantity: 0.1,
        status: 'pending',
        filledQuantity: 0,
        averageFillPrice: 0,
        fee: 0,
        feeAsset: 'USDT',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const fill = simulator.simulateFill(order, mockCandle, mockConfig);

      expect(fill).toBeDefined();
      expect(fill!.price).toBeLessThan(mockCandle.open); // Slippage applied
    });
  });

  describe('simulateFill - Limit Orders', () => {
    it('should fill limit buy order if price reaches limit', () => {
      const order: Order = {
        id: 'order-1',
        strategyId: 'test',
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        price: 44500, // Within candle low
        status: 'pending',
        filledQuantity: 0,
        averageFillPrice: 0,
        fee: 0,
        feeAsset: 'USDT',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const fill = simulator.simulateFill(order, mockCandle, mockConfig);

      expect(fill).toBeDefined();
      expect(fill!.price).toBe(44500); // Fills at limit price
    });

    it('should not fill limit buy order if price does not reach limit', () => {
      const order: Order = {
        id: 'order-1',
        strategyId: 'test',
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        price: 43000, // Below candle low
        status: 'pending',
        filledQuantity: 0,
        averageFillPrice: 0,
        fee: 0,
        feeAsset: 'USDT',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const fill = simulator.simulateFill(order, mockCandle, mockConfig);

      expect(fill).toBeNull(); // Order not filled
    });

    it('should fill limit sell order if price reaches limit', () => {
      const order: Order = {
        id: 'order-1',
        strategyId: 'test',
        symbol: 'BTC/USDT',
        side: 'sell',
        type: 'limit',
        quantity: 0.1,
        price: 45500, // Within candle high
        status: 'pending',
        filledQuantity: 0,
        averageFillPrice: 0,
        fee: 0,
        feeAsset: 'USDT',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const fill = simulator.simulateFill(order, mockCandle, mockConfig);

      expect(fill).toBeDefined();
      expect(fill!.price).toBe(45500);
    });
  });

  describe('Fee Calculation', () => {
    it('should calculate correct fees', () => {
      const order: Order = {
        id: 'order-1',
        strategyId: 'test',
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        status: 'pending',
        filledQuantity: 0,
        averageFillPrice: 0,
        fee: 0,
        feeAsset: 'USDT',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const fill = simulator.simulateFill(order, mockCandle, mockConfig);

      // Fee = quantity * price * feeRate
      // Fee = 0.1 * ~45000 * 0.001 = ~4.5
      expect(fill!.fee).toBeGreaterThan(4);
      expect(fill!.fee).toBeLessThan(5);
    });
  });
});
