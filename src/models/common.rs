use serde::{Deserialize, Serialize};
use sqlx::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq)]
#[sqlx(type_name = "trade_side", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TradeSide {
    Buy,
    Sell,
}
