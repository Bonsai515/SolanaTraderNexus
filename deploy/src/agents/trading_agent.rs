use crate::models::{
    MarketData, TradingSignal, SignalType, RiskLevel, 
    Transaction, TransactionType, TransactionStatus
};
use crate::transformers::{MarketDataTransformer, TradingSignalTransformer};
use crate::storage::Storage;
use crate::solana::{WalletManager, TransactionManager};
use anyhow::{Result, Context};
use log::{info, error, warn, debug};
use std::sync::{Arc, Mutex};
use tokio::time::{interval, Duration};
use tokio::task::JoinHandle;
use uuid::Uuid;
use chrono::Utc;

/// Trading Agent that uses transformers to identify trading opportunities
pub struct TradingAgent {
    market_data_transformer: Arc<MarketDataTransformer>,
    trading_signal_transformer: Arc<TradingSignalTransformer>,
    storage: Arc<Storage>,
    wallet_manager: Arc<WalletManager>,
    transaction_manager: Arc<TransactionManager>,
    is_running: Arc<Mutex<bool>>,
    scan_interval: Arc<Mutex<Duration>>,
    risk_level: Arc<Mutex<RiskLevel>>,
    scan_task: Mutex<Option<JoinHandle<()>>>,
}

impl TradingAgent {
    /// Create a new trading agent
    pub fn new(
        market_data_transformer: Arc<MarketDataTransformer>,
        trading_signal_transformer: Arc<TradingSignalTransformer>,
        storage: Arc<Storage>,
        wallet_manager: Arc<WalletManager>,
        transaction_manager: Arc<TransactionManager>,
    ) -> Self {
        info!("Trading Agent initialized");
        
        Self {
            market_data_transformer,
            trading_signal_transformer,
            storage,
            wallet_manager,
            transaction_manager,
            is_running: Arc::new(Mutex::new(false)),
            scan_interval: Arc::new(Mutex::new(Duration::from_secs(60))), // 1 minute default
            risk_level: Arc::new(Mutex::new(RiskLevel::Medium)),
            scan_task: Mutex::new(None),
        }
    }
    
    /// Start the trading agent
    pub fn start(&self) -> Result<()> {
        let mut is_running = self.is_running.lock().unwrap();
        
        if *is_running {
            warn!("Trading Agent is already running");
            return Ok(());
        }
        
        // Set running state to true
        *is_running = true;
        
        // Get current scan interval
        let interval_duration = *self.scan_interval.lock().unwrap();
        let risk_level = *self.risk_level.lock().unwrap();
        
        // Clone Arc references for the task
        let market_data_transformer = self.market_data_transformer.clone();
        let trading_signal_transformer = self.trading_signal_transformer.clone();
        let storage = self.storage.clone();
        let wallet_manager = self.wallet_manager.clone();
        let transaction_manager = self.transaction_manager.clone();
        let is_running = self.is_running.clone();
        let risk_level_arc = self.risk_level.clone();
        
        // Start background task
        let task = tokio::spawn(async move {
            info!("Trading Agent started with scan interval: {:?} and risk level: {:?}", 
                interval_duration, risk_level);
                
            let mut interval_timer = interval(interval_duration);
            
            // Run until stopped
            while *is_running.lock().unwrap() {
                interval_timer.tick().await;
                
                // Skip if flag was turned off while waiting
                if !*is_running.lock().unwrap() {
                    break;
                }
                
                // Get current risk level
                let current_risk = *risk_level_arc.lock().unwrap();
                
                // Scan for opportunities
                if let Err(e) = scan_for_opportunities(
                    &market_data_transformer, 
                    &trading_signal_transformer, 
                    &storage,
                    &wallet_manager,
                    &transaction_manager,
                    current_risk
                ).await {
                    error!("Error scanning for opportunities: {}", e);
                }
            }
            
            info!("Trading Agent stopped");
        });
        
        // Store task handle
        let mut scan_task = self.scan_task.lock().unwrap();
        *scan_task = Some(task);
        
        Ok(())
    }
    
    /// Stop the trading agent
    pub fn stop(&self) -> Result<()> {
        let mut is_running = self.is_running.lock().unwrap();
        
        if !*is_running {
            warn!("Trading Agent is already stopped");
            return Ok(());
        }
        
        // Set running state to false
        *is_running = false;
        
        // Abort task if it's running
        let mut scan_task = self.scan_task.lock().unwrap();
        if let Some(task) = scan_task.take() {
            task.abort();
            info!("Trading Agent scan task aborted");
        }
        
        Ok(())
    }
    
    /// Set the scan interval
    pub fn set_scan_interval(&self, milliseconds: u64) -> Result<()> {
        let mut scan_interval = self.scan_interval.lock().unwrap();
        *scan_interval = Duration::from_millis(milliseconds);
        
        info!("Trading Agent scan interval set to {}ms", milliseconds);
        Ok(())
    }
    
    /// Set the risk level
    pub fn set_risk_level(&self, level: RiskLevel) -> Result<()> {
        let mut risk_level = self.risk_level.lock().unwrap();
        *risk_level = level;
        
        info!("Trading Agent risk level set to {:?}", level);
        Ok(())
    }
    
    /// Get current status
    pub fn get_status(&self) -> Result<TradingAgentStatus> {
        let is_running = *self.is_running.lock().unwrap();
        let scan_interval = *self.scan_interval.lock().unwrap();
        let risk_level = *self.risk_level.lock().unwrap();
        
        Ok(TradingAgentStatus {
            running: is_running,
            scan_interval: scan_interval.as_millis() as u64,
            risk_level,
        })
    }
}

/// Status information for the trading agent
#[derive(Debug, Clone, Copy)]
pub struct TradingAgentStatus {
    pub running: bool,
    pub scan_interval: u64, // milliseconds
    pub risk_level: RiskLevel,
}

/// Core function to scan for trading opportunities
async fn scan_for_opportunities(
    market_data_transformer: &MarketDataTransformer,
    trading_signal_transformer: &TradingSignalTransformer,
    storage: &Storage,
    wallet_manager: &WalletManager,
    transaction_manager: &TransactionManager,
    risk_level: RiskLevel,
) -> Result<()> {
    info!("Scanning for trading opportunities with risk level: {:?}", risk_level);
    
    // Get market data
    let market_data = market_data_transformer.fetch_and_transform().await?;
    
    // Generate trading signals
    let signals = trading_signal_transformer.generate_signals(market_data, risk_level);
    
    if signals.is_empty() {
        info!("No trading signals generated in this scan");
        return Ok(());
    }
    
    info!("Generated {} trading signals", signals.len());
    
    // Get strategies for execution
    let strategies = storage.get_active_strategies().await?;
    
    if strategies.is_empty() {
        warn!("No active strategies available to execute trades");
        return Ok(());
    }
    
    // Execute high-confidence trades
    for signal in signals {
        // Only proceed with high-confidence signals
        let confidence_threshold = get_confidence_threshold(risk_level);
        if signal.confidence < confidence_threshold {
            debug!("Signal for {} skipped due to low confidence: {}", 
                signal.asset, signal.confidence);
            continue;
        }
        
        info!("Processing high-confidence signal for {}: confidence {}, type {:?}", 
            signal.asset, signal.confidence, signal.signal_type);
            
        // For each strategy, attempt to execute the trade
        for strategy in &strategies {
            // In a real application, would check if this strategy is suitable for this signal
            // For simplicity, we'll execute all strategies
            
            // Get a wallet for this strategy
            let wallets = storage.get_wallet_by_address(&strategy.id.to_string()).await?;
            
            if wallets.is_none() {
                warn!("No wallet found for strategy {}", strategy.name);
                continue;
            }
            
            let wallet = wallets.unwrap();
            
            // Transaction amount based on confidence and risk level
            let transaction_amount = calculate_transaction_amount(
                signal.confidence, risk_level, wallet.balance);
                
            // Execute the transaction
            let transaction_type = match signal.signal_type {
                SignalType::Buy => TransactionType::Buy,
                SignalType::Sell => TransactionType::Sell,
            };
            
            match transaction_manager.execute_transaction(
                wallet.id,
                Some(strategy.id),
                transaction_type,
                transaction_amount,
            ).await {
                Ok(transaction) => {
                    info!("Executed {:?} transaction for strategy {} with amount {}", 
                        transaction_type, strategy.name, transaction_amount);
                },
                Err(e) => {
                    error!("Failed to execute transaction for strategy {}: {}", 
                        strategy.name, e);
                }
            }
        }
    }
    
    Ok(())
}

/// Get confidence threshold based on risk level
fn get_confidence_threshold(risk_level: RiskLevel) -> f64 {
    match risk_level {
        RiskLevel::Low => 0.8,
        RiskLevel::Medium => 0.65,
        RiskLevel::High => 0.5,
    }
}

/// Calculate transaction amount based on confidence, risk level, and available balance
fn calculate_transaction_amount(confidence: f64, risk_level: RiskLevel, available_balance: f64) -> f64 {
    let base_percentage = match risk_level {
        RiskLevel::Low => 0.05, // 5% of balance
        RiskLevel::Medium => 0.10, // 10% of balance
        RiskLevel::High => 0.20, // 20% of balance
    };
    
    // Adjust based on confidence
    let adjusted_percentage = base_percentage * confidence;
    
    // Calculate amount
    let amount = available_balance * adjusted_percentage;
    
    // Ensure amount is reasonable
    amount.max(0.01).min(available_balance * 0.5) // Min 0.01, max 50% of balance
}