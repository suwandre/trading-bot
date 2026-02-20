use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::Type;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq)]
#[sqlx(type_name = "trade_side", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TradeSide {
    Buy,
    Sell,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq)]
#[sqlx(type_name = "position_status", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PositionStatus {
    Open,
    Closed,
}

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
pub struct Position {
    pub id:          Uuid,
    pub symbol:      String,
    pub side:        TradeSide,
    pub entry_price: Decimal,
    pub quantity:    Decimal,
    pub status:      PositionStatus,
    pub created_at:  DateTime<Utc>,
    pub updated_at:  DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Order {
    pub id:                Uuid,
    pub exchange_order_id: Option<String>,  // Option = nullable column
    pub position_id:       Option<Uuid>,
    pub symbol:            String,
    pub side:              TradeSide,
    pub order_type:        OrderType,
    pub price:             Option<Decimal>, // MARKET orders have no price
    pub quantity:          Decimal,
    pub status:            OrderStatus,
    pub created_at:        DateTime<Utc>,
    pub updated_at:        DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Trade {
    pub id:           Uuid,
    pub order_id:     Option<Uuid>,
    pub symbol:       String,
    pub side:         TradeSide,
    pub price:        Decimal,
    pub quantity:     Decimal,
    pub fee:          Decimal,
    pub realised_pnl: Decimal,
    pub created_at:   DateTime<Utc>,
}
