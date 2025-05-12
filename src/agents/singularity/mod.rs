//! Singularity Cross-Chain Oracle Agent Module
//!
//! This module implements the Singularity agent for cross-chain arbitrage.
//! Singularity monitors multiple blockchains to find and execute profitable
//! arbitrage opportunities across chains using Wormhole.

use anyhow::{Result, anyhow};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{self, Duration};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::task::JoinHandle;

pub mod strategy;
pub mod validator;
pub mod scanner;
pub mod executor;

use strategy::{StrategyParams, Opportunity};
use scanner::{ScannerConfig, Scanner, start_background_scanner};
use executor::{ExecutorConfig, Executor, ExecutionResult};
use validator::LiquidityThresholds;

/// Agent state
#[derive(Debug, Clone, PartialEq)]
pub enum AgentState {
    /// Not started
    NotStarted,
    /// Initializing
    Initializing,
    /// Scanning for opportunities
    Scanning,
    /// Executing opportunity
    Executing,
    /// Cooldown period (post-execution)
    Cooldown,
    /// Error state
    Error,
}

/// Performance metrics
#[derive(Debug, Clone)]
pub struct PerformanceMetrics {
    /// Total executions
    pub total_executions: usize,
    /// Successful executions
    pub successful_executions: usize,
    /// Total profit (in USD)
    pub total_profit: f64,
    /// Average profit per execution (in USD)
    pub average_profit: f64,
    /// Last execution timestamp
    pub last_execution: Option<u64>,
}

impl Default for PerformanceMetrics {
    fn default() -> Self {
        Self {
            total_executions: 0,
            successful_executions: 0,
            total_profit: 0.0,
            average_profit: 0.0,
            last_execution: None,
        }
    }
}

/// Agent configuration
#[derive(Debug, Clone)]
pub struct AgentConfig {
    /// Agent ID
    pub id: String,
    /// Agent name
    pub name: String,
    /// Scanner configuration
    pub scanner_config: ScannerConfig,
    /// Executor configuration
    pub executor_config: ExecutorConfig,
    /// Strategy parameters
    pub strategy_params: StrategyParams,
    /// Cooldown period (in seconds)
    pub cooldown_secs: u64,
    /// Maximum executions per hour
    pub max_executions_per_hour: usize,
    /// Auto-start on initialization
    pub auto_start: bool,
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            id: "singularity-1".to_string(),
            name: "Singularity Cross-Chain Oracle".to_string(),
            scanner_config: ScannerConfig::default(),
            executor_config: ExecutorConfig::default(),
            strategy_params: StrategyParams::default(),
            cooldown_secs: 60,
            max_executions_per_hour: 10,
            auto_start: true,
        }
    }
}

/// Singularity agent
pub struct SingularityAgent {
    /// Agent configuration
    config: AgentConfig,
    /// Scanner instance
    scanner: Option<Arc<Mutex<Scanner>>>,
    /// Executor instance
    executor: Option<Arc<Mutex<Executor>>>,
    /// Current state
    state: AgentState,
    /// Performance metrics
    metrics: PerformanceMetrics,
    /// Current opportunities
    opportunities: Vec<Opportunity>,
    /// Recent executions
    executions: Vec<ExecutionResult>,
    /// Background task handles
    task_handles: Vec<JoinHandle<()>>,
    /// Last error
    last_error: Option<String>,
}

impl SingularityAgent {
    /// Create a new Singularity agent
    pub fn new(config: AgentConfig) -> Self {
        Self {
            config,
            scanner: None,
            executor: None,
            state: AgentState::NotStarted,
            metrics: PerformanceMetrics::default(),
            opportunities: Vec::new(),
            executions: Vec::new(),
            task_handles: Vec::new(),
            last_error: None,
        }
    }
    
    /// Initialize the agent
    pub async fn initialize(&mut self) -> Result<()> {
        println!("🚀 Initializing Singularity Cross-Chain Oracle agent");
        
        self.state = AgentState::Initializing;
        
        // Check for environment variables
        if std::env::var("WORMHOLE_API_KEY").is_err() {
            let msg = "Wormhole API key not found, cross-chain operations may be limited";
            println!("⚠️ {}", msg);
            self.last_error = Some(msg.to_string());
        }
        
        // Initialize executor
        let executor_config = self.config.executor_config.clone();
        let mut executor = executor::Executor::new(executor_config);
        
        // Start executor
        if let Err(e) = executor.start() {
            let msg = format!("Failed to start executor: {}", e);
            println!("❌ {}", msg);
            self.last_error = Some(msg);
            self.state = AgentState::Error;
            return Err(anyhow!(msg));
        }
        
        // Wrap executor in Arc<Mutex>
        let executor_arc = Arc::new(Mutex::new(executor));
        self.executor = Some(executor_arc.clone());
        
        // Initialize scanner
        let scanner_config = self.config.scanner_config.clone();
        let strategy_params = self.config.strategy_params.clone();
        
        // Start background scanner
        match scanner::start_background_scanner(scanner_config, strategy_params).await {
            Ok(scanner) => {
                self.scanner = Some(scanner);
            }
            Err(e) => {
                let msg = format!("Failed to start scanner: {}", e);
                println!("❌ {}", msg);
                self.last_error = Some(msg);
                self.state = AgentState::Error;
                return Err(anyhow!(msg));
            }
        }
        
        // Start background tasks
        self.start_background_tasks();
        
        println!("✅ Singularity agent initialized successfully");
        
        // Auto-start if configured
        if self.config.auto_start {
            self.start().await?;
        }
        
        Ok(())
    }
    
    /// Start the agent
    pub async fn start(&mut self) -> Result<()> {
        if self.state == AgentState::Scanning || self.state == AgentState::Executing {
            return Ok(());
        }
        
        println!("🚀 Starting Singularity Cross-Chain Oracle agent");
        
        self.state = AgentState::Scanning;
        
        println!("✅ Singularity agent started successfully");
        
        Ok(())
    }
    
    /// Stop the agent
    pub async fn stop(&mut self) -> Result<()> {
        if self.state == AgentState::NotStarted || self.state == AgentState::Error {
            return Ok(());
        }
        
        println!("🛑 Stopping Singularity Cross-Chain Oracle agent");
        
        // Stop background tasks
        for handle in self.task_handles.drain(..) {
            handle.abort();
        }
        
        // Stop scanner if running
        if let Some(scanner) = &self.scanner {
            let mut scanner = scanner.lock().await;
            if scanner.is_active() {
                scanner.stop()?;
            }
        }
        
        // Stop executor if running
        if let Some(executor) = &self.executor {
            let mut executor = executor.lock().await;
            if executor.is_active() {
                executor.stop()?;
            }
        }
        
        self.state = AgentState::NotStarted;
        
        println!("✅ Singularity agent stopped successfully");
        
        Ok(())
    }
    
    /// Get the current state
    pub fn state(&self) -> AgentState {
        self.state.clone()
    }
    
    /// Get the agent ID
    pub fn id(&self) -> &str {
        &self.config.id
    }
    
    /// Get the agent name
    pub fn name(&self) -> &str {
        &self.config.name
    }
    
    /// Get the current opportunities
    pub async fn get_opportunities(&self) -> Vec<Opportunity> {
        if let Some(scanner) = &self.scanner {
            if let Ok(scanner) = scanner.try_lock() {
                return scanner.get_opportunities().to_vec();
            }
        }
        
        self.opportunities.clone()
    }
    
    /// Get the recent executions
    pub async fn get_executions(&self, limit: usize) -> Vec<ExecutionResult> {
        if let Some(executor) = &self.executor {
            if let Ok(executor) = executor.try_lock() {
                return executor.get_recent_executions(limit);
            }
        }
        
        let start = if self.executions.len() > limit {
            self.executions.len() - limit
        } else {
            0
        };
        
        self.executions[start..].to_vec()
    }
    
    /// Get the performance metrics
    pub fn get_metrics(&self) -> PerformanceMetrics {
        self.metrics.clone()
    }
    
    /// Get the last error
    pub fn get_last_error(&self) -> Option<String> {
        self.last_error.clone()
    }
    
    /// Start background tasks
    fn start_background_tasks(&mut self) {
        // Start opportunity scanner task
        let scanner_clone = self.scanner.clone();
        let executor_clone = self.executor.clone();
        let config_clone = self.config.clone();
        let mut state_copy = self.state.clone();
        
        let handle = tokio::spawn(async move {
            let mut interval = time::interval(Duration::from_secs(10));
            
            loop {
                interval.tick().await;
                
                // Skip if executor is not active
                if let Some(executor) = &executor_clone {
                    if let Ok(executor) = executor.try_lock() {
                        if !executor.is_active() {
                            continue;
                        }
                    }
                }
                
                if state_copy == AgentState::Scanning {
                    // Get opportunities from scanner
                    if let Some(scanner) = &scanner_clone {
                        if let Ok(mut scanner) = scanner.try_lock() {
                            if !scanner.is_active() {
                                continue;
                            }
                            
                            match scanner.scan().await {
                                Ok(opportunities) => {
                                    if !opportunities.is_empty() {
                                        // We have opportunities! Execute the best one
                                        if let Some(opportunity) = opportunities.first() {
                                            if let Some(executor) = &executor_clone {
                                                if let Ok(mut executor) = executor.try_lock() {
                                                    state_copy = AgentState::Executing;
                                                    
                                                    match executor.execute_opportunity(opportunity).await {
                                                        Ok(result) => {
                                                            println!("✅ Execution completed: {}", 
                                                                    if result.success { "Success" } else { "Failed" });
                                                            
                                                            state_copy = AgentState::Cooldown;
                                                            
                                                            // Wait for cooldown
                                                            tokio::time::sleep(Duration::from_secs(config_clone.cooldown_secs)).await;
                                                            
                                                            state_copy = AgentState::Scanning;
                                                        }
                                                        Err(e) => {
                                                            println!("❌ Execution error: {}", e);
                                                            state_copy = AgentState::Scanning;
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                                Err(e) => {
                                    println!("❌ Scanner error: {}", e);
                                }
                            }
                        }
                    }
                }
            }
        });
        
        self.task_handles.push(handle);
        
        // Start metrics update task
        let executor_clone = self.executor.clone();
        let metrics_clone = Arc::new(Mutex::new(self.metrics.clone()));
        
        let handle = tokio::spawn(async move {
            let mut interval = time::interval(Duration::from_secs(60));
            
            loop {
                interval.tick().await;
                
                // Update metrics
                if let Some(executor) = &executor_clone {
                    if let Ok(executor) = executor.try_lock() {
                        let recent_executions = executor.get_recent_executions(100);
                        let total_profit = executor.get_total_profit();
                        
                        if let Ok(mut metrics) = metrics_clone.try_lock() {
                            metrics.total_executions = recent_executions.len();
                            metrics.successful_executions = recent_executions.iter().filter(|e| e.success).count();
                            metrics.total_profit = total_profit;
                            
                            if metrics.successful_executions > 0 {
                                metrics.average_profit = total_profit / (metrics.successful_executions as f64);
                            }
                            
                            if let Some(last_execution) = recent_executions.last() {
                                metrics.last_execution = Some(last_execution.timestamp);
                            }
                        }
                    }
                }
            }
        });
        
        self.task_handles.push(handle);
    }
    
    /// Execute an opportunity manually
    pub async fn execute_opportunity(&mut self, opportunity_id: &str) -> Result<ExecutionResult> {
        if self.state != AgentState::Scanning {
            return Err(anyhow!("Agent must be in scanning state to execute opportunities"));
        }
        
        // Find opportunity
        let opportunity = self.find_opportunity(opportunity_id).await?;
        
        // Execute opportunity
        self.state = AgentState::Executing;
        
        let result = if let Some(executor) = &self.executor {
            let mut executor = executor.lock().await;
            executor.execute_opportunity(&opportunity).await?
        } else {
            return Err(anyhow!("Executor not initialized"));
        };
        
        // Update state
        if result.success {
            self.state = AgentState::Cooldown;
            
            // Start cooldown timer
            let state_clone = Arc::new(Mutex::new(self.state.clone()));
            let cooldown_secs = self.config.cooldown_secs;
            
            let handle = tokio::spawn(async move {
                tokio::time::sleep(Duration::from_secs(cooldown_secs)).await;
                
                if let Ok(mut state) = state_clone.lock().await {
                    if *state == AgentState::Cooldown {
                        *state = AgentState::Scanning;
                    }
                }
            });
            
            self.task_handles.push(handle);
        } else {
            self.state = AgentState::Scanning;
        }
        
        // Update metrics
        self.metrics.total_executions += 1;
        if result.success {
            self.metrics.successful_executions += 1;
            self.metrics.total_profit += result.profit_amount;
            self.metrics.average_profit = self.metrics.total_profit / (self.metrics.successful_executions as f64);
        }
        self.metrics.last_execution = Some(result.timestamp);
        
        // Add to executions
        self.executions.push(result.clone());
        
        // Trim executions if too many
        if self.executions.len() > 100 {
            self.executions.drain(0..self.executions.len() - 100);
        }
        
        Ok(result)
    }
    
    /// Find an opportunity by ID
    pub async fn find_opportunity(&self, id: &str) -> Result<Opportunity> {
        if let Some(scanner) = &self.scanner {
            let scanner = scanner.lock().await;
            if let Some(opportunity) = scanner.find_opportunity(id) {
                return Ok(opportunity.clone());
            }
        }
        
        if let Some(opportunity) = self.opportunities.iter().find(|o| o.id == id) {
            return Ok(opportunity.clone());
        }
        
        Err(anyhow!("Opportunity not found: {}", id))
    }
}

/// Create a Singularity agent with default configuration
pub async fn create_default_agent() -> Result<SingularityAgent> {
    let config = AgentConfig::default();
    let mut agent = SingularityAgent::new(config);
    
    // Initialize agent
    agent.initialize().await?;
    
    Ok(agent)
}

/// Get agent status as JSON
pub fn get_agent_status_json(agent: &SingularityAgent) -> String {
    let status = match agent.state() {
        AgentState::NotStarted => "not_started",
        AgentState::Initializing => "initializing",
        AgentState::Scanning => "scanning",
        AgentState::Executing => "executing",
        AgentState::Cooldown => "cooldown",
        AgentState::Error => "error",
    };
    
    let metrics = agent.get_metrics();
    
    format!(
        r#"{{
            "id": "{}",
            "name": "{}",
            "status": "{}",
            "metrics": {{
                "total_executions": {},
                "successful_executions": {},
                "total_profit": {},
                "average_profit": {}
            }},
            "last_error": {}
        }}"#,
        agent.id(),
        agent.name(),
        status,
        metrics.total_executions,
        metrics.successful_executions,
        metrics.total_profit,
        metrics.average_profit,
        if let Some(error) = agent.get_last_error() {
            format!(r#""{}""#, error)
        } else {
            "null".to_string()
        }
    )
}