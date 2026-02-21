use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::Type;
use uuid::Uuid;
use super::common::TradeSide;

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq)]
#[sqlx(type_name = "position_status", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PositionStatus {
    Open,
    Closed,
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
