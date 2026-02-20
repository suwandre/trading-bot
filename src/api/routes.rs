use axum::{routing::get, Router};
use super::{AppState, handlers};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/positions",     get(handlers::get_positions))
        .route("/positions/{id}", get(handlers::get_position_by_id))
        .route("/trades",        get(handlers::get_trades))
}
