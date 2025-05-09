// DEX integration module

mod jupiter;
mod raydium;
mod openbook;
mod orca;
mod meteora;
mod mango;
mod marina;
mod rate_limiter;
mod price_feed;

use crate::solana::{SolanaConnection, WalletManager, Wallet};
use crate::models::{Strategy, StrategyType, Transaction, TradingSignal};
use std::sync::{Arc, RwLock};
use log::{info, warn, error, debug};
use anyhow::{Result, anyhow};
use uuid::Uuid;
use serde::{Serialize, Deserialize};
use tokio::task::JoinHandle;
use std::collections::HashMap;

/// Available DEX sources
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum DexSource {
    Jupiter,
    Raydium,
    Openbook,
    Orca,
    Meteora,
    Mango,
    Marina,
    // Add future DEXs here
}

/// Trading strategy implementation
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TradingStrategy {
    MarketMaking,
    Arbitrage,
    MomentumTrading,
    RangeTrading,
    LiquidityProviding,
}

/// Token pair with base and quote tokens
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct TokenPair {
    /// Base token (e.g., SOL in SOL/USDC)
    pub base: String,
    
    /// Quote token (e.g., USDC in SOL/USDC)
    pub quote: String,
}

impl TokenPair {
    /// Create a new token pair
    pub fn new(base: &str, quote: &str) -> Self {
        Self {
            base: base.to_string(),
            quote: quote.to_string(),
        }
    }
    
    /// Convert pair to string format
    pub fn to_string(&self) -> String {
        format!("{}/{}", self.base, self.quote)
    }
    
    /// Parse from string format
    pub fn from_string(pair_str: &str) -> Result<Self> {
        let parts: Vec<&str> = pair_str.split('/').collect();
        if parts.len() != 2 {
            return Err(anyhow!("Invalid pair format, expected BASE/QUOTE"));
        }
        
        Ok(Self::new(parts[0], parts[1]))
    }
}

/// Price data from a DEX
#[derive(Debug, Clone)]
pub struct PriceData {
    /// Token pair
    pub pair: TokenPair,
    
    /// Source DEX
    pub source: DexSource,
    
    /// Current price
    pub price: f64,
    
    /// Bid price (highest buy order)
    pub bid: f64,
    
    /// Ask price (lowest sell order)
    pub ask: f64,
    
    /// 24h volume in quote currency
    pub volume_24h: f64,
    
    /// Timestamp when this price was fetched
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

/// Order book data
#[derive(Debug, Clone)]
pub struct OrderBookData {
    /// Token pair
    pub pair: TokenPair,
    
    /// Source DEX
    pub source: DexSource,
    
    /// Bids (price -> size)
    pub bids: Vec<(f64, f64)>,
    
    /// Asks (price -> size)
    pub asks: Vec<(f64, f64)>,
    
    /// Timestamp when this order book was fetched
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

/// DEX client for interacting with various decentralized exchanges
pub struct DexClient {
    /// Solana connection
    solana_connection: Arc<SolanaConnection>,
    
    /// Wallet manager
    wallet_manager: Arc<WalletManager>,
    
    /// Active strategies
    strategies: RwLock<HashMap<String, TradingStrategy>>,
    
    /// Price monitoring task
    price_task: std::sync::Mutex<Option<JoinHandle<()>>>,
    
    /// Strategy execution task
    strategy_task: std::sync::Mutex<Option<JoinHandle<()>>>,
}

impl DexClient {
    /// Create a new DEX client
    pub async fn new(
        solana_connection: Arc<SolanaConnection>,
        wallet_manager: Arc<WalletManager>,
    ) -> Result<Self> {
        info!("Initializing DEX client with multiple DEX integrations (Jupiter, Raydium, Openbook, Orca, Meteora, Mango, Marina)");
        
        // Check if we have access to all required API endpoints
        Self::check_api_access().await?;
        
        let client = Self {
            solana_connection,
            wallet_manager,
            strategies: RwLock::new(HashMap::new()),
            price_task: std::sync::Mutex::new(None),
            strategy_task: std::sync::Mutex::new(None),
        };
        
        // Start price monitoring
        client.start_price_monitoring();
        
        // Start strategy execution
        client.start_strategy_execution();
        
        Ok(client)
    }
    
    /// Check if we have access to all required API endpoints
    async fn check_api_access() -> Result<()> {
        // Check Jupiter API access
        jupiter::check_api_access().await?;
        
        // Check Raydium API access
        raydium::check_api_access().await?;
        
        // Check Openbook API access
        openbook::check_api_access().await?;
        
        // Additional DEXs - attempt to connect but don't fail if unavailable
        
        // Check Orca API access
        if let Err(e) = orca::check_api_access().await {
            warn!("Orca API access check failed: {}", e);
        }
        
        // Check Meteora API access
        if let Err(e) = meteora::check_api_access().await {
            warn!("Meteora API access check failed: {}", e);
        }
        
        // Check Mango API access
        if let Err(e) = mango::check_api_access().await {
            warn!("Mango API access check failed: {}", e);
        }
        
        // Check Marina API access
        if let Err(e) = marina::check_api_access().await {
            warn!("Marina API access check failed: {}", e);
        }
        
        Ok(())
    }
    
    /// Start price monitoring task
    fn start_price_monitoring(&self) {
        let dex_client = Arc::new(self.clone());
        
        let handle = tokio::spawn(async move {
            info!("Starting price monitoring task");
            
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(5));
            
            loop {
                interval.tick().await;
                
                // Monitor all active trading pairs
                let pairs = dex_client.get_active_pairs();
                
                for pair in pairs {
                    // Get latest prices from all DEXes
                    if let Err(e) = dex_client.fetch_prices(&pair).await {
                        warn!("Failed to fetch prices for {}: {}", pair.to_string(), e);
                    }
                }
            }
        });
        
        let mut price_task = self.price_task.lock().unwrap();
        *price_task = Some(handle);
        
        debug!("Price monitoring task started");
    }
    
    /// Start strategy execution task
    fn start_strategy_execution(&self) {
        let dex_client = Arc::new(self.clone());
        
        let handle = tokio::spawn(async move {
            info!("Starting strategy execution task");
            
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(10));
            
            loop {
                interval.tick().await;
                
                // Execute all active strategies
                if let Err(e) = dex_client.execute_strategies().await {
                    error!("Failed to execute strategies: {}", e);
                }
            }
        });
        
        let mut strategy_task = self.strategy_task.lock().unwrap();
        *strategy_task = Some(handle);
        
        debug!("Strategy execution task started");
    }
    
    /// Get all active trading pairs
    fn get_active_pairs(&self) -> Vec<TokenPair> {
        let strategies = self.strategies.read().unwrap();
        
        strategies.keys()
            .map(|pair_str| TokenPair::from_string(pair_str).unwrap_or_else(|_| {
                // Default to SOL/USDC if parsing fails
                TokenPair::new("SOL", "USDC")
            }))
            .collect()
    }
    
    /// Fetch latest prices for a pair from all DEXes
    async fn fetch_prices(&self, pair: &TokenPair) -> Result<HashMap<DexSource, PriceData>> {
        let mut results = HashMap::new();
        
        // Fetch from Jupiter
        match jupiter::fetch_price(pair).await {
            Ok(price_data) => {
                results.insert(DexSource::Jupiter, price_data);
            }
            Err(e) => {
                warn!("Failed to fetch Jupiter price for {}: {}", pair.to_string(), e);
            }
        }
        
        // Fetch from Raydium
        match raydium::fetch_price(pair).await {
            Ok(price_data) => {
                results.insert(DexSource::Raydium, price_data);
            }
            Err(e) => {
                warn!("Failed to fetch Raydium price for {}: {}", pair.to_string(), e);
            }
        }
        
        // Fetch from Openbook
        match openbook::fetch_price(pair).await {
            Ok(price_data) => {
                results.insert(DexSource::Openbook, price_data);
            }
            Err(e) => {
                warn!("Failed to fetch Openbook price for {}: {}", pair.to_string(), e);
            }
        }
        
        // Fetch from Orca
        match orca::fetch_price(pair).await {
            Ok(price_data) => {
                results.insert(DexSource::Orca, price_data);
            }
            Err(e) => {
                debug!("Failed to fetch Orca price for {}: {}", pair.to_string(), e);
            }
        }
        
        // Fetch from Meteora
        match meteora::fetch_price(pair).await {
            Ok(price_data) => {
                results.insert(DexSource::Meteora, price_data);
            }
            Err(e) => {
                debug!("Failed to fetch Meteora price for {}: {}", pair.to_string(), e);
            }
        }
        
        // Fetch from Mango Markets
        match mango::fetch_price(pair).await {
            Ok(price_data) => {
                results.insert(DexSource::Mango, price_data);
            }
            Err(e) => {
                debug!("Failed to fetch Mango price for {}: {}", pair.to_string(), e);
            }
        }
        
        // Fetch from Marina
        match marina::fetch_price(pair).await {
            Ok(price_data) => {
                results.insert(DexSource::Marina, price_data);
            }
            Err(e) => {
                debug!("Failed to fetch Marina price for {}: {}", pair.to_string(), e);
            }
        }
        
        if results.is_empty() {
            return Err(anyhow!("Failed to fetch prices from any DEX"));
        }
        
        Ok(results)
    }
    
    /// Execute all active strategies
    async fn execute_strategies(&self) -> Result<()> {
        let strategies = self.strategies.read().unwrap();
        
        for (pair_str, strategy) in strategies.iter() {
            let pair = TokenPair::from_string(pair_str)?;
            
            // Execute strategy based on type
            match strategy {
                TradingStrategy::MarketMaking => {
                    self.execute_market_making(&pair).await?;
                }
                TradingStrategy::Arbitrage => {
                    self.execute_arbitrage(&pair).await?;
                }
                TradingStrategy::MomentumTrading => {
                    self.execute_momentum_trading(&pair).await?;
                }
                TradingStrategy::RangeTrading => {
                    self.execute_range_trading(&pair).await?;
                }
                TradingStrategy::LiquidityProviding => {
                    self.execute_liquidity_providing(&pair).await?;
                }
            }
        }
        
        Ok(())
    }
    
    /// Execute market making strategy
    async fn execute_market_making(&self, pair: &TokenPair) -> Result<()> {
        debug!("Executing market making strategy for {}", pair.to_string());
        
        // Get order book data from all DEXes
        let mut order_books = HashMap::new();
        
        // Jupiter order book
        if let Ok(book) = jupiter::fetch_order_book(pair).await {
            order_books.insert(DexSource::Jupiter, book);
        }
        
        // Raydium order book
        if let Ok(book) = raydium::fetch_order_book(pair).await {
            order_books.insert(DexSource::Raydium, book);
        }
        
        // Openbook order book
        if let Ok(book) = openbook::fetch_order_book(pair).await {
            order_books.insert(DexSource::Openbook, book);
        }
        
        // Orca order book
        if let Ok(book) = orca::fetch_order_book(pair).await {
            order_books.insert(DexSource::Orca, book);
        }
        
        // Meteora order book
        if let Ok(book) = meteora::fetch_order_book(pair).await {
            order_books.insert(DexSource::Meteora, book);
        }
        
        // Mango order book
        if let Ok(book) = mango::fetch_order_book(pair).await {
            order_books.insert(DexSource::Mango, book);
        }
        
        // Marina order book
        if let Ok(book) = marina::fetch_order_book(pair).await {
            order_books.insert(DexSource::Marina, book);
        }
        
        if order_books.is_empty() {
            return Err(anyhow!("Failed to fetch order books from any DEX"));
        }
        
        // For now, just log the order book data
        // In a real implementation, we would place orders on both sides of the book
        info!("Market making: Found {} order books for {}", order_books.len(), pair.to_string());
        
        // Find DEX with tightest spread
        let mut best_dex = None;
        let mut min_spread = f64::MAX;
        
        for (source, book) in &order_books {
            if !book.bids.is_empty() && !book.asks.is_empty() {
                let highest_bid = book.bids.iter().map(|(price, _)| *price).fold(0.0, f64::max);
                let lowest_ask = book.asks.iter().map(|(price, _)| *price).fold(f64::MAX, f64::min);
                
                if highest_bid > 0.0 && lowest_ask < f64::MAX {
                    let spread = (lowest_ask - highest_bid) / highest_bid;
                    
                    if spread < min_spread {
                        min_spread = spread;
                        best_dex = Some(*source);
                    }
                }
            }
        }
        
        if let Some(dex) = best_dex {
            info!("Best liquidity for {} found on {:?} with spread of {:.4}%", 
                pair.to_string(), dex, min_spread * 100.0);
        }
        
        // Strategy implementation will be added in future iterations
        
        Ok(())
    }
    
    /// Execute arbitrage strategy
    async fn execute_arbitrage(&self, pair: &TokenPair) -> Result<()> {
        debug!("Executing arbitrage strategy for {}", pair.to_string());
        
        // Get prices from all DEXes
        let prices = self.fetch_prices(pair).await?;
        
        if prices.len() < 2 {
            // Need at least 2 DEXes for arbitrage
            return Ok(());
        }
        
        // Find best buy and sell prices
        let mut best_buy = None;
        let mut best_sell = None;
        
        for (source, price_data) in prices.iter() {
            if best_buy.is_none() || price_data.bid > best_buy.unwrap().1 {
                best_buy = Some((*source, price_data.bid));
            }
            
            if best_sell.is_none() || price_data.ask < best_sell.unwrap().1 {
                best_sell = Some((*source, price_data.ask));
            }
        }
        
        if let (Some((buy_source, buy_price)), Some((sell_source, sell_price))) = (best_buy, best_sell) {
            if buy_source != sell_source && buy_price > sell_price {
                // Potential arbitrage opportunity
                let profit_pct = (buy_price - sell_price) / sell_price * 100.0;
                
                info!("Arbitrage opportunity: Buy {} on {} at {}, sell on {} at {}, profit: {:.2}%",
                    pair.to_string(), sell_source, sell_price, buy_source, buy_price, profit_pct);
                
                // Strategy implementation will be added in future iterations
            }
        }
        
        Ok(())
    }
    
    /// Execute momentum trading strategy
    async fn execute_momentum_trading(&self, pair: &TokenPair) -> Result<()> {
        debug!("Executing momentum trading strategy for {}", pair.to_string());
        
        // Strategy implementation will be added in future iterations
        
        Ok(())
    }
    
    /// Execute range trading strategy
    async fn execute_range_trading(&self, pair: &TokenPair) -> Result<()> {
        debug!("Executing range trading strategy for {}", pair.to_string());
        
        // Strategy implementation will be added in future iterations
        
        Ok(())
    }
    
    /// Execute liquidity providing strategy
    async fn execute_liquidity_providing(&self, pair: &TokenPair) -> Result<()> {
        debug!("Executing liquidity providing strategy for {}", pair.to_string());
        
        // Strategy implementation will be added in future iterations
        
        Ok(())
    }
    
    /// Activate a trading strategy
    pub fn activate_strategy(&self, pair_str: &str, strategy: TradingStrategy) -> Result<()> {
        // Validate pair format
        TokenPair::from_string(pair_str)?;
        
        // Add strategy to active strategies
        let mut strategies = self.strategies.write().unwrap();
        strategies.insert(pair_str.to_string(), strategy);
        
        info!("Activated {:?} strategy for {}", strategy, pair_str);
        
        Ok(())
    }
    
    /// Deactivate a trading strategy
    pub fn deactivate_strategy(&self, pair_str: &str) -> Result<()> {
        let mut strategies = self.strategies.write().unwrap();
        
        if strategies.remove(pair_str).is_some() {
            info!("Deactivated strategy for {}", pair_str);
            Ok(())
        } else {
            Err(anyhow!("No active strategy found for {}", pair_str))
        }
    }
    
    /// Get all active strategies
    pub fn get_active_strategies(&self) -> HashMap<String, TradingStrategy> {
        self.strategies.read().unwrap().clone()
    }
    
    /// Stop all background tasks
    pub fn stop(&self) -> Result<()> {
        // Stop price monitoring task
        let mut price_task = self.price_task.lock().unwrap();
        if let Some(task) = price_task.take() {
            task.abort();
            debug!("Price monitoring task stopped");
        }
        
        // Stop strategy execution task
        let mut strategy_task = self.strategy_task.lock().unwrap();
        if let Some(task) = strategy_task.take() {
            task.abort();
            debug!("Strategy execution task stopped");
        }
        
        Ok(())
    }
}

impl Clone for DexClient {
    fn clone(&self) -> Self {
        Self {
            solana_connection: self.solana_connection.clone(),
            wallet_manager: self.wallet_manager.clone(),
            strategies: RwLock::new(self.strategies.read().unwrap().clone()),
            price_task: std::sync::Mutex::new(None),
            strategy_task: std::sync::Mutex::new(None),
        }
    }
}