use std::sync::Arc;
use log::{info, error};
use anyhow::Result;

mod models;
mod engine;
mod transformers;
mod solana;
mod security;
mod communication;
mod storage;
mod dex;

use crate::communication::CommunicationCenter;
use crate::security::SecurityProtocol;
use crate::storage::Storage;
use crate::solana::{SolanaConnection, WalletManager, TransactionManager};
use crate::engine::TransactionEngine;
use crate::transformers::{MicroQHCTransformer, MEMECortexTransformer};
use crate::dex::{DexClient, TradingStrategy};

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logger
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));
    
    info!("Starting Solana Trading System with Quantum-Inspired Transformers");
    
    // Initialize communication center (central messaging hub)
    let communication_center = Arc::new(CommunicationCenter::new());
    communication_center.start()?;
    info!("Communication Center initialized successfully");
    
    // Initialize security protocol (security layer)
    let security_protocol = Arc::new(SecurityProtocol::new());
    info!("Security Protocol initialized successfully");
    
    // Initialize storage system
    let storage = Arc::new(Storage::new());
    info!("Storage System initialized successfully");
    
    // Initialize Solana connection with custom RPC from environment
    // Will automatically use INSTANT_NODES_RPC_URL from environment if available
    let solana_endpoint = "https://api.mainnet-beta.solana.com"; // Fallback endpoint
    let solana_connection = Arc::new(SolanaConnection::new(solana_endpoint));
    
    // Log whether we're using the custom RPC
    if let Ok(custom_rpc) = std::env::var("INSTANT_NODES_RPC_URL") {
        info!("Using custom Instant Nodes RPC endpoint");
    } else {
        info!("Using default Solana RPC endpoint: {}", solana_endpoint);
    }
    
    // Initialize wallet manager
    let wallet_manager = Arc::new(WalletManager::new(solana_connection.clone()));
    wallet_manager.start()?;
    info!("Wallet Manager initialized successfully");
    
    // Initialize transaction manager
    let transaction_manager = Arc::new(TransactionManager::new(
        solana_connection.clone(),
        wallet_manager.clone(),
    ));
    info!("Transaction Manager initialized successfully");
    
    // Initialize transaction engine (core component)
    let transaction_engine = Arc::new(TransactionEngine::new(
        storage.clone(),
        wallet_manager.clone(),
        transaction_manager.clone(),
        security_protocol.clone(),
        communication_center.clone(),
    ));
    transaction_engine.start()?;
    info!("Transaction Engine started successfully");
    
    // Register components with security protocol
    security_protocol.register_secure_component("TransactionEngine")?;
    security_protocol.register_secure_component("CommunicationCenter")?;
    security_protocol.register_secure_component("SolanaConnection")?;
    security_protocol.register_secure_component("WalletManager")?;
    
    // Initialize DEX client
    info!("Initializing DEX integrations and trading strategies...");
    let dex_client = Arc::new(DexClient::new(
        solana_connection.clone(),
        wallet_manager.clone(),
    ).await?);
    
    // Activate trading strategies
    dex_client.activate_strategy("SOL/USDC", TradingStrategy::MarketMaking)?;
    dex_client.activate_strategy("BTC/USDC", TradingStrategy::RangeTrading)?;
    dex_client.activate_strategy("ETH/USDC", TradingStrategy::MomentumTrading)?;
    info!("Trading strategies activated successfully");
    
    // Display wallet addresses for funding
    let trading_wallet = wallet_manager.get_or_create_wallet("trading")?;
    let collateral_wallet = wallet_manager.get_or_create_wallet("collateral")?;
    
    info!("========== WALLET ADDRESSES FOR FUNDING ==========");
    info!("Trading Wallet Address: {}", trading_wallet.pubkey());
    info!("Collateral Wallet Address: {}", collateral_wallet.pubkey());
    info!("==================================================");
    info!("Please fund these wallets to begin trading operations");
    
    // Tell user the system is ready
    info!("Solana Trading System is fully operational");
    info!("Using specialized transformers: Micro QHC, MEME Cortex, Communication Transformer");
    info!("Trading strategies active - system ready to execute transactions");
    
    // Keep the application running
    loop {
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
    }
    
    // This code will never be reached, but for completeness:
    // transaction_engine.stop()?;
    // wallet_manager.stop()?;
    // communication_center.stop()?;
    
    Ok(())
}