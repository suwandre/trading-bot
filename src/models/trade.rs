use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use super::common::TradeSide;

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
