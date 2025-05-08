// Solana blockchain connection

use anyhow::{Result, anyhow, Context};
use log::{info, warn, error, debug};
use std::sync::{Arc, RwLock, Mutex};
use std::env;
use std::time::{Duration, Instant};
use reqwest::Client;
use serde::{Serialize, Deserialize};
use serde_json::{json, Value};
use tokio::time::sleep;

/// Maximum number of retries for RPC requests
const MAX_RETRIES: usize = 3;

/// Timeout for RPC requests (seconds)
const RPC_TIMEOUT_SECONDS: u64 = 30;

/// Solana connection status
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConnectionStatus {
    /// Connection not initialized
    NotInitialized,
    
    /// Connection is operational
    Operational,
    
    /// Connection has issues
    Degraded,
    
    /// Connection is down
    Down,
}

/// JSON-RPC request
#[derive(Debug, Clone, Serialize, Deserialize)]
struct JsonRpcRequest {
    jsonrpc: String,
    id: u64,
    method: String,
    params: Vec<Value>,
}

/// JSON-RPC response
#[derive(Debug, Clone, Serialize, Deserialize)]
struct JsonRpcResponse {
    jsonrpc: String,
    id: u64,
    result: Option<Value>,
    error: Option<JsonRpcError>,
}

/// JSON-RPC error
#[derive(Debug, Clone, Serialize, Deserialize)]
struct JsonRpcError {
    code: i64,
    message: String,
}

/// Solana connection configuration
#[derive(Debug, Clone)]
pub struct SolanaConnectionConfig {
    /// Primary RPC endpoint
    pub primary_endpoint: String,
    
    /// Fallback RPC endpoints
    pub fallback_endpoints: Vec<String>,
    
    /// API key for RPC service (if any)
    pub api_key: Option<String>,
    
    /// Network (mainnet-beta, testnet, devnet)
    pub network: String,
    
    /// Commitment level
    pub commitment: String,
    
    /// Timeout in seconds
    pub timeout_seconds: u64,
    
    /// Maximum retries
    pub max_retries: usize,
}

impl Default for SolanaConnectionConfig {
    fn default() -> Self {
        // Check environment for custom RPC URL
        let primary_endpoint = env::var("INSTANT_NODES_RPC_URL")
            .unwrap_or_else(|_| "https://api.mainnet-beta.solana.com".to_string());
        
        // Check environment for API key
        let api_key = env::var("SOLANA_RPC_API_KEY").ok();
        
        Self {
            primary_endpoint,
            fallback_endpoints: vec![
                "https://solana-api.projectserum.com".to_string(),
                "https://rpc.ankr.com/solana".to_string(),
            ],
            api_key,
            network: "mainnet-beta".to_string(),
            commitment: "confirmed".to_string(),
            timeout_seconds: RPC_TIMEOUT_SECONDS,
            max_retries: MAX_RETRIES,
        }
    }
}

/// Solana blockchain connection
#[derive(Clone)]
pub struct SolanaConnection {
    /// HTTP client
    client: Client,
    
    /// Connection configuration
    config: RwLock<SolanaConnectionConfig>,
    
    /// Currently active endpoint
    active_endpoint: RwLock<String>,
    
    /// Current connection status
    status: RwLock<ConnectionStatus>,
    
    /// Last successful request time
    last_success: Mutex<Instant>,
    
    /// Request counter for statistics
    request_counter: RwLock<u64>,
    
    /// Failed request counter
    failed_counter: RwLock<u64>,
}

impl SolanaConnection {
    /// Create a new Solana connection
    pub fn new(endpoint: &str) -> Self {
        let mut config = SolanaConnectionConfig::default();
        config.primary_endpoint = endpoint.to_string();
        
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_seconds))
            .build()
            .expect("Failed to create HTTP client");
        
        Self {
            client,
            config: RwLock::new(config.clone()),
            active_endpoint: RwLock::new(config.primary_endpoint),
            status: RwLock::new(ConnectionStatus::NotInitialized),
            last_success: Mutex::new(Instant::now()),
            request_counter: RwLock::new(0),
            failed_counter: RwLock::new(0),
        }
    }
    
    /// Create a new Solana connection with custom configuration
    pub fn with_config(config: SolanaConnectionConfig) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_seconds))
            .build()
            .expect("Failed to create HTTP client");
        
        Self {
            client,
            active_endpoint: RwLock::new(config.primary_endpoint.clone()),
            config: RwLock::new(config),
            status: RwLock::new(ConnectionStatus::NotInitialized),
            last_success: Mutex::new(Instant::now()),
            request_counter: RwLock::new(0),
            failed_counter: RwLock::new(0),
        }
    }
    
    /// Initialize the connection
    pub async fn init(&self) -> Result<()> {
        info!("Initializing Solana connection");
        
        // Test connection
        match self.get_latest_blockhash().await {
            Ok(_) => {
                let mut status = self.status.write().unwrap();
                *status = ConnectionStatus::Operational;
                info!("Solana connection initialized successfully");
                Ok(())
            }
            Err(e) => {
                error!("Failed to initialize Solana connection: {}", e);
                Err(anyhow!("Failed to initialize Solana connection: {}", e))
            }
        }
    }
    
    /// Update connection status
    fn update_status(&self, new_status: ConnectionStatus) {
        let mut status = self.status.write().unwrap();
        if *status != new_status {
            debug!("Solana connection status changed: {:?} -> {:?}", *status, new_status);
            *status = new_status;
        }
    }
    
    /// Get active endpoint
    pub fn get_active_endpoint(&self) -> String {
        self.active_endpoint.read().unwrap().clone()
    }
    
    /// Check if using custom RPC endpoint
    pub fn is_using_custom_rpc(&self) -> bool {
        let config = self.config.read().unwrap();
        !config.primary_endpoint.contains("mainnet-beta.solana.com")
    }
    
    /// Check if using API key
    pub fn is_using_api_key(&self) -> bool {
        let config = self.config.read().unwrap();
        config.api_key.is_some()
    }
    
    /// Get network name
    pub fn get_network(&self) -> String {
        let config = self.config.read().unwrap();
        config.network.clone()
    }
    
    /// Get connection status
    pub fn get_status(&self) -> ConnectionStatus {
        *self.status.read().unwrap()
    }
    
    /// Get connection health JSON
    pub fn get_health_json(&self) -> Value {
        json!({
            "status": format!("{:?}", self.get_status()),
            "customRpc": self.is_using_custom_rpc(),
            "apiKey": self.is_using_api_key(),
            "network": self.get_network(),
            "endpoint": self.get_active_endpoint(),
            "timestamp": chrono::Utc::now().to_rfc3339(),
        })
    }
    
    /// Switch to next endpoint if current one is failing
    async fn try_fallback_endpoint(&self) -> Result<()> {
        let config = self.config.read().unwrap();
        let current = self.active_endpoint.read().unwrap().clone();
        
        // Find current endpoint index
        let current_index = if current == config.primary_endpoint {
            None
        } else {
            config.fallback_endpoints.iter().position(|e| *e == current)
        };
        
        // Get next endpoint
        let next_endpoint = match current_index {
            None => {
                // Current is primary, switch to first fallback
                config.fallback_endpoints.first().cloned()
            }
            Some(idx) => {
                // Try next fallback
                if idx + 1 < config.fallback_endpoints.len() {
                    config.fallback_endpoints.get(idx + 1).cloned()
                } else {
                    // Go back to primary
                    Some(config.primary_endpoint.clone())
                }
            }
        };
        
        if let Some(endpoint) = next_endpoint {
            warn!("Switching Solana RPC endpoint: {} -> {}", current, endpoint);
            let mut active = self.active_endpoint.write().unwrap();
            *active = endpoint;
            
            // Update status to degraded
            self.update_status(ConnectionStatus::Degraded);
            
            Ok(())
        } else {
            // No fallback available
            self.update_status(ConnectionStatus::Down);
            Err(anyhow!("No fallback endpoints available"))
        }
    }
    
    /// Send JSON-RPC request to Solana
    async fn send_request(&self, method: &str, params: Vec<Value>) -> Result<Value> {
        let config = self.config.read().unwrap();
        let endpoint = self.active_endpoint.read().unwrap().clone();
        
        // Update request counter
        {
            let mut counter = self.request_counter.write().unwrap();
            *counter += 1;
        }
        
        // Create request
        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: 1,
            method: method.to_string(),
            params,
        };
        
        // Add API key if available
        let mut headers = reqwest::header::HeaderMap::new();
        if let Some(api_key) = &config.api_key {
            headers.insert(
                "x-api-key",
                reqwest::header::HeaderValue::from_str(api_key)
                    .map_err(|e| anyhow!("Invalid API key header: {}", e))?,
            );
        }
        
        let mut retries = 0;
        let mut last_error = None;
        
        while retries < config.max_retries {
            if retries > 0 {
                debug!("Retrying RPC request ({}/{}): {}", retries + 1, config.max_retries, method);
                sleep(Duration::from_millis(500 * (retries as u64 + 1))).await;
            }
            
            // Send request
            let response = match self.client
                .post(&endpoint)
                .headers(headers.clone())
                .json(&request)
                .send()
                .await
            {
                Ok(resp) => resp,
                Err(e) => {
                    warn!("RPC request failed: {}", e);
                    last_error = Some(anyhow!("HTTP error: {}", e));
                    retries += 1;
                    continue;
                }
            };
            
            // Parse response
            let rpc_response: JsonRpcResponse = match response.json().await {
                Ok(resp) => resp,
                Err(e) => {
                    warn!("Failed to parse RPC response: {}", e);
                    last_error = Some(anyhow!("Parse error: {}", e));
                    retries += 1;
                    continue;
                }
            };
            
            // Check for RPC error
            if let Some(error) = rpc_response.error {
                warn!("RPC error: {} (code {})", error.message, error.code);
                last_error = Some(anyhow!("RPC error: {} (code {})", error.message, error.code));
                retries += 1;
                continue;
            }
            
            // Return result
            if let Some(result) = rpc_response.result {
                // Update last success
                {
                    let mut last = self.last_success.lock().unwrap();
                    *last = Instant::now();
                }
                
                // Update status if needed
                if self.get_status() != ConnectionStatus::Operational {
                    self.update_status(ConnectionStatus::Operational);
                }
                
                return Ok(result);
            } else {
                warn!("RPC response has no result");
                last_error = Some(anyhow!("RPC response has no result"));
                retries += 1;
                continue;
            }
        }
        
        // Update failed counter
        {
            let mut counter = self.failed_counter.write().unwrap();
            *counter += 1;
        }
        
        // Try fallback endpoint for next request
        let _ = self.try_fallback_endpoint().await;
        
        // Return last error
        Err(last_error.unwrap_or_else(|| anyhow!("Unknown RPC error")))
    }
    
    /// Get latest blockhash
    pub async fn get_latest_blockhash(&self) -> Result<String> {
        let params = vec![json!({
            "commitment": self.config.read().unwrap().commitment,
        })];
        
        let response = self.send_request("getLatestBlockhash", params).await?;
        
        // Extract blockhash
        let blockhash = response.get("value")
            .and_then(|v| v.get("blockhash"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Invalid response format"))?;
        
        Ok(blockhash.to_string())
    }
    
    /// Get account info
    pub async fn get_account_info(&self, pubkey: &str) -> Result<Value> {
        let params = vec![
            json!(pubkey),
            json!({
                "encoding": "jsonParsed",
                "commitment": self.config.read().unwrap().commitment,
            }),
        ];
        
        let response = self.send_request("getAccountInfo", params).await?;
        
        Ok(response)
    }
    
    /// Get token account balance
    pub async fn get_token_account_balance(&self, account: &str) -> Result<f64> {
        let params = vec![
            json!(account),
            json!({
                "commitment": self.config.read().unwrap().commitment,
            }),
        ];
        
        let response = self.send_request("getTokenAccountBalance", params).await?;
        
        // Extract balance and decimals
        let amount = response.get("value")
            .and_then(|v| v.get("amount"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Invalid response format"))?;
        
        let decimals = response.get("value")
            .and_then(|v| v.get("decimals"))
            .and_then(|v| v.as_u64())
            .ok_or_else(|| anyhow!("Invalid response format"))?;
        
        // Parse amount
        let amount_raw = amount.parse::<f64>()
            .context("Failed to parse amount")?;
        
        // Calculate real amount
        let real_amount = amount_raw / (10_f64.powi(decimals as i32));
        
        Ok(real_amount)
    }
    
    /// Get SOL balance
    pub async fn get_sol_balance(&self, address: &str) -> Result<f64> {
        let params = vec![
            json!(address),
            json!({
                "commitment": self.config.read().unwrap().commitment,
            }),
        ];
        
        let response = self.send_request("getBalance", params).await?;
        
        // Extract balance
        let balance = response.get("value")
            .and_then(|v| v.as_u64())
            .ok_or_else(|| anyhow!("Invalid response format"))?;
        
        // Calculate real amount (SOL has 9 decimals)
        let real_balance = balance as f64 / 1_000_000_000.0;
        
        Ok(real_balance)
    }
    
    /// Get token accounts by owner
    pub async fn get_token_accounts_by_owner(&self, owner: &str) -> Result<Value> {
        let params = vec![
            json!(owner),
            json!({
                "programId": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
            }),
            json!({
                "encoding": "jsonParsed",
                "commitment": self.config.read().unwrap().commitment,
            }),
        ];
        
        let response = self.send_request("getTokenAccountsByOwner", params).await?;
        
        Ok(response)
    }
    
    /// Send transaction
    pub async fn send_transaction(&self, serialized_tx: &str) -> Result<String> {
        let params = vec![
            json!(serialized_tx),
            json!({
                "encoding": "base64",
                "skipPreflight": false,
                "preflightCommitment": self.config.read().unwrap().commitment,
            }),
        ];
        
        let response = self.send_request("sendTransaction", params).await?;
        
        // Extract signature
        let signature = response.as_str()
            .ok_or_else(|| anyhow!("Invalid response format"))?;
        
        Ok(signature.to_string())
    }
    
    /// Get transaction status
    pub async fn get_transaction_status(&self, signature: &str) -> Result<Value> {
        let params = vec![
            json!(signature),
            json!({
                "encoding": "jsonParsed",
                "commitment": self.config.read().unwrap().commitment,
            }),
        ];
        
        let response = self.send_request("getTransaction", params).await?;
        
        Ok(response)
    }
}