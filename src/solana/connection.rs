// Solana connection management

use anyhow::{Result, anyhow, Context};
use log::{info, warn, error, debug};
use serde::{Serialize, Deserialize};
use std::sync::{Arc, RwLock, Mutex};
use std::time::{Duration, Instant};
use std::env;

use solana_client::rpc_client::RpcClient;
use solana_client::client_error::ClientError;
use solana_sdk::commitment_config::CommitmentConfig;

/// Connection configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionConfig {
    /// Primary RPC endpoint URL
    pub primary_endpoint: Option<String>,
    
    /// Fallback RPC endpoint URL
    pub fallback_endpoint: Option<String>,
    
    /// Commitment level
    pub commitment: String,
    
    /// Connection timeout in seconds
    pub timeout_seconds: u64,
    
    /// Health check interval in seconds
    pub health_check_seconds: u64,
}

impl Default for ConnectionConfig {
    fn default() -> Self {
        Self {
            primary_endpoint: None,
            fallback_endpoint: None,
            commitment: "confirmed".to_string(),
            timeout_seconds: 30,
            health_check_seconds: 60,
        }
    }
}

/// Connection status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ConnectionStatus {
    /// Connected
    Connected,
    
    /// Connecting
    Connecting,
    
    /// Disconnected
    Disconnected,
    
    /// Error
    Error,
}

/// Connection health
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionHealth {
    /// Connection status
    pub status: ConnectionStatus,
    
    /// Active endpoint
    pub active_endpoint: String,
    
    /// Last health check time
    #[serde(skip)]
    pub last_check: Instant,
    
    /// Error message (if any)
    pub error: Option<String>,
    
    /// Version info
    pub version: Option<String>,
}

/// Solana connection manager
pub struct SolanaConnection {
    /// Configuration
    config: ConnectionConfig,
    
    /// RPC client
    client: RwLock<Option<RpcClient>>,
    
    /// Connection health
    health: RwLock<ConnectionHealth>,
    
    /// Last error
    last_error: Mutex<Option<ClientError>>,
}

impl SolanaConnection {
    /// Create a new Solana connection
    pub fn new(config: ConnectionConfig) -> Result<Self> {
        // Set default endpoints if not provided
        let primary_endpoint = config.primary_endpoint.clone().unwrap_or_else(|| {
            // Try to get from environment
            env::var("INSTANT_NODES_RPC_URL")
                .or_else(|_| {
                    // Try Helius API key
                    env::var("SOLANA_RPC_API_KEY")
                        .map(|key| format!("https://mainnet.helius-rpc.com/?api-key={}", key))
                })
                .unwrap_or_else(|_| {
                    // Fallback to public endpoint
                    "https://api.mainnet-beta.solana.com".to_string()
                })
        });
        
        let fallback_endpoint = config.fallback_endpoint.clone().unwrap_or_else(|| {
            // Fallback to public endpoint
            "https://api.mainnet-beta.solana.com".to_string()
        });
        
        // Initialize connection health
        let health = ConnectionHealth {
            status: ConnectionStatus::Disconnected,
            active_endpoint: primary_endpoint.clone(),
            last_check: Instant::now(),
            error: None,
            version: None,
        };
        
        let connection = Self {
            config,
            client: RwLock::new(None),
            health: RwLock::new(health),
            last_error: Mutex::new(None),
        };
        
        Ok(connection)
    }
    
    /// Initialize connection
    pub fn initialize(&self) -> Result<()> {
        // Get endpoint
        let endpoint = self.get_active_endpoint();
        
        // Create commitment config
        let commitment = match self.config.commitment.as_str() {
            "processed" => CommitmentConfig::processed(),
            "confirmed" => CommitmentConfig::confirmed(),
            "finalized" => CommitmentConfig::finalized(),
            _ => CommitmentConfig::confirmed(),
        };
        
        // Create timeout
        let timeout = Duration::from_secs(self.config.timeout_seconds);
        
        // Create RPC client
        let client = RpcClient::new_with_timeout_and_commitment(
            endpoint.clone(),
            timeout,
            commitment,
        );
        
        // Update health
        {
            let mut health = self.health.write().unwrap();
            health.status = ConnectionStatus::Connecting;
            health.active_endpoint = endpoint.clone();
        }
        
        // Store client
        {
            let mut client_lock = self.client.write().unwrap();
            *client_lock = Some(client);
        }
        
        // Perform health check
        match self.check_health() {
            Ok(_) => {
                info!("Connected to Solana network at {}", endpoint);
                Ok(())
            }
            Err(e) => {
                // Try fallback endpoint if available
                if endpoint != self.config.fallback_endpoint.clone().unwrap_or_default() {
                    warn!("Failed to connect to primary endpoint: {}", e);
                    warn!("Trying fallback endpoint");
                    
                    // Update active endpoint to fallback
                    {
                        let mut health = self.health.write().unwrap();
                        health.active_endpoint = self.config.fallback_endpoint.clone().unwrap_or_default();
                    }
                    
                    // Try again with fallback
                    self.initialize()
                } else {
                    // Both endpoints failed
                    error!("Failed to connect to Solana network: {}", e);
                    Err(e)
                }
            }
        }
    }
    
    /// Get RPC client
    pub fn get_rpc_client(&self) -> Result<RpcClient> {
        // Check if client exists
        let client_lock = self.client.read().unwrap();
        
        match client_lock.as_ref() {
            Some(client) => Ok(client.clone()),
            None => {
                // Initialize connection
                drop(client_lock); // Release lock before initializing
                self.initialize()?;
                
                // Get client again
                let client_lock = self.client.read().unwrap();
                match client_lock.as_ref() {
                    Some(client) => Ok(client.clone()),
                    None => Err(anyhow!("Failed to initialize Solana connection")),
                }
            }
        }
    }
    
    /// Get active endpoint
    pub fn get_active_endpoint(&self) -> String {
        let health = self.health.read().unwrap();
        health.active_endpoint.clone()
    }
    
    /// Check connection health
    pub fn check_health(&self) -> Result<ConnectionHealth> {
        // Get client
        let client = self.get_rpc_client()?;
        
        // Check connection
        match client.get_version() {
            Ok(version) => {
                // Update health
                let mut health = self.health.write().unwrap();
                health.status = ConnectionStatus::Connected;
                health.last_check = Instant::now();
                health.error = None;
                health.version = Some(format!("{}.{}.{}", 
                    version.solana_core.major,
                    version.solana_core.minor,
                    version.solana_core.patch
                ));
                
                Ok(health.clone())
            }
            Err(e) => {
                // Update health
                let mut health = self.health.write().unwrap();
                health.status = ConnectionStatus::Error;
                health.last_check = Instant::now();
                health.error = Some(e.to_string());
                
                // Store error
                {
                    let mut last_error = self.last_error.lock().unwrap();
                    *last_error = Some(e.clone());
                }
                
                Err(anyhow!("Failed to get Solana version: {}", e))
            }
        }
    }
    
    /// Get connection health
    pub fn get_health(&self) -> ConnectionHealth {
        // Check if we need to refresh health
        let refresh = {
            let health = self.health.read().unwrap();
            let elapsed = health.last_check.elapsed();
            let interval = Duration::from_secs(self.config.health_check_seconds);
            
            elapsed >= interval
        };
        
        // Refresh health if needed
        if refresh {
            let _ = self.check_health();
        }
        
        // Return health
        let health = self.health.read().unwrap();
        health.clone()
    }
    
    /// Get last error
    pub fn get_last_error(&self) -> Option<ClientError> {
        let last_error = self.last_error.lock().unwrap();
        last_error.clone()
    }
    
    /// Switch to fallback endpoint
    pub fn switch_to_fallback(&self) -> Result<()> {
        // Check if fallback is available
        let fallback = self.config.fallback_endpoint.clone()
            .ok_or_else(|| anyhow!("No fallback endpoint configured"))?;
        
        // Check if already on fallback
        let current = self.get_active_endpoint();
        if current == fallback {
            return Err(anyhow!("Already using fallback endpoint"));
        }
        
        info!("Switching from {} to fallback endpoint {}", current, fallback);
        
        // Update health
        {
            let mut health = self.health.write().unwrap();
            health.status = ConnectionStatus::Connecting;
            health.active_endpoint = fallback.clone();
        }
        
        // Reset client to force re-initialization
        {
            let mut client_lock = self.client.write().unwrap();
            *client_lock = None;
        }
        
        // Initialize with fallback
        self.initialize()
    }
    
    /// Switch to primary endpoint
    pub fn switch_to_primary(&self) -> Result<()> {
        // Check if primary is available
        let primary = self.config.primary_endpoint.clone()
            .ok_or_else(|| anyhow!("No primary endpoint configured"))?;
        
        // Check if already on primary
        let current = self.get_active_endpoint();
        if current == primary {
            return Err(anyhow!("Already using primary endpoint"));
        }
        
        info!("Switching from {} to primary endpoint {}", current, primary);
        
        // Update health
        {
            let mut health = self.health.write().unwrap();
            health.status = ConnectionStatus::Connecting;
            health.active_endpoint = primary.clone();
        }
        
        // Reset client to force re-initialization
        {
            let mut client_lock = self.client.write().unwrap();
            *client_lock = None;
        }
        
        // Initialize with primary
        self.initialize()
    }
}