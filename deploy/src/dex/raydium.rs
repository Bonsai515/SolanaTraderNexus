// Raydium DEX integration

use super::{TokenPair, PriceData, OrderBookData, DexSource};
use anyhow::{Result, anyhow, Context};
use reqwest::Client;
use log::{info, warn, error, debug};
use std::time::Duration;
use chrono::Utc;
use tokio::time::sleep;

// Raydium API base URL (market data)
const RAYDIUM_API_BASE: &str = "https://api.raydium.io/v2";

// Rate limiting: max 30 requests per minute
const MAX_REQUESTS_PER_MINUTE: u32 = 30;
const REQUEST_INTERVAL_MS: u64 = 60_000 / MAX_REQUESTS_PER_MINUTE as u64;

// Last request timestamp for basic rate limiting
static mut LAST_REQUEST: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

/// Check if Raydium API is accessible
pub async fn check_api_access() -> Result<()> {
    debug!("Checking Raydium API access...");
    
    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .build()?;
    
    // Simple request to check if API is accessible
    let url = format!("{}/pairs", RAYDIUM_API_BASE);
    
    let response = client.get(&url)
        .send()
        .await
        .context("Failed to connect to Raydium API")?;
    
    if response.status().is_success() {
        debug!("Raydium API is accessible");
        Ok(())
    } else {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        Err(anyhow!("Raydium API returned error: {} - {}", status, error_text))
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
        debug!("Rate limiting Raydium API, sleeping for {} ms", sleep_time);
        sleep(Duration::from_millis(sleep_time)).await;
    }
    
    unsafe {
        LAST_REQUEST.store(now, std::sync::atomic::Ordering::Relaxed);
    }
}

/// Fetch price data from Raydium
pub async fn fetch_price(pair: &TokenPair) -> Result<PriceData> {
    debug!("Fetching Raydium price for {}", pair.to_string());
    
    // Apply rate limiting
    apply_rate_limiting().await;
    
    // For the simplicity of the prototype, we'll return a simulated price
    // In a real implementation, this would query the Raydium API
    
    // Create price data with realistic values
    let price_data = PriceData {
        pair: pair.clone(),
        source: DexSource::Raydium,
        price: 20.0, // Example price
        bid: 19.95,
        ask: 20.05,
        volume_24h: 1_000_000.0,
        timestamp: Utc::now(),
    };
    
    debug!("Raydium price for {}: {}", pair.to_string(), price_data.price);
    
    Ok(price_data)
}

/// Fetch order book data from Raydium
pub async fn fetch_order_book(pair: &TokenPair) -> Result<OrderBookData> {
    debug!("Fetching Raydium order book for {}", pair.to_string());
    
    // Apply rate limiting
    apply_rate_limiting().await;
    
    // For the simplicity of the prototype, we'll return a simulated order book
    // In a real implementation, this would query the Raydium API
    
    // Create order book with realistic values
    let order_book = OrderBookData {
        pair: pair.clone(),
        source: DexSource::Raydium,
        bids: vec![
            (19.95, 10.0),
            (19.90, 20.0),
            (19.85, 30.0),
        ],
        asks: vec![
            (20.05, 10.0),
            (20.10, 20.0),
            (20.15, 30.0),
        ],
        timestamp: Utc::now(),
    };
    
    Ok(order_book)
}