use anyhow::{Result, Context};
use log::{info, warn, error, debug};
use std::sync::Arc;
use std::env;
use std::path::Path;
use env_logger::Env;

use solana_quantum_trading::solana::{SolanaConnection, WalletManager, TransactionManager};
use solana_quantum_trading::dex::{DexClient, TradingStrategy};

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logger
    env_logger::init_from_env(Env::default().default_filter_or("info"));
    
    // Display welcome message
    info!("================================================");
    info!("Solana Quantum Trading Platform - Rust Edition");
    info!("Initializing components...");
    info!("================================================");
    
    // Check for required environment variables
    if !check_environment() {
        return Err(anyhow::anyhow!("Missing required environment variables"));
    }
    
    // Initialize connection to Solana
    let solana_connection = Arc::new(SolanaConnection::new("https://api.mainnet-beta.solana.com"));
    info!("Solana connection initialized");
    
    // Initialize wallet manager
    let wallet_manager = Arc::new(WalletManager::new(solana_connection.clone()));
    wallet_manager.init()?;
    info!("Wallet manager initialized");
    
    // Create wallets for trading
    let trading_wallet = wallet_manager.get_or_create_wallet("trading")?;
    let collateral_wallet = wallet_manager.get_or_create_wallet("collateral")?;
    
    info!("Wallet addresses for funding:");
    info!("  Trading Wallet: {}", trading_wallet.address);
    info!("  Collateral Wallet: {}", collateral_wallet.address);
    
    // Initialize transaction manager
    let transaction_manager = Arc::new(TransactionManager::new(
        solana_connection.clone(),
        wallet_manager.clone()
    ));
    transaction_manager.start()?;
    info!("Transaction manager initialized");
    
    // Initialize DEX client
    info!("Initializing DEX client...");
    match DexClient::new(
        solana_connection.clone(),
        wallet_manager.clone(),
    ).await {
        Ok(dex_client) => {
            let dex_client = Arc::new(dex_client);
            
            // Activate trading strategies
            dex_client.activate_strategy("SOL/USDC", TradingStrategy::MarketMaking)?;
            dex_client.activate_strategy("BTC/USDC", TradingStrategy::RangeTrading)?;
            dex_client.activate_strategy("ETH/USDC", TradingStrategy::MomentumTrading)?;
            
            info!("Trading strategies activated successfully");
            
            // Keep the application running
            info!("Solana Quantum Trading Platform is operational");
            info!("Press Ctrl+C to exit");
            
            // Wait for shutdown signal
            tokio::signal::ctrl_c().await?;
            
            // Cleanup and exit
            info!("Shutting down...");
            dex_client.stop()?;
            transaction_manager.stop()?;
            wallet_manager.stop()?;
        }
        Err(e) => {
            error!("Failed to initialize DEX client: {}", e);
            return Err(anyhow::anyhow!("DEX client initialization failed"));
        }
    }
    
    info!("Application shutdown complete");
    
    Ok(())
}

/// Check if required environment variables are set
fn check_environment() -> bool {
    let mut all_vars_present = true;
    
    // Check for custom RPC URL or API key
    if env::var("INSTANT_NODES_RPC_URL").is_err() && env::var("SOLANA_RPC_API_KEY").is_err() {
        warn!("Neither INSTANT_NODES_RPC_URL nor SOLANA_RPC_API_KEY environment variable is set");
        warn!("Using public Solana RPC endpoint, which may have rate limits");
        // Don't fail, just warn
    }
    
    // Check for wallet encryption key
    if env::var("WALLET_ENCRYPTION_KEY").is_err() {
        warn!("WALLET_ENCRYPTION_KEY environment variable is not set");
        warn!("Using temporary encryption key - wallets will not persist after restart");
        // Don't fail, just warn
    }
    
    all_vars_present
}