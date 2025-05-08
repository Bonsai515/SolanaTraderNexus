use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    system_instruction,
    transaction::Transaction as SolanaTransaction,
};
use anyhow::{Result, Context};
use log::{info, error, warn};
use std::sync::{Arc, Mutex};
use std::str::FromStr;
use crate::models::{Wallet, WalletType, Transaction, TransactionType, TransactionStatus};
use crate::storage::Storage;
use uuid::Uuid;
use chrono::Utc;

/// Wallet manager for Solana operations
pub struct WalletManager {
    client: Arc<Mutex<RpcClient>>,
    storage: Arc<Storage>,
}

impl WalletManager {
    /// Create a new wallet manager
    pub fn new(client: Arc<Mutex<RpcClient>>, storage: Arc<Storage>) -> Self {
        Self { client, storage }
    }
    
    /// Get wallet information by address
    pub async fn get_wallet_by_address(&self, address: &str) -> Result<Wallet> {
        // First try to get wallet from storage
        if let Some(wallet) = self.storage.get_wallet_by_address(address).await? {
            return Ok(wallet);
        }
        
        Err(anyhow::anyhow!("Wallet not found: {}", address))
    }
    
    /// Get wallet information by ID
    pub async fn get_wallet(&self, id: Uuid) -> Result<Wallet> {
        self.storage.get_wallet(id).await?
            .ok_or_else(|| anyhow::anyhow!("Wallet not found: {}", id))
    }
    
    /// Create a new wallet
    pub async fn create_wallet(&self, user_id: Uuid) -> Result<Wallet> {
        // Generate a new Solana keypair
        let keypair = Keypair::new();
        let address = keypair.pubkey().to_string();
        
        // In a real application, you would securely store the private key
        // Here we just log a warning
        warn!("Private key not securely stored for wallet: {}", address);
        
        // Store wallet in database
        let wallet = self.storage.create_wallet(
            user_id,
            &address,
            0.0,
            WalletType::Secondary
        ).await?;
        
        info!("Created new wallet with address: {}", address);
        Ok(wallet)
    }
    
    /// Update wallet balance
    pub async fn update_wallet_balance(&self, id: Uuid, new_balance: f64) -> Result<Wallet> {
        self.storage.update_wallet_balance(id, new_balance).await?
            .ok_or_else(|| anyhow::anyhow!("Wallet not found: {}", id))
    }
    
    /// Get current balance from blockchain
    pub async fn get_blockchain_balance(&self, address: &str) -> Result<f64> {
        let pubkey = Pubkey::from_str(address)
            .context("Invalid wallet address")?;
            
        let client = self.client.lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire lock: {}", e))?;
            
        let lamports = client.get_balance(&pubkey)
            .context("Failed to get balance")?;
            
        // Convert lamports to SOL (1 SOL = 1,000,000,000 lamports)
        let sol_balance = lamports as f64 / 1_000_000_000.0;
        
        Ok(sol_balance)
    }
    
    /// Deposit funds to wallet
    pub async fn deposit(&self, wallet_id: Uuid, amount: f64) -> Result<Transaction> {
        // Get current wallet
        let wallet = self.storage.get_wallet(wallet_id).await?
            .ok_or_else(|| anyhow::anyhow!("Wallet not found: {}", wallet_id))?;
            
        // In a real app, this would validate the deposit on the blockchain
        // For now, we'll just update the balance directly
        let new_balance = wallet.balance + amount;
        self.storage.update_wallet_balance(wallet_id, new_balance).await?;
        
        // Record the deposit transaction
        let transaction = self.storage.create_transaction(
            wallet_id,
            None,
            TransactionType::Deposit,
            amount,
            TransactionStatus::Completed,
            None,
            Utc::now(),
        ).await?;
        
        info!("Deposit of {} SOL to wallet {} completed", amount, wallet.address);
        Ok(transaction)
    }
    
    /// Withdraw funds from wallet
    pub async fn withdraw(&self, wallet_id: Uuid, amount: f64) -> Result<Transaction> {
        // Get current wallet
        let wallet = self.storage.get_wallet(wallet_id).await?
            .ok_or_else(|| anyhow::anyhow!("Wallet not found: {}", wallet_id))?;
            
        // Check if wallet has sufficient funds
        if wallet.balance < amount {
            return Err(anyhow::anyhow!("Insufficient funds"));
        }
        
        // In a real app, this would execute a blockchain transaction
        // For now, we'll just update the balance directly
        let new_balance = wallet.balance - amount;
        self.storage.update_wallet_balance(wallet_id, new_balance).await?;
        
        // Record the withdrawal transaction
        let transaction = self.storage.create_transaction(
            wallet_id,
            None,
            TransactionType::Withdraw,
            amount,
            TransactionStatus::Completed,
            None,
            Utc::now(),
        ).await?;
        
        info!("Withdrawal of {} SOL from wallet {} completed", amount, wallet.address);
        Ok(transaction)
    }
    
    /// Transfer funds to another wallet
    pub async fn transfer(&self, from_wallet_id: Uuid, to_address: &str, amount: f64) -> Result<Transaction> {
        // Get source wallet
        let source_wallet = self.storage.get_wallet(from_wallet_id).await?
            .ok_or_else(|| anyhow::anyhow!("Source wallet not found: {}", from_wallet_id))?;
            
        // Check if wallet has sufficient funds
        if source_wallet.balance < amount {
            return Err(anyhow::anyhow!("Insufficient funds"));
        }
        
        // In a real app, this would execute a blockchain transaction
        // For now, we'll just update the balance directly
        let new_balance = source_wallet.balance - amount;
        self.storage.update_wallet_balance(from_wallet_id, new_balance).await?;
        
        // If the recipient wallet is in our system, update its balance too
        if let Some(recipient_wallet) = self.storage.get_wallet_by_address(to_address).await? {
            let recipient_new_balance = recipient_wallet.balance + amount;
            self.storage.update_wallet_balance(recipient_wallet.id, recipient_new_balance).await?;
        }
        
        // Record the transfer transaction
        let transaction = self.storage.create_transaction(
            from_wallet_id,
            None,
            TransactionType::Transfer,
            amount,
            TransactionStatus::Completed,
            None,
            Utc::now(),
        ).await?;
        
        info!("Transfer of {} SOL from wallet {} to {} completed", 
            amount, source_wallet.address, to_address);
        Ok(transaction)
    }
    
    /// Create and sign a Solana transfer transaction (not sending)
    pub fn create_transfer_transaction(
        &self,
        from_keypair: &Keypair,
        to_pubkey: &Pubkey,
        amount_sol: f64,
    ) -> Result<SolanaTransaction> {
        let client = self.client.lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire lock: {}", e))?;
            
        // Convert SOL to lamports
        let lamports = (amount_sol * 1_000_000_000.0) as u64;
        
        // Get recent blockhash
        let recent_blockhash = client.get_latest_blockhash()
            .context("Failed to get recent blockhash")?;
            
        // Create transfer instruction
        let instruction = system_instruction::transfer(
            &from_keypair.pubkey(),
            to_pubkey,
            lamports,
        );
        
        // Create and sign transaction
        let transaction = SolanaTransaction::new_signed_with_payer(
            &[instruction],
            Some(&from_keypair.pubkey()),
            &[from_keypair],
            recent_blockhash,
        );
        
        Ok(transaction)
    }
    
    /// Utility function to format SOL amount
    pub fn format_sol_amount(amount: f64) -> String {
        format!("{:.2} SOL", amount)
    }
    
    /// Utility function to shorten address
    pub fn shorten_address(address: &str, chars: usize) -> String {
        if address.len() <= chars * 2 {
            return address.to_string();
        }
        
        let start = &address[..chars];
        let end = &address[address.len() - chars..];
        format!("{}...{}", start, end)
    }
}