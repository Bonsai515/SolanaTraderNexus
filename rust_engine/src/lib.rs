// Quantum HitSquad Nexus Professional Transaction Engine
// Library module - provides core functionality for transaction processing

pub mod transaction;
pub mod parallel;
pub mod strategy;

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use log::info; // Only using info log level

// Re-export important types 
pub use transaction::{Transaction, TransactionResult, TransactionEngine};
pub use parallel::{init_parallel_processing, process_transactions_parallel, process_price_feeds_parallel};
pub use strategy::{
    StrategyType, 
    FlashLoanArbitrageStrategy, 
    MomentumSurfingStrategy,
    MemeCortexIntegration
};

// Initialize the transaction engine
pub fn init_engine() -> TransactionEngine {
    // Initialize parallel processing
    parallel::init_parallel_processing();
    
    // Return new transaction engine instance
    TransactionEngine::new()
}

// Initialize the MemeCortex integration
pub fn init_memecortex() -> MemeCortexIntegration {
    MemeCortexIntegration {}
}

// Create strategies with optimal configuration
pub fn create_strategy(strategy_type: StrategyType) -> Box<dyn crate::Strategy> {
    match strategy_type {
        StrategyType::FlashLoanArbitrage => {
            let nexus_engine = Arc::new(Mutex::new(init_engine()));
            Box::new(FlashLoanArbitrageStrategy::new(
                nexus_engine,
                30, // 0.3% min profit
                10000.0, // Max flash loan amount in USD
                vec![
                    "USDC".to_string(), 
                    "SOL".to_string(), 
                    "BONK".to_string(),
                    "JUP".to_string(),
                    "WIF".to_string()
                ],
                vec![
                    "jupiter".to_string(),
                    "raydium".to_string(), 
                    "orca".to_string()
                ]
            ))
        },
        StrategyType::MomentumSurfing => {
            let memecortex = Arc::new(Mutex::new(init_memecortex()));
            let transaction_engine = Arc::new(Mutex::new(init_engine()));
            
            Box::new(MomentumSurfingStrategy::new(
                memecortex,
                transaction_engine,
                vec![
                    "SOL".to_string(),
                    "BONK".to_string(),
                    "JUP".to_string(),
                    "WIF".to_string(),
                    "GUAC".to_string()
                ],
                std::time::Duration::from_secs(3600 * 4), // 4 hour holding period
                HashMap::new(), // Entry conditions
                HashMap::new()  // Exit conditions
            ))
        },
        _ => {
            // Default to FlashLoanArbitrage for now
            let nexus_engine = Arc::new(Mutex::new(init_engine()));
            Box::new(FlashLoanArbitrageStrategy::new(
                nexus_engine,
                30, // 0.3% min profit
                10000.0, // Max flash loan amount
                vec!["USDC".to_string(), "SOL".to_string()],
                vec!["jupiter".to_string(), "raydium".to_string()]
            ))
        }
    }
}

// Strategy trait for common interface
pub trait Strategy {
    fn name(&self) -> &str;
    fn description(&self) -> &str;
    fn execute(&self) -> Result<Vec<String>, String>;
}