// Strategy utility functions for the Quantum HitSquad Nexus Professional Transaction Engine

use std::collections::HashMap;

// Utility for calculating price impact
pub fn calculate_price_impact(amount: f64, pool_liquidity: f64) -> f64 {
    if pool_liquidity <= 0.0 {
        return 1.0; // 100% price impact if no liquidity
    }
    
    // Formula for constant product AMM
    // impact = amount / (amount + liquidity)
    amount / (amount + pool_liquidity)
}

// Utility for calculating optimal swap amount
pub fn calculate_optimal_swap_amount(
    buy_price: f64,
    sell_price: f64,
    buy_fee: f64,
    sell_fee: f64,
    buy_slippage: f64,
    sell_slippage: f64
) -> f64 {
    // For a simple arbitrage, optimal amount is often determined by:
    // 1. The price difference
    // 2. Fees involved
    // 3. Slippage considerations
    
    // This is a simplified formula, real calculations should account for:
    // - Maximum profit point based on pool reserves
    // - Gas costs
    // - Risk management
    
    let price_difference = (sell_price / buy_price) - 1.0;
    
    // If no profit after fees, return 0
    if price_difference <= (buy_fee + sell_fee + buy_slippage + sell_slippage) {
        return 0.0;
    }
    
    // Simple calculation for demonstration purposes
    let net_profit_rate = price_difference - (buy_fee + sell_fee + buy_slippage + sell_slippage);
    
    // Return a reasonable trade size based on profit rate
    // Higher profit rate = larger position size
    500.0 * net_profit_rate.powf(0.5)
}

// Utility for calculating expected profit
pub fn calculate_expected_profit(
    amount: f64,
    buy_price: f64,
    sell_price: f64,
    buy_fee: f64,
    sell_fee: f64,
    loan_fee: f64
) -> f64 {
    if amount <= 0.0 {
        return 0.0;
    }
    
    // Calculate amount spent
    let buy_amount = amount * (1.0 + buy_fee);
    
    // Calculate amount received after selling
    let tokens_received = amount / buy_price;
    let sell_amount = tokens_received * sell_price * (1.0 - sell_fee);
    
    // Calculate flash loan fee
    let flash_loan_fee = amount * loan_fee;
    
    // Calculate net profit
    sell_amount - buy_amount - flash_loan_fee
}

// Utility for estimating gas costs
pub fn estimate_gas_cost(transaction_complexity: u32, gas_price: f64) -> f64 {
    // Base gas costs in gas units
    let base_cost = 21000;
    
    // Additional costs based on complexity
    let additional_cost = match transaction_complexity {
        0 => 0,           // Simple transfer
        1 => 50000,       // Basic swap
        2 => 150000,      // Complex swap
        3 => 300000,      // Flash loan
        4 => 500000,      // Flash loan arbitrage
        _ => 1000000,     // Very complex operation
    };
    
    // Convert to SOL
    (base_cost + additional_cost) as f64 * gas_price
}

// Utility for calculating risk-adjusted returns
pub fn calculate_risk_adjusted_return(
    expected_profit: f64,
    position_size: f64,
    success_probability: f64,
    max_loss_percentage: f64
) -> f64 {
    if position_size <= 0.0 || success_probability <= 0.0 || success_probability > 1.0 {
        return 0.0;
    }
    
    // Calculate expected value
    let expected_value = (expected_profit * success_probability) - 
                         (position_size * max_loss_percentage * (1.0 - success_probability));
    
    // Calculate Sharpe-like ratio
    let std_dev = ((expected_profit - expected_value).powi(2) * success_probability + 
                  (-(position_size * max_loss_percentage) - expected_value).powi(2) * (1.0 - success_probability)).sqrt();
    
    if std_dev == 0.0 {
        return 0.0;
    }
    
    expected_value / std_dev
}