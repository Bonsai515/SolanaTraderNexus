use solana_client::rpc_client::RpcClient;
use solana_program::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    system_instruction,
};
use solana_sdk::{
    commitment_config::CommitmentConfig,
    compute_budget::ComputeBudgetInstruction,
    signature::{Keypair, Signature},
    signer::Signer,
    transaction::Transaction,
};
use std::{env, str::FromStr, sync::Arc, time::Duration};
use thiserror::Error;

/// Transaction priority levels with fee adjustment multipliers
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum TransactionPriority {
    Low,
    Medium,
    High,
    Critical,
}

/// Transaction engine errors
#[derive(Error, Debug)]
pub enum TransactionError {
    #[error("Failed to connect to Solana RPC: {0}")]
    ConnectionError(String),
    
    #[error("Failed to send transaction: {0}")]
    SendError(String),
    
    #[error("Failed to sign transaction: {0}")]
    SignError(String),
    
    #[error("Invalid wallet keypair: {0}")]
    InvalidKeypair(String),
    
    #[error("Failed to get recent blockhash: {0}")]
    BlockhashError(String),
    
    #[error("Transaction timed out")]
    Timeout,
    
    #[error("Insufficient funds: {0}")]
    InsufficientFunds(String),
    
    #[error("Transaction confirmation failed: {0}")]
    ConfirmationError(String),
}

/// Transaction result with signature and status information
#[derive(Debug, Clone)]
pub struct TransactionResult {
    pub success: bool,
    pub signature: Option<Signature>,
    pub error_message: Option<String>,
    pub block_time: Option<i64>,
    pub slot: Option<u64>,
    pub fee: Option<u64>,
}

/// The primary transaction engine that directly connects to the Solana blockchain
pub struct SolanaTransactionEngine {
    primary_client: Arc<RpcClient>,
    backup_clients: Vec<Arc<RpcClient>>,
    system_wallet: Pubkey,
    registered_wallets: Vec<Pubkey>,
    commitment: CommitmentConfig,
    successful_transactions: u64,
    failed_transactions: u64,
}

impl SolanaTransactionEngine {
    /// Create a new transaction engine with direct connection to Solana
    pub fn new() -> Result<Self, TransactionError> {
        // Get RPC URL from environment variables
        let primary_url = Self::get_best_rpc_url();
        
        println!("Initializing Solana transaction engine with RPC URL: {}", primary_url);
        
        // Get system wallet
        let system_wallet_str = env::var("SYSTEM_WALLET")
            .unwrap_or_else(|_| "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb".to_string());
        
        let system_wallet = Pubkey::from_str(&system_wallet_str)
            .map_err(|e| TransactionError::InvalidKeypair(e.to_string()))?;
        
        // Create primary client
        let commitment = CommitmentConfig::confirmed();
        let primary_client = Arc::new(RpcClient::new_with_commitment(
            primary_url.clone(),
            commitment,
        ));
        
        // Create backup clients
        let backup_clients = Self::setup_backup_clients();
        
        // Create and initialize the engine
        let mut engine = Self {
            primary_client,
            backup_clients,
            system_wallet,
            registered_wallets: Vec::new(),
            commitment,
            successful_transactions: 0,
            failed_transactions: 0,
        };
        
        // Register system wallet by default
        engine.register_wallet(system_wallet);
        
        // Verify the connection works
        match engine.primary_client.get_slot() {
            Ok(slot) => {
                println!("✅ Direct Solana connection verified! Current slot: {}", slot);
                Ok(engine)
            }
            Err(e) => {
                println!("❌ Failed to connect to Solana blockchain: {}", e);
                Err(TransactionError::ConnectionError(e.to_string()))
            }
        }
    }
    
    /// Get the best available RPC URL
    fn get_best_rpc_url() -> String {
        // Try InstantNodes first (highest performance)
        if let Ok(url) = env::var("INSTANT_NODES_RPC_URL") {
            return url;
        }
        
        // Try Alchemy next
        if let Ok(key) = env::var("SOLANA_RPC_API_KEY") {
            return format!("https://solana-mainnet.g.alchemy.com/v2/{}", key);
        }
        
        // Fallback to public RPC
        "https://api.mainnet-beta.solana.com".to_string()
    }
    
    /// Set up backup RPC clients
    fn setup_backup_clients() -> Vec<Arc<RpcClient>> {
        let mut backup_urls = Vec::new();
        
        // Add Alchemy if available
        if let Ok(key) = env::var("SOLANA_RPC_API_KEY") {
            backup_urls.push(format!("https://solana-mainnet.g.alchemy.com/v2/{}", key));
        }
        
        // Add Instant Nodes if available
        if let Ok(url) = env::var("INSTANT_NODES_RPC_URL") {
            backup_urls.push(url);
        }
        
        // Always add public RPC as last resort
        backup_urls.push("https://api.mainnet-beta.solana.com".to_string());
        
        // Create clients with connection timeout
        let commitment = CommitmentConfig::confirmed();
        backup_urls
            .into_iter()
            .map(|url| {
                println!("Adding backup Solana RPC connection: {}", url);
                Arc::new(RpcClient::new_with_commitment(url, commitment))
            })
            .collect()
    }
    
    /// Register a wallet for transaction execution and monitoring
    pub fn register_wallet(&mut self, pubkey: Pubkey) {
        if !self.registered_wallets.contains(&pubkey) {
            self.registered_wallets.push(pubkey);
            println!("Wallet {} registered for transaction execution and monitoring", pubkey);
            
            // Fetch initial balance
            match self.primary_client.get_balance(&pubkey) {
                Ok(balance) => {
                    let sol_balance = balance as f64 / 1_000_000_000.0;
                    println!("Initial balance: {} SOL", sol_balance);
                }
                Err(e) => {
                    println!("Failed to fetch initial balance: {}", e);
                }
            }
        }
    }
    
    /// Execute a transaction on the Solana blockchain
    pub fn execute_transaction(
        &mut self,
        instructions: Vec<Instruction>,
        signers: Vec<&Keypair>,
        priority: TransactionPriority,
    ) -> Result<TransactionResult, TransactionError> {
        if signers.is_empty() {
            return Err(TransactionError::SignError("No signers provided".to_string()));
        }
        
        // Get the fee payer (first signer)
        let fee_payer = signers[0];
        
        let priority_fee = match priority {
            TransactionPriority::Low => 10_000,
            TransactionPriority::Medium => 100_000,
            TransactionPriority::High => 1_000_000,
            TransactionPriority::Critical => 5_000_000,
        };
        
        // Add compute budget instructions for priority fee
        let mut all_instructions = vec![
            // Set compute unit limit
            ComputeBudgetInstruction::set_compute_unit_limit(200_000),
            // Set priority fee
            ComputeBudgetInstruction::set_compute_unit_price(priority_fee),
        ];
        
        // Add user instructions
        all_instructions.extend(instructions);
        
        // Get recent blockhash
        let blockhash = self
            .primary_client
            .get_latest_blockhash()
            .map_err(|e| TransactionError::BlockhashError(e.to_string()))?;
        
        // Create and sign transaction
        let mut transaction = Transaction::new_with_payer(&all_instructions, Some(&fee_payer.pubkey()));
        transaction.sign(signers, blockhash);
        
        println!("Sending transaction with priority: {:?} ({} microlamports)", priority, priority_fee);
        
        // Send transaction
        let signature = self
            .primary_client
            .send_transaction(&transaction)
            .map_err(|e| {
                // Check if it's a connection error
                if e.to_string().contains("failed to send transaction") || 
                   e.to_string().contains("timed out") || 
                   e.to_string().contains("rate limited") {
                    // Try with backup client
                    for (i, backup_client) in self.backup_clients.iter().enumerate() {
                        println!("Primary connection failed, trying backup connection {}...", i + 1);
                        match backup_client.send_transaction(&transaction) {
                            Ok(sig) => {
                                println!("Transaction sent successfully with backup connection!");
                                return Ok(sig);
                            }
                            Err(backup_err) => {
                                println!("Backup connection {} failed: {}", i + 1, backup_err);
                            }
                        }
                    }
                }
                
                Err(TransactionError::SendError(e.to_string()))
            })?;
        
        println!("Transaction signature: {}", signature);
        
        // Confirm transaction
        let timeout = Duration::from_secs(60);
        match self.primary_client.confirm_transaction_with_spinner(&signature, &self.commitment, timeout) {
            Ok(_) => {
                self.successful_transactions += 1;
                
                // Get transaction details
                let tx_details = self.primary_client.get_transaction(&signature, self.commitment.commitment);
                
                match tx_details {
                    Ok(confirmed_tx) => {
                        println!("✅ Transaction confirmed successfully!");
                        println!("🔗 View on Solscan: https://solscan.io/tx/{}", signature);
                        
                        Ok(TransactionResult {
                            success: true,
                            signature: Some(signature),
                            error_message: None,
                            block_time: confirmed_tx.block_time,
                            slot: Some(confirmed_tx.slot),
                            fee: confirmed_tx.meta.map(|m| m.fee),
                        })
                    }
                    Err(e) => {
                        println!("Transaction confirmed but failed to get details: {}", e);
                        
                        Ok(TransactionResult {
                            success: true,
                            signature: Some(signature),
                            error_message: None,
                            block_time: None,
                            slot: None,
                            fee: None,
                        })
                    }
                }
            }
            Err(e) => {
                self.failed_transactions += 1;
                
                println!("❌ Transaction failed: {}", e);
                
                Err(TransactionError::ConfirmationError(e.to_string()))
            }
        }
    }
    
    /// Get the balance of a wallet in SOL
    pub fn get_wallet_balance(&self, pubkey: &Pubkey) -> Result<f64, TransactionError> {
        match self.primary_client.get_balance(pubkey) {
            Ok(lamports) => {
                // Convert lamports to SOL
                let sol_balance = lamports as f64 / 1_000_000_000.0;
                Ok(sol_balance)
            }
            Err(e) => {
                // Try backup clients
                for (i, backup_client) in self.backup_clients.iter().enumerate() {
                    match backup_client.get_balance(pubkey) {
                        Ok(lamports) => {
                            let sol_balance = lamports as f64 / 1_000_000_000.0;
                            println!("Got balance from backup connection {}: {} SOL", i + 1, sol_balance);
                            return Ok(sol_balance);
                        }
                        Err(backup_err) => {
                            println!("Backup connection {} failed to get balance: {}", i + 1, backup_err);
                        }
                    }
                }
                
                Err(TransactionError::ConnectionError(e.to_string()))
            }
        }
    }
    
    /// Get transaction statistics
    pub fn get_stats(&self) -> (u64, u64) {
        (self.successful_transactions, self.failed_transactions)
    }
    
    /// Create a simple SOL transfer instruction
    pub fn create_transfer_instruction(
        &self,
        from_pubkey: &Pubkey,
        to_pubkey: &Pubkey,
        lamports: u64,
    ) -> Instruction {
        system_instruction::transfer(from_pubkey, to_pubkey, lamports)
    }
    
    /// Execute a simple SOL transfer
    pub fn transfer_sol(
        &mut self,
        from_keypair: &Keypair,
        to_pubkey: &Pubkey,
        sol_amount: f64,
        priority: TransactionPriority,
    ) -> Result<TransactionResult, TransactionError> {
        // Convert SOL to lamports
        let lamports = (sol_amount * 1_000_000_000.0) as u64;
        
        // Create transfer instruction
        let instruction = self.create_transfer_instruction(&from_keypair.pubkey(), to_pubkey, lamports);
        
        // Execute transaction
        self.execute_transaction(vec![instruction], vec![from_keypair], priority)
    }
}

/// Singleton accessor for the transaction engine
pub fn get_transaction_engine() -> Arc<std::sync::Mutex<SolanaTransactionEngine>> {
    static mut ENGINE: Option<Arc<std::sync::Mutex<SolanaTransactionEngine>>> = None;
    static INIT: std::sync::Once = std::sync::Once::new();
    
    unsafe {
        INIT.call_once(|| {
            match SolanaTransactionEngine::new() {
                Ok(engine) => {
                    ENGINE = Some(Arc::new(std::sync::Mutex::new(engine)));
                }
                Err(e) => {
                    panic!("Failed to initialize Solana transaction engine: {:?}", e);
                }
            }
        });
        
        ENGINE.clone().unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_engine_initialization() {
        let result = SolanaTransactionEngine::new();
        
        // This will only pass if we can connect to Solana
        assert!(result.is_ok(), "Failed to initialize transaction engine: {:?}", result.err());
    }
}