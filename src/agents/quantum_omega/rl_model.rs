// Reinforcement Learning Model for Quantum Omega
// Provides learning capabilities for optimizing snipe strategies

use anyhow::{Result, anyhow, Context};
use log::{info, warn, error, debug};
use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock, Mutex};
use chrono::{DateTime, Utc};

use super::SnipeResult;

// RL model parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RLModelParams {
    /// Learning rate
    pub learning_rate: f64,
    
    /// Discount factor
    pub discount_factor: f64,
    
    /// Exploration rate
    pub exploration_rate: f64,
    
    /// Minimum exploration rate
    pub min_exploration_rate: f64,
    
    /// Exploration decay rate
    pub exploration_decay: f64,
    
    /// Batch size for training
    pub batch_size: usize,
    
    /// Memory capacity
    pub memory_capacity: usize,
    
    /// Target update frequency
    pub target_update_frequency: usize,
}

impl Default for RLModelParams {
    fn default() -> Self {
        Self {
            learning_rate: 0.001,
            discount_factor: 0.95,
            exploration_rate: 0.1,
            min_exploration_rate: 0.01,
            exploration_decay: 0.995,
            batch_size: 32,
            memory_capacity: 10000,
            target_update_frequency: 100,
        }
    }
}

// RL model state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RLModelState {
    /// Model version
    pub version: String,
    
    /// Success rate
    pub success_rate: f64,
    
    /// Average profit
    pub avg_profit: f64,
    
    /// Total training iterations
    pub training_iterations: u32,
    
    /// Model parameters
    pub parameters: HashMap<String, f64>,
    
    /// Last updated
    pub last_updated: DateTime<Utc>,
}

// RL experience tuple
#[derive(Debug, Clone, Serialize, Deserialize)]
struct Experience {
    /// State representation
    state: Vec<f64>,
    
    /// Action taken
    action: usize,
    
    /// Reward received
    reward: f64,
    
    /// Next state
    next_state: Vec<f64>,
    
    /// Whether this was a terminal state
    done: bool,
}

// RL model
pub struct RLModel {
    /// Parameters
    params: RLModelParams,
    
    /// Model state
    state: RwLock<RLModelState>,
    
    /// Experience memory
    memory: RwLock<Vec<Experience>>,
    
    /// Training steps
    steps: RwLock<usize>,
    
    /// Weights
    weights: RwLock<HashMap<String, Vec<f64>>>,
}

impl RLModel {
    /// Create a new RL model
    pub fn new(params: RLModelParams) -> Self {
        // Initialize model state
        let state = RLModelState {
            version: "1.0.0".to_string(),
            success_rate: 0.0,
            avg_profit: 0.0,
            training_iterations: 0,
            parameters: HashMap::new(),
            last_updated: Utc::now(),
        };
        
        // Initialize weights
        let mut weights = HashMap::new();
        
        // Initialize feature weights
        weights.insert("slippage".to_string(), vec![0.1, -0.5, 0.05]);
        weights.insert("timing".to_string(), vec![0.3, 0.2, 0.1]);
        weights.insert("price_impact".to_string(), vec![-0.2, -0.4, -0.1]);
        weights.insert("gas_priority".to_string(), vec![0.15, 0.25, 0.05]);
        
        Self {
            params,
            state: RwLock::new(state),
            memory: RwLock::new(Vec::with_capacity(params.memory_capacity)),
            steps: RwLock::new(0),
            weights: RwLock::new(weights),
        }
    }
    
    /// Update model with result
    pub fn update(&self, result: &SnipeResult) -> Result<()> {
        info!("Updating RL model with snipe result (success={})", result.success);
        
        // Extract features from result
        let features = self.extract_features(result);
        
        // Calculate reward
        let reward = self.calculate_reward(result);
        
        // Record experience
        self.record_experience(features.clone(), 0, reward, features.clone(), result.success)?;
        
        // Update model stats
        let mut state = self.state.write().unwrap();
        
        // Update success rate
        let old_success_count = state.success_rate * state.training_iterations as f64;
        let new_success_count = old_success_count + if result.success { 1.0 } else { 0.0 };
        state.training_iterations += 1;
        state.success_rate = new_success_count / state.training_iterations as f64;
        
        // Update average profit
        if result.success {
            let old_total_profit = state.avg_profit * (state.training_iterations - 1) as f64;
            // Calculate profit as a percentage of investment
            let profit_pct = result.metrics.get("profit_percentage").cloned().unwrap_or(0.0);
            state.avg_profit = (old_total_profit + profit_pct) / state.training_iterations as f64;
        }
        
        // Update timestamp
        state.last_updated = Utc::now();
        
        // Check if it's time to train
        let steps = *self.steps.read().unwrap();
        if steps % self.params.batch_size == 0 {
            self.train_batch()?;
        }
        
        // Update steps
        let mut steps = self.steps.write().unwrap();
        *steps += 1;
        
        info!("Updated RL model: success rate: {:.2}%, avg profit: {:.2}%, iterations: {}", 
             state.success_rate * 100.0, state.avg_profit, state.training_iterations);
        
        Ok(())
    }
    
    /// Extract features from result
    fn extract_features(&self, result: &SnipeResult) -> Vec<f64> {
        let mut features = Vec::new();
        
        // Extract key metrics
        features.push(result.entry_price);
        features.push(result.metrics.get("execution_speed_ms").cloned().unwrap_or(0.0) / 1000.0); // Normalize to seconds
        features.push(result.metrics.get("price_impact_percentage").cloned().unwrap_or(0.0) / 100.0); // Normalize to 0-1
        features.push(result.metrics.get("timing_accuracy").cloned().unwrap_or(0.5)); // Already 0-1
        
        features
    }
    
    /// Calculate reward from result
    fn calculate_reward(&self, result: &SnipeResult) -> f64 {
        if !result.success {
            return -1.0; // Negative reward for failure
        }
        
        // Base reward for successful snipe
        let mut reward = 1.0;
        
        // Add reward for profit
        if let Some(profit_pct) = result.metrics.get("profit_percentage") {
            reward += profit_pct / 100.0; // Normalize to 0-1 scale
        }
        
        // Subtract penalty for high price impact
        if let Some(price_impact) = result.metrics.get("price_impact_percentage") {
            reward -= price_impact / 200.0; // Half weight, normalize to 0-0.5 scale
        }
        
        // Add reward for good timing
        if let Some(timing) = result.metrics.get("timing_accuracy") {
            reward += timing * 0.5; // Half weight, 0-0.5 scale
        }
        
        reward
    }
    
    /// Record experience
    fn record_experience(
        &self,
        state: Vec<f64>,
        action: usize,
        reward: f64,
        next_state: Vec<f64>,
        done: bool,
    ) -> Result<()> {
        let experience = Experience {
            state,
            action,
            reward,
            next_state,
            done,
        };
        
        let mut memory = self.memory.write().unwrap();
        
        // If memory is full, remove oldest experience
        if memory.len() >= self.params.memory_capacity {
            memory.remove(0);
        }
        
        // Add new experience
        memory.push(experience);
        
        Ok(())
    }
    
    /// Train on a batch of experiences
    fn train_batch(&self) -> Result<()> {
        let memory = self.memory.read().unwrap();
        
        // Skip if not enough experiences
        if memory.len() < self.params.batch_size {
            return Ok(());
        }
        
        info!("Training RL model on batch of {} experiences", self.params.batch_size);
        
        // In a full implementation, this would sample a random batch
        // and perform a gradient descent update step on the model weights
        
        // For now, we'll just simulate the training
        let mut weights = self.weights.write().unwrap();
        
        // Simulate weight updates for each feature
        for (feature, weight_vec) in weights.iter_mut() {
            for w in weight_vec.iter_mut() {
                // Apply small random adjustment (simulated gradient)
                *w += (rand::random::<f64>() - 0.5) * self.params.learning_rate;
            }
        }
        
        // Update exploration rate
        let mut state = self.state.write().unwrap();
        if let Some(exploration_rate) = state.parameters.get_mut("exploration_rate") {
            *exploration_rate = (*exploration_rate * self.params.exploration_decay)
                .max(self.params.min_exploration_rate);
        } else {
            state.parameters.insert("exploration_rate".to_string(), self.params.exploration_rate);
        }
        
        Ok(())
    }
    
    /// Get optimized parameters for a snipe
    pub fn get_optimized_parameters(&self, features: &[f64]) -> HashMap<String, f64> {
        let weights = self.weights.read().unwrap();
        let state = self.state.read().unwrap();
        
        let mut params = HashMap::new();
        
        // Exploration vs exploitation
        let exploration_rate = state.parameters.get("exploration_rate").cloned().unwrap_or(self.params.exploration_rate);
        let explore = rand::random::<f64>() < exploration_rate;
        
        if explore {
            // Exploration: use randomized parameters
            params.insert("slippage".to_string(), 0.01 + rand::random::<f64>() * 0.09); // 1-10%
            params.insert("gas_priority".to_string(), 1.0 + rand::random::<f64>() * 2.0); // 1-3
            params.insert("position_size_factor".to_string(), 0.2 + rand::random::<f64>() * 0.6); // 20-80%
        } else {
            // Exploitation: use learned weights
            
            // Calculate slippage
            if let Some(slippage_weights) = weights.get("slippage") {
                let mut slippage = 0.03; // Default 3%
                
                // Apply weights to features
                for (i, weight) in slippage_weights.iter().enumerate() {
                    if i < features.len() {
                        slippage += weight * features[i];
                    }
                }
                
                // Clamp to reasonable range
                slippage = slippage.max(0.005).min(0.15);
                params.insert("slippage".to_string(), slippage);
            }
            
            // Calculate gas priority
            if let Some(gas_weights) = weights.get("gas_priority") {
                let mut gas_priority = 2.0; // Default medium
                
                // Apply weights to features
                for (i, weight) in gas_weights.iter().enumerate() {
                    if i < features.len() {
                        gas_priority += weight * features[i];
                    }
                }
                
                // Clamp to reasonable range
                gas_priority = gas_priority.max(1.0).min(3.0);
                params.insert("gas_priority".to_string(), gas_priority);
            }
            
            // Calculate position size factor
            if let Some(size_weights) = weights.get("position_size") {
                let mut size_factor = 0.5; // Default 50%
                
                // Apply weights to features
                for (i, weight) in size_weights.iter().enumerate() {
                    if i < features.len() {
                        size_factor += weight * features[i];
                    }
                }
                
                // Clamp to reasonable range
                size_factor = size_factor.max(0.1).min(0.9);
                params.insert("position_size_factor".to_string(), size_factor);
            }
        }
        
        params
    }
    
    /// Get the current model state
    pub fn get_state(&self) -> RLModelState {
        self.state.read().unwrap().clone()
    }
    
    /// Save model to file
    pub fn save(&self, path: &str) -> Result<()> {
        info!("Saving RL model to {}", path);
        
        let state = self.state.read().unwrap();
        let weights = self.weights.read().unwrap();
        
        // Combine state and weights for serialization
        let mut combined = serde_json::to_value(&*state)?;
        let weights_value = serde_json::to_value(&*weights)?;
        
        if let serde_json::Value::Object(ref mut obj) = combined {
            if let serde_json::Value::Object(weights_obj) = weights_value {
                obj.insert("weights".to_string(), serde_json::Value::Object(weights_obj));
            }
        }
        
        // Write to file
        let file = std::fs::File::create(path)?;
        serde_json::to_writer_pretty(file, &combined)?;
        
        Ok(())
    }
    
    /// Load model from file
    pub fn load(&self, path: &str) -> Result<()> {
        info!("Loading RL model from {}", path);
        
        // Read file
        let file = std::fs::File::open(path)?;
        let combined: serde_json::Value = serde_json::from_reader(file)?;
        
        // Extract state
        let mut combined_clone = combined.clone();
        
        if let serde_json::Value::Object(ref mut obj) = combined_clone {
            // Remove weights from state
            obj.remove("weights");
            
            // Deserialize state
            let state: RLModelState = serde_json::from_value(serde_json::Value::Object(obj.clone()))?;
            
            // Update state
            let mut state_write = self.state.write().unwrap();
            *state_write = state;
        }
        
        // Extract weights
        if let Some(serde_json::Value::Object(weights_obj)) = combined.get("weights") {
            let weights: HashMap<String, Vec<f64>> = serde_json::from_value(serde_json::Value::Object(weights_obj.clone()))?;
            
            // Update weights
            let mut weights_write = self.weights.write().unwrap();
            *weights_write = weights;
        }
        
        Ok(())
    }
}