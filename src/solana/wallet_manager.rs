// Wallet management for Solana accounts

use anyhow::{Result, anyhow, Context};
use log::{info, warn, error, debug};
use serde::{Serialize, Deserialize};
use std::sync::{Arc, RwLock};
use std::collections::HashMap;
use std::path::PathBuf;
use std::fs;
use std::io::{Read, Write};

use solana_sdk::signature::{Keypair, Signer};
use solana_sdk::pubkey::Pubkey;
use ring::aead::{Aad, BoundKey, Nonce, NonceSequence, UnboundKey, CHACHA20_POLY1305};
use ring::rand::{SecureRandom, SystemRandom};

/// Wallet encryption nonce sequence
struct WalletNonceSequence {
    nonce: [u8; 12],
}

impl WalletNonceSequence {
    fn new() -> Self {
        let mut nonce = [0u8; 12];
        let rng = SystemRandom::new();
        rng.fill(&mut nonce).expect("Failed to generate nonce");
        Self { nonce }
    }
}

impl NonceSequence for WalletNonceSequence {
    fn advance(&mut self) -> std::result::Result<Nonce, ring::error::Unspecified> {
        Ok(Nonce::assume_unique_for_key(self.nonce))
    }
}

/// Wallet data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletData {
    /// Wallet ID
    pub id: String,
    
    /// Wallet name
    pub name: String,
    
    /// Public key
    pub public_key: String,
    
    /// Encrypted private key (base64)
    pub encrypted_private_key: String,
    
    /// Encryption nonce (base64)
    pub nonce: String,
    
    /// Created timestamp
    pub created_at: String,
    
    /// Last updated timestamp
    pub updated_at: String,
}

/// Wallet configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletManagerConfig {
    /// Path to wallet storage directory
    pub wallet_dir: String,
    
    /// Master encryption key (will be loaded from environment)
    #[serde(skip)]
    pub master_key: Option<[u8; 32]>,
    
    /// Auto-save wallets to disk
    pub auto_save: bool,
}

impl Default for WalletManagerConfig {
    fn default() -> Self {
        Self {
            wallet_dir: "data/wallets".to_string(),
            master_key: None,
            auto_save: true,
        }
    }
}

/// Wallet manager for storing and retrieving wallet keypairs
pub struct WalletManager {
    /// Wallet storage
    wallets: RwLock<HashMap<String, WalletData>>,
    
    /// Keypair cache
    keypair_cache: RwLock<HashMap<String, Keypair>>,
    
    /// Configuration
    config: WalletManagerConfig,
    
    /// Random number generator
    rng: SystemRandom,
}

impl WalletManager {
    /// Create a new wallet manager
    pub fn new(config: WalletManagerConfig) -> Result<Self> {
        if config.master_key.is_none() {
            return Err(anyhow!("Master encryption key not provided"));
        }
        
        let wallets = RwLock::new(HashMap::new());
        let keypair_cache = RwLock::new(HashMap::new());
        let rng = SystemRandom::new();
        
        // Create wallet directory if it doesn't exist
        let wallet_dir = PathBuf::from(&config.wallet_dir);
        if !wallet_dir.exists() {
            fs::create_dir_all(&wallet_dir)
                .context("Failed to create wallet directory")?;
        }
        
        let manager = Self {
            wallets,
            keypair_cache,
            config,
            rng,
        };
        
        // Load wallets from disk
        manager.load_wallets()?;
        
        Ok(manager)
    }
    
    /// Load wallets from disk
    pub fn load_wallets(&self) -> Result<()> {
        let wallet_dir = PathBuf::from(&self.config.wallet_dir);
        if !wallet_dir.exists() {
            return Ok(());
        }
        
        let entries = fs::read_dir(&wallet_dir)
            .context("Failed to read wallet directory")?;
        
        let mut wallets = self.wallets.write().unwrap();
        
        for entry in entries {
            let entry = entry.context("Failed to read wallet file")?;
            let path = entry.path();
            
            if path.is_file() && path.extension().map_or(false, |ext| ext == "json") {
                let mut file = fs::File::open(&path)
                    .context("Failed to open wallet file")?;
                
                let mut contents = String::new();
                file.read_to_string(&mut contents)
                    .context("Failed to read wallet file")?;
                
                let wallet_data: WalletData = serde_json::from_str(&contents)
                    .context("Failed to parse wallet file")?;
                
                wallets.insert(wallet_data.id.clone(), wallet_data);
                
                debug!("Loaded wallet {} from {}", wallet_data.id, path.display());
            }
        }
        
        info!("Loaded {} wallets from {}", wallets.len(), wallet_dir.display());
        
        Ok(())
    }
    
    /// Save wallets to disk
    pub fn save_wallets(&self) -> Result<()> {
        let wallet_dir = PathBuf::from(&self.config.wallet_dir);
        if !wallet_dir.exists() {
            fs::create_dir_all(&wallet_dir)
                .context("Failed to create wallet directory")?;
        }
        
        let wallets = self.wallets.read().unwrap();
        
        for (_, wallet_data) in wallets.iter() {
            let path = wallet_dir.join(format!("{}.json", wallet_data.id));
            
            let contents = serde_json::to_string_pretty(wallet_data)
                .context("Failed to serialize wallet data")?;
            
            let mut file = fs::File::create(&path)
                .context("Failed to create wallet file")?;
            
            file.write_all(contents.as_bytes())
                .context("Failed to write wallet file")?;
            
            debug!("Saved wallet {} to {}", wallet_data.id, path.display());
        }
        
        info!("Saved {} wallets to {}", wallets.len(), wallet_dir.display());
        
        Ok(())
    }
    
    /// Create a new wallet
    pub fn create_wallet(&self, id: &str, name: &str) -> Result<WalletData> {
        // Generate a new keypair
        let keypair = Keypair::new();
        
        // Encrypt private key
        let encrypted_private_key = self.encrypt_private_key(&keypair)?;
        let nonce_base64 = encrypted_private_key.1;
        let encrypted_private_key_base64 = encrypted_private_key.0;
        
        // Create wallet data
        let wallet_data = WalletData {
            id: id.to_string(),
            name: name.to_string(),
            public_key: keypair.pubkey().to_string(),
            encrypted_private_key: encrypted_private_key_base64,
            nonce: nonce_base64,
            created_at: chrono::Utc::now().to_rfc3339(),
            updated_at: chrono::Utc::now().to_rfc3339(),
        };
        
        // Store wallet
        {
            let mut wallets = self.wallets.write().unwrap();
            wallets.insert(id.to_string(), wallet_data.clone());
        }
        
        // Cache keypair
        {
            let mut keypair_cache = self.keypair_cache.write().unwrap();
            keypair_cache.insert(id.to_string(), keypair);
        }
        
        // Save to disk if auto-save is enabled
        if self.config.auto_save {
            self.save_wallets()?;
        }
        
        info!("Created new wallet {} with public key {}", id, wallet_data.public_key);
        
        Ok(wallet_data)
    }
    
    /// Get wallet data
    pub fn get_wallet(&self, id: &str) -> Result<WalletData> {
        let wallets = self.wallets.read().unwrap();
        
        wallets.get(id)
            .cloned()
            .ok_or_else(|| anyhow!("Wallet not found: {}", id))
    }
    
    /// Get all wallets
    pub fn get_wallets(&self) -> Result<Vec<WalletData>> {
        let wallets = self.wallets.read().unwrap();
        
        Ok(wallets.values().cloned().collect())
    }
    
    /// Get wallet keypair
    pub fn get_wallet_keypair(&self, id: &str) -> Result<Keypair> {
        // Check cache first
        {
            let keypair_cache = self.keypair_cache.read().unwrap();
            if let Some(keypair) = keypair_cache.get(id) {
                return Ok(keypair.clone());
            }
        }
        
        // Load wallet data
        let wallet_data = self.get_wallet(id)?;
        
        // Decrypt private key
        let keypair = self.decrypt_private_key(
            &wallet_data.encrypted_private_key,
            &wallet_data.nonce,
        )?;
        
        // Cache keypair
        {
            let mut keypair_cache = self.keypair_cache.write().unwrap();
            keypair_cache.insert(id.to_string(), keypair.clone());
        }
        
        Ok(keypair)
    }
    
    /// Get wallet public key
    pub fn get_wallet_pubkey(&self, id: &str) -> Result<Pubkey> {
        let wallet_data = self.get_wallet(id)?;
        
        let pubkey = Pubkey::from_str(&wallet_data.public_key)
            .map_err(|e| anyhow!("Invalid public key: {}", e))?;
        
        Ok(pubkey)
    }
    
    /// Delete wallet
    pub fn delete_wallet(&self, id: &str) -> Result<()> {
        // Remove from storage
        {
            let mut wallets = self.wallets.write().unwrap();
            if !wallets.contains_key(id) {
                return Err(anyhow!("Wallet not found: {}", id));
            }
            
            wallets.remove(id);
        }
        
        // Remove from cache
        {
            let mut keypair_cache = self.keypair_cache.write().unwrap();
            keypair_cache.remove(id);
        }
        
        // Delete file
        let wallet_dir = PathBuf::from(&self.config.wallet_dir);
        let path = wallet_dir.join(format!("{}.json", id));
        
        if path.exists() {
            fs::remove_file(&path)
                .context("Failed to delete wallet file")?;
            
            debug!("Deleted wallet file: {}", path.display());
        }
        
        info!("Deleted wallet: {}", id);
        
        Ok(())
    }
    
    /// Encrypt private key
    fn encrypt_private_key(&self, keypair: &Keypair) -> Result<(String, String)> {
        let master_key = self.config.master_key
            .ok_or_else(|| anyhow!("Master encryption key not available"))?;
        
        // Extract private key bytes (first 32 bytes of keypair)
        let private_key_bytes = keypair.to_bytes()[..32].to_vec();
        
        // Create encryption key
        let key = UnboundKey::new(&CHACHA20_POLY1305, &master_key)
            .map_err(|_| anyhow!("Failed to create encryption key"))?;
        
        // Create nonce sequence
        let mut nonce_seq = WalletNonceSequence::new();
        let nonce_bytes = nonce_seq.nonce.clone();
        
        // Create sealing key
        let mut sealing_key = BoundKey::new(key, nonce_seq);
        
        // Encrypt private key
        let mut encrypted = private_key_bytes.clone();
        sealing_key.seal_in_place_append_tag(Aad::empty(), &mut encrypted)
            .map_err(|_| anyhow!("Failed to encrypt private key"))?;
        
        // Encode as base64
        let encrypted_base64 = base64::encode(&encrypted);
        let nonce_base64 = base64::encode(&nonce_bytes);
        
        Ok((encrypted_base64, nonce_base64))
    }
    
    /// Decrypt private key
    fn decrypt_private_key(&self, encrypted_base64: &str, nonce_base64: &str) -> Result<Keypair> {
        let master_key = self.config.master_key
            .ok_or_else(|| anyhow!("Master encryption key not available"))?;
        
        // Decode from base64
        let mut encrypted = base64::decode(encrypted_base64)
            .context("Failed to decode encrypted private key")?;
        
        let nonce_bytes = base64::decode(nonce_base64)
            .context("Failed to decode nonce")?;
        
        if nonce_bytes.len() != 12 {
            return Err(anyhow!("Invalid nonce length: {}", nonce_bytes.len()));
        }
        
        let mut nonce = [0u8; 12];
        nonce.copy_from_slice(&nonce_bytes);
        
        // Create opening key
        let key = UnboundKey::new(&CHACHA20_POLY1305, &master_key)
            .map_err(|_| anyhow!("Failed to create decryption key"))?;
        
        struct StaticNonce(Nonce);
        impl NonceSequence for StaticNonce {
            fn advance(&mut self) -> std::result::Result<Nonce, ring::error::Unspecified> {
                Ok(self.0)
            }
        }
        
        let nonce = Nonce::assume_unique_for_key(nonce);
        let mut opening_key = BoundKey::new(key, StaticNonce(nonce));
        
        // Decrypt private key
        let private_key = opening_key.open_in_place(Aad::empty(), &mut encrypted)
            .map_err(|_| anyhow!("Failed to decrypt private key"))?;
        
        // Create keypair from private key
        let mut keypair_bytes = [0u8; 64];
        keypair_bytes[..32].copy_from_slice(private_key);
        
        // Derive public key from private key
        let keypair = Keypair::from_bytes(&keypair_bytes)
            .map_err(|e| anyhow!("Failed to create keypair from private key: {}", e))?;
        
        Ok(keypair)
    }
}

use std::str::FromStr;