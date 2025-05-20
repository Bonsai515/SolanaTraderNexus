use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    signature::Signature,
    transaction::Transaction as SolanaTransaction,
};
use anyhow::{Result, Context};
use log::{info, error, warn};
use std::sync::{Arc, Mutex};
use std::str::FromStr;
use crate::models::{
    Transaction, TransactionType, TransactionStatus, 
    FormattedTransaction, StrategyInfo
};
use crate::storage::Storage;
use uuid::Uuid;
use chrono::Utc;

/// Transaction manager for Solana operations
pub struct TransactionManager {
    client: Arc<Mutex<RpcClient>>,
    storage: Arc<Storage>,
}

impl TransactionManager {
    /// Create a new transaction manager
    pub fn new(client: Arc<Mutex<RpcClient>>, storage: Arc<Storage>) -> Self {
        Self { client, storage }
    }
    
    /// Get transaction by id
    pub async fn get_transaction(&self, id: Uuid) -> Result<Transaction> {
        self.storage.get_transaction(id).await?
            .ok_or_else(|| anyhow::anyhow!("Transaction not found: {}", id))
    }
    
    /// Get transactions by wallet id
    pub async fn get_transactions_by_wallet(&self, wallet_id: Uuid) -> Result<Vec<Transaction>> {
        self.storage.get_transactions_by_wallet_id(wallet_id).await
    }
    
    /// Get recent transactions
    pub async fn get_recent_transactions(&self, limit: usize) -> Result<Vec<Transaction>> {
        self.storage.get_recent_transactions(limit).await
    }
    
    /// Format transactions for frontend display
    pub async fn format_transactions(&self, transactions: Vec<Transaction>) -> Result<Vec<FormattedTransaction>> {
        let mut formatted_transactions = Vec::with_capacity(transactions.len());
        
        for tx in transactions {
            let strategy_name = if let Some(strategy_id) = tx.strategy_id {
                if let Some(strategy) = self.storage.get_strategy(strategy_id).await? {
                    strategy.name
                } else {
                    format!("Strategy-{}", strategy_id)
                }
            } else {
                "Direct".to_string()
            };
            
            let strategy_info = StrategyInfo {
                name: strategy_name,
                icon: "smart_toy".to_string(),
                color: self.get_strategy_color(&tx),
            };
            
            formatted_transactions.push(FormattedTransaction {
                id: tx.id.to_string(),
                strategy: strategy_info,
                transaction_type: tx.transaction_type,
                amount: format!("{:.2} SOL", tx.amount),
                status: tx.status,
                profit: tx.profit.map(|p| {
                    if p > 0.0 {
                        format!("+{:.2} SOL", p)
                    } else {
                        format!("{:.2} SOL", p)
                    }
                }),
                timestamp: tx.timestamp,
            });
        }
        
        Ok(formatted_transactions)
    }
    
    /// Execute a transaction on behalf of a strategy
    pub async fn execute_transaction(
        &self,
        wallet_id: Uuid,
        strategy_id: Option<Uuid>,
        transaction_type: TransactionType,
        amount: f64
    ) -> Result<Transaction> {
        // Validate input
        if amount <= 0.0 {
            return Err(anyhow::anyhow!("Amount must be positive"));
        }
        
        // Get wallet
        let wallet = self.storage.get_wallet(wallet_id).await?
            .ok_or_else(|| anyhow::anyhow!("Wallet not found: {}", wallet_id))?;
            
        // Check if wallet has sufficient funds for sells or transfers
        if matches!(transaction_type, TransactionType::Sell | TransactionType::Transfer) 
            && wallet.balance < amount {
            return Err(anyhow::anyhow!("Insufficient funds"));
        }
        
        // Create a pending transaction first
        let transaction = self.storage.create_transaction(
            wallet_id,
            strategy_id,
            transaction_type,
            amount,
            TransactionStatus::Processing,
            None,
            Utc::now(),
        ).await?;
        
        info!("Created transaction: {:?}", transaction);
        
        // In a real app, this would submit the transaction to the blockchain
        // and update the status based on blockchain confirmation
        
        // For now, we'll simulate the process with a delay
        // In a production app, this would be handled by a separate worker
        
        // Update the transaction status to completed with a simulated profit
        let profit = match transaction_type {
            TransactionType::Buy => Some(amount * 0.05), // 5% profit for buys
            TransactionType::Sell => Some(amount * 0.08), // 8% profit for sells
            _ => None,
        };
        
        // Update transaction
        let completed_transaction = self.storage.update_transaction_status(
            transaction.id,
            TransactionStatus::Completed,
            profit,
        ).await?;
        
        // Update wallet balance
        match transaction_type {
            TransactionType::Buy => {
                // In a real app, this would calculate the actual token amount received
                // For simulation, we'll adjust the balance by the full amount
                self.storage.update_wallet_balance(
                    wallet_id, 
                    wallet.balance - amount
                ).await?;
            },
            TransactionType::Sell => {
                // Add the sell amount plus profit to the wallet
                self.storage.update_wallet_balance(
                    wallet_id, 
                    wallet.balance + amount + profit.unwrap_or(0.0)
                ).await?;
            },
            _ => {}
        }
        
        Ok(completed_transaction)
    }
    
    /// Submit a pre-signed transaction to the blockchain
    pub async fn submit_transaction(&self, transaction: SolanaTransaction) -> Result<Signature> {
        let client = self.client.lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire lock: {}", e))?;
            
        client.send_and_confirm_transaction(&transaction)
            .context("Failed to send transaction")
    }
    
    /// Helper function to get strategy color based on transaction
    fn get_strategy_color(&self, transaction: &Transaction) -> String {
        if let Some(strategy_id) = transaction.strategy_id {
            // Return color based on strategy id
            match strategy_id.to_string().as_str().chars().next() {
                Some('1') => "info".to_string(),
                Some('2') => "warning".to_string(),
                Some('3') => "danger".to_string(),
                _ => "primary".to_string(),
            }
        } else {
            // Default color for direct transactions
            match transaction.transaction_type {
                TransactionType::Deposit => "success".to_string(),
                TransactionType::Withdraw => "danger".to_string(),
                TransactionType::Transfer => "warning".to_string(),
                TransactionType::Buy => "info".to_string(),
                TransactionType::Sell => "danger".to_string(),
            }
        }
    }
}