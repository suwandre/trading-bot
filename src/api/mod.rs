pub mod routes;
pub mod handlers;

use axum::Router;
use sqlx::PgPool;

// AppState holds everything the handlers need access to.
#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
}

pub fn create_router(state: AppState) -> Router {
    Router::new()
        .nest("/api/v1", routes::routes())
        .with_state(state)
}
