// Strategy module for the Quantum HitSquad Nexus Professional Transaction Engine

pub mod flash_loan_arbitrage;
pub mod momentum_surfing;
pub mod lib;

pub use self::flash_loan_arbitrage::FlashLoanArbitrageStrategy;
pub use self::momentum_surfing::MomentumSurfingStrategy;

// Import Transaction engine from transaction module
use crate::transaction::TransactionEngine;

// Transformer integrations
pub struct MemeCortexIntegration {
    // MemeCortex integration fields would go here
}

// Strategy type enum
pub enum StrategyType {
    FlashLoanArbitrage,
    MomentumSurfing,
    CrossChainArbitrage,
    LiquidityMining,
    GridTrading,
    MarketMaking,
    Custom,
}

impl MemeCortexIntegration {
    // Implementation details for MemeCortexIntegration
}