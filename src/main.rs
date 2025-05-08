mod models;
mod solana;
mod transformers;
mod agents;
mod storage;
mod api;
mod utils;

use actix_web::{web, App, HttpServer, middleware};
use actix_files as fs;
use std::sync::Arc;
use log::{info, error};
use dotenv::dotenv;
use std::env;

use crate::solana::{create_solana_connection, WalletManager, TransactionManager};
use crate::storage::Storage;
use crate::transformers::{MarketDataTransformer, TradingSignalTransformer};
use crate::agents::{TradingAgent, StrategyManager};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Initialize environment
    dotenv().ok();
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));
    
    // Configure host and port
    let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port = env::var("PORT").unwrap_or_else(|_| "5000".to_string())
        .parse::<u16>().expect("PORT must be a number");
    
    info!("Starting Solana Quantum Trading System");
    
    // Initialize storage
    let storage = Arc::new(Storage::new_in_memory());
    
    // Initialize Solana connection
    let solana_connection = match create_solana_connection() {
        Ok(connection) => {
            info!("Connected to Solana blockchain");
            Arc::new(connection)
        },
        Err(e) => {
            error!("Failed to connect to Solana: {:?}", e);
            panic!("Failed to connect to Solana blockchain");
        }
    };
    
    // Initialize wallet and transaction managers
    let wallet_manager = Arc::new(WalletManager::new(
        solana_connection.client(),
        storage.clone(),
    ));
    
    let transaction_manager = Arc::new(TransactionManager::new(
        solana_connection.client(),
        storage.clone(),
    ));
    
    // Initialize transformers
    let market_data_transformer = Arc::new(MarketDataTransformer::new());
    let trading_signal_transformer = Arc::new(TradingSignalTransformer::new());
    
    // Initialize strategy manager
    let strategy_manager = Arc::new(StrategyManager::new(storage.clone()));
    
    // Initialize trading agent
    let trading_agent = Arc::new(TradingAgent::new(
        market_data_transformer.clone(),
        trading_signal_transformer.clone(),
        storage.clone(),
        wallet_manager.clone(),
        transaction_manager.clone(),
    ));
    
    // Start the trading agent
    match trading_agent.start() {
        Ok(_) => info!("Trading agent started"),
        Err(e) => error!("Failed to start trading agent: {:?}", e),
    }
    
    // Start HTTP server
    info!("Starting HTTP server on {}:{}", host, port);
    
    HttpServer::new(move || {
        App::new()
            // Enable logger middleware
            .wrap(middleware::Logger::default())
            
            // Register application state
            .app_data(web::Data::new(storage.clone()))
            .app_data(web::Data::new(solana_connection.clone()))
            .app_data(web::Data::new(wallet_manager.clone()))
            .app_data(web::Data::new(transaction_manager.clone()))
            .app_data(web::Data::new(market_data_transformer.clone()))
            .app_data(web::Data::new(trading_signal_transformer.clone()))
            .app_data(web::Data::new(strategy_manager.clone()))
            .app_data(web::Data::new(trading_agent.clone()))
            
            // Configure API routes
            .configure(api::configure_routes)
            
            // Serve static files from the frontend/dist directory
            .service(fs::Files::new("/", "./frontend/dist").index_file("index.html"))
    })
    .bind((host, port))?
    .run()
    .await
}