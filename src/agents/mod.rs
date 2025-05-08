// Agent architecture for Solana Quantum Trading Platform

use anyhow::{Result, anyhow, Context};
use log::{info, warn, error, debug};
use serde::{Serialize, Deserialize};
use std::sync::{Arc, RwLock, Mutex};
use std::collections::HashMap;

pub mod hyperion;
pub mod quantum_omega;
pub mod intelligence;

// Agent type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AgentType {
    /// Hyperion - Flash Arbitrage Overlord
    Hyperion,
    
    /// Quantum Omega - Sniper Supreme
    QuantumOmega,
}

// Agent status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AgentStatus {
    /// Idle - not actively operating
    Idle,
    
    /// Scanning - looking for opportunities
    Scanning,
    
    /// Executing - actively executing a strategy
    Executing,
    
    /// Cooldown - waiting after execution
    Cooldown,
    
    /// Error - encountered an error
    Error,
}

// Agent configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    /// Agent ID
    pub id: String,
    
    /// Agent name
    pub name: String,
    
    /// Agent type
    pub agent_type: AgentType,
    
    /// Active status
    pub active: bool,
    
    /// Risk level (0.0 - 1.0)
    pub risk_level: f64,
    
    /// Maximum capital allocation
    pub max_capital: f64,
    
    /// Target chains
    pub target_chains: Vec<String>,
    
    /// Target DEXes
    pub target_dexes: Vec<String>,
    
    /// Strategy parameters
    pub strategy_params: HashMap<String, String>,
    
    /// Intelligence parameters
    pub intelligence_params: HashMap<String, String>,
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name: "Unnamed Agent".to_string(),
            agent_type: AgentType::Hyperion,
            active: false,
            risk_level: 0.1,
            max_capital: 1000.0,
            target_chains: vec!["solana".to_string()],
            target_dexes: vec!["raydium".to_string(), "orca".to_string()],
            strategy_params: HashMap::new(),
            intelligence_params: HashMap::new(),
        }
    }
}

// Base trait for all agents
pub trait Agent: Send + Sync {
    /// Get agent configuration
    fn get_config(&self) -> AgentConfig;
    
    /// Get agent status
    fn get_status(&self) -> AgentStatus;
    
    /// Initialize the agent
    fn initialize(&mut self) -> Result<()>;
    
    /// Start the agent
    fn start(&mut self) -> Result<()>;
    
    /// Stop the agent
    fn stop(&mut self) -> Result<()>;
    
    /// Execute a strategy
    fn execute_strategy(&mut self) -> Result<AgentExecutionResult>;
    
    /// Update agent state
    fn update(&mut self) -> Result<()>;
}

// Agent execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentExecutionResult {
    /// Execution ID
    pub id: String,
    
    /// Success status
    pub success: bool,
    
    /// Profit amount
    pub profit: f64,
    
    /// Execution timestamp
    pub timestamp: String,
    
    /// Transaction signature
    pub signature: Option<String>,
    
    /// Error message (if any)
    pub error: Option<String>,
    
    /// Execution metrics
    pub metrics: HashMap<String, f64>,
}

// Agent manager for handling all agents
pub struct AgentManager {
    /// Agents by ID
    agents: RwLock<HashMap<String, Box<dyn Agent>>>,
    
    /// Agent factory
    factory: AgentFactory,
}

impl AgentManager {
    /// Create a new agent manager
    pub fn new() -> Self {
        Self {
            agents: RwLock::new(HashMap::new()),
            factory: AgentFactory::new(),
        }
    }
    
    /// Create a new agent
    pub fn create_agent(&self, config: AgentConfig) -> Result<String> {
        let agent = self.factory.create_agent(config.clone())?;
        let agent_id = config.id.clone();
        
        let mut agents = self.agents.write().unwrap();
        agents.insert(agent_id.clone(), agent);
        
        Ok(agent_id)
    }
    
    /// Get an agent by ID
    pub fn get_agent(&self, id: &str) -> Result<Box<dyn Agent>> {
        let agents = self.agents.read().unwrap();
        
        agents.get(id)
            .cloned()
            .ok_or_else(|| anyhow!("Agent not found: {}", id))
    }
    
    /// Get all agents
    pub fn get_agents(&self) -> Vec<AgentConfig> {
        let agents = self.agents.read().unwrap();
        
        agents.values()
            .map(|a| a.get_config())
            .collect()
    }
    
    /// Start all agents
    pub fn start_all(&self) -> Result<()> {
        let mut agents = self.agents.write().unwrap();
        
        for agent in agents.values_mut() {
            agent.start()?;
        }
        
        Ok(())
    }
    
    /// Stop all agents
    pub fn stop_all(&self) -> Result<()> {
        let mut agents = self.agents.write().unwrap();
        
        for agent in agents.values_mut() {
            agent.stop()?;
        }
        
        Ok(())
    }
}

// Agent factory for creating agents
pub struct AgentFactory;

impl AgentFactory {
    /// Create a new agent factory
    pub fn new() -> Self {
        Self
    }
    
    /// Create an agent based on type
    pub fn create_agent(&self, config: AgentConfig) -> Result<Box<dyn Agent>> {
        match config.agent_type {
            AgentType::Hyperion => {
                let agent = hyperion::HyperionAgent::new(config)?;
                Ok(Box::new(agent))
            }
            AgentType::QuantumOmega => {
                let agent = quantum_omega::QuantumOmegaAgent::new(config)?;
                Ok(Box::new(agent))
            }
        }
    }
}