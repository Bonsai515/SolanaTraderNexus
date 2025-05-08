// Main entry point for the Solana Quantum Trading System

use solana_quantum_trading::*;
use solana_quantum_trading::solana::connection::{SolanaConnection, ConnectionConfig};
use solana_quantum_trading::solana::wallet_manager::{WalletManager, WalletManagerConfig};
use solana_quantum_trading::solana::rate_limiter::{RateLimiter, RateLimiterConfig};
use solana_quantum_trading::solana::transaction_manager::{TransactionManager, TransactionManagerConfig};
use solana_quantum_trading::transformers::{TransformerConfig};

use anyhow::{Result, anyhow, Context};
use log::{info, warn, error, debug, LevelFilter};
use simple_logger::SimpleLogger;
use std::sync::Arc;
use std::env;
use structopt::StructOpt;
use dotenv::dotenv;

#[derive(StructOpt, Debug)]
#[structopt(name = "solana-quantum-trading")]
struct Opt {
    /// Config file path
    #[structopt(short, long, default_value = "config.json")]
    config: String,
    
    /// Log level
    #[structopt(short, long, default_value = "info")]
    log_level: String,
    
    /// Command to execute
    #[structopt(subcommand)]
    cmd: Option<Command>,
}

#[derive(StructOpt, Debug)]
enum Command {
    /// Initialize components
    #[structopt(name = "init")]
    Init {
        /// Components to initialize (all, connection, wallet, transformer)
        #[structopt(default_value = "all")]
        component: String,
    },
    
    /// Create a new wallet
    #[structopt(name = "create-wallet")]
    CreateWallet {
        /// Wallet name
        #[structopt(short, long)]
        name: String,
    },
    
    /// List wallets
    #[structopt(name = "list-wallets")]
    ListWallets,
    
    /// Check RPC connection
    #[structopt(name = "check-connection")]
    CheckConnection,
}

// Load wallet encryption key from environment or generate one
fn load_wallet_encryption_key() -> Result<[u8; 32]> {
    if let Ok(key_hex) = env::var("WALLET_ENCRYPTION_KEY") {
        // Convert hex string to bytes
        let key_bytes = hex::decode(key_hex)?;
        
        if key_bytes.len() != 32 {
            return Err(anyhow!("Invalid wallet encryption key length"));
        }
        
        let mut key = [0u8; 32];
        key.copy_from_slice(&key_bytes);
        Ok(key)
    } else {
        // Generate a random key
        warn!("No wallet encryption key found in environment, generating a random one");
        warn!("Please set WALLET_ENCRYPTION_KEY environment variable for production use");
        
        let mut key = [0u8; 32];
        getrandom::getrandom(&mut key)?;
        Ok(key)
    }
}

// Initialize solana connection
fn init_solana_connection() -> Result<Arc<SolanaConnection>> {
    let config = ConnectionConfig {
        primary_endpoint: env::var("INSTANT_NODES_RPC_URL").ok(),
        fallback_endpoint: Some("https://api.mainnet-beta.solana.com".to_string()),
        commitment: "confirmed".to_string(),
        timeout_seconds: 30,
        health_check_seconds: 60,
    };
    
    let connection = SolanaConnection::new(config)?;
    let connection = Arc::new(connection);
    
    // Initialize connection
    info!("Initializing Solana connection...");
    connection.initialize()?;
    
    // Check health
    let health = connection.get_health();
    info!("Solana connection health: {:?}", health.status);
    
    if let Some(version) = health.version {
        info!("Solana version: {}", version);
    }
    
    Ok(connection)
}

// Initialize wallet manager
fn init_wallet_manager() -> Result<Arc<WalletManager>> {
    // Load encryption key
    let master_key = load_wallet_encryption_key()?;
    
    let config = WalletManagerConfig {
        wallet_dir: "data/wallets".to_string(),
        master_key: Some(master_key),
        auto_save: true,
    };
    
    info!("Initializing wallet manager...");
    let wallet_manager = WalletManager::new(config)?;
    let wallet_manager = Arc::new(wallet_manager);
    
    // List wallets
    let wallets = wallet_manager.get_wallets()?;
    info!("Loaded {} wallets", wallets.len());
    
    Ok(wallet_manager)
}

// Initialize rate limiter
fn init_rate_limiter() -> Result<Arc<std::sync::RwLock<RateLimiter>>> {
    let config = RateLimiterConfig {
        max_requests: 100,
        interval_seconds: 10,
        burst_allowance: 10,
    };
    
    info!("Initializing rate limiter...");
    let rate_limiter = RateLimiter::new(config);
    let rate_limiter = Arc::new(std::sync::RwLock::new(rate_limiter));
    
    Ok(rate_limiter)
}

// Initialize transaction manager
fn init_transaction_manager(
    connection: Arc<SolanaConnection>,
    rate_limiter: Arc<std::sync::RwLock<RateLimiter>>,
    wallet_manager: Arc<WalletManager>,
) -> Result<Arc<TransactionManager>> {
    let config = TransactionManagerConfig {
        max_queue_size: 1000,
        min_submit_interval_ms: 200,
        retry_interval_ms: 5000,
        max_concurrent_transactions: 5,
        default_priority: solana_quantum_trading::solana::transaction_manager::TransactionPriority::Normal,
        default_max_retries: 3,
        auto_retry: true,
    };
    
    info!("Initializing transaction manager...");
    let transaction_manager = TransactionManager::new(
        connection,
        config,
        rate_limiter,
        Some(wallet_manager),
    );
    
    let transaction_manager = Arc::new(transaction_manager);
    
    // Start the transaction manager
    transaction_manager.start()?;
    
    Ok(transaction_manager)
}

// Main function
fn main() -> Result<()> {
    // Load environment variables from .env file
    dotenv().ok();
    
    // Parse command line arguments
    let opt = Opt::from_args();
    
    // Initialize logger
    let log_level = match opt.log_level.to_lowercase().as_str() {
        "error" => LevelFilter::Error,
        "warn" => LevelFilter::Warn,
        "info" => LevelFilter::Info,
        "debug" => LevelFilter::Debug,
        "trace" => LevelFilter::Trace,
        _ => LevelFilter::Info,
    };
    
    SimpleLogger::new()
        .with_level(log_level)
        .init()?;
    
    info!("Solana Quantum Trading System starting up...");
    
    // Process command
    match opt.cmd {
        Some(Command::Init { component }) => {
            let components = component.to_lowercase();
            
            if components == "all" || components == "connection" {
                let _connection = init_solana_connection()?;
            }
            
            if components == "all" || components == "wallet" {
                let _wallet_manager = init_wallet_manager()?;
            }
            
            if components == "all" || components == "transformer" {
                info!("Transformer initialization not implemented yet");
            }
            
            info!("Initialization complete");
        }
        Some(Command::CreateWallet { name }) => {
            // Initialize wallet manager
            let wallet_manager = init_wallet_manager()?;
            
            // Generate a unique ID
            let id = uuid::Uuid::new_v4().to_string();
            
            // Create wallet
            let wallet = wallet_manager.create_wallet(&id, &name)?;
            
            info!("Created new wallet:");
            info!("  ID: {}", wallet.id);
            info!("  Name: {}", wallet.name);
            info!("  Public Key: {}", wallet.public_key);
        }
        Some(Command::ListWallets) => {
            // Initialize wallet manager
            let wallet_manager = init_wallet_manager()?;
            
            // List wallets
            let wallets = wallet_manager.get_wallets()?;
            
            if wallets.is_empty() {
                info!("No wallets found");
            } else {
                info!("Found {} wallets:", wallets.len());
                
                for wallet in wallets {
                    info!("  ID: {}", wallet.id);
                    info!("  Name: {}", wallet.name);
                    info!("  Public Key: {}", wallet.public_key);
                    info!("  Created: {}", wallet.created_at);
                    info!("");
                }
            }
        }
        Some(Command::CheckConnection) => {
            // Initialize connection
            let connection = init_solana_connection()?;
            
            // Check health
            let health = connection.check_health()?;
            
            info!("Connection status: {:?}", health.status);
            info!("Active endpoint: {}", health.active_endpoint);
            
            if let Some(version) = health.version {
                info!("Solana version: {}", version);
            }
        }
        None => {
            // Default operation mode - start everything
            
            // Initialize connection
            let connection = init_solana_connection()?;
            
            // Initialize wallet manager
            let wallet_manager = init_wallet_manager()?;
            
            // Initialize rate limiter
            let rate_limiter = init_rate_limiter()?;
            
            // Initialize transaction manager
            let transaction_manager = init_transaction_manager(
                connection.clone(),
                rate_limiter.clone(),
                wallet_manager.clone(),
            )?;
            
            info!("System initialized and ready");
            
            // Run forever
            loop {
                std::thread::sleep(std::time::Duration::from_secs(1));
            }
        }
    }
    
    Ok(())
}