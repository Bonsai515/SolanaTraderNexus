use anyhow::Result;
use log::{info, warn, error, debug};
use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    signature::Keypair,
    pubkey::Pubkey,
    hash::Hash,
    commitment_config::CommitmentConfig,
};
use std::sync::{Arc, RwLock, Mutex};
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tokio::task::JoinHandle;
use chrono::Utc;

/// Solana blockchain connection manager
pub struct SolanaConnection {
    // RPC client for Solana
    client: Arc<RwLock<Option<RpcClient>>>,
    
    // Connection endpoint
    endpoint: RwLock<String>,
    
    // Connection status
    is_connected: RwLock<bool>,
    
    // Last block hash
    last_blockhash: RwLock<Option<Hash>>,
    
    // Last blockhash update time
    last_blockhash_update: RwLock<Option<Instant>>,
    
    // Blockhash refresh task
    blockhash_task: Mutex<Option<JoinHandle<()>>>,
    
    // Connection monitoring task
    monitor_task: Mutex<Option<JoinHandle<()>>>,
    
    // Network stats
    network_stats: RwLock<NetworkStats>,
}

/// Network statistics
#[derive(Clone, Debug, Default)]
struct NetworkStats {
    // Current slot
    current_slot: u64,
    
    // Transactions per second
    transactions_per_second: f64,
    
    // Average block time
    avg_block_time_ms: f64,
    
    // Validators count
    validators_count: usize,
    
    // Last update time
    last_update: chrono::DateTime<Utc>,
}

impl SolanaConnection {
    /// Create a new Solana connection
    pub fn new(endpoint: &str) -> Self {
        info!("Initializing Solana Connection - Blockchain Interface");
        
        // Use environment variables for custom RPC if available
        let custom_endpoint = std::env::var("INSTANT_NODES_RPC_URL").unwrap_or_else(|_| {
            info!("INSTANT_NODES_RPC_URL not found, using provided endpoint");
            endpoint.to_string()
        });
        
        info!("Using Solana RPC endpoint: {}", custom_endpoint);
        
        Self {
            client: Arc::new(RwLock::new(None)),
            endpoint: RwLock::new(custom_endpoint),
            is_connected: RwLock::new(false),
            last_blockhash: RwLock::new(None),
            last_blockhash_update: RwLock::new(None),
            blockhash_task: Mutex::new(None),
            monitor_task: Mutex::new(None),
            network_stats: RwLock::new(NetworkStats::default()),
        }
    }
    
    /// Connect to Solana network
    pub fn connect(&self) -> Result<()> {
        let endpoint = self.endpoint.read().unwrap().clone();
        info!("Connecting to Solana network: {}", endpoint);
        
        // Check if API key is available
        let api_key = std::env::var("SOLANA_RPC_API_KEY").ok();
        
        // Create RPC client with or without API key
        let client = if let Some(key) = api_key {
            info!("Using custom API key for RPC connection");
            
            // For simplicity, we'll use the standard client for now
            // In a production environment, we would add headers with the API key
            // This requires additional dependencies that might not be available
            info!("API key available but using standard client due to header limitations");
            RpcClient::new_with_commitment(
                endpoint,
                CommitmentConfig::confirmed(),
            )
        } else {
            info!("No API key found, using default RPC connection");
            RpcClient::new_with_commitment(
                endpoint,
                CommitmentConfig::confirmed(),
            )
        };
        
        // Test connection
        match client.get_version() {
            Ok(version) => {
                info!("Connected to Solana network, version: {:?}", version);
                
                // Update client
                let mut client_lock = self.client.write().unwrap();
                *client_lock = Some(client);
                
                // Update connection status
                let mut is_connected = self.is_connected.write().unwrap();
                *is_connected = true;
                
                // Get initial blockhash
                self.refresh_blockhash()?;
                
                // Start blockhash refresh task
                self.start_blockhash_refresh_task()?;
                
                // Start connection monitoring
                self.start_monitor_task()?;
                
                Ok(())
            },
            Err(e) => {
                error!("Failed to connect to Solana network: {}", e);
                Err(anyhow::anyhow!("Failed to connect to Solana: {}", e))
            }
        }
    }
    
    /// Disconnect from Solana network
    pub fn disconnect(&self) -> Result<()> {
        info!("Disconnecting from Solana network");
        
        // Stop background tasks
        self.stop_tasks()?;
        
        // Clear client
        let mut client_lock = self.client.write().unwrap();
        *client_lock = None;
        
        // Update connection status
        let mut is_connected = self.is_connected.write().unwrap();
        *is_connected = false;
        
        Ok(())
    }
    
    /// Check if connected to Solana
    pub fn is_connected(&self) -> bool {
        *self.is_connected.read().unwrap()
    }
    
    /// Get the current blockhash
    pub fn get_recent_blockhash(&self) -> Result<Hash> {
        // Try to use cached blockhash first
        let blockhash = self.last_blockhash.read().unwrap();
        let last_update = self.last_blockhash_update.read().unwrap();
        
        if let (Some(hash), Some(time)) = (blockhash.as_ref(), last_update.as_ref()) {
            // If blockhash is less than 50 seconds old, use it
            if time.elapsed() < Duration::from_secs(50) {
                return Ok(*hash);
            }
        }
        
        // Need to refresh blockhash
        self.refresh_blockhash()
    }
    
    /// Get current network statistics
    pub fn get_network_stats(&self) -> NetworkStats {
        self.network_stats.read().unwrap().clone()
    }
    
    /// Update network statistics
    pub fn update_network_stats(&self) -> Result<()> {
        let client_lock = self.client.read().unwrap();
        let client = client_lock.as_ref().ok_or_else(|| {
            anyhow::anyhow!("Not connected to Solana network")
        })?;
        
        // Get current slot
        let slot = client.get_slot()?;
        
        // In a real implementation, would get more detailed stats
        // Here we just simulate some values
        
        let mut stats = self.network_stats.write().unwrap();
        stats.current_slot = slot;
        stats.transactions_per_second = 1500.0 + (slot % 500) as f64;
        stats.avg_block_time_ms = 400.0 + (slot % 100) as f64;
        stats.validators_count = 1500 + (slot % 100) as usize;
        stats.last_update = Utc::now();
        
        Ok(())
    }
    
    /// Refresh the blockhash
    fn refresh_blockhash(&self) -> Result<Hash> {
        let client_lock = self.client.read().unwrap();
        let client = client_lock.as_ref().ok_or_else(|| {
            anyhow::anyhow!("Not connected to Solana network")
        })?;
        
        // Get new blockhash
        let blockhash = client.get_latest_blockhash()?;
        
        // Update cached values
        {
            let mut hash_lock = self.last_blockhash.write().unwrap();
            *hash_lock = Some(blockhash);
            
            let mut time_lock = self.last_blockhash_update.write().unwrap();
            *time_lock = Some(Instant::now());
        }
        
        Ok(blockhash)
    }
    
    /// Start the blockhash refresh task
    fn start_blockhash_refresh_task(&self) -> Result<()> {
        let client = Arc::clone(&self.client);
        let last_blockhash = Arc::clone(&self.last_blockhash);
        let last_blockhash_update = Arc::clone(&self.last_blockhash_update);
        
        let task = tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(45));
            
            loop {
                interval.tick().await;
                
                // Get client
                let client_lock = client.read().unwrap();
                let client_opt = client_lock.as_ref();
                
                if let Some(client) = client_opt {
                    // Refresh blockhash
                    match client.get_latest_blockhash() {
                        Ok(blockhash) => {
                            // Update cached values
                            {
                                let mut hash_lock = last_blockhash.write().unwrap();
                                *hash_lock = Some(blockhash);
                                
                                let mut time_lock = last_blockhash_update.write().unwrap();
                                *time_lock = Some(Instant::now());
                            }
                            
                            debug!("Refreshed Solana blockhash: {:?}", blockhash);
                        },
                        Err(e) => {
                            warn!("Failed to refresh blockhash: {}", e);
                        }
                    }
                } else {
                    // No client, probably disconnected
                    break;
                }
            }
        });
        
        let mut blockhash_task = self.blockhash_task.lock().unwrap();
        *blockhash_task = Some(task);
        
        Ok(())
    }
    
    /// Start the connection monitoring task
    fn start_monitor_task(&self) -> Result<()> {
        let client = Arc::clone(&self.client);
        let is_connected = Arc::clone(&self.is_connected);
        let network_stats = Arc::clone(&self.network_stats);
        
        let task = tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(30));
            
            loop {
                interval.tick().await;
                
                // Get client
                let client_lock = client.read().unwrap();
                let client_opt = client_lock.as_ref();
                
                if let Some(client) = client_opt {
                    // Check connection
                    match client.get_version() {
                        Ok(_) => {
                            // Still connected
                            let mut connected = is_connected.write().unwrap();
                            if !*connected {
                                *connected = true;
                                info!("Reconnected to Solana network");
                            }
                            
                            // Update stats
                            match client.get_slot() {
                                Ok(slot) => {
                                    let mut stats = network_stats.write().unwrap();
                                    stats.current_slot = slot;
                                    stats.transactions_per_second = 1500.0 + (slot % 500) as f64;
                                    stats.avg_block_time_ms = 400.0 + (slot % 100) as f64;
                                    stats.validators_count = 1500 + (slot % 100) as usize;
                                    stats.last_update = Utc::now();
                                },
                                Err(e) => {
                                    warn!("Failed to get slot: {}", e);
                                }
                            }
                        },
                        Err(e) => {
                            // Lost connection
                            warn!("Lost connection to Solana network: {}", e);
                            let mut connected = is_connected.write().unwrap();
                            *connected = false;
                        }
                    }
                } else {
                    // No client, probably disconnected
                    break;
                }
            }
        });
        
        let mut monitor_task = self.monitor_task.lock().unwrap();
        *monitor_task = Some(task);
        
        Ok(())
    }
    
    /// Stop background tasks
    fn stop_tasks(&self) -> Result<()> {
        // Stop blockhash refresh task
        let mut blockhash_task = self.blockhash_task.lock().unwrap();
        if let Some(task) = blockhash_task.take() {
            task.abort();
            debug!("Stopped blockhash refresh task");
        }
        
        // Stop monitor task
        let mut monitor_task = self.monitor_task.lock().unwrap();
        if let Some(task) = monitor_task.take() {
            task.abort();
            debug!("Stopped connection monitor task");
        }
        
        Ok(())
    }
    
    /// Get the RPC client
    pub fn get_client(&self) -> Result<Arc<RpcClient>> {
        let client_lock = self.client.read().unwrap();
        client_lock.as_ref()
            .ok_or_else(|| anyhow::anyhow!("Not connected to Solana network"))
            .map(|c| Arc::new(c.clone()))
    }
}