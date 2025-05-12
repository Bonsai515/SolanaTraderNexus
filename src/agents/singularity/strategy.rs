//! Singularity Cross-Chain Oracle Strategy Module
//!
//! This module implements the strategy logic for the Singularity agent,
//! calculating optimal amounts and profitability for cross-chain arbitrage.

use std::time::{SystemTime, UNIX_EPOCH};

/// Slippage model
#[derive(Debug, Clone)]
pub enum SlippageModel {
    /// Constant slippage (as a percentage)
    Constant(f64),
    /// Linear slippage (base + scale * amount)
    Linear { base: f64, scale: f64 },
    /// Exponential slippage (base * (1 + scale) ^ (amount / unit))
    Exponential { base: f64, scale: f64, unit: f64 },
}

impl Default for SlippageModel {
    fn default() -> Self {
        Self::Linear {
            base: 0.1, // 0.1% base slippage
            scale: 0.01, // +0.01% per $1000
        }
    }
}

impl SlippageModel {
    /// Calculate slippage for a given amount
    pub fn calculate(&self, amount: f64) -> f64 {
        match self {
            Self::Constant(pct) => *pct,
            Self::Linear { base, scale } => base + scale * (amount / 1000.0),
            Self::Exponential { base, scale, unit } => {
                base * ((1.0 + scale).powf(amount / unit) - 1.0)
            }
        }
    }
}

/// Strategy parameters
#[derive(Debug, Clone)]
pub struct StrategyParams {
    /// Minimum price difference (as a percentage)
    pub min_price_difference_percentage: f64,
    /// Minimum profit percentage
    pub min_profit_percentage: f64,
    /// Maximum input amount
    pub max_input_amount: f64,
    /// Minimum input amount
    pub min_input_amount: f64,
    /// Slippage model
    pub slippage_model: SlippageModel,
    /// Risk tolerance (0.0 to 1.0)
    pub risk_tolerance: f64,
    /// Use dynamic sizing
    pub use_dynamic_sizing: bool,
}

impl Default for StrategyParams {
    fn default() -> Self {
        Self {
            min_price_difference_percentage: 0.5, // 0.5%
            min_profit_percentage: 0.2, // 0.2%
            max_input_amount: 10000.0, // $10,000
            min_input_amount: 100.0, // $100
            slippage_model: SlippageModel::default(),
            risk_tolerance: 0.5, // Medium risk tolerance
            use_dynamic_sizing: true,
        }
    }
}

/// Arbitrage opportunity
#[derive(Debug, Clone)]
pub struct Opportunity {
    /// Opportunity ID
    pub id: String,
    /// Token pair (e.g., "SOL/USDC")
    pub token_pair: String,
    /// Source blockchain (e.g., "solana")
    pub source_chain: String,
    /// Destination blockchain (e.g., "ethereum")
    pub destination_chain: String,
    /// Price on source chain
    pub source_price: f64,
    /// Price on destination chain
    pub destination_price: f64,
    /// Price difference
    pub price_difference: f64,
    /// Price difference (as a percentage)
    pub price_difference_percentage: f64,
    /// Profit percentage
    pub profit_percentage: f64,
    /// Optimal input amount
    pub optimal_input_amount: f64,
    /// Estimated profit
    pub estimated_profit: f64,
    /// Source exchange
    pub source_exchange: String,
    /// Destination exchange
    pub destination_exchange: String,
    /// Timestamp
    pub timestamp: u64,
    /// Source chain fee percentage
    pub source_fee_percentage: f64,
    /// Destination chain fee percentage
    pub destination_fee_percentage: f64,
    /// Bridge fee percentage
    pub bridge_fee_percentage: f64,
    /// Total fee percentage
    pub total_fee_percentage: f64,
}

impl Opportunity {
    /// Create a new opportunity
    pub fn new(
        id: String,
        token_pair: String,
        source_chain: String,
        destination_chain: String,
        source_price: f64,
        destination_price: f64,
        source_exchange: String,
        destination_exchange: String,
    ) -> Self {
        let price_difference = destination_price - source_price;
        let price_difference_percentage = (price_difference / source_price) * 100.0;
        
        // Default fee percentages
        let source_fee_percentage = 0.05; // 0.05% for Solana DEX trades
        let destination_fee_percentage = 0.3; // 0.3% for Ethereum DEX trades
        let bridge_fee_percentage = 0.1; // 0.1% for Wormhole
        let total_fee_percentage = source_fee_percentage + destination_fee_percentage + bridge_fee_percentage;
        
        // Calculate profit percentage
        let profit_percentage = price_difference_percentage - total_fee_percentage;
        
        // Get current timestamp
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        // Default values for optimal amount and profit
        // These will be calculated by the strategy
        let optimal_input_amount = 0.0;
        let estimated_profit = 0.0;
        
        Self {
            id,
            token_pair,
            source_chain,
            destination_chain,
            source_price,
            destination_price,
            price_difference,
            price_difference_percentage,
            profit_percentage,
            optimal_input_amount,
            estimated_profit,
            source_exchange,
            destination_exchange,
            timestamp,
            source_fee_percentage,
            destination_fee_percentage,
            bridge_fee_percentage,
            total_fee_percentage,
        }
    }
}

/// Calculate optimal amount for the opportunity
pub fn calculate_optimal_amount(
    source_price: f64,
    destination_price: f64,
    source_fee_percentage: f64,
    destination_fee_percentage: f64,
    bridge_fee_percentage: f64,
    max_amount: f64,
    slippage_model: SlippageModel,
) -> f64 {
    // Simple strategy: start with small amount and increase until profit decreases
    let step = max_amount / 100.0;
    let mut best_amount = 0.0;
    let mut best_profit = 0.0;
    
    let mut amount = step;
    while amount <= max_amount {
        let profit = check_profitability(
            amount,
            source_price,
            destination_price,
            source_fee_percentage,
            destination_fee_percentage,
            bridge_fee_percentage,
            slippage_model.clone(),
        );
        
        if profit > best_profit {
            best_profit = profit;
            best_amount = amount;
        } else if profit < best_profit * 0.9 {
            // If profit drops significantly, we've passed the optimal point
            break;
        }
        
        amount += step;
    }
    
    best_amount
}

/// Check profitability for a given amount
pub fn check_profitability(
    amount: f64,
    source_price: f64,
    destination_price: f64,
    source_fee_percentage: f64,
    destination_fee_percentage: f64,
    bridge_fee_percentage: f64,
    slippage_model: SlippageModel,
) -> f64 {
    if amount <= 0.0 {
        return 0.0;
    }
    
    // Calculate token amount
    let token_amount = amount / source_price;
    
    // Source chain fees
    let source_fee = amount * (source_fee_percentage / 100.0);
    
    // Bridge fees
    let bridge_fee = amount * (bridge_fee_percentage / 100.0);
    
    // Calculate slippage based on amount
    let source_slippage_pct = slippage_model.calculate(amount);
    let source_slippage = amount * (source_slippage_pct / 100.0);
    
    // Amount after source fees and slippage
    let amount_after_source = amount - source_fee - source_slippage;
    
    // Amount after bridging
    let amount_after_bridge = amount_after_source - bridge_fee;
    
    // Destination chain
    let dest_amount = token_amount * destination_price;
    
    // Destination slippage (usually higher on destination)
    let dest_slippage_pct = slippage_model.calculate(dest_amount) * 1.5; // 50% higher slippage on destination
    let dest_slippage = dest_amount * (dest_slippage_pct / 100.0);
    
    // Destination fee
    let dest_fee = dest_amount * (destination_fee_percentage / 100.0);
    
    // Final amount after all fees and slippage
    let final_amount = dest_amount - dest_fee - dest_slippage;
    
    // Profit
    let profit = final_amount - amount;
    
    profit
}

/// Get all supported token pairs
pub fn get_supported_token_pairs() -> Vec<String> {
    vec![
        "SOL/ETH".to_string(),
        "SOL/USDC".to_string(),
        "SOL/USDT".to_string(),
        "ETH/USDC".to_string(),
        "ETH/USDT".to_string(),
        "BTC/USDC".to_string(),
        "BTC/USDT".to_string(),
        "BONK/USDT".to_string(),
        "JUP/USDC".to_string(),
    ]
}

/// Get all supported blockchains
pub fn get_supported_blockchains() -> Vec<String> {
    vec![
        "solana".to_string(),
        "ethereum".to_string(),
        "arbitrum".to_string(),
        "polygon".to_string(),
        "avalanche".to_string(),
        "bsc".to_string(),
    ]
}