//! Singularity Cross-Chain Oracle Validator
//!
//! This module implements the validator component of the Singularity agent,
//! responsible for validating cross-chain arbitrage opportunities.

use std::collections::HashMap;
use std::error::Error;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use crate::agents::singularity::strategy::{Chain, CrossChainOpportunity, PathStep};
use crate::utils::current_timestamp;

// Validation result structure
#[derive(Debug, Clone)]
pub struct ValidationResult {
    pub opportunity_id: String,
    pub valid: bool,
    pub reasons: Vec<String>,
    pub timestamp: u64,
    pub validation_time_ms: u64,
    pub validator_version: String,
    pub adjusted_profit: Option<f64>,
    pub adjusted_profit_percentage: Option<f64>,
    pub confidence: f64,
    pub execution_priority: u8,
    pub risk_level: RiskLevel,
}

// Risk level enum
#[derive(Debug, Clone, PartialEq)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    VeryHigh,
}

// Validator configuration
#[derive(Debug, Clone)]
pub struct ValidatorConfig {
    pub min_profit_threshold: f64,
    pub max_allowed_slippage: f64,
    pub max_validation_time: Duration,
    pub min_confidence_threshold: f64,
    pub liquidity_threshold: f64,
    pub enabled_chain_pairs: Vec<(Chain, Chain)>,
    pub price_verification_sources: HashMap<Chain, Vec<String>>,
    pub verification_depth: usize,
    pub verification_retries: usize,
    pub use_on_chain_verification: bool,
    pub use_dex_verification: bool,
    pub use_cex_verification: bool,
    pub verify_asset_reserves: bool,
    pub verify_token_contract: bool,
    pub verify_dex_contract: bool,
    pub max_gas_percentage: f64,
    pub max_route_hops: usize,
    pub flash_loan_verification: bool,
    pub verify_wormhole_bridge: bool,
}

impl Default for ValidatorConfig {
    fn default() -> Self {
        let mut price_verification_sources = HashMap::new();
        
        price_verification_sources.insert(
            Chain::Solana,
            vec![
                "CoinGecko".to_string(),
                "CoinMarketCap".to_string(),
                "Birdeye".to_string(),
                "DexScreener".to_string(),
                "Jupiter".to_string(),
                "Raydium".to_string(),
                "Orca".to_string(),
            ],
        );
        
        price_verification_sources.insert(
            Chain::Ethereum,
            vec![
                "CoinGecko".to_string(),
                "CoinMarketCap".to_string(),
                "DexScreener".to_string(),
                "Uniswap".to_string(),
                "SushiSwap".to_string(),
                "1inch".to_string(),
                "Chainlink".to_string(),
            ],
        );
        
        price_verification_sources.insert(
            Chain::BinanceSmartChain,
            vec![
                "CoinGecko".to_string(),
                "CoinMarketCap".to_string(),
                "DexScreener".to_string(),
                "PancakeSwap".to_string(),
                "BakerySwap".to_string(),
                "BiSwap".to_string(),
                "1inch".to_string(),
            ],
        );
        
        price_verification_sources.insert(
            Chain::Avalanche,
            vec![
                "CoinGecko".to_string(),
                "CoinMarketCap".to_string(),
                "DexScreener".to_string(),
                "Trader Joe".to_string(),
                "Pangolin".to_string(),
                "1inch".to_string(),
                "GMX".to_string(),
            ],
        );
        
        Self {
            min_profit_threshold: 0.5,
            max_allowed_slippage: 2.0,
            max_validation_time: Duration::from_millis(500),
            min_confidence_threshold: 0.8,
            liquidity_threshold: 10000.0,
            enabled_chain_pairs: vec![
                (Chain::Solana, Chain::Ethereum),
                (Chain::Solana, Chain::BinanceSmartChain),
                (Chain::Solana, Chain::Avalanche),
                (Chain::Ethereum, Chain::BinanceSmartChain),
                (Chain::Ethereum, Chain::Avalanche),
                (Chain::BinanceSmartChain, Chain::Avalanche),
                (Chain::Solana, Chain::Polygon),
                (Chain::Ethereum, Chain::Polygon),
                (Chain::BinanceSmartChain, Chain::Polygon),
                (Chain::Avalanche, Chain::Polygon),
                (Chain::Solana, Chain::Arbitrum),
                (Chain::Ethereum, Chain::Arbitrum),
                (Chain::Solana, Chain::Optimism),
                (Chain::Ethereum, Chain::Optimism),
            ],
            price_verification_sources,
            verification_depth: 3,
            verification_retries: 2,
            use_on_chain_verification: true,
            use_dex_verification: true,
            use_cex_verification: true,
            verify_asset_reserves: true,
            verify_token_contract: true,
            verify_dex_contract: true,
            max_gas_percentage: 20.0,
            max_route_hops: 5,
            flash_loan_verification: true,
            verify_wormhole_bridge: true,
        }
    }
}

// Price verification result
#[derive(Debug, Clone)]
pub struct PriceVerificationResult {
    pub token: String,
    pub chain: Chain,
    pub source: String,
    pub price_usd: f64,
    pub timestamp: u64,
    pub success: bool,
    pub error: Option<String>,
}

// Validator instance
pub struct Validator {
    config: ValidatorConfig,
    validation_history: Arc<Mutex<HashMap<String, ValidationResult>>>,
    latest_prices: Arc<Mutex<HashMap<(Chain, String), Vec<PriceVerificationResult>>>>,
    active: bool,
    validation_count: usize,
}

impl Validator {
    pub fn new(config: ValidatorConfig) -> Self {
        Self {
            config,
            validation_history: Arc::new(Mutex::new(HashMap::new())),
            latest_prices: Arc::new(Mutex::new(HashMap::new())),
            active: false,
            validation_count: 0,
        }
    }
    
    pub fn start(&mut self) -> Result<(), Box<dyn Error>> {
        println!("Starting Singularity cross-chain validator...");
        self.active = true;
        
        // In a real implementation, this would start a background thread for validation
        
        Ok(())
    }
    
    pub fn stop(&mut self) -> Result<(), Box<dyn Error>> {
        println!("Stopping Singularity cross-chain validator...");
        self.active = false;
        
        // In a real implementation, this would stop the background thread
        
        Ok(())
    }
    
    pub fn is_active(&self) -> bool {
        self.active
    }
    
    pub fn get_validation_count(&self) -> usize {
        self.validation_count
    }
    
    pub fn validate_opportunity(&mut self, opportunity: &CrossChainOpportunity) -> Result<ValidationResult, Box<dyn Error>> {
        if !self.active {
            return Err(Box::new(std::io::Error::new(
                std::io::ErrorKind::Other,
                "Validator is not active",
            )));
        }
        
        println!("Validating cross-chain opportunity {}...", opportunity.id);
        
        let start_time = std::time::Instant::now();
        self.validation_count += 1;
        
        // Validate the opportunity
        let mut reasons = Vec::new();
        let mut valid = true;
        let mut adjusted_profit = opportunity.net_profit;
        let mut adjusted_profit_percentage = opportunity.profit_percentage;
        let mut confidence = opportunity.confidence;
        
        // Check if the chain pair is enabled
        let chain_pair = (opportunity.source_chain.clone(), opportunity.target_chain.clone());
        if !self.config.enabled_chain_pairs.contains(&chain_pair) {
            valid = false;
            reasons.push(format!("Chain pair {:?} -> {:?} is not enabled",
                opportunity.source_chain, opportunity.target_chain));
        }
        
        // Check if the profit is above the minimum threshold
        if opportunity.profit_percentage < self.config.min_profit_threshold {
            valid = false;
            reasons.push(format!("Profit percentage ({:.2}%) is below minimum threshold ({:.2}%)",
                opportunity.profit_percentage, self.config.min_profit_threshold));
        }
        
        // Check if the route has too many hops
        if opportunity.route.len() > self.config.max_route_hops {
            valid = false;
            reasons.push(format!("Route has too many hops ({} > {})",
                opportunity.route.len(), self.config.max_route_hops));
        }
        
        // Check if the gas cost is too high relative to the profit
        let gas_percentage = opportunity.estimated_gas_cost / opportunity.net_profit * 100.0;
        if gas_percentage > self.config.max_gas_percentage {
            valid = false;
            reasons.push(format!("Gas cost percentage ({:.2}%) is above maximum ({:.2}%)",
                gas_percentage, self.config.max_gas_percentage));
        }
        
        // Check if the confidence is above the minimum threshold
        if opportunity.confidence < self.config.min_confidence_threshold {
            valid = false;
            reasons.push(format!("Confidence ({:.2}) is below minimum threshold ({:.2})",
                opportunity.confidence, self.config.min_confidence_threshold));
        }
        
        // In a real implementation, we would verify the prices
        let prices_verified = self.verify_prices(opportunity)?;
        if !prices_verified {
            valid = false;
            reasons.push("Price verification failed".to_string());
            confidence *= 0.8;
        }
        
        // In a real implementation, we would verify the liquidity
        let liquidity_verified = self.verify_liquidity(opportunity)?;
        if !liquidity_verified {
            valid = false;
            reasons.push("Liquidity verification failed".to_string());
            confidence *= 0.7;
        }
        
        // Apply a safety margin to the profit to account for price movement
        adjusted_profit = opportunity.net_profit * 0.95;
        adjusted_profit_percentage = opportunity.profit_percentage * 0.95;
        
        // Determine risk level
        let risk_level = self.determine_risk_level(opportunity);
        
        // Determine execution priority
        let execution_priority = self.determine_execution_priority(opportunity, valid, confidence);
        
        // Create validation result
        let validation_result = ValidationResult {
            opportunity_id: opportunity.id.clone(),
            valid,
            reasons,
            timestamp: current_timestamp(),
            validation_time_ms: start_time.elapsed().as_millis() as u64,
            validator_version: "0.1.0".to_string(),
            adjusted_profit: Some(adjusted_profit),
            adjusted_profit_percentage: Some(adjusted_profit_percentage),
            confidence,
            execution_priority,
            risk_level,
        };
        
        // Add to validation history
        let mut history = self.validation_history.lock().unwrap();
        history.insert(opportunity.id.clone(), validation_result.clone());
        
        Ok(validation_result)
    }
    
    fn verify_prices(&self, opportunity: &CrossChainOpportunity) -> Result<bool, Box<dyn Error>> {
        println!("Verifying prices for opportunity {}...", opportunity.id);
        
        // In a real implementation, this would fetch prices from multiple sources
        // and verify that they are within an acceptable range
        
        // For now, just simulate a successful verification
        Ok(true)
    }
    
    fn verify_liquidity(&self, opportunity: &CrossChainOpportunity) -> Result<bool, Box<dyn Error>> {
        println!("Verifying liquidity for opportunity {}...", opportunity.id);
        
        // In a real implementation, this would check the liquidity of the tokens
        // on the source and target chains
        
        // For now, just simulate a successful verification
        Ok(true)
    }
    
    fn determine_risk_level(&self, opportunity: &CrossChainOpportunity) -> RiskLevel {
        // In a real implementation, this would determine the risk level based on
        // various factors such as token liquidity, price stability, etc.
        
        if opportunity.profit_percentage > 5.0 {
            // High profit usually means high risk
            RiskLevel::High
        } else if opportunity.profit_percentage > 2.0 {
            RiskLevel::Medium
        } else {
            RiskLevel::Low
        }
    }
    
    fn determine_execution_priority(&self, opportunity: &CrossChainOpportunity, valid: bool, confidence: f64) -> u8 {
        // In a real implementation, this would determine the execution priority based on
        // various factors such as profit, risk, etc.
        
        if !valid {
            return 0;
        }
        
        if opportunity.profit_percentage > 5.0 && confidence > 0.9 {
            // High profit and high confidence: highest priority
            255
        } else if opportunity.profit_percentage > 2.0 && confidence > 0.8 {
            // Medium profit and good confidence: high priority
            200
        } else if opportunity.profit_percentage > 1.0 && confidence > 0.7 {
            // Low profit but still good confidence: medium priority
            150
        } else {
            // Low profit or low confidence: low priority
            100
        }
    }
    
    pub fn get_validation_result(&self, opportunity_id: &str) -> Option<ValidationResult> {
        let history = self.validation_history.lock().unwrap();
        history.get(opportunity_id).cloned()
    }
    
    pub fn validate_all_opportunities(&mut self, opportunities: &[CrossChainOpportunity]) -> Result<Vec<ValidationResult>, Box<dyn Error>> {
        let mut results = Vec::new();
        
        for opportunity in opportunities {
            match self.validate_opportunity(opportunity) {
                Ok(result) => results.push(result),
                Err(e) => println!("Failed to validate opportunity {}: {}", opportunity.id, e),
            }
        }
        
        Ok(results)
    }
    
    pub fn filter_valid_opportunities<'a>(&self, opportunities: &'a [CrossChainOpportunity]) -> Vec<&'a CrossChainOpportunity> {
        let mut valid_opportunities = Vec::new();
        
        let history = self.validation_history.lock().unwrap();
        
        for opportunity in opportunities {
            if let Some(result) = history.get(&opportunity.id) {
                if result.valid {
                    valid_opportunities.push(opportunity);
                }
            }
        }
        
        valid_opportunities
    }
    
    pub fn is_chain_pair_enabled(&self, source_chain: &Chain, target_chain: &Chain) -> bool {
        self.config.enabled_chain_pairs.contains(&(source_chain.clone(), target_chain.clone()))
    }
}

// External API for the validator
pub fn create_validator() -> Validator {
    Validator::new(ValidatorConfig::default())
}

pub fn start_validator(validator: &mut Validator) -> Result<(), Box<dyn Error>> {
    validator.start()
}

pub fn stop_validator(validator: &mut Validator) -> Result<(), Box<dyn Error>> {
    validator.stop()
}

pub fn validate_opportunity(validator: &mut Validator, opportunity: &CrossChainOpportunity) -> Result<ValidationResult, Box<dyn Error>> {
    validator.validate_opportunity(opportunity)
}