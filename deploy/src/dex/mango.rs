// Mango Markets integration

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

// Mango Markets API base URL
const MANGO_API_BASE: &str = "https://api.mngo.cloud/data/v4";

// Rate limiting: max 60 requests per minute
const MAX_REQUESTS_PER_MINUTE: u32 = 60;
const REQUEST_INTERVAL_MS: u64 = 60_000 / MAX_REQUESTS_PER_MINUTE as u64;

// Last request timestamp for basic rate limiting
static mut LAST_REQUEST: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

/// Mango Market data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MangoMarketData {
    /// Market name
    pub name: String,
    
    /// Base token
    pub base_token: String,
    
    /// Quote token
    pub quote_token: String,
    
    /// Market address
    pub address: String,
    
    /// Oracle price
    pub oracle_price: f64,
    
    /// Minimum order size
    pub min_order_size: f64,
    
    /// Tick size
    pub tick_size: f64,
    
    /// 24h volume
    pub volume_24h: f64,
    
    /// 24h change percentage
    pub change_24h: f64,
}

/// Mango Position data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MangoPosition {
    /// Instrument symbol
    pub symbol: String,
    
    /// Position size (positive for long, negative for short)
    pub size: f64,
    
    /// Average entry price
    pub entry_price: f64,
    
    /// Current mark price
    pub mark_price: f64,
    
    /// Unrealized PnL
    pub unrealized_pnl: f64,
    
    /// Initial margin
    pub initial_margin: f64,
    
    /// Maintenance margin
    pub maintenance_margin: f64,
    
    /// Liquidation price
    pub liquidation_price: Option<f64>,
}

/// Check if Mango API is accessible
pub async fn check_api_access() -> Result<()> {
    debug!("Checking Mango API access...");
    
    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .build()?;
    
    // Simple request to check if API is accessible
    let url = format!("{}/markets", MANGO_API_BASE);
    
    let response = client.get(&url)
        .send()
        .await
        .context("Failed to connect to Mango API")?;
    
    if response.status().is_success() {
        debug!("Mango API is accessible");
        Ok(())
    } else {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        Err(anyhow!("Mango API returned error: {} - {}", status, error_text))
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
        debug!("Rate limiting Mango API, sleeping for {} ms", sleep_time);
        sleep(Duration::from_millis(sleep_time)).await;
    }
    
    unsafe {
        LAST_REQUEST.store(now, std::sync::atomic::Ordering::Relaxed);
    }
}

/// Fetch price data from Mango Markets
pub async fn fetch_price(pair: &TokenPair) -> Result<PriceData> {
    debug!("Fetching Mango price for {}", pair.to_string());
    
    // Apply rate limiting
    apply_rate_limiting().await;
    
    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .build()?;
    
    // Convert pair to mango market name format (e.g., SOL/USDC -> SOL-PERP)
    let market_name = format!("{}-PERP", pair.base);
    
    // Fetch from Mango Markets API
    let url = format!("{}/prices", MANGO_API_BASE);
    
    let response = client.get(&url)
        .query(&[("symbols", &market_name)])
        .send()
        .await
        .context("Failed to fetch Mango price data")?;
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(anyhow!("Mango API returned error: {} - {}", status, error_text));
    }
    
    let data: Value = response.json().await?;
    
    // Extract price information
    if let Some(prices) = data.as_array() {
        if let Some(price_data) = prices.iter().find(|p| p.get("symbol").and_then(|s| s.as_str()) == Some(&market_name)) {
            if let Some(price) = price_data.get("price").and_then(|p| p.as_f64()) {
                // Create price data with values from the API
                let price_data = PriceData {
                    pair: pair.clone(),
                    source: DexSource::Mango,
                    price,
                    bid: price_data.get("bid").and_then(|b| b.as_f64()).unwrap_or(price * 0.999),
                    ask: price_data.get("ask").and_then(|a| a.as_f64()).unwrap_or(price * 1.001),
                    volume_24h: price_data.get("volume24h").and_then(|v| v.as_f64()).unwrap_or(0.0),
                    timestamp: Utc::now(),
                };
                
                debug!("Mango price for {}: {}", pair.to_string(), price_data.price);
                
                return Ok(price_data);
            }
        }
    }
    
    Err(anyhow!("Failed to extract price from Mango API response"))
}

/// Fetch Mango Markets data
pub async fn fetch_markets() -> Result<Vec<MangoMarketData>> {
    debug!("Fetching Mango Markets data");
    
    // Apply rate limiting
    apply_rate_limiting().await;
    
    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .build()?;
    
    // Fetch from Mango Markets API
    let url = format!("{}/markets", MANGO_API_BASE);
    
    let response = client.get(&url)
        .send()
        .await
        .context("Failed to fetch Mango Markets data")?;
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(anyhow!("Mango API returned error: {} - {}", status, error_text));
    }
    
    let data: Value = response.json().await?;
    
    // Extract markets information
    if let Some(markets) = data.as_array() {
        let mut result = Vec::new();
        
        for market in markets {
            // Parse market data
            if let (
                Some(name),
                Some(base_token),
                Some(quote_token),
                Some(address),
                Some(oracle_price),
                Some(min_order_size),
                Some(tick_size)
            ) = (
                market.get("name").and_then(|a| a.as_str()),
                market.get("baseTokenName").and_then(|t| t.as_str()),
                market.get("quoteTokenName").and_then(|t| t.as_str()),
                market.get("publicKey").and_then(|p| p.as_str()),
                market.get("oraclePrice").and_then(|p| p.as_f64()),
                market.get("minOrderSize").and_then(|m| m.as_f64()),
                market.get("tickSize").and_then(|t| t.as_f64())
            ) {
                // Extract volume and price change if available
                let volume_24h = market.get("volume24h").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let change_24h = market.get("change24h").and_then(|c| c.as_f64()).unwrap_or(0.0);
                
                result.push(MangoMarketData {
                    name: name.to_string(),
                    base_token: base_token.to_string(),
                    quote_token: quote_token.to_string(),
                    address: address.to_string(),
                    oracle_price,
                    min_order_size,
                    tick_size,
                    volume_24h,
                    change_24h,
                });
            }
        }
        
        debug!("Fetched {} Mango Markets", result.len());
        
        Ok(result)
    } else {
        Err(anyhow!("Failed to extract markets from Mango API response"))
    }
}

/// Fetch order book data from Mango Markets
pub async fn fetch_order_book(pair: &TokenPair) -> Result<OrderBookData> {
    debug!("Fetching Mango order book for {}", pair.to_string());
    
    // Apply rate limiting
    apply_rate_limiting().await;
    
    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .build()?;
    
    // Convert pair to mango market name format (e.g., SOL/USDC -> SOL-PERP)
    let market_name = format!("{}-PERP", pair.base);
    
    // Fetch from Mango Markets API
    let url = format!("{}/orderbooks", MANGO_API_BASE);
    
    let response = client.get(&url)
        .query(&[("market", &market_name)])
        .send()
        .await
        .context("Failed to fetch Mango order book data")?;
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(anyhow!("Mango API returned error: {} - {}", status, error_text));
    }
    
    let data: Value = response.json().await?;
    
    // Extract bids and asks
    let mut bids = Vec::new();
    let mut asks = Vec::new();
    
    if let Some(bids_data) = data.get("bids").and_then(|b| b.as_array()) {
        for bid in bids_data {
            if let (Some(price), Some(size)) = (
                bid.get(0).and_then(|p| p.as_f64()),
                bid.get(1).and_then(|s| s.as_f64())
            ) {
                bids.push((price, size));
            }
        }
    }
    
    if let Some(asks_data) = data.get("asks").and_then(|a| a.as_array()) {
        for ask in asks_data {
            if let (Some(price), Some(size)) = (
                ask.get(0).and_then(|p| p.as_f64()),
                ask.get(1).and_then(|s| s.as_f64())
            ) {
                asks.push((price, size));
            }
        }
    }
    
    let order_book = OrderBookData {
        pair: pair.clone(),
        source: DexSource::Mango,
        bids,
        asks,
        timestamp: Utc::now(),
    };
    
    Ok(order_book)
}

/// Mango Markets client for interacting with Mango DEX
pub struct MangoClient {
    /// HTTP client
    client: Client,
    
    /// Solana connection
    solana_connection: Arc<SolanaConnection>,
    
    /// Wallet manager
    wallet_manager: Arc<WalletManager>,
    
    /// Known markets
    markets: HashMap<String, MangoMarketData>,
}

impl MangoClient {
    /// Create a new Mango client
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
            markets: HashMap::new(),
        })
    }
    
    /// Initialize the client by fetching available markets
    pub async fn initialize(&mut self) -> Result<()> {
        info!("Initializing Mango Markets client");
        
        // Fetch available markets
        let markets = fetch_markets().await?;
        
        // Store markets by name
        for market in markets {
            self.markets.insert(market.name.clone(), market);
        }
        
        info!("Mango Markets client initialized with {} markets", self.markets.len());
        
        Ok(())
    }
    
    /// Get price for a token pair
    pub async fn get_price(&self, pair: &TokenPair) -> Result<PriceData> {
        fetch_price(pair).await
    }
    
    /// Get order book for a token pair
    pub async fn get_order_book(&self, pair: &TokenPair) -> Result<OrderBookData> {
        fetch_order_book(pair).await
    }
    
    /// Get all available markets
    pub fn get_markets(&self) -> &HashMap<String, MangoMarketData> {
        &self.markets
    }
    
    /// Place a limit order on Mango Markets
    pub async fn place_limit_order(
        &self,
        wallet: &Wallet,
        market: &str,
        side: OrderSide,
        price: f64,
        size: f64,
        client_order_id: Option<u64>,
    ) -> Result<String> {
        info!("Placing limit order on Mango Markets: {} {} {} @ {}", 
            market, side, size, price);
        
        // In a real implementation, this would:
        // 1. Find the market
        // 2. Create and sign the place order transaction
        // 3. Send the transaction and return the signature
        
        // For now, return a placeholder transaction signature
        Ok(format!("mango_place_order_tx_{}_{}_{}", market, side, Utc::now().timestamp()))
    }
    
    /// Place a market order on Mango Markets
    pub async fn place_market_order(
        &self,
        wallet: &Wallet,
        market: &str,
        side: OrderSide,
        size: f64,
        client_order_id: Option<u64>,
    ) -> Result<String> {
        info!("Placing market order on Mango Markets: {} {} {}", 
            market, side, size);
        
        // In a real implementation, this would:
        // 1. Find the market
        // 2. Create and sign the place order transaction
        // 3. Send the transaction and return the signature
        
        // For now, return a placeholder transaction signature
        Ok(format!("mango_place_order_tx_{}_{}_{}", market, side, Utc::now().timestamp()))
    }
    
    /// Cancel an order on Mango Markets
    pub async fn cancel_order(
        &self,
        wallet: &Wallet,
        order_id: u64,
    ) -> Result<String> {
        info!("Cancelling order on Mango Markets: {}", order_id);
        
        // In a real implementation, this would:
        // 1. Create and sign the cancel order transaction
        // 2. Send the transaction and return the signature
        
        // For now, return a placeholder transaction signature
        Ok(format!("mango_cancel_order_tx_{}_{}", order_id, Utc::now().timestamp()))
    }
    
    /// Get account balances on Mango Markets
    pub async fn get_balances(
        &self,
        wallet: &Wallet,
    ) -> Result<HashMap<String, f64>> {
        info!("Getting balances for wallet {} on Mango Markets", wallet.pubkey());
        
        // In a real implementation, this would:
        // 1. Query the Mango Markets API for account balances
        // 2. Return the balances for each token
        
        // For now, return placeholder balances
        let mut balances = HashMap::new();
        balances.insert("USDC".to_string(), 1000.0);
        balances.insert("SOL".to_string(), 10.0);
        balances.insert("BTC".to_string(), 0.05);
        
        Ok(balances)
    }
    
    /// Get open positions on Mango Markets
    pub async fn get_positions(
        &self,
        wallet: &Wallet,
    ) -> Result<Vec<MangoPosition>> {
        info!("Getting positions for wallet {} on Mango Markets", wallet.pubkey());
        
        // In a real implementation, this would:
        // 1. Query the Mango Markets API for account positions
        // 2. Return the positions for each market
        
        // For now, return placeholder positions
        let sol_position = MangoPosition {
            symbol: "SOL-PERP".to_string(),
            size: 5.0,
            entry_price: 100.0,
            mark_price: 105.0,
            unrealized_pnl: 25.0,
            initial_margin: 50.0,
            maintenance_margin: 25.0,
            liquidation_price: Some(80.0),
        };
        
        let btc_position = MangoPosition {
            symbol: "BTC-PERP".to_string(),
            size: -0.01,
            entry_price: 50000.0,
            mark_price: 49000.0,
            unrealized_pnl: 10.0,
            initial_margin: 100.0,
            maintenance_margin: 50.0,
            liquidation_price: Some(55000.0),
        };
        
        Ok(vec![sol_position, btc_position])
    }
}

/// Order side (buy or sell)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OrderSide {
    /// Buy order
    Buy,
    /// Sell order
    Sell,
}