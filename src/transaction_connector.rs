// Transaction Connector to Your Existing GitHub Transaction Engine
// This connector directly interfaces with your existing Solana transaction engine

use solana_client::rpc_client::RpcClient;
use solana_program::pubkey::Pubkey;
use solana_sdk::signature::{Keypair, Signature};
use std::{env, str::FromStr, sync::Arc, time::Duration};
use thiserror::Error;
use log::{info, error, warn};

/// Import your existing transaction engine
extern "C" {
    fn initialize_transaction_engine(rpc_url: *const u8, rpc_url_len: usize) -> bool;
    fn register_wallet(wallet_address: *const u8, wallet_address_len: usize) -> bool;
    fn execute_transaction(tx_data: *const u8, tx_data_len: usize, signature_out: *mut u8, signature_out_len: usize) -> bool;
    fn get_wallet_balance(wallet_address: *const u8, wallet_address_len: usize, balance_out: *mut f64) -> bool;
    fn shutdown_transaction_engine() -> bool;
}

// Error type for the connector
#[derive(Error, Debug)]
pub enum TransactionConnectorError {
    #[error("Failed to initialize transaction engine: {0}")]
    InitializationError(String),
    
    #[error("Failed to register wallet: {0}")]
    WalletRegistrationError(String),
    
    #[error("Failed to execute transaction: {0}")]
    TransactionError(String),
    
    #[error("Invalid wallet address: {0}")]
    InvalidWalletError(String),
    
    #[error("Balance check failed: {0}")]
    BalanceCheckError(String),
}

// Transaction result
#[derive(Debug, Clone)]
pub struct TransactionResult {
    pub success: bool,
    pub signature: Option<String>,
    pub error: Option<String>,
}

// Connector to your GitHub transaction engine
pub struct TransactionConnector {
    // System wallet for profit collection
    system_wallet: Pubkey,
    // Flag to track initialization
    initialized: bool,
    // Total number of successful transactions
    successful_txs: u64,
    // Total number of failed transactions
    failed_txs: u64,
}

impl TransactionConnector {
    // Create a new connector
    pub fn new() -> Result<Self, TransactionConnectorError> {
        // Parse system wallet from environment or use default
        let system_wallet_str = env::var("SYSTEM_WALLET")
            .unwrap_or_else(|_| "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb".to_string());
        
        let system_wallet = match Pubkey::from_str(&system_wallet_str) {
            Ok(pubkey) => pubkey,
            Err(e) => return Err(TransactionConnectorError::InvalidWalletError(e.to_string())),
        };
        
        // Create the connector
        let mut connector = Self {
            system_wallet,
            initialized: false,
            successful_txs: 0,
            failed_txs: 0,
        };
        
        // Initialize the connection to your engine
        connector.initialize()?;
        
        Ok(connector)
    }
    
    // Initialize the transaction engine
    pub fn initialize(&mut self) -> Result<(), TransactionConnectorError> {
        if self.initialized {
            return Ok(());
        }
        
        // Get the best RPC URL
        let rpc_url = self.get_best_rpc_url();
        info!("Initializing transaction engine with RPC URL: {}", rpc_url);
        
        // Convert to C string
        let rpc_url_bytes = rpc_url.as_bytes();
        
        // Call the external function
        let result = unsafe {
            initialize_transaction_engine(
                rpc_url_bytes.as_ptr(),
                rpc_url_bytes.len()
            )
        };
        
        if result {
            info!("✅ Transaction engine initialized successfully");
            self.initialized = true;
            
            // Register the system wallet
            self.register_wallet(self.system_wallet)?;
            
            Ok(())
        } else {
            error!("❌ Failed to initialize transaction engine");
            Err(TransactionConnectorError::InitializationError(
                "Failed to initialize transaction engine".to_string()
            ))
        }
    }
    
    // Register a wallet with the transaction engine
    pub fn register_wallet(&self, pubkey: Pubkey) -> Result<(), TransactionConnectorError> {
        if !self.initialized {
            return Err(TransactionConnectorError::InitializationError(
                "Transaction engine not initialized".to_string()
            ));
        }
        
        // Convert pubkey to string
        let wallet_str = pubkey.to_string();
        let wallet_bytes = wallet_str.as_bytes();
        
        // Call the external function
        let result = unsafe {
            register_wallet(
                wallet_bytes.as_ptr(),
                wallet_bytes.len()
            )
        };
        
        if result {
            info!("✅ Wallet registered successfully: {}", pubkey);
            Ok(())
        } else {
            error!("❌ Failed to register wallet: {}", pubkey);
            Err(TransactionConnectorError::WalletRegistrationError(
                format!("Failed to register wallet: {}", pubkey)
            ))
        }
    }
    
    // Execute a transaction
    pub fn execute_transaction(&mut self, tx_data: &[u8]) -> Result<TransactionResult, TransactionConnectorError> {
        if !self.initialized {
            return Err(TransactionConnectorError::InitializationError(
                "Transaction engine not initialized".to_string()
            ));
        }
        
        // Prepare output buffer for signature (64 bytes + null terminator)
        let mut signature_buffer = vec![0u8; 65];
        
        // Call the external function
        let result = unsafe {
            execute_transaction(
                tx_data.as_ptr(),
                tx_data.len(),
                signature_buffer.as_mut_ptr(),
                signature_buffer.len()
            )
        };
        
        if result {
            // Find the null terminator
            let null_pos = signature_buffer.iter()
                .position(|&byte| byte == 0)
                .unwrap_or(signature_buffer.len());
            
            // Convert signature to string
            let signature = String::from_utf8_lossy(&signature_buffer[0..null_pos]).to_string();
            
            info!("✅ Transaction executed successfully");
            info!("🔗 Transaction signature: {}", signature);
            info!("🔍 View on Solscan: https://solscan.io/tx/{}", signature);
            
            self.successful_txs += 1;
            
            Ok(TransactionResult {
                success: true,
                signature: Some(signature),
                error: None,
            })
        } else {
            error!("❌ Transaction execution failed");
            
            self.failed_txs += 1;
            
            Ok(TransactionResult {
                success: false,
                signature: None,
                error: Some("Transaction execution failed".to_string()),
            })
        }
    }
    
    // Get wallet balance
    pub fn get_wallet_balance(&self, pubkey: Pubkey) -> Result<f64, TransactionConnectorError> {
        if !self.initialized {
            return Err(TransactionConnectorError::InitializationError(
                "Transaction engine not initialized".to_string()
            ));
        }
        
        // Convert pubkey to string
        let wallet_str = pubkey.to_string();
        let wallet_bytes = wallet_str.as_bytes();
        
        // Prepare output variable for balance
        let mut balance: f64 = 0.0;
        
        // Call the external function
        let result = unsafe {
            get_wallet_balance(
                wallet_bytes.as_ptr(),
                wallet_bytes.len(),
                &mut balance
            )
        };
        
        if result {
            Ok(balance)
        } else {
            Err(TransactionConnectorError::BalanceCheckError(
                format!("Failed to get balance for wallet: {}", pubkey)
            ))
        }
    }
    
    // Shut down the transaction engine
    pub fn shutdown(&mut self) -> Result<(), TransactionConnectorError> {
        if !self.initialized {
            return Ok(());
        }
        
        // Call the external function
        let result = unsafe {
            shutdown_transaction_engine()
        };
        
        if result {
            info!("✅ Transaction engine shut down successfully");
            self.initialized = false;
            Ok(())
        } else {
            error!("❌ Failed to shut down transaction engine");
            Err(TransactionConnectorError::InitializationError(
                "Failed to shut down transaction engine".to_string()
            ))
        }
    }
    
    // Get statistics
    pub fn get_stats(&self) -> (u64, u64) {
        (self.successful_txs, self.failed_txs)
    }
    
    // Capture profits to system wallet
    pub fn capture_profits(&mut self, from_wallet: &Keypair) -> Result<TransactionResult, TransactionConnectorError> {
        if !self.initialized {
            return Err(TransactionConnectorError::InitializationError(
                "Transaction engine not initialized".to_string()
            ));
        }
        
        // Get current balance
        let balance = self.get_wallet_balance(from_wallet.pubkey())?;
        
        // Keep some SOL for fees (0.01 SOL)
        const KEEP_SOL: f64 = 0.01;
        
        if balance <= KEEP_SOL {
            return Err(TransactionConnectorError::BalanceCheckError(
                format!("Insufficient balance to capture profits: {:.9} SOL", balance)
            ));
        }
        
        // Amount to transfer
        let amount = balance - KEEP_SOL;
        
        info!("Capturing {:.9} SOL profits to system wallet: {}", amount, self.system_wallet);
        
        // TODO: Create and sign the transfer transaction using your existing code
        // This should match exactly how your GitHub implementation expects transactions
        
        // For placeholder, we'll create a JSON blob that your engine would understand
        let tx_data = format!(r#"{{
            "type": "TRANSFER",
            "fromPublicKey": "{}",
            "toPublicKey": "{}",
            "amount": {},
            "priority": "HIGH"
        }}"#, from_wallet.pubkey(), self.system_wallet, amount);
        
        // Execute the transaction
        self.execute_transaction(tx_data.as_bytes())
    }
    
    // Get the best RPC URL based on environment
    fn get_best_rpc_url(&self) -> String {
        // Try InstantNodes first (highest performance)
        if let Ok(url) = env::var("INSTANT_NODES_RPC_URL") {
            return url;
        }
        
        // Try Alchemy next
        if let Ok(key) = env::var("SOLANA_RPC_API_KEY") {
            return format!("https://solana-mainnet.g.alchemy.com/v2/{}", key);
        }
        
        // Fallback to public RPC
        "https://api.mainnet-beta.solana.com".to_string()
    }
}

// Implement Drop to ensure we shutdown the engine
impl Drop for TransactionConnector {
    fn drop(&mut self) {
        if self.initialized {
            let _ = self.shutdown();
        }
    }
}

// Create a singleton for the connector
static mut CONNECTOR: Option<Arc<std::sync::Mutex<TransactionConnector>>> = None;
static INIT: std::sync::Once = std::sync::Once::new();

// Get the connector singleton
pub fn get_transaction_connector() -> Arc<std::sync::Mutex<TransactionConnector>> {
    unsafe {
        INIT.call_once(|| {
            match TransactionConnector::new() {
                Ok(connector) => {
                    CONNECTOR = Some(Arc::new(std::sync::Mutex::new(connector)));
                }
                Err(e) => {
                    panic!("Failed to create transaction connector: {:?}", e);
                }
            }
        });
        
        CONNECTOR.clone().unwrap()
    }
}