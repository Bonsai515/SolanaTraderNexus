use solana_sdk::{pubkey::Pubkey, signature::Keypair};
use solana_program::instruction::Instruction;
use std::sync::{Arc, Mutex};
use serde::{Serialize, Deserialize};
use anyhow::{Result, anyhow};
use std::collections::HashMap;
use chrono::{DateTime, Utc};

pub mod sniper_engine;
pub mod token_intelligence;
pub mod rl_optimizer;

/// Launch target for sniping
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchTarget {
    pub token_address: Pubkey,
    pub launch_dex: String,
    pub pool_address: Option<Pubkey>,
    pub estimated_launch_time: Option<DateTime<Utc>>,
    pub token_metrics: TokenMetrics,
    pub initial_liquidity: Option<f64>,
    pub creator_wallet: Option<Pubkey>,
    pub social_data: Option<SocialData>,
}

/// Token metrics for analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenMetrics {
    pub symbol: String,
    pub name: String,
    pub supply: u64,
    pub decimals: u8,
    pub initial_price: Option<f64>,
    pub website: Option<String>,
    pub twitter: Option<String>,
    pub telegram: Option<String>,
    pub category: TokenCategory,
    pub risk_score: f32,
    pub potential_score: f32,
}

/// Social metrics for token
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SocialData {
    pub twitter_followers: u32,
    pub telegram_members: u32,
    pub sentiment_score: f32,
    pub mention_count_24h: u32,
    pub growth_rate: f32,
    pub is_trending: bool,
}

/// Token categories
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TokenCategory {
    Meme,
    DeFi,
    NFT,
    GameFi,
    AI,
    Metaverse,
    Infrastructure,
    Unknown,
}

/// Snipe execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnipeResult {
    pub success: bool,
    pub token_address: Pubkey,
    pub entry_price: Option<f64>,
    pub amount_purchased: u64,
    pub execution_time_ms: u64,
    pub transaction_signature: Option<String>,
    pub error: Option<String>,
    pub metrics: HashMap<String, f64>,
}

/// Quantum Omega Agent State
pub struct SniperState {
    pub snipe_vault: Pubkey,
    pub token_database: TokenIntel,
    pub rl_brain: TD3Model,
    pub transformer_signals: BertForTrading,
    pub active: bool,
    pub last_execution: Option<DateTime<Utc>>,
    pub trading_wallet: Keypair,
    pub profit_wallet: Keypair,
    
    // Runtime metrics
    pub total_snipes: u64,
    pub successful_snipes: u64,
    pub total_profit: f64,
    pub tokens_held: Vec<(Pubkey, u64)>, // (token, amount)
}

/// Token intelligence database
pub struct TokenIntel {
    pub tokens: HashMap<Pubkey, TokenMetrics>,
    pub launch_calendar: Vec<(DateTime<Utc>, Pubkey)>,
    pub creator_wallets: HashMap<Pubkey, Vec<Pubkey>>, // Creator -> tokens launched
    pub high_potential_tokens: Vec<Pubkey>,
}

/// Reinforcement learning model (TD3)
pub struct TD3Model {
    pub checkpoint_path: String,
    pub hyperparameters: HashMap<String, f64>,
    pub state_dim: usize,
    pub action_dim: usize,
    pub reward_history: Vec<f64>,
    pub current_policy: Vec<f64>,
}

/// BERT model for trading signals
pub struct BertForTrading {
    pub model_path: String,
    pub vocabulary_size: usize,
    pub embedding_dim: usize,
    pub num_heads: usize,
    pub dropout_rate: f64,
}

/// Implementation of Quantum Omega agent
impl SniperState {
    pub fn new(
        snipe_vault: Pubkey,
        trading_wallet: Keypair,
        profit_wallet: Keypair,
    ) -> Self {
        SniperState {
            snipe_vault,
            token_database: TokenIntel {
                tokens: HashMap::new(),
                launch_calendar: Vec::new(),
                creator_wallets: HashMap::new(),
                high_potential_tokens: Vec::new(),
            },
            rl_brain: TD3Model {
                checkpoint_path: "models/td3_sniper_v1.bin".to_string(),
                hyperparameters: HashMap::new(),
                state_dim: 24,
                action_dim: 6,
                reward_history: Vec::new(),
                current_policy: vec![0.5, 0.3, 0.7, 0.1, 0.8, 0.2], // Default conservative policy
            },
            transformer_signals: BertForTrading {
                model_path: "models/bert_trading_v2.bin".to_string(),
                vocabulary_size: 30000,
                embedding_dim: 768,
                num_heads: 12,
                dropout_rate: 0.1,
            },
            active: false,
            last_execution: None,
            trading_wallet,
            profit_wallet,
            total_snipes: 0,
            successful_snipes: 0,
            total_profit: 0.0,
            tokens_held: Vec::new(),
        }
    }

    /// Execute a precision snipe operation
    pub fn execute_precision_snipe(
        &mut self,
        target: LaunchTarget
    ) -> Result<SnipeResult> {
        if !self.active {
            return Err(anyhow!("Quantum Omega agent is not active"));
        }

        // Update execution metrics
        self.total_snipes += 1;
        self.last_execution = Some(Utc::now());
        
        // Call to the sniper engine
        let result = sniper_engine::execute_snipe(self, target)?;
        
        // Update success metrics
        if result.success {
            self.successful_snipes += 1;
            
            // Add token to held tokens
            if let Some(amount) = result.amount_purchased {
                self.tokens_held.push((result.token_address, amount));
            }
            
            // Update token database
            self.token_database.tokens.insert(result.token_address, target.token_metrics.clone());
            
            // Update RL model with positive reward
            if let Some(entry_price) = result.entry_price {
                let reward = calculate_snipe_reward(&target, entry_price);
                self.rl_brain.reward_history.push(reward);
                self.update_rl_model(result.metrics.clone())?;
            }
        } else {
            // Update RL model with negative reward
            self.rl_brain.reward_history.push(-0.1); // Small negative reward for failed snipe
            self.update_rl_model(result.metrics.clone())?;
        }
        
        Ok(result)
    }
    
    /// Activate the agent
    pub fn activate(&mut self) -> Result<()> {
        self.active = true;
        log::info!("Quantum Omega agent activated");
        Ok(())
    }
    
    /// Deactivate the agent
    pub fn deactivate(&mut self) -> Result<()> {
        self.active = false;
        log::info!("Quantum Omega agent deactivated");
        Ok(())
    }
    
    /// Check if the agent is active
    pub fn is_active(&self) -> bool {
        self.active
    }
    
    /// Get the agent's performance statistics
    pub fn get_performance_stats(&self) -> HashMap<String, f64> {
        let mut stats = HashMap::new();
        
        stats.insert("total_snipes".to_string(), self.total_snipes as f64);
        stats.insert("successful_snipes".to_string(), self.successful_snipes as f64);
        stats.insert("total_profit".to_string(), self.total_profit);
        stats.insert("tokens_held".to_string(), self.tokens_held.len() as f64);
        
        // Calculate success rate
        if self.total_snipes > 0 {
            let success_rate = (self.successful_snipes as f64) / (self.total_snipes as f64) * 100.0;
            stats.insert("success_rate".to_string(), success_rate);
        } else {
            stats.insert("success_rate".to_string(), 0.0);
        }
        
        stats
    }
    
    /// Update the RL model based on execution results
    fn update_rl_model(&mut self, metrics: HashMap<String, f64>) -> Result<()> {
        // Delegate to the RL optimizer
        rl_optimizer::update_model(self, metrics)
    }
    
    /// Add a token to watch list
    pub fn add_token_to_watchlist(&mut self, token: Pubkey, metrics: TokenMetrics) -> Result<()> {
        self.token_database.tokens.insert(token, metrics);
        
        // Add to high potential list if score is high enough
        if metrics.potential_score > 0.7 {
            self.token_database.high_potential_tokens.push(token);
        }
        
        Ok(())
    }
    
    /// Track a creator wallet
    pub fn track_creator_wallet(&mut self, creator: Pubkey, known_tokens: Vec<Pubkey>) -> Result<()> {
        self.token_database.creator_wallets.insert(creator, known_tokens);
        log::info!("Now tracking creator wallet: {}", creator);
        Ok(())
    }
}

/// Calculate reward for a successful snipe based on entry price vs. target metrics
fn calculate_snipe_reward(target: &LaunchTarget, entry_price: f64) -> f64 {
    // Base reward for successful snipe
    let mut reward = 1.0;
    
    // Adjust reward based on token potential
    reward *= 1.0 + (target.token_metrics.potential_score as f64);
    
    // Adjust reward based on entry price vs initial price (if available)
    if let Some(initial_price) = target.token_metrics.initial_price {
        if entry_price < initial_price {
            // Got in below expected price - bonus
            let price_ratio = initial_price / entry_price;
            reward *= 1.0 + ((price_ratio - 1.0) * 0.5).min(1.0); // Cap the bonus
        } else {
            // Got in above expected price - penalty
            let price_ratio = entry_price / initial_price;
            reward *= 1.0 - ((price_ratio - 1.0) * 0.3).min(0.5); // Cap the penalty
        }
    }
    
    reward
}

/// Thread-safe wrapper for the Quantum Omega agent
pub struct QuantumOmegaAgent {
    state: Arc<Mutex<SniperState>>,
}

impl QuantumOmegaAgent {
    pub fn new(
        snipe_vault: Pubkey,
        trading_wallet: Keypair,
        profit_wallet: Keypair,
    ) -> Self {
        let state = SniperState::new(snipe_vault, trading_wallet, profit_wallet);
        QuantumOmegaAgent {
            state: Arc::new(Mutex::new(state)),
        }
    }
    
    pub fn execute_precision_snipe(
        &self,
        target: LaunchTarget
    ) -> Result<SnipeResult> {
        let mut state = self.state.lock().map_err(|_| anyhow!("Failed to acquire lock on Quantum Omega state"))?;
        state.execute_precision_snipe(target)
    }
    
    pub fn activate(&self) -> Result<()> {
        let mut state = self.state.lock().map_err(|_| anyhow!("Failed to acquire lock on Quantum Omega state"))?;
        state.activate()
    }
    
    pub fn deactivate(&self) -> Result<()> {
        let mut state = self.state.lock().map_err(|_| anyhow!("Failed to acquire lock on Quantum Omega state"))?;
        state.deactivate()
    }
    
    pub fn is_active(&self) -> Result<bool> {
        let state = self.state.lock().map_err(|_| anyhow!("Failed to acquire lock on Quantum Omega state"))?;
        Ok(state.is_active())
    }
    
    pub fn get_performance_stats(&self) -> Result<HashMap<String, f64>> {
        let state = self.state.lock().map_err(|_| anyhow!("Failed to acquire lock on Quantum Omega state"))?;
        Ok(state.get_performance_stats())
    }
    
    pub fn add_token_to_watchlist(&self, token: Pubkey, metrics: TokenMetrics) -> Result<()> {
        let mut state = self.state.lock().map_err(|_| anyhow!("Failed to acquire lock on Quantum Omega state"))?;
        state.add_token_to_watchlist(token, metrics)
    }
    
    pub fn track_creator_wallet(&self, creator: Pubkey, known_tokens: Vec<Pubkey>) -> Result<()> {
        let mut state = self.state.lock().map_err(|_| anyhow!("Failed to acquire lock on Quantum Omega state"))?;
        state.track_creator_wallet(creator, known_tokens)
    }
}