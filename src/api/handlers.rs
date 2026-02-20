use axum::{
    extract::{Path, State},
    Json,
};
use uuid::Uuid;

use crate::{errors::AppError, models::{Position, Trade}};
use super::AppState;

pub async fn get_positions(
    State(state): State<AppState>,
) -> Result<Json<Vec<Position>>, AppError> {
    let positions = sqlx::query_as!(
        Position,
        r#"
        SELECT
            id, symbol,
            side        AS "side: _",
            entry_price, quantity,
            status      AS "status: _",
            created_at, updated_at
        FROM positions
        ORDER BY created_at DESC
        "#
    )
    .fetch_all(&state.db)
    .await?;  // converts sqlx::Error into AppError::Database via #[from]

    Ok(Json(positions))
}

pub async fn get_position_by_id(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Position>, AppError> {
    let position = sqlx::query_as!(
        Position,
        r#"
        SELECT
            id, symbol,
            side        AS "side: _",
            entry_price, quantity,
            status      AS "status: _",
            created_at, updated_at
        FROM positions
        WHERE id = $1
        "#,
        id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Position {} not found", id)))?;

    Ok(Json(position))
}

pub async fn get_trades(
    State(state): State<AppState>,
) -> Result<Json<Vec<Trade>>, AppError> {
    let trades = sqlx::query_as!(
        Trade,
        r#"
        SELECT
            id, order_id, symbol,
            side AS "side: _",
            price, quantity, fee, realised_pnl, created_at
        FROM trades
        ORDER BY created_at DESC
        "#
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(trades))
}
