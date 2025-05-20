use anyhow::{Result, anyhow};
use std::collections::HashMap;
use uuid::Uuid;
use chrono::Utc;
use log::{info, debug, warn};

use crate::agents::hyperion::{
    HyperionState, StrategyDNA, MarketConditions
};

/// Evolve an existing strategy based on execution metrics
pub fn evolve_strategy(
    state: &mut HyperionState,
    metrics: HashMap<String, f64>
) -> Result<()> {
    if state.strategies.is_empty() {
        // Create a new strategy if none exist
        let default_strategy = create_default_strategy();
        state.strategies.push(default_strategy);
        return Ok(());
    }
    
    // Find strategy ID in metrics
    let strategy_id = if let Some(id) = metrics.get("strategy_id") {
        id.to_string()
    } else {
        // Use the first strategy if none specified
        state.strategies[0].id.clone()
    };
    
    // Find the strategy to evolve
    let strategy_index = state.strategies.iter().position(|s| s.id == strategy_id);
    
    match strategy_index {
        Some(index) => {
            // Make a deep copy of the strategy to evolve
            let mut strategy = state.strategies[index].clone();
            
            // Update strategy performance metrics
            for (key, value) in metrics.iter() {
                strategy.performance_metrics.insert(key.clone(), *value);
            }
            
            // Apply small mutations to strategy parameters
            if let Some(profit) = metrics.get("actual_profit") {
                if *profit > 0.0 {
                    // Positive reinforcement - reduce slippage tolerance slightly
                    strategy.max_slippage *= 0.99;
                    debug!("Reducing max slippage to {:.4}% due to positive execution", strategy.max_slippage * 100.0);
                } else {
                    // Negative reinforcement - increase slippage tolerance slightly
                    strategy.max_slippage *= 1.01;
                    debug!("Increasing max slippage to {:.4}% due to negative execution", strategy.max_slippage * 100.0);
                }
            }
            
            if let Some(execution_time) = metrics.get("execution_time_ms") {
                // Adjust execution speed expectations based on actual performance
                let current_speed = strategy.execution_speed_ms as f64;
                let new_speed = (current_speed * 0.9) + (execution_time * 0.1); // 90% old, 10% new
                strategy.execution_speed_ms = new_speed as u64;
                debug!("Adjusted execution speed expectation to {}ms", strategy.execution_speed_ms);
            }
            
            // Apply the evolved strategy
            state.strategies[index] = strategy;
            
            // Periodically generate new strategies (every 10 evolutions)
            if state.total_executions % 10 == 0 && state.total_executions > 0 {
                if let Ok(new_strategy) = generate_new_strategy(state) {
                    debug!("Generated new strategy: {}", new_strategy.id);
                    state.strategies.push(new_strategy);
                    
                    // Cap the number of strategies
                    if state.strategies.len() > 5 {
                        // Remove the worst performing strategy
                        remove_worst_strategy(state);
                    }
                }
            }
            
            Ok(())
        },
        None => {
            warn!("Strategy with ID {} not found, creating new strategy", strategy_id);
            let new_strategy = create_default_strategy();
            state.strategies.push(new_strategy);
            Ok(())
        }
    }
}

/// Create a default arbitrage strategy
fn create_default_strategy() -> StrategyDNA {
    let id = Uuid::new_v4().to_string();
    
    StrategyDNA {
        id,
        created_at: Utc::now(),
        target_pairs: vec![
            "SOL/USDC".to_string(),
            "BTC/USDC".to_string(),
            "ETH/USDC".to_string(),
        ],
        dex_priority: vec![
            "jupiter".to_string(),
            "raydium".to_string(),
            "openbook".to_string(),
            "orca".to_string(),
        ],
        min_profit_threshold: 0.005, // 0.5%
        execution_speed_ms: 1500, // 1.5 seconds
        max_slippage: 0.01, // 1%
        risk_score: 0.3, // Low-medium risk
        version: "1.0.0".to_string(),
        performance_metrics: HashMap::new(),
    }
}

/// Generate a new strategy using market conditions and LLM analysis
fn generate_new_strategy(state: &HyperionState) -> Result<StrategyDNA> {
    let id = Uuid::new_v4().to_string();
    
    // In a real implementation, this would use the LLM brain to analyze market conditions
    // and generate a new strategy. For this simulation, we'll create a variant of an existing strategy.
    
    // Get the best performing strategy
    let best_strategy = find_best_strategy(state)?;
    
    // Create a new strategy with some variations
    let mut new_strategy = best_strategy.clone();
    new_strategy.id = id;
    new_strategy.created_at = Utc::now();
    new_strategy.version = format!("{}.1", best_strategy.version);
    
    // Randomly adjust some parameters
    new_strategy.min_profit_threshold *= 0.95 + (rand::random::<f64>() * 0.1); // ±5%
    new_strategy.max_slippage *= 0.95 + (rand::random::<f64>() * 0.1); // ±5%
    
    // Add a new trading pair if not already included
    let new_pairs = ["JUP/USDC", "BONK/USDC", "RAY/USDC", "ORCA/USDC"];
    for pair in new_pairs.iter() {
        if !new_strategy.target_pairs.contains(&pair.to_string()) {
            new_strategy.target_pairs.push(pair.to_string());
            break;
        }
    }
    
    // Shuffle DEX priority slightly
    if new_strategy.dex_priority.len() >= 2 {
        let idx1 = rand::random::<usize>() % new_strategy.dex_priority.len();
        let idx2 = (idx1 + 1) % new_strategy.dex_priority.len();
        new_strategy.dex_priority.swap(idx1, idx2);
    }
    
    // Reset performance metrics for the new strategy
    new_strategy.performance_metrics = HashMap::new();
    
    info!("Generated new strategy {} based on {}", new_strategy.id, best_strategy.id);
    
    Ok(new_strategy)
}

/// Find the best performing strategy
fn find_best_strategy(state: &HyperionState) -> Result<&StrategyDNA> {
    if state.strategies.is_empty() {
        return Err(anyhow!("No strategies available"));
    }
    
    // Find the strategy with the highest profit (if available in metrics)
    let mut best_strategy = &state.strategies[0];
    let mut best_profit = 0.0;
    
    for strategy in &state.strategies {
        let strategy_profit = if let Some(profit) = strategy.performance_metrics.get("actual_profit") {
            *profit
        } else if let Some(profit) = state.profit_ledger.profit_by_strategy.get(&strategy.id) {
            *profit
        } else {
            0.0
        };
        
        if strategy_profit > best_profit {
            best_profit = strategy_profit;
            best_strategy = strategy;
        }
    }
    
    Ok(best_strategy)
}

/// Remove the worst performing strategy
fn remove_worst_strategy(state: &mut HyperionState) {
    if state.strategies.len() <= 1 {
        return;
    }
    
    // Find the strategy with the lowest profit
    let mut worst_index = 0;
    let mut worst_profit = f64::MAX;
    
    for (i, strategy) in state.strategies.iter().enumerate() {
        let strategy_profit = if let Some(profit) = strategy.performance_metrics.get("actual_profit") {
            *profit
        } else if let Some(profit) = state.profit_ledger.profit_by_strategy.get(&strategy.id) {
            *profit
        } else {
            0.0
        };
        
        if strategy_profit < worst_profit {
            worst_profit = strategy_profit;
            worst_index = i;
        }
    }
    
    // Remove the worst strategy
    let removed = state.strategies.remove(worst_index);
    info!("Removed worst performing strategy: {}", removed.id);
}

/// Generate market-specific strategies based on current conditions
pub fn generate_market_specific_strategy(
    state: &HyperionState,
    market_conditions: &MarketConditions
) -> Result<StrategyDNA> {
    let id = Uuid::new_v4().to_string();
    
    // Base strategy
    let mut strategy = create_default_strategy();
    strategy.id = id;
    
    // Adapt to market conditions
    
    // 1. Set target pairs based on high volume
    let mut volume_pairs: Vec<(String, f64)> = market_conditions.volumes.iter()
        .map(|(k, v)| (k.clone(), *v))
        .collect();
    
    // Sort pairs by volume (descending)
    volume_pairs.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    
    // Take top 3 pairs by volume
    strategy.target_pairs = volume_pairs.iter()
        .take(3)
        .map(|(pair, _)| pair.clone())
        .collect();
    
    // 2. Adjust risk profile based on market volatility
    let avg_volatility = market_conditions.volatility.values()
        .sum::<f64>() / market_conditions.volatility.len() as f64;
    
    if avg_volatility > 0.05 { // High volatility
        strategy.min_profit_threshold = 0.008; // Require higher profit
        strategy.max_slippage = 0.015; // Allow more slippage
        strategy.risk_score = 0.6; // Higher risk
        strategy.execution_speed_ms = 1000; // Faster execution
    } else if avg_volatility < 0.02 { // Low volatility
        strategy.min_profit_threshold = 0.003; // Accept lower profit
        strategy.max_slippage = 0.005; // Require less slippage
        strategy.risk_score = 0.2; // Lower risk
        strategy.execution_speed_ms = 2000; // Can be slower
    }
    
    // 3. Adjust for memecoin activity
    if market_conditions.memecoin_activity > 0.7 { // High meme activity
        // Add meme pairs
        strategy.target_pairs.push("BONK/USDC".to_string());
        strategy.target_pairs.push("MEME/USDC".to_string());
        
        // Prioritize meme-friendly DEXs
        strategy.dex_priority = vec![
            "jupiter".to_string(),
            "raydium".to_string(),
            "pump_fun".to_string(),
            "goose".to_string(),
        ];
    }
    
    info!("Generated market-specific strategy {} based on current conditions", strategy.id);
    
    Ok(strategy)
}