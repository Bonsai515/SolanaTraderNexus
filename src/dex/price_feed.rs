use crate::dex::rate_limiter::RateLimiter;
use crate::models::{TokenPrice, MarketData};
use crate::solana::SolanaConnection;
use anyhow::{Result, Context};
use log::{info, warn, debug, error};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};
use tokio::time::interval;
use chrono::Utc;
use solana_sdk::pubkey::Pubkey;

/// Supported price feed sources
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PriceSource {
    Jupiter,
    Goat,
    Raydium,
    Orca,
    Openbook,
    Pyth,
}

/// Price feed configuration
#[derive(Debug, Clone)]
pub struct PriceFeedConfig {
    /// Update interval in seconds
    pub update_interval_secs: u64,
    
    /// Token list to track
    pub tokens: Vec<String>,
    
    /// Price sources in order of preference
    pub price_sources: Vec<PriceSource>,
    
    /// Cache duration in seconds
    pub cache_duration_secs: u64,
}

impl Default for PriceFeedConfig {
    fn default() -> Self {
        Self {
            update_interval_secs: 10,
            tokens: vec![
                "SOL".to_string(),
                "USDC".to_string(),
                "BTC".to_string(),
                "ETH".to_string(),
                "RAY".to_string(),
                "ORCA".to_string(),
                "BONK".to_string(),
                "JUP".to_string(),
            ],
            price_sources: vec![
                PriceSource::Jupiter,
                PriceSource::Goat,
                PriceSource::Pyth,
            ],
            cache_duration_secs: 60,
        }
    }
}

/// Price Feed Service
pub struct PriceFeed {
    /// Current prices
    prices: RwLock<HashMap<String, TokenPrice>>,
    
    /// Price feed configuration
    config: RwLock<PriceFeedConfig>,
    
    /// Last update time
    last_update: RwLock<Instant>,
    
    /// Rate limiter
    rate_limiter: Arc<RateLimiter>,
    
    /// Solana connection
    solana_connection: Arc<SolanaConnection>,
    
    /// Is the price feed running
    is_running: RwLock<bool>,
    
    /// Update task
    update_task: RwLock<Option<tokio::task::JoinHandle<()>>>,
}

impl PriceFeed {
    /// Create a new price feed
    pub fn new(
        config: PriceFeedConfig,
        rate_limiter: Arc<RateLimiter>,
        solana_connection: Arc<SolanaConnection>,
    ) -> Self {
        info!("Initializing price feed with {} tokens", config.tokens.len());
        
        Self {
            prices: RwLock::new(HashMap::new()),
            config: RwLock::new(config),
            last_update: RwLock::new(Instant::now()),
            rate_limiter,
            solana_connection,
            is_running: RwLock::new(false),
            update_task: RwLock::new(None),
        }
    }
    
    /// Start the price feed
    pub fn start(&self) -> Result<()> {
        let mut is_running = self.is_running.write().unwrap();
        if *is_running {
            info!("Price feed is already running");
            return Ok(());
        }
        
        *is_running = true;
        
        // Create a clone of required components for the task
        let rate_limiter = Arc::clone(&self.rate_limiter);
        let solana_connection = Arc::clone(&self.solana_connection);
        let prices = Arc::new(self.prices.clone());
        let config = self.config.read().unwrap().clone();
        let update_interval = Duration::from_secs(config.update_interval_secs);
        
        // Create update task
        let task = tokio::spawn(async move {
            let mut update_interval = interval(update_interval);
            
            loop {
                update_interval.tick().await;
                
                if let Err(e) = Self::update_prices(
                    Arc::clone(&prices),
                    &config,
                    Arc::clone(&rate_limiter),
                    Arc::clone(&solana_connection)
                ).await {
                    error!("Failed to update prices: {}", e);
                }
            }
        });
        
        let mut update_task = self.update_task.write().unwrap();
        *update_task = Some(task);
        
        info!("Price feed started successfully");
        Ok(())
    }
    
    /// Stop the price feed
    pub fn stop(&self) -> Result<()> {
        let mut is_running = self.is_running.write().unwrap();
        if !*is_running {
            info!("Price feed is not running");
            return Ok(());
        }
        
        *is_running = false;
        
        let mut update_task = self.update_task.write().unwrap();
        if let Some(task) = update_task.take() {
            task.abort();
            info!("Price feed stopped");
        }
        
        Ok(())
    }
    
    /// Get the latest market data
    pub fn get_market_data(&self) -> Result<MarketData> {
        let prices = self.prices.read().unwrap();
        let config = self.config.read().unwrap();
        
        // Check if we need to update
        let last_update = self.last_update.read().unwrap();
        let elapsed = last_update.elapsed();
        
        if elapsed > Duration::from_secs(config.cache_duration_secs) {
            warn!("Using stale price data ({}s old)", elapsed.as_secs());
        }
        
        // Convert to vector of token prices
        let tokens: Vec<TokenPrice> = prices.values().cloned().collect();
        
        Ok(MarketData {
            tokens,
            timestamp: Utc::now(),
        })
    }
    
    /// Update token prices
    async fn update_prices(
        prices: Arc<RwLock<HashMap<String, TokenPrice>>>,
        config: &PriceFeedConfig,
        rate_limiter: Arc<RateLimiter>,
        solana_connection: Arc<SolanaConnection>,
    ) -> Result<()> {
        debug!("Updating token prices");
        
        // Check rate limiter
        rate_limiter.check_price_query().await?;
        
        let mut updated_prices = HashMap::new();
        
        // Iterate through each token
        for token_symbol in &config.tokens {
            // Try each price source in order of preference
            for &source in &config.price_sources {
                match Self::fetch_token_price(token_symbol, source, &rate_limiter, &solana_connection).await {
                    Ok(price) => {
                        updated_prices.insert(token_symbol.clone(), price);
                        break;
                    },
                    Err(e) => {
                        warn!("Failed to get price for {} from {:?}: {}", token_symbol, source, e);
                        continue;
                    }
                }
            }
        }
        
        // Update prices
        let mut price_lock = prices.write().unwrap();
        *price_lock = updated_prices;
        
        debug!("Updated prices for {} tokens", price_lock.len());
        Ok(())
    }
    
    /// Fetch token price from a specific source
    async fn fetch_token_price(
        token_symbol: &str,
        source: PriceSource,
        rate_limiter: &RateLimiter,
        solana_connection: &SolanaConnection,
    ) -> Result<TokenPrice> {
        // Check rate limiter
        rate_limiter.check_dex_query().await?;
        
        match source {
            PriceSource::Jupiter => Self::fetch_jupiter_price(token_symbol, solana_connection).await,
            PriceSource::Goat => Self::fetch_goat_price(token_symbol, solana_connection).await,
            PriceSource::Pyth => Self::fetch_pyth_price(token_symbol, solana_connection).await,
            _ => Err(anyhow::anyhow!("Price source {:?} not implemented yet", source)),
        }
    }
    
    /// Fetch price from Jupiter
    async fn fetch_jupiter_price(token_symbol: &str, solana_connection: &SolanaConnection) -> Result<TokenPrice> {
        // This would be implemented using the Jupiter API
        // For now, we'll use a placeholder implementation
        
        // Note: In a real implementation, you would:
        // 1. Convert the token symbol to a mint address
        // 2. Query Jupiter's price API
        // 3. Parse the response and convert to TokenPrice
        
        // Example placeholder implementation (replace with actual implementation)
        let mint_address = Self::get_token_mint(token_symbol)?;
        
        // In a real implementation, use the jupiter-aggregator crate or API
        let price = match token_symbol {
            "SOL" => 100.0,
            "USDC" => 1.0,
            "BTC" => 50000.0,
            "ETH" => 3000.0,
            _ => 0.5, // Default placeholder price
        };
        
        let volume_24h = 1000000.0; // Placeholder volume
        let change_24h = 2.5; // Placeholder 24h change
        
        Ok(TokenPrice {
            symbol: token_symbol.to_string(),
            mint: mint_address.to_string(),
            price,
            volume_24h,
            change_24h,
            source: "jupiter".to_string(),
            last_updated: Utc::now(),
        })
    }
    
    /// Fetch price from Goat
    async fn fetch_goat_price(token_symbol: &str, solana_connection: &SolanaConnection) -> Result<TokenPrice> {
        // This would be implemented using the Goat SDK
        // For now, we'll use a placeholder implementation
        
        // Note: In a real implementation, you would:
        // 1. Convert the token symbol to a mint address
        // 2. Use the Goat SDK to query prices
        // 3. Parse the response and convert to TokenPrice
        
        // Example placeholder implementation (replace with actual implementation)
        let mint_address = Self::get_token_mint(token_symbol)?;
        
        // In a real implementation, use the goat-sdk crate
        let price = match token_symbol {
            "SOL" => 101.0,
            "USDC" => 1.0,
            "BTC" => 50100.0,
            "ETH" => 3010.0,
            _ => 0.51, // Default placeholder price
        };
        
        let volume_24h = 1100000.0; // Placeholder volume
        let change_24h = 2.7; // Placeholder 24h change
        
        Ok(TokenPrice {
            symbol: token_symbol.to_string(),
            mint: mint_address.to_string(),
            price,
            volume_24h,
            change_24h,
            source: "goat".to_string(),
            last_updated: Utc::now(),
        })
    }
    
    /// Fetch price from Pyth
    async fn fetch_pyth_price(token_symbol: &str, solana_connection: &SolanaConnection) -> Result<TokenPrice> {
        // This would be implemented using Pyth's on-chain price accounts
        // For now, we'll use a placeholder implementation
        
        // Note: In a real implementation, you would:
        // 1. Convert the token symbol to a Pyth price account address
        // 2. Query that account using the Solana connection
        // 3. Parse the account data to extract the price
        
        // Example placeholder implementation (replace with actual implementation)
        let mint_address = Self::get_token_mint(token_symbol)?;
        
        // In a real implementation, you'd query Pyth's on-chain price account
        let price = match token_symbol {
            "SOL" => 102.0,
            "USDC" => 1.0,
            "BTC" => 50200.0,
            "ETH" => 3020.0,
            _ => 0.52, // Default placeholder price
        };
        
        let volume_24h = 1200000.0; // Placeholder volume
        let change_24h = 2.9; // Placeholder 24h change
        
        Ok(TokenPrice {
            symbol: token_symbol.to_string(),
            mint: mint_address.to_string(),
            price,
            volume_24h,
            change_24h,
            source: "pyth".to_string(),
            last_updated: Utc::now(),
        })
    }
    
    /// Helper method to convert token symbol to mint address
    fn get_token_mint(token_symbol: &str) -> Result<String> {
        // In a real implementation, you would look up the mint address for each token
        // For now, we'll use placeholder addresses
        let mint = match token_symbol {
            "SOL" => "So11111111111111111111111111111111111111112",
            "USDC" => "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            "BTC" => "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E", // Solana BTC (wrapped)
            "ETH" => "2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk", // Solana ETH (wrapped)
            "RAY" => "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
            "ORCA" => "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",
            "BONK" => "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
            "JUP" => "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
            _ => return Err(anyhow::anyhow!("Unknown token: {}", token_symbol)),
        };
        
        Ok(mint.to_string())
    }
    
    /// Update the configuration
    pub fn update_config(&self, config: PriceFeedConfig) -> Result<()> {
        let mut current_config = self.config.write().unwrap();
        *current_config = config;
        info!("Price feed configuration updated");
        Ok(())
    }
    
    /// Add a token to track
    pub fn add_token(&self, token_symbol: &str) -> Result<()> {
        let mut config = self.config.write().unwrap();
        if !config.tokens.contains(&token_symbol.to_string()) {
            config.tokens.push(token_symbol.to_string());
            info!("Added token {} to price feed", token_symbol);
        }
        Ok(())
    }
    
    /// Remove a token from tracking
    pub fn remove_token(&self, token_symbol: &str) -> Result<()> {
        let mut config = self.config.write().unwrap();
        config.tokens.retain(|t| t != token_symbol);
        info!("Removed token {} from price feed", token_symbol);
        Ok(())
    }
    
    /// Set the update interval
    pub fn set_update_interval(&self, seconds: u64) -> Result<()> {
        let mut config = self.config.write().unwrap();
        config.update_interval_secs = seconds;
        info!("Price feed update interval set to {}s", seconds);
        Ok(())
    }
}