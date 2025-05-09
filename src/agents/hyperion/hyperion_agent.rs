use std::sync::{Arc, Mutex, RwLock};
use std::collections::HashMap;
use std::time::{Duration, Instant};
use log::{info, warn, error, debug};
use anyhow::{Result, anyhow};
use uuid::Uuid;
use serde::{Serialize, Deserialize};

use crate::solana::connection::SolanaConnection;
use crate::solana::wallet_manager::{WalletManager, WalletType};
use crate::dex::dex_client::DexClient;
use crate::dex::token_pair::TokenPair;
use crate::transformers::transformer_api::TransformerAPI;
use crate::agents::agent_manager::{Agent, AgentType, AgentStatus, AgentState, AgentMetrics, ExecutionResult, StrategyPerformance};

/// Configuration for the Hyperion flash arbitrage agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HyperionConfig {
    pub min_profit_threshold: f64,
    pub max_transaction_size: f64,
    pub execution_timeout_ms: u64,
    pub cooldown_after_execution_ms: u64,
    pub target_pairs: Vec<String>,
    pub aggressive_mode: bool,
    pub analyze_only: bool,
}

impl Default for HyperionConfig {
    fn default() -> Self {
        Self {
            min_profit_threshold: 0.005, // 0.5% minimum profit
            max_transaction_size: 100.0,  // $100 max transaction size
            execution_timeout_ms: 2000,   // 2 seconds timeout
            cooldown_after_execution_ms: 5000, // 5 seconds cooldown
            target_pairs: vec!["SOL/USDC".to_string(), "BTC/USDC".to_string(), "ETH/USDC".to_string()],
            aggressive_mode: false,
            analyze_only: true, // Default to analysis only for safety
        }
    }
}

/// Hyperion agent for flash arbitrage
pub struct HyperionAgent {
    id: String,
    name: String,
    state: RwLock<AgentState>,
    config: RwLock<HyperionConfig>,
    solana_connection: Arc<SolanaConnection>,
    wallet_manager: Arc<WalletManager>,
    dex_client: Arc<DexClient>,
    transformer_api: Arc<TransformerAPI>,
    last_execution: Mutex<Option<Instant>>,
}

impl HyperionAgent {
    /// Create a new Hyperion agent
    pub fn new(
        id: Option<String>,
        name: String,
        solana_connection: Arc<SolanaConnection>,
        wallet_manager: Arc<WalletManager>,
        dex_client: Arc<DexClient>,
        transformer_api: Arc<TransformerAPI>,
        config: Option<HyperionConfig>,
    ) -> Self {
        let agent_id = id.unwrap_or_else(|| Uuid::new_v4().to_string());
        
        // Initialize wallets for the agent
        let mut wallets = HashMap::new();
        
        // We'll create these wallets on-demand when activated
        
        let metrics = AgentMetrics {
            total_executions: 0,
            success_count: 0,
            failure_count: 0,
            total_profit: 0.0,
            last_execution: None,
            execution_times: Vec::new(),
            avg_execution_time: 0,
            strategy_performance: HashMap::new(),
        };
        
        let state = AgentState {
            id: agent_id.clone(),
            name: name.clone(),
            agent_type: AgentType::Hyperion,
            status: AgentStatus::Idle,
            active: false,
            wallets,
            metrics,
            last_error: None,
            config: HashMap::new(),
            created_at: chrono::Utc::now(),
            last_active: chrono::Utc::now(),
        };
        
        Self {
            id: agent_id,
            name,
            state: RwLock::new(state),
            config: RwLock::new(config.unwrap_or_default()),
            solana_connection,
            wallet_manager,
            dex_client,
            transformer_api,
            last_execution: Mutex::new(None),
        }
    }
    
    /// Generate wallets for the agent if they don't exist
    async fn ensure_wallets_exist(&self) -> Result<()> {
        let mut state = self.state.write().unwrap();
        
        // Check if trading wallet exists
        if !state.wallets.contains_key("trading") {
            debug!("Creating trading wallet for Hyperion agent");
            let wallet = self.wallet_manager.create_wallet(
                Some(WalletType::Trading),
                Some(format!("hyperion_{}_trading", self.id)),
            ).await?;
            
            state.wallets.insert("trading".to_string(), wallet.address.to_string());
        }
        
        // Check if profit wallet exists
        if !state.wallets.contains_key("profit") {
            debug!("Creating profit wallet for Hyperion agent");
            let wallet = self.wallet_manager.create_wallet(
                Some(WalletType::Profit),
                Some(format!("hyperion_{}_profit", self.id)),
            ).await?;
            
            state.wallets.insert("profit".to_string(), wallet.address.to_string());
        }
        
        // Check if fee wallet exists
        if !state.wallets.contains_key("fee") {
            debug!("Creating fee wallet for Hyperion agent");
            let wallet = self.wallet_manager.create_wallet(
                Some(WalletType::Fee),
                Some(format!("hyperion_{}_fee", self.id)),
            ).await?;
            
            state.wallets.insert("fee".to_string(), wallet.address.to_string());
        }
        
        Ok(())
    }
    
    /// Find arbitrage opportunities across DEXes
    async fn find_arbitrage_opportunities(&self) -> Result<Vec<ArbitrageOpportunity>> {
        let config = self.config.read().unwrap();
        let mut opportunities = Vec::new();
        
        for pair_str in &config.target_pairs {
            // Parse token pair
            let pair = TokenPair::from_string(pair_str)?;
            
            // Get prices from all DEXes
            debug!("Scanning for arbitrage opportunities in {}", pair_str);
            match self.dex_client.execute_arbitrage(&pair).await {
                Ok(_) => {
                    // For now, we're just simulating finding opportunities
                    // In a real implementation, we would analyze the result and extract opportunities
                    
                    // Simulate finding an opportunity
                    let random_value = rand::random::<f64>();
                    
                    // 20% chance of finding an opportunity
                    if random_value < 0.2 {
                        let profit_pct = (random_value * 2.0) / 100.0; // 0-2% profit
                        
                        if profit_pct >= config.min_profit_threshold {
                            debug!("Found arbitrage opportunity for {} with profit {}%", 
                                  pair_str, profit_pct * 100.0);
                            
                            opportunities.push(ArbitrageOpportunity {
                                pair: pair_str.clone(),
                                buy_dex: "raydium".to_string(),
                                sell_dex: "jupiter".to_string(),
                                buy_price: 100.0,
                                sell_price: 100.0 * (1.0 + profit_pct),
                                profit_pct,
                                max_size: config.max_transaction_size,
                                timestamp: chrono::Utc::now(),
                            });
                        }
                    }
                }
                Err(e) => {
                    warn!("Error executing arbitrage for {}: {}", pair_str, e);
                }
            }
        }
        
        Ok(opportunities)
    }
    
    /// Execute a flash arbitrage
    async fn execute_flash_arbitrage(&self, opportunity: &ArbitrageOpportunity) -> Result<ExecutionResult> {
        let start_time = Instant::now();
        let config = self.config.read().unwrap();
        
        // Generate a unique ID for this execution
        let execution_id = Uuid::new_v4().to_string();
        
        // Get trading wallet address
        let trading_wallet_address = {
            let state = self.state.read().unwrap();
            state.wallets.get("trading")
                .ok_or_else(|| anyhow!("Trading wallet not found"))?
                .clone()
        };
        
        info!("Executing flash arbitrage for {} on {} -> {}", 
              opportunity.pair, opportunity.buy_dex, opportunity.sell_dex);
        
        if config.analyze_only {
            info!("Analysis mode: Would execute flash arbitrage with expected profit of {}%", 
                 opportunity.profit_pct * 100.0);
            
            // Return simulated success
            let execution_time = start_time.elapsed().as_millis() as u64;
            
            let profit = opportunity.max_size * opportunity.profit_pct;
            
            let mut metrics = HashMap::new();
            metrics.insert("profit_pct".to_string(), opportunity.profit_pct * 100.0);
            metrics.insert("execution_time_ms".to_string(), execution_time as f64);
            
            // Update agent state
            self.update_metrics_after_execution(
                true, 
                "flash_arbitrage", 
                profit,
                execution_time
            )?;
            
            Ok(ExecutionResult {
                id: execution_id,
                agent_id: self.id.clone(),
                agent_type: AgentType::Hyperion,
                success: true,
                profit,
                timestamp: chrono::Utc::now(),
                strategy: "flash_arbitrage".to_string(),
                pair: Some(opportunity.pair.clone()),
                execution_time_ms: execution_time,
                metrics,
                signature: None,
                error: None,
            })
        } else {
            // This is where we would execute the actual arbitrage
            // For now, we'll just simulate it
            
            // Simulate a small chance of failure
            let random_value = rand::random::<f64>();
            
            if random_value < 0.1 {
                // Simulated failure (10% chance)
                let error_msg = "Transaction failed: insufficient liquidity".to_string();
                
                warn!("Flash arbitrage execution failed: {}", error_msg);
                
                let execution_time = start_time.elapsed().as_millis() as u64;
                
                // Update agent state
                self.update_metrics_after_execution(
                    false, 
                    "flash_arbitrage", 
                    0.0,
                    execution_time
                )?;
                
                let mut metrics = HashMap::new();
                metrics.insert("profit_pct".to_string(), 0.0);
                metrics.insert("execution_time_ms".to_string(), execution_time as f64);
                
                return Ok(ExecutionResult {
                    id: execution_id,
                    agent_id: self.id.clone(),
                    agent_type: AgentType::Hyperion,
                    success: false,
                    profit: 0.0,
                    timestamp: chrono::Utc::now(),
                    strategy: "flash_arbitrage".to_string(),
                    pair: Some(opportunity.pair.clone()),
                    execution_time_ms: execution_time,
                    metrics,
                    signature: None,
                    error: Some(error_msg),
                });
            }
            
            // Simulated success
            let execution_time = start_time.elapsed().as_millis() as u64;
            
            let profit = opportunity.max_size * opportunity.profit_pct;
            
            info!("Flash arbitrage successful: profit ${:.2}", profit);
            
            // Update agent state
            self.update_metrics_after_execution(
                true, 
                "flash_arbitrage", 
                profit,
                execution_time
            )?;
            
            let mut metrics = HashMap::new();
            metrics.insert("profit_pct".to_string(), opportunity.profit_pct * 100.0);
            metrics.insert("execution_time_ms".to_string(), execution_time as f64);
            
            Ok(ExecutionResult {
                id: execution_id,
                agent_id: self.id.clone(),
                agent_type: AgentType::Hyperion,
                success: true,
                profit,
                timestamp: chrono::Utc::now(),
                strategy: "flash_arbitrage".to_string(),
                pair: Some(opportunity.pair.clone()),
                execution_time_ms: execution_time,
                metrics,
                signature: Some(format!("simulated_signature_{}", execution_id)),
                error: None,
            })
        }
    }
    
    /// Update metrics after execution
    fn update_metrics_after_execution(
        &self, 
        success: bool, 
        strategy: &str,
        profit: f64,
        execution_time: u64
    ) -> Result<()> {
        let mut state = self.state.write().unwrap();
        
        // Update status based on result
        if success {
            state.status = AgentStatus::Idle;
        } else {
            state.status = AgentStatus::Error;
        }
        
        // Update last active time
        state.last_active = chrono::Utc::now();
        
        // Update metrics
        state.metrics.total_executions += 1;
        
        if success {
            state.metrics.success_count += 1;
            state.metrics.total_profit += profit;
        } else {
            state.metrics.failure_count += 1;
        }
        
        state.metrics.last_execution = Some(chrono::Utc::now());
        
        // Update execution times
        state.metrics.execution_times.push(execution_time);
        
        // Limit history to last 100 execution times
        if state.metrics.execution_times.len() > 100 {
            state.metrics.execution_times.remove(0);
        }
        
        // Calculate average execution time
        if !state.metrics.execution_times.is_empty() {
            let total_time: u64 = state.metrics.execution_times.iter().sum();
            state.metrics.avg_execution_time = total_time / state.metrics.execution_times.len() as u64;
        }
        
        // Update strategy performance
        let strategy_perf = state.metrics.strategy_performance
            .entry(strategy.to_string())
            .or_insert_with(|| StrategyPerformance {
                strategy_id: strategy.to_string(),
                executions: 0,
                successes: 0,
                failures: 0,
                profit: 0.0,
                avg_profit_per_execution: 0.0,
            });
        
        strategy_perf.executions += 1;
        
        if success {
            strategy_perf.successes += 1;
            strategy_perf.profit += profit;
        } else {
            strategy_perf.failures += 1;
        }
        
        if strategy_perf.executions > 0 {
            strategy_perf.avg_profit_per_execution = strategy_perf.profit / strategy_perf.executions as f64;
        }
        
        Ok(())
    }
    
    /// Update configuration from HashMap
    pub fn update_config_from_hashmap(&self, config_map: HashMap<String, String>) -> Result<()> {
        let mut config = self.config.write().unwrap();
        
        for (key, value) in config_map {
            match key.as_str() {
                "min_profit_threshold" => {
                    config.min_profit_threshold = value.parse::<f64>()
                        .map_err(|_| anyhow!("Invalid value for min_profit_threshold"))?;
                }
                "max_transaction_size" => {
                    config.max_transaction_size = value.parse::<f64>()
                        .map_err(|_| anyhow!("Invalid value for max_transaction_size"))?;
                }
                "execution_timeout_ms" => {
                    config.execution_timeout_ms = value.parse::<u64>()
                        .map_err(|_| anyhow!("Invalid value for execution_timeout_ms"))?;
                }
                "cooldown_after_execution_ms" => {
                    config.cooldown_after_execution_ms = value.parse::<u64>()
                        .map_err(|_| anyhow!("Invalid value for cooldown_after_execution_ms"))?;
                }
                "target_pairs" => {
                    config.target_pairs = value.split(',')
                        .map(|s| s.trim().to_string())
                        .collect();
                }
                "aggressive_mode" => {
                    config.aggressive_mode = value.parse::<bool>()
                        .map_err(|_| anyhow!("Invalid value for aggressive_mode"))?;
                }
                "analyze_only" => {
                    config.analyze_only = value.parse::<bool>()
                        .map_err(|_| anyhow!("Invalid value for analyze_only"))?;
                }
                _ => {
                    warn!("Unknown configuration parameter: {}", key);
                }
            }
        }
        
        // Update state with new config values
        let mut state = self.state.write().unwrap();
        
        // Convert config to string map for storage in state
        state.config.insert("min_profit_threshold".to_string(), config.min_profit_threshold.to_string());
        state.config.insert("max_transaction_size".to_string(), config.max_transaction_size.to_string());
        state.config.insert("execution_timeout_ms".to_string(), config.execution_timeout_ms.to_string());
        state.config.insert("cooldown_after_execution_ms".to_string(), config.cooldown_after_execution_ms.to_string());
        state.config.insert("target_pairs".to_string(), config.target_pairs.join(","));
        state.config.insert("aggressive_mode".to_string(), config.aggressive_mode.to_string());
        state.config.insert("analyze_only".to_string(), config.analyze_only.to_string());
        
        Ok(())
    }
}

impl Agent for HyperionAgent {
    fn get_id(&self) -> &str {
        &self.id
    }
    
    fn get_type(&self) -> AgentType {
        AgentType::Hyperion
    }
    
    fn get_name(&self) -> &str {
        &self.name
    }
    
    fn get_state(&self) -> AgentState {
        self.state.read().unwrap().clone()
    }
    
    fn is_active(&self) -> bool {
        self.state.read().unwrap().active
    }
    
    fn activate(&mut self) -> Result<()> {
        let mut state = self.state.write().unwrap();
        
        if state.active {
            return Ok(());
        }
        
        state.active = true;
        state.status = AgentStatus::Initializing;
        state.last_active = chrono::Utc::now();
        
        info!("Hyperion agent {} activated", self.id);
        
        // Ensure wallets exist in a background task
        let agent_id = self.id.clone();
        let solana_connection = self.solana_connection.clone();
        let wallet_manager = self.wallet_manager.clone();
        let state_lock = self.state.clone();
        
        tokio::spawn(async move {
            debug!("Initializing wallets for Hyperion agent {}", agent_id);
            
            match wallet_manager.create_wallet(
                Some(WalletType::Trading),
                Some(format!("hyperion_{}_trading", agent_id)),
            ).await {
                Ok(wallet) => {
                    let mut state = state_lock.write().unwrap();
                    state.wallets.insert("trading".to_string(), wallet.address.to_string());
                    state.status = AgentStatus::Idle;
                },
                Err(e) => {
                    error!("Failed to create trading wallet for Hyperion agent {}: {}", agent_id, e);
                    let mut state = state_lock.write().unwrap();
                    state.status = AgentStatus::Error;
                    state.last_error = Some(format!("Wallet initialization failed: {}", e));
                }
            }
        });
        
        Ok(())
    }
    
    fn deactivate(&mut self) -> Result<()> {
        let mut state = self.state.write().unwrap();
        
        if !state.active {
            return Ok(());
        }
        
        state.active = false;
        state.status = AgentStatus::Idle;
        state.last_active = chrono::Utc::now();
        
        info!("Hyperion agent {} deactivated", self.id);
        
        Ok(())
    }
    
    fn execute(&mut self) -> Result<ExecutionResult> {
        let start_time = Instant::now();
        
        // Generate a unique ID for this execution
        let execution_id = Uuid::new_v4().to_string();
        
        // Check if agent is active
        if !self.is_active() {
            return Err(anyhow!("Agent is not active"));
        }
        
        // Check if we need to cool down
        let cooldown_duration = {
            let config = self.config.read().unwrap();
            Duration::from_millis(config.cooldown_after_execution_ms)
        };
        
        let should_cool_down = {
            let last_execution = self.last_execution.lock().unwrap();
            if let Some(last_time) = *last_execution {
                last_time.elapsed() < cooldown_duration
            } else {
                false
            }
        };
        
        if should_cool_down {
            // Return early with cooldown status
            let mut state = self.state.write().unwrap();
            state.status = AgentStatus::Cooldown;
            
            let execution_time = start_time.elapsed().as_millis() as u64;
            
            return Ok(ExecutionResult {
                id: execution_id,
                agent_id: self.id.clone(),
                agent_type: AgentType::Hyperion,
                success: false,
                profit: 0.0,
                timestamp: chrono::Utc::now(),
                strategy: "flash_arbitrage".to_string(),
                pair: None,
                execution_time_ms: execution_time,
                metrics: HashMap::new(),
                signature: None,
                error: Some("Agent in cooldown period".to_string()),
            });
        }
        
        // Update status to scanning
        {
            let mut state = self.state.write().unwrap();
            state.status = AgentStatus::Scanning;
        }
        
        // Find arbitrage opportunities
        let opportunities = {
            match tokio::runtime::Handle::current().block_on(self.find_arbitrage_opportunities()) {
                Ok(opps) => opps,
                Err(e) => {
                    let mut state = self.state.write().unwrap();
                    state.status = AgentStatus::Error;
                    state.last_error = Some(format!("Failed to find arbitrage opportunities: {}", e));
                    
                    let execution_time = start_time.elapsed().as_millis() as u64;
                    
                    return Ok(ExecutionResult {
                        id: execution_id,
                        agent_id: self.id.clone(),
                        agent_type: AgentType::Hyperion,
                        success: false,
                        profit: 0.0,
                        timestamp: chrono::Utc::now(),
                        strategy: "flash_arbitrage".to_string(),
                        pair: None,
                        execution_time_ms: execution_time,
                        metrics: HashMap::new(),
                        signature: None,
                        error: Some(format!("Failed to find arbitrage opportunities: {}", e)),
                    });
                }
            }
        };
        
        // Check if we found any opportunities
        if opportunities.is_empty() {
            // No opportunities found, return early
            let execution_time = start_time.elapsed().as_millis() as u64;
            
            // Update agent status
            let mut state = self.state.write().unwrap();
            state.status = AgentStatus::Idle;
            
            return Ok(ExecutionResult {
                id: execution_id,
                agent_id: self.id.clone(),
                agent_type: AgentType::Hyperion,
                success: true,
                profit: 0.0,
                timestamp: chrono::Utc::now(),
                strategy: "flash_arbitrage".to_string(),
                pair: None,
                execution_time_ms: execution_time,
                metrics: HashMap::new(),
                signature: None,
                error: None,
            });
        }
        
        // Find the best opportunity based on profit percentage
        let best_opportunity = opportunities.iter()
            .max_by(|a, b| a.profit_pct.partial_cmp(&b.profit_pct).unwrap_or(std::cmp::Ordering::Equal))
            .unwrap();
        
        // Update status to executing
        {
            let mut state = self.state.write().unwrap();
            state.status = AgentStatus::Executing;
        }
        
        // Execute the flash arbitrage
        let result = match tokio::runtime::Handle::current().block_on(
            self.execute_flash_arbitrage(best_opportunity)
        ) {
            Ok(result) => result,
            Err(e) => {
                let mut state = self.state.write().unwrap();
                state.status = AgentStatus::Error;
                state.last_error = Some(format!("Failed to execute flash arbitrage: {}", e));
                
                let execution_time = start_time.elapsed().as_millis() as u64;
                
                ExecutionResult {
                    id: execution_id,
                    agent_id: self.id.clone(),
                    agent_type: AgentType::Hyperion,
                    success: false,
                    profit: 0.0,
                    timestamp: chrono::Utc::now(),
                    strategy: "flash_arbitrage".to_string(),
                    pair: Some(best_opportunity.pair.clone()),
                    execution_time_ms: execution_time,
                    metrics: HashMap::new(),
                    signature: None,
                    error: Some(format!("Failed to execute flash arbitrage: {}", e)),
                }
            }
        };
        
        // Update last execution time
        {
            let mut last_execution = self.last_execution.lock().unwrap();
            *last_execution = Some(Instant::now());
        }
        
        Ok(result)
    }
    
    fn update_config(&mut self, config: HashMap<String, String>) -> Result<()> {
        self.update_config_from_hashmap(config)
    }
}

/// Represents an arbitrage opportunity between two DEXes
#[derive(Debug, Clone)]
pub struct ArbitrageOpportunity {
    pub pair: String,
    pub buy_dex: String,
    pub sell_dex: String,
    pub buy_price: f64,
    pub sell_price: f64,
    pub profit_pct: f64,
    pub max_size: f64,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}