//! Singularity Cross-Chain Agent
//!
//! This module implements the Singularity agent for cross-chain arbitrage.
//! It coordinates the strategy, scanner, executor, and validator components
//! to find and execute cross-chain arbitrage opportunities.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

mod strategy;
mod scanner;
mod executor;
mod validator;

pub use strategy::{SingularityStrategy, StrategyParams};
pub use scanner::{SingularityScanner, ScannerParams};
pub use executor::{SingularityExecutor, ExecutorParams};
pub use validator::{SingularityValidator, ValidatorParams, ValidationResult};

/// Chain types
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum ChainType {
    /// Solana
    Solana,
    
    /// Ethereum
    Ethereum,
    
    /// Binance Smart Chain
    BSC,
    
    /// Polygon
    Polygon,
    
    /// Avalanche
    Avalanche,
    
    /// Arbitrum
    Arbitrum,
    
    /// Optimism
    Optimism,
}

impl std::fmt::Display for ChainType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ChainType::Solana => write!(f, "Solana"),
            ChainType::Ethereum => write!(f, "Ethereum"),
            ChainType::BSC => write!(f, "BSC"),
            ChainType::Polygon => write!(f, "Polygon"),
            ChainType::Avalanche => write!(f, "Avalanche"),
            ChainType::Arbitrum => write!(f, "Arbitrum"),
            ChainType::Optimism => write!(f, "Optimism"),
        }
    }
}

/// Cross-chain arbitrage opportunity
#[derive(Debug, Clone)]
pub struct CrossChainOpportunity {
    /// Opportunity ID
    pub id: String,
    
    /// Source chain
    pub source_chain: ChainType,
    
    /// Target chain
    pub target_chain: ChainType,
    
    /// Source token
    pub source_token: String,
    
    /// Target token
    pub target_token: String,
    
    /// Input amount (in USD)
    pub input_amount: f64,
    
    /// Expected output amount (in USD)
    pub output_amount: f64,
    
    /// Expected profit (in USD)
    pub expected_profit: f64,
    
    /// Profit percentage
    pub profit_pct: f64,
    
    /// Total fees (in USD)
    pub total_fees: f64,
    
    /// Source DEX
    pub source_dex: String,
    
    /// Target DEX
    pub target_dex: String,
    
    /// Bridge to use
    pub bridge: String,
    
    /// Detected at timestamp (seconds since epoch)
    pub detected_at: u64,
    
    /// Expires at timestamp (seconds since epoch)
    pub expires_at: u64,
    
    /// Whether the opportunity has been validated
    pub is_validated: bool,
    
    /// Additional metadata
    pub metadata: HashMap<String, String>,
}

/// Execution result
#[derive(Debug, Clone)]
pub struct ExecutionResult {
    /// Execution ID
    pub id: String,
    
    /// Opportunity ID
    pub opportunity_id: String,
    
    /// Success flag
    pub success: bool,
    
    /// Input amount (in USD)
    pub input_amount: f64,
    
    /// Actual output amount (in USD)
    pub output_amount: f64,
    
    /// Profit (in USD)
    pub profit: f64,
    
    /// Profit percentage
    pub profit_pct: f64,
    
    /// Timestamp (seconds since epoch)
    pub timestamp: u64,
    
    /// Transaction hashes
    pub tx_hashes: HashMap<String, String>,
    
    /// Error message (if any)
    pub error: Option<String>,
    
    /// Duration (in milliseconds)
    pub duration_ms: u64,
    
    /// Source chain
    pub source_chain: ChainType,
    
    /// Target chain
    pub target_chain: ChainType,
    
    /// Source token
    pub source_token: String,
    
    /// Target token
    pub target_token: String,
}

/// Singularity agent configuration
#[derive(Debug, Clone)]
pub struct SingularityConfig {
    /// Agent ID
    pub id: String,
    
    /// Agent name
    pub name: String,
    
    /// Trading wallet address
    pub trading_wallet: String,
    
    /// Profit wallet address
    pub profit_wallet: String,
    
    /// Fee wallet address
    pub fee_wallet: String,
    
    /// Maximum input amount (in USD)
    pub max_input: f64,
    
    /// Minimum profit percentage
    pub min_profit_pct: f64,
    
    /// Gas price multiplier
    pub gas_price_multiplier: f64,
    
    /// Scan interval (in seconds)
    pub scan_interval: u64,
    
    /// Debug mode
    pub debug_mode: bool,
    
    /// Active flag
    pub active: bool,
}

impl Default for SingularityConfig {
    fn default() -> Self {
        Self {
            id: "singularity_agent".to_string(),
            name: "Singularity Cross-Chain Oracle".to_string(),
            trading_wallet: "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb".to_string(),
            profit_wallet: "6bLfHsp6eCFWZqGKZQaRwpVVLZRwKqcLt6QCKwLoxTqF".to_string(),
            fee_wallet: "9aBt1zPRUZmxttZ6Mk9AAU6XGS1TLQMZkpbCNBLH2Y2z".to_string(),
            max_input: 100.0,
            min_profit_pct: 0.5,
            gas_price_multiplier: 1.2,
            scan_interval: 10,
            debug_mode: false,
            active: false,
        }
    }
}

/// Singularity agent for cross-chain arbitrage
pub struct SingularityAgent {
    /// Configuration
    config: SingularityConfig,
    
    /// Strategy component
    strategy: Arc<Mutex<SingularityStrategy>>,
    
    /// Scanner component
    scanner: Arc<Mutex<SingularityScanner>>,
    
    /// Executor component
    executor: Arc<Mutex<SingularityExecutor>>,
    
    /// Validator component
    validator: Arc<Mutex<SingularityValidator>>,
    
    /// Current opportunities
    opportunities: Arc<Mutex<Vec<CrossChainOpportunity>>>,
    
    /// Recent executions
    executions: Arc<Mutex<Vec<ExecutionResult>>>,
    
    /// Agent status
    status: Arc<Mutex<AgentStatus>>,
    
    /// Shutdown flag
    shutdown: Arc<Mutex<bool>>,
    
    /// Agent thread handle
    thread_handle: Option<thread::JoinHandle<()>>,
}

/// Agent status
#[derive(Debug, Clone, PartialEq)]
pub enum AgentStatus {
    /// Stopped
    Stopped,
    
    /// Initializing
    Initializing,
    
    /// Scanning
    Scanning,
    
    /// Executing
    Executing,
    
    /// Running
    Running,
    
    /// Error
    Error(String),
}

impl SingularityAgent {
    /// Create a new Singularity agent
    pub fn new(config: SingularityConfig) -> Self {
        let strategy = Arc::new(Mutex::new(SingularityStrategy::new(config.clone())));
        let scanner = Arc::new(Mutex::new(SingularityScanner::new(config.clone())));
        let executor = Arc::new(Mutex::new(SingularityExecutor::new(config.clone())));
        let validator = Arc::new(Mutex::new(SingularityValidator::new(config.clone())));
        
        Self {
            config,
            strategy,
            scanner,
            executor,
            validator,
            opportunities: Arc::new(Mutex::new(Vec::new())),
            executions: Arc::new(Mutex::new(Vec::new())),
            status: Arc::new(Mutex::new(AgentStatus::Stopped)),
            shutdown: Arc::new(Mutex::new(false)),
            thread_handle: None,
        }
    }
    
    /// Start the agent
    pub fn start(&mut self) -> Result<(), String> {
        // Check if already running
        {
            let status = self.status.lock().unwrap();
            if *status != AgentStatus::Stopped {
                return Err("Agent is already running".to_string());
            }
        }
        
        // Reset shutdown flag
        *self.shutdown.lock().unwrap() = false;
        
        // Update status to initializing
        *self.status.lock().unwrap() = AgentStatus::Initializing;
        
        // Initialize components
        {
            let mut strategy = self.strategy.lock().unwrap();
            strategy.initialize()?;
        }
        
        {
            let mut scanner = self.scanner.lock().unwrap();
            scanner.initialize()?;
        }
        
        {
            let mut executor = self.executor.lock().unwrap();
            executor.initialize()?;
        }
        
        {
            let mut validator = self.validator.lock().unwrap();
            validator.initialize()?;
        }
        
        // Clone Arc references for the thread
        let strategy = self.strategy.clone();
        let scanner = self.scanner.clone();
        let executor = self.executor.clone();
        let validator = self.validator.clone();
        let opportunities = self.opportunities.clone();
        let executions = self.executions.clone();
        let status = self.status.clone();
        let shutdown = self.shutdown.clone();
        let config = self.config.clone();
        
        // Start the agent thread
        let thread_handle = thread::spawn(move || {
            println!("Singularity agent thread started");
            
            *status.lock().unwrap() = AgentStatus::Running;
            
            let mut last_scan_time = 0;
            
            // Main agent loop
            loop {
                // Check shutdown flag
                if *shutdown.lock().unwrap() {
                    println!("Singularity agent thread shutting down");
                    break;
                }
                
                // Get current time
                let current_time = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .expect("Time went backwards")
                    .as_secs();
                
                // Check if it's time to scan
                if current_time - last_scan_time >= config.scan_interval {
                    last_scan_time = current_time;
                    
                    // Scan for opportunities
                    *status.lock().unwrap() = AgentStatus::Scanning;
                    
                    let new_opportunities = match scanner.lock().unwrap().scan() {
                        Ok(opps) => opps,
                        Err(e) => {
                            println!("Error scanning for opportunities: {}", e);
                            *status.lock().unwrap() = AgentStatus::Error(e);
                            thread::sleep(Duration::from_secs(config.scan_interval));
                            continue;
                        }
                    };
                    
                    // Validate opportunities
                    let mut validated_opportunities = Vec::new();
                    
                    for opp in new_opportunities {
                        match validator.lock().unwrap().validate(&opp) {
                            Ok(result) => {
                                if result.is_valid {
                                    let mut validated_opp = opp.clone();
                                    validated_opp.is_validated = true;
                                    validated_opportunities.push(validated_opp);
                                }
                            }
                            Err(e) => {
                                println!("Error validating opportunity {}: {}", opp.id, e);
                            }
                        }
                    }
                    
                    // Select opportunities to execute
                    let selected_opportunities = match strategy.lock().unwrap().select_opportunities(&validated_opportunities) {
                        Ok(opps) => opps,
                        Err(e) => {
                            println!("Error selecting opportunities: {}", e);
                            *status.lock().unwrap() = AgentStatus::Error(e);
                            thread::sleep(Duration::from_secs(config.scan_interval));
                            continue;
                        }
                    };
                    
                    // Execute selected opportunities
                    if !selected_opportunities.is_empty() {
                        *status.lock().unwrap() = AgentStatus::Executing;
                        
                        for opp in &selected_opportunities {
                            println!("Executing opportunity {}: {} -> {} ({:.2}%)", 
                                opp.id, opp.source_chain, opp.target_chain, opp.profit_pct);
                            
                            match executor.lock().unwrap().execute(opp) {
                                Ok(execution_id) => {
                                    println!("Execution started: {}", execution_id);
                                }
                                Err(e) => {
                                    println!("Error executing opportunity {}: {}", opp.id, e);
                                }
                            }
                        }
                    }
                    
                    // Update opportunities list
                    *opportunities.lock().unwrap() = validated_opportunities.clone();
                    
                    // Get recent executions
                    let recent_execs = executor.lock().unwrap().get_recent_executions(10);
                    *executions.lock().unwrap() = recent_execs;
                    
                    // Update status to running
                    *status.lock().unwrap() = AgentStatus::Running;
                }
                
                // Sleep a bit to avoid hogging CPU
                thread::sleep(Duration::from_millis(100));
            }
            
            // Set status to stopped before exiting
            *status.lock().unwrap() = AgentStatus::Stopped;
            println!("Singularity agent thread stopped");
        });
        
        self.thread_handle = Some(thread_handle);
        self.config.active = true;
        
        println!("Singularity agent started");
        
        Ok(())
    }
    
    /// Stop the agent
    pub fn stop(&mut self) -> Result<(), String> {
        // Check if already stopped
        {
            let status = self.status.lock().unwrap();
            if *status == AgentStatus::Stopped {
                return Err("Agent is already stopped".to_string());
            }
        }
        
        // Set shutdown flag
        *self.shutdown.lock().unwrap() = true;
        
        // Wait for thread to finish
        if let Some(handle) = self.thread_handle.take() {
            match handle.join() {
                Ok(_) => {
                    println!("Singularity agent thread joined successfully");
                }
                Err(e) => {
                    println!("Error joining Singularity agent thread: {:?}", e);
                }
            }
        }
        
        // Shutdown components
        {
            let mut strategy = self.strategy.lock().unwrap();
            strategy.shutdown()?;
        }
        
        {
            let mut scanner = self.scanner.lock().unwrap();
            scanner.shutdown()?;
        }
        
        {
            let mut executor = self.executor.lock().unwrap();
            executor.shutdown()?;
        }
        
        {
            let mut validator = self.validator.lock().unwrap();
            validator.shutdown()?;
        }
        
        self.config.active = false;
        
        println!("Singularity agent stopped");
        
        Ok(())
    }
    
    /// Get agent status
    pub fn get_status(&self) -> AgentStatus {
        self.status.lock().unwrap().clone()
    }
    
    /// Get current opportunities
    pub fn get_opportunities(&self) -> Vec<CrossChainOpportunity> {
        self.opportunities.lock().unwrap().clone()
    }
    
    /// Get recent executions
    pub fn get_executions(&self) -> Vec<ExecutionResult> {
        self.executions.lock().unwrap().clone()
    }
    
    /// Get agent configuration
    pub fn get_config(&self) -> SingularityConfig {
        self.config.clone()
    }
    
    /// Update agent configuration
    pub fn update_config(&mut self, config: SingularityConfig) -> Result<(), String> {
        // Check if running
        {
            let status = self.status.lock().unwrap();
            if *status != AgentStatus::Stopped {
                return Err("Cannot update configuration while agent is running".to_string());
            }
        }
        
        self.config = config;
        
        Ok(())
    }
    
    /// Get agent metrics
    pub fn get_metrics(&self) -> HashMap<String, f64> {
        let mut metrics = HashMap::new();
        
        // Add strategy metrics
        if let Ok(strategy) = self.strategy.lock() {
            for (key, value) in strategy.get_metrics() {
                metrics.insert(format!("strategy_{}", key), value);
            }
        }
        
        // Add execution metrics
        if let Ok(executions) = self.executions.lock() {
            let total_executions = executions.len();
            metrics.insert("total_executions".to_string(), total_executions as f64);
            
            let successful_executions = executions.iter().filter(|e| e.success).count();
            metrics.insert("successful_executions".to_string(), successful_executions as f64);
            
            if total_executions > 0 {
                let success_rate = (successful_executions as f64) / (total_executions as f64) * 100.0;
                metrics.insert("success_rate".to_string(), success_rate);
            }
            
            let total_profit: f64 = executions.iter().filter(|e| e.success).map(|e| e.profit).sum();
            metrics.insert("total_profit".to_string(), total_profit);
            
            if !executions.is_empty() {
                if let Some(latest) = executions.first() {
                    metrics.insert("latest_execution_timestamp".to_string(), latest.timestamp as f64);
                    
                    if latest.success {
                        metrics.insert("latest_execution_profit".to_string(), latest.profit);
                        metrics.insert("latest_execution_profit_pct".to_string(), latest.profit_pct);
                    }
                }
            }
        }
        
        metrics
    }
}