/**
 * Unit Tests for Position Manager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PositionManager } from '../../src/core/position-manager';
import type { CreatePositionRequest } from '../../src/types';

describe('PositionManager', () => {
  let positionManager: PositionManager;

  beforeEach(() => {
    positionManager = new PositionManager();
  });

  describe('createPosition', () => {
    it('should create a new position', async () => {
      const request: CreatePositionRequest = {
        strategyId: 'test-strategy',
        symbol: 'BTC/USDT',
        side: 'long',
        entryPrice: 45000,
        quantity: 0.1,
      };

      const position = await positionManager.createPosition(request);

      expect(position.id).toBeDefined();
      expect(position.strategyId).toBe('test-strategy');
      expect(position.symbol).toBe('BTC/USDT');
      expect(position.side).toBe('long');
      expect(position.entryPrice).toBe(45000);
      expect(position.quantity).toBe(0.1);
      expect(position.status).toBe('open');
      expect(position.unrealizedPnL).toBe(0);
    });

    it('should set stop-loss and take-profit if provided', async () => {
      const request: CreatePositionRequest = {
        strategyId: 'test-strategy',
        symbol: 'BTC/USDT',
        side: 'long',
        entryPrice: 45000,
        quantity: 0.1,
        stopLoss: 43000,
        takeProfit: 47000,
      };

      const position = await positionManager.createPosition(request);

      expect(position.stopLoss).toBe(43000);
      expect(position.takeProfit).toBe(47000);
    });
  });

  describe('calculateUnrealizedPnL', () => {
    it('should calculate positive P&L for long position with price increase', () => {
      const position: any = {
        side: 'long',
        entryPrice: 45000,
        quantity: 0.1,
        status: 'open',
      };

      const pnl = positionManager.calculateUnrealizedPnL(position, 46000);

      expect(pnl).toBe(100); // (46000 - 45000) * 0.1 = 100
    });

    it('should calculate negative P&L for long position with price decrease', () => {
      const position: any = {
        side: 'long',
        entryPrice: 45000,
        quantity: 0.1,
        status: 'open',
      };

      const pnl = positionManager.calculateUnrealizedPnL(position, 44000);

      expect(pnl).toBe(-100); // (44000 - 45000) * 0.1 = -100
    });

    it('should return 0 for closed position', () => {
      const position: any = {
        side: 'long',
        entryPrice: 45000,
        quantity: 0.1,
        status: 'closed',
      };

      const pnl = positionManager.calculateUnrealizedPnL(position, 46000);

      expect(pnl).toBe(0);
    });
  });

  describe('calculateRealizedPnL', () => {
    it('should calculate realized P&L including fees', () => {
      const position: any = {
        side: 'long',
        entryPrice: 45000,
        quantity: 0.1,
        totalFees: 10,
      };

      const pnl = positionManager.calculateRealizedPnL(position, 46000);

      expect(pnl).toBe(90); // (46000 - 45000) * 0.1 - 10 = 90
    });
  });

  describe('calculateROI', () => {
    it('should calculate ROI percentage', () => {
      const position: any = {
        entryPrice: 45000,
        quantity: 0.1,
        realizedPnL: 450,
      };

      const roi = positionManager.calculateROI(position);

      expect(roi).toBe(10); // (450 / 4500) * 100 = 10%
    });
  });

  describe('getTotalExposure', () => {
    it('should calculate total exposure across open positions', async () => {
      await positionManager.createPosition({
        strategyId: 'strategy-1',
        symbol: 'BTC/USDT',
        side: 'long',
        entryPrice: 45000,
        quantity: 0.1,
      });

      await positionManager.createPosition({
        strategyId: 'strategy-1',
        symbol: 'ETH/USDT',
        side: 'long',
        entryPrice: 2500,
        quantity: 1,
      });

      const exposure = positionManager.getTotalExposure('strategy-1');

      expect(exposure).toBe(7000); // 45000 * 0.1 + 2500 * 1 = 7000
    });
  });
});
