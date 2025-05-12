//! Singularity Cross-Chain Oracle Scanner Module
//!
//! This module implements the scanning logic for the Singularity agent,
//! discovering cross-chain arbitrage opportunities using Wormhole.

use anyhow::{Result, anyhow};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{self, Duration};
use std::collections::HashMap;
use uuid::Uuid;
use std::time::{SystemTime, UNIX_EPOCH};

use super::strategy::{StrategyParams, Opportunity, calculate_optimal_amount, check_profitability};

/// Supported blockchains
#[derive(Debug, Clone, PartialEq)]
pub enum Blockchain {
    /// Solana
    Solana,
    /// Ethereum
    Ethereum,
    /// Arbitrum
    Arbitrum,
    /// Polygon
    Polygon,
    /// Avalanche
    Avalanche,
    /// Binance Smart Chain
    BSC,
}

impl Blockchain {
    /// Get the blockchain name
    pub fn name(&self) -> &'static str {
        match self {
            Blockchain::Solana => "solana",
            Blockchain::Ethereum => "ethereum",
            Blockchain::Arbitrum => "arbitrum",
            Blockchain::Polygon => "polygon",
            Blockchain::Avalanche => "avalanche",
            Blockchain::BSC => "bsc",
        }
    }
    
    /// Get the blockchain from a string
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "solana" => Some(Blockchain::Solana),
            "ethereum" => Some(Blockchain::Ethereum),
            "arbitrum" => Some(Blockchain::Arbitrum),
            "polygon" => Some(Blockchain::Polygon),
            "avalanche" => Some(Blockchain::Avalanche),
            "bsc" => Some(Blockchain::BSC),
            _ => None,
        }
    }
}

/// Scanner configuration
#[derive(Debug, Clone)]
pub struct ScannerConfig {
    /// Enabled blockchains
    pub enabled_blockchains: Vec<Blockchain>,
    /// Token pairs to scan
    pub token_pairs: Vec<String>,
    /// Scan interval (in seconds)
    pub scan_interval_secs: u64,
    /// Maximum opportunities to track
    pub max_opportunities: usize,
    /// Opportunity TTL (in seconds)
    pub opportunity_ttl_secs: u64,
}

impl Default for ScannerConfig {
    fn default() -> Self {
        Self {
            enabled_blockchains: vec![
                Blockchain::Solana,
                Blockchain::Ethereum,
                Blockchain::Arbitrum,
                Blockchain::BSC,
            ],
            token_pairs: vec![
                "SOL/ETH".to_string(),
                "SOL/USDC".to_string(),
                "SOL/USDT".to_string(),
                "ETH/USDC".to_string(),
                "ETH/USDT".to_string(),
                "BTC/USDC".to_string(),
                "BTC/USDT".to_string(),
                "BONK/USDT".to_string(),
                "JUP/USDC".to_string(),
            ],
            scan_interval_secs: 10,
            max_opportunities: 100,
            opportunity_ttl_secs: 60,
        }
    }
}

/// Scanner state
#[derive(Debug)]
pub struct Scanner {
    /// Scanner configuration
    config: ScannerConfig,
    /// Strategy parameters
    strategy_params: StrategyParams,
    /// Current opportunities
    opportunities: Vec<Opportunity>,
    /// Price cache
    price_cache: HashMap<String, HashMap<String, f64>>,
    /// Last scan time
    last_scan: Option<u64>,
    /// Is scanner active
    active: bool,
}

impl Scanner {
    /// Create a new scanner
    pub fn new(config: ScannerConfig, strategy_params: StrategyParams) -> Self {
        Self {
            config,
            strategy_params,
            opportunities: Vec::new(),
            price_cache: HashMap::new(),
            last_scan: None,
            active: false,
        }
    }
    
    /// Start the scanner
    pub fn start(&mut self) -> Result<()> {
        if self.active {
            return Ok(());
        }
        
        println!("🚀 Starting Singularity scanner");
        
        self.active = true;
        
        println!("✅ Singularity scanner started successfully");
        
        Ok(())
    }
    
    /// Stop the scanner
    pub fn stop(&mut self) -> Result<()> {
        if !self.active {
            return Ok(());
        }
        
        println!("🛑 Stopping Singularity scanner");
        
        self.active = false;
        
        println!("✅ Singularity scanner stopped successfully");
        
        Ok(())
    }
    
    /// Get if scanner is active
    pub fn is_active(&self) -> bool {
        self.active
    }
    
    /// Scan for opportunities
    pub async fn scan(&mut self) -> Result<Vec<Opportunity>> {
        if !self.active {
            return Err(anyhow!("Scanner is not active"));
        }
        
        println!("🔍 Scanning for cross-chain arbitrage opportunities");
        
        // Update last scan time
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        self.last_scan = Some(now);
        
        // Get fresh prices
        self.update_price_cache().await?;
        
        // Generate new opportunities
        let mut new_opportunities = self.generate_opportunities().await?;
        
        // Filter out unprofitable opportunities
        new_opportunities.retain(|opp| opp.estimated_profit > 0.0 && opp.profit_percentage > self.strategy_params.min_profit_percentage);
        
        // Sort by profitability (descending)
        new_opportunities.sort_by(|a, b| b.profit_percentage.partial_cmp(&a.profit_percentage).unwrap());
        
        // Add new opportunities to the list
        for opp in new_opportunities.iter() {
            // Check if we already have this opportunity
            if !self.opportunities.iter().any(|existing| {
                existing.source_chain == opp.source_chain &&
                existing.destination_chain == opp.destination_chain &&
                existing.token_pair == opp.token_pair
            }) {
                self.opportunities.push(opp.clone());
            }
        }
        
        // Expire old opportunities
        self.opportunities.retain(|opp| {
            let age = now.saturating_sub(opp.timestamp);
            age < self.config.opportunity_ttl_secs
        });
        
        // Limit number of opportunities
        if self.opportunities.len() > self.config.max_opportunities {
            self.opportunities.sort_by(|a, b| b.profit_percentage.partial_cmp(&a.profit_percentage).unwrap());
            self.opportunities.truncate(self.config.max_opportunities);
        }
        
        println!("✅ Scan complete. Found {} new opportunities, tracking {} total", 
                 new_opportunities.len(), self.opportunities.len());
        
        Ok(self.opportunities.clone())
    }
    
    /// Update price cache
    async fn update_price_cache(&mut self) -> Result<()> {
        // In a real implementation, this would fetch prices from exchanges and Wormhole
        
        // Mock implementation for testing
        let mut solana_prices = HashMap::new();
        solana_prices.insert("SOL/USDC".to_string(), 150.0 + (rand::random::<f64>() * 10.0 - 5.0));
        solana_prices.insert("SOL/USDT".to_string(), 149.9 + (rand::random::<f64>() * 10.0 - 5.0));
        solana_prices.insert("ETH/USDC".to_string(), 3502.5 + (rand::random::<f64>() * 50.0 - 25.0));
        solana_prices.insert("ETH/USDT".to_string(), 3500.0 + (rand::random::<f64>() * 50.0 - 25.0));
        solana_prices.insert("BTC/USDC".to_string(), 62500.0 + (rand::random::<f64>() * 500.0 - 250.0));
        solana_prices.insert("BTC/USDT".to_string(), 62450.0 + (rand::random::<f64>() * 500.0 - 250.0));
        solana_prices.insert("JUP/USDC".to_string(), 1.25 + (rand::random::<f64>() * 0.1 - 0.05));
        solana_prices.insert("BONK/USDT".to_string(), 0.000031 + (rand::random::<f64>() * 0.000001 - 0.0000005));
        
        let mut ethereum_prices = HashMap::new();
        ethereum_prices.insert("SOL/USDC".to_string(), 150.5 + (rand::random::<f64>() * 10.0 - 5.0));
        ethereum_prices.insert("SOL/USDT".to_string(), 150.4 + (rand::random::<f64>() * 10.0 - 5.0));
        ethereum_prices.insert("ETH/USDC".to_string(), 3500.0 + (rand::random::<f64>() * 50.0 - 25.0));
        ethereum_prices.insert("ETH/USDT".to_string(), 3498.0 + (rand::random::<f64>() * 50.0 - 25.0));
        ethereum_prices.insert("BTC/USDC".to_string(), 62520.0 + (rand::random::<f64>() * 500.0 - 250.0));
        ethereum_prices.insert("BTC/USDT".to_string(), 62480.0 + (rand::random::<f64>() * 500.0 - 250.0));
        
        let mut bsc_prices = HashMap::new();
        bsc_prices.insert("SOL/USDC".to_string(), 151.0 + (rand::random::<f64>() * 10.0 - 5.0));
        bsc_prices.insert("SOL/USDT".to_string(), 150.8 + (rand::random::<f64>() * 10.0 - 5.0));
        bsc_prices.insert("ETH/USDC".to_string(), 3503.0 + (rand::random::<f64>() * 50.0 - 25.0));
        bsc_prices.insert("ETH/USDT".to_string(), 3501.0 + (rand::random::<f64>() * 50.0 - 25.0));
        bsc_prices.insert("BTC/USDC".to_string(), 62550.0 + (rand::random::<f64>() * 500.0 - 250.0));
        bsc_prices.insert("BTC/USDT".to_string(), 62520.0 + (rand::random::<f64>() * 500.0 - 250.0));
        
        let mut arbitrum_prices = HashMap::new();
        arbitrum_prices.insert("SOL/USDC".to_string(), 149.5 + (rand::random::<f64>() * 10.0 - 5.0));
        arbitrum_prices.insert("SOL/USDT".to_string(), 149.4 + (rand::random::<f64>() * 10.0 - 5.0));
        arbitrum_prices.insert("ETH/USDC".to_string(), 3501.0 + (rand::random::<f64>() * 50.0 - 25.0));
        arbitrum_prices.insert("ETH/USDT".to_string(), 3499.0 + (rand::random::<f64>() * 50.0 - 25.0));
        arbitrum_prices.insert("BTC/USDC".to_string(), 62530.0 + (rand::random::<f64>() * 500.0 - 250.0));
        arbitrum_prices.insert("BTC/USDT".to_string(), 62500.0 + (rand::random::<f64>() * 500.0 - 250.0));
        
        self.price_cache.insert("solana".to_string(), solana_prices);
        self.price_cache.insert("ethereum".to_string(), ethereum_prices);
        self.price_cache.insert("bsc".to_string(), bsc_prices);
        self.price_cache.insert("arbitrum".to_string(), arbitrum_prices);
        
        Ok(())
    }
    
    /// Generate opportunities from price differences
    async fn generate_opportunities(&mut self) -> Result<Vec<Opportunity>> {
        let mut opportunities = Vec::new();
        
        // Iterate over all blockchain pairs
        for source_chain in &self.config.enabled_blockchains {
            for destination_chain in &self.config.enabled_blockchains {
                // Skip same chain
                if source_chain == destination_chain {
                    continue;
                }
                
                // Get prices for both chains
                let source_prices = if let Some(prices) = self.price_cache.get(source_chain.name()) {
                    prices
                } else {
                    continue;
                };
                
                let destination_prices = if let Some(prices) = self.price_cache.get(destination_chain.name()) {
                    prices
                } else {
                    continue;
                };
                
                // Compare prices for each token pair
                for token_pair in &self.config.token_pairs {
                    if let (Some(source_price), Some(destination_price)) = (source_prices.get(token_pair), destination_prices.get(token_pair)) {
                        let price_diff = destination_price - source_price;
                        let diff_percentage = (price_diff / source_price) * 100.0;
                        
                        // Check if the price difference is significant
                        if diff_percentage.abs() > self.strategy_params.min_price_difference_percentage {
                            // Create arbitrage opportunity (only if destination price is higher)
                            if destination_price > source_price {
                                let id = Uuid::new_v4().to_string();
                                let timestamp = SystemTime::now()
                                    .duration_since(UNIX_EPOCH)
                                    .unwrap()
                                    .as_secs();
                                
                                // Calculate strategy parameters
                                let source_fee_percentage = 0.05; // 0.05% for Solana DEX trades
                                let destination_fee_percentage = 0.3; // 0.3% for Ethereum DEX trades
                                let bridge_fee_percentage = 0.1; // 0.1% for Wormhole
                                
                                let total_fee_percentage = source_fee_percentage + destination_fee_percentage + bridge_fee_percentage;
                                
                                // Only create opportunity if still profitable after fees
                                if diff_percentage > total_fee_percentage {
                                    let profit_percentage = diff_percentage - total_fee_percentage;
                                    
                                    // Calculate optimal input amount
                                    let optimal_input_amount = calculate_optimal_amount(
                                        *source_price,
                                        *destination_price,
                                        source_fee_percentage,
                                        destination_fee_percentage,
                                        bridge_fee_percentage,
                                        self.strategy_params.max_input_amount,
                                        self.strategy_params.slippage_model.clone(),
                                    );
                                    
                                    // Calculate estimated profit
                                    let profit = check_profitability(
                                        optimal_input_amount,
                                        *source_price,
                                        *destination_price,
                                        source_fee_percentage,
                                        destination_fee_percentage,
                                        bridge_fee_percentage,
                                        self.strategy_params.slippage_model.clone(),
                                    );
                                    
                                    let opportunity = Opportunity {
                                        id,
                                        token_pair: token_pair.clone(),
                                        source_chain: source_chain.name().to_string(),
                                        destination_chain: destination_chain.name().to_string(),
                                        source_price: *source_price,
                                        destination_price: *destination_price,
                                        price_difference: price_diff,
                                        price_difference_percentage: diff_percentage,
                                        profit_percentage,
                                        optimal_input_amount,
                                        estimated_profit: profit,
                                        source_exchange: format!("jupiter_{}", source_chain.name()),
                                        destination_exchange: format!("uniswap_{}", destination_chain.name()),
                                        timestamp,
                                        source_fee_percentage,
                                        destination_fee_percentage,
                                        bridge_fee_percentage,
                                        total_fee_percentage,
                                    };
                                    
                                    opportunities.push(opportunity);
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Sort opportunities by profit percentage (highest first)
        opportunities.sort_by(|a, b| b.profit_percentage.partial_cmp(&a.profit_percentage).unwrap());
        
        Ok(opportunities)
    }
    
    /// Get all current opportunities
    pub fn get_opportunities(&self) -> &[Opportunity] {
        &self.opportunities
    }
    
    /// Find an opportunity by ID
    pub fn find_opportunity(&self, id: &str) -> Option<&Opportunity> {
        self.opportunities.iter().find(|o| o.id == id)
    }
}

/// Start a scanner in a background task
pub async fn start_background_scanner(
    config: ScannerConfig,
    strategy_params: StrategyParams,
) -> Result<Arc<Mutex<Scanner>>> {
    let mut scanner = Scanner::new(config.clone(), strategy_params);
    
    // Start the scanner
    scanner.start()?;
    
    // Wrap in Arc<Mutex>
    let scanner_arc = Arc::new(Mutex::new(scanner));
    
    // Start background task
    let scanner_clone = scanner_arc.clone();
    let scan_interval = config.scan_interval_secs;
    
    tokio::spawn(async move {
        let mut interval = time::interval(Duration::from_secs(scan_interval));
        
        loop {
            interval.tick().await;
            
            if let Ok(mut scanner) = scanner_clone.try_lock() {
                if scanner.is_active() {
                    if let Err(e) = scanner.scan().await {
                        println!("❌ Scanner error: {}", e);
                    }
                }
            }
        }
    });
    
    Ok(scanner_arc)
}