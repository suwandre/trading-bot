/**
 * Position related types
 */

import type { PositionSide, PositionStatus } from './common.types';

// Position interface
export interface Position {
  id: string;
  strategyId: string;
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  unrealizedPnL: number;
  realizedPnL: number;
  totalFees: number;
  stopLoss?: number;
  takeProfit?: number;
  status: PositionStatus;
  openedAt: Date;
  closedAt?: Date;
  exitPrice?: number;
  roi?: number; // Return on investment %
}

// Position update event
export interface PositionUpdate {
  positionId: string;
  currentPrice: number;
  unrealizedPnL: number;
  timestamp: Date;
}

// Position creation request
export interface CreatePositionRequest {
  strategyId: string;
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  quantity: number;
  stopLoss?: number;
  takeProfit?: number;
}
