// Quantum-inspired AI transformers module

// Implemented modules
mod embedding;
mod model;
mod predictor;
mod tokenizer;
mod trainer;

// These modules will be implemented in future iterations
// mod attention;
// mod encoder;
// mod decoder;

pub use model::{QuantumTransformerModel, ModelConfig};
pub use predictor::{MarketPredictor, PredictionResult, PredictionConfidence};
pub use trainer::{ModelTrainer, TrainingConfig, TrainingMetrics};
pub use tokenizer::MarketDataTokenizer;
pub use embedding::{TokenEmbedding, PositionalEncoding};

use anyhow::{Result, anyhow, Context};
use log::{info, warn, error, debug};
use std::sync::{Arc, RwLock, Mutex};
use std::collections::HashMap;
use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc, Duration};

/// Transformer configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransformerConfig {
    /// Model name
    pub model_name: String,
    
    /// Number of attention heads
    pub num_heads: usize,
    
    /// Model dimension
    pub model_dim: usize,
    
    /// Feed-forward dimension
    pub ff_dim: usize,
    
    /// Number of encoder layers
    pub num_encoder_layers: usize,
    
    /// Number of decoder layers
    pub num_decoder_layers: usize,
    
    /// Maximum sequence length
    pub max_seq_len: usize,
    
    /// Dropout rate
    pub dropout: f32,
    
    /// Activation function
    pub activation: String,
    
    /// Whether to use quantum-inspired attention
    pub use_quantum_attention: bool,
    
    /// Whether to use quantum-inspired embeddings
    pub use_quantum_embeddings: bool,
    
    /// Number of quantum states to simulate
    pub quantum_states: usize,
}

impl Default for TransformerConfig {
    fn default() -> Self {
        Self {
            model_name: "solana-quantum-v1".to_string(),
            num_heads: 8,
            model_dim: 512,
            ff_dim: 2048,
            num_encoder_layers: 6,
            num_decoder_layers: 6,
            max_seq_len: 1024,
            dropout: 0.1,
            activation: "gelu".to_string(),
            use_quantum_attention: true,
            use_quantum_embeddings: true,
            quantum_states: 8,
        }
    }
}

/// Input data for the transformer model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketData {
    /// Token pair (e.g., "SOL/USDC")
    pub pair: String,
    
    /// Price data points (timestamp -> price)
    pub prices: Vec<(DateTime<Utc>, f64)>,
    
    /// Volume data points (timestamp -> volume)
    pub volumes: Vec<(DateTime<Utc>, f64)>,
    
    /// Order book snapshots (timestamp -> (bids, asks))
    pub order_books: Vec<(DateTime<Utc>, Vec<(f64, f64)>, Vec<(f64, f64)>)>,
    
    /// Market indicators
    pub indicators: HashMap<String, Vec<(DateTime<Utc>, f64)>>,
    
    /// External data
    pub external_data: HashMap<String, Vec<(DateTime<Utc>, f64)>>,
}

/// Market prediction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketPrediction {
    /// Token pair
    pub pair: String,
    
    /// Predicted price
    pub price: f64,
    
    /// Confidence level
    pub confidence: f64,
    
    /// Prediction window (in seconds)
    pub window_seconds: u64,
    
    /// Prediction timestamp
    pub timestamp: DateTime<Utc>,
    
    /// Price change prediction
    pub price_change: f64,
    
    /// Volatility prediction
    pub volatility: f64,
    
    /// Direction prediction (1.0 = up, -1.0 = down, 0.0 = sideways)
    pub direction: f64,
    
    /// Additional prediction metrics
    pub metrics: HashMap<String, f64>,
}

/// Transformer API for market predictions
pub struct TransformerAPI {
    /// Transformer models (pair -> model)
    models: RwLock<HashMap<String, Arc<QuantumTransformerModel>>>,
    
    /// Model config
    config: TransformerConfig,
    
    /// Market predictors
    predictors: RwLock<HashMap<String, Arc<MarketPredictor>>>,
    
    /// Whether the models are loaded
    is_loaded: RwLock<bool>,
}

impl TransformerAPI {
    /// Create a new transformer API
    pub fn new(config: TransformerConfig) -> Self {
        Self {
            models: RwLock::new(HashMap::new()),
            config,
            predictors: RwLock::new(HashMap::new()),
            is_loaded: RwLock::new(false),
        }
    }
    
    /// Create a default transformer API
    pub fn default() -> Self {
        Self::new(TransformerConfig::default())
    }
    
    /// Initialize the API
    pub async fn init(&self, pairs: &[String]) -> Result<()> {
        info!("Initializing transformer API for {} pairs", pairs.len());
        
        for pair in pairs {
            self.load_model(pair).await?;
        }
        
        {
            let mut is_loaded = self.is_loaded.write().unwrap();
            *is_loaded = true;
        }
        
        info!("Transformer API initialized successfully");
        
        Ok(())
    }
    
    /// Load a model for a specific pair
    pub async fn load_model(&self, pair: &str) -> Result<()> {
        info!("Loading transformer model for {}", pair);
        
        // Load model
        let model_config = ModelConfig {
            pair: pair.to_string(),
            num_heads: self.config.num_heads,
            model_dim: self.config.model_dim,
            ff_dim: self.config.ff_dim,
            num_encoder_layers: self.config.num_encoder_layers,
            num_decoder_layers: self.config.num_decoder_layers,
            max_seq_len: self.config.max_seq_len,
            dropout: self.config.dropout,
        };
        
        let model = QuantumTransformerModel::new(model_config);
        
        // Create predictor
        let predictor = MarketPredictor::new(Arc::new(model.clone()));
        
        // Add to maps
        {
            let mut models = self.models.write().unwrap();
            models.insert(pair.to_string(), Arc::new(model));
        }
        
        {
            let mut predictors = self.predictors.write().unwrap();
            predictors.insert(pair.to_string(), Arc::new(predictor));
        }
        
        Ok(())
    }
    
    /// Make a prediction
    pub async fn predict(
        &self,
        pair: &str,
        market_data: &MarketData,
        window_seconds: u64,
    ) -> Result<MarketPrediction> {
        debug!("Making prediction for {} with {} data points",
               pair, market_data.prices.len());
        
        // Check if the models are loaded
        {
            let is_loaded = self.is_loaded.read().unwrap();
            if !*is_loaded {
                return Err(anyhow!("Transformer API not initialized"));
            }
        }
        
        // Get predictor
        let predictor = {
            let predictors = self.predictors.read().unwrap();
            predictors.get(pair)
                .cloned()
                .ok_or_else(|| anyhow!("No predictor found for {}", pair))?
        };
        
        // Make prediction
        let prediction_result = predictor.predict(market_data).await?;
        
        // Create market prediction
        let market_prediction = MarketPrediction {
            pair: pair.to_string(),
            price: prediction_result.price,
            confidence: prediction_result.confidence.value,
            window_seconds,
            timestamp: Utc::now(),
            price_change: prediction_result.price_change,
            volatility: prediction_result.volatility,
            direction: prediction_result.direction,
            metrics: prediction_result.metrics,
        };
        
        Ok(market_prediction)
    }
    
    /// Get available pairs
    pub fn get_available_pairs(&self) -> Vec<String> {
        let models = self.models.read().unwrap();
        models.keys().cloned().collect()
    }
    
    /// Check if a model is available for a pair
    pub fn has_model(&self, pair: &str) -> bool {
        let models = self.models.read().unwrap();
        models.contains_key(pair)
    }
    
    /// Update a model with new data
    pub async fn update_model(
        &self,
        pair: &str,
        market_data: &MarketData,
    ) -> Result<()> {
        info!("Updating model for {}", pair);
        
        // Check if the models are loaded
        {
            let is_loaded = self.is_loaded.read().unwrap();
            if !*is_loaded {
                return Err(anyhow!("Transformer API not initialized"));
            }
        }
        
        // Get model
        let model = {
            let models = self.models.read().unwrap();
            models.get(pair)
                .cloned()
                .ok_or_else(|| anyhow!("No model found for {}", pair))?
        };
        
        // Update model
        model.update(market_data).await?;
        
        Ok(())
    }
    
    /// Train a model
    pub async fn train_model(
        &self,
        pair: &str,
        market_data: &[MarketData],
        config: TrainingConfig,
    ) -> Result<TrainingMetrics> {
        info!("Training model for {}", pair);
        
        // Check if the models are loaded
        {
            let is_loaded = self.is_loaded.read().unwrap();
            if !*is_loaded {
                return Err(anyhow!("Transformer API not initialized"));
            }
        }
        
        // Get model
        let model = {
            let models = self.models.read().unwrap();
            models.get(pair)
                .cloned()
                .ok_or_else(|| anyhow!("No model found for {}", pair))?
        };
        
        // Create trainer
        let trainer = ModelTrainer::new(model.clone());
        
        // Train model
        let metrics = trainer.train(market_data, config).await?;
        
        Ok(metrics)
    }
}