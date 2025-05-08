// Price feed aggregator for multiple DEXes

use super::{TokenPair, PriceData, DexSource};
use crate::models::TradingSignal;
use anyhow::{Result, anyhow};
use log::{info, warn, error, debug};
use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, RwLock, Mutex};
use chrono::{DateTime, Utc, Duration};
use tokio::task::JoinHandle;
use serde::{Serialize, Deserialize};

/// Price history entry
#[derive(Debug, Clone)]
struct PriceHistoryEntry {
    /// Price data
    price: PriceData,
    
    /// Timestamp
    timestamp: DateTime<Utc>,
}

/// Price metrics for a token pair
#[derive(Debug, Clone)]
struct PriceMetrics {
    /// Current price (weighted average across DEXes)
    current_price: f64,
    
    /// 24h high price
    high_24h: f64,
    
    /// 24h low price
    low_24h: f64,
    
    /// 24h volume across all DEXes
    volume_24h: f64,
    
    /// Price change percentage (24h)
    change_24h_pct: f64,
    
    /// Last update timestamp
    updated_at: DateTime<Utc>,
}

/// Price feed configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceFeedConfig {
    /// Max history length per pair/source
    pub max_history_length: usize,
    
    /// Default update interval (seconds)
    pub update_interval_seconds: u64,
    
    /// Trading pairs to monitor
    pub pairs: Vec<String>,
    
    /// DEX sources to use
    pub sources: Vec<DexSource>,
}

impl Default for PriceFeedConfig {
    fn default() -> Self {
        Self {
            max_history_length: 1000,
            update_interval_seconds: 60,
            pairs: vec![
                "SOL/USDC".to_string(),
                "BTC/USDC".to_string(),
                "ETH/USDC".to_string(),
            ],
            sources: vec![
                DexSource::Jupiter,
                DexSource::Raydium,
                DexSource::Openbook,
            ],
        }
    }
}

/// Price feed for aggregating prices from multiple DEXes
pub struct PriceFeed {
    /// Price history for each pair and source
    price_history: RwLock<HashMap<String, HashMap<DexSource, VecDeque<PriceHistoryEntry>>>>,
    
    /// Aggregated price metrics for each pair
    price_metrics: RwLock<HashMap<String, PriceMetrics>>,
    
    /// Update task
    update_task: Mutex<Option<JoinHandle<()>>>,
    
    /// Configuration
    config: PriceFeedConfig,
}

impl PriceFeed {
    /// Create a new price feed
    pub fn new(config: PriceFeedConfig) -> Self {
        Self {
            price_history: RwLock::new(HashMap::new()),
            price_metrics: RwLock::new(HashMap::new()),
            update_task: Mutex::new(None),
            config,
        }
    }
    
    /// Start price feed updates
    pub fn start(&self) {
        let price_feed = Arc::new(self.clone());
        
        let handle = tokio::spawn(async move {
            info!("Starting price feed updates");
            
            let mut interval = tokio::time::interval(
                std::time::Duration::from_secs(price_feed.config.update_interval_seconds)
            );
            
            loop {
                interval.tick().await;
                
                // Update prices for all pairs
                for pair_str in &price_feed.config.pairs {
                    if let Ok(pair) = TokenPair::from_string(pair_str) {
                        if let Err(e) = price_feed.update_prices(&pair).await {
                            warn!("Failed to update prices for {}: {}", pair_str, e);
                        }
                    } else {
                        warn!("Invalid pair format: {}", pair_str);
                    }
                }
            }
        });
        
        let mut update_task = self.update_task.lock().unwrap();
        *update_task = Some(handle);
        
        debug!("Price feed updates started");
    }
    
    /// Update prices for a pair
    async fn update_prices(&self, pair: &TokenPair) -> Result<()> {
        debug!("Updating prices for {}", pair.to_string());
        
        let mut new_prices = HashMap::new();
        let pair_str = pair.to_string();
        
        // Fetch prices from all configured sources
        for source in &self.config.sources {
            let price_result = match source {
                DexSource::Jupiter => super::jupiter::fetch_price(pair).await,
                DexSource::Raydium => super::raydium::fetch_price(pair).await,
                DexSource::Openbook => super::openbook::fetch_price(pair).await,
            };
            
            match price_result {
                Ok(price) => {
                    debug!("Got {} price for {}: {}", 
                           format!("{:?}", source).to_lowercase(), 
                           pair_str, price.price);
                    new_prices.insert(*source, price);
                }
                Err(e) => {
                    warn!("Failed to fetch {} price for {}: {}", 
                          format!("{:?}", source).to_lowercase(), 
                          pair_str, e);
                }
            }
        }
        
        if new_prices.is_empty() {
            return Err(anyhow!("Failed to fetch prices from any source"));
        }
        
        // Add prices to history and update metrics
        self.add_prices_to_history(pair, new_prices);
        
        Ok(())
    }
    
    /// Add prices to history
    fn add_prices_to_history(&self, pair: &TokenPair, prices: HashMap<DexSource, PriceData>) {
        let pair_str = pair.to_string();
        let now = Utc::now();
        
        // Update price history
        let mut price_history = self.price_history.write().unwrap();
        
        // Get or create history for this pair
        let pair_history = price_history
            .entry(pair_str.clone())
            .or_insert_with(HashMap::new);
        
        // Add new prices to history
        for (source, price) in prices.iter() {
            let source_history = pair_history
                .entry(*source)
                .or_insert_with(VecDeque::new);
            
            // Add new entry
            source_history.push_back(PriceHistoryEntry {
                price: price.clone(),
                timestamp: now,
            });
            
            // Trim history if needed
            while source_history.len() > self.config.max_history_length {
                source_history.pop_front();
            }
        }
        
        // Calculate aggregated metrics
        let weighted_price = self.calculate_weighted_price(&prices);
        
        // Get 24h high, low, and volume
        let mut high_24h = weighted_price;
        let mut low_24h = weighted_price;
        let mut volume_24h = 0.0;
        
        // Get price 24h ago for calculating change
        let price_24h_ago = self.get_price_at_time(pair, now - Duration::days(1));
        let change_24h_pct = if let Some(old_price) = price_24h_ago {
            (weighted_price - old_price) / old_price * 100.0
        } else {
            0.0
        };
        
        // Calculate high/low/volume from history over last 24h
        let cutoff = now - Duration::days(1);
        
        for (_, source_history) in pair_history.iter() {
            for entry in source_history.iter().rev() {
                if entry.timestamp < cutoff {
                    break;
                }
                
                high_24h = high_24h.max(entry.price.price);
                low_24h = low_24h.min(entry.price.price);
                volume_24h += entry.price.volume_24h / source_history.len() as f64;
            }
        }
        
        // Update metrics
        let metrics = PriceMetrics {
            current_price: weighted_price,
            high_24h,
            low_24h,
            volume_24h,
            change_24h_pct,
            updated_at: now,
        };
        
        let mut price_metrics = self.price_metrics.write().unwrap();
        price_metrics.insert(pair_str, metrics);
    }
    
    /// Calculate weighted average price across sources
    fn calculate_weighted_price(&self, prices: &HashMap<DexSource, PriceData>) -> f64 {
        let mut total_weight = 0.0;
        let mut weighted_sum = 0.0;
        
        // Source weights (based on liquidity/reliability)
        let mut weights = HashMap::new();
        weights.insert(DexSource::Jupiter, 1.0);
        weights.insert(DexSource::Raydium, 0.8);
        weights.insert(DexSource::Openbook, 0.7);
        
        for (source, price) in prices {
            let weight = match weights.get(source) {
                Some(w) => *w,
                None => 0.5, // Default weight
            };
            
            weighted_sum += price.price * weight * price.volume_24h.sqrt();
            total_weight += weight * price.volume_24h.sqrt();
        }
        
        if total_weight > 0.0 {
            weighted_sum / total_weight
        } else {
            // Simple average if no weights
            prices.values().map(|p| p.price).sum::<f64>() / prices.len() as f64
        }
    }
    
    /// Get price at a specific time
    fn get_price_at_time(&self, pair: &TokenPair, time: DateTime<Utc>) -> Option<f64> {
        let pair_str = pair.to_string();
        let price_history = self.price_history.read().unwrap();
        
        if let Some(pair_history) = price_history.get(&pair_str) {
            let mut closest_prices = HashMap::new();
            
            // Find closest price entry for each source
            for (source, history) in pair_history {
                let mut closest_entry = None;
                let mut smallest_diff = i64::MAX;
                
                for entry in history {
                    let diff = (entry.timestamp - time).num_seconds().abs();
                    if diff < smallest_diff {
                        smallest_diff = diff;
                        closest_entry = Some(entry);
                    }
                }
                
                if let Some(entry) = closest_entry {
                    closest_prices.insert(*source, entry.price.clone());
                }
            }
            
            if !closest_prices.is_empty() {
                return Some(self.calculate_weighted_price(&closest_prices));
            }
        }
        
        None
    }
    
    /// Get latest price for a pair
    pub fn get_latest_price(&self, pair_str: &str) -> Option<f64> {
        let price_metrics = self.price_metrics.read().unwrap();
        price_metrics.get(pair_str).map(|m| m.current_price)
    }
    
    /// Get price metrics for a pair
    pub fn get_price_metrics(&self, pair_str: &str) -> Option<PriceMetricsView> {
        let price_metrics = self.price_metrics.read().unwrap();
        
        price_metrics.get(pair_str).map(|metrics| {
            PriceMetricsView {
                pair: pair_str.to_string(),
                price: metrics.current_price,
                high_24h: metrics.high_24h,
                low_24h: metrics.low_24h,
                volume_24h: metrics.volume_24h,
                change_24h_pct: metrics.change_24h_pct,
                updated_at: metrics.updated_at,
            }
        })
    }
    
    /// Get all price metrics
    pub fn get_all_price_metrics(&self) -> HashMap<String, PriceMetricsView> {
        let price_metrics = self.price_metrics.read().unwrap();
        
        price_metrics
            .iter()
            .map(|(pair, metrics)| {
                (pair.clone(), PriceMetricsView {
                    pair: pair.clone(),
                    price: metrics.current_price,
                    high_24h: metrics.high_24h,
                    low_24h: metrics.low_24h,
                    volume_24h: metrics.volume_24h,
                    change_24h_pct: metrics.change_24h_pct,
                    updated_at: metrics.updated_at,
                })
            })
            .collect()
    }
    
    /// Stop price feed updates
    pub fn stop(&self) -> Result<()> {
        let mut update_task = self.update_task.lock().unwrap();
        
        if let Some(task) = update_task.take() {
            task.abort();
            debug!("Price feed updates stopped");
        }
        
        Ok(())
    }
}

/// Public price metrics view
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceMetricsView {
    /// Token pair
    pub pair: String,
    
    /// Current price
    pub price: f64,
    
    /// 24h high
    pub high_24h: f64,
    
    /// 24h low
    pub low_24h: f64,
    
    /// 24h volume
    pub volume_24h: f64,
    
    /// 24h price change percentage
    pub change_24h_pct: f64,
    
    /// Last updated timestamp
    pub updated_at: DateTime<Utc>,
}

impl Clone for PriceFeed {
    fn clone(&self) -> Self {
        Self {
            price_history: RwLock::new(self.price_history.read().unwrap().clone()),
            price_metrics: RwLock::new(self.price_metrics.read().unwrap().clone()),
            update_task: Mutex::new(None),
            config: self.config.clone(),
        }
    }
}

// Helper macro for HashMap creation
macro_rules! hashmap {
    ($( $key: expr => $val: expr ),*) => {{
        let mut map = HashMap::new();
        $( map.insert($key, $val); )*
        map
    }}
}