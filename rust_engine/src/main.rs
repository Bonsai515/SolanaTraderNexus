//! Neural Nexus Solana Transaction Engine
//! 
//! High performance Solana blockchain transaction engine for real-time trading

use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

mod transaction;
mod solana_rpc;
mod wallet;
mod market;

use transaction::Transaction;
use solana_rpc::SolanaRpcClient;
use wallet::WalletManager;
use market::MarketTracker;

/// Main transaction engine configuration
#[derive(Debug, Clone)]
struct EngineConfig {
    use_real_funds: bool,
    rpc_url: String,
    websocket_url: Option<String>,
    system_wallet_address: String,
}

/// Engine status information
#[derive(Debug, Clone)]
struct EngineStatus {
    active: bool,
    transactions_processed: u64,
    successful_transactions: u64,
    last_error: Option<String>,
}

/// Transaction Engine main struct
struct TransactionEngine {
    config: EngineConfig,
    status: Arc<Mutex<EngineStatus>>,
    solana_client: Arc<SolanaRpcClient>,
    wallet_manager: Arc<WalletManager>,
    market_tracker: Arc<MarketTracker>,
}

impl TransactionEngine {
    /// Create a new transaction engine with the given configuration
    fn new(config: EngineConfig) -> Self {
        let solana_client = Arc::new(SolanaRpcClient::new(&config.rpc_url));
        let wallet_manager = Arc::new(WalletManager::new(solana_client.clone(), config.use_real_funds));
        let market_tracker = Arc::new(MarketTracker::new(solana_client.clone()));
        
        TransactionEngine {
            config,
            status: Arc::new(Mutex::new(EngineStatus {
                active: false,
                transactions_processed: 0,
                successful_transactions: 0,
                last_error: None,
            })),
            solana_client,
            wallet_manager,
            market_tracker,
        }
    }
    
    /// Start the transaction engine
    fn start(&self) {
        println!("Starting Neural Nexus Solana Transaction Engine");
        
        {
            let mut status = self.status.lock().unwrap();
            status.active = true;
        }
        
        // Start market tracking
        let market_tracker = self.market_tracker.clone();
        thread::spawn(move || {
            market_tracker.start_tracking();
        });
        
        // Start wallet monitoring
        let wallet_manager = self.wallet_manager.clone();
        thread::spawn(move || {
            wallet_manager.monitor_wallets();
        });
        
        println!("Transaction Engine started successfully");
        println!("Using real funds: {}", self.config.use_real_funds);
        
        // Main loop
        let status = self.status.clone();
        loop {
            thread::sleep(Duration::from_secs(5));
            
            let s = status.lock().unwrap();
            if !s.active {
                break;
            }
            
            println!("Engine Running - Processed: {}, Successful: {}", 
                s.transactions_processed, s.successful_transactions);
        }
    }
    
    /// Execute a transaction
    fn execute_transaction(&self, transaction: Transaction) -> Result<String, String> {
        if !self.config.use_real_funds {
            return Err("Engine is in simulation mode - no real transactions executed".to_string());
        }
        
        // Attempt to execute the transaction
        match self.solana_client.send_transaction(&transaction) {
            Ok(signature) => {
                let mut status = self.status.lock().unwrap();
                status.transactions_processed += 1;
                status.successful_transactions += 1;
                
                println!("Transaction executed successfully: {}", signature);
                Ok(signature)
            },
            Err(e) => {
                let mut status = self.status.lock().unwrap();
                status.transactions_processed += 1;
                status.last_error = Some(e.clone());
                
                println!("Transaction failed: {}", e);
                Err(e)
            }
        }
    }
    
    /// Stop the transaction engine
    fn stop(&self) {
        let mut status = self.status.lock().unwrap();
        status.active = false;
        println!("Stopping Transaction Engine");
    }
}

/// Main function to start the transaction engine
fn main() {
    // Read config from environment or use defaults
    let config = EngineConfig {
        use_real_funds: std::env::var("USE_REAL_FUNDS").unwrap_or_else(|_| "false".into()) == "true",
        rpc_url: std::env::var("SOLANA_RPC_URL").unwrap_or_else(|_| "https://solana-grpc-geyser.instantnodes.io:443".into()),
        websocket_url: std::env::var("SOLANA_WEBSOCKET_URL").ok(),
        system_wallet_address: std::env::var("SYSTEM_WALLET_ADDRESS").unwrap_or_else(|_| "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb".into()),
    };
    
    println!("Neural Nexus Solana Transaction Engine");
    println!("======================================");
    println!("RPC URL: {}", config.rpc_url);
    println!("System Wallet: {}", config.system_wallet_address);
    println!("Using Real Funds: {}", config.use_real_funds);
    
    // Create and start the transaction engine
    let engine = TransactionEngine::new(config);
    engine.start();
}