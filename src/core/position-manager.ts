/**
 * Position Manager
 * Tracks and manages all trading positions
 */

import type { Position, CreatePositionRequest, PositionStatus } from '../types';
import { createLogger } from '../utils/logger';
import { ValidationError } from '../utils/errors';

const logger = createLogger('PositionManager');

export class PositionManager {
  private positions: Map<string, Position> = new Map();
  private positionCounter = 0;

  constructor() {
    logger.info('Position Manager initialized');
  }

  /**
   * Create a new position
   */
  async createPosition(request: CreatePositionRequest): Promise<Position> {
    const position: Position = {
      id: this.generatePositionId(),
      strategyId: request.strategyId,
      symbol: request.symbol,
      side: request.side,
      entryPrice: request.entryPrice,
      currentPrice: request.entryPrice,
      quantity: request.quantity,
      unrealizedPnL: 0,
      realizedPnL: 0,
      totalFees: 0,
      stopLoss: request.stopLoss,
      takeProfit: request.takeProfit,
      status: 'open',
      openedAt: new Date(),
    };

    this.positions.set(position.id, position);

    logger.info('Position created', {
      positionId: position.id,
      strategyId: position.strategyId,
      symbol: position.symbol,
      side: position.side,
      quantity: position.quantity,
      entryPrice: position.entryPrice,
    });

    return position;
  }

  /**
   * Get position by ID
   */
  async getPosition(positionId: string): Promise<Position | null> {
    return this.positions.get(positionId) || null;
  }

  /**
   * Get all positions for a strategy
   */
  async getPositionsByStrategy(strategyId: string): Promise<Position[]> {
    const positions: Position[] = [];

    for (const position of this.positions.values()) {
      if (position.strategyId === strategyId) {
        positions.push(position);
      }
    }

    return positions;
  }

  /**
   * Get all open positions
   */
  async getOpenPositions(strategyId?: string): Promise<Position[]> {
    const positions: Position[] = [];

    for (const position of this.positions.values()) {
      if (position.status === 'open') {
        if (!strategyId || position.strategyId === strategyId) {
          positions.push(position);
        }
      }
    }

    return positions;
  }

  /**
   * Get all positions (open and closed)
   */
  async getAllPositions(strategyId?: string): Promise<Position[]> {
    const positions: Position[] = [];

    for (const position of this.positions.values()) {
      if (!strategyId || position.strategyId === strategyId) {
        positions.push(position);
      }
    }

    return positions;
  }

  /**
   * Update position
   */
  async updatePosition(positionId: string, updates: Partial<Position>): Promise<Position> {
    const position = this.positions.get(positionId);

    if (!position) {
      throw new ValidationError(`Position ${positionId} not found`);
    }

    Object.assign(position, updates);

    logger.debug('Position updated', {
      positionId,
      updates: Object.keys(updates),
    });

    return position;
  }

  /**
   * Update position price and recalculate P&L
   */
  async updatePositionPrice(positionId: string, currentPrice: number): Promise<Position> {
    const position = this.positions.get(positionId);

    if (!position) {
      throw new ValidationError(`Position ${positionId} not found`);
    }

    position.currentPrice = currentPrice;
    position.unrealizedPnL = this.calculateUnrealizedPnL(position, currentPrice);

    return position;
  }

  /**
   * Update prices for all open positions
   */
  async updatePositionPrices(currentPrices: Record<string, number>): Promise<void> {
    for (const position of this.positions.values()) {
      if (position.status === 'open' && currentPrices[position.symbol]) {
        position.currentPrice = currentPrices[position.symbol];
        position.unrealizedPnL = this.calculateUnrealizedPnL(
          position,
          currentPrices[position.symbol]
        );
      }
    }
  }

  /**
   * Close a position
   */
  async closePosition(positionId: string, exitPrice: number, fee: number = 0): Promise<Position> {
    const position = this.positions.get(positionId);

    if (!position) {
      throw new ValidationError(`Position ${positionId} not found`);
    }

    if (position.status === 'closed') {
      throw new ValidationError(`Position ${positionId} is already closed`);
    }

    position.status = 'closed';
    position.exitPrice = exitPrice;
    position.closedAt = new Date();
    position.realizedPnL = this.calculateRealizedPnL(position, exitPrice);
    position.totalFees += fee;
    position.roi = this.calculateROI(position);

    logger.info('Position closed', {
      positionId,
      exitPrice,
      realizedPnL: position.realizedPnL,
      roi: position.roi,
    });

    return position;
  }

  /**
   * Calculate unrealized P&L
   */
  calculateUnrealizedPnL(position: Position, currentPrice: number): number {
    if (position.status === 'closed') {
      return 0;
    }

    const priceDiff = currentPrice - position.entryPrice;
    const multiplier = position.side === 'long' ? 1 : -1;

    return priceDiff * position.quantity * multiplier;
  }

  /**
   * Calculate realized P&L
   */
  calculateRealizedPnL(position: Position, exitPrice: number): number {
    const priceDiff = exitPrice - position.entryPrice;
    const multiplier = position.side === 'long' ? 1 : -1;

    return priceDiff * position.quantity * multiplier - position.totalFees;
  }

  /**
   * Calculate ROI (Return on Investment)
   */
  calculateROI(position: Position): number {
    const investment = position.entryPrice * position.quantity;

    if (investment === 0) {
      return 0;
    }

    return (position.realizedPnL / investment) * 100;
  }

  /**
   * Get total exposure for a strategy
   */
  getTotalExposure(strategyId?: string): number {
    let totalExposure = 0;

    for (const position of this.positions.values()) {
      if (position.status === 'open') {
        if (!strategyId || position.strategyId === strategyId) {
          totalExposure += position.entryPrice * position.quantity;
        }
      }
    }

    return totalExposure;
  }

  /**
   * Get total P&L (realized + unrealized)
   */
  getTotalPnL(strategyId?: string): number {
    let totalPnL = 0;

    for (const position of this.positions.values()) {
      if (!strategyId || position.strategyId === strategyId) {
        if (position.status === 'open') {
          totalPnL += position.unrealizedPnL;
        } else {
          totalPnL += position.realizedPnL;
        }
      }
    }

    return totalPnL;
  }

  /**
   * Get position count
   */
  getPositionCount(strategyId?: string, status?: PositionStatus): number {
    let count = 0;

    for (const position of this.positions.values()) {
      if (strategyId && position.strategyId !== strategyId) {
        continue;
      }

      if (status && position.status !== status) {
        continue;
      }

      count++;
    }

    return count;
  }

  /**
   * Clear all positions (for testing)
   */
  clearAll(): void {
    this.positions.clear();
    this.positionCounter = 0;
    logger.info('All positions cleared');
  }

  /**
   * Generate unique position ID
   */
  private generatePositionId(): string {
    this.positionCounter++;
    return `pos-${Date.now()}-${this.positionCounter}`;
  }

  /**
   * Get statistics
   */
  getStats(strategyId?: string): {
    totalPositions: number;
    openPositions: number;
    closedPositions: number;
    totalExposure: number;
    totalPnL: number;
    totalUnrealizedPnL: number;
    totalRealizedPnL: number;
  } {
    let totalPositions = 0;
    let openPositions = 0;
    let closedPositions = 0;
    let totalExposure = 0;
    let totalUnrealizedPnL = 0;
    let totalRealizedPnL = 0;

    for (const position of this.positions.values()) {
      if (strategyId && position.strategyId !== strategyId) {
        continue;
      }

      totalPositions++;

      if (position.status === 'open') {
        openPositions++;
        totalExposure += position.entryPrice * position.quantity;
        totalUnrealizedPnL += position.unrealizedPnL;
      } else {
        closedPositions++;
        totalRealizedPnL += position.realizedPnL;
      }
    }

    return {
      totalPositions,
      openPositions,
      closedPositions,
      totalExposure,
      totalPnL: totalUnrealizedPnL + totalRealizedPnL,
      totalUnrealizedPnL,
      totalRealizedPnL,
    };
  }
}

// Export singleton instance
export const positionManager = new PositionManager();
