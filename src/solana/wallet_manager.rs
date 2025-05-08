// Wallet manager for Solana

use crate::models::{Wallet, WalletType};
use super::connection::SolanaConnection;
use anyhow::{Result, anyhow, Context};
use log::{info, warn, error, debug};
use std::sync::{Arc, RwLock, Mutex};
use std::collections::HashMap;
use std::env;
use std::fs;
use std::path::Path;
use thiserror::Error;
use base64::{Engine as _, engine::general_purpose};
use rand::Rng;
use crypto::{buffer, aes, blockmodes};
use crypto::buffer::{ReadBuffer, WriteBuffer, BufferResult};
use uuid::Uuid;
use chrono::Utc;
use solana_sdk::{
    signature::{Keypair, Signer},
    pubkey::Pubkey,
};
use bs58;

/// Wallet encryption key environment variable
const WALLET_ENCRYPTION_KEY_ENV: &str = "WALLET_ENCRYPTION_KEY";

/// Wallet storage directory
const WALLET_STORAGE_DIR: &str = ".wallets";

/// Wallet error type
#[derive(Debug, Error)]
pub enum WalletError {
    #[error("Wallet not found: {0}")]
    WalletNotFound(String),
    
    #[error("Wallet already exists: {0}")]
    WalletAlreadyExists(String),
    
    #[error("Failed to generate wallet")]
    WalletGenerationFailed,
    
    #[error("Failed to encrypt wallet")]
    EncryptionFailed,
    
    #[error("Failed to decrypt wallet")]
    DecryptionFailed,
    
    #[error("Failed to save wallet")]
    SaveFailed(#[source] std::io::Error),
    
    #[error("Failed to load wallet")]
    LoadFailed(#[source] std::io::Error),
    
    #[error("Invalid wallet format")]
    InvalidFormat,
    
    #[error("Encryption key not found")]
    EncryptionKeyNotFound,
}

/// Wallet manager for creating and managing Solana wallets
pub struct WalletManager {
    /// Solana connection
    solana_connection: Arc<SolanaConnection>,
    
    /// Active wallets
    wallets: RwLock<HashMap<String, Wallet>>,
    
    /// Encryption key
    encryption_key: Mutex<Option<Vec<u8>>>,
    
    /// Whether persistent storage is enabled
    persistent_storage: bool,
}

impl WalletManager {
    /// Create a new wallet manager
    pub fn new(solana_connection: Arc<SolanaConnection>) -> Self {
        Self {
            solana_connection,
            wallets: RwLock::new(HashMap::new()),
            encryption_key: Mutex::new(None),
            persistent_storage: true,
        }
    }
    
    /// Initialize the wallet manager
    pub fn init(&self) -> Result<()> {
        // Get encryption key from environment
        let encryption_key = match env::var(WALLET_ENCRYPTION_KEY_ENV) {
            Ok(key) => {
                // Use the provided key
                info!("Using encryption key from environment");
                key.as_bytes().to_vec()
            }
            Err(_) => {
                // Generate a temporary key
                warn!("No encryption key provided, generating temporary key");
                warn!("Wallets will not be persistable across restarts");
                warn!("Set the {} environment variable for persistent wallets", WALLET_ENCRYPTION_KEY_ENV);
                
                let mut key = vec![0u8; 32];
                rand::thread_rng().fill(&mut key[..]);
                key
            }
        };
        
        // Set the encryption key
        {
            let mut key = self.encryption_key.lock().unwrap();
            *key = Some(encryption_key);
        }
        
        // Create wallet storage directory if needed
        if self.persistent_storage {
            if let Err(e) = fs::create_dir_all(WALLET_STORAGE_DIR) {
                warn!("Failed to create wallet storage directory: {}", e);
                self.persistent_storage = false;
            }
        }
        
        // Load existing wallets
        if self.persistent_storage {
            match self.load_wallets() {
                Ok(count) => {
                    info!("Loaded {} wallets from storage", count);
                }
                Err(e) => {
                    warn!("Failed to load wallets: {}", e);
                }
            }
        }
        
        Ok(())
    }
    
    /// Get or create a wallet by name
    pub fn get_or_create_wallet(&self, name: &str) -> Result<Wallet> {
        // Check if wallet exists
        {
            let wallets = self.wallets.read().unwrap();
            for wallet in wallets.values() {
                if let Some(wallet_name) = &wallet.name {
                    if wallet_name == name {
                        return Ok(wallet.clone());
                    }
                }
            }
        }
        
        // Create new wallet
        let wallet_type = match name {
            "trading" => WalletType::Trading,
            "collateral" => WalletType::Collateral,
            "profit" => WalletType::Profit,
            "contract" => WalletType::Contract,
            _ => WalletType::Temporary,
        };
        
        self.create_wallet(Some(name.to_string()), wallet_type)
    }
    
    /// Create a new wallet
    pub fn create_wallet(
        &self,
        name: Option<String>,
        wallet_type: WalletType,
    ) -> Result<Wallet> {
        // Generate new keypair
        let keypair = Keypair::new();
        let pubkey = keypair.pubkey();
        let address = pubkey.to_string();
        
        // Encrypt private key
        let private_key = keypair.to_bytes().to_vec();
        let encrypted_private_key = self.encrypt_data(&private_key)
            .map_err(|_| WalletError::EncryptionFailed)?;
        
        // Create wallet
        let wallet = Wallet::new(
            name,
            wallet_type,
            address.clone(),
            Some(pubkey.to_bytes().to_vec()),
            Some(encrypted_private_key),
        );
        
        // Add wallet to active wallets
        {
            let mut wallets = self.wallets.write().unwrap();
            wallets.insert(wallet.id.clone(), wallet.clone());
        }
        
        // Save wallet to storage
        if self.persistent_storage {
            self.save_wallet(&wallet)?;
        }
        
        info!("Created new wallet: {} ({})", address, wallet_type);
        
        Ok(wallet)
    }
    
    /// Get wallet by ID
    pub fn get_wallet(&self, id: &str) -> Result<Wallet> {
        let wallets = self.wallets.read().unwrap();
        wallets.get(id)
            .cloned()
            .ok_or_else(|| WalletError::WalletNotFound(id.to_string()).into())
    }
    
    /// Get wallet by address
    pub fn get_wallet_by_address(&self, address: &str) -> Result<Wallet> {
        let wallets = self.wallets.read().unwrap();
        wallets.values()
            .find(|w| w.address == address)
            .cloned()
            .ok_or_else(|| WalletError::WalletNotFound(address.to_string()).into())
    }
    
    /// Get all wallets
    pub fn get_wallets(&self) -> Vec<Wallet> {
        let wallets = self.wallets.read().unwrap();
        wallets.values().cloned().collect()
    }
    
    /// Update wallet balance
    pub async fn update_wallet_balance(
        &self,
        wallet_id: &str,
        token: &str,
        amount: f64,
    ) -> Result<Wallet> {
        let mut wallet = self.get_wallet(wallet_id)?;
        wallet.update_balance(token, amount);
        
        // Update wallet in active wallets
        {
            let mut wallets = self.wallets.write().unwrap();
            wallets.insert(wallet.id.clone(), wallet.clone());
        }
        
        // Save wallet to storage
        if self.persistent_storage {
            self.save_wallet(&wallet)?;
        }
        
        Ok(wallet)
    }
    
    /// Fetch wallet balances from blockchain
    pub async fn fetch_wallet_balances(&self, wallet_id: &str) -> Result<Wallet> {
        let mut wallet = self.get_wallet(wallet_id)?;
        
        // Fetch SOL balance
        let sol_balance = self.solana_connection.get_sol_balance(&wallet.address).await?;
        wallet.update_balance("SOL", sol_balance);
        
        // Fetch token balances
        // This would require more implementation to get SPL token accounts
        // and fetch their balances
        
        // Update wallet in active wallets
        {
            let mut wallets = self.wallets.write().unwrap();
            wallets.insert(wallet.id.clone(), wallet.clone());
        }
        
        // Save wallet to storage
        if self.persistent_storage {
            self.save_wallet(&wallet)?;
        }
        
        Ok(wallet)
    }
    
    /// Save wallet to storage
    fn save_wallet(&self, wallet: &Wallet) -> Result<()> {
        if !self.persistent_storage {
            return Ok(());
        }
        
        let wallet_path = format!("{}/{}.json", WALLET_STORAGE_DIR, wallet.id);
        let wallet_json = serde_json::to_string_pretty(wallet)
            .context("Failed to serialize wallet")?;
        
        fs::write(&wallet_path, wallet_json)
            .map_err(|e| WalletError::SaveFailed(e))?;
        
        debug!("Saved wallet {} to {}", wallet.id, wallet_path);
        
        Ok(())
    }
    
    /// Load wallets from storage
    fn load_wallets(&self) -> Result<usize> {
        if !self.persistent_storage {
            return Ok(0);
        }
        
        let wallet_dir = Path::new(WALLET_STORAGE_DIR);
        if !wallet_dir.exists() {
            return Ok(0);
        }
        
        let mut loaded_count = 0;
        
        for entry in fs::read_dir(wallet_dir)
            .map_err(|e| WalletError::LoadFailed(e))?
        {
            let entry = entry.map_err(|e| WalletError::LoadFailed(e))?;
            let path = entry.path();
            
            if path.is_file() && path.extension().map_or(false, |ext| ext == "json") {
                match fs::read_to_string(&path) {
                    Ok(wallet_json) => {
                        match serde_json::from_str::<Wallet>(&wallet_json) {
                            Ok(wallet) => {
                                let mut wallets = self.wallets.write().unwrap();
                                wallets.insert(wallet.id.clone(), wallet);
                                loaded_count += 1;
                            }
                            Err(e) => {
                                warn!("Failed to parse wallet from {}: {}", path.display(), e);
                            }
                        }
                    }
                    Err(e) => {
                        warn!("Failed to read wallet file {}: {}", path.display(), e);
                    }
                }
            }
        }
        
        Ok(loaded_count)
    }
    
    /// Encrypt data with the wallet encryption key
    fn encrypt_data(&self, data: &[u8]) -> Result<Vec<u8>> {
        let key = {
            let key_guard = self.encryption_key.lock().unwrap();
            key_guard.clone().ok_or(WalletError::EncryptionKeyNotFound)?
        };
        
        // Generate random IV
        let mut iv = [0u8; 16];
        rand::thread_rng().fill(&mut iv);
        
        // Encrypt data
        let mut encryptor = aes::cbc_encryptor(
            aes::KeySize::KeySize256,
            &key,
            &iv,
            blockmodes::PaddingType::PKCS7,
        );
        
        let mut final_result = Vec::new();
        let mut buffer = [0u8; 4096];
        let mut read_buffer = buffer::RefReadBuffer::new(data);
        let mut write_buffer = buffer::RefWriteBuffer::new(&mut buffer);
        
        loop {
            let result = encryptor.encrypt(&mut read_buffer, &mut write_buffer, true)
                .map_err(|_| WalletError::EncryptionFailed)?;
            
            final_result.extend(write_buffer.take_read_buffer().take_remaining());
            
            match result {
                BufferResult::BufferUnderflow => break,
                BufferResult::BufferOverflow => continue,
            }
        }
        
        // Prepend IV to the encrypted data
        let mut output = Vec::with_capacity(iv.len() + final_result.len());
        output.extend_from_slice(&iv);
        output.extend_from_slice(&final_result);
        
        // Base64 encode the result
        Ok(general_purpose::STANDARD.encode(output).into_bytes())
    }
    
    /// Decrypt data with the wallet encryption key
    fn decrypt_data(&self, encrypted_data: &[u8]) -> Result<Vec<u8>> {
        let key = {
            let key_guard = self.encryption_key.lock().unwrap();
            key_guard.clone().ok_or(WalletError::EncryptionKeyNotFound)?
        };
        
        // Base64 decode
        let decoded = general_purpose::STANDARD.decode(encrypted_data)
            .map_err(|_| WalletError::DecryptionFailed)?;
        
        if decoded.len() < 16 {
            return Err(WalletError::DecryptionFailed.into());
        }
        
        // Extract IV and ciphertext
        let iv = &decoded[0..16];
        let ciphertext = &decoded[16..];
        
        // Decrypt data
        let mut decryptor = aes::cbc_decryptor(
            aes::KeySize::KeySize256,
            &key,
            iv,
            blockmodes::PaddingType::PKCS7,
        );
        
        let mut final_result = Vec::new();
        let mut buffer = [0u8; 4096];
        let mut read_buffer = buffer::RefReadBuffer::new(ciphertext);
        let mut write_buffer = buffer::RefWriteBuffer::new(&mut buffer);
        
        loop {
            let result = decryptor.decrypt(&mut read_buffer, &mut write_buffer, true)
                .map_err(|_| WalletError::DecryptionFailed)?;
            
            final_result.extend(write_buffer.take_read_buffer().take_remaining());
            
            match result {
                BufferResult::BufferUnderflow => break,
                BufferResult::BufferOverflow => continue,
            }
        }
        
        Ok(final_result)
    }
    
    /// Get keypair for a wallet (decrypts private key)
    pub fn get_wallet_keypair(&self, wallet_id: &str) -> Result<Keypair> {
        let wallet = self.get_wallet(wallet_id)?;
        
        let encrypted_private_key = wallet.encrypted_private_key
            .ok_or_else(|| anyhow!("Wallet has no private key"))?;
        
        let private_key = self.decrypt_data(&encrypted_private_key)
            .map_err(|_| WalletError::DecryptionFailed)?;
        
        if private_key.len() != 64 {
            return Err(WalletError::InvalidFormat.into());
        }
        
        let mut keypair_bytes = [0u8; 64];
        keypair_bytes.copy_from_slice(&private_key);
        
        Keypair::from_bytes(&keypair_bytes)
            .map_err(|_| WalletError::InvalidFormat.into())
    }
    
    /// Stop the wallet manager
    pub fn stop(&self) -> Result<()> {
        // Save all wallets
        if self.persistent_storage {
            let wallets = self.wallets.read().unwrap();
            for wallet in wallets.values() {
                if let Err(e) = self.save_wallet(wallet) {
                    warn!("Failed to save wallet {}: {}", wallet.id, e);
                }
            }
        }
        
        Ok(())
    }
}