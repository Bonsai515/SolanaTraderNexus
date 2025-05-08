use solana_client::rpc_client::RpcClient;
use solana_sdk::commitment_config::CommitmentConfig;
use anyhow::{Result, Context};
use log::{info, error};
use std::sync::{Arc, Mutex};
use std::env;

/// Solana connection manager
pub struct SolanaConnectionManager {
    client: Arc<Mutex<RpcClient>>,
}

impl SolanaConnectionManager {
    /// Create a new Solana connection manager
    pub fn new() -> Result<Self> {
        // Use environment variable for the RPC endpoint with a fallback
        let endpoint = env::var("SOLANA_RPC_ENDPOINT")
            .unwrap_or_else(|_| "https://api.mainnet-beta.solana.com".to_string());
        
        info!("Connecting to Solana at {}", endpoint);
        
        // Create connection with commitment level of 'confirmed' for faster confirmations
        let client = RpcClient::new_with_commitment(endpoint, CommitmentConfig::confirmed());
        
        // Verify connection by making a simple request
        match client.get_version() {
            Ok(version) => {
                info!("Connected to Solana network version: {:?}", version);
                Ok(Self {
                    client: Arc::new(Mutex::new(client)),
                })
            },
            Err(e) => {
                error!("Failed to connect to Solana network: {}", e);
                Err(anyhow::anyhow!("Failed to establish Solana connection: {}", e))
            }
        }
    }
    
    /// Get a reference to the RPC client
    pub fn client(&self) -> Arc<Mutex<RpcClient>> {
        self.client.clone()
    }
    
    /// Monitor the health of the Solana connection
    pub async fn monitor_health(&self) -> Result<bool> {
        let client = self.client.lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire lock: {}", e))?;
            
        // Fetch the recent block height as a simple health check
        let block_height = client.get_block_height()
            .context("Failed to get block height")?;
            
        info!("Solana connection healthy, current block height: {}", block_height);
        Ok(true)
    }
}

/// Create a Solana connection that can be shared across the application
pub fn create_solana_connection() -> Result<SolanaConnectionManager> {
    SolanaConnectionManager::new()
}