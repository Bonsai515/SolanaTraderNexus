// Jupiter DEX integration

use super::{TokenPair, PriceData, OrderBookData, DexSource};
use crate::solana::SolanaConnection;
use anyhow::{Result, anyhow, Context};
use reqwest::Client;
use serde::{Serialize, Deserialize};
use serde_json::Value;
use log::{info, warn, error, debug};
use std::time::Duration;
use chrono::Utc;
use std::collections::HashMap;
use tokio::time::sleep;

// Jupiter API base URL
const JUPITER_API_BASE: &str = "https://quote-api.jup.ag/v6";

// Rate limiting: max 50 requests per minute
const MAX_REQUESTS_PER_MINUTE: u32 = 50;
const REQUEST_INTERVAL_MS: u64 = 60_000 / MAX_REQUESTS_PER_MINUTE as u64;

// Last request timestamp for basic rate limiting
static mut LAST_REQUEST: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

/// Jupiter price response
#[derive(Debug, Deserialize)]
struct JupiterQuoteResponse {
    #[serde(rename = "inAmount")]
    in_amount: String,
    #[serde(rename = "outAmount")]
    out_amount: String,
    #[serde(rename = "otherAmountThreshold")]
    other_amount_threshold: String,
    #[serde(rename = "swapMode")]
    swap_mode: String,
    #[serde(rename = "priceImpactPct")]
    price_impact_pct: f64,
    #[serde(rename = "marketInfos")]
    market_infos: Vec<JupiterMarketInfo>,
}

/// Jupiter market info
#[derive(Debug, Deserialize)]
struct JupiterMarketInfo {
    id: String,
    label: String,
    #[serde(rename = "inputMint")]
    input_mint: String,
    #[serde(rename = "outputMint")]
    output_mint: String,
    #[serde(rename = "inAmount")]
    in_amount: String,
    #[serde(rename = "outAmount")]
    out_amount: String,
    #[serde(rename = "lpFee")]
    lp_fee: JupiterFee,
    #[serde(rename = "platformFee")]
    platform_fee: JupiterFee,
}

/// Jupiter fee
#[derive(Debug, Deserialize)]
struct JupiterFee {
    amount: String,
    #[serde(rename = "mint")]
    mint: String,
    #[serde(rename = "pct")]
    pct: f64,
}

/// Token mapping for Jupiter
struct JupiterToken {
    pub symbol: String,
    pub mint: String,
    pub decimals: u8,
}

/// Get token mapping for common tokens
fn get_token_mapping() -> HashMap<String, JupiterToken> {
    let mut tokens = HashMap::new();
    
    // SOL
    tokens.insert("SOL".to_string(), JupiterToken {
        symbol: "SOL".to_string(),
        mint: "So11111111111111111111111111111111111111112".to_string(),
        decimals: 9,
    });
    
    // USDC
    tokens.insert("USDC".to_string(), JupiterToken {
        symbol: "USDC".to_string(),
        mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v".to_string(),
        decimals: 6,
    });
    
    // USDT
    tokens.insert("USDT".to_string(), JupiterToken {
        symbol: "USDT".to_string(),
        mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB".to_string(),
        decimals: 6,
    });
    
    // BTC (Wrapped)
    tokens.insert("BTC".to_string(), JupiterToken {
        symbol: "BTC".to_string(),
        mint: "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E".to_string(),
        decimals: 6,
    });
    
    // ETH (Wrapped)
    tokens.insert("ETH".to_string(), JupiterToken {
        symbol: "ETH".to_string(),
        mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs".to_string(),
        decimals: 8,
    });
    
    tokens
}

/// Check if Jupiter API is accessible
pub async fn check_api_access() -> Result<()> {
    debug!("Checking Jupiter API access...");
    
    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .build()?;
    
    // Simple request to check if API is accessible
    let url = format!("{}/quote-price", JUPITER_API_BASE);
    
    let response = client.get(&url)
        .send()
        .await
        .context("Failed to connect to Jupiter API")?;
    
    if response.status().is_success() {
        debug!("Jupiter API is accessible");
        Ok(())
    } else {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        Err(anyhow!("Jupiter API returned error: {} - {}", status, error_text))
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
        debug!("Rate limiting Jupiter API, sleeping for {} ms", sleep_time);
        sleep(Duration::from_millis(sleep_time)).await;
    }
    
    unsafe {
        LAST_REQUEST.store(now, std::sync::atomic::Ordering::Relaxed);
    }
}

/// Fetch price data from Jupiter
pub async fn fetch_price(pair: &TokenPair) -> Result<PriceData> {
    debug!("Fetching Jupiter price for {}", pair.to_string());
    
    // Apply rate limiting
    apply_rate_limiting().await;
    
    // Get token mapping
    let tokens = get_token_mapping();
    
    // Get base and quote tokens
    let base_token = tokens.get(&pair.base)
        .ok_or_else(|| anyhow!("Unsupported base token: {}", pair.base))?;
    
    let quote_token = tokens.get(&pair.quote)
        .ok_or_else(|| anyhow!("Unsupported quote token: {}", pair.quote))?;
    
    // Create HTTP client
    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .build()?;
    
    // Get quote for base -> quote (selling base)
    let base_amount = 1_000_000_000u64; // 1 unit of base token in its smallest denomination
    
    let sell_url = format!(
        "{}/quote?inputMint={}&outputMint={}&amount={}&slippageBps=10",
        JUPITER_API_BASE,
        base_token.mint,
        quote_token.mint,
        base_amount
    );
    
    let sell_response = client.get(&sell_url)
        .send()
        .await
        .context("Failed to fetch Jupiter sell quote")?;
    
    if !sell_response.status().is_success() {
        let status = sell_response.status();
        let error_text = sell_response.text().await.unwrap_or_default();
        return Err(anyhow!("Jupiter API returned error: {} - {}", status, error_text));
    }
    
    let sell_data: JupiterQuoteResponse = sell_response.json().await
        .context("Failed to parse Jupiter sell quote response")?;
    
    // Calculate price (how much quote token received for 1 unit of base token)
    let base_decimals_factor = 10u64.pow(base_token.decimals as u32) as f64;
    let quote_decimals_factor = 10u64.pow(quote_token.decimals as u32) as f64;
    
    let out_amount = sell_data.out_amount.parse::<f64>()
        .context("Failed to parse output amount")?;
    
    let sell_price = out_amount / quote_decimals_factor /
                    (base_amount as f64 / base_decimals_factor);
    
    // Get quote for quote -> base (buying base)
    let quote_amount = 1_000_000u64; // 1 unit of quote token in its smallest denomination
    
    let buy_url = format!(
        "{}/quote?inputMint={}&outputMint={}&amount={}&slippageBps=10",
        JUPITER_API_BASE,
        quote_token.mint,
        base_token.mint,
        quote_amount
    );
    
    let buy_response = client.get(&buy_url)
        .send()
        .await
        .context("Failed to fetch Jupiter buy quote")?;
    
    if !buy_response.status().is_success() {
        let status = buy_response.status();
        let error_text = buy_response.text().await.unwrap_or_default();
        return Err(anyhow!("Jupiter API returned error: {} - {}", status, error_text));
    }
    
    let buy_data: JupiterQuoteResponse = buy_response.json().await
        .context("Failed to parse Jupiter buy quote response")?;
    
    // Calculate inverse price (how much base token received for 1 unit of quote token)
    let out_amount = buy_data.out_amount.parse::<f64>()
        .context("Failed to parse output amount")?;
    
    let inverse_price = out_amount / base_decimals_factor /
                      (quote_amount as f64 / quote_decimals_factor);
    
    let buy_price = 1.0 / inverse_price;
    
    // Create price data
    let price_data = PriceData {
        pair: pair.clone(),
        source: DexSource::Jupiter,
        price: (sell_price + buy_price) / 2.0, // Average of bid and ask
        bid: sell_price * 0.997, // Apply a small spread for bid
        ask: buy_price * 1.003, // Apply a small spread for ask
        volume_24h: 0.0, // Not available from quote API
        timestamp: Utc::now(),
    };
    
    debug!("Jupiter price for {}: {}", pair.to_string(), price_data.price);
    
    Ok(price_data)
}

/// Fetch order book data from Jupiter
pub async fn fetch_order_book(pair: &TokenPair) -> Result<OrderBookData> {
    debug!("Fetching Jupiter order book for {}", pair.to_string());
    
    // Apply rate limiting
    apply_rate_limiting().await;
    
    // Create a placeholder order book
    // Jupiter doesn't provide direct order book access like traditional exchanges
    // For a real implementation, would need to use a different approach or API
    
    let order_book = OrderBookData {
        pair: pair.clone(),
        source: DexSource::Jupiter,
        bids: vec![], // Empty for now
        asks: vec![], // Empty for now
        timestamp: Utc::now(),
    };
    
    Ok(order_book)
}