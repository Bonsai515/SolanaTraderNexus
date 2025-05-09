// MarinaLabs (MariDE) DEX integration

use super::{TokenPair, PriceData, OrderBookData, DexSource};
use crate::solana::{SolanaConnection, WalletManager, Wallet};
use anyhow::{Result, anyhow, Context};
use reqwest::Client;
use serde::{Serialize, Deserialize};
use serde_json::Value;
use log::{info, warn, error, debug};
use std::time::Duration;
use chrono::Utc;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::time::sleep;

// Marina API base URL
const MARINA_API_BASE: &str = "https://api.marinalabs.io/v1";

// Rate limiting: max 50 requests per minute
const MAX_REQUESTS_PER_MINUTE: u32 = 50;
const REQUEST_INTERVAL_MS: u64 = 60_000 / MAX_REQUESTS_PER_MINUTE as u64;

// Last request timestamp for basic rate limiting
static mut LAST_REQUEST: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

/// Marina Pool data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarinaPoolData {
    /// Pool address
    pub address: String,
    
    /// Token A mint
    pub token_a: String,
    
    /// Token B mint
    pub token_b: String,
    
    /// Token A/B price
    pub price: f64,
    
    /// TVL in USD
    pub tvl: f64,
    
    /// Volume (24h) in USD
    pub volume_24h: f64,
    
    /// Fee tier (bps)
    pub fee_tier: u16,
    
    /// Pool type (classic, concentrated, stable)
    pub pool_type: String,
}

/// Check if Marina API is accessible
pub async fn check_api_access() -> Result<()> {
    debug!("Checking Marina API access...");
    
    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .build()?;
    
    // Simple request to check if API is accessible
    let url = format!("{}/health", MARINA_API_BASE);
    
    let response = client.get(&url)
        .send()
        .await
        .context("Failed to connect to Marina API")?;
    
    if response.status().is_success() {
        debug!("Marina API is accessible");
        Ok(())
    } else {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        Err(anyhow!("Marina API returned error: {} - {}", status, error_text))
    }
}

/// Apply rate limiting
async fn apply_rate_limiting() {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;
    
    let last = unsafe {
        LAST_REQUEST.load(std::sync::atomic::Ordering::Relaxed)
    };
    
    if now - last < REQUEST_INTERVAL_MS {
        let sleep_time = REQUEST_INTERVAL_MS - (now - last);
        debug!("Rate limiting Marina API, sleeping for {} ms", sleep_time);
        sleep(Duration::from_millis(sleep_time)).await;
    }
    
    unsafe {
        LAST_REQUEST.store(now, std::sync::atomic::Ordering::Relaxed);
    }
}

/// Fetch price data from Marina
pub async fn fetch_price(pair: &TokenPair) -> Result<PriceData> {
    debug!("Fetching Marina price for {}", pair.to_string());
    
    // Apply rate limiting
    apply_rate_limiting().await;
    
    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .build()?;
    
    // Fetch from Marina API
    let url = format!("{}/price", MARINA_API_BASE);
    
    let response = client.get(&url)
        .query(&[
            ("tokenA", &pair.base),
            ("tokenB", &pair.quote),
            ("amount", "1000000") // Fixed input amount for price calculation
        ])
        .send()
        .await
        .context("Failed to fetch Marina price data")?;
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(anyhow!("Marina API returned error: {} - {}", status, error_text));
    }
    
    let data: Value = response.json().await?;
    
    // Extract price information
    if let Some(price) = data.get("price").and_then(|p| p.as_f64()) {
        // Create price data with values from the API
        let price_data = PriceData {
            pair: pair.clone(),
            source: DexSource::Marina,
            price,
            bid: data.get("bid").and_then(|b| b.as_f64()).unwrap_or(price * 0.997),
            ask: data.get("ask").and_then(|a| a.as_f64()).unwrap_or(price * 1.003),
            volume_24h: data.get("volume24h").and_then(|v| v.as_f64()).unwrap_or(0.0),
            timestamp: Utc::now(),
        };
        
        debug!("Marina price for {}: {}", pair.to_string(), price_data.price);
        
        Ok(price_data)
    } else {
        Err(anyhow!("Failed to extract price from Marina API response"))
    }
}

/// Fetch Marina Pools data
pub async fn fetch_pools() -> Result<Vec<MarinaPoolData>> {
    debug!("Fetching Marina Pools data");
    
    // Apply rate limiting
    apply_rate_limiting().await;
    
    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .build()?;
    
    // Fetch from Marina API
    let url = format!("{}/pools", MARINA_API_BASE);
    
    let response = client.get(&url)
        .query(&[("minTvl", "1000")]) // Only pools with at least $1k TVL
        .send()
        .await
        .context("Failed to fetch Marina Pools data")?;
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(anyhow!("Marina API returned error: {} - {}", status, error_text));
    }
    
    let data: Value = response.json().await?;
    
    // Extract pools information
    if let Some(pools) = data.get("pools").and_then(|w| w.as_array()) {
        let mut result = Vec::new();
        
        for pool in pools {
            if let (
                Some(address), 
                Some(token_a), 
                Some(token_b), 
                Some(price), 
                Some(tvl), 
                Some(volume_24h),
                Some(fee_tier),
                Some(pool_type)
            ) = (
                pool.get("address").and_then(|a| a.as_str()),
                pool.get("tokenA").and_then(|t| t.as_str()),
                pool.get("tokenB").and_then(|t| t.as_str()),
                pool.get("price").and_then(|p| p.as_f64()),
                pool.get("tvl").and_then(|t| t.as_f64()),
                pool.get("volume24h").and_then(|v| v.as_f64()),
                pool.get("feeTier").and_then(|f| f.as_u64().map(|v| v as u16)),
                pool.get("type").and_then(|v| v.as_str())
            ) {
                result.push(MarinaPoolData {
                    address: address.to_string(),
                    token_a: token_a.to_string(),
                    token_b: token_b.to_string(),
                    price,
                    tvl,
                    volume_24h,
                    fee_tier,
                    pool_type: pool_type.to_string(),
                });
            }
        }
        
        debug!("Fetched {} Marina Pools", result.len());
        
        Ok(result)
    } else {
        Err(anyhow!("Failed to extract pools from Marina API response"))
    }
}

/// Fetch order book data from Marina
/// For concentrated liquidity pools
pub async fn fetch_order_book(pair: &TokenPair) -> Result<OrderBookData> {
    debug!("Fetching Marina order book for {}", pair.to_string());
    
    // Apply rate limiting
    apply_rate_limiting().await;
    
    // First get the current pool price
    let price_data = fetch_price(pair).await?;
    
    // Get the current price
    let current_price = price_data.price;
    
    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .build()?;
    
    // Fetch liquidity depth from Marina API
    let url = format!("{}/depth", MARINA_API_BASE);
    
    let response = client.get(&url)
        .query(&[
            ("tokenA", &pair.base),
            ("tokenB", &pair.quote),
            ("levels", "20")
        ])
        .send()
        .await
        .context("Failed to fetch Marina depth data")?;
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(anyhow!("Marina API returned error: {} - {}", status, error_text));
    }
    
    let data: Value = response.json().await?;
    
    // Extract bids and asks
    let mut bids = Vec::new();
    let mut asks = Vec::new();
    
    if let Some(bids_data) = data.get("bids").and_then(|b| b.as_array()) {
        for bid in bids_data {
            if let (Some(price), Some(size)) = (
                bid.get("price").and_then(|p| p.as_f64()),
                bid.get("size").and_then(|s| s.as_f64())
            ) {
                bids.push((price, size));
            }
        }
    } else {
        // If no specific bids data, simulate based on current price
        for i in 1..20 {
            let price_level = current_price * (1.0 - (i as f64 * 0.002));
            let size = 100.0 / (i as f64 * 0.7); // More liquidity near the current price
            bids.push((price_level, size));
        }
    }
    
    if let Some(asks_data) = data.get("asks").and_then(|a| a.as_array()) {
        for ask in asks_data {
            if let (Some(price), Some(size)) = (
                ask.get("price").and_then(|p| p.as_f64()),
                ask.get("size").and_then(|s| s.as_f64())
            ) {
                asks.push((price, size));
            }
        }
    } else {
        // If no specific asks data, simulate based on current price
        for i in 1..20 {
            let price_level = current_price * (1.0 + (i as f64 * 0.002));
            let size = 100.0 / (i as f64 * 0.7); // More liquidity near the current price
            asks.push((price_level, size));
        }
    }
    
    let order_book = OrderBookData {
        pair: pair.clone(),
        source: DexSource::Marina,
        bids,
        asks,
        timestamp: Utc::now(),
    };
    
    Ok(order_book)
}

/// Marina client for interacting with Marina DEX
pub struct MarinaClient {
    /// HTTP client
    client: Client,
    
    /// Solana connection
    solana_connection: Arc<SolanaConnection>,
    
    /// Wallet manager
    wallet_manager: Arc<WalletManager>,
    
    /// Known pools
    pools: HashMap<String, MarinaPoolData>,
}

impl MarinaClient {
    /// Create a new Marina client
    pub fn new(
        solana_connection: Arc<SolanaConnection>,
        wallet_manager: Arc<WalletManager>,
    ) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .build()?;
        
        Ok(Self {
            client,
            solana_connection,
            wallet_manager,
            pools: HashMap::new(),
        })
    }
    
    /// Initialize the client by fetching available pools
    pub async fn initialize(&mut self) -> Result<()> {
        info!("Initializing Marina client");
        
        // Fetch available pools
        let pools = fetch_pools().await?;
        
        // Store pools by address
        for pool in pools {
            self.pools.insert(pool.address.clone(), pool);
        }
        
        info!("Marina client initialized with {} pools", self.pools.len());
        
        Ok(())
    }
    
    /// Get price for a token pair
    pub async fn get_price(&self, pair: &TokenPair) -> Result<PriceData> {
        fetch_price(pair).await
    }
    
    /// Get all available pools
    pub fn get_pools(&self) -> &HashMap<String, MarinaPoolData> {
        &self.pools
    }
    
    /// Swap tokens using Marina
    pub async fn swap(
        &self,
        wallet: &Wallet,
        from_token: &str,
        to_token: &str,
        amount: f64,
        slippage: f64,
    ) -> Result<String> {
        info!("Swapping {} {} for {} on Marina", amount, from_token, to_token);
        
        // In a real implementation, this would:
        // 1. Find the best Pool to use
        // 2. Create and sign the swap transaction
        // 3. Send the transaction and return the signature
        
        // For now, return a placeholder transaction signature
        Ok(format!("marina_swap_tx_{}_{}_{}", from_token, to_token, Utc::now().timestamp()))
    }
    
    /// Add liquidity to a Marina Pool
    pub async fn add_liquidity(
        &self,
        wallet: &Wallet,
        token_a: &str,
        token_b: &str,
        amount_a: f64,
        amount_b: f64,
        pool_type: PoolType,
    ) -> Result<String> {
        info!("Adding liquidity to Marina Pool: {} {} and {} {}, pool type: {:?}", 
            amount_a, token_a, amount_b, token_b, pool_type);
        
        // In a real implementation, this would:
        // 1. Find the appropriate Pool
        // 2. Create and sign the add liquidity transaction
        // 3. Send the transaction and return the signature
        
        // For now, return a placeholder transaction signature
        Ok(format!("marina_add_liquidity_tx_{}_{}_{}", token_a, token_b, Utc::now().timestamp()))
    }
    
    /// Remove liquidity from a Marina Pool
    pub async fn remove_liquidity(
        &self,
        wallet: &Wallet,
        pool_address: &str,
        percentage: f64,
    ) -> Result<String> {
        info!("Removing {}% liquidity from Marina Pool: {}", percentage * 100.0, pool_address);
        
        // In a real implementation, this would:
        // 1. Load the pool details
        // 2. Create and sign the remove liquidity transaction
        // 3. Send the transaction and return the signature
        
        // For now, return a placeholder transaction signature
        Ok(format!("marina_remove_liquidity_tx_{}_{}", pool_address, Utc::now().timestamp()))
    }
    
    /// Create concentrated liquidity position in a Marina Pool
    pub async fn create_position(
        &self,
        wallet: &Wallet,
        pool_address: &str,
        price_lower: f64,
        price_upper: f64,
        token_a_amount: f64,
        token_b_amount: f64,
    ) -> Result<String> {
        info!("Creating concentrated liquidity position in Marina Pool: {}", pool_address);
        
        // In a real implementation, this would:
        // 1. Check if the pool supports concentrated liquidity
        // 2. Create and sign the create position transaction
        // 3. Send the transaction and return the signature
        
        // For now, return a placeholder transaction signature
        Ok(format!("marina_create_position_tx_{}_{}", pool_address, Utc::now().timestamp()))
    }
    
    /// Collect fees from a Marina Pool position
    pub async fn collect_fees(
        &self,
        wallet: &Wallet,
        position_address: &str,
    ) -> Result<String> {
        info!("Collecting fees from Marina position: {}", position_address);
        
        // In a real implementation, this would:
        // 1. Load the position details
        // 2. Create and sign the collect fees transaction
        // 3. Send the transaction and return the signature
        
        // For now, return a placeholder transaction signature
        Ok(format!("marina_collect_fees_tx_{}_{}", position_address, Utc::now().timestamp()))
    }
}

/// Pool type for Marina DEX
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PoolType {
    /// Classic constant product pool (x*y=k)
    Classic,
    /// Concentrated liquidity pool
    Concentrated,
    /// Stable swap pool (for stablecoins)
    Stable,
}