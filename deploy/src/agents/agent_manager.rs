use std::sync::{Arc, Mutex, RwLock};
use std::collections::{HashMap, HashSet};
use std::time::{Duration, Instant};
use std::fmt;
use log::{info, warn, error, debug};
use anyhow::{Result, anyhow};
use uuid::Uuid;
use serde::{Serialize, Deserialize};
use tokio::time::sleep;

use crate::solana::connection::SolanaConnection;
use crate::solana::rate_limiter::RequestPriority;
use crate::solana::wallet_manager::WalletManager;
use crate::dex::dex_client::DexClient;
use crate::dex::token_pair::TokenPair;
use crate::transformers::transformer_api::TransformerAPI;
use crate::agents::learning::AgentLearningSystem;

/// Agent types that can be created
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum AgentType {
    Hyperion,
    QuantumOmega,
}

impl fmt::Display for AgentType {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            AgentType::Hyperion => write!(f, "Hyperion"),
            AgentType::QuantumOmega => write!(f, "QuantumOmega"),
        }
    }
}

/// Status of an agent
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum AgentStatus {
    Idle,
    Initializing,
    Scanning,
    Executing,
    Cooldown,
    Error,
}

impl fmt::Display for AgentStatus {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            AgentStatus::Idle => write!(f, "Idle"),
            AgentStatus::Initializing => write!(f, "Initializing"),
            AgentStatus::Scanning => write!(f, "Scanning"),
            AgentStatus::Executing => write!(f, "Executing"),
            AgentStatus::Cooldown => write!(f, "Cooldown"),
            AgentStatus::Error => write!(f, "Error"),
        }
    }
}

/// Agent's metrics and state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentState {
    pub id: String,
    pub name: String,
    pub agent_type: AgentType,
    pub status: AgentStatus,
    pub active: bool,
    pub wallets: HashMap<String, String>, // wallet_type -> address
    pub metrics: AgentMetrics,
    pub last_error: Option<String>,
    pub config: HashMap<String, String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub last_active: chrono::DateTime<chrono::Utc>,
}

/// Metrics for tracking agent performance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMetrics {
    pub total_executions: u32,
    pub success_count: u32,
    pub failure_count: u32,
    pub total_profit: f64,
    pub last_execution: Option<chrono::DateTime<chrono::Utc>>,
    pub execution_times: Vec<u64>, // milliseconds
    pub avg_execution_time: u64,
    pub strategy_performance: HashMap<String, StrategyPerformance>,
}

/// Performance metrics for a specific strategy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrategyPerformance {
    pub strategy_id: String,
    pub executions: u32,
    pub successes: u32,
    pub failures: u32,
    pub profit: f64,
    pub avg_profit_per_execution: f64,
}

/// Result of an execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub id: String,
    pub agent_id: String,
    pub agent_type: AgentType,
    pub success: bool,
    pub profit: f64,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub strategy: String,
    pub pair: Option<String>,
    pub execution_time_ms: u64,
    pub metrics: HashMap<String, f64>,
    pub signature: Option<String>,
    pub error: Option<String>,
}

/// Trait for agent implementations
pub trait Agent: Send + Sync {
    fn get_id(&self) -> &str;
    fn get_type(&self) -> AgentType;
    fn get_name(&self) -> &str;
    fn get_state(&self) -> AgentState;
    fn is_active(&self) -> bool;
    fn activate(&mut self) -> Result<()>;
    fn deactivate(&mut self) -> Result<()>;
    fn execute(&mut self) -> Result<ExecutionResult>;
    fn update_config(&mut self, config: HashMap<String, String>) -> Result<()>;
}

/// Agent Manager for handling multiple agents
pub struct AgentManager {
    agents: RwLock<HashMap<String, Box<dyn Agent>>>,
    executions: RwLock<Vec<ExecutionResult>>,
    solana_connection: Arc<SolanaConnection>,
    wallet_manager: Arc<WalletManager>,
    dex_client: Arc<DexClient>,
    transformer_api: Arc<TransformerAPI>,
    learning_system: Arc<AgentLearningSystem>,
    active_task: Mutex<Option<tokio::task::JoinHandle<()>>>,
    running: RwLock<bool>,
    cycle_interval: Duration,
    execution_history_limit: usize,
    websocket_clients: RwLock<HashSet<String>>,
}

impl AgentManager {
    /// Create a new agent manager
    pub fn new(
        solana_connection: Arc<SolanaConnection>,
        wallet_manager: Arc<WalletManager>,
        dex_client: Arc<DexClient>,
        transformer_api: Arc<TransformerAPI>,
    ) -> Self {
        Self {
            agents: RwLock::new(HashMap::new()),
            executions: RwLock::new(Vec::new()),
            solana_connection,
            wallet_manager,
            dex_client,
            transformer_api,
            learning_system: Arc::new(AgentLearningSystem::new()),
            active_task: Mutex::new(None),
            running: RwLock::new(false),
            cycle_interval: Duration::from_secs(5),
            execution_history_limit: 1000,
            websocket_clients: RwLock::new(HashSet::new()),
        }
    }
    
    /// Start the agent system
    pub fn start(&self) -> Result<()> {
        let mut running = self.running.write().unwrap();
        
        if *running {
            return Ok(());
        }
        
        *running = true;
        
        // Create agent task
        let agent_manager = self.clone();
        let handle = tokio::spawn(async move {
            agent_manager.run_agent_cycle().await;
        });
        
        // Store task handle
        let mut active_task = self.active_task.lock().unwrap();
        *active_task = Some(handle);
        
        info!("Agent system started");
        Ok(())
    }
    
    /// Stop the agent system
    pub fn stop(&self) -> Result<()> {
        let mut running = self.running.write().unwrap();
        
        if !*running {
            return Ok(());
        }
        
        *running = false;
        
        // Cancel the task
        let mut active_task = self.active_task.lock().unwrap();
        if let Some(task) = active_task.take() {
            task.abort();
            info!("Agent system stopped");
        }
        
        Ok(())
    }
    
    /// Register a new agent
    pub fn register_agent(&self, agent: Box<dyn Agent>) -> Result<()> {
        let mut agents = self.agents.write().unwrap();
        
        if agents.contains_key(agent.get_id()) {
            return Err(anyhow!("Agent with ID {} already exists", agent.get_id()));
        }
        
        let agent_id = agent.get_id().to_string();
        agents.insert(agent_id, agent);
        
        Ok(())
    }
    
    /// Get an agent by ID
    pub fn get_agent(&self, id: &str) -> Option<AgentState> {
        let agents = self.agents.read().unwrap();
        
        agents.get(id).map(|agent| agent.get_state())
    }
    
    /// Get all agent states
    pub fn get_all_agents(&self) -> Vec<AgentState> {
        let agents = self.agents.read().unwrap();
        
        agents.values()
            .map(|agent| agent.get_state())
            .collect()
    }
    
    /// Activate an agent
    pub fn activate_agent(&self, id: &str) -> Result<()> {
        let mut agents = self.agents.write().unwrap();
        
        if let Some(agent) = agents.get_mut(id) {
            agent.activate()?;
            
            // Broadcast update to all websocket clients
            let state = agent.get_state();
            self.broadcast_agent_update(&state);
            
            Ok(())
        } else {
            Err(anyhow!("Agent with ID {} not found", id))
        }
    }
    
    /// Deactivate an agent
    pub fn deactivate_agent(&self, id: &str) -> Result<()> {
        let mut agents = self.agents.write().unwrap();
        
        if let Some(agent) = agents.get_mut(id) {
            agent.deactivate()?;
            
            // Broadcast update to all websocket clients
            let state = agent.get_state();
            self.broadcast_agent_update(&state);
            
            Ok(())
        } else {
            Err(anyhow!("Agent with ID {} not found", id))
        }
    }
    
    /// Update agent configuration
    pub fn update_agent_config(&self, id: &str, config: HashMap<String, String>) -> Result<()> {
        let mut agents = self.agents.write().unwrap();
        
        if let Some(agent) = agents.get_mut(id) {
            agent.update_config(config)?;
            
            // Broadcast update to all websocket clients
            let state = agent.get_state();
            self.broadcast_agent_update(&state);
            
            Ok(())
        } else {
            Err(anyhow!("Agent with ID {} not found", id))
        }
    }
    
    /// Get recent executions
    pub fn get_recent_executions(&self, limit: usize) -> Vec<ExecutionResult> {
        let executions = self.executions.read().unwrap();
        
        let start_idx = if executions.len() > limit {
            executions.len() - limit
        } else {
            0
        };
        
        executions[start_idx..].to_vec()
    }
    
    /// Register a WebSocket client
    pub fn register_websocket_client(&self, client_id: &str) {
        let mut clients = self.websocket_clients.write().unwrap();
        clients.insert(client_id.to_string());
        debug!("WebSocket client {} registered", client_id);
    }
    
    /// Unregister a WebSocket client
    pub fn unregister_websocket_client(&self, client_id: &str) {
        let mut clients = self.websocket_clients.write().unwrap();
        clients.remove(client_id);
        debug!("WebSocket client {} unregistered", client_id);
    }
    
    /// Broadcast an agent update to all websocket clients
    fn broadcast_agent_update(&self, agent_state: &AgentState) {
        // Here we would send the update to all registered WebSocket clients
        // This is just a placeholder for now
        debug!("Broadcasting agent update for {}", agent_state.id);
    }
    
    /// Broadcast an execution result to all websocket clients
    fn broadcast_execution_result(&self, result: &ExecutionResult) {
        // Here we would send the execution result to all registered WebSocket clients
        // This is just a placeholder for now
        debug!("Broadcasting execution result {}", result.id);
    }
    
    /// Main agent cycle that runs periodically
    async fn run_agent_cycle(&self) {
        info!("Starting agent cycle");
        
        while *self.running.read().unwrap() {
            debug!("Running agent cycle");
            
            let rpc_stats = self.solana_connection.get_rpc_stats();
            debug!("RPC Stats: {}", rpc_stats);
            
            // Get active agents
            let active_agents: Vec<String> = {
                let agents = self.agents.read().unwrap();
                agents.values()
                    .filter(|agent| agent.is_active())
                    .map(|agent| agent.get_id().to_string())
                    .collect()
            };
            
            for agent_id in active_agents {
                // Execute each active agent
                match self.execute_agent(&agent_id).await {
                    Ok(result) => {
                        // Store the execution result
                        self.store_execution_result(result.clone());
                        
                        // Broadcast to websocket clients
                        self.broadcast_execution_result(&result);
                    },
                    Err(e) => {
                        error!("Failed to execute agent {}: {}", agent_id, e);
                    }
                }
                
                // Small delay between agent executions to avoid overwhelming the system
                sleep(Duration::from_millis(500)).await;
            }
            
            // Wait for next cycle
            sleep(self.cycle_interval).await;
        }
        
        info!("Agent cycle stopped");
    }
    
    /// Execute a specific agent and handle errors
    async fn execute_agent(&self, agent_id: &str) -> Result<ExecutionResult> {
        let mut agent_opt = None;
        
        {
            let mut agents = self.agents.write().unwrap();
            if let Some(agent) = agents.get_mut(agent_id) {
                agent_opt = Some(agent);
            }
        }
        
        if let Some(agent) = agent_opt {
            match self.solana_connection.get_rate_limiter().adaptive_request(
                RequestPriority::High,
                || agent.execute()
            ).await {
                Ok(result) => {
                    // Update agent state to reflect execution result
                    let agent_state = agent.get_state();
                    self.broadcast_agent_update(&agent_state);
                    
                    Ok(result)
                },
                Err(e) => {
                    // Update agent state to reflect error
                    let mut agents = self.agents.write().unwrap();
                    if let Some(agent) = agents.get_mut(agent_id) {
                        // Update agent state with error
                        let agent_state = agent.get_state();
                        self.broadcast_agent_update(&agent_state);
                    }
                    
                    Err(e)
                }
            }
        } else {
            Err(anyhow!("Agent with ID {} not found", agent_id))
        }
    }
    
    /// Store execution result and prune history if needed
    fn store_execution_result(&self, result: ExecutionResult) {
        let mut executions = self.executions.write().unwrap();
        
        // Store in execution history
        executions.push(result.clone());
        
        // Prune history if it exceeds the limit
        if executions.len() > self.execution_history_limit {
            let excess = executions.len() - self.execution_history_limit;
            executions.drain(0..excess);
        }
        
        // Add to learning system
        self.learning_system.add_execution_result(result);
        
        // Try to generate insights in the background
        let learning_system = self.learning_system.clone();
        tokio::spawn(async move {
            match learning_system.analyze_and_generate_insights() {
                Ok(insights) => {
                    if !insights.is_empty() {
                        debug!("Generated {} new insights from execution data", insights.len());
                        
                        // Log some example insights
                        if let Some(insight) = insights.first() {
                            info!("Insight: {} (confidence: {:.2})", insight.description, insight.confidence);
                            info!("Recommendation: {}", insight.recommendation);
                        }
                    }
                },
                Err(e) => {
                    error!("Failed to generate insights: {}", e);
                }
            }
        });
    }
    
    /// Get learning insights for an agent
    pub fn get_learning_insights(&self, agent_type: AgentType) -> Vec<LearningInsight> {
        self.learning_system.get_insights_for_agent(agent_type)
    }
    
    /// Get all learning insights
    pub fn get_all_learning_insights(&self) -> Vec<LearningInsight> {
        self.learning_system.get_insights()
    }
    
    /// Apply a learning insight
    pub fn apply_learning_insight(&self, insight_id: &str, success: bool, performance_delta: f64, notes: &str) -> Result<()> {
        let result = InsightResult {
            applied_at: chrono::Utc::now(),
            success,
            performance_delta,
            notes: notes.to_string(),
        };
        
        self.learning_system.apply_insight(insight_id, result)
    }
}

impl Clone for AgentManager {
    fn clone(&self) -> Self {
        Self {
            agents: RwLock::new(HashMap::new()),
            executions: RwLock::new(Vec::new()),
            solana_connection: self.solana_connection.clone(),
            wallet_manager: self.wallet_manager.clone(),
            dex_client: self.dex_client.clone(),
            transformer_api: self.transformer_api.clone(),
            learning_system: self.learning_system.clone(),
            active_task: Mutex::new(None),
            running: RwLock::new(*self.running.read().unwrap()),
            cycle_interval: self.cycle_interval,
            execution_history_limit: self.execution_history_limit,
            websocket_clients: RwLock::new(HashSet::new()),
        }
    }
}