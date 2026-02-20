mod db;
mod models;
mod errors;
mod config;
mod api;

use dotenvy::dotenv;
use tracing::info;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() {
    dotenv().ok();

    // Initialize structured logging, respecting RUST_LOG env var
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let config = config::Config::from_env();
    let pool = db::create_pool(&config.database_url).await;
    info!("Connected to Postgres");

    let state = api::AppState { db: pool };
    let router = api::create_router(state);

    let addr = format!("0.0.0.0:{}", config.port);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    info!("Server running on http://{}", addr);

    axum::serve(listener, router).await.unwrap();
}
