//! Singularity Cross-Chain Strategy
//!
//! This module implements the strategic decision-making component for the
//! Singularity agent, which focuses on cross-chain arbitrage opportunities.

use super::{SingularityConfig, CrossChainOpportunity};
use std::collections::HashMap;

/// Strategy for Singularity cross-chain trading
pub struct SingularityStrategy {
    /// Configuration
    config: SingularityConfig,
    
    /// Strategy parameters
    params: StrategyParams,
    
    /// Strategy metrics
    metrics: HashMap<String, f64>,
    
    /// Is initialized
    is_initialized: bool,
}

/// Strategy parameters
#[derive(Debug, Clone)]
pub struct StrategyParams {
    /// Minimum profit threshold (in percentage)
    pub min_profit_threshold: f64,
    
    /// Maximum capital allocation (in absolute terms)
    pub max_capital_allocation: f64,
    
    /// Opportunity timeout (in seconds)
    pub opportunity_timeout: u64,
    
    /// Maximum simultaneous trades
    pub max_simultaneous_trades: usize,
    
    /// Risk factor (0-1, higher means more aggressive)
    pub risk_factor: f64,
    
    /// Prioritize volume (true) or profit margin (false)
    pub prioritize_volume: bool,
    
    /// Take partial fills
    pub take_partial_fills: bool,
    
    /// Bridges to use (empty means all)
    pub bridges: Vec<String>,
    
    /// Token allowlist (empty means all)
    pub token_allowlist: Vec<String>,
    
    /// Token blocklist
    pub token_blocklist: Vec<String>,
    
    /// Max slippage percentage
    pub max_slippage_pct: f64,
}

impl Default for StrategyParams {
    fn default() -> Self {
        Self {
            min_profit_threshold: 0.5, // 0.5% minimum profit
            max_capital_allocation: 100.0, // $100 maximum
            opportunity_timeout: 60, // 60 seconds
            max_simultaneous_trades: 3, // 3 trades at most
            risk_factor: 0.5, // Balanced risk
            prioritize_volume: false, // Prioritize profit margin
            take_partial_fills: true, // Accept partial fills
            bridges: vec!["wormhole".to_string()], // Default to Wormhole
            token_allowlist: vec![], // All tokens allowed
            token_blocklist: vec![], // No tokens blocked
            max_slippage_pct: 0.5, // 0.5% maximum slippage
        }
    }
}

impl SingularityStrategy {
    /// Create a new instance of the strategy
    pub fn new(config: SingularityConfig) -> Self {
        Self {
            config,
            params: StrategyParams::default(),
            metrics: HashMap::new(),
            is_initialized: false,
        }
    }
    
    /// Initialize the strategy
    pub fn initialize(&mut self) -> Result<(), String> {
        if self.is_initialized {
            return Err("Strategy already initialized".to_string());
        }
        
        // Set up the strategy parameters based on configuration
        self.params.min_profit_threshold = self.config.min_profit_pct;
        self.params.max_capital_allocation = self.config.max_input;
        
        // Initialize metrics
        self.metrics.insert("opportunities_evaluated".to_string(), 0.0);
        self.metrics.insert("opportunities_selected".to_string(), 0.0);
        self.metrics.insert("total_expected_profit".to_string(), 0.0);
        self.metrics.insert("average_profit_pct".to_string(), 0.0);
        
        self.is_initialized = true;
        
        println!("Singularity strategy initialized with min profit: {}%, max capital: {} USDC",
            self.params.min_profit_threshold,
            self.params.max_capital_allocation);
        
        Ok(())
    }
    
    /// Shutdown the strategy
    pub fn shutdown(&mut self) -> Result<(), String> {
        if !self.is_initialized {
            return Err("Strategy not initialized".to_string());
        }
        
        self.is_initialized = false;
        println!("Singularity strategy shutdown complete");
        
        Ok(())
    }
    
    /// Get strategy metrics
    pub fn get_metrics(&self) -> HashMap<String, f64> {
        self.metrics.clone()
    }
    
    /// Update strategy parameters
    pub fn update_params(&mut self, params: StrategyParams) {
        self.params = params;
        println!("Singularity strategy parameters updated");
    }
    
    /// Select the best opportunities to execute
    pub fn select_opportunities(&mut self, opportunities: &[CrossChainOpportunity]) -> Result<Vec<CrossChainOpportunity>, String> {
        if !self.is_initialized {
            return Err("Strategy not initialized".to_string());
        }
        
        // Update metrics
        *self.metrics.get_mut("opportunities_evaluated").unwrap() += opportunities.len() as f64;
        
        // Filter opportunities by minimum profit threshold
        let mut filtered: Vec<CrossChainOpportunity> = opportunities
            .iter()
            .filter(|opp| {
                // Check if the profit percentage is above the threshold
                if opp.profit_pct < self.params.min_profit_threshold {
                    return false;
                }
                
                // Check if the input amount is within limits
                if opp.input_amount > self.params.max_capital_allocation {
                    return false;
                }
                
                // Check if the opportunity is still valid (not expired)
                let current_time = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .expect("Time went backwards")
                    .as_secs();
                
                if current_time > opp.expires_at {
                    return false;
                }
                
                // Filter by bridge
                if !self.params.bridges.is_empty() && !self.params.bridges.contains(&opp.bridge) {
                    return false;
                }
                
                // Filter by token allowlist
                if !self.params.token_allowlist.is_empty() {
                    if !self.params.token_allowlist.contains(&opp.source_token) &&
                       !self.params.token_allowlist.contains(&opp.target_token) {
                        return false;
                    }
                }
                
                // Filter by token blocklist
                if self.params.token_blocklist.contains(&opp.source_token) ||
                   self.params.token_blocklist.contains(&opp.target_token) {
                    return false;
                }
                
                true
            })
            .cloned()
            .collect();
        
        // Sort opportunities by profit percentage (descending) or volume (if prioritize_volume is true)
        if self.params.prioritize_volume {
            filtered.sort_by(|a, b| b.input_amount.partial_cmp(&a.input_amount).unwrap());
        } else {
            filtered.sort_by(|a, b| b.profit_pct.partial_cmp(&a.profit_pct).unwrap());
        }
        
        // Limit to max_simultaneous_trades
        let selected = filtered.into_iter().take(self.params.max_simultaneous_trades).collect::<Vec<_>>();
        
        // Update metrics
        *self.metrics.get_mut("opportunities_selected").unwrap() += selected.len() as f64;
        
        let total_expected_profit: f64 = selected.iter().map(|opp| opp.expected_profit).sum();
        *self.metrics.get_mut("total_expected_profit").unwrap() += total_expected_profit;
        
        if !selected.is_empty() {
            let avg_profit_pct = selected.iter().map(|opp| opp.profit_pct).sum::<f64>() / selected.len() as f64;
            *self.metrics.get_mut("average_profit_pct").unwrap() = avg_profit_pct;
        }
        
        Ok(selected)
    }
    
    /// Evaluate an opportunity against current strategy parameters
    pub fn evaluate_opportunity(&self, opportunity: &CrossChainOpportunity) -> Result<f64, String> {
        if !self.is_initialized {
            return Err("Strategy not initialized".to_string());
        }
        
        // Base score is the profit percentage
        let mut score = opportunity.profit_pct;
        
        // Adjust score based on risk factor and other parameters
        
        // Lower score for opportunities close to expiry
        let current_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("Time went backwards")
            .as_secs();
        
        let time_remaining = opportunity.expires_at.saturating_sub(current_time);
        let time_factor = (time_remaining as f64 / self.params.opportunity_timeout as f64).min(1.0);
        
        // Time factor has more weight when risk factor is lower
        score *= 0.8 + (0.2 * time_factor * (1.0 - self.params.risk_factor));
        
        // Adjust score based on bridge trust (future enhancement)
        
        Ok(score)
    }
    
    /// Calculate optimal trade size for an opportunity
    pub fn calculate_trade_size(&self, opportunity: &CrossChainOpportunity) -> Result<f64, String> {
        if !self.is_initialized {
            return Err("Strategy not initialized".to_string());
        }
        
        // Start with the maximum between opportunity input and our max capital
        let max_size = opportunity.input_amount.min(self.params.max_capital_allocation);
        
        // Adjust based on risk factor - lower risk means smaller trades
        let size_factor = 0.5 + (0.5 * self.params.risk_factor);
        let adjusted_size = max_size * size_factor;
        
        // Ensure minimum viable trade size (at least $5)
        let final_size = adjusted_size.max(5.0);
        
        Ok(final_size)
    }
}