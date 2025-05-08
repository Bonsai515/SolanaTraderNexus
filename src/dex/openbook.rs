// Openbook (formerly Serum) DEX integration

use super::{TokenPair, PriceData, OrderBookData, DexSource};
use anyhow::{Result, anyhow, Context};
use reqwest::Client;
use log::{info, warn, error, debug};
use std::time::Duration;
use chrono::Utc;
use tokio::time::sleep;

// Openbook Market API (using Serum API for now)
const OPENBOOK_API_BASE: &str = "https://openserum.io/api/serum";

// Rate limiting: max 20 requests per minute
const MAX_REQUESTS_PER_MINUTE: u32 = 20;
const REQUEST_INTERVAL_MS: u64 = 60_000 / MAX_REQUESTS_PER_MINUTE as u64;

// Last request timestamp for basic rate limiting
static mut LAST_REQUEST: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

/// Check if Openbook API is accessible
pub async fn check_api_access() -> Result<()> {
    debug!("Checking Openbook API access...");
    
    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .build()?;
    
    // Simple request to check if API is accessible
    let url = format!("{}/markets", OPENBOOK_API_BASE);
    
    let response = client.get(&url)
        .send()
        .await
        .context("Failed to connect to Openbook API")?;
    
    if response.status().is_success() {
        debug!("Openbook API is accessible");
        Ok(())
    } else {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        Err(anyhow!("Openbook API returned error: {} - {}", status, error_text))
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
        debug!("Rate limiting Openbook API, sleeping for {} ms", sleep_time);
        sleep(Duration::from_millis(sleep_time)).await;
    }
    
    unsafe {
        LAST_REQUEST.store(now, std::sync::atomic::Ordering::Relaxed);
    }
}

/// Fetch price data from Openbook
pub async fn fetch_price(pair: &TokenPair) -> Result<PriceData> {
    debug!("Fetching Openbook price for {}", pair.to_string());
    
    // Apply rate limiting
    apply_rate_limiting().await;
    
    // For the simplicity of the prototype, we'll return a simulated price
    // In a real implementation, this would query the Openbook API or on-chain data
    
    // Create price data with realistic values
    let price_data = PriceData {
        pair: pair.clone(),
        source: DexSource::Openbook,
        price: 20.15, // Example price
        bid: 20.10,
        ask: 20.20,
        volume_24h: 800_000.0,
        timestamp: Utc::now(),
    };
    
    debug!("Openbook price for {}: {}", pair.to_string(), price_data.price);
    
    Ok(price_data)
}

/// Fetch order book data from Openbook
pub async fn fetch_order_book(pair: &TokenPair) -> Result<OrderBookData> {
    debug!("Fetching Openbook order book for {}", pair.to_string());
    
    // Apply rate limiting
    apply_rate_limiting().await;
    
    // For the simplicity of the prototype, we'll return a simulated order book
    // In a real implementation, this would query the Openbook API or on-chain data
    
    // Create order book with realistic values
    let order_book = OrderBookData {
        pair: pair.clone(),
        source: DexSource::Openbook,
        bids: vec![
            (20.10, 15.0),
            (20.05, 25.0),
            (20.00, 35.0),
        ],
        asks: vec![
            (20.20, 15.0),
            (20.25, 25.0),
            (20.30, 35.0),
        ],
        timestamp: Utc::now(),
    };
    
    Ok(order_book)
}