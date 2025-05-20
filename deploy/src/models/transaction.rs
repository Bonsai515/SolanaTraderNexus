// Transaction model

use serde::{Serialize, Deserialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use std::collections::HashMap;

/// Transaction type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TransactionType {
    /// Buy tokens
    Buy,
    
    /// Sell tokens
    Sell,
    
    /// Swap tokens
    Swap,
    
    /// Provide liquidity
    ProvideLiquidity,
    
    /// Remove liquidity
    RemoveLiquidity,
    
    /// Stake tokens
    Stake,
    
    /// Unstake tokens
    Unstake,
}

impl std::fmt::Display for TransactionType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TransactionType::Buy => write!(f, "BUY"),
            TransactionType::Sell => write!(f, "SELL"),
            TransactionType::Swap => write!(f, "SWAP"),
            TransactionType::ProvideLiquidity => write!(f, "PROVIDE_LIQUIDITY"),
            TransactionType::RemoveLiquidity => write!(f, "REMOVE_LIQUIDITY"),
            TransactionType::Stake => write!(f, "STAKE"),
            TransactionType::Unstake => write!(f, "UNSTAKE"),
        }
    }
}

/// Transaction status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TransactionStatus {
    /// Transaction is pending
    Pending,
    
    /// Transaction is confirmed
    Confirmed,
    
    /// Transaction failed
    Failed,
    
    /// Transaction was cancelled
    Cancelled,
}

impl std::fmt::Display for TransactionStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TransactionStatus::Pending => write!(f, "PENDING"),
            TransactionStatus::Confirmed => write!(f, "CONFIRMED"),
            TransactionStatus::Failed => write!(f, "FAILED"),
            TransactionStatus::Cancelled => write!(f, "CANCELLED"),
        }
    }
}

/// Represents a blockchain transaction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transaction {
    /// Unique identifier
    pub id: String,
    
    /// Strategy ID that initiated this transaction
    pub strategy_id: Option<String>,
    
    /// Signal ID that led to this transaction
    pub signal_id: Option<String>,
    
    /// Transaction type
    pub transaction_type: TransactionType,
    
    /// Transaction status
    pub status: TransactionStatus,
    
    /// Priority level (0-100, higher is more urgent)
    pub priority: u8,
    
    /// Wallet ID used for this transaction
    pub wallet_id: String,
    
    /// Wallet address
    pub wallet_address: String,
    
    /// Token pair or asset (e.g., "SOL/USDC" or "SOL")
    pub token_pair: String,
    
    /// Source token (e.g., "SOL")
    pub from_token: Option<String>,
    
    /// Destination token (e.g., "USDC")
    pub to_token: Option<String>,
    
    /// Amount of tokens (in source token)
    pub amount: f64,
    
    /// Expected output amount (in destination token)
    pub expected_output_amount: Option<f64>,
    
    /// Actual output amount (in destination token)
    pub actual_output_amount: Option<f64>,
    
    /// Token price at transaction time
    pub price: Option<f64>,
    
    /// Maximum allowed slippage (percentage)
    pub max_slippage: f64,
    
    /// DEX or venue used
    pub dex: String,
    
    /// Transaction hash
    pub tx_hash: Option<String>,
    
    /// Transaction signature
    pub signature: Option<String>,
    
    /// Gas/fee amount (in SOL)
    pub gas_fee: Option<f64>,
    
    /// Block number
    pub block_number: Option<u64>,
    
    /// Transaction metadata
    pub metadata: HashMap<String, serde_json::Value>,
    
    /// Related transaction ID (e.g., for closing positions)
    pub related_tx_id: Option<String>,
    
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    
    /// Confirmation timestamp
    pub confirmed_at: Option<DateTime<Utc>>,
    
    /// Maximum retries
    pub max_retries: u8,
    
    /// Current retry count
    pub retry_count: u8,
    
    /// Last error message
    pub last_error: Option<String>,
}

impl Transaction {
    /// Create a new transaction
    pub fn new(
        transaction_type: TransactionType,
        wallet_id: String,
        wallet_address: String,
        token_pair: String,
        amount: f64,
        max_slippage: f64,
        dex: String,
        priority: u8,
    ) -> Self {
        let now = Utc::now();
        
        Self {
            id: Uuid::new_v4().to_string(),
            strategy_id: None,
            signal_id: None,
            transaction_type,
            status: TransactionStatus::Pending,
            priority,
            wallet_id,
            wallet_address,
            token_pair,
            from_token: None,
            to_token: None,
            amount,
            expected_output_amount: None,
            actual_output_amount: None,
            price: None,
            max_slippage,
            dex,
            tx_hash: None,
            signature: None,
            gas_fee: None,
            block_number: None,
            metadata: HashMap::new(),
            related_tx_id: None,
            created_at: now,
            confirmed_at: None,
            max_retries: 3,
            retry_count: 0,
            last_error: None,
        }
    }
    
    /// Set transaction metadata
    pub fn set_metadata<T: Serialize>(&mut self, key: &str, value: T) {
        if let Ok(json_value) = serde_json::to_value(value) {
            self.metadata.insert(key.to_string(), json_value);
        }
    }
    
    /// Get transaction metadata
    pub fn get_metadata<T: for<'de> Deserialize<'de>>(&self, key: &str) -> Option<T> {
        self.metadata.get(key).and_then(|value| {
            serde_json::from_value(value.clone()).ok()
        })
    }
    
    /// Mark transaction as confirmed
    pub fn mark_confirmed(&mut self, tx_hash: String, signature: String, block_number: u64) {
        self.status = TransactionStatus::Confirmed;
        self.tx_hash = Some(tx_hash);
        self.signature = Some(signature);
        self.block_number = Some(block_number);
        self.confirmed_at = Some(Utc::now());
    }
    
    /// Mark transaction as failed
    pub fn mark_failed(&mut self, error: String) {
        self.status = TransactionStatus::Failed;
        self.last_error = Some(error);
    }
    
    /// Mark transaction as cancelled
    pub fn mark_cancelled(&mut self, reason: Option<String>) {
        self.status = TransactionStatus::Cancelled;
        if let Some(reason_text) = reason {
            self.last_error = Some(reason_text);
        }
    }
    
    /// Increment retry count
    pub fn increment_retry(&mut self) -> bool {
        self.retry_count += 1;
        self.retry_count <= self.max_retries
    }
    
    /// Check if transaction can be retried
    pub fn can_retry(&self) -> bool {
        self.status == TransactionStatus::Failed && self.retry_count < self.max_retries
    }
    
    /// Calculate transaction profit/loss if completed
    pub fn calculate_pnl(&self) -> Option<f64> {
        if self.status != TransactionStatus::Confirmed {
            return None;
        }
        
        match (self.expected_output_amount, self.actual_output_amount) {
            (Some(expected), Some(actual)) => Some(actual - expected),
            _ => None,
        }
    }
}