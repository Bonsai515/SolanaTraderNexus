// Agent wallet generator module
// Provides self-generating wallets for agent strategies

use anyhow::{Result, anyhow, Context};
use log::{info, warn, error, debug};
use serde::{Serialize, Deserialize};
use std::sync::{Arc, RwLock, Mutex};
use std::collections::HashMap;
use solana_sdk::signature::{Keypair, Signer};
use solana_sdk::pubkey::Pubkey;
use std::str::FromStr;
use chrono::{DateTime, Utc};

use crate::solana::wallet_manager::WalletManager;
use crate::solana::transaction_manager::TransactionManager;

/// Wallet purpose enum
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum WalletPurpose {
    /// For main trading operations
    Trading,
    
    /// For holding profits
    ProfitVault,
    
    /// For fee payment
    FeePayment,
    
    /// For flash loans
    FlashLoan,
    
    /// For stealth operations (avoid front-running)
    Stealth,
    
    /// For cross-chain bridging
    Bridge,
    
    /// For token creation
    TokenCreation,
}

/// Agent wallet details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentWallet {
    /// Wallet ID
    pub id: String,
    
    /// Purpose
    pub purpose: WalletPurpose,
    
    /// Public key
    pub public_key: String,
    
    /// Agent ID that owns this wallet
    pub agent_id: String,
    
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    
    /// Last used timestamp
    pub last_used: Option<DateTime<Utc>>,
    
    /// Balance (cache)
    pub cached_balance: Option<f64>,
}

/// Agent wallet system
pub struct WalletGenerator {
    /// Main wallet manager
    wallet_manager: Arc<WalletManager>,
    
    /// Transaction manager
    tx_manager: Arc<TransactionManager>,
    
    /// Agent wallets by agent ID
    agent_wallets: RwLock<HashMap<String, HashMap<WalletPurpose, AgentWallet>>>,
}

impl WalletGenerator {
    /// Create a new wallet generator
    pub fn new(
        wallet_manager: Arc<WalletManager>,
        tx_manager: Arc<TransactionManager>,
    ) -> Self {
        Self {
            wallet_manager,
            tx_manager,
            agent_wallets: RwLock::new(HashMap::new()),
        }
    }
    
    /// Initialize wallets for an agent
    pub fn initialize_agent_wallets(&self, agent_id: &str) -> Result<()> {
        info!("Initializing wallets for agent: {}", agent_id);
        
        let mut agent_wallets = self.agent_wallets.write().unwrap();
        
        // Create new entry if needed
        if !agent_wallets.contains_key(agent_id) {
            agent_wallets.insert(agent_id.to_string(), HashMap::new());
        }
        
        let wallets = agent_wallets.get_mut(agent_id).unwrap();
        
        // Create wallets for each purpose if not existing
        for purpose in &[
            WalletPurpose::Trading,
            WalletPurpose::ProfitVault,
            WalletPurpose::FeePayment,
            WalletPurpose::Stealth,
        ] {
            if !wallets.contains_key(purpose) {
                let wallet = self.create_wallet_for_purpose(agent_id, *purpose)?;
                wallets.insert(*purpose, wallet);
            }
        }
        
        info!("Created {} wallets for agent {}", wallets.len(), agent_id);
        
        Ok(())
    }
    
    /// Create a wallet for specific purpose
    fn create_wallet_for_purpose(&self, agent_id: &str, purpose: WalletPurpose) -> Result<AgentWallet> {
        // Generate wallet ID with agent prefix
        let wallet_id = format!("{}_{}_{}", 
                              agent_id, 
                              self.purpose_to_string(purpose).to_lowercase(),
                              uuid::Uuid::new_v4().to_string().split('-').next().unwrap());
        
        // Generate wallet name
        let wallet_name = format!("Agent {} {} Wallet", 
                                agent_id, 
                                self.purpose_to_string(purpose));
        
        // Create underlying wallet
        let wallet = self.wallet_manager.create_wallet(&wallet_id, &wallet_name)?;
        
        info!("Created {} wallet for agent {}: {}", 
             self.purpose_to_string(purpose), agent_id, wallet.public_key);
        
        // Create agent wallet
        let agent_wallet = AgentWallet {
            id: wallet_id,
            purpose,
            public_key: wallet.public_key.clone(),
            agent_id: agent_id.to_string(),
            created_at: Utc::now(),
            last_used: None,
            cached_balance: None,
        };
        
        Ok(agent_wallet)
    }
    
    /// Get wallet for agent by purpose
    pub fn get_wallet(&self, agent_id: &str, purpose: WalletPurpose) -> Result<AgentWallet> {
        let agent_wallets = self.agent_wallets.read().unwrap();
        
        let wallets = agent_wallets.get(agent_id)
            .ok_or_else(|| anyhow!("No wallets found for agent: {}", agent_id))?;
        
        let wallet = wallets.get(&purpose)
            .ok_or_else(|| anyhow!("No {} wallet found for agent: {}", 
                                 self.purpose_to_string(purpose), agent_id))?;
        
        Ok(wallet.clone())
    }
    
    /// Create stealth wallet (temporary, single-use)
    pub fn create_stealth_wallet(&self, agent_id: &str) -> Result<AgentWallet> {
        info!("Creating stealth wallet for agent: {}", agent_id);
        
        // Generate stealth wallet
        let stealth_id = format!("{}_stealth_{}", 
                               agent_id,
                               uuid::Uuid::new_v4().to_string());
        
        let stealth_name = format!("Agent {} Stealth Wallet", agent_id);
        
        // Create underlying wallet
        let wallet = self.wallet_manager.create_wallet(&stealth_id, &stealth_name)?;
        
        // Create agent wallet
        let agent_wallet = AgentWallet {
            id: stealth_id,
            purpose: WalletPurpose::Stealth,
            public_key: wallet.public_key.clone(),
            agent_id: agent_id.to_string(),
            created_at: Utc::now(),
            last_used: None,
            cached_balance: None,
        };
        
        info!("Created stealth wallet: {}", agent_wallet.public_key);
        
        Ok(agent_wallet)
    }
    
    /// Get keypair for wallet
    pub fn get_wallet_keypair(&self, wallet_id: &str) -> Result<Keypair> {
        self.wallet_manager.get_wallet_keypair(wallet_id)
    }
    
    /// Update wallet balance
    pub fn update_wallet_balance(&self, wallet_id: &str) -> Result<f64> {
        // Get public key from wallet manager
        let wallet_info = self.wallet_manager.get_wallet(wallet_id)?;
        let pubkey = Pubkey::from_str(&wallet_info.public_key)?;
        
        // Get RPC client
        let rpc_client = self.tx_manager.get_rpc_client()?;
        
        // Get balance
        let lamports = rpc_client.get_balance(&pubkey)?;
        let sol_balance = lamports as f64 / 1_000_000_000.0;
        
        // Update wallet
        self.wallet_manager.update_wallet_balance(wallet_id, sol_balance)?;
        
        // Update agent wallet if needed
        let mut agent_wallets = self.agent_wallets.write().unwrap();
        for agent_wallets_map in agent_wallets.values_mut() {
            for agent_wallet in agent_wallets_map.values_mut() {
                if agent_wallet.id == wallet_id {
                    agent_wallet.cached_balance = Some(sol_balance);
                    break;
                }
            }
        }
        
        Ok(sol_balance)
    }
    
    /// Update last used timestamp
    pub fn update_last_used(&self, agent_id: &str, purpose: WalletPurpose) -> Result<()> {
        let mut agent_wallets = self.agent_wallets.write().unwrap();
        
        let wallets = agent_wallets.get_mut(agent_id)
            .ok_or_else(|| anyhow!("No wallets found for agent: {}", agent_id))?;
        
        let wallet = wallets.get_mut(&purpose)
            .ok_or_else(|| anyhow!("No {} wallet found for agent: {}", 
                                 self.purpose_to_string(purpose), agent_id))?;
        
        wallet.last_used = Some(Utc::now());
        
        Ok(())
    }
    
    /// Convert wallet purpose to string
    fn purpose_to_string(&self, purpose: WalletPurpose) -> String {
        match purpose {
            WalletPurpose::Trading => "Trading",
            WalletPurpose::ProfitVault => "Profit Vault",
            WalletPurpose::FeePayment => "Fee Payment",
            WalletPurpose::FlashLoan => "Flash Loan",
            WalletPurpose::Stealth => "Stealth",
            WalletPurpose::Bridge => "Bridge",
            WalletPurpose::TokenCreation => "Token Creation",
        }.to_string()
    }
}