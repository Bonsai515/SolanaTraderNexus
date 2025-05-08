// Transaction manager for Solana

use crate::models::{Transaction, TransactionStatus};
use super::connection::SolanaConnection;
use super::wallet_manager::WalletManager;
use anyhow::{Result, anyhow, Context};
use log::{info, warn, error, debug};
use std::sync::{Arc, RwLock, Mutex};
use std::collections::{HashMap, BinaryHeap, VecDeque};
use std::cmp::{Ordering, Reverse};
use std::time::{Duration, Instant};
use thiserror::Error;
use tokio::task::JoinHandle;
use tokio::time::sleep;
use solana_sdk::{
    signature::{Keypair, Signature},
    pubkey::Pubkey,
    transaction::Transaction as SolanaTransaction,
};

/// Maximum concurrent transactions
const MAX_CONCURRENT_TRANSACTIONS: usize = 5;

/// Transaction confirmation timeout (seconds)
const TRANSACTION_TIMEOUT_SECONDS: u64 = 60;

/// Transaction batch size
const TRANSACTION_BATCH_SIZE: usize = 10;

/// Transaction error type
#[derive(Debug, Error)]
pub enum TransactionError {
    #[error("Transaction not found: {0}")]
    TransactionNotFound(String),
    
    #[error("Invalid transaction state")]
    InvalidState,
    
    #[error("Transaction failed: {0}")]
    TransactionFailed(String),
    
    #[error("Transaction timed out")]
    TransactionTimeout,
    
    #[error("Failed to sign transaction")]
    SigningFailed,
    
    #[error("Failed to serialize transaction")]
    SerializationFailed,
    
    #[error("Wallet not found")]
    WalletNotFound,
    
    #[error("Invalid wallet")]
    InvalidWallet,
    
    #[error("Insufficient balance")]
    InsufficientBalance,
}

/// Transaction with priority (for the queue)
#[derive(Debug, Clone)]
struct PrioritizedTransaction {
    /// Transaction ID
    id: String,
    
    /// Transaction priority
    priority: u8,
    
    /// Insertion order (for stable sorting)
    insertion_order: u64,
}

impl PartialEq for PrioritizedTransaction {
    fn eq(&self, other: &Self) -> bool {
        self.id == other.id
    }
}

impl Eq for PrioritizedTransaction {}

impl PartialOrd for PrioritizedTransaction {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for PrioritizedTransaction {
    fn cmp(&self, other: &Self) -> Ordering {
        // First by priority (higher first)
        let priority_cmp = other.priority.cmp(&self.priority);
        if priority_cmp != Ordering::Equal {
            return priority_cmp;
        }
        
        // Then by insertion order (lower first)
        self.insertion_order.cmp(&other.insertion_order)
    }
}

/// Transaction in progress
#[derive(Debug)]
struct TransactionInProgress {
    /// Transaction ID
    id: String,
    
    /// Transaction signature
    signature: String,
    
    /// Start time
    start_time: Instant,
    
    /// Timeout
    timeout: Duration,
    
    /// Confirmation attempt count
    confirmation_attempts: u8,
}

/// Transaction manager for executing and monitoring blockchain transactions
pub struct TransactionManager {
    /// Solana connection
    solana_connection: Arc<SolanaConnection>,
    
    /// Wallet manager
    wallet_manager: Arc<WalletManager>,
    
    /// Pending transactions
    pending_transactions: RwLock<HashMap<String, Transaction>>,
    
    /// Transaction queue (prioritized)
    transaction_queue: Mutex<BinaryHeap<PrioritizedTransaction>>,
    
    /// Transactions in progress
    in_progress: Mutex<HashMap<String, TransactionInProgress>>,
    
    /// Completed transactions
    completed_transactions: RwLock<VecDeque<Transaction>>,
    
    /// Processing thread
    processing_thread: Mutex<Option<JoinHandle<()>>>,
    
    /// Monitoring thread
    monitoring_thread: Mutex<Option<JoinHandle<()>>>,
    
    /// Next insertion order
    next_insertion_order: Mutex<u64>,
}

impl TransactionManager {
    /// Create a new transaction manager
    pub fn new(
        solana_connection: Arc<SolanaConnection>,
        wallet_manager: Arc<WalletManager>,
    ) -> Self {
        Self {
            solana_connection,
            wallet_manager,
            pending_transactions: RwLock::new(HashMap::new()),
            transaction_queue: Mutex::new(BinaryHeap::new()),
            in_progress: Mutex::new(HashMap::new()),
            completed_transactions: RwLock::new(VecDeque::with_capacity(100)),
            processing_thread: Mutex::new(None),
            monitoring_thread: Mutex::new(None),
            next_insertion_order: Mutex::new(0),
        }
    }
    
    /// Start the transaction manager
    pub fn start(&self) -> Result<()> {
        info!("Starting transaction manager");
        
        // Start transaction processing thread
        let tm = Arc::new(self.clone());
        let processing_handle = tokio::spawn(async move {
            TransactionManager::transaction_processing_loop(tm.clone()).await;
        });
        
        {
            let mut thread = self.processing_thread.lock().unwrap();
            *thread = Some(processing_handle);
        }
        
        // Start transaction monitoring thread
        let tm = Arc::new(self.clone());
        let monitoring_handle = tokio::spawn(async move {
            TransactionManager::transaction_monitoring_loop(tm.clone()).await;
        });
        
        {
            let mut thread = self.monitoring_thread.lock().unwrap();
            *thread = Some(monitoring_handle);
        }
        
        info!("Transaction manager started");
        
        Ok(())
    }
    
    /// Submit a transaction for processing
    pub fn submit_transaction(&self, tx: Transaction) -> Result<Transaction> {
        debug!("Submitting transaction: {}", tx.id);
        
        // Check transaction status
        if tx.status != TransactionStatus::Pending {
            return Err(TransactionError::InvalidState.into());
        }
        
        // Add to pending transactions
        {
            let mut pending = self.pending_transactions.write().unwrap();
            pending.insert(tx.id.clone(), tx.clone());
        }
        
        // Add to transaction queue
        {
            let mut queue = self.transaction_queue.lock().unwrap();
            let mut next_order = self.next_insertion_order.lock().unwrap();
            
            queue.push(PrioritizedTransaction {
                id: tx.id.clone(),
                priority: tx.priority,
                insertion_order: *next_order,
            });
            
            *next_order += 1;
        }
        
        debug!("Transaction {} added to queue", tx.id);
        
        Ok(tx)
    }
    
    /// Get transaction by ID
    pub fn get_transaction(&self, id: &str) -> Result<Transaction> {
        // Check pending transactions
        {
            let pending = self.pending_transactions.read().unwrap();
            if let Some(tx) = pending.get(id) {
                return Ok(tx.clone());
            }
        }
        
        // Check completed transactions
        {
            let completed = self.completed_transactions.read().unwrap();
            for tx in completed.iter() {
                if tx.id == id {
                    return Ok(tx.clone());
                }
            }
        }
        
        Err(TransactionError::TransactionNotFound(id.to_string()).into())
    }
    
    /// Get all transactions
    pub fn get_transactions(&self) -> Vec<Transaction> {
        let mut transactions = Vec::new();
        
        // Add pending transactions
        {
            let pending = self.pending_transactions.read().unwrap();
            transactions.extend(pending.values().cloned());
        }
        
        // Add completed transactions
        {
            let completed = self.completed_transactions.read().unwrap();
            transactions.extend(completed.iter().cloned());
        }
        
        transactions
    }
    
    /// Cancel a pending transaction
    pub fn cancel_transaction(&self, id: &str, reason: Option<String>) -> Result<Transaction> {
        // Check if transaction is pending
        let mut tx = {
            let mut pending = self.pending_transactions.write().unwrap();
            if let Some(tx) = pending.remove(id) {
                tx
            } else {
                return Err(TransactionError::TransactionNotFound(id.to_string()).into());
            }
        };
        
        // Update transaction status
        tx.mark_cancelled(reason);
        
        // Add to completed transactions
        {
            let mut completed = self.completed_transactions.write().unwrap();
            completed.push_back(tx.clone());
            
            // Limit completed transaction history
            while completed.len() > 100 {
                completed.pop_front();
            }
        }
        
        debug!("Transaction {} cancelled", id);
        
        Ok(tx)
    }
    
    /// Transaction processing loop
    async fn transaction_processing_loop(tm: Arc<TransactionManager>) {
        info!("Starting transaction processing loop");
        
        loop {
            // Process up to MAX_CONCURRENT_TRANSACTIONS transactions at a time
            let in_progress_count = {
                let in_progress = tm.in_progress.lock().unwrap();
                in_progress.len()
            };
            
            let available_slots = MAX_CONCURRENT_TRANSACTIONS.saturating_sub(in_progress_count);
            
            if available_slots > 0 {
                // Get next batch of transactions
                let batch = tm.get_next_transaction_batch(available_slots);
                
                if !batch.is_empty() {
                    debug!("Processing {} transactions", batch.len());
                    
                    for tx_id in batch {
                        match tm.process_transaction(&tx_id).await {
                            Ok(signature) => {
                                debug!("Transaction {} submitted with signature {}", tx_id, signature);
                                
                                // Add to in-progress map
                                let in_progress = TransactionInProgress {
                                    id: tx_id,
                                    signature,
                                    start_time: Instant::now(),
                                    timeout: Duration::from_secs(TRANSACTION_TIMEOUT_SECONDS),
                                    confirmation_attempts: 0,
                                };
                                
                                let mut in_progress_map = tm.in_progress.lock().unwrap();
                                in_progress_map.insert(in_progress.id.clone(), in_progress);
                            }
                            Err(e) => {
                                warn!("Failed to process transaction {}: {}", tx_id, e);
                                
                                // Mark transaction as failed
                                if let Err(e) = tm.mark_transaction_failed(&tx_id, format!("Processing failed: {}", e)) {
                                    error!("Failed to mark transaction as failed: {}", e);
                                }
                            }
                        }
                    }
                }
            }
            
            // Sleep briefly before next batch
            sleep(Duration::from_millis(100)).await;
        }
    }
    
    /// Transaction monitoring loop
    async fn transaction_monitoring_loop(tm: Arc<TransactionManager>) {
        info!("Starting transaction monitoring loop");
        
        loop {
            // Get in-progress transactions
            let transactions = {
                let in_progress = tm.in_progress.lock().unwrap();
                in_progress.values().cloned().collect::<Vec<_>>()
            };
            
            for tx in transactions {
                // Check if transaction has timed out
                if tx.start_time.elapsed() > tx.timeout {
                    warn!("Transaction {} timed out", tx.id);
                    
                    // Mark transaction as failed
                    if let Err(e) = tm.mark_transaction_failed(&tx.id, "Transaction timed out".to_string()) {
                        error!("Failed to mark transaction as failed: {}", e);
                    }
                    
                    // Remove from in-progress map
                    let mut in_progress = tm.in_progress.lock().unwrap();
                    in_progress.remove(&tx.id);
                    
                    continue;
                }
                
                // Check transaction status
                match tm.check_transaction_status(&tx.signature).await {
                    Ok(status) => {
                        match status {
                            TransactionStatus::Confirmed => {
                                info!("Transaction {} confirmed", tx.id);
                                
                                // Mark transaction as confirmed
                                if let Err(e) = tm.mark_transaction_confirmed(&tx.id, &tx.signature) {
                                    error!("Failed to mark transaction as confirmed: {}", e);
                                }
                                
                                // Remove from in-progress map
                                let mut in_progress = tm.in_progress.lock().unwrap();
                                in_progress.remove(&tx.id);
                            }
                            TransactionStatus::Failed => {
                                warn!("Transaction {} failed", tx.id);
                                
                                // Mark transaction as failed
                                if let Err(e) = tm.mark_transaction_failed(&tx.id, "Transaction failed on chain".to_string()) {
                                    error!("Failed to mark transaction as failed: {}", e);
                                }
                                
                                // Remove from in-progress map
                                let mut in_progress = tm.in_progress.lock().unwrap();
                                in_progress.remove(&tx.id);
                            }
                            _ => {
                                // Still pending, continue monitoring
                            }
                        }
                    }
                    Err(e) => {
                        debug!("Error checking transaction status: {}", e);
                        
                        // Increment confirmation attempts
                        let mut in_progress = tm.in_progress.lock().unwrap();
                        if let Some(tx_in_progress) = in_progress.get_mut(&tx.id) {
                            tx_in_progress.confirmation_attempts += 1;
                            
                            // If too many attempts, mark as failed
                            if tx_in_progress.confirmation_attempts > 10 {
                                warn!("Transaction {} failed after {} attempts", tx.id, tx_in_progress.confirmation_attempts);
                                
                                // Mark transaction as failed
                                if let Err(e) = tm.mark_transaction_failed(&tx.id, "Transaction status check failed".to_string()) {
                                    error!("Failed to mark transaction as failed: {}", e);
                                }
                                
                                // Remove from in-progress map
                                in_progress.remove(&tx.id);
                            }
                        }
                    }
                }
            }
            
            // Sleep before next check
            sleep(Duration::from_secs(2)).await;
        }
    }
    
    /// Get next batch of transactions to process
    fn get_next_transaction_batch(&self, max_count: usize) -> Vec<String> {
        let mut batch = Vec::with_capacity(max_count.min(TRANSACTION_BATCH_SIZE));
        
        let mut queue = self.transaction_queue.lock().unwrap();
        
        while batch.len() < max_count && !queue.is_empty() {
            if let Some(tx) = queue.pop() {
                batch.push(tx.id);
            }
        }
        
        batch
    }
    
    /// Process a transaction
    async fn process_transaction(&self, id: &str) -> Result<String> {
        // Get transaction
        let tx = {
            let pending = self.pending_transactions.read().unwrap();
            pending.get(id)
                .cloned()
                .ok_or_else(|| TransactionError::TransactionNotFound(id.to_string()))?
        };
        
        debug!("Processing transaction {}", id);
        
        // Get wallet keypair
        let keypair = self.wallet_manager.get_wallet_keypair(&tx.wallet_id)
            .map_err(|_| TransactionError::WalletNotFound)?;
        
        // Create and sign Solana transaction
        // For simplicity, this is a placeholder. In a real implementation,
        // this would construct the appropriate instruction based on the transaction type
        
        // For example, a transfer transaction
        let serialized_tx = "base64_encoded_transaction";
        
        // Submit transaction to Solana
        let signature = self.solana_connection.send_transaction(serialized_tx).await
            .map_err(|e| TransactionError::TransactionFailed(e.to_string()))?;
        
        Ok(signature)
    }
    
    /// Check transaction status
    async fn check_transaction_status(&self, signature: &str) -> Result<TransactionStatus> {
        // Get transaction status from Solana
        let status = self.solana_connection.get_transaction_status(signature).await
            .map_err(|e| TransactionError::TransactionFailed(e.to_string()))?;
        
        // Parse status
        let confirmed = status.get("meta")
            .and_then(|meta| meta.get("err"))
            .is_none();
        
        if confirmed {
            Ok(TransactionStatus::Confirmed)
        } else {
            Ok(TransactionStatus::Failed)
        }
    }
    
    /// Mark transaction as confirmed
    fn mark_transaction_confirmed(&self, id: &str, signature: &str) -> Result<()> {
        // Get transaction
        let mut tx = {
            let mut pending = self.pending_transactions.write().unwrap();
            pending.remove(id)
                .ok_or_else(|| TransactionError::TransactionNotFound(id.to_string()))?
        };
        
        // Update transaction status
        tx.mark_confirmed(signature.to_string(), signature.to_string(), 0);
        
        // Add to completed transactions
        let mut completed = self.completed_transactions.write().unwrap();
        completed.push_back(tx);
        
        // Limit completed transaction history
        while completed.len() > 100 {
            completed.pop_front();
        }
        
        Ok(())
    }
    
    /// Mark transaction as failed
    fn mark_transaction_failed(&self, id: &str, error: String) -> Result<()> {
        // Get transaction
        let mut tx = {
            let mut pending = self.pending_transactions.write().unwrap();
            pending.remove(id)
                .ok_or_else(|| TransactionError::TransactionNotFound(id.to_string()))?
        };
        
        // Update transaction status
        tx.mark_failed(error);
        
        // Add to completed transactions
        let mut completed = self.completed_transactions.write().unwrap();
        completed.push_back(tx);
        
        // Limit completed transaction history
        while completed.len() > 100 {
            completed.pop_front();
        }
        
        Ok(())
    }
    
    /// Stop the transaction manager
    pub fn stop(&self) -> Result<()> {
        info!("Stopping transaction manager");
        
        // Stop processing thread
        {
            let mut thread = self.processing_thread.lock().unwrap();
            if let Some(handle) = thread.take() {
                handle.abort();
            }
        }
        
        // Stop monitoring thread
        {
            let mut thread = self.monitoring_thread.lock().unwrap();
            if let Some(handle) = thread.take() {
                handle.abort();
            }
        }
        
        info!("Transaction manager stopped");
        
        Ok(())
    }
}

impl Clone for TransactionManager {
    fn clone(&self) -> Self {
        Self {
            solana_connection: self.solana_connection.clone(),
            wallet_manager: self.wallet_manager.clone(),
            pending_transactions: RwLock::new(self.pending_transactions.read().unwrap().clone()),
            transaction_queue: Mutex::new(self.transaction_queue.lock().unwrap().clone()),
            in_progress: Mutex::new(HashMap::new()),
            completed_transactions: RwLock::new(self.completed_transactions.read().unwrap().clone()),
            processing_thread: Mutex::new(None),
            monitoring_thread: Mutex::new(None),
            next_insertion_order: Mutex::new(*self.next_insertion_order.lock().unwrap()),
        }
    }
}