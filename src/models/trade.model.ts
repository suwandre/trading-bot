/**
 * MongoDB Model for Trade Records
 */

import mongoose, { Schema, Document } from 'mongoose';
import type { Trade } from '../types';

export interface ITradeDocument extends Omit<Trade, 'id'>, Document {}

const TradeSchema = new Schema<ITradeDocument>(
  {
    strategyId: { type: String, required: true, index: true },
    positionId: { type: String, required: false },
    orderId: { type: String, required: true },
    symbol: { type: String, required: true, index: true },
    side: { type: String, enum: ['buy', 'sell'], required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    fee: { type: Number, required: true },
    feeAsset: { type: String, required: true },
    pnl: { type: Number, required: false },
    timestamp: { type: Date, required: true, index: true },
    exchangeTradeId: { type: String, required: false },
  },
  {
    timestamps: false,
    collection: 'trades',
  }
);

// Indexes for efficient queries
TradeSchema.index({ strategyId: 1, timestamp: -1 });
TradeSchema.index({ symbol: 1, timestamp: -1 });
TradeSchema.index({ timestamp: -1 });

export const TradeModel = mongoose.model<ITradeDocument>('Trade', TradeSchema);
