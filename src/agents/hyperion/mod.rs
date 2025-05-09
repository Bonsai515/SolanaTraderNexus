use solana_sdk::{pubkey::Pubkey, signature::Keypair, instruction::Instruction};
use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use anyhow::{Result, anyhow};
use chrono::{DateTime, Utc};
use log::{info, debug, warn, error};

pub mod flash_arb;
pub mod strategy_generator;
pub mod agent_forge;

/// Hyperion Agent State
pub struct HyperionState {
    pub strategies: Vec<StrategyDNA>,
    pub fee_wallet: Keypair,
    pub profit_wallet: Keypair,
    pub strategy_vault: Pubkey,
    pub active: bool,
    pub last_execution: Option<DateTime<Utc>>,
    pub total_executions: u64,
    pub successful_executions: u64,
    pub profit_ledger: ProfitLedger,
}

/// Profit tracking ledger
pub struct ProfitLedger {
    pub total_profit: f64,
    pub profit_by_strategy: HashMap<String, f64>,
    pub profit_by_pair: HashMap<String, f64>,
    pub profit_by_dex: HashMap<String, f64>,
    pub daily_profit: HashMap<String, f64>, // Format: "YYYY-MM-DD"
}

/// Strategy DNA for arbitrage
#[derive(Debug, Clone)]
pub struct StrategyDNA {
    pub id: String,
    pub created_at: DateTime<Utc>,
    pub target_pairs: Vec<String>,
    pub dex_priority: Vec<String>,
    pub min_profit_threshold: f64,
    pub execution_speed_ms: u64,
    pub max_slippage: f64,
    pub risk_score: f64,
    pub version: String,
    pub performance_metrics: HashMap<String, f64>,
}

/// DEX route for arbitrage
#[derive(Debug, Clone)]
pub struct DexRoute {
    pub dex_name: String,
    pub pair: String,
    pub expected_price: f64,
    pub expected_slippage: f64,
    pub pool_address: Option<Pubkey>,
}

/// Cross-chain route via Wormhole
#[derive(Debug, Clone)]
pub struct WormholePath {
    pub source_chain: String,
    pub destination_chain: String,
    pub token_bridge_address: Pubkey,
    pub target_address: [u8; 32],
    pub swap_instructions: Vec<Instruction>,
}

/// Arbitrage execution result
#[derive(Debug, Clone)]
pub struct ArbResult {
    pub success: bool,
    pub profit: f64,
    pub execution_time_ms: u64,
    pub fees_paid: f64,
    pub route_taken: Vec<String>,
    pub signature: Option<String>,
    pub metrics: HashMap<String, f64>,
    pub error: Option<String>,
}

/// Market conditions for strategy generation
#[derive(Debug, Clone)]
pub struct MarketConditions {
    pub volatility: HashMap<String, f64>,
    pub volumes: HashMap<String, f64>,
    pub spreads: HashMap<String, f64>,
    pub memecoin_activity: f64,
    pub cross_chain_opportunity: f64,
}

/// Implementation of the Hyperion agent
impl HyperionState {
    pub fn new(
        strategy_vault: Pubkey,
        fee_wallet: Keypair,
        profit_wallet: Keypair,
    ) -> Self {
        HyperionState {
            strategies: Vec::new(),
            fee_wallet,
            profit_wallet,
            strategy_vault,
            active: false,
            last_execution: None,
            total_executions: 0,
            successful_executions: 0,
            profit_ledger: ProfitLedger {
                total_profit: 0.0,
                profit_by_strategy: HashMap::new(),
                profit_by_pair: HashMap::new(),
                profit_by_dex: HashMap::new(),
                daily_profit: HashMap::new(),
            },
        }
    }

    /// Execute a zero-capital flash arbitrage
    pub fn execute_zero_capital_arb(
        &mut self,
        dex_path: Vec<DexRoute>,
        chain_route: Option<WormholePath>
    ) -> Result<ArbResult> {
        if !self.active {
            return Err(anyhow!("Hyperion agent is not active"));
        }

        self.total_executions += 1;
        self.last_execution = Some(Utc::now());
        
        // Call the flash arbitrage module
        let result = flash_arb::execute_flash_arbitrage(self, dex_path, chain_route)?;
        
        // Record the execution result
        if result.success {
            self.successful_executions += 1;
            self.record_profit(&result);
            
            // Update strategies based on result
            strategy_generator::evolve_strategy(self, result.metrics.clone())?;
        }
        
        Ok(result)
    }
    
    /// Activate the agent
    pub fn activate(&mut self) -> Result<()> {
        // Initialize the first strategy if none exist
        if self.strategies.is_empty() {
            let default_strategy = StrategyDNA {
                id: uuid::Uuid::new_v4().to_string(),
                created_at: Utc::now(),
                target_pairs: vec![
                    "SOL/USDC".to_string(),
                    "BTC/USDC".to_string(),
                    "ETH/USDC".to_string(),
                ],
                dex_priority: vec![
                    "jupiter".to_string(),
                    "raydium".to_string(),
                    "openbook".to_string(),
                    "orca".to_string(),
                ],
                min_profit_threshold: 0.005, // 0.5%
                execution_speed_ms: 1500, // 1.5 seconds
                max_slippage: 0.01, // 1%
                risk_score: 0.3, // Low-medium risk
                version: "1.0.0".to_string(),
                performance_metrics: HashMap::new(),
            };
            
            self.strategies.push(default_strategy);
        }
        
        self.active = true;
        info!("Hyperion agent activated");
        Ok(())
    }
    
    /// Deactivate the agent
    pub fn deactivate(&mut self) -> Result<()> {
        self.active = false;
        info!("Hyperion agent deactivated");
        Ok(())
    }
    
    /// Check if the agent is active
    pub fn is_active(&self) -> bool {
        self.active
    }
    
    /// Record profit from a successful execution
    fn record_profit(&mut self, result: &ArbResult) {
        // Add to total profit
        self.profit_ledger.total_profit += result.profit;
        
        // Extract strategy ID from metrics
        if let Some(strategy_id) = result.metrics.get("strategy_id") {
            let strategy_id = strategy_id.to_string();
            *self.profit_ledger.profit_by_strategy.entry(strategy_id).or_insert(0.0) += result.profit;
        }
        
        // Record profit by pair
        for route in &result.route_taken {
            if let Some(pair) = route.split(':').nth(1).map(|s| s.trim().to_string()) {
                *self.profit_ledger.profit_by_pair.entry(pair).or_insert(0.0) += result.profit / result.route_taken.len() as f64;
            }
            
            if let Some(dex) = route.split(':').next().map(|s| s.trim().to_string()) {
                *self.profit_ledger.profit_by_dex.entry(dex).or_insert(0.0) += result.profit / result.route_taken.len() as f64;
            }
        }
        
        // Record daily profit
        let today = Utc::now().format("%Y-%m-%d").to_string();
        *self.profit_ledger.daily_profit.entry(today).or_insert(0.0) += result.profit;
        
        info!("Recorded profit of {:.6} for execution", result.profit);
    }
    
    /// Generate a market-specific strategy
    pub fn generate_market_strategy(&mut self, market_conditions: MarketConditions) -> Result<()> {
        let new_strategy = strategy_generator::generate_market_specific_strategy(self, &market_conditions)?;
        self.strategies.push(new_strategy);
        
        // Cap the number of strategies
        if self.strategies.len() > 10 {
            // Remove the oldest strategy
            self.strategies.remove(0);
        }
        
        Ok(())
    }
    
    /// Get agent performance statistics
    pub fn get_performance_stats(&self) -> HashMap<String, f64> {
        let mut stats = HashMap::new();
        
        stats.insert("total_executions".to_string(), self.total_executions as f64);
        stats.insert("successful_executions".to_string(), self.successful_executions as f64);
        stats.insert("total_profit".to_string(), self.profit_ledger.total_profit);
        stats.insert("strategy_count".to_string(), self.strategies.len() as f64);
        
        // Calculate success rate
        if self.total_executions > 0 {
            let success_rate = (self.successful_executions as f64) / (self.total_executions as f64) * 100.0;
            stats.insert("success_rate".to_string(), success_rate);
        } else {
            stats.insert("success_rate".to_string(), 0.0);
        }
        
        stats
    }
}

/// Thread-safe wrapper for the Hyperion agent
pub struct HyperionAgent {
    state: Arc<Mutex<HyperionState>>,
}

impl HyperionAgent {
    pub fn new(
        strategy_vault: Pubkey,
        fee_wallet: Keypair,
        profit_wallet: Keypair,
    ) -> Self {
        let state = HyperionState::new(strategy_vault, fee_wallet, profit_wallet);
        HyperionAgent {
            state: Arc::new(Mutex::new(state)),
        }
    }
    
    pub fn execute_zero_capital_arb(
        &self,
        dex_path: Vec<DexRoute>,
        chain_route: Option<WormholePath>
    ) -> Result<ArbResult> {
        let mut state = self.state.lock().map_err(|_| anyhow!("Failed to acquire lock on Hyperion state"))?;
        state.execute_zero_capital_arb(dex_path, chain_route)
    }
    
    pub fn activate(&self) -> Result<()> {
        let mut state = self.state.lock().map_err(|_| anyhow!("Failed to acquire lock on Hyperion state"))?;
        state.activate()
    }
    
    pub fn deactivate(&self) -> Result<()> {
        let mut state = self.state.lock().map_err(|_| anyhow!("Failed to acquire lock on Hyperion state"))?;
        state.deactivate()
    }
    
    pub fn is_active(&self) -> Result<bool> {
        let state = self.state.lock().map_err(|_| anyhow!("Failed to acquire lock on Hyperion state"))?;
        Ok(state.is_active())
    }
    
    pub fn get_performance_stats(&self) -> Result<HashMap<String, f64>> {
        let state = self.state.lock().map_err(|_| anyhow!("Failed to acquire lock on Hyperion state"))?;
        Ok(state.get_performance_stats())
    }
    
    pub fn generate_market_strategy(&self, market_conditions: MarketConditions) -> Result<()> {
        let mut state = self.state.lock().map_err(|_| anyhow!("Failed to acquire lock on Hyperion state"))?;
        state.generate_market_strategy(market_conditions)
    }
}