//! Singularity Validator Module
//!
//! This module implements the validation logic for cross-chain arbitrage opportunities
//! to ensure they are valid before execution.

use anyhow::{Result, anyhow, Context};

use super::strategy::Opportunity;

/// Validation result
#[derive(Debug, Clone)]
pub struct ValidationResult {
    /// Is the opportunity valid?
    pub is_valid: bool,
    
    /// Validation errors
    pub errors: Vec<String>,
    
    /// Validation warnings
    pub warnings: Vec<String>,
    
    /// Adjusted profit (after additional checks)
    pub adjusted_profit: Option<f64>,
    
    /// Adjusted profit percentage (after additional checks)
    pub adjusted_profit_percentage: Option<f64>,
}

impl ValidationResult {
    /// Create a new validation result
    pub fn new() -> Self {
        Self {
            is_valid: true,
            errors: Vec::new(),
            warnings: Vec::new(),
            adjusted_profit: None,
            adjusted_profit_percentage: None,
        }
    }
    
    /// Add an error
    pub fn add_error(&mut self, error: &str) {
        self.errors.push(error.to_string());
        self.is_valid = false;
    }
    
    /// Add a warning
    pub fn add_warning(&mut self, warning: &str) {
        self.warnings.push(warning.to_string());
    }
    
    /// Set adjusted profit
    pub fn set_adjusted_profit(&mut self, profit: f64, percentage: f64) {
        self.adjusted_profit = Some(profit);
        self.adjusted_profit_percentage = Some(percentage);
    }
}

/// Validation configuration
#[derive(Debug, Clone)]
pub struct ValidationConfig {
    /// Minimum profit percentage required
    pub min_profit_percentage: f64,
    
    /// Maximum allowed slippage percentage
    pub max_slippage_percentage: f64,
    
    /// Maximum source chain liquidity as percentage of input
    pub max_source_liquidity_percentage: f64,
    
    /// Maximum destination chain liquidity as percentage of output
    pub max_destination_liquidity_percentage: f64,
    
    /// Maximum gas cost as percentage of profit
    pub max_gas_cost_percentage: f64,
    
    /// Minimum SOL balance required for transaction
    pub min_sol_balance: f64,
    
    /// Validate against live price feeds
    pub validate_live_prices: bool,
    
    /// Validate liquidity
    pub validate_liquidity: bool,
    
    /// Validate gas costs
    pub validate_gas_costs: bool,
    
    /// Check execution history
    pub check_execution_history: bool,
}

impl Default for ValidationConfig {
    fn default() -> Self {
        Self {
            min_profit_percentage: 0.5,
            max_slippage_percentage: 0.5,
            max_source_liquidity_percentage: 10.0,
            max_destination_liquidity_percentage: 10.0,
            max_gas_cost_percentage: 20.0,
            min_sol_balance: 0.01,
            validate_live_prices: true,
            validate_liquidity: true,
            validate_gas_costs: true,
            check_execution_history: true,
        }
    }
}

/// Cross-chain opportunity validator
pub struct OpportunityValidator {
    /// Validation configuration
    config: ValidationConfig,
    
    /// Execution history
    execution_history: Vec<(String, bool, f64)>, // (opportunity_id, success, actual_profit)
}

impl OpportunityValidator {
    /// Create a new OpportunityValidator
    pub fn new(config: ValidationConfig) -> Self {
        Self {
            config,
            execution_history: Vec::new(),
        }
    }
    
    /// Validate an opportunity
    pub async fn validate(&self, opportunity: &Opportunity) -> Result<ValidationResult> {
        let mut result = ValidationResult::new();
        
        // Basic validation
        if opportunity.profit_percentage < self.config.min_profit_percentage {
            result.add_error(&format!(
                "Profit percentage {:.2}% is below minimum threshold {:.2}%",
                opportunity.profit_percentage,
                self.config.min_profit_percentage
            ));
        }
        
        if opportunity.optimal_input_amount <= 0.0 {
            result.add_error("Input amount must be greater than zero");
        }
        
        // Validate price change since discovery (to avoid executing on stale opportunities)
        if self.config.validate_live_prices {
            // In a real implementation, this would check the current prices
            // and compare them to the prices in the opportunity
            let simulated_price_change = rand::random::<f64>() * 0.01 - 0.005; // +/- 0.5% price change
            
            let new_source_price = opportunity.source_price * (1.0 + simulated_price_change);
            let new_destination_price = opportunity.destination_price * (1.0 + simulated_price_change);
            
            let price_diff = (new_destination_price - new_source_price) / new_source_price * 100.0;
            
            // Calculate new profit
            let bridge_fee = opportunity.optimal_input_amount * 0.003; // 0.3% bridge fee
            let source_dex_fee = opportunity.optimal_input_amount * 0.003; // 0.3% source DEX fee
            let dest_dex_fee = (opportunity.optimal_input_amount / new_source_price * new_destination_price) * 0.003; // 0.3% destination DEX fee
            let gas_fee = 1.0; // $1 gas fee estimate
            let total_fees = bridge_fee + source_dex_fee + dest_dex_fee + gas_fee;
            
            let output_value = opportunity.optimal_input_amount / new_source_price * new_destination_price;
            let adjusted_profit = output_value - opportunity.optimal_input_amount - total_fees;
            let adjusted_profit_percentage = adjusted_profit / opportunity.optimal_input_amount * 100.0;
            
            if adjusted_profit_percentage < self.config.min_profit_percentage {
                result.add_error(&format!(
                    "Adjusted profit percentage {:.2}% is below minimum threshold {:.2}% due to price changes",
                    adjusted_profit_percentage,
                    self.config.min_profit_percentage
                ));
            } else if adjusted_profit_percentage < opportunity.profit_percentage {
                result.add_warning(&format!(
                    "Profit percentage has decreased from {:.2}% to {:.2}% due to price changes",
                    opportunity.profit_percentage,
                    adjusted_profit_percentage
                ));
            }
            
            result.set_adjusted_profit(adjusted_profit, adjusted_profit_percentage);
        }
        
        // Validate liquidity
        if self.config.validate_liquidity {
            // In a real implementation, this would check the actual liquidity
            // available on each chain/DEX
            let simulated_source_liquidity = opportunity.optimal_input_amount * (5.0 + rand::random::<f64>() * 15.0);
            let simulated_destination_liquidity = opportunity.expected_output_amount * (5.0 + rand::random::<f64>() * 15.0);
            
            let source_liquidity_percentage = (opportunity.optimal_input_amount / simulated_source_liquidity) * 100.0;
            let destination_liquidity_percentage = (opportunity.expected_output_amount / simulated_destination_liquidity) * 100.0;
            
            if source_liquidity_percentage > self.config.max_source_liquidity_percentage {
                result.add_error(&format!(
                    "Input amount is {:.2}% of available source liquidity, exceeding maximum threshold {:.2}%",
                    source_liquidity_percentage,
                    self.config.max_source_liquidity_percentage
                ));
            } else if source_liquidity_percentage > self.config.max_source_liquidity_percentage * 0.7 {
                result.add_warning(&format!(
                    "Input amount is {:.2}% of available source liquidity, approaching maximum threshold {:.2}%",
                    source_liquidity_percentage,
                    self.config.max_source_liquidity_percentage
                ));
            }
            
            if destination_liquidity_percentage > self.config.max_destination_liquidity_percentage {
                result.add_error(&format!(
                    "Output amount is {:.2}% of available destination liquidity, exceeding maximum threshold {:.2}%",
                    destination_liquidity_percentage,
                    self.config.max_destination_liquidity_percentage
                ));
            } else if destination_liquidity_percentage > self.config.max_destination_liquidity_percentage * 0.7 {
                result.add_warning(&format!(
                    "Output amount is {:.2}% of available destination liquidity, approaching maximum threshold {:.2}%",
                    destination_liquidity_percentage,
                    self.config.max_destination_liquidity_percentage
                ));
            }
        }
        
        // Validate gas costs
        if self.config.validate_gas_costs {
            // In a real implementation, this would check the actual gas costs
            // for each chain
            let simulated_source_gas_cost = 0.5 + rand::random::<f64>() * 0.5; // $0.5-1.0
            let simulated_destination_gas_cost = 0.5 + rand::random::<f64>() * 2.0; // $0.5-2.5
            let total_gas_cost = simulated_source_gas_cost + simulated_destination_gas_cost;
            
            let gas_percentage = if opportunity.estimated_profit > 0.0 {
                (total_gas_cost / opportunity.estimated_profit) * 100.0
            } else {
                100.0
            };
            
            if gas_percentage > self.config.max_gas_cost_percentage {
                result.add_error(&format!(
                    "Gas cost is {:.2}% of estimated profit, exceeding maximum threshold {:.2}%",
                    gas_percentage,
                    self.config.max_gas_cost_percentage
                ));
            } else if gas_percentage > self.config.max_gas_cost_percentage * 0.7 {
                result.add_warning(&format!(
                    "Gas cost is {:.2}% of estimated profit, approaching maximum threshold {:.2}%",
                    gas_percentage,
                    self.config.max_gas_cost_percentage
                ));
            }
        }
        
        // Check execution history
        if self.config.check_execution_history {
            let similar_opportunities = self.execution_history
                .iter()
                .filter(|(id, _, _)| {
                    id.contains(&opportunity.source_chain) &&
                    id.contains(&opportunity.destination_chain) &&
                    id.contains(&opportunity.token_pair.replace("/", "-"))
                })
                .collect::<Vec<_>>();
            
            let failed_count = similar_opportunities
                .iter()
                .filter(|(_, success, _)| !*success)
                .count();
            
            let total_count = similar_opportunities.len();
            
            if total_count > 0 {
                let failure_rate = (failed_count as f64) / (total_count as f64) * 100.0;
                
                if failure_rate > 50.0 && total_count >= 5 {
                    result.add_error(&format!(
                        "Similar opportunities have a high failure rate ({:.2}% over {} attempts)",
                        failure_rate,
                        total_count
                    ));
                } else if failure_rate > 30.0 && total_count >= 3 {
                    result.add_warning(&format!(
                        "Similar opportunities have a moderate failure rate ({:.2}% over {} attempts)",
                        failure_rate,
                        total_count
                    ));
                }
                
                // Calculate average profit for successful executions
                let successful_profits = similar_opportunities
                    .iter()
                    .filter(|(_, success, _)| *success)
                    .map(|(_, _, profit)| *profit)
                    .collect::<Vec<_>>();
                
                if !successful_profits.is_empty() {
                    let avg_profit = successful_profits.iter().sum::<f64>() / successful_profits.len() as f64;
                    
                    if opportunity.estimated_profit < avg_profit * 0.7 {
                        result.add_warning(&format!(
                            "Estimated profit (${:.2}) is significantly lower than average profit (${:.2}) for similar opportunities",
                            opportunity.estimated_profit,
                            avg_profit
                        ));
                    }
                }
            }
        }
        
        // Combine all errors and warnings
        if !result.is_valid {
            let error_msg = result.errors.join("; ");
            println!("Validation failed: {}", error_msg);
        } else if !result.warnings.is_empty() {
            let warning_msg = result.warnings.join("; ");
            println!("Validation passed with warnings: {}", warning_msg);
        } else {
            println!("Validation passed without issues");
        }
        
        Ok(result)
    }
    
    /// Add execution result to history
    pub fn add_execution_result(&mut self, opportunity_id: &str, success: bool, actual_profit: f64) {
        self.execution_history.push((opportunity_id.to_string(), success, actual_profit));
        
        // Limit history size
        if self.execution_history.len() > 1000 {
            self.execution_history.remove(0);
        }
    }
    
    /// Get execution history
    pub fn get_execution_history(&self) -> &Vec<(String, bool, f64)> {
        &self.execution_history
    }
    
    /// Get validation configuration
    pub fn get_config(&self) -> &ValidationConfig {
        &self.config
    }
    
    /// Update validation configuration
    pub fn update_config(&mut self, config: ValidationConfig) {
        self.config = config;
    }
}