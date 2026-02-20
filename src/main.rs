mod db;
mod models;

use std::env;

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

    let database_url = env::var("DATABASE_URL")
        .expect("(main) DATABASE_URL must be set in .env");

    let pool = db::create_pool(&database_url).await;
    info!("(main) Connected to Postgres");

    info!("(main) Trading bot starting...");
}
