/**
 * Order related types
 */

import type { OrderSide, OrderType, OrderStatus } from './common.types';

// Order interface
export interface Order {
  id: string;
  strategyId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number; // For limit orders
  stopPrice?: number; // For stop orders
  status: OrderStatus;
  filledQuantity: number;
  averageFillPrice: number;
  fee: number;
  feeAsset: string;
  createdAt: Date;
  updatedAt: Date;
  filledAt?: Date;
  cancelledAt?: Date;
  exchangeOrderId?: string; // ID from exchange
  clientOrderId?: string; // Our internal ID
}

// Order fill event
export interface OrderFill {
  orderId: string;
  quantity: number;
  price: number;
  fee: number;
  feeAsset: string;
  timestamp: Date;
}

// Order creation request
export interface CreateOrderRequest {
  strategyId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  stopPrice?: number;
}
