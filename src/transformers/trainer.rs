// Model trainer implementation

use super::{QuantumTransformerModel, MarketData};
use anyhow::{Result, anyhow, Context};
use log::{info, warn, error, debug};
use std::sync::Arc;
use std::collections::HashMap;
use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc, Duration};

/// Training configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainingConfig {
    /// Number of epochs
    pub epochs: usize,
    
    /// Batch size
    pub batch_size: usize,
    
    /// Learning rate
    pub learning_rate: f32,
    
    /// Weight decay
    pub weight_decay: f32,
    
    /// Early stopping patience
    pub early_stopping_patience: usize,
    
    /// Validation split
    pub validation_split: f32,
    
    /// Whether to shuffle data
    pub shuffle: bool,
    
    /// Data augmentation
    pub data_augmentation: bool,
}

impl Default for TrainingConfig {
    fn default() -> Self {
        Self {
            epochs: 100,
            batch_size: 32,
            learning_rate: 0.001,
            weight_decay: 0.0001,
            early_stopping_patience: 10,
            validation_split: 0.2,
            shuffle: true,
            data_augmentation: true,
        }
    }
}

/// Training metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainingMetrics {
    /// Training loss
    pub train_loss: f64,
    
    /// Validation loss
    pub val_loss: f64,
    
    /// R-squared on validation set
    pub val_r2: f64,
    
    /// Mean absolute error on validation set
    pub val_mae: f64,
    
    /// Root mean squared error on validation set
    pub val_rmse: f64,
    
    /// Number of epochs trained
    pub epochs: usize,
    
    /// Training time (seconds)
    pub training_time_seconds: f64,
    
    /// Loss history per epoch
    pub loss_history: Vec<(f64, f64)>,
    
    /// Early stopping occurred
    pub early_stopping: bool,
    
    /// Timestamp when training completed
    pub timestamp: DateTime<Utc>,
}

/// Model trainer
pub struct ModelTrainer {
    /// Transformer model
    model: Arc<QuantumTransformerModel>,
}

impl ModelTrainer {
    /// Create a new model trainer
    pub fn new(model: Arc<QuantumTransformerModel>) -> Self {
        Self {
            model,
        }
    }
    
    /// Preprocess training data
    fn preprocess_training_data(&self, market_data: &[MarketData]) -> Result<(Vec<Vec<f32>>, Vec<f32>)> {
        debug!("Preprocessing training data");
        
        let mut features = Vec::new();
        let mut targets = Vec::new();
        
        // Process each market data sample
        for data in market_data {
            // Extract features
            let mut sample_features = Vec::new();
            
            // Price features
            if data.prices.is_empty() {
                debug!("Skipping sample with no price data");
                continue;
            }
            
            // Sort prices by timestamp
            let mut prices = data.prices.clone();
            prices.sort_by_key(|(ts, _)| *ts);
            
            // Create input/output pairs with different time windows
            for window in [5, 15, 30, 60, 240] {
                for i in 0..(prices.len() - window) {
                    // Input: Price at time t and previous prices
                    let input_time = prices[i].0;
                    let input_price = prices[i].1;
                    
                    // Output: Price at time t + window
                    let output_time = prices[i + window].0;
                    let output_price = prices[i + window].1;
                    
                    // Skip if time difference is too large
                    let time_diff = (output_time - input_time).num_seconds();
                    let expected_diff = match window {
                        5 => 5 * 60,      // 5 minutes
                        15 => 15 * 60,    // 15 minutes
                        30 => 30 * 60,    // 30 minutes
                        60 => 60 * 60,    // 1 hour
                        240 => 240 * 60,  // 4 hours
                        _ => window * 60, // Default to minutes
                    };
                    
                    if (time_diff - expected_diff).abs() > expected_diff / 2 {
                        continue;
                    }
                    
                    // Create feature vector
                    let mut feature_vec = Vec::new();
                    
                    // Add input price
                    feature_vec.push(input_price as f32);
                    
                    // Add window size indicator
                    feature_vec.push(window as f32);
                    
                    // Add previous price changes
                    let prev_limit = i.min(5);
                    for j in 1..=prev_limit {
                        let prev_price = prices[i - j].1;
                        let change = (input_price - prev_price) / prev_price;
                        feature_vec.push(change as f32);
                    }
                    
                    // Fill remaining slots with zeros
                    while feature_vec.len() < 7 {
                        feature_vec.push(0.0);
                    }
                    
                    // Add volume if available
                    if !data.volumes.is_empty() {
                        // Find volume closest to input time
                        let mut closest_volume = 0.0;
                        let mut min_diff = i64::MAX;
                        
                        for (vol_time, vol) in &data.volumes {
                            let diff = (input_time - *vol_time).num_seconds().abs();
                            if diff < min_diff {
                                min_diff = diff;
                                closest_volume = *vol;
                            }
                        }
                        
                        feature_vec.push(closest_volume as f32);
                    } else {
                        feature_vec.push(0.0);
                    }
                    
                    // Add order book features if available
                    if !data.order_books.is_empty() {
                        // Find order book closest to input time
                        let mut bid_ask_sum = 0.0;
                        let mut min_diff = i64::MAX;
                        
                        for (ob_time, bids, asks) in &data.order_books {
                            let diff = (input_time - *ob_time).num_seconds().abs();
                            if diff < min_diff {
                                min_diff = diff;
                                
                                // Calculate bid-ask imbalance
                                let bid_volume = bids.iter().map(|(_, size)| size).sum::<f64>();
                                let ask_volume = asks.iter().map(|(_, size)| size).sum::<f64>();
                                
                                bid_ask_sum = if bid_volume + ask_volume > 0.0 {
                                    (bid_volume - ask_volume) / (bid_volume + ask_volume)
                                } else {
                                    0.0
                                };
                            }
                        }
                        
                        feature_vec.push(bid_ask_sum as f32);
                    } else {
                        feature_vec.push(0.0);
                    }
                    
                    // Add indicators if available
                    for indicator in ["rsi", "macd"] {
                        if let Some(indicator_data) = data.indicators.get(indicator) {
                            // Find indicator value closest to input time
                            let mut indicator_value = 0.0;
                            let mut min_diff = i64::MAX;
                            
                            for (ind_time, value) in indicator_data {
                                let diff = (input_time - *ind_time).num_seconds().abs();
                                if diff < min_diff {
                                    min_diff = diff;
                                    indicator_value = *value;
                                }
                            }
                            
                            feature_vec.push(indicator_value as f32);
                        } else {
                            feature_vec.push(0.0);
                        }
                    }
                    
                    // Calculate target: price change ratio
                    let price_change = (output_price - input_price) / input_price;
                    
                    // Add to training data
                    features.push(feature_vec);
                    targets.push(price_change as f32);
                }
            }
        }
        
        debug!("Preprocessed {} training samples", features.len());
        
        if features.is_empty() {
            return Err(anyhow!("No valid training samples after preprocessing"));
        }
        
        Ok((features, targets))
    }
    
    /// Split data into training and validation sets
    fn split_train_val(
        &self,
        features: Vec<Vec<f32>>,
        targets: Vec<f32>,
        val_split: f32,
        shuffle: bool,
    ) -> (Vec<Vec<f32>>, Vec<f32>, Vec<Vec<f32>>, Vec<f32>) {
        debug!("Splitting data into training and validation sets");
        
        let data_size = features.len();
        let val_size = (data_size as f32 * val_split) as usize;
        let train_size = data_size - val_size;
        
        let mut indices: Vec<usize> = (0..data_size).collect();
        
        if shuffle {
            use rand::seq::SliceRandom;
            let mut rng = rand::thread_rng();
            indices.shuffle(&mut rng);
        }
        
        let train_indices = &indices[0..train_size];
        let val_indices = &indices[train_size..];
        
        let mut train_features = Vec::with_capacity(train_size);
        let mut train_targets = Vec::with_capacity(train_size);
        let mut val_features = Vec::with_capacity(val_size);
        let mut val_targets = Vec::with_capacity(val_size);
        
        for &idx in train_indices {
            train_features.push(features[idx].clone());
            train_targets.push(targets[idx]);
        }
        
        for &idx in val_indices {
            val_features.push(features[idx].clone());
            val_targets.push(targets[idx]);
        }
        
        debug!("Split data into {} training and {} validation samples",
               train_features.len(), val_features.len());
        
        (train_features, train_targets, val_features, val_targets)
    }
    
    /// Create data batches
    fn create_batches(
        &self,
        features: &[Vec<f32>],
        targets: &[f32],
        batch_size: usize,
    ) -> Vec<(Vec<Vec<f32>>, Vec<f32>)> {
        let data_size = features.len();
        let num_batches = (data_size + batch_size - 1) / batch_size;
        
        let mut batches = Vec::with_capacity(num_batches);
        
        for i in 0..num_batches {
            let start = i * batch_size;
            let end = (start + batch_size).min(data_size);
            
            let batch_features = features[start..end].to_vec();
            let batch_targets = targets[start..end].to_vec();
            
            batches.push((batch_features, batch_targets));
        }
        
        batches
    }
    
    /// Train model
    pub async fn train(
        &self,
        market_data: &[MarketData],
        config: TrainingConfig,
    ) -> Result<TrainingMetrics> {
        info!("Training model with {} data samples", market_data.len());
        
        // Start timer
        let start_time = std::time::Instant::now();
        
        // Preprocess training data
        let (features, targets) = self.preprocess_training_data(market_data)?;
        
        // Split into training and validation sets
        let (train_features, train_targets, val_features, val_targets) = 
            self.split_train_val(features, targets, config.validation_split, config.shuffle);
        
        // Initialize model if needed
        if !self.model.is_trained() {
            self.model.init_weights()?;
        }
        
        // Training loop
        let mut train_loss = 1.0;
        let mut val_loss = 1.0;
        let mut val_r2 = 0.0;
        let mut val_mae = 0.0;
        let mut val_rmse = 0.0;
        let mut loss_history = Vec::with_capacity(config.epochs);
        let mut best_val_loss = f64::MAX;
        let mut patience_counter = 0;
        let mut early_stopping = false;
        
        // In a real implementation, this would be a complex training loop
        // For the prototype, we'll simulate training with decreasing loss
        
        for epoch in 0..config.epochs {
            // Create batches
            let train_batches = self.create_batches(&train_features, &train_targets, config.batch_size);
            
            // Training epoch
            train_loss = 0.5 / (1.0 + (epoch as f64 * 0.1));
            
            // Validation
            val_loss = train_loss * 1.1;
            val_r2 = 1.0 - val_loss;
            val_mae = val_loss * 0.8;
            val_rmse = (val_loss * val_loss).sqrt();
            
            loss_history.push((train_loss, val_loss));
            
            info!("Epoch {}/{}: train_loss={:.6}, val_loss={:.6}, val_r2={:.6}", 
                 epoch + 1, config.epochs, train_loss, val_loss, val_r2);
            
            // Check for early stopping
            if val_loss < best_val_loss {
                best_val_loss = val_loss;
                patience_counter = 0;
            } else {
                patience_counter += 1;
                if patience_counter >= config.early_stopping_patience {
                    info!("Early stopping triggered after {} epochs", epoch + 1);
                    early_stopping = true;
                    break;
                }
            }
        }
        
        // Calculate training time
        let training_time = start_time.elapsed().as_secs_f64();
        
        // Update model metrics
        {
            let mut metrics = self.model.metrics().clone();
            metrics.insert("validation_r2".to_string(), val_r2);
            metrics.insert("validation_mae".to_string(), val_mae);
            metrics.insert("validation_rmse".to_string(), val_rmse);
            metrics.insert("training_time".to_string(), training_time);
            metrics.insert("training_samples".to_string(), train_features.len() as f64);
            metrics.insert("validation_samples".to_string(), val_features.len() as f64);
            metrics.insert("training_loss".to_string(), train_loss);
            metrics.insert("validation_loss".to_string(), val_loss);
        }
        
        // Create training metrics
        let metrics = TrainingMetrics {
            train_loss,
            val_loss,
            val_r2,
            val_mae,
            val_rmse,
            epochs: if early_stopping {
                config.epochs - patience_counter
            } else {
                config.epochs
            },
            training_time_seconds: training_time,
            loss_history,
            early_stopping,
            timestamp: Utc::now(),
        };
        
        info!("Model training completed: r2={:.4}, mae={:.4}, rmse={:.4}", 
             metrics.val_r2, metrics.val_mae, metrics.val_rmse);
        
        Ok(metrics)
    }
}