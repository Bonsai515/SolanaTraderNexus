//! Singularity Cross-Chain Oracle
//!
//! The Singularity agent specializes in cross-chain arbitrage using Wormhole
//! and other bridges to identify and execute profitable trading opportunities
//! across multiple blockchains.

pub mod strategy;
pub mod scanner;
pub mod executor;
pub mod validator;

use std::collections::HashMap;
use std::sync::{Arc, Mutex, RwLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

/// Singularity agent configuration
#[derive(Debug, Clone)]
pub struct SingularityConfig {
    /// ID of the agent instance
    pub id: String,
    
    /// Operation mode
    pub mode: OperationMode,
    
    /// Use system wallet
    pub use_system_wallet: bool,
    
    /// Minimum profit percentage
    pub min_profit_pct: f64,
    
    /// Maximum input amount
    pub max_input: f64,
    
    /// Trading wallet address
    pub trading_wallet: String,
    
    /// Profit wallet address
    pub profit_wallet: String,
    
    /// Fee wallet address
    pub fee_wallet: String,
}

/// Singularity operation mode
#[derive(Debug, Clone, PartialEq)]
pub enum OperationMode {
    /// Scan only, no trades
    ScanOnly,
    
    /// Dry run (simulate trades)
    DryRun,
    
    /// Live trading with real funds
    LiveTrading,
}

impl std::fmt::Display for OperationMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            OperationMode::ScanOnly => write!(f, "scan_only"),
            OperationMode::DryRun => write!(f, "dry_run"),
            OperationMode::LiveTrading => write!(f, "live_trading"),
        }
    }
}

impl From<&str> for OperationMode {
    fn from(s: &str) -> Self {
        match s {
            "scan_only" => OperationMode::ScanOnly,
            "live_trading" => OperationMode::LiveTrading,
            _ => OperationMode::DryRun,
        }
    }
}

/// Chain type
#[derive(Debug, Clone, PartialEq)]
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
    
    /// Base
    Base,
}

impl std::fmt::Display for ChainType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ChainType::Solana => write!(f, "solana"),
            ChainType::Ethereum => write!(f, "ethereum"),
            ChainType::BSC => write!(f, "bsc"),
            ChainType::Polygon => write!(f, "polygon"),
            ChainType::Avalanche => write!(f, "avalanche"),
            ChainType::Arbitrum => write!(f, "arbitrum"),
            ChainType::Optimism => write!(f, "optimism"),
            ChainType::Base => write!(f, "base"),
        }
    }
}

/// Cross-chain opportunity
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
    
    /// Input amount
    pub input_amount: f64,
    
    /// Output amount
    pub output_amount: f64,
    
    /// Expected profit
    pub expected_profit: f64,
    
    /// Profit percentage
    pub profit_pct: f64,
    
    /// Total fees
    pub total_fees: f64,
    
    /// Source DEX
    pub source_dex: String,
    
    /// Target DEX
    pub target_dex: String,
    
    /// Bridge
    pub bridge: String,
    
    /// Detected timestamp
    pub detected_at: u64,
    
    /// Expires at
    pub expires_at: u64,
    
    /// Is validated
    pub is_validated: bool,
    
    /// Additional metadata
    pub metadata: HashMap<String, String>,
}

/// Singularity agent state
#[derive(Debug, Clone)]
pub struct SingularityState {
    /// Configuration
    pub config: SingularityConfig,
    
    /// Is running
    pub is_running: bool,
    
    /// Start time
    pub start_time: Option<u64>,
    
    /// Last scan time
    pub last_scan_time: Option<u64>,
    
    /// Number of scans
    pub scan_count: u64,
    
    /// Number of opportunities detected
    pub opportunity_count: u64,
    
    /// Number of executions
    pub execution_count: u64,
    
    /// Number of successful executions
    pub successful_executions: u64,
    
    /// Total profit
    pub total_profit: f64,
    
    /// Last error
    pub last_error: Option<String>,
    
    /// Current opportunities
    pub current_opportunities: Vec<CrossChainOpportunity>,
}

/// Singularity agent
pub struct Singularity {
    /// State
    state: RwLock<SingularityState>,
    
    /// Strategy
    strategy: Arc<Mutex<strategy::SingularityStrategy>>,
    
    /// Scanner
    scanner: Arc<Mutex<scanner::SingularityScanner>>,
    
    /// Executor
    executor: Arc<Mutex<executor::SingularityExecutor>>,
    
    /// Validator
    validator: Arc<Mutex<validator::SingularityValidator>>,
}

impl Singularity {
    /// Create a new Singularity agent
    pub fn new(config: SingularityConfig) -> Self {
        let state = SingularityState {
            config: config.clone(),
            is_running: false,
            start_time: None,
            last_scan_time: None,
            scan_count: 0,
            opportunity_count: 0,
            execution_count: 0,
            successful_executions: 0,
            total_profit: 0.0,
            last_error: None,
            current_opportunities: Vec::new(),
        };
        
        let strategy = Arc::new(Mutex::new(strategy::SingularityStrategy::new(config.clone())));
        let scanner = Arc::new(Mutex::new(scanner::SingularityScanner::new(config.clone())));
        let executor = Arc::new(Mutex::new(executor::SingularityExecutor::new(config.clone())));
        let validator = Arc::new(Mutex::new(validator::SingularityValidator::new(config.clone())));
        
        Self {
            state: RwLock::new(state),
            strategy,
            scanner,
            executor,
            validator,
        }
    }
    
    /// Get the current state
    pub fn get_state(&self) -> SingularityState {
        self.state.read().unwrap().clone()
    }
    
    /// Start the agent
    pub fn start(&self) -> Result<(), String> {
        let mut state = self.state.write().unwrap();
        
        if state.is_running {
            return Err("Singularity agent is already running".to_string());
        }
        
        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("Time went backwards")
            .as_secs();
        
        state.is_running = true;
        state.start_time = Some(current_time);
        state.last_scan_time = None;
        
        // Initialize the strategy
        self.strategy.lock().unwrap().initialize()?;
        
        // Initialize the scanner
        self.scanner.lock().unwrap().initialize()?;
        
        // Initialize the executor
        self.executor.lock().unwrap().initialize()?;
        
        // Initialize the validator
        self.validator.lock().unwrap().initialize()?;
        
        // Log that we've started
        println!("Singularity agent started in {} mode", state.config.mode);
        
        Ok(())
    }
    
    /// Stop the agent
    pub fn stop(&self) -> Result<(), String> {
        let mut state = self.state.write().unwrap();
        
        if !state.is_running {
            return Err("Singularity agent is not running".to_string());
        }
        
        state.is_running = false;
        
        // Clean up
        self.strategy.lock().unwrap().shutdown()?;
        self.scanner.lock().unwrap().shutdown()?;
        self.executor.lock().unwrap().shutdown()?;
        self.validator.lock().unwrap().shutdown()?;
        
        // Log that we've stopped
        println!("Singularity agent stopped");
        
        Ok(())
    }
    
    /// Scan for opportunities
    pub fn scan(&self) -> Result<Vec<CrossChainOpportunity>, String> {
        let mut state = self.state.write().unwrap();
        
        if !state.is_running {
            return Err("Singularity agent is not running".to_string());
        }
        
        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("Time went backwards")
            .as_secs();
        
        state.last_scan_time = Some(current_time);
        state.scan_count += 1;
        
        // Scan for opportunities
        let opportunities = self.scanner.lock().unwrap().scan()?;
        
        // Update opportunity count
        state.opportunity_count += opportunities.len() as u64;
        
        // Filter and validate opportunities
        let mut valid_opportunities = Vec::new();
        for opportunity in opportunities {
            // Validate the opportunity
            if self.validator.lock().unwrap().validate(&opportunity)? {
                valid_opportunities.push(opportunity);
            }
        }
        
        // Update current opportunities
        state.current_opportunities = valid_opportunities.clone();
        
        Ok(valid_opportunities)
    }
    
    /// Execute an opportunity
    pub fn execute(&self, opportunity: &CrossChainOpportunity) -> Result<f64, String> {
        let mut state = self.state.write().unwrap();
        
        if !state.is_running {
            return Err("Singularity agent is not running".to_string());
        }
        
        // Check operation mode
        match state.config.mode {
            OperationMode::ScanOnly => {
                return Err("Cannot execute in scan-only mode".to_string());
            }
            OperationMode::DryRun => {
                println!("Simulating execution of opportunity {}", opportunity.id);
                
                // In dry run mode, we just simulate the execution
                state.execution_count += 1;
                state.successful_executions += 1;
                state.total_profit += opportunity.expected_profit;
                
                println!("Simulated profit: {} USDC", opportunity.expected_profit);
                
                Ok(opportunity.expected_profit)
            }
            OperationMode::LiveTrading => {
                println!("Executing opportunity {}", opportunity.id);
                
                // In live trading mode, we actually execute the trade
                let profit = self.executor.lock().unwrap().execute(opportunity)?;
                
                state.execution_count += 1;
                state.successful_executions += 1;
                state.total_profit += profit;
                
                println!("Actual profit: {} USDC", profit);
                
                Ok(profit)
            }
        }
    }
    
    /// Run the agent in a loop
    pub fn run_loop(&self) -> Result<(), String> {
        self.start()?;
        
        // Continue until stopped
        while self.get_state().is_running {
            // Scan for opportunities
            let opportunities = self.scan()?;
            
            println!("Found {} cross-chain opportunities", opportunities.len());
            
            // Apply strategy to select the best opportunities
            let selected = self.strategy.lock().unwrap().select_opportunities(&opportunities)?;
            
            println!("Selected {} opportunities for execution", selected.len());
            
            // Execute each selected opportunity
            for opportunity in selected {
                match self.execute(&opportunity) {
                    Ok(profit) => {
                        println!("Successfully executed opportunity {} with profit: {} USDC", opportunity.id, profit);
                    }
                    Err(err) => {
                        println!("Failed to execute opportunity {}: {}", opportunity.id, err);
                        
                        // Update the error in the state
                        self.state.write().unwrap().last_error = Some(err);
                    }
                }
            }
            
            // Sleep for 10 seconds before the next scan
            std::thread::sleep(Duration::from_secs(10));
        }
        
        Ok(())
    }
}