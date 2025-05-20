use crate::models::{Strategy, Transaction, Wallet};
use anyhow::Result;
use uuid::Uuid;
use log::{info, warn, error, debug};
use std::sync::{Arc, RwLock};
use std::collections::HashMap;
use chrono::Utc;

/// Storage system for persisting data
pub struct Storage {
    // In-memory storage for strategies
    strategies: RwLock<HashMap<Uuid, Strategy>>,
    
    // In-memory storage for transactions
    transactions: RwLock<HashMap<Uuid, Transaction>>,
    
    // In-memory storage for wallets
    wallets: RwLock<HashMap<Uuid, Wallet>>,
}

impl Storage {
    /// Create a new storage system
    pub fn new() -> Self {
        info!("Initializing Storage System");
        
        Self {
            strategies: RwLock::new(HashMap::new()),
            transactions: RwLock::new(HashMap::new()),
            wallets: RwLock::new(HashMap::new()),
        }
    }
    
    /// Save a strategy
    pub async fn save_strategy(&self, strategy: Strategy) -> Result<()> {
        let mut strategies = self.strategies.write().unwrap();
        strategies.insert(strategy.id, strategy);
        Ok(())
    }
    
    /// Get a strategy by ID
    pub async fn get_strategy(&self, id: &Uuid) -> Result<Option<Strategy>> {
        let strategies = self.strategies.read().unwrap();
        Ok(strategies.get(id).cloned())
    }
    
    /// Get all active strategies
    pub async fn get_active_strategies(&self) -> Result<Vec<Strategy>> {
        let strategies = self.strategies.read().unwrap();
        let active = strategies.values()
            .filter(|s| s.enabled)
            .cloned()
            .collect();
        Ok(active)
    }
    
    /// Save a transaction
    pub async fn save_transaction(&self, transaction: Transaction) -> Result<()> {
        let mut transactions = self.transactions.write().unwrap();
        transactions.insert(transaction.id, transaction);
        Ok(())
    }
    
    /// Get a transaction by ID
    pub async fn get_transaction(&self, id: &Uuid) -> Result<Option<Transaction>> {
        let transactions = self.transactions.read().unwrap();
        Ok(transactions.get(id).cloned())
    }
    
    /// Get transactions for a wallet
    pub async fn get_wallet_transactions(&self, wallet_id: &Uuid) -> Result<Vec<Transaction>> {
        let transactions = self.transactions.read().unwrap();
        let wallet_txs = transactions.values()
            .filter(|t| t.wallet_id == *wallet_id)
            .cloned()
            .collect();
        Ok(wallet_txs)
    }
    
    /// Get transactions for a strategy
    pub async fn get_strategy_transactions(&self, strategy_id: &Uuid) -> Result<Vec<Transaction>> {
        let transactions = self.transactions.read().unwrap();
        let strategy_txs = transactions.values()
            .filter(|t| t.strategy_id.as_ref() == Some(strategy_id))
            .cloned()
            .collect();
        Ok(strategy_txs)
    }
    
    /// Save a wallet
    pub async fn save_wallet(&self, wallet: Wallet) -> Result<()> {
        let mut wallets = self.wallets.write().unwrap();
        wallets.insert(wallet.id, wallet);
        Ok(())
    }
    
    /// Get a wallet by ID
    pub async fn get_wallet(&self, id: &Uuid) -> Result<Option<Wallet>> {
        let wallets = self.wallets.read().unwrap();
        Ok(wallets.get(id).cloned())
    }
    
    /// Get a wallet by address
    pub async fn get_wallet_by_address(&self, address: &str) -> Result<Option<Wallet>> {
        let wallets = self.wallets.read().unwrap();
        let wallet = wallets.values()
            .find(|w| w.address == address)
            .cloned();
        Ok(wallet)
    }
    
    /// Get all wallets
    pub async fn get_all_wallets(&self) -> Result<Vec<Wallet>> {
        let wallets = self.wallets.read().unwrap();
        let all_wallets = wallets.values().cloned().collect();
        Ok(all_wallets)
    }
}