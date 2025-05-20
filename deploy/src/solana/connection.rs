use std::sync::Arc;
use log::{info, warn, error, debug};
use anyhow::{Result, anyhow};

use solana_client::{
    rpc_client::RpcClient, 
    client_error::ClientError,
    rpc_config::{RpcTransactionConfig, RpcBlockConfig, RpcSendTransactionConfig}
};
use solana_sdk::{
    commitment_config::{CommitmentConfig, CommitmentLevel},
    signature::{Keypair, Signature},
    transaction::Transaction,
    pubkey::Pubkey,
    clock::Slot
};
use solana_transaction_status::UiTransactionEncoding;

use crate::solana::rate_limiter::{RpcRateLimiter, RequestPriority};

/// Custom Solana connection with added features:
/// - RPC rate limiting
/// - WebSocket support with graceful fallback to HTTP
/// - Transaction monitoring
/// - Self-healing capabilities
pub struct SolanaConnection {
    // RPC client connections
    primary_rpc: RpcClient,
    backup_rpc: Option<RpcClient>,
    
    // WebSocket connection details
    ws_url: Option<String>,
    
    // Rate limiter
    rate_limiter: Arc<RpcRateLimiter>,
    
    // Connection health tracking
    primary_healthy: bool,
    consecutive_failures: u8,
    
    // Configuration
    commitment: CommitmentConfig,
}

impl SolanaConnection {
    /// Create a new Solana connection
    pub fn new(
        primary_url: &str, 
        backup_url: Option<&str>, 
        ws_url: Option<&str>,
        commitment: Option<CommitmentConfig>
    ) -> Self {
        // Create primary RPC client
        let primary_rpc = RpcClient::new_with_commitment(
            primary_url.to_string(),
            commitment.unwrap_or(CommitmentConfig::confirmed())
        );
        
        // Create backup RPC client if URL provided
        let backup_rpc = backup_url.map(|url| {
            RpcClient::new_with_commitment(
                url.to_string(),
                commitment.unwrap_or(CommitmentConfig::confirmed())
            )
        });
        
        // Store WebSocket URL if provided
        let ws_url = ws_url.map(|url| url.to_string());
        
        // Create rate limiter
        let rate_limiter = Arc::new(RpcRateLimiter::new());
        
        Self {
            primary_rpc,
            backup_rpc,
            ws_url,
            rate_limiter,
            primary_healthy: true,
            consecutive_failures: 0,
            commitment: commitment.unwrap_or(CommitmentConfig::confirmed()),
        }
    }
    
    /// Get a clone of the rate limiter for external use
    pub fn get_rate_limiter(&self) -> Arc<RpcRateLimiter> {
        self.rate_limiter.clone()
    }
    
    /// Get the current RPC usage statistics
    pub fn get_rpc_stats(&self) -> String {
        self.rate_limiter.get_stats().get_summary()
    }
    
    /// Check if the connection is healthy
    pub async fn health_check(&mut self) -> bool {
        let result = self.rate_limiter.adaptive_request(
            RequestPriority::Low,
            || self.primary_rpc.get_health()
        ).await;
        
        match result {
            Ok(health) => {
                if !health {
                    warn!("Solana RPC reports unhealthy status");
                    self.primary_healthy = false;
                    self.consecutive_failures += 1;
                } else {
                    if !self.primary_healthy {
                        info!("Solana RPC health restored");
                    }
                    self.primary_healthy = true;
                    self.consecutive_failures = 0;
                }
                health
            },
            Err(e) => {
                warn!("Solana RPC health check failed: {}", e);
                self.primary_healthy = false;
                self.consecutive_failures += 1;
                
                // Try backup if available
                if let Some(ref backup_rpc) = self.backup_rpc {
                    match backup_rpc.get_health() {
                        Ok(health) => {
                            if health {
                                info!("Backup RPC connection is healthy");
                                return true;
                            }
                        },
                        Err(_) => {}
                    }
                }
                
                false
            }
        }
    }
    
    /// Get the current slot
    pub async fn get_slot(&self) -> Result<Slot> {
        self.rate_limiter.adaptive_request(
            RequestPriority::Medium,
            || {
                match self.primary_rpc.get_slot() {
                    Ok(slot) => Ok(slot),
                    Err(e) => {
                        // Try backup if available
                        if let Some(ref backup_rpc) = self.backup_rpc {
                            backup_rpc.get_slot().map_err(|be| {
                                anyhow!("Both primary and backup RPC failed to get slot: {}, {}", e, be)
                            })
                        } else {
                            Err(anyhow!("Failed to get slot: {}", e))
                        }
                    }
                }
            }
        ).await
    }
    
    /// Get account info
    pub async fn get_account(&self, pubkey: &Pubkey) -> Result<solana_sdk::account::Account> {
        self.rate_limiter.adaptive_request(
            RequestPriority::Medium,
            || {
                match self.primary_rpc.get_account(pubkey) {
                    Ok(account) => Ok(account),
                    Err(e) => {
                        // Try backup if available
                        if let Some(ref backup_rpc) = self.backup_rpc {
                            backup_rpc.get_account(pubkey).map_err(|be| {
                                anyhow!("Both primary and backup RPC failed to get account: {}, {}", e, be)
                            })
                        } else {
                            Err(anyhow!("Failed to get account: {}", e))
                        }
                    }
                }
            }
        ).await
    }
    
    /// Send transaction with retry and fallback
    pub async fn send_transaction(&self, transaction: &Transaction) -> Result<Signature> {
        self.rate_limiter.adaptive_request(
            RequestPriority::Critical,
            || {
                let config = RpcSendTransactionConfig {
                    skip_preflight: false,
                    preflight_commitment: Some(self.commitment.commitment),
                    encoding: Some(UiTransactionEncoding::Base64),
                    max_retries: Some(5),
                    min_context_slot: None,
                };
                
                match self.primary_rpc.send_transaction_with_config(transaction, config) {
                    Ok(signature) => Ok(signature),
                    Err(e) => {
                        warn!("Primary RPC failed to send transaction: {}", e);
                        
                        // Try backup if available
                        if let Some(ref backup_rpc) = self.backup_rpc {
                            backup_rpc.send_transaction_with_config(transaction, config).map_err(|be| {
                                anyhow!("Both primary and backup RPC failed to send transaction: {}, {}", e, be)
                            })
                        } else {
                            Err(anyhow!("Failed to send transaction: {}", e))
                        }
                    }
                }
            }
        ).await
    }
    
    /// Confirm transaction
    pub async fn confirm_transaction(&self, signature: &Signature) -> Result<bool> {
        self.rate_limiter.adaptive_request(
            RequestPriority::High,
            || {
                match self.primary_rpc.confirm_transaction(signature) {
                    Ok(confirmed) => Ok(confirmed),
                    Err(e) => {
                        // Try backup if available
                        if let Some(ref backup_rpc) = self.backup_rpc {
                            backup_rpc.confirm_transaction(signature).map_err(|be| {
                                anyhow!("Both primary and backup RPC failed to confirm transaction: {}, {}", e, be)
                            })
                        } else {
                            Err(anyhow!("Failed to confirm transaction: {}", e))
                        }
                    }
                }
            }
        ).await
    }
    
    /// Get transaction details
    pub async fn get_transaction(&self, signature: &Signature) -> Result<solana_transaction_status::EncodedConfirmedTransaction> {
        self.rate_limiter.adaptive_request(
            RequestPriority::Medium,
            || {
                let config = RpcTransactionConfig {
                    encoding: Some(UiTransactionEncoding::Base64),
                    commitment: Some(self.commitment),
                    max_supported_transaction_version: Some(0),
                };
                
                match self.primary_rpc.get_transaction_with_config(signature, config) {
                    Ok(tx) => Ok(tx),
                    Err(e) => {
                        // Try backup if available
                        if let Some(ref backup_rpc) = self.backup_rpc {
                            backup_rpc.get_transaction_with_config(signature, config).map_err(|be| {
                                anyhow!("Both primary and backup RPC failed to get transaction: {}, {}", e, be)
                            })
                        } else {
                            Err(anyhow!("Failed to get transaction: {}", e))
                        }
                    }
                }
            }
        ).await
    }
    
    /// Get program accounts
    pub async fn get_program_accounts(&self, program_id: &Pubkey) -> Result<Vec<(Pubkey, solana_sdk::account::Account)>> {
        self.rate_limiter.adaptive_request(
            RequestPriority::Medium,
            || {
                match self.primary_rpc.get_program_accounts(program_id) {
                    Ok(accounts) => Ok(accounts),
                    Err(e) => {
                        // Try backup if available
                        if let Some(ref backup_rpc) = self.backup_rpc {
                            backup_rpc.get_program_accounts(program_id).map_err(|be| {
                                anyhow!("Both primary and backup RPC failed to get program accounts: {}, {}", e, be)
                            })
                        } else {
                            Err(anyhow!("Failed to get program accounts: {}", e))
                        }
                    }
                }
            }
        ).await
    }
    
    /// Get recent block hash
    pub async fn get_recent_blockhash(&self) -> Result<(solana_sdk::hash::Hash, solana_sdk::fee_calculator::FeeCalculator)> {
        self.rate_limiter.adaptive_request(
            RequestPriority::High,
            || {
                match self.primary_rpc.get_recent_blockhash() {
                    Ok(blockhash) => Ok(blockhash),
                    Err(e) => {
                        // Try backup if available
                        if let Some(ref backup_rpc) = self.backup_rpc {
                            backup_rpc.get_recent_blockhash().map_err(|be| {
                                anyhow!("Both primary and backup RPC failed to get recent blockhash: {}, {}", e, be)
                            })
                        } else {
                            Err(anyhow!("Failed to get recent blockhash: {}", e))
                        }
                    }
                }
            }
        ).await
    }
    
    /// Get balance
    pub async fn get_balance(&self, pubkey: &Pubkey) -> Result<u64> {
        self.rate_limiter.adaptive_request(
            RequestPriority::Medium,
            || {
                match self.primary_rpc.get_balance(pubkey) {
                    Ok(balance) => Ok(balance),
                    Err(e) => {
                        // Try backup if available
                        if let Some(ref backup_rpc) = self.backup_rpc {
                            backup_rpc.get_balance(pubkey).map_err(|be| {
                                anyhow!("Both primary and backup RPC failed to get balance: {}, {}", e, be)
                            })
                        } else {
                            Err(anyhow!("Failed to get balance: {}", e))
                        }
                    }
                }
            }
        ).await
    }
    
    /// Sign and send transaction
    pub async fn sign_and_send_transaction(&self, transaction: &mut Transaction, signer: &Keypair) -> Result<Signature> {
        // Get recent blockhash
        let (recent_blockhash, _) = self.get_recent_blockhash().await?;
        
        // Update transaction with recent blockhash
        transaction.message.recent_blockhash = recent_blockhash;
        
        // Sign transaction
        transaction.sign(&[signer], recent_blockhash);
        
        // Send transaction
        self.send_transaction(transaction).await
    }
    
    /// Check if WebSocket connection is available
    pub fn has_websocket(&self) -> bool {
        self.ws_url.is_some()
    }
    
    /// Get WebSocket URL if available
    pub fn get_websocket_url(&self) -> Option<String> {
        self.ws_url.clone()
    }
    
    /// Calculate rate limits based on our RPC constraints
    pub fn calculate_rate_limits(&self) -> String {
        let daily_limit = 40_000;
        let hourly_allocation = daily_limit / 24;
        let minute_allocation = hourly_allocation / 60;
        let second_allocation = minute_allocation / 60;
        
        let critical_cost = 1;
        let high_cost = 2;
        let medium_cost = 3;
        let low_cost = 5;
        
        let critical_per_day = daily_limit / critical_cost;
        let high_per_day = daily_limit / high_cost;
        let medium_per_day = daily_limit / medium_cost;
        let low_per_day = daily_limit / low_cost;
        
        let critical_per_hour = hourly_allocation / critical_cost;
        let high_per_hour = hourly_allocation / high_cost;
        let medium_per_hour = hourly_allocation / medium_cost;
        let low_per_hour = hourly_allocation / low_cost;
        
        let critical_per_minute = minute_allocation / critical_cost;
        let high_per_minute = minute_allocation / high_cost;
        let medium_per_minute = minute_allocation / medium_cost;
        let low_per_minute = minute_allocation / low_cost;
        
        format!(
            "RPC Rate Limits with 40k daily limit:\n\
            - Per day: {} requests\n\
            - Per hour: {} requests\n\
            - Per minute: {} requests\n\
            - Per second: {} requests\n\n\
            Request capacity by priority:\n\
            - Critical: {}/day, {}/hour, {}/minute\n\
            - High: {}/day, {}/hour, {}/minute\n\
            - Medium: {}/day, {}/hour, {}/minute\n\
            - Low: {}/day, {}/hour, {}/minute",
            daily_limit, hourly_allocation, minute_allocation, second_allocation,
            critical_per_day, critical_per_hour, critical_per_minute,
            high_per_day, high_per_hour, high_per_minute,
            medium_per_day, medium_per_hour, medium_per_minute,
            low_per_day, low_per_hour, low_per_minute
        )
    }
}

impl Clone for SolanaConnection {
    fn clone(&self) -> Self {
        Self {
            primary_rpc: RpcClient::new_with_commitment(
                self.primary_rpc.url().to_string(),
                self.commitment
            ),
            backup_rpc: self.backup_rpc.as_ref().map(|client| {
                RpcClient::new_with_commitment(
                    client.url().to_string(),
                    self.commitment
                )
            }),
            ws_url: self.ws_url.clone(),
            rate_limiter: self.rate_limiter.clone(),
            primary_healthy: self.primary_healthy,
            consecutive_failures: self.consecutive_failures,
            commitment: self.commitment,
        }
    }
}