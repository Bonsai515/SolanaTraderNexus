//! Singularity Cross-Chain Oracle Agent
//!
//! This module implements the Singularity agent for cross-chain arbitrage,
//! which coordinates the strategy, scanner, executor, and validator components.

pub mod strategy;
pub mod scanner;
pub mod executor;
pub mod validator;

use std::collections::HashMap;
use std::error::Error;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use crate::utils::current_timestamp;

// Re-exports
pub use strategy::{
    Strategy, StrategyConfig, CrossChainOpportunity, Chain, PathStep,
    create_strategy, start_strategy, stop_strategy, scan_opportunities, get_current_opportunities,
};
pub use scanner::{
    Scanner, ScannerConfig, TokenPrice,
    create_scanner, start_scanner, stop_scanner, run_scan,
};
pub use executor::{
    Executor, ExecutorConfig, Transaction, TransactionStatus, TransactionStep, AtomicTransactionBatch,
    create_executor, start_executor, stop_executor, execute_opportunity,
};
pub use validator::{
    Validator, ValidatorConfig, ValidationResult, RiskLevel, PriceVerificationResult,
    create_validator, start_validator, stop_validator, validate_opportunity,
};

// Singularity agent configuration
#[derive(Debug, Clone)]
pub struct SingularityConfig {
    pub id: String,
    pub name: String,
    pub scan_interval: Duration,
    pub max_concurrent_executions: usize,
    pub max_input_amount: f64,
    pub min_profit_percentage: f64,
    pub gas_price_multiplier: f64,
    pub enable_flash_loans: bool,
    pub enable_atomic_transactions: bool,
    pub trading_wallet: String,
    pub profit_wallet: String,
    pub fee_wallet: String,
    pub strategy_config: StrategyConfig,
    pub scanner_config: ScannerConfig,
    pub executor_config: ExecutorConfig,
    pub validator_config: ValidatorConfig,
}

impl Default for SingularityConfig {
    fn default() -> Self {
        Self {
            id: "singularity".to_string(),
            name: "Singularity Cross-Chain Oracle".to_string(),
            scan_interval: Duration::from_secs(10),
            max_concurrent_executions: 5,
            max_input_amount: 1000.0,
            min_profit_percentage: 0.5,
            gas_price_multiplier: 1.2,
            enable_flash_loans: true,
            enable_atomic_transactions: true,
            trading_wallet: "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb".to_string(),
            profit_wallet: "6bLfHsp6eCFWZqGKZQaRwpVVLZRwKqcLt6QCKwLoxTqF".to_string(),
            fee_wallet: "9aBt1zPRUZmxttZ6Mk9AAU6XGS1TLQMZkpbCNBLH2Y2z".to_string(),
            strategy_config: StrategyConfig::default(),
            scanner_config: ScannerConfig::default(),
            executor_config: ExecutorConfig::default(),
            validator_config: ValidatorConfig::default(),
        }
    }
}

// Singularity agent status
#[derive(Debug, Clone, PartialEq)]
pub enum AgentStatus {
    Idle,
    Initializing,
    Scanning,
    Executing,
    Error(String),
}

// Agent metrics
#[derive(Debug, Clone)]
pub struct AgentMetrics {
    pub opportunities_found: usize,
    pub opportunities_executed: usize,
    pub successful_executions: usize,
    pub failed_executions: usize,
    pub total_profit: f64,
    pub total_gas_spent: f64,
    pub last_scan: Option<u64>,
    pub last_execution: Option<u64>,
    pub average_profit_per_execution: f64,
    pub success_rate: f64,
}

// Singularity agent
pub struct SingularityAgent {
    config: SingularityConfig,
    strategy: Arc<Mutex<Strategy>>,
    scanner: Arc<Mutex<Scanner>>,
    executor: Arc<Mutex<Executor>>,
    validator: Arc<Mutex<Validator>>,
    opportunities: Arc<Mutex<HashMap<String, CrossChainOpportunity>>>,
    executed_opportunities: Arc<Mutex<HashMap<String, (CrossChainOpportunity, Transaction)>>>,
    status: Arc<Mutex<AgentStatus>>,
    metrics: Arc<Mutex<AgentMetrics>>,
    active: bool,
    last_scan: Arc<Mutex<Option<Instant>>>,
}

impl SingularityAgent {
    pub fn new(config: SingularityConfig) -> Self {
        let strategy = Arc::new(Mutex::new(Strategy::new(config.strategy_config.clone())));
        let scanner = Arc::new(Mutex::new(Scanner::new(config.scanner_config.clone())));
        let executor = Arc::new(Mutex::new(Executor::new(config.executor_config.clone())));
        let validator = Arc::new(Mutex::new(Validator::new(config.validator_config.clone())));
        
        Self {
            config,
            strategy,
            scanner,
            executor,
            validator,
            opportunities: Arc::new(Mutex::new(HashMap::new())),
            executed_opportunities: Arc::new(Mutex::new(HashMap::new())),
            status: Arc::new(Mutex::new(AgentStatus::Idle)),
            metrics: Arc::new(Mutex::new(AgentMetrics {
                opportunities_found: 0,
                opportunities_executed: 0,
                successful_executions: 0,
                failed_executions: 0,
                total_profit: 0.0,
                total_gas_spent: 0.0,
                last_scan: None,
                last_execution: None,
                average_profit_per_execution: 0.0,
                success_rate: 0.0,
            })),
            active: false,
            last_scan: Arc::new(Mutex::new(None)),
        }
    }
    
    pub fn start(&mut self) -> Result<(), Box<dyn Error>> {
        println!("Starting Singularity Cross-Chain Oracle agent...");
        
        // Set status to initializing
        let mut status = self.status.lock().unwrap();
        *status = AgentStatus::Initializing;
        drop(status);
        
        // Start all components
        self.strategy.lock().unwrap().start()?;
        self.scanner.lock().unwrap().start()?;
        self.executor.lock().unwrap().start()?;
        self.validator.lock().unwrap().start()?;
        
        // Set agent as active
        self.active = true;
        
        // Set status to idle
        let mut status = self.status.lock().unwrap();
        *status = AgentStatus::Idle;
        
        println!("Singularity Cross-Chain Oracle agent started successfully!");
        
        Ok(())
    }
    
    pub fn stop(&mut self) -> Result<(), Box<dyn Error>> {
        println!("Stopping Singularity Cross-Chain Oracle agent...");
        
        // Set agent as inactive
        self.active = false;
        
        // Stop all components
        self.strategy.lock().unwrap().stop()?;
        self.scanner.lock().unwrap().stop()?;
        self.executor.lock().unwrap().stop()?;
        self.validator.lock().unwrap().stop()?;
        
        // Set status to idle
        let mut status = self.status.lock().unwrap();
        *status = AgentStatus::Idle;
        
        println!("Singularity Cross-Chain Oracle agent stopped successfully!");
        
        Ok(())
    }
    
    pub fn is_active(&self) -> bool {
        self.active
    }
    
    pub fn get_status(&self) -> AgentStatus {
        self.status.lock().unwrap().clone()
    }
    
    pub fn get_metrics(&self) -> AgentMetrics {
        self.metrics.lock().unwrap().clone()
    }
    
    pub fn scan(&mut self) -> Result<Vec<CrossChainOpportunity>, Box<dyn Error>> {
        if !self.active {
            return Err(Box::new(std::io::Error::new(
                std::io::ErrorKind::Other,
                "Agent is not active",
            )));
        }
        
        // Set status to scanning
        let mut status = self.status.lock().unwrap();
        *status = AgentStatus::Scanning;
        drop(status);
        
        // Set last scan time
        let mut last_scan = self.last_scan.lock().unwrap();
        *last_scan = Some(Instant::now());
        drop(last_scan);
        
        // Update metrics
        let mut metrics = self.metrics.lock().unwrap();
        metrics.last_scan = Some(current_timestamp());
        drop(metrics);
        
        println!("Scanning for cross-chain arbitrage opportunities...");
        
        // Run scanner
        let opportunities = self.scanner.lock().unwrap().scan()?;
        
        // Update opportunities
        let mut opportunities_map = self.opportunities.lock().unwrap();
        for opportunity in &opportunities {
            opportunities_map.insert(opportunity.id.clone(), opportunity.clone());
        }
        
        // Set status back to idle
        let mut status = self.status.lock().unwrap();
        *status = AgentStatus::Idle;
        
        // Update metrics
        let mut metrics = self.metrics.lock().unwrap();
        metrics.opportunities_found += opportunities.len();
        
        println!("Found {} cross-chain arbitrage opportunities", opportunities.len());
        
        Ok(opportunities)
    }
    
    pub fn execute(&mut self, opportunity_id: &str) -> Result<String, Box<dyn Error>> {
        if !self.active {
            return Err(Box::new(std::io::Error::new(
                std::io::ErrorKind::Other,
                "Agent is not active",
            )));
        }
        
        // Set status to executing
        let mut status = self.status.lock().unwrap();
        *status = AgentStatus::Executing;
        drop(status);
        
        // Get the opportunity
        let opportunities = self.opportunities.lock().unwrap();
        let opportunity = match opportunities.get(opportunity_id) {
            Some(opp) => opp.clone(),
            None => {
                // Set status back to idle
                let mut status = self.status.lock().unwrap();
                *status = AgentStatus::Idle;
                
                return Err(Box::new(std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    format!("Opportunity {} not found", opportunity_id),
                )));
            }
        };
        drop(opportunities);
        
        // Validate the opportunity
        let validation_result = self.validator.lock().unwrap().validate_opportunity(&opportunity)?;
        
        if !validation_result.valid {
            // Set status back to idle
            let mut status = self.status.lock().unwrap();
            *status = AgentStatus::Idle;
            
            return Err(Box::new(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("Opportunity {} failed validation: {:?}", opportunity_id, validation_result.reasons),
            )));
        }
        
        // Execute the opportunity
        let transaction_id = self.executor.lock().unwrap().execute_opportunity(&opportunity)?;
        
        // Get the executed transaction
        let transaction = self.executor.lock().unwrap().get_transaction(&transaction_id)
            .ok_or_else(|| {
                Box::new(std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    format!("Transaction {} not found", transaction_id),
                )) as Box<dyn Error>
            })?;
        
        // Add to executed opportunities
        let mut executed_opportunities = self.executed_opportunities.lock().unwrap();
        executed_opportunities.insert(opportunity_id.to_string(), (opportunity.clone(), transaction.clone()));
        
        // Update metrics
        let mut metrics = self.metrics.lock().unwrap();
        metrics.opportunities_executed += 1;
        metrics.last_execution = Some(current_timestamp());
        
        if transaction.status == TransactionStatus::Confirmed {
            metrics.successful_executions += 1;
            if let Some(profit) = transaction.actual_profit {
                metrics.total_profit += profit;
            }
            if let Some(gas) = transaction.gas_used {
                metrics.total_gas_spent += gas;
            }
        } else {
            metrics.failed_executions += 1;
        }
        
        // Calculate average profit and success rate
        if metrics.opportunities_executed > 0 {
            metrics.average_profit_per_execution = metrics.total_profit / metrics.successful_executions as f64;
            metrics.success_rate = metrics.successful_executions as f64 / metrics.opportunities_executed as f64 * 100.0;
        }
        
        // Set status back to idle
        let mut status = self.status.lock().unwrap();
        *status = AgentStatus::Idle;
        
        println!("Executed opportunity {} with transaction {}", opportunity_id, transaction_id);
        
        Ok(transaction_id)
    }
    
    pub fn get_opportunities(&self) -> HashMap<String, CrossChainOpportunity> {
        self.opportunities.lock().unwrap().clone()
    }
    
    pub fn get_executed_opportunities(&self) -> HashMap<String, (CrossChainOpportunity, Transaction)> {
        self.executed_opportunities.lock().unwrap().clone()
    }
    
    pub fn get_opportunity(&self, opportunity_id: &str) -> Option<CrossChainOpportunity> {
        self.opportunities.lock().unwrap().get(opportunity_id).cloned()
    }
    
    pub fn get_transaction(&self, transaction_id: &str) -> Option<Transaction> {
        self.executor.lock().unwrap().get_transaction(transaction_id)
    }
    
    pub fn execute_atomic_batch(&mut self, opportunity_ids: &[String]) -> Result<String, Box<dyn Error>> {
        if !self.active {
            return Err(Box::new(std::io::Error::new(
                std::io::ErrorKind::Other,
                "Agent is not active",
            )));
        }
        
        if !self.config.enable_atomic_transactions {
            return Err(Box::new(std::io::Error::new(
                std::io::ErrorKind::Other,
                "Atomic transactions are not enabled",
            )));
        }
        
        // Set status to executing
        let mut status = self.status.lock().unwrap();
        *status = AgentStatus::Executing;
        drop(status);
        
        // Get the opportunities
        let opportunities = self.opportunities.lock().unwrap();
        let mut batch_opportunities = Vec::new();
        
        for id in opportunity_ids {
            match opportunities.get(id) {
                Some(opp) => batch_opportunities.push(opp.clone()),
                None => {
                    // Set status back to idle
                    let mut status = self.status.lock().unwrap();
                    *status = AgentStatus::Idle;
                    
                    return Err(Box::new(std::io::Error::new(
                        std::io::ErrorKind::NotFound,
                        format!("Opportunity {} not found", id),
                    )));
                }
            }
        }
        
        // Validate the opportunities
        let mut valid_opportunities = Vec::new();
        
        for opportunity in &batch_opportunities {
            match self.validator.lock().unwrap().validate_opportunity(opportunity) {
                Ok(result) => {
                    if result.valid {
                        valid_opportunities.push(opportunity.clone());
                    } else {
                        println!("Opportunity {} failed validation: {:?}", opportunity.id, result.reasons);
                    }
                }
                Err(e) => {
                    println!("Failed to validate opportunity {}: {}", opportunity.id, e);
                }
            }
        }
        
        if valid_opportunities.is_empty() {
            // Set status back to idle
            let mut status = self.status.lock().unwrap();
            *status = AgentStatus::Idle;
            
            return Err(Box::new(std::io::Error::new(
                std::io::ErrorKind::Other,
                "No valid opportunities in batch",
            )));
        }
        
        // Create atomic batch
        let batch_id = self.executor.lock().unwrap().create_atomic_transaction_batch(&valid_opportunities)?;
        
        // Execute atomic batch
        self.executor.lock().unwrap().execute_atomic_batch(&batch_id)?;
        
        // Update metrics (would need to get batch result from executor in a real implementation)
        
        // Set status back to idle
        let mut status = self.status.lock().unwrap();
        *status = AgentStatus::Idle;
        
        println!("Executed atomic batch {} with {} opportunities", batch_id, valid_opportunities.len());
        
        Ok(batch_id)
    }
    
    pub fn execute_flash_loan_arbitrage(&mut self, opportunity_id: &str) -> Result<String, Box<dyn Error>> {
        if !self.active {
            return Err(Box::new(std::io::Error::new(
                std::io::ErrorKind::Other,
                "Agent is not active",
            )));
        }
        
        if !self.config.enable_flash_loans {
            return Err(Box::new(std::io::Error::new(
                std::io::ErrorKind::Other,
                "Flash loans are not enabled",
            )));
        }
        
        // Set status to executing
        let mut status = self.status.lock().unwrap();
        *status = AgentStatus::Executing;
        drop(status);
        
        // Get the opportunity
        let opportunities = self.opportunities.lock().unwrap();
        let opportunity = match opportunities.get(opportunity_id) {
            Some(opp) => opp.clone(),
            None => {
                // Set status back to idle
                let mut status = self.status.lock().unwrap();
                *status = AgentStatus::Idle;
                
                return Err(Box::new(std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    format!("Opportunity {} not found", opportunity_id),
                )));
            }
        };
        drop(opportunities);
        
        // Validate the opportunity
        let validation_result = self.validator.lock().unwrap().validate_opportunity(&opportunity)?;
        
        if !validation_result.valid {
            // Set status back to idle
            let mut status = self.status.lock().unwrap();
            *status = AgentStatus::Idle;
            
            return Err(Box::new(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("Opportunity {} failed validation: {:?}", opportunity_id, validation_result.reasons),
            )));
        }
        
        // Execute the flash loan arbitrage
        let transaction_id = self.executor.lock().unwrap().execute_flash_loan_arbitrage(&opportunity)?;
        
        // Update metrics (similar to regular execute)
        
        // Set status back to idle
        let mut status = self.status.lock().unwrap();
        *status = AgentStatus::Idle;
        
        println!("Executed flash loan arbitrage for opportunity {} with transaction {}", opportunity_id, transaction_id);
        
        Ok(transaction_id)
    }
}

// External API for the Singularity agent
pub fn create_singularity_agent() -> SingularityAgent {
    SingularityAgent::new(SingularityConfig::default())
}

pub fn start_singularity_agent(agent: &mut SingularityAgent) -> Result<(), Box<dyn Error>> {
    agent.start()
}

pub fn stop_singularity_agent(agent: &mut SingularityAgent) -> Result<(), Box<dyn Error>> {
    agent.stop()
}

pub fn scan_for_opportunities(agent: &mut SingularityAgent) -> Result<Vec<CrossChainOpportunity>, Box<dyn Error>> {
    agent.scan()
}

pub fn execute_opportunity(agent: &mut SingularityAgent, opportunity_id: &str) -> Result<String, Box<dyn Error>> {
    agent.execute(opportunity_id)
}