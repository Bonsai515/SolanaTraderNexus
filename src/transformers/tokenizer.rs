// Market data tokenizer implementation

use super::MarketData;
use anyhow::{Result, anyhow, Context};
use log::{info, warn, error, debug};
use std::collections::HashMap;
use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc, Duration};

/// Market data token
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum MarketToken {
    /// Price token with value
    Price(f64),
    
    /// Volume token with value
    Volume(f64),
    
    /// Time token with value (seconds since epoch)
    Time(i64),
    
    /// Indicator token with name and value
    Indicator(String, f64),
    
    /// Order book token (bid or ask, price, volume)
    OrderBook(bool, f64, f64),
    
    /// External data token with name and value
    ExternalData(String, f64),
    
    /// Special token
    Special(String),
}

/// Market data tokenizer
pub struct MarketDataTokenizer {
    /// Maximum sequence length
    max_seq_len: usize,
    
    /// Special tokens
    special_tokens: HashMap<String, usize>,
    
    /// Normalization factors
    normalization: HashMap<String, (f64, f64)>,
}

impl MarketDataTokenizer {
    /// Create a new market data tokenizer
    pub fn new(max_seq_len: usize) -> Self {
        let mut special_tokens = HashMap::new();
        special_tokens.insert("PAD".to_string(), 0);
        special_tokens.insert("START".to_string(), 1);
        special_tokens.insert("END".to_string(), 2);
        special_tokens.insert("UNK".to_string(), 3);
        
        let mut normalization = HashMap::new();
        normalization.insert("price".to_string(), (0.0, 1.0));
        normalization.insert("volume".to_string(), (0.0, 1e6));
        normalization.insert("time".to_string(), (0.0, 3600.0));
        
        Self {
            max_seq_len,
            special_tokens,
            normalization,
        }
    }
    
    /// Set normalization factors
    pub fn set_normalization(&mut self, name: &str, mean: f64, std: f64) {
        self.normalization.insert(name.to_string(), (mean, std));
    }
    
    /// Normalize a value
    fn normalize(&self, name: &str, value: f64) -> f64 {
        if let Some((mean, std)) = self.normalization.get(name) {
            (value - mean) / std
        } else {
            value
        }
    }
    
    /// Denormalize a value
    fn denormalize(&self, name: &str, value: f64) -> f64 {
        if let Some((mean, std)) = self.normalization.get(name) {
            value * std + mean
        } else {
            value
        }
    }
    
    /// Tokenize market data
    pub fn tokenize(&self, market_data: &MarketData) -> Result<Vec<MarketToken>> {
        debug!("Tokenizing market data for {}", market_data.pair);
        
        let mut tokens = Vec::new();
        
        // Add start token
        tokens.push(MarketToken::Special("START".to_string()));
        
        // Add price tokens
        for (time, price) in &market_data.prices {
            tokens.push(MarketToken::Time(time.timestamp()));
            tokens.push(MarketToken::Price(*price));
        }
        
        // Add volume tokens
        for (time, volume) in &market_data.volumes {
            tokens.push(MarketToken::Time(time.timestamp()));
            tokens.push(MarketToken::Volume(*volume));
        }
        
        // Add order book tokens
        for (time, bids, asks) in &market_data.order_books {
            tokens.push(MarketToken::Time(time.timestamp()));
            
            // Add top N bids and asks
            let top_n = 5;
            
            for (i, (price, size)) in bids.iter().take(top_n).enumerate() {
                tokens.push(MarketToken::OrderBook(true, *price, *size));
            }
            
            for (i, (price, size)) in asks.iter().take(top_n).enumerate() {
                tokens.push(MarketToken::OrderBook(false, *price, *size));
            }
        }
        
        // Add indicator tokens
        for (name, values) in &market_data.indicators {
            for (time, value) in values {
                tokens.push(MarketToken::Time(time.timestamp()));
                tokens.push(MarketToken::Indicator(name.clone(), *value));
            }
        }
        
        // Add external data tokens
        for (name, values) in &market_data.external_data {
            for (time, value) in values {
                tokens.push(MarketToken::Time(time.timestamp()));
                tokens.push(MarketToken::ExternalData(name.clone(), *value));
            }
        }
        
        // Add end token
        tokens.push(MarketToken::Special("END".to_string()));
        
        // Truncate if too long
        if tokens.len() > self.max_seq_len {
            warn!("Tokenized sequence too long ({} > {}), truncating", 
                  tokens.len(), self.max_seq_len);
            tokens.truncate(self.max_seq_len - 1);
            tokens.push(MarketToken::Special("END".to_string()));
        }
        
        debug!("Tokenized market data into {} tokens", tokens.len());
        
        Ok(tokens)
    }
    
    /// Convert tokens to embedding input
    pub fn tokens_to_embedding(&self, tokens: &[MarketToken]) -> Result<Vec<Vec<f64>>> {
        debug!("Converting {} tokens to embeddings", tokens.len());
        
        // For each token, create an embedding input vector
        let mut embeddings = Vec::with_capacity(tokens.len());
        
        for token in tokens {
            match token {
                MarketToken::Price(price) => {
                    // Input: [1, 0, 0, 0, normalized_price, 0, 0, 0]
                    let mut vec = vec![0.0; 8];
                    vec[0] = 1.0;
                    vec[4] = self.normalize("price", *price);
                    embeddings.push(vec);
                }
                MarketToken::Volume(volume) => {
                    // Input: [0, 1, 0, 0, 0, normalized_volume, 0, 0]
                    let mut vec = vec![0.0; 8];
                    vec[1] = 1.0;
                    vec[5] = self.normalize("volume", *volume);
                    embeddings.push(vec);
                }
                MarketToken::Time(timestamp) => {
                    // Input: [0, 0, 1, 0, 0, 0, normalized_time, 0]
                    let now = Utc::now().timestamp();
                    let time_diff = now - timestamp;
                    
                    let mut vec = vec![0.0; 8];
                    vec[2] = 1.0;
                    vec[6] = self.normalize("time", time_diff as f64);
                    embeddings.push(vec);
                }
                MarketToken::Indicator(name, value) => {
                    // Input: [0, 0, 0, 1, 0, 0, 0, normalized_value]
                    let mut vec = vec![0.0; 8];
                    vec[3] = 1.0;
                    vec[7] = self.normalize(&format!("indicator_{}", name), *value);
                    embeddings.push(vec);
                }
                MarketToken::OrderBook(is_bid, price, size) => {
                    // Input: [0, 0, 0, 0, normalized_price, normalized_size, is_bid as f64, 0]
                    let mut vec = vec![0.0; 8];
                    vec[4] = self.normalize("price", *price);
                    vec[5] = self.normalize("volume", *size);
                    vec[6] = if *is_bid { 1.0 } else { 0.0 };
                    embeddings.push(vec);
                }
                MarketToken::ExternalData(name, value) => {
                    // Input: [0, 0, 0, 0, 0, 0, 0, normalized_value]
                    let mut vec = vec![0.0; 8];
                    vec[7] = self.normalize(&format!("external_{}", name), *value);
                    embeddings.push(vec);
                }
                MarketToken::Special(name) => {
                    // Special token like START, END, PAD, UNK
                    if let Some(&idx) = self.special_tokens.get(name) {
                        let mut vec = vec![0.0; 8];
                        vec[idx % 8] = 1.0;
                        embeddings.push(vec);
                    } else {
                        warn!("Unknown special token: {}", name);
                        let mut vec = vec![0.0; 8];
                        vec[3] = 1.0; // UNK
                        embeddings.push(vec);
                    }
                }
            }
        }
        
        // Pad if necessary
        while embeddings.len() < self.max_seq_len {
            let mut vec = vec![0.0; 8];
            vec[0] = 1.0; // PAD
            embeddings.push(vec);
        }
        
        debug!("Converted tokens to {} embeddings", embeddings.len());
        
        Ok(embeddings)
    }
    
    /// Create feature vectors from tokens
    pub fn tokens_to_features(&self, tokens: &[MarketToken]) -> Result<Vec<f64>> {
        debug!("Converting {} tokens to features", tokens.len());
        
        let mut features = Vec::new();
        
        // Price statistics
        let mut prices = Vec::new();
        for token in tokens {
            if let MarketToken::Price(price) = token {
                prices.push(*price);
            }
        }
        
        if !prices.is_empty() {
            // Latest price
            features.push(prices.last().unwrap().clone());
            
            // Min, max, mean prices
            features.push(*prices.iter().min_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal)).unwrap_or(&0.0));
            features.push(*prices.iter().max_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal)).unwrap_or(&0.0));
            features.push(prices.iter().sum::<f64>() / prices.len() as f64);
            
            // Price volatility (standard deviation)
            if prices.len() > 1 {
                let mean = prices.iter().sum::<f64>() / prices.len() as f64;
                let variance = prices.iter()
                    .map(|p| (p - mean).powi(2))
                    .sum::<f64>() / prices.len() as f64;
                features.push(variance.sqrt());
            } else {
                features.push(0.0); // No volatility with single price
            }
            
            // Price changes
            if prices.len() >= 2 {
                for window in [1, 3, 5, 10].iter() {
                    let window_size = (*window).min(prices.len() - 1);
                    let current = prices[prices.len() - 1];
                    let previous = prices[prices.len() - 1 - window_size];
                    features.push((current - previous) / previous);
                }
            } else {
                features.extend_from_slice(&[0.0, 0.0, 0.0, 0.0]);
            }
        } else {
            // No prices available
            features.extend_from_slice(&[0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]);
        }
        
        // Volume statistics
        let mut volumes = Vec::new();
        for token in tokens {
            if let MarketToken::Volume(volume) = token {
                volumes.push(*volume);
            }
        }
        
        if !volumes.is_empty() {
            // Latest volume
            features.push(volumes.last().unwrap().clone());
            
            // Total volume
            features.push(volumes.iter().sum::<f64>());
            
            // Mean volume
            features.push(volumes.iter().sum::<f64>() / volumes.len() as f64);
        } else {
            // No volumes available
            features.extend_from_slice(&[0.0, 0.0, 0.0]);
        }
        
        // Order book statistics
        let mut bids = Vec::new();
        let mut asks = Vec::new();
        
        for token in tokens {
            if let MarketToken::OrderBook(is_bid, price, size) = token {
                if *is_bid {
                    bids.push((*price, *size));
                } else {
                    asks.push((*price, *size));
                }
            }
        }
        
        if !bids.is_empty() && !asks.is_empty() {
            // Sort bids (descending by price) and asks (ascending by price)
            bids.sort_by(|(a, _), (b, _)| b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal));
            asks.sort_by(|(a, _), (b, _)| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
            
            // Bid-ask spread
            let highest_bid = bids[0].0;
            let lowest_ask = asks[0].0;
            features.push((lowest_ask - highest_bid) / highest_bid);
            
            // Bid-ask imbalance
            let bid_volume: f64 = bids.iter().map(|(_, size)| size).sum();
            let ask_volume: f64 = asks.iter().map(|(_, size)| size).sum();
            features.push((bid_volume - ask_volume) / (bid_volume + ask_volume));
            
            // Mid price
            features.push((highest_bid + lowest_ask) / 2.0);
        } else {
            // No order book available
            features.extend_from_slice(&[0.0, 0.0, 0.0]);
        }
        
        // Indicators
        let indicator_names = ["rsi", "macd", "ema_short", "ema_long", "bollinger_upper", "bollinger_lower"];
        
        for name in indicator_names.iter() {
            let mut values = Vec::new();
            
            for token in tokens {
                if let MarketToken::Indicator(token_name, value) = token {
                    if token_name == name {
                        values.push(*value);
                    }
                }
            }
            
            if !values.is_empty() {
                features.push(values.last().unwrap().clone());
            } else {
                features.push(0.0);
            }
        }
        
        // External data
        let external_names = ["btc_price", "eth_price", "market_sentiment", "funding_rate"];
        
        for name in external_names.iter() {
            let mut values = Vec::new();
            
            for token in tokens {
                if let MarketToken::ExternalData(token_name, value) = token {
                    if token_name == name {
                        values.push(*value);
                    }
                }
            }
            
            if !values.is_empty() {
                features.push(values.last().unwrap().clone());
            } else {
                features.push(0.0);
            }
        }
        
        debug!("Created {} features from tokens", features.len());
        
        Ok(features)
    }
}