use crate::models::{
    User, Wallet, Transaction, Strategy, 
    WalletType, TransactionType, TransactionStatus, StrategyType
};
use crate::storage::StorageInterface;
use anyhow::{Result, Context};
use log::{info, error};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// In-memory storage implementation
pub struct MemStorage {
    users: Mutex<HashMap<Uuid, User>>,
    wallets: Mutex<HashMap<Uuid, Wallet>>,
    transactions: Mutex<HashMap<Uuid, Transaction>>,
    strategies: Mutex<HashMap<Uuid, Strategy>>,
}

impl MemStorage {
    /// Create a new in-memory storage instance
    pub fn new() -> Self {
        let instance = Self {
            users: Mutex::new(HashMap::new()),
            wallets: Mutex::new(HashMap::new()),
            transactions: Mutex::new(HashMap::new()),
            strategies: Mutex::new(HashMap::new()),
        };
        
        // Initialize with sample data
        instance.init_sample_data();
        
        instance
    }
    
    /// Get user by ID
    pub async fn get_user(&self, id: Uuid) -> Result<Option<User>> {
        let users = self.users.lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire lock: {}", e))?;
            
        Ok(users.get(&id).cloned())
    }
    
    /// Get user by username
    pub async fn get_user_by_username(&self, username: &str) -> Result<Option<User>> {
        let users = self.users.lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire lock: {}", e))?;
            
        let user = users.values()
            .find(|user| user.username == username)
            .cloned();
            
        Ok(user)
    }
    
    /// Create a new user
    pub async fn create_user(&self, username: &str, password_hash: &str) -> Result<User> {
        let mut users = self.users.lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire lock: {}", e))?;
            
        // Check if username already exists
        if users.values().any(|user| user.username == username) {
            return Err(anyhow::anyhow!("Username already exists"));
        }
        
        let user = User {
            id: Uuid::new_v4(),
            username: username.to_string(),
            password_hash: password_hash.to_string(),
        };
        
        users.insert(user.id, user.clone());
        info!("Created user with ID: {}", user.id);
        
        Ok(user)
    }
    
    /// Get wallet by ID
    pub async fn get_wallet(&self, id: Uuid) -> Result<Option<Wallet>> {
        let wallets = self.wallets.lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire lock: {}", e))?;
            
        Ok(wallets.get(&id).cloned())
    }
    
    /// Get wallet by address
    pub async fn get_wallet_by_address(&self, address: &str) -> Result<Option<Wallet>> {
        let wallets = self.wallets.lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire lock: {}", e))?;
            
        let wallet = wallets.values()
            .find(|wallet| wallet.address == address)
            .cloned();
            
        Ok(wallet)
    }
    
    /// Create a new wallet
    pub async fn create_wallet(
        &self, 
        user_id: Uuid, 
        address: &str, 
        balance: f64,
        wallet_type: WalletType
    ) -> Result<Wallet> {
        let mut wallets = self.wallets.lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire lock: {}", e))?;
            
        // Check if address already exists
        if wallets.values().any(|wallet| wallet.address == address) {
            return Err(anyhow::anyhow!("Wallet address already exists"));
        }
        
        let wallet = Wallet {
            id: Uuid::new_v4(),
            user_id,
            address: address.to_string(),
            balance,
            wallet_type,
        };
        
        wallets.insert(wallet.id, wallet.clone());
        info!("Created wallet with ID: {} and address: {}", wallet.id, address);
        
        Ok(wallet)
    }
    
    /// Update wallet balance
    pub async fn update_wallet_balance(&self, id: Uuid, new_balance: f64) -> Result<Option<Wallet>> {
        let mut wallets = self.wallets.lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire lock: {}", e))?;
            
        if let Some(wallet) = wallets.get_mut(&id) {
            wallet.balance = new_balance;
            info!("Updated wallet {} balance to {}", id, new_balance);
            return Ok(Some(wallet.clone()));
        }
        
        Ok(None)
    }
    
    /// Get transaction by ID
    pub async fn get_transaction(&self, id: Uuid) -> Result<Option<Transaction>> {
        let transactions = self.transactions.lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire lock: {}", e))?;
            
        Ok(transactions.get(&id).cloned())
    }
    
    /// Get transactions by wallet ID
    pub async fn get_transactions_by_wallet_id(&self, wallet_id: Uuid) -> Result<Vec<Transaction>> {
        let transactions = self.transactions.lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire lock: {}", e))?;
            
        let filtered = transactions.values()
            .filter(|tx| tx.wallet_id == wallet_id)
            .cloned()
            .collect();
            
        Ok(filtered)
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
        let mut transactions = self.transactions.lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire lock: {}", e))?;
            
        let transaction = Transaction {
            id: Uuid::new_v4(),
            wallet_id,
            strategy_id,
            transaction_type,
            amount,
            status,
            profit,
            timestamp,
        };
        
        transactions.insert(transaction.id, transaction.clone());
        info!("Created transaction with ID: {}", transaction.id);
        
        Ok(transaction)
    }
    
    /// Update transaction status
    pub async fn update_transaction_status(
        &self,
        id: Uuid,
        status: TransactionStatus,
        profit: Option<f64>,
    ) -> Result<Transaction> {
        let mut transactions = self.transactions.lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire lock: {}", e))?;
            
        if let Some(transaction) = transactions.get_mut(&id) {
            transaction.status = status;
            if let Some(p) = profit {
                transaction.profit = Some(p);
            }
            
            info!("Updated transaction {} status to {:?}", id, status);
            return Ok(transaction.clone());
        }
        
        Err(anyhow::anyhow!("Transaction not found: {}", id))
    }
    
    /// Get recent transactions
    pub async fn get_recent_transactions(&self, limit: usize) -> Result<Vec<Transaction>> {
        let transactions = self.transactions.lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire lock: {}", e))?;
            
        let mut all_transactions: Vec<_> = transactions.values().cloned().collect();
        
        // Sort by timestamp (newest first)
        all_transactions.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        
        // Limit the number of results
        let limited = all_transactions.into_iter().take(limit).collect();
        
        Ok(limited)
    }
    
    /// Get strategy by ID
    pub async fn get_strategy(&self, id: Uuid) -> Result<Option<Strategy>> {
        let strategies = self.strategies.lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire lock: {}", e))?;
            
        Ok(strategies.get(&id).cloned())
    }
    
    /// Get active strategies
    pub async fn get_active_strategies(&self) -> Result<Vec<Strategy>> {
        let strategies = self.strategies.lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire lock: {}", e))?;
            
        let active = strategies.values()
            .filter(|strategy| strategy.is_active)
            .cloned()
            .collect();
            
        Ok(active)
    }
    
    /// Get strategies by user ID
    pub async fn get_strategies_by_user_id(&self, user_id: Uuid) -> Result<Vec<Strategy>> {
        let strategies = self.strategies.lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire lock: {}", e))?;
            
        let user_strategies = strategies.values()
            .filter(|strategy| strategy.user_id == user_id)
            .cloned()
            .collect();
            
        Ok(user_strategies)
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
        let mut strategies = self.strategies.lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire lock: {}", e))?;
            
        let strategy = Strategy {
            id: Uuid::new_v4(),
            user_id,
            name: name.to_string(),
            description,
            strategy_type,
            performance,
            is_active,
            created_at: Utc::now(),
        };
        
        strategies.insert(strategy.id, strategy.clone());
        info!("Created strategy with ID: {} and name: {}", strategy.id, name);
        
        Ok(strategy)
    }
    
    /// Update strategy status
    pub async fn update_strategy_status(&self, id: Uuid, is_active: bool) -> Result<Option<Strategy>> {
        let mut strategies = self.strategies.lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire lock: {}", e))?;
            
        if let Some(strategy) = strategies.get_mut(&id) {
            strategy.is_active = is_active;
            info!("Updated strategy {} active status to {}", id, is_active);
            return Ok(Some(strategy.clone()));
        }
        
        Ok(None)
    }
    
#[async_trait::async_trait]
impl StorageInterface for MemStorage {
    async fn get_user(&self, id: Uuid) -> Result<Option<User>> {
        self.get_user(id).await
    }
    
    async fn get_user_by_username(&self, username: &str) -> Result<Option<User>> {
        self.get_user_by_username(username).await
    }
    
    async fn create_user(&self, username: &str, password_hash: &str) -> Result<User> {
        self.create_user(username, password_hash).await
    }
    
    async fn get_wallet(&self, id: Uuid) -> Result<Option<Wallet>> {
        self.get_wallet(id).await
    }
    
    async fn get_wallet_by_address(&self, address: &str) -> Result<Option<Wallet>> {
        self.get_wallet_by_address(address).await
    }
    
    async fn create_wallet(
        &self, 
        user_id: Uuid, 
        address: &str, 
        balance: f64,
        wallet_type: WalletType
    ) -> Result<Wallet> {
        self.create_wallet(user_id, address, balance, wallet_type).await
    }
    
    async fn update_wallet_balance(&self, id: Uuid, new_balance: f64) -> Result<Option<Wallet>> {
        self.update_wallet_balance(id, new_balance).await
    }
    
    async fn get_transaction(&self, id: Uuid) -> Result<Option<Transaction>> {
        self.get_transaction(id).await
    }
    
    async fn get_transactions_by_wallet_id(&self, wallet_id: Uuid) -> Result<Vec<Transaction>> {
        self.get_transactions_by_wallet_id(wallet_id).await
    }
    
    async fn create_transaction(
        &self,
        wallet_id: Uuid,
        strategy_id: Option<Uuid>,
        transaction_type: TransactionType,
        amount: f64,
        status: TransactionStatus,
        profit: Option<f64>,
        timestamp: DateTime<Utc>,
    ) -> Result<Transaction> {
        self.create_transaction(
            wallet_id, 
            strategy_id, 
            transaction_type, 
            amount, 
            status, 
            profit, 
            timestamp
        ).await
    }
    
    async fn update_transaction_status(
        &self,
        id: Uuid,
        status: TransactionStatus,
        profit: Option<f64>,
    ) -> Result<Transaction> {
        self.update_transaction_status(id, status, profit).await
    }
    
    async fn get_recent_transactions(&self, limit: usize) -> Result<Vec<Transaction>> {
        self.get_recent_transactions(limit).await
    }
    
    async fn get_strategy(&self, id: Uuid) -> Result<Option<Strategy>> {
        self.get_strategy(id).await
    }
    
    async fn get_active_strategies(&self) -> Result<Vec<Strategy>> {
        self.get_active_strategies().await
    }
    
    async fn get_strategies_by_user_id(&self, user_id: Uuid) -> Result<Vec<Strategy>> {
        self.get_strategies_by_user_id(user_id).await
    }
    
    async fn create_strategy(
        &self,
        user_id: Uuid,
        name: &str,
        description: Option<String>,
        strategy_type: StrategyType,
        performance: f64,
        is_active: bool,
    ) -> Result<Strategy> {
        self.create_strategy(
            user_id, 
            name, 
            description, 
            strategy_type, 
            performance, 
            is_active
        ).await
    }
    
    async fn update_strategy_status(&self, id: Uuid, is_active: bool) -> Result<Option<Strategy>> {
        self.update_strategy_status(id, is_active).await
    }
}

    /// Initialize sample data for testing
    fn init_sample_data(&self) {
        // This should be called only once when constructing the storage
        let mut users = self.users.lock().unwrap();
        let mut wallets = self.wallets.lock().unwrap();
        let mut transactions = self.transactions.lock().unwrap();
        let mut strategies = self.strategies.lock().unwrap();
        
        // Create a sample user
        let user_id = Uuid::new_v4();
        let user = User {
            id: user_id,
            username: "trader1".to_string(),
            password_hash: "password123".to_string(), // In a real app, this would be hashed
        };
        users.insert(user.id, user);
        
        // Create a sample wallet
        let wallet_id = Uuid::new_v4();
        let wallet = Wallet {
            id: wallet_id,
            user_id,
            address: "3X4F9H29vQKjyKwARXd7yQyu53PJ8qiLQhH5D1yY8F6F9H2".to_string(),
            balance: 354.72,
            wallet_type: WalletType::Main,
        };
        wallets.insert(wallet.id, wallet);
        
        // Create sample strategies
        let strategy1_id = Uuid::new_v4();
        let strategy1 = Strategy {
            id: strategy1_id,
            user_id,
            name: "Alpha-7 Arbitrage".to_string(),
            description: Some("Cross-DEX arbitrage opportunities".to_string()),
            strategy_type: StrategyType::Arbitrage,
            performance: 3.2,
            is_active: true,
            created_at: Utc::now() - chrono::Duration::days(10),
        };
        strategies.insert(strategy1.id, strategy1);
        
        let strategy2_id = Uuid::new_v4();
        let strategy2 = Strategy {
            id: strategy2_id,
            user_id,
            name: "Beta-3 Liquidity".to_string(),
            description: Some("Automated liquidity provision".to_string()),
            strategy_type: StrategyType::Liquidity,
            performance: 2.1,
            is_active: true,
            created_at: Utc::now() - chrono::Duration::days(8),
        };
        strategies.insert(strategy2.id, strategy2);
        
        let strategy3_id = Uuid::new_v4();
        let strategy3 = Strategy {
            id: strategy3_id,
            user_id,
            name: "Gamma-1 Momentum".to_string(),
            description: Some("Short-term trend following".to_string()),
            strategy_type: StrategyType::Momentum,
            performance: -0.8,
            is_active: true,
            created_at: Utc::now() - chrono::Duration::days(6),
        };
        strategies.insert(strategy3.id, strategy3);
        
        // Create sample transactions
        let transaction1 = Transaction {
            id: Uuid::new_v4(),
            wallet_id,
            strategy_id: Some(strategy1_id),
            transaction_type: TransactionType::Buy,
            amount: 1.24,
            status: TransactionStatus::Completed,
            profit: Some(0.06),
            timestamp: Utc::now() - chrono::Duration::hours(1),
        };
        transactions.insert(transaction1.id, transaction1);
        
        let transaction2 = Transaction {
            id: Uuid::new_v4(),
            wallet_id,
            strategy_id: Some(strategy2_id),
            transaction_type: TransactionType::Sell,
            amount: 3.5,
            status: TransactionStatus::Completed,
            profit: Some(0.12),
            timestamp: Utc::now() - chrono::Duration::hours(2),
        };
        transactions.insert(transaction2.id, transaction2);
        
        let transaction3 = Transaction {
            id: Uuid::new_v4(),
            wallet_id,
            strategy_id: Some(strategy3_id),
            transaction_type: TransactionType::Buy,
            amount: 0.75,
            status: TransactionStatus::Processing,
            profit: None,
            timestamp: Utc::now() - chrono::Duration::minutes(30),
        };
        transactions.insert(transaction3.id, transaction3);
        
        let transaction4 = Transaction {
            id: Uuid::new_v4(),
            wallet_id,
            strategy_id: Some(strategy1_id),
            transaction_type: TransactionType::Sell,
            amount: 2.1,
            status: TransactionStatus::Completed,
            profit: Some(-0.03),
            timestamp: Utc::now() - chrono::Duration::hours(3),
        };
        transactions.insert(transaction4.id, transaction4);
        
        info!("Initialized sample data");
    }
}