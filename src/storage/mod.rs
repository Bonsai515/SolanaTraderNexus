pub mod mem_storage;

use crate::models::{
    User, Wallet, Transaction, Strategy, 
    WalletType, TransactionType, TransactionStatus, StrategyType
};
use anyhow::Result;
use std::sync::Arc;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use async_trait::async_trait;

/// Storage trait that defines the interface for all storage implementations
#[async_trait]
pub trait StorageInterface {
    // User management
    async fn get_user(&self, id: Uuid) -> Result<Option<User>>;
    async fn get_user_by_username(&self, username: &str) -> Result<Option<User>>;
    async fn create_user(&self, username: &str, password_hash: &str) -> Result<User>;
    
    // Wallet management
    async fn get_wallet(&self, id: Uuid) -> Result<Option<Wallet>>;
    async fn get_wallet_by_address(&self, address: &str) -> Result<Option<Wallet>>;
    async fn create_wallet(
        &self, 
        user_id: Uuid, 
        address: &str, 
        balance: f64,
        wallet_type: WalletType
    ) -> Result<Wallet>;
    async fn update_wallet_balance(&self, id: Uuid, new_balance: f64) -> Result<Option<Wallet>>;
    
    // Transaction management
    async fn get_transaction(&self, id: Uuid) -> Result<Option<Transaction>>;
    async fn get_transactions_by_wallet_id(&self, wallet_id: Uuid) -> Result<Vec<Transaction>>;
    async fn create_transaction(
        &self,
        wallet_id: Uuid,
        strategy_id: Option<Uuid>,
        transaction_type: TransactionType,
        amount: f64,
        status: TransactionStatus,
        profit: Option<f64>,
        timestamp: DateTime<Utc>,
    ) -> Result<Transaction>;
    async fn update_transaction_status(
        &self,
        id: Uuid,
        status: TransactionStatus,
        profit: Option<f64>,
    ) -> Result<Transaction>;
    async fn get_recent_transactions(&self, limit: usize) -> Result<Vec<Transaction>>;
    
    // Strategy management
    async fn get_strategy(&self, id: Uuid) -> Result<Option<Strategy>>;
    async fn get_active_strategies(&self) -> Result<Vec<Strategy>>;
    async fn get_strategies_by_user_id(&self, user_id: Uuid) -> Result<Vec<Strategy>>;
    async fn create_strategy(
        &self,
        user_id: Uuid,
        name: &str,
        description: Option<String>,
        strategy_type: StrategyType,
        performance: f64,
        is_active: bool,
    ) -> Result<Strategy>;
    async fn update_strategy_status(&self, id: Uuid, is_active: bool) -> Result<Option<Strategy>>;
}

/// Storage is a wrapper around the concrete storage implementation
pub struct Storage {
    inner: Arc<dyn StorageInterface + Send + Sync>,
}

impl Storage {
    /// Create a new storage instance with an in-memory implementation
    pub fn new_in_memory() -> Self {
        let mem_storage = mem_storage::MemStorage::new();
        
        Self {
            inner: Arc::new(mem_storage),
        }
    }
    
    /// Get user by ID
    pub async fn get_user(&self, id: Uuid) -> Result<Option<User>> {
        self.inner.get_user(id).await
    }
    
    /// Get user by username
    pub async fn get_user_by_username(&self, username: &str) -> Result<Option<User>> {
        self.inner.get_user_by_username(username).await
    }
    
    /// Create a new user
    pub async fn create_user(&self, username: &str, password_hash: &str) -> Result<User> {
        self.inner.create_user(username, password_hash).await
    }
    
    /// Get wallet by ID
    pub async fn get_wallet(&self, id: Uuid) -> Result<Option<Wallet>> {
        self.inner.get_wallet(id).await
    }
    
    /// Get wallet by address
    pub async fn get_wallet_by_address(&self, address: &str) -> Result<Option<Wallet>> {
        self.inner.get_wallet_by_address(address).await
    }
    
    /// Create a new wallet
    pub async fn create_wallet(
        &self, 
        user_id: Uuid, 
        address: &str, 
        balance: f64,
        wallet_type: WalletType
    ) -> Result<Wallet> {
        self.inner.create_wallet(user_id, address, balance, wallet_type).await
    }
    
    /// Update wallet balance
    pub async fn update_wallet_balance(&self, id: Uuid, new_balance: f64) -> Result<Option<Wallet>> {
        self.inner.update_wallet_balance(id, new_balance).await
    }
    
    /// Get transaction by ID
    pub async fn get_transaction(&self, id: Uuid) -> Result<Option<Transaction>> {
        self.inner.get_transaction(id).await
    }
    
    /// Get transactions by wallet ID
    pub async fn get_transactions_by_wallet_id(&self, wallet_id: Uuid) -> Result<Vec<Transaction>> {
        self.inner.get_transactions_by_wallet_id(wallet_id).await
    }
    
    /// Create a new transaction
    pub async fn create_transaction(
        &self,
        wallet_id: Uuid,
        strategy_id: Option<Uuid>,
        transaction_type: TransactionType,
        amount: f64,
        status: TransactionStatus,
        profit: Option<f64>,
        timestamp: DateTime<Utc>,
    ) -> Result<Transaction> {
        self.inner.create_transaction(
            wallet_id, 
            strategy_id, 
            transaction_type, 
            amount, 
            status, 
            profit, 
            timestamp
        ).await
    }
    
    /// Update transaction status
    pub async fn update_transaction_status(
        &self,
        id: Uuid,
        status: TransactionStatus,
        profit: Option<f64>,
    ) -> Result<Transaction> {
        self.inner.update_transaction_status(id, status, profit).await
    }
    
    /// Get recent transactions
    pub async fn get_recent_transactions(&self, limit: usize) -> Result<Vec<Transaction>> {
        self.inner.get_recent_transactions(limit).await
    }
    
    /// Get strategy by ID
    pub async fn get_strategy(&self, id: Uuid) -> Result<Option<Strategy>> {
        self.inner.get_strategy(id).await
    }
    
    /// Get active strategies
    pub async fn get_active_strategies(&self) -> Result<Vec<Strategy>> {
        self.inner.get_active_strategies().await
    }
    
    /// Get strategies by user ID
    pub async fn get_strategies_by_user_id(&self, user_id: Uuid) -> Result<Vec<Strategy>> {
        self.inner.get_strategies_by_user_id(user_id).await
    }
    
    /// Create a new strategy
    pub async fn create_strategy(
        &self,
        user_id: Uuid,
        name: &str,
        description: Option<String>,
        strategy_type: StrategyType,
        performance: f64,
        is_active: bool,
    ) -> Result<Strategy> {
        self.inner.create_strategy(
            user_id, 
            name, 
            description, 
            strategy_type, 
            performance, 
            is_active
        ).await
    }
    
    /// Update strategy status
    pub async fn update_strategy_status(&self, id: Uuid, is_active: bool) -> Result<Option<Strategy>> {
        self.inner.update_strategy_status(id, is_active).await
    }
}