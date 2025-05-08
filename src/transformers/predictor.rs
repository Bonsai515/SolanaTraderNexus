// Market predictor implementation

use super::{QuantumTransformerModel, MarketData};
use anyhow::{Result, anyhow, Context};
use log::{info, warn, error, debug};
use std::sync::Arc;
use std::collections::HashMap;
use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc, Duration};

/// Prediction confidence level
#[derive(Debug, Clone, Copy, PartialEq, PartialOrd, Serialize, Deserialize)]
pub struct PredictionConfidence {
    /// Confidence value (0.0 - 1.0)
    pub value: f64,
    
    /// Confidence level description
    pub level: PredictionConfidenceLevel,
}

/// Prediction confidence level
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PredictionConfidenceLevel {
    /// Very low confidence
    VeryLow,
    
    /// Low confidence
    Low,
    
    /// Medium confidence
    Medium,
    
    /// High confidence
    High,
    
    /// Very high confidence
    VeryHigh,
}

impl PredictionConfidence {
    /// Create a new prediction confidence
    pub fn new(value: f64) -> Self {
        let level = if value < 0.2 {
            PredictionConfidenceLevel::VeryLow
        } else if value < 0.4 {
            PredictionConfidenceLevel::Low
        } else if value < 0.6 {
            PredictionConfidenceLevel::Medium
        } else if value < 0.8 {
            PredictionConfidenceLevel::High
        } else {
            PredictionConfidenceLevel::VeryHigh
        };
        
        Self {
            value,
            level,
        }
    }
}

/// Prediction result
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PredictionResult {
    /// Predicted price
    pub price: f64,
    
    /// Prediction confidence
    pub confidence: PredictionConfidence,
    
    /// Price change prediction
    pub price_change: f64,
    
    /// Volatility prediction
    pub volatility: f64,
    
    /// Direction prediction (1.0 = up, -1.0 = down, 0.0 = sideways)
    pub direction: f64,
    
    /// Additional prediction metrics
    pub metrics: HashMap<String, f64>,
    
    /// Prediction timestamp
    pub timestamp: DateTime<Utc>,
}

/// Market predictor
#[derive(Clone)]
pub struct MarketPredictor {
    /// Transformer model
    model: Arc<QuantumTransformerModel>,
    
    /// Prediction history
    history: Vec<PredictionResult>,
}

impl MarketPredictor {
    /// Create a new market predictor
    pub fn new(model: Arc<QuantumTransformerModel>) -> Self {
        Self {
            model,
            history: Vec::new(),
        }
    }
    
    /// Preprocess market data for prediction
    fn preprocess(&self, market_data: &MarketData) -> Result<Vec<f32>> {
        debug!("Preprocessing market data for prediction");
        
        // Extract features from market data
        let mut features = Vec::new();
        
        // Price features
        if market_data.prices.is_empty() {
            return Err(anyhow!("No price data available"));
        }
        
        // Sort prices by timestamp
        let mut prices = market_data.prices.clone();
        prices.sort_by_key(|(ts, _)| *ts);
        
        // Get latest price
        let latest_price = prices.last().unwrap().1;
        features.push(latest_price as f32);
        
        // Price changes at different time scales
        if prices.len() >= 2 {
            // 1 minute change
            let one_min_ago = Utc::now() - Duration::minutes(1);
            let price_1m = Self::get_price_at_time(&prices, one_min_ago);
            
            if let Some(p) = price_1m {
                let change_1m = (latest_price - p) / p;
                features.push(change_1m as f32);
            } else {
                features.push(0.0);
            }
            
            // 5 minute change
            let five_min_ago = Utc::now() - Duration::minutes(5);
            let price_5m = Self::get_price_at_time(&prices, five_min_ago);
            
            if let Some(p) = price_5m {
                let change_5m = (latest_price - p) / p;
                features.push(change_5m as f32);
            } else {
                features.push(0.0);
            }
            
            // 15 minute change
            let fifteen_min_ago = Utc::now() - Duration::minutes(15);
            let price_15m = Self::get_price_at_time(&prices, fifteen_min_ago);
            
            if let Some(p) = price_15m {
                let change_15m = (latest_price - p) / p;
                features.push(change_15m as f32);
            } else {
                features.push(0.0);
            }
            
            // 1 hour change
            let one_hour_ago = Utc::now() - Duration::hours(1);
            let price_1h = Self::get_price_at_time(&prices, one_hour_ago);
            
            if let Some(p) = price_1h {
                let change_1h = (latest_price - p) / p;
                features.push(change_1h as f32);
            } else {
                features.push(0.0);
            }
            
            // 4 hour change
            let four_hour_ago = Utc::now() - Duration::hours(4);
            let price_4h = Self::get_price_at_time(&prices, four_hour_ago);
            
            if let Some(p) = price_4h {
                let change_4h = (latest_price - p) / p;
                features.push(change_4h as f32);
            } else {
                features.push(0.0);
            }
            
            // 1 day change
            let one_day_ago = Utc::now() - Duration::days(1);
            let price_1d = Self::get_price_at_time(&prices, one_day_ago);
            
            if let Some(p) = price_1d {
                let change_1d = (latest_price - p) / p;
                features.push(change_1d as f32);
            } else {
                features.push(0.0);
            }
        } else {
            // No historical prices, add zeros
            features.extend_from_slice(&[0.0, 0.0, 0.0, 0.0, 0.0, 0.0]);
        }
        
        // Volume features
        if !market_data.volumes.is_empty() {
            // Sort volumes by timestamp
            let mut volumes = market_data.volumes.clone();
            volumes.sort_by_key(|(ts, _)| *ts);
            
            // Get latest volume
            let latest_volume = volumes.last().unwrap().1;
            features.push(latest_volume as f32);
            
            // Volume changes at different time scales
            if volumes.len() >= 2 {
                // 1 hour volume
                let one_hour_ago = Utc::now() - Duration::hours(1);
                let volume_1h = Self::get_volume_since(&volumes, one_hour_ago);
                features.push(volume_1h as f32);
                
                // 4 hour volume
                let four_hour_ago = Utc::now() - Duration::hours(4);
                let volume_4h = Self::get_volume_since(&volumes, four_hour_ago);
                features.push(volume_4h as f32);
                
                // 1 day volume
                let one_day_ago = Utc::now() - Duration::days(1);
                let volume_1d = Self::get_volume_since(&volumes, one_day_ago);
                features.push(volume_1d as f32);
            } else {
                // No historical volumes, add zeros
                features.extend_from_slice(&[0.0, 0.0, 0.0]);
            }
        } else {
            // No volume data, add zeros
            features.extend_from_slice(&[0.0, 0.0, 0.0, 0.0]);
        }
        
        // Order book features
        if !market_data.order_books.is_empty() {
            // Sort order books by timestamp
            let mut order_books = market_data.order_books.clone();
            order_books.sort_by_key(|(ts, _, _)| *ts);
            
            // Get latest order book
            let latest_ob = order_books.last().unwrap();
            
            // Calculate order book imbalance
            let bid_volume: f64 = latest_ob.1.iter().map(|(_, size)| size).sum();
            let ask_volume: f64 = latest_ob.2.iter().map(|(_, size)| size).sum();
            
            if bid_volume > 0.0 && ask_volume > 0.0 {
                let imbalance = (bid_volume - ask_volume) / (bid_volume + ask_volume);
                features.push(imbalance as f32);
            } else {
                features.push(0.0);
            }
            
            // Calculate bid-ask spread
            if !latest_ob.1.is_empty() && !latest_ob.2.is_empty() {
                let highest_bid = latest_ob.1.iter().map(|(price, _)| *price).fold(0.0, f64::max);
                let lowest_ask = latest_ob.2.iter().map(|(price, _)| *price).fold(f64::MAX, f64::min);
                
                if highest_bid > 0.0 && lowest_ask < f64::MAX {
                    let spread = (lowest_ask - highest_bid) / highest_bid;
                    features.push(spread as f32);
                } else {
                    features.push(0.0);
                }
            } else {
                features.push(0.0);
            }
        } else {
            // No order book data, add zeros
            features.extend_from_slice(&[0.0, 0.0]);
        }
        
        // Indicator features
        for indicator_name in ["rsi", "macd", "ema_short", "ema_long", "bollinger_upper", "bollinger_lower"] {
            if let Some(indicator_data) = market_data.indicators.get(indicator_name) {
                if !indicator_data.is_empty() {
                    // Sort indicator data by timestamp
                    let mut data = indicator_data.clone();
                    data.sort_by_key(|(ts, _)| *ts);
                    
                    // Get latest value
                    let latest_value = data.last().unwrap().1;
                    features.push(latest_value as f32);
                } else {
                    features.push(0.0);
                }
            } else {
                features.push(0.0);
            }
        }
        
        // External data features
        for ext_name in ["btc_price", "eth_price", "market_sentiment", "funding_rate"] {
            if let Some(ext_data) = market_data.external_data.get(ext_name) {
                if !ext_data.is_empty() {
                    // Sort external data by timestamp
                    let mut data = ext_data.clone();
                    data.sort_by_key(|(ts, _)| *ts);
                    
                    // Get latest value
                    let latest_value = data.last().unwrap().1;
                    features.push(latest_value as f32);
                } else {
                    features.push(0.0);
                }
            } else {
                features.push(0.0);
            }
        }
        
        debug!("Preprocessed {} features for prediction", features.len());
        
        Ok(features)
    }
    
    /// Get price at specific time
    fn get_price_at_time(prices: &[(DateTime<Utc>, f64)], time: DateTime<Utc>) -> Option<f64> {
        // Find closest price before the specified time
        let mut closest_price = None;
        let mut closest_time_diff = i64::MAX;
        
        for (ts, price) in prices {
            if *ts <= time {
                let diff = (time - *ts).num_seconds();
                if diff < closest_time_diff {
                    closest_time_diff = diff;
                    closest_price = Some(*price);
                }
            }
        }
        
        closest_price
    }
    
    /// Get volume since specific time
    fn get_volume_since(volumes: &[(DateTime<Utc>, f64)], time: DateTime<Utc>) -> f64 {
        // Sum all volumes since the specified time
        volumes.iter()
            .filter(|(ts, _)| *ts >= time)
            .map(|(_, volume)| *volume)
            .sum()
    }
    
    /// Calculate prediction confidence
    fn calculate_confidence(&self, features: &[f32], predicted_price: f64, current_price: f64) -> PredictionConfidence {
        // Base confidence on model metrics and prediction quality
        
        // 1. Model metrics
        let model_metrics = self.model.metrics();
        let model_score = model_metrics.get("validation_r2").unwrap_or(&0.5);
        
        // 2. Prediction quality
        let price_change = (predicted_price - current_price).abs() / current_price;
        let reasonable_change = if price_change < 0.05 { 1.0 } else if price_change < 0.1 { 0.7 } else { 0.3 };
        
        // 3. Feature quality
        let feature_quality = 0.7; // Simplified for prototype
        
        // 4. Historical accuracy (would be based on past predictions vs. actual outcomes)
        let historical_accuracy = 0.6; // Simplified for prototype
        
        // Combine factors
        let confidence = model_score * 0.4 + reasonable_change * 0.3 + feature_quality * 0.2 + historical_accuracy * 0.1;
        
        // Clamp and create confidence
        let clamped_confidence = confidence.max(0.0).min(1.0);
        PredictionConfidence::new(clamped_confidence)
    }
    
    /// Make a prediction
    pub async fn predict(&self, market_data: &MarketData) -> Result<PredictionResult> {
        debug!("Making prediction for {}", market_data.pair);
        
        // Preprocess market data
        let features = self.preprocess(market_data)?;
        
        // Get latest price
        let current_price = market_data.prices.last()
            .ok_or_else(|| anyhow!("No price data available"))?
            .1;
        
        // Make prediction with model
        let prediction = self.model.predict(&features).await?;
        
        // Convert prediction to price
        let predicted_price = current_price * (1.0 + prediction as f64);
        
        // Calculate price change
        let price_change = (predicted_price - current_price) / current_price;
        
        // Calculate direction
        let direction = if price_change > 0.01 {
            1.0
        } else if price_change < -0.01 {
            -1.0
        } else {
            0.0
        };
        
        // Calculate volatility (simplified)
        let volatility = if market_data.prices.len() >= 10 {
            let recent_prices: Vec<f64> = market_data.prices.iter()
                .map(|(_, price)| *price)
                .rev()
                .take(10)
                .collect();
            
            let mean = recent_prices.iter().sum::<f64>() / recent_prices.len() as f64;
            let variance = recent_prices.iter()
                .map(|price| (price - mean).powi(2))
                .sum::<f64>() / recent_prices.len() as f64;
            
            variance.sqrt()
        } else {
            0.01 // Default volatility
        };
        
        // Calculate confidence
        let confidence = self.calculate_confidence(&features, predicted_price, current_price);
        
        // Additional metrics
        let mut metrics = HashMap::new();
        metrics.insert("model_version".to_string(), self.model.version() as f64);
        metrics.insert("feature_count".to_string(), features.len() as f64);
        metrics.insert("prediction_offset".to_string(), prediction as f64);
        
        // Create prediction result
        let result = PredictionResult {
            price: predicted_price,
            confidence,
            price_change,
            volatility,
            direction,
            metrics,
            timestamp: Utc::now(),
        };
        
        debug!("Prediction for {}: price={}, change={:.2}%, confidence={:.2}", 
               market_data.pair, result.price, result.price_change * 100.0, result.confidence.value);
        
        Ok(result)
    }
}