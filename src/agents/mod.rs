// Agent framework module
// Main interface for trading agents in the system

use anyhow::{Result, anyhow, Context};
use log::{info, warn, error, debug};
use serde::{Serialize, Deserialize};
use std::sync::{Arc, RwLock, Mutex};
use std::collections::HashMap;
use chrono::{DateTime, Utc};

use crate::solana::connection::SolanaConnection;
use crate::solana::wallet_manager::WalletManager;
use crate::solana::transaction_manager::TransactionManager;
use crate::transformers::TransformerAPI;

pub mod hyperion;
pub mod quantum_omega;
pub mod intelligence;
pub mod wallet_generator;

// Agent type enum
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AgentType {
    Hyperion,
    QuantumOmega,
    Custom(String),
}

// Agent status enum
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum AgentStatus {
    Idle,
    Initializing,
    Scanning,
    Executing,
    Cooldown,
    Error,
}

// Agent config
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    /// Agent ID
    pub id: String,
    
    /// Agent name
    pub name: String,
    
    /// Agent type
    pub agent_type: AgentType,
    
    /// Active flag
    pub active: bool,
    
    /// Risk level (0.0 - 1.0)
    pub risk_level: f64,
    
    /// Maximum capital allocation
    pub max_capital: f64,
    
    /// Strategy IDs this agent can execute
    pub strategy_ids: Vec<String>,
    
    /// Wallet ID for agent operations
    pub wallet_id: String,
    
    /// Agent priority
    pub priority: u32,
    
    /// Custom parameters
    pub parameters: HashMap<String, String>,
}

// Agent execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentExecutionResult {
    /// Execution ID
    pub id: String,
    
    /// Success flag
    pub success: bool,
    
    /// Profit amount
    pub profit: f64,
    
    /// Execution timestamp
    pub timestamp: String,
    
    /// Transaction signature
    pub signature: Option<String>,
    
    /// Error message
    pub error: Option<String>,
    
    /// Execution metrics
    pub metrics: HashMap<String, f64>,
}

// Agent trait
pub trait Agent {
    /// Get agent configuration
    fn get_config(&self) -> AgentConfig;
    
    /// Get agent status
    fn get_status(&self) -> AgentStatus;
    
    /// Initialize agent
    fn initialize(&mut self) -> Result<()>;
    
    /// Start agent
    fn start(&mut self) -> Result<()>;
    
    /// Stop agent
    fn stop(&mut self) -> Result<()>;
    
    /// Execute strategy
    fn execute_strategy(&mut self) -> Result<AgentExecutionResult>;
    
    /// Update agent (periodic)
    fn update(&mut self) -> Result<()>;
}

// Agent factory
pub struct AgentFactory {
    /// Connection for agents
    connection: Arc<SolanaConnection>,
    
    /// Wallet manager for agents
    wallet_manager: Arc<WalletManager>,
    
    /// Transaction manager for agents
    tx_manager: Arc<TransactionManager>,
    
    /// Transformer API for market prediction
    transformer_api: Arc<TransformerAPI>,
    
    /// LLM controller for intelligence
    llm_controller: Arc<intelligence::LLMController>,
}

impl AgentFactory {
    /// Create new agent factory
    pub fn new(
        connection: Arc<SolanaConnection>,
        wallet_manager: Arc<WalletManager>,
        tx_manager: Arc<TransactionManager>,
        transformer_api: Arc<TransformerAPI>,
        llm_controller: Arc<intelligence::LLMController>,
    ) -> Self {
        Self {
            connection,
            wallet_manager,
            tx_manager,
            transformer_api,
            llm_controller,
        }
    }
    
    /// Create agent from config
    pub fn create_agent(&self, config: AgentConfig) -> Result<Box<dyn Agent + Send + Sync>> {
        match config.agent_type {
            AgentType::Hyperion => {
                // Create Hyperion agent
                let mut agent = hyperion::HyperionAgent::new(config.clone())?;
                
                // Set dependencies
                agent.set_connection(self.connection.clone());
                agent.set_wallet_manager(self.wallet_manager.clone());
                agent.set_transaction_manager(self.tx_manager.clone());
                agent.set_transformer_api(self.transformer_api.clone());
                agent.set_llm_controller(Some(self.llm_controller.clone()));
                
                // Initialize
                agent.initialize()?;
                
                Ok(Box::new(agent) as Box<dyn Agent + Send + Sync>)
            }
            AgentType::QuantumOmega => {
                // Create Quantum Omega agent
                let mut agent = quantum_omega::QuantumOmegaAgent::new(config.clone())?;
                
                // Set dependencies
                agent.set_connection(self.connection.clone());
                agent.set_wallet_manager(self.wallet_manager.clone());
                agent.set_transaction_manager(self.tx_manager.clone());
                agent.set_transformer_api(self.transformer_api.clone());
                agent.set_llm_controller(Some(self.llm_controller.clone()));
                
                // Initialize
                agent.initialize()?;
                
                Ok(Box::new(agent) as Box<dyn Agent + Send + Sync>)
            }
            AgentType::Custom(name) => {
                Err(anyhow!("Custom agent type not implemented: {}", name))
            }
        }
    }
}

// Agent manager
pub struct AgentManager {
    /// Agent factory
    factory: AgentFactory,
    
    /// Running agents
    agents: RwLock<HashMap<String, Box<dyn Agent + Send + Sync>>>,
    
    /// Execution history
    execution_history: RwLock<Vec<AgentExecutionResult>>,
}

impl AgentManager {
    /// Create new agent manager
    pub fn new(
        connection: Arc<SolanaConnection>,
        wallet_manager: Arc<WalletManager>,
        tx_manager: Arc<TransactionManager>,
        transformer_api: Arc<TransformerAPI>,
        llm_controller: Arc<intelligence::LLMController>,
    ) -> Result<Self> {
        let factory = AgentFactory::new(
            connection,
            wallet_manager,
            tx_manager,
            transformer_api,
            llm_controller,
        );
        
        Ok(Self {
            factory,
            agents: RwLock::new(HashMap::new()),
            execution_history: RwLock::new(Vec::new()),
        })
    }
    
    /// Create and register agent
    pub fn create_agent(&self, config: AgentConfig) -> Result<String> {
        let agent_id = config.id.clone();
        
        // Create agent
        let agent = self.factory.create_agent(config)?;
        
        // Register agent
        {
            let mut agents = self.agents.write().unwrap();
            agents.insert(agent_id.clone(), agent);
        }
        
        Ok(agent_id)
    }
    
    /// Get agent by ID
    pub fn get_agent(&self, id: &str) -> Result<Box<dyn Agent + Send + Sync>> {
        let agents = self.agents.read().unwrap();
        
        let agent = agents.get(id)
            .ok_or_else(|| anyhow!("Agent not found: {}", id))?;
        
        // We can't actually return the agent directly due to borrowing rules,
        // so this is a simplified version for interface demonstration
        
        Err(anyhow!("Cannot directly access agent - use manager methods"))
    }
    
    /// Get all agent IDs
    pub fn get_agent_ids(&self) -> Vec<String> {
        let agents = self.agents.read().unwrap();
        agents.keys().cloned().collect()
    }
    
    /// Start agent
    pub fn start_agent(&self, id: &str) -> Result<()> {
        let mut agents = self.agents.write().unwrap();
        
        let agent = agents.get_mut(id)
            .ok_or_else(|| anyhow!("Agent not found: {}", id))?;
        
        agent.start()
    }
    
    /// Stop agent
    pub fn stop_agent(&self, id: &str) -> Result<()> {
        let mut agents = self.agents.write().unwrap();
        
        let agent = agents.get_mut(id)
            .ok_or_else(|| anyhow!("Agent not found: {}", id))?;
        
        agent.stop()
    }
    
    /// Start all agents
    pub fn start_all(&self) -> Result<()> {
        let mut agents = self.agents.write().unwrap();
        
        for (id, agent) in agents.iter_mut() {
            info!("Starting agent: {}", id);
            agent.start()?;
        }
        
        Ok(())
    }
    
    /// Stop all agents
    pub fn stop_all(&self) -> Result<()> {
        let mut agents = self.agents.write().unwrap();
        
        for (id, agent) in agents.iter_mut() {
            info!("Stopping agent: {}", id);
            agent.stop()?;
        }
        
        Ok(())
    }
    
    /// Update all agents
    pub fn update_all(&self) -> Result<()> {
        let mut agents = self.agents.write().unwrap();
        
        for (id, agent) in agents.iter_mut() {
            debug!("Updating agent: {}", id);
            agent.update()?;
        }
        
        Ok(())
    }
    
    /// Check for execution opportunities and execute if found
    pub fn check_execution_opportunities(&self) -> Result<Option<Vec<AgentExecutionResult>>> {
        let mut agents = self.agents.write().unwrap();
        
        let mut results = Vec::new();
        
        // Simple strategy: check each agent in priority order
        let mut agent_entries: Vec<_> = agents.iter_mut().collect();
        
        // Sort by agent priority (higher first)
        agent_entries.sort_by(|(_, a), (_, b)| {
            let a_priority = a.get_config().priority;
            let b_priority = b.get_config().priority;
            b_priority.cmp(&a_priority)
        });
        
        // Execute for each agent that is ready
        for (id, agent) in agent_entries {
            // Only execute for active agents in scanning state
            if agent.get_config().active && agent.get_status() == AgentStatus::Scanning {
                info!("Checking execution opportunities for agent: {}", id);
                
                // In production, this would check market conditions
                // For now, we'll just execute if the agent is in scanning state
                
                // Execute strategy
                let result = agent.execute_strategy()?;
                
                info!("Agent {} executed strategy: success={}, profit={}", 
                     id, result.success, result.profit);
                
                results.push(result.clone());
                
                // Add to execution history
                {
                    let mut history = self.execution_history.write().unwrap();
                    history.push(result);
                }
            }
        }
        
        if results.is_empty() {
            Ok(None)
        } else {
            Ok(Some(results))
        }
    }
    
    /// Get recent execution results
    pub fn get_recent_executions(&self, limit: usize) -> Vec<AgentExecutionResult> {
        let history = self.execution_history.read().unwrap();
        
        history.iter()
            .rev()
            .take(limit)
            .cloned()
            .collect()
    }
}