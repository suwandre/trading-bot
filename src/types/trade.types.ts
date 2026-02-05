/**
 * Trade related types
 */

import type { OrderSide } from './common.types';

// Trade record (completed transaction)
export interface Trade {
  id: string;
  strategyId: string;
  positionId?: string;
  orderId: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  price: number;
  fee: number;
  feeAsset: string;
  pnl?: number; // For closing trades
  timestamp: Date;
  exchangeTradeId?: string;
}

// Trade summary
export interface TradeSummary {
  totalTrades: number;
  totalVolume: number;
  totalFees: number;
  totalPnL: number;
  winningTrades: number;
  losingTrades: number;
  averageWin: number;
  averageLoss: number;
}
