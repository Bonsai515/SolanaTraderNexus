// Transaction manager for the Solana blockchain

use anyhow::{Result, anyhow, Context};
use log::{info, warn, error, debug};
use serde::{Serialize, Deserialize};
use std::sync::{Arc, Mutex, RwLock};
use std::collections::{HashMap, VecDeque};
use std::time::{Duration, Instant};
use chrono::{DateTime, Utc};

use solana_client::rpc_client::RpcClient;
use solana_program::instruction::Instruction;
use solana_program::program_pack::Pack;
use solana_sdk::commitment_config::CommitmentConfig;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::{Keypair, Signature};
use solana_sdk::signer::Signer;
use solana_sdk::system_instruction;
use solana_sdk::transaction::Transaction;

use crate::solana::connection::{SolanaConnection, ConnectionConfig};
use crate::models::transaction::{TransactionData, TransactionStatus, TransactionType};

/// Transaction priority
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum TransactionPriority {
    /// Critical transactions (must execute ASAP)
    Critical = 0,
    
    /// High priority transactions (execute soon)
    High = 1,
    
    /// Normal priority transactions
    Normal = 2,
    
    /// Low priority transactions (can wait)
    Low = 3,
}

impl Default for TransactionPriority {
    fn default() -> Self {
        Self::Normal
    }
}

/// Transaction request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionRequest {
    /// Transaction ID
    pub id: String,
    
    /// Transaction type
    pub transaction_type: TransactionType,
    
    /// Token pair (e.g. "SOL/USDC")
    pub pair: String,
    
    /// Source wallet address
    pub wallet_address: String,
    
    /// Transaction amount
    pub amount: f64,
    
    /// Price (if applicable)
    pub price: Option<f64>,
    
    /// Priority
    pub priority: TransactionPriority,
    
    /// Created timestamp
    pub created_at: DateTime<Utc>,
    
    /// Additional transaction data
    pub data: Option<TransactionData>,
    
    /// Max retries
    pub max_retries: u32,
    
    /// Current retry count
    pub retry_count: u32,
    
    /// Last retry timestamp
    pub last_retry: Option<DateTime<Utc>>,
    
    /// Transaction result (signature)
    pub result: Option<String>,
    
    /// Transaction status
    pub status: TransactionStatus,
    
    /// Error message (if any)
    pub error: Option<String>,
}

impl TransactionRequest {
    /// Create a new transaction request
    pub fn new(
        id: String,
        transaction_type: TransactionType,
        pair: String,
        wallet_address: String,
        amount: f64,
        price: Option<f64>,
        priority: TransactionPriority,
        data: Option<TransactionData>,
    ) -> Self {
        Self {
            id,
            transaction_type,
            pair,
            wallet_address,
            amount,
            price,
            priority,
            created_at: Utc::now(),
            data,
            max_retries: 3,
            retry_count: 0,
            last_retry: None,
            result: None,
            status: TransactionStatus::Pending,
            error: None,
        }
    }
    
    /// Check if transaction can be retried
    pub fn can_retry(&self) -> bool {
        if self.status != TransactionStatus::Failed {
            return false;
        }
        
        self.retry_count < self.max_retries
    }
    
    /// Increment retry count
    pub fn increment_retry(&mut self) {
        self.retry_count += 1;
        self.last_retry = Some(Utc::now());
    }
}

/// Transaction manager configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionManagerConfig {
    /// Maximum number of transactions in the queue
    pub max_queue_size: usize,
    
    /// Minimum time between transaction submissions (in milliseconds)
    pub min_submit_interval_ms: u64,
    
    /// Time to wait before retrying a failed transaction (in milliseconds)
    pub retry_interval_ms: u64,
    
    /// Maximum number of concurrent transactions
    pub max_concurrent_transactions: usize,
    
    /// Default priority for transactions
    pub default_priority: TransactionPriority,
    
    /// Default maximum number of retries
    pub default_max_retries: u32,
    
    /// Whether to automatically retry failed transactions
    pub auto_retry: bool,
}

impl Default for TransactionManagerConfig {
    fn default() -> Self {
        Self {
            max_queue_size: 1000,
            min_submit_interval_ms: 200,
            retry_interval_ms: 5000,
            max_concurrent_transactions: 5,
            default_priority: TransactionPriority::Normal,
            default_max_retries: 3,
            auto_retry: true,
        }
    }
}

/// Transaction manager for executing Solana transactions
pub struct TransactionManager {
    /// Solana connection
    connection: Arc<SolanaConnection>,
    
    /// Transaction queue (by priority)
    queue: RwLock<HashMap<TransactionPriority, VecDeque<TransactionRequest>>>,
    
    /// Transactions in progress
    in_progress: RwLock<HashMap<String, TransactionRequest>>,
    
    /// Completed transactions
    completed: RwLock<HashMap<String, TransactionRequest>>,
    
    /// Configuration
    config: TransactionManagerConfig,
    
    /// Last submission time
    last_submit_time: Mutex<Instant>,
    
    /// Rate limiter
    rate_limiter: Arc<RwLock<crate::solana::rate_limiter::RateLimiter>>,
    
    /// Wallet manager
    wallet_manager: Option<Arc<crate::solana::wallet_manager::WalletManager>>,
    
    /// Is running
    running: RwLock<bool>,
}

impl TransactionManager {
    /// Create a new transaction manager
    pub fn new(
        connection: Arc<SolanaConnection>,
        config: TransactionManagerConfig,
        rate_limiter: Arc<RwLock<crate::solana::rate_limiter::RateLimiter>>,
        wallet_manager: Option<Arc<crate::solana::wallet_manager::WalletManager>>,
    ) -> Self {
        // Initialize queue with all priority levels
        let mut queue = HashMap::new();
        queue.insert(TransactionPriority::Critical, VecDeque::new());
        queue.insert(TransactionPriority::High, VecDeque::new());
        queue.insert(TransactionPriority::Normal, VecDeque::new());
        queue.insert(TransactionPriority::Low, VecDeque::new());
        
        Self {
            connection,
            queue: RwLock::new(queue),
            in_progress: RwLock::new(HashMap::new()),
            completed: RwLock::new(HashMap::new()),
            config,
            last_submit_time: Mutex::new(Instant::now()),
            rate_limiter,
            wallet_manager,
            running: RwLock::new(false),
        }
    }
    
    /// Start the transaction manager
    pub fn start(&self) -> Result<()> {
        let mut running = self.running.write().unwrap();
        if *running {
            return Ok(());
        }
        
        *running = true;
        
        info!("Transaction manager started");
        
        Ok(())
    }
    
    /// Stop the transaction manager
    pub fn stop(&self) -> Result<()> {
        let mut running = self.running.write().unwrap();
        if !*running {
            return Ok(());
        }
        
        *running = false;
        
        info!("Transaction manager stopped");
        
        Ok(())
    }
    
    /// Check if the transaction manager is running
    pub fn is_running(&self) -> bool {
        *self.running.read().unwrap()
    }
    
    /// Enqueue a transaction
    pub fn enqueue(&self, request: TransactionRequest) -> Result<()> {
        let mut queue = self.queue.write().unwrap();
        
        // Check if queue is full
        let total_queue_size: usize = queue.values().map(|q| q.len()).sum();
        if total_queue_size >= self.config.max_queue_size {
            return Err(anyhow!("Transaction queue is full"));
        }
        
        // Add to queue based on priority
        let priority_queue = queue.get_mut(&request.priority).ok_or_else(|| {
            anyhow!("Invalid transaction priority: {:?}", request.priority)
        })?;
        
        priority_queue.push_back(request.clone());
        
        debug!("Enqueued transaction {} with priority {:?}", request.id, request.priority);
        
        Ok(())
    }
    
    /// Dequeue a transaction
    pub fn dequeue(&self) -> Option<TransactionRequest> {
        let mut queue = self.queue.write().unwrap();
        
        // Try to dequeue in priority order
        for priority in [
            TransactionPriority::Critical,
            TransactionPriority::High,
            TransactionPriority::Normal,
            TransactionPriority::Low,
        ] {
            if let Some(priority_queue) = queue.get_mut(&priority) {
                if let Some(request) = priority_queue.pop_front() {
                    debug!("Dequeued transaction {} with priority {:?}", request.id, priority);
                    return Some(request);
                }
            }
        }
        
        None
    }
    
    /// Get queue size
    pub fn queue_size(&self) -> usize {
        let queue = self.queue.read().unwrap();
        queue.values().map(|q| q.len()).sum()
    }
    
    /// Get queue size by priority
    pub fn queue_size_by_priority(&self, priority: TransactionPriority) -> usize {
        let queue = self.queue.read().unwrap();
        queue.get(&priority).map(|q| q.len()).unwrap_or(0)
    }
    
    /// Get number of transactions in progress
    pub fn in_progress_count(&self) -> usize {
        let in_progress = self.in_progress.read().unwrap();
        in_progress.len()
    }
    
    /// Get a transaction by ID
    pub fn get_transaction(&self, id: &str) -> Option<TransactionRequest> {
        // Check in-progress transactions
        let in_progress = self.in_progress.read().unwrap();
        if let Some(tx) = in_progress.get(id) {
            return Some(tx.clone());
        }
        
        // Check completed transactions
        let completed = self.completed.read().unwrap();
        if let Some(tx) = completed.get(id) {
            return Some(tx.clone());
        }
        
        // Check queued transactions
        let queue = self.queue.read().unwrap();
        for priority_queue in queue.values() {
            for tx in priority_queue {
                if tx.id == id {
                    return Some(tx.clone());
                }
            }
        }
        
        None
    }
    
    /// Execute the next transaction in the queue
    pub async fn execute_next(&self) -> Result<Option<String>> {
        // Check if rate limited
        {
            let rate_limiter = self.rate_limiter.read().unwrap();
            if rate_limiter.is_limited() {
                let retry_after = rate_limiter.retry_after();
                debug!("Rate limited, retry after {:?}", retry_after);
                return Err(anyhow!("Rate limited, retry after {:?}", retry_after));
            }
        }
        
        // Check if we can submit a transaction
        {
            let last_submit_time = self.last_submit_time.lock().unwrap();
            let elapsed = last_submit_time.elapsed();
            if elapsed < Duration::from_millis(self.config.min_submit_interval_ms) {
                let wait_time = Duration::from_millis(self.config.min_submit_interval_ms) - elapsed;
                debug!("Submitting too quickly, waiting {:?}", wait_time);
                return Err(anyhow!("Submitting too quickly, waiting {:?}", wait_time));
            }
        }
        
        // Dequeue a transaction
        let request = match self.dequeue() {
            Some(request) => request,
            None => {
                debug!("No transactions in queue");
                return Ok(None);
            }
        };
        
        // Mark as in-progress
        {
            let mut in_progress = self.in_progress.write().unwrap();
            in_progress.insert(request.id.clone(), request.clone());
        }
        
        // Update last submit time
        {
            let mut last_submit_time = self.last_submit_time.lock().unwrap();
            *last_submit_time = Instant::now();
        }
        
        // Execute the transaction
        let result = self.execute_transaction(&request).await;
        
        // Update transaction status
        let mut updated_request = request.clone();
        match result {
            Ok(signature) => {
                updated_request.status = TransactionStatus::Confirmed;
                updated_request.result = Some(signature.clone());
                
                // Remove from in-progress and add to completed
                {
                    let mut in_progress = self.in_progress.write().unwrap();
                    in_progress.remove(&request.id);
                }
                
                {
                    let mut completed = self.completed.write().unwrap();
                    completed.insert(request.id.clone(), updated_request);
                }
                
                info!("Transaction {} executed successfully: {}", request.id, signature);
                Ok(Some(signature))
            }
            Err(e) => {
                updated_request.status = TransactionStatus::Failed;
                updated_request.error = Some(e.to_string());
                
                // Increment retry count
                updated_request.increment_retry();
                
                // If we can retry, enqueue again
                if updated_request.can_retry() && self.config.auto_retry {
                    debug!(
                        "Transaction {} failed, retrying ({}/{}): {}", 
                        request.id, 
                        updated_request.retry_count, 
                        updated_request.max_retries,
                        e
                    );
                    
                    // Remove from in-progress
                    {
                        let mut in_progress = self.in_progress.write().unwrap();
                        in_progress.remove(&request.id);
                    }
                    
                    // Re-enqueue with higher priority
                    let retry_priority = match updated_request.priority {
                        TransactionPriority::Low => TransactionPriority::Normal,
                        TransactionPriority::Normal => TransactionPriority::High,
                        _ => updated_request.priority,
                    };
                    
                    let mut retry_request = updated_request.clone();
                    retry_request.priority = retry_priority;
                    
                    if let Err(e) = self.enqueue(retry_request) {
                        error!("Failed to re-enqueue transaction {}: {}", request.id, e);
                    }
                } else {
                    error!("Transaction {} failed: {}", request.id, e);
                    
                    // Remove from in-progress and add to completed
                    {
                        let mut in_progress = self.in_progress.write().unwrap();
                        in_progress.remove(&request.id);
                    }
                    
                    {
                        let mut completed = self.completed.write().unwrap();
                        completed.insert(request.id.clone(), updated_request);
                    }
                }
                
                Err(e)
            }
        }
    }
    
    /// Execute a transaction
    pub async fn execute_transaction(&self, request: &TransactionRequest) -> Result<String> {
        debug!("Executing transaction {}: {:?}", request.id, request);
        
        // Get wallet keypair
        let keypair = if let Some(wallet_manager) = &self.wallet_manager {
            wallet_manager.get_wallet_keypair(&request.wallet_address)?
        } else {
            return Err(anyhow!("Wallet manager not configured"));
        };
        
        // Get RPC client
        let rpc_client = self.connection.get_rpc_client()?;
        
        // Create transaction based on type
        match request.transaction_type {
            TransactionType::Transfer => {
                self.execute_transfer(request, &keypair, &rpc_client).await
            }
            TransactionType::Swap => {
                self.execute_swap(request, &keypair, &rpc_client).await
            }
            _ => {
                Err(anyhow!("Unsupported transaction type: {:?}", request.transaction_type))
            }
        }
    }
    
    /// Execute a transfer transaction
    pub async fn execute_transfer(
        &self,
        request: &TransactionRequest,
        keypair: &Keypair,
        rpc_client: &RpcClient,
    ) -> Result<String> {
        // Extract recipient from transaction data
        let recipient_address = match &request.data {
            Some(TransactionData::Transfer { recipient, .. }) => recipient,
            _ => return Err(anyhow!("Invalid transaction data for transfer")),
        };
        
        // Parse recipient pubkey
        let recipient_pubkey = Pubkey::from_str(recipient_address)
            .map_err(|e| anyhow!("Invalid recipient address: {}", e))?;
        
        // Convert amount to lamports
        let amount_lamports = (request.amount * 1_000_000_000.0) as u64;
        
        // Create transfer instruction
        let instruction = system_instruction::transfer(
            &keypair.pubkey(),
            &recipient_pubkey,
            amount_lamports,
        );
        
        // Create and send transaction
        let signature = self.send_transaction(rpc_client, keypair, &[instruction]).await?;
        
        Ok(signature.to_string())
    }
    
    /// Execute a swap transaction
    pub async fn execute_swap(
        &self,
        request: &TransactionRequest,
        keypair: &Keypair,
        rpc_client: &RpcClient,
    ) -> Result<String> {
        // Extract swap data from transaction data
        let (token_in, token_out, min_amount_out) = match &request.data {
            Some(TransactionData::Swap { token_in, token_out, min_amount_out, .. }) => {
                (token_in, token_out, min_amount_out)
            }
            _ => return Err(anyhow!("Invalid transaction data for swap")),
        };
        
        // This is a placeholder for actual swap logic
        // In a real implementation, this would involve:
        // 1. Creating Jupiter swap instructions
        // 2. Sending the transaction
        
        warn!("Swap implementation is a placeholder");
        
        Ok("simulated_swap_signature".to_string())
    }
    
    /// Send a transaction with the given instructions
    pub async fn send_transaction(
        &self,
        rpc_client: &RpcClient,
        keypair: &Keypair,
        instructions: &[Instruction],
    ) -> Result<Signature> {
        // Get recent blockhash
        let recent_blockhash = rpc_client.get_latest_blockhash()
            .map_err(|e| anyhow!("Failed to get recent blockhash: {}", e))?;
        
        // Create transaction
        let transaction = Transaction::new_signed_with_payer(
            instructions,
            Some(&keypair.pubkey()),
            &[keypair],
            recent_blockhash,
        );
        
        // Send transaction
        let signature = rpc_client.send_and_confirm_transaction(&transaction)
            .map_err(|e| anyhow!("Failed to send transaction: {}", e))?;
        
        // Update rate limiter
        {
            let mut rate_limiter = self.rate_limiter.write().unwrap();
            rate_limiter.increment();
        }
        
        Ok(signature)
    }
}

use std::str::FromStr;