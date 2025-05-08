use crate::models::Wallet;
use crate::solana::SolanaConnection;
use anyhow::Result;
use log::{info, warn, error, debug};
use solana_sdk::{
    signature::{Keypair, Signer},
    pubkey::Pubkey,
    system_transaction,
};
use solana_client::rpc_client::RpcClient;
use std::sync::{Arc, RwLock, Mutex};
use std::collections::HashMap;
use std::str::FromStr;
use uuid::Uuid;
use chrono::Utc;

/// Wallet manager for Solana
pub struct WalletManager {
    // Solana connection
    solana_connection: Arc<SolanaConnection>,
    
    // Wallet keypairs (sensitive data)
    keypairs: RwLock<HashMap<Uuid, Keypair>>,
    
    // Wallet metadata
    wallets: RwLock<HashMap<Uuid, Wallet>>,
    
    // Balance update task
    balance_task: Mutex<Option<tokio::task::JoinHandle<()>>>,
}

impl WalletManager {
    /// Create a new wallet manager
    pub fn new(solana_connection: Arc<SolanaConnection>) -> Self {
        info!("Initializing Wallet Manager - Solana Wallet Interface");
        
        Self {
            solana_connection,
            keypairs: RwLock::new(HashMap::new()),
            wallets: RwLock::new(HashMap::new()),
            balance_task: Mutex::new(None),
        }
    }
    
    /// Start the wallet manager
    pub fn start(&self) -> Result<()> {
        info!("Starting Wallet Manager");
        
        // Start balance update task
        self.start_balance_update_task()?;
        
        Ok(())
    }
    
    /// Stop the wallet manager
    pub fn stop(&self) -> Result<()> {
        info!("Stopping Wallet Manager");
        
        // Stop balance update task
        let mut balance_task = self.balance_task.lock().unwrap();
        if let Some(task) = balance_task.take() {
            task.abort();
            debug!("Stopped balance update task");
        }
        
        Ok(())
    }
    
    /// Create a new wallet
    pub fn create_wallet(&self, name: &str) -> Result<Wallet> {
        // Generate new keypair
        let keypair = Keypair::new();
        let pubkey = keypair.pubkey();
        
        // Create wallet
        let wallet = Wallet {
            id: Uuid::new_v4(),
            name: name.to_string(),
            address: pubkey.to_string(),
            balance: 0.0,
            created_at: Utc::now(),
        };
        
        // Store keypair (sensitive!)
        let mut keypairs = self.keypairs.write().unwrap();
        keypairs.insert(wallet.id, keypair);
        
        // Store wallet metadata
        let mut wallets = self.wallets.write().unwrap();
        wallets.insert(wallet.id, wallet.clone());
        
        info!("Created new wallet: {} ({})", name, pubkey);
        
        Ok(wallet)
    }
    
    /// Import an existing wallet from private key
    pub fn import_wallet(&self, name: &str, private_key: &str) -> Result<Wallet> {
        // Parse private key
        let keypair = Keypair::from_base58_string(private_key);
        let pubkey = keypair.pubkey();
        
        // Create wallet
        let wallet = Wallet {
            id: Uuid::new_v4(),
            name: name.to_string(),
            address: pubkey.to_string(),
            balance: 0.0,
            created_at: Utc::now(),
        };
        
        // Store keypair (sensitive!)
        let mut keypairs = self.keypairs.write().unwrap();
        keypairs.insert(wallet.id, keypair);
        
        // Store wallet metadata
        let mut wallets = self.wallets.write().unwrap();
        wallets.insert(wallet.id, wallet.clone());
        
        info!("Imported wallet: {} ({})", name, pubkey);
        
        // Update balance
        match self.update_wallet_balance(&wallet.id) {
            Ok(_) => {},
            Err(e) => warn!("Failed to update balance for imported wallet: {}", e),
        }
        
        Ok(wallet)
    }
    
    /// Get a wallet by ID
    pub fn get_wallet(&self, id: &Uuid) -> Result<Option<Wallet>> {
        let wallets = self.wallets.read().unwrap();
        Ok(wallets.get(id).cloned())
    }
    
    /// Get all wallets
    pub fn get_all_wallets(&self) -> Result<Vec<Wallet>> {
        let wallets = self.wallets.read().unwrap();
        Ok(wallets.values().cloned().collect())
    }
    
    /// Update wallet balance
    pub fn update_wallet_balance(&self, id: &Uuid) -> Result<f64> {
        // Get wallet
        let wallets = self.wallets.read().unwrap();
        let wallet = wallets.get(id).ok_or_else(|| {
            anyhow::anyhow!("Wallet not found: {:?}", id)
        })?;
        
        // Get Solana RPC client
        let client = self.solana_connection.get_client()?;
        
        // Parse pubkey
        let pubkey = Pubkey::from_str(&wallet.address)?;
        
        // Get balance
        let lamports = client.get_balance(&pubkey)?;
        let sol_balance = lamports as f64 / 1_000_000_000.0; // lamports to SOL
        
        // Update wallet balance
        {
            let mut wallets = self.wallets.write().unwrap();
            if let Some(wallet) = wallets.get_mut(id) {
                wallet.balance = sol_balance;
            }
        }
        
        debug!("Updated wallet balance: {} SOL for {}", sol_balance, wallet.name);
        
        Ok(sol_balance)
    }
    
    /// Send SOL from one wallet to another
    pub async fn send_sol(
        &self,
        from_wallet_id: &Uuid,
        to_address: &str,
        amount_sol: f64,
    ) -> Result<String> {
        // Check if amount is valid
        if amount_sol <= 0.0 {
            return Err(anyhow::anyhow!("Invalid amount: {}", amount_sol));
        }
        
        // Get sender wallet and keypair
        let keypairs = self.keypairs.read().unwrap();
        let keypair = keypairs.get(from_wallet_id).ok_or_else(|| {
            anyhow::anyhow!("Wallet not found: {:?}", from_wallet_id)
        })?;
        
        // Get current balance
        let wallets = self.wallets.read().unwrap();
        let wallet = wallets.get(from_wallet_id).ok_or_else(|| {
            anyhow::anyhow!("Wallet not found: {:?}", from_wallet_id)
        })?;
        
        // Check sufficient balance
        if wallet.balance < amount_sol {
            return Err(anyhow::anyhow!(
                "Insufficient balance: {} < {}", wallet.balance, amount_sol
            ));
        }
        
        // Parse recipient address
        let to_pubkey = Pubkey::from_str(to_address)?;
        
        // Calculate lamports
        let lamports = (amount_sol * 1_000_000_000.0) as u64;
        
        // Get Solana RPC client
        let client = self.solana_connection.get_client()?;
        
        // Get recent blockhash
        let blockhash = self.solana_connection.get_recent_blockhash()?;
        
        // Create transaction
        let transaction = system_transaction::transfer(
            keypair,
            &to_pubkey,
            lamports,
            blockhash,
        );
        
        // Send transaction
        let signature = client.send_and_confirm_transaction(&transaction)?;
        
        info!("Sent {} SOL from {} to {}: {}",
             amount_sol, wallet.name, to_address, signature);
        
        // Update sender balance
        self.update_wallet_balance(from_wallet_id)?;
        
        Ok(signature.to_string())
    }
    
    /// Export private key for a wallet (sensitive operation!)
    pub fn export_private_key(&self, id: &Uuid) -> Result<String> {
        warn!("Exporting private key for wallet: {:?}", id);
        
        // Get keypair
        let keypairs = self.keypairs.read().unwrap();
        let keypair = keypairs.get(id).ok_or_else(|| {
            anyhow::anyhow!("Wallet not found: {:?}", id)
        })?;
        
        // Get private key as base58
        Ok(keypair.to_base58_string())
    }
    
    /// Get the public key for a wallet
    pub fn get_public_key(&self, id: &Uuid) -> Result<String> {
        // Get wallet
        let wallets = self.wallets.read().unwrap();
        let wallet = wallets.get(id).ok_or_else(|| {
            anyhow::anyhow!("Wallet not found: {:?}", id)
        })?;
        
        Ok(wallet.address.clone())
    }
    
    /// Start the balance update task
    fn start_balance_update_task(&self) -> Result<()> {
        let wallet_manager = Arc::new(self.clone());
        
        let task = tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(60));
            
            loop {
                interval.tick().await;
                
                // Get all wallet IDs
                let wallet_ids = {
                    let wallets = wallet_manager.wallets.read().unwrap();
                    wallets.keys().cloned().collect::<Vec<_>>()
                };
                
                // Update balance for each wallet
                for id in wallet_ids {
                    if let Err(e) = wallet_manager.update_wallet_balance(&id) {
                        warn!("Failed to update wallet balance: {}", e);
                    }
                }
            }
        });
        
        let mut balance_task = self.balance_task.lock().unwrap();
        *balance_task = Some(task);
        
        Ok(())
    }
}

impl Clone for WalletManager {
    fn clone(&self) -> Self {
        // Create new instance but share the keypairs and wallets
        Self {
            solana_connection: self.solana_connection.clone(),
            keypairs: self.keypairs.clone(),
            wallets: self.wallets.clone(),
            balance_task: Mutex::new(None),
        }
    }
}