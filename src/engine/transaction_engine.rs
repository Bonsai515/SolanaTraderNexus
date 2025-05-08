use crate::models::{
    Transaction, TransactionType, TransactionStatus, Strategy, StrategyType,
    TradingSignal, SignalType, RiskLevel
};
use crate::transformers::{
    MicroQHCTransformer, MEMECortexTransformer, CommunicationTransformer
};
use crate::solana::{WalletManager, TransactionManager};
use crate::storage::Storage;
use crate::security::SecurityProtocol;
use crate::communication::CommunicationCenter;
use anyhow::{Result, Context};
use log::{info, error, warn, debug};
use std::sync::{Arc, RwLock, Mutex};
use tokio::time::{interval, Duration};
use tokio::task::JoinHandle;
use chrono::Utc;
use uuid::Uuid;
use std::collections::HashMap;
use std::time::Instant;

/// Transaction Engine - Core component responsible for transaction processing and strategy execution
/// Positioned in the innermost layer of the system architecture
pub struct TransactionEngine {
    storage: Arc<Storage>,
    wallet_manager: Arc<WalletManager>,
    transaction_manager: Arc<TransactionManager>,
    security_protocol: Arc<SecurityProtocol>,
    communication_center: Arc<CommunicationCenter>,
    
    // Strategy management
    active_strategies: RwLock<HashMap<Uuid, Arc<Strategy>>>,
    
    // Engine state
    is_running: Arc<Mutex<bool>>,
    engine_task: Mutex<Option<JoinHandle<()>>>,
    scan_interval: Arc<Mutex<Duration>>,
    performance_metrics: RwLock<PerformanceMetrics>,
}

/// Performance metrics for the transaction engine
#[derive(Debug, Clone)]
pub struct PerformanceMetrics {
    pub transactions_processed: u64,
    pub successful_transactions: u64,
    pub failed_transactions: u64,
    pub total_profit: f64,
    pub transactions_per_minute: f64,
    pub last_updated: chrono::DateTime<Utc>,
}

impl TransactionEngine {
    /// Create a new transaction engine
    pub fn new(
        storage: Arc<Storage>,
        wallet_manager: Arc<WalletManager>,
        transaction_manager: Arc<TransactionManager>,
        security_protocol: Arc<SecurityProtocol>,
        communication_center: Arc<CommunicationCenter>,
    ) -> Self {
        info!("Initializing Solana Transaction Engine - Core System Component");
        
        Self {
            storage,
            wallet_manager,
            transaction_manager,
            security_protocol,
            communication_center,
            active_strategies: RwLock::new(HashMap::new()),
            is_running: Arc::new(Mutex::new(false)),
            engine_task: Mutex::new(None),
            scan_interval: Arc::new(Mutex::new(Duration::from_secs(30))),
            performance_metrics: RwLock::new(PerformanceMetrics {
                transactions_processed: 0,
                successful_transactions: 0,
                failed_transactions: 0,
                total_profit: 0.0,
                transactions_per_minute: 0.0,
                last_updated: Utc::now(),
            }),
        }
    }
    
    /// Initialize specialized transformers
    pub async fn initialize_transformers(&self) -> Result<(Arc<MicroQHCTransformer>, Arc<MEMECortexTransformer>, Arc<CommunicationTransformer>)> {
        info!("Initializing specialized transformers for Transaction Engine");
        
        // Create communication transformer
        let communication_transformer = Arc::new(CommunicationTransformer::new(
            self.communication_center.clone()
        ));
        
        // Create specialized transformers
        let micro_qhc = Arc::new(MicroQHCTransformer::new());
        let meme_cortex = Arc::new(MEMECortexTransformer::new());
        
        // Start communication transformer
        communication_transformer.start().await?;
        
        // Register transformers with security protocol
        self.security_protocol.register_secure_component("MicroQHCTransformer")?;
        self.security_protocol.register_secure_component("MEMECortexTransformer")?;
        self.security_protocol.register_secure_component("CommunicationTransformer")?;
        
        info!("Specialized transformers initialized successfully");
        
        Ok((micro_qhc, meme_cortex, communication_transformer))
    }
    
    /// Start the transaction engine
    pub fn start(&self) -> Result<()> {
        let mut is_running = self.is_running.lock().unwrap();
        
        if *is_running {
            warn!("Transaction Engine is already running");
            return Ok(());
        }
        
        // Security check before starting
        self.security_protocol.verify_component_integrity("TransactionEngine")?;
        
        // Initialize transformers
        tokio::runtime::Handle::current().block_on(async {
            let _ = self.initialize_transformers().await?;
            Ok::<_, anyhow::Error>(())
        })?;
        
        // Set running state to true
        *is_running = true;
        
        // Get interval time
        let interval_duration = *self.scan_interval.lock().unwrap();
        
        // Clone references for the task
        let storage = self.storage.clone();
        let wallet_manager = self.wallet_manager.clone();
        let transaction_manager = self.transaction_manager.clone();
        let security_protocol = self.security_protocol.clone();
        let communication_center = self.communication_center.clone();
        let is_running = self.is_running.clone();
        let performance_metrics = Arc::new(self.performance_metrics.clone());
        
        // Start the engine task
        let task = tokio::spawn(async move {
            info!("Transaction Engine started with scan interval: {:?}", interval_duration);
            
            let mut interval_timer = interval(interval_duration);
            let start_time = Instant::now();
            let mut transactions_count = 0;
            
            // Main engine loop
            while *is_running.lock().unwrap() {
                interval_timer.tick().await;
                
                // Stop if flag was turned off while waiting
                if !*is_running.lock().unwrap() {
                    break;
                }
                
                // Process pending signals from communication center
                if let Err(e) = process_signals(
                    &storage,
                    &wallet_manager,
                    &transaction_manager,
                    &security_protocol,
                    &communication_center,
                ).await {
                    error!("Error processing signals: {}", e);
                }
                
                // Update performance metrics
                transactions_count += 1;
                let elapsed = start_time.elapsed();
                if elapsed.as_secs() >= 60 {
                    // Update transactions per minute
                    let minutes = elapsed.as_secs() as f64 / 60.0;
                    let tpm = transactions_count as f64 / minutes;
                    
                    let mut metrics = performance_metrics.write().unwrap();
                    metrics.transactions_per_minute = tpm;
                    metrics.last_updated = Utc::now();
                }
            }
            
            info!("Transaction Engine stopped");
        });
        
        // Store task handle
        let mut engine_task = self.engine_task.lock().unwrap();
        *engine_task = Some(task);
        
        // Register as active component in communications
        self.communication_center.register_active_component("TransactionEngine")?;
        
        Ok(())
    }
    
    /// Stop the transaction engine
    pub fn stop(&self) -> Result<()> {
        let mut is_running = self.is_running.lock().unwrap();
        
        if !*is_running {
            warn!("Transaction Engine is already stopped");
            return Ok(());
        }
        
        // Security check before stopping
        self.security_protocol.verify_component_integrity("TransactionEngine")?;
        
        // Set running state to false
        *is_running = false;
        
        // Abort task if it's running
        let mut engine_task = self.engine_task.lock().unwrap();
        if let Some(task) = engine_task.take() {
            task.abort();
            info!("Transaction Engine task aborted");
        }
        
        // Unregister from communications
        self.communication_center.unregister_component("TransactionEngine")?;
        
        Ok(())
    }
    
    /// Register a strategy with the engine
    pub fn register_strategy(&self, strategy: Arc<Strategy>) -> Result<()> {
        // Security check before registering
        self.security_protocol.verify_strategy_signature(&strategy)?;
        
        let mut active_strategies = self.active_strategies.write().unwrap();
        active_strategies.insert(strategy.id, strategy.clone());
        
        info!("Strategy registered with Transaction Engine: {:?}", strategy.id);
        Ok(())
    }
    
    /// Unregister a strategy from the engine
    pub fn unregister_strategy(&self, strategy_id: Uuid) -> Result<()> {
        let mut active_strategies = self.active_strategies.write().unwrap();
        
        if active_strategies.remove(&strategy_id).is_some() {
            info!("Strategy unregistered from Transaction Engine: {:?}", strategy_id);
        } else {
            warn!("Strategy not found for unregistration: {:?}", strategy_id);
        }
        
        Ok(())
    }
    
    /// Execute a transaction with security verification
    pub async fn execute_transaction(
        &self,
        wallet_id: Uuid,
        strategy_id: Option<Uuid>,
        transaction_type: TransactionType,
        amount: f64,
    ) -> Result<Transaction> {
        // Security verification before execution
        if let Some(sid) = strategy_id {
            self.security_protocol.verify_strategy_transaction(sid, transaction_type, amount)?;
        } else {
            self.security_protocol.verify_direct_transaction(wallet_id, transaction_type, amount)?;
        }
        
        // Execute the transaction
        let transaction = self.transaction_manager.execute_transaction(
            wallet_id,
            strategy_id,
            transaction_type,
            amount,
        ).await?;
        
        // Update performance metrics
        let mut metrics = self.performance_metrics.write().unwrap();
        metrics.transactions_processed += 1;
        
        if transaction.status == TransactionStatus::Completed {
            metrics.successful_transactions += 1;
            if let Some(profit) = transaction.profit {
                metrics.total_profit += profit;
            }
        } else if transaction.status == TransactionStatus::Failed {
            metrics.failed_transactions += 1;
        }
        
        // Log the transaction to communication center
        self.communication_center.log_transaction(&transaction)?;
        
        Ok(transaction)
    }
    
    /// Get performance metrics
    pub fn get_performance_metrics(&self) -> PerformanceMetrics {
        self.performance_metrics.read().unwrap().clone()
    }
}

/// Process trading signals from the communication center and specialized transformers
async fn process_signals(
    storage: &Storage,
    wallet_manager: &WalletManager,
    transaction_manager: &TransactionManager,
    security_protocol: &SecurityProtocol,
    communication_center: &CommunicationCenter,
) -> Result<()> {
    // Fetch market data for transformer processing
    let market_data = match communication_center.get_latest_market_data() {
        Ok(data) => data,
        Err(e) => {
            warn!("Failed to get market data for transformer processing: {}", e);
            None
        }
    };
    
    // Initialize specialized transformers to process market data
    let mut transformer_signals = Vec::new();
    
    // Create temporary transformer instances if we have market data
    if let Some(market_data) = &market_data {
        // Initialize specialized transformers
        let micro_qhc = MicroQHCTransformer::new();
        let meme_cortex = MEMECortexTransformer::new();
        
        // Process market data with transformers
        if let Ok(signals) = micro_qhc.process_data(&market_data) {
            info!("MicroQHC transformer generated {} signals", signals.len());
            transformer_signals.extend(signals);
        }
        
        if let Ok(signals) = meme_cortex.process_data(&market_data) {
            info!("MEME Cortex transformer generated {} signals", signals.len());
            transformer_signals.extend(signals);
        }
        
        // For security, verify all transformer-generated signals
        transformer_signals.retain(|signal| {
            match security_protocol.verify_trading_signal(&signal) {
                Ok(valid) => {
                    if !valid {
                        warn!("Transformer signal failed security verification: {}", signal.asset);
                    }
                    valid
                },
                Err(e) => {
                    error!("Error verifying transformer signal: {}", e);
                    false
                }
            }
        });
        
        // Submit verified transformer signals to communication center
        for signal in &transformer_signals {
            if let Err(e) = communication_center.submit_trading_signal(signal.clone()) {
                error!("Failed to submit transformer signal to communication center: {}", e);
            }
        }
    }
    
    // Get pending signals from communication center (including ones just submitted)
    let mut signals = communication_center.get_pending_signals()?;
    
    // Add transformer signals that weren't submitted (fallback)
    for signal in transformer_signals {
        if !signals.contains(&signal) {
            signals.push(signal);
        }
    }
    
    if signals.is_empty() {
        return Ok(());
    }
    
    info!("Processing {} trading signals", signals.len());
    
    // Get active strategies
    let strategies = storage.get_active_strategies().await?;
    
    if strategies.is_empty() {
        warn!("No active strategies available to execute trades");
        return Ok(());
    }
    
    // Process each signal
    for signal in signals {
        // Security verification of the signal
        if !security_protocol.verify_trading_signal(&signal)? {
            warn!("Signal failed security verification: {:?}", signal.asset);
            continue;
        }
        
        // Process signal with strategies
        for strategy in &strategies {
            // Check if this strategy is suitable for this signal
            if !is_strategy_suitable(strategy, &signal) {
                continue;
            }
            
            // Get wallet for this strategy
            let wallets = storage.get_wallet_by_address(&strategy.id.to_string()).await?;
            
            if wallets.is_none() {
                warn!("No wallet found for strategy {}", strategy.name);
                continue;
            }
            
            let wallet = wallets.unwrap();
            
            // Calculate transaction amount based on strategy parameters
            let transaction_amount = calculate_transaction_amount(&signal, strategy, wallet.balance);
            
            // Transaction type from signal
            let transaction_type = match signal.signal_type {
                SignalType::Buy => TransactionType::Buy,
                SignalType::Sell => TransactionType::Sell,
            };
            
            // Execute the transaction
            match transaction_manager.execute_transaction(
                wallet.id,
                Some(strategy.id),
                transaction_type,
                transaction_amount,
            ).await {
                Ok(transaction) => {
                    info!("Executed {:?} transaction for strategy {} with amount {}", 
                        transaction_type, strategy.name, transaction_amount);
                    
                    // Log successful execution
                    communication_center.log_transaction_execution(&signal, &transaction, true)?;
                },
                Err(e) => {
                    error!("Failed to execute transaction for strategy {}: {}", 
                        strategy.name, e);
                    
                    // Log failed execution attempt
                    communication_center.log_execution_failure(&signal, strategy.id, e.to_string())?;
                }
            }
        }
    }
    
    Ok(())
}

/// Check if a strategy is suitable for a given trading signal
fn is_strategy_suitable(strategy: &Strategy, signal: &TradingSignal) -> bool {
    // Match strategy type with signal characteristics
    match strategy.strategy_type {
        StrategyType::Arbitrage => {
            // Arbitrage strategies look for small price differences
            signal.confidence > 0.7 && signal.asset.contains("SOL")
        },
        StrategyType::Momentum => {
            // Momentum strategies need strong trend signals
            signal.confidence > 0.6 && signal.signal_type == SignalType::Buy
        },
        StrategyType::Liquidity => {
            // Liquidity strategies work with any asset that has good volume
            signal.confidence > 0.5
        },
    }
}

/// Calculate transaction amount based on signal, strategy, and available balance
fn calculate_transaction_amount(
    signal: &TradingSignal,
    strategy: &Strategy,
    available_balance: f64,
) -> f64 {
    // Base percentage depends on strategy type
    let base_percentage = match strategy.strategy_type {
        StrategyType::Arbitrage => 0.1, // 10% of balance
        StrategyType::Momentum => 0.15, // 15% of balance
        StrategyType::Liquidity => 0.05, // 5% of balance
    };
    
    // Adjust based on signal confidence
    let confidence_factor = signal.confidence.min(1.0).max(0.0);
    let adjusted_percentage = base_percentage * confidence_factor;
    
    // Calculate amount
    let amount = available_balance * adjusted_percentage;
    
    // Ensure amount is reasonable
    amount.max(0.01).min(available_balance * 0.5) // Min 0.01, max 50% of balance
}