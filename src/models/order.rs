use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::Type;
use uuid::Uuid;
use super::common::TradeSide;

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq)]
#[sqlx(type_name = "order_status", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum OrderStatus {
    Pending,
    Filled,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq)]
#[sqlx(type_name = "order_type", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum OrderType {
    Market,
    Limit,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Order {
    pub id:                Uuid,
    pub exchange_order_id: Option<String>,
    pub position_id:       Option<Uuid>,
    pub symbol:            String,
    pub side:              TradeSide,
    pub order_type:        OrderType,
    pub price:             Option<Decimal>,
    pub quantity:          Decimal,
    pub status:            OrderStatus,
    pub created_at:        DateTime<Utc>,
    pub updated_at:        DateTime<Utc>,
}
