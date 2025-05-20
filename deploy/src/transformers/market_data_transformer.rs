use crate::models::{MarketData, TokenPrice, TradingSignal, SignalType, MarketMetrics, MarketTrend};
use anyhow::Result;
use log::{info, debug};
use std::sync::{Arc, RwLock};
use chrono::Utc;

/// Market Data Transformer
/// 
/// Transforms raw market data into meaningful market insights.
pub struct MarketDataTransformer {
    // Is transformer enabled
    enabled: RwLock<bool>,
    
    // Price change thresholds
    buy_threshold: RwLock<f64>,
    sell_threshold: RwLock<f64>,
}

impl MarketDataTransformer {
    /// Create a new market data transformer
    pub fn new() -> Self {
        info!("Initializing Market Data Transformer");
        
        Self {
            enabled: RwLock::new(true),
            buy_threshold: RwLock::new(5.0),  // 5% price increase
            sell_threshold: RwLock::new(-3.0), // 3% price decrease
        }
    }
    
    /// Process market data to generate trading signals
    pub fn process_data(&self, market_data: &MarketData) -> Result<Vec<TradingSignal>> {
        // Check if transformer is enabled
        if !*self.enabled.read().unwrap() {
            debug!("Market Data Transformer is disabled");
            return Ok(Vec::new());
        }
        
        let mut signals = Vec::new();
        debug!("Processing {} tokens", market_data.tokens.len());
        
        // Get thresholds
        let buy_threshold = *self.buy_threshold.read().unwrap();
        let sell_threshold = *self.sell_threshold.read().unwrap();
        
        // Analyze each token
        for token in &market_data.tokens {
            // Generate signals based on price changes
            if token.change_24h >= buy_threshold {
                // Buy signal for significant price increase
                let confidence = 0.5 + (token.change_24h - buy_threshold) / 20.0;
                let confidence = confidence.min(0.95);
                
                let signal = TradingSignal {
                    asset: token.symbol.clone(),
                    signal_type: SignalType::Buy,
                    price: token.price,
                    confidence,
                    reason: format!("Price increased by {:.2}% in 24h", token.change_24h),
                    timestamp: Utc::now(),
                };
                
                signals.push(signal);
                
                debug!("Generated BUY signal for {} with confidence {:.2}", 
                       token.symbol, confidence);
            }
            else if token.change_24h <= sell_threshold {
                // Sell signal for significant price decrease
                let confidence = 0.5 + (sell_threshold - token.change_24h) / 10.0;
                let confidence = confidence.min(0.95);
                
                let signal = TradingSignal {
                    asset: token.symbol.clone(),
                    signal_type: SignalType::Sell,
                    price: token.price,
                    confidence,
                    reason: format!("Price decreased by {:.2}% in 24h", token.change_24h.abs()),
                    timestamp: Utc::now(),
                };
                
                signals.push(signal);
                
                debug!("Generated SELL signal for {} with confidence {:.2}", 
                       token.symbol, confidence);
            }
        }
        
        Ok(signals)
    }
    
    /// Enable or disable the transformer
    pub fn set_enabled(&self, enabled: bool) {
        let mut state = self.enabled.write().unwrap();
        *state = enabled;
        info!("Market Data Transformer {}abled", if enabled { "en" } else { "dis" });
    }
    
    /// Set buy signal threshold (percentage change)
    pub fn set_buy_threshold(&self, threshold: f64) {
        let mut value = self.buy_threshold.write().unwrap();
        *value = threshold;
        info!("Market Data Transformer buy threshold set to {}%", threshold);
    }
    
    /// Set sell signal threshold (percentage change)
    pub fn set_sell_threshold(&self, threshold: f64) {
        let mut value = self.sell_threshold.write().unwrap();
        *value = threshold;
        info!("Market Data Transformer sell threshold set to {}%", threshold);
    }
}