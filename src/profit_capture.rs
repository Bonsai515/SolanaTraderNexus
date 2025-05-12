use crate::transaction_engine::{SolanaTransactionEngine, TransactionPriority, TransactionResult};
use solana_program::{
    instruction::Instruction,
    pubkey::Pubkey,
    system_instruction,
};
use solana_sdk::{
    signature::{Keypair, Signature},
    signer::Signer,
};
use std::{env, str::FromStr, sync::{Arc, Mutex}, time::Duration};
use thiserror::Error;
use log::{info, warn, error};

/// Profit capture errors
#[derive(Error, Debug)]
pub enum ProfitCaptureError {
    #[error("Failed to capture profits: {0}")]
    CaptureFailed(String),
    
    #[error("Invalid wallet: {0}")]
    InvalidWallet(String),
    
    #[error("Insufficient funds: {0}")]
    InsufficientFunds(String),
    
    #[error("Transaction engine error: {0}")]
    EngineError(String),
}

/// Profit capture strategy
pub enum ProfitCaptureStrategy {
    /// Capture all profits instantly
    Instant,
    
    /// Capture profits when they reach a threshold
    Threshold(f64),
    
    /// Capture profits on a schedule (minutes)
    Scheduled(u64),
}

/// Profit Capture Engine
pub struct ProfitCaptureEngine {
    /// The Solana transaction engine
    engine: Arc<Mutex<SolanaTransactionEngine>>,
    
    /// The profit wallet public key
    profit_wallet: Pubkey,
    
    /// Total profits captured
    total_captured: f64,
    
    /// Profit capture strategy
    strategy: ProfitCaptureStrategy,
    
    /// Last capture time
    last_capture_time: std::time::Instant,
}

impl ProfitCaptureEngine {
    /// Create a new profit capture engine
    pub fn new(engine: Arc<Mutex<SolanaTransactionEngine>>, profit_wallet: Pubkey) -> Self {
        // Default to instant profit capture
        let strategy = ProfitCaptureStrategy::Instant;
        
        Self {
            engine,
            profit_wallet,
            total_captured: 0.0,
            strategy,
            last_capture_time: std::time::Instant::now(),
        }
    }
    
    /// Initialize with a specific profit capture strategy
    pub fn with_strategy(mut self, strategy: ProfitCaptureStrategy) -> Self {
        self.strategy = strategy;
        self
    }
    
    /// Set the profit wallet
    pub fn set_profit_wallet(&mut self, profit_wallet: Pubkey) {
        self.profit_wallet = profit_wallet;
        
        // Register the profit wallet with the transaction engine
        if let Ok(mut engine) = self.engine.lock() {
            engine.register_wallet(profit_wallet);
        }
    }
    
    /// Capture profits from a trading wallet to the profit wallet
    pub fn capture_profits(&mut self, trading_keypair: &Keypair, amount_sol: Option<f64>) -> Result<TransactionResult, ProfitCaptureError> {
        // Get the current balance
        let current_balance = match self.engine.lock() {
            Ok(engine) => {
                match engine.get_wallet_balance(&trading_keypair.pubkey()) {
                    Ok(balance) => balance,
                    Err(e) => return Err(ProfitCaptureError::EngineError(e.to_string())),
                }
            },
            Err(e) => return Err(ProfitCaptureError::EngineError(e.to_string())),
        };
        
        // Keep some SOL for transaction fees (0.01 SOL)
        const KEEP_SOL: f64 = 0.01;
        
        // Calculate amount to capture
        let capture_amount = match amount_sol {
            Some(specified_amount) => {
                if specified_amount > current_balance - KEEP_SOL {
                    return Err(ProfitCaptureError::InsufficientFunds(
                        format!("Requested amount {:.9} SOL exceeds available balance {:.9} SOL (keeping {:.9} SOL for fees)",
                                specified_amount, current_balance, KEEP_SOL)
                    ));
                }
                specified_amount
            },
            None => {
                // Capture all available balance minus 0.01 SOL for fees
                if current_balance <= KEEP_SOL {
                    return Err(ProfitCaptureError::InsufficientFunds(
                        format!("Insufficient balance to capture profits: {:.9} SOL (minimum required: {:.9} SOL)",
                                current_balance, KEEP_SOL)
                    ));
                }
                current_balance - KEEP_SOL
            }
        };
        
        // Don't capture if the amount is too small (less than 0.001 SOL)
        if capture_amount < 0.001 {
            return Err(ProfitCaptureError::InsufficientFunds(
                format!("Profit amount too small to capture: {:.9} SOL (minimum: 0.001 SOL)",
                        capture_amount)
            ));
        }
        
        info!("Capturing {:.9} SOL profits from {} to {}", 
             capture_amount, trading_keypair.pubkey(), self.profit_wallet);
        
        // Execute the transfer
        match self.engine.lock() {
            Ok(mut engine) => {
                match engine.transfer_sol(trading_keypair, &self.profit_wallet, capture_amount, TransactionPriority::High) {
                    Ok(result) => {
                        // Update total captured
                        self.total_captured += capture_amount;
                        self.last_capture_time = std::time::Instant::now();
                        
                        info!("✅ Successfully captured {:.9} SOL profits! Total captured: {:.9} SOL", 
                             capture_amount, self.total_captured);
                        
                        if let Some(signature) = &result.signature {
                            info!("🔗 Profit capture transaction: https://solscan.io/tx/{}", signature);
                        }
                        
                        Ok(result)
                    },
                    Err(e) => Err(ProfitCaptureError::CaptureFailed(e.to_string())),
                }
            },
            Err(e) => Err(ProfitCaptureError::EngineError(e.to_string())),
        }
    }
    
    /// Check if profits should be captured based on the strategy
    pub fn should_capture_profits(&self, trading_keypair: &Keypair) -> bool {
        match self.strategy {
            ProfitCaptureStrategy::Instant => true,
            
            ProfitCaptureStrategy::Threshold(threshold) => {
                // Check if balance exceeds threshold
                match self.engine.lock() {
                    Ok(engine) => {
                        match engine.get_wallet_balance(&trading_keypair.pubkey()) {
                            Ok(balance) => {
                                // Keep some SOL for transaction fees
                                const KEEP_SOL: f64 = 0.01;
                                balance > threshold + KEEP_SOL
                            },
                            Err(_) => false,
                        }
                    },
                    Err(_) => false,
                }
            },
            
            ProfitCaptureStrategy::Scheduled(minutes) => {
                // Check if enough time has elapsed
                let elapsed = self.last_capture_time.elapsed();
                let threshold = Duration::from_secs(minutes * 60);
                elapsed > threshold
            },
        }
    }
    
    /// Get total captured profits
    pub fn get_total_captured(&self) -> f64 {
        self.total_captured
    }
}

/// Trait for profit capturing capabilities
pub trait ProfitCapture {
    /// Capture all profits to the designated wallet
    fn capture_all_profits(&self, trading_keypair: &Keypair) -> Result<TransactionResult, ProfitCaptureError>;
    
    /// Capture a specific amount of profits
    fn capture_specific_profits(&self, trading_keypair: &Keypair, amount_sol: f64) -> Result<TransactionResult, ProfitCaptureError>;
    
    /// Get the profit wallet public key
    fn get_profit_wallet(&self) -> Pubkey;
    
    /// Get total captured profits
    fn get_total_captured_profits(&self) -> f64;
}

/// Implement ProfitCapture for SolanaTransactionEngine
impl ProfitCapture for Arc<Mutex<ProfitCaptureEngine>> {
    fn capture_all_profits(&self, trading_keypair: &Keypair) -> Result<TransactionResult, ProfitCaptureError> {
        match self.lock() {
            Ok(mut engine) => engine.capture_profits(trading_keypair, None),
            Err(e) => Err(ProfitCaptureError::EngineError(e.to_string())),
        }
    }
    
    fn capture_specific_profits(&self, trading_keypair: &Keypair, amount_sol: f64) -> Result<TransactionResult, ProfitCaptureError> {
        match self.lock() {
            Ok(mut engine) => engine.capture_profits(trading_keypair, Some(amount_sol)),
            Err(e) => Err(ProfitCaptureError::EngineError(e.to_string())),
        }
    }
    
    fn get_profit_wallet(&self) -> Pubkey {
        match self.lock() {
            Ok(engine) => engine.profit_wallet,
            Err(_) => {
                // Return default system wallet if error
                match Pubkey::from_str("HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb") {
                    Ok(pubkey) => pubkey,
                    Err(_) => panic!("Failed to parse system wallet public key"),
                }
            },
        }
    }
    
    fn get_total_captured_profits(&self) -> f64 {
        match self.lock() {
            Ok(engine) => engine.total_captured,
            Err(_) => 0.0,
        }
    }
}

/// Create a profit capture engine with the system wallet
pub fn create_profit_capture_engine() -> Arc<Mutex<ProfitCaptureEngine>> {
    // Get the transaction engine
    let transaction_engine = crate::transaction_engine::get_transaction_engine();
    
    // Get the system wallet from environment or use default
    let system_wallet_str = env::var("SYSTEM_WALLET")
        .unwrap_or_else(|_| "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb".to_string());
    
    // Parse the system wallet address
    match Pubkey::from_str(&system_wallet_str) {
        Ok(wallet) => {
            info!("Using profit wallet: {}", wallet);
            
            // Create the profit capture engine
            let engine = ProfitCaptureEngine::new(transaction_engine, wallet);
            
            // Return the engine wrapped in Arc<Mutex<>>
            Arc::new(Mutex::new(engine))
        },
        Err(e) => {
            error!("Failed to parse profit wallet address: {}", e);
            
            // Use default system wallet as fallback
            let default_wallet = Pubkey::from_str("HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb")
                .expect("Failed to parse default system wallet public key");
            
            warn!("Using default system wallet as profit wallet: {}", default_wallet);
            
            // Create the profit capture engine with default wallet
            let engine = ProfitCaptureEngine::new(transaction_engine, default_wallet);
            
            // Return the engine wrapped in Arc<Mutex<>>
            Arc::new(Mutex::new(engine))
        },
    }
}

/// Get profit capture engine singleton
pub fn get_profit_capture_engine() -> Arc<Mutex<ProfitCaptureEngine>> {
    static mut ENGINE: Option<Arc<Mutex<ProfitCaptureEngine>>> = None;
    static INIT: std::sync::Once = std::sync::Once::new();
    
    unsafe {
        INIT.call_once(|| {
            ENGINE = Some(create_profit_capture_engine());
        });
        
        ENGINE.clone().unwrap()
    }
}