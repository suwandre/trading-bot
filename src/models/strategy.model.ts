/**
 * MongoDB Model for Strategy Configuration
 */

import mongoose, { Schema, Document } from 'mongoose';
import type { StrategyConfig } from '../types';

export interface IStrategyDocument extends Omit<StrategyConfig, 'id'>, Document {}

const RiskParametersSchema = new Schema({
  stopLossPercent: { type: Number, required: false },
  takeProfitPercent: { type: Number, required: false },
  trailingStopPercent: { type: Number, required: false },
  maxPositionSize: { type: Number, required: true },
  maxOpenPositions: { type: Number, required: true },
  maxDrawdownPercent: { type: Number, required: true },
  positionSizePercent: { type: Number, required: false },
}, { _id: false });

const StrategySchema = new Schema<IStrategyDocument>(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ['dca', 'grid', 'custom'], required: true },
    symbol: { type: String, required: true },
    timeframe: { type: String, enum: ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'], required: true },
    mode: { type: String, enum: ['backtest', 'paper', 'live'], required: true },
    parameters: { type: Schema.Types.Mixed, required: true },
    riskParams: { type: RiskParametersSchema, required: true },
    status: { type: String, enum: ['active', 'paused', 'stopped', 'error'], default: 'stopped' },
    initialCapital: { type: Number, required: true },
    currentCapital: { type: Number, required: true },
    startedAt: { type: Date, required: false },
    stoppedAt: { type: Date, required: false },
  },
  {
    timestamps: true,
    collection: 'strategies',
  }
);

// Indexes
StrategySchema.index({ status: 1 });
StrategySchema.index({ type: 1 });
StrategySchema.index({ symbol: 1 });
StrategySchema.index({ mode: 1 });

export const StrategyModel = mongoose.model<IStrategyDocument>('Strategy', StrategySchema);
