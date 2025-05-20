use std::sync::Arc;

pub mod transaction_engine;

use solana_program::pubkey::Pubkey;
use solana_sdk::signature::Keypair;

/// Public API for the Solana transaction engine
pub struct SolanaEngine {
    engine: Arc<std::sync::Mutex<transaction_engine::SolanaTransactionEngine>>,
}

impl SolanaEngine {
    /// Create a new Solana Engine instance
    pub fn new() -> Self {
        Self {
            engine: transaction_engine::get_transaction_engine(),
        }
    }
    
    /// Initialize the direct connection to Solana and verify it works
    pub fn initialize(&self) -> bool {
        // Engine is already initialized in the singleton accessor
        true
    }
    
    /// Register a wallet for transaction execution and monitoring
    pub fn register_wallet(&self, address: Pubkey) {
        if let Ok(mut engine) = self.engine.lock() {
            engine.register_wallet(address);
        }
    }
    
    /// Get the balance of a wallet in SOL
    pub fn get_wallet_balance(&self, address: &Pubkey) -> Result<f64, String> {
        match self.engine.lock() {
            Ok(engine) => engine.get_wallet_balance(address).map_err(|e| e.to_string()),
            Err(e) => Err(format!("Failed to get engine lock: {}", e)),
        }
    }
    
    /// Transfer SOL from one wallet to another
    pub fn transfer_sol(
        &self,
        from_keypair: &Keypair,
        to_pubkey: &Pubkey,
        sol_amount: f64,
        high_priority: bool,
    ) -> Result<String, String> {
        match self.engine.lock() {
            Ok(mut engine) => {
                let priority = if high_priority {
                    transaction_engine::TransactionPriority::High
                } else {
                    transaction_engine::TransactionPriority::Medium
                };
                
                match engine.transfer_sol(from_keypair, to_pubkey, sol_amount, priority) {
                    Ok(result) => {
                        if let Some(signature) = result.signature {
                            Ok(signature.to_string())
                        } else {
                            Err("Transaction succeeded but no signature returned".to_string())
                        }
                    }
                    Err(e) => Err(format!("Transfer failed: {}", e)),
                }
            }
            Err(e) => Err(format!("Failed to get engine lock: {}", e)),
        }
    }
    
    /// Get transaction engine statistics
    pub fn get_stats(&self) -> (u64, u64) {
        match self.engine.lock() {
            Ok(engine) => engine.get_stats(),
            Err(_) => (0, 0),
        }
    }
}

// Default implementation to make it easier to use
impl Default for SolanaEngine {
    fn default() -> Self {
        Self::new()
    }
}