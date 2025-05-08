// Wallet model

use serde::{Serialize, Deserialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use std::collections::HashMap;

/// Wallet type for different purposes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum WalletType {
    /// Main trading wallet
    Trading,
    
    /// Wallet for holding collateral
    Collateral,
    
    /// Wallet for collecting fees/profits
    Profit,
    
    /// Wallet for smart contract interaction
    Contract,
    
    /// Temporary wallet
    Temporary,
}

impl std::fmt::Display for WalletType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            WalletType::Trading => write!(f, "TRADING"),
            WalletType::Collateral => write!(f, "COLLATERAL"),
            WalletType::Profit => write!(f, "PROFIT"),
            WalletType::Contract => write!(f, "CONTRACT"),
            WalletType::Temporary => write!(f, "TEMPORARY"),
        }
    }
}

/// Represents a cryptocurrency wallet
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Wallet {
    /// Unique identifier
    pub id: String,
    
    /// Wallet name (optional)
    pub name: Option<String>,
    
    /// Wallet purpose
    pub wallet_type: WalletType,
    
    /// Solana address (base58 encoded)
    pub address: String,
    
    /// Public key bytes (optional)
    #[serde(skip_serializing)]
    pub public_key: Option<Vec<u8>>,
    
    /// Encrypted private key (optional)
    #[serde(skip_serializing)]
    pub encrypted_private_key: Option<Vec<u8>>,
    
    /// Current balances (token symbol -> amount)
    pub balances: HashMap<String, f64>,
    
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    
    /// Last update timestamp
    pub updated_at: DateTime<Utc>,
}

impl Wallet {
    /// Create a new wallet
    pub fn new(
        name: Option<String>,
        wallet_type: WalletType,
        address: String,
        public_key: Option<Vec<u8>>,
        encrypted_private_key: Option<Vec<u8>>,
    ) -> Self {
        let now = Utc::now();
        
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            wallet_type,
            address,
            public_key,
            encrypted_private_key,
            balances: HashMap::new(),
            created_at: now,
            updated_at: now,
        }
    }
    
    /// Update wallet balance for a token
    pub fn update_balance(&mut self, token: &str, amount: f64) {
        self.balances.insert(token.to_string(), amount);
        self.updated_at = Utc::now();
    }
    
    /// Get wallet balance for a token
    pub fn get_balance(&self, token: &str) -> f64 {
        *self.balances.get(token).unwrap_or(&0.0)
    }
    
    /// Check if wallet has sufficient balance
    pub fn has_sufficient_balance(&self, token: &str, amount: f64) -> bool {
        self.get_balance(token) >= amount
    }
    
    /// Get total wallet value in USD (if balance contains USD-pegged tokens)
    pub fn get_total_value_usd(&self) -> f64 {
        let usd_tokens = ["USDC", "USDT", "DAI", "BUSD", "TUSD"];
        
        let mut total = 0.0;
        
        for token in usd_tokens.iter() {
            total += self.get_balance(token);
        }
        
        total
    }
}