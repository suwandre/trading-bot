use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use super::{common::TradeSide, order::{OrderStatus, OrderType}};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Balance {
    pub asset:     String,
    pub available: Decimal,
    pub locked:    Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Ticker {
    pub symbol:    String,
    pub bid:       Decimal,
    pub ask:       Decimal,
    pub last:      Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaceOrderRequest {
    pub symbol:     String,
    pub side:       TradeSide,
    pub order_type: OrderType,
    pub quantity:   Decimal,
    pub price:      Option<Decimal>, // None for MARKET orders
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaceOrderResponse {
    pub exchange_order_id: String,
    pub symbol:            String,
    pub status:            OrderStatus,
}