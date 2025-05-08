use crate::dex::rate_limiter::RateLimiter;
use crate::solana::{SolanaConnection, WalletManager};
use anyhow::{Result, Context};
use log::{info, warn, debug, error};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::Keypair;
use solana_sdk::transaction::Transaction;

/// Jupiter V6 Quote Request
#[derive(Debug, Serialize, Deserialize)]
pub struct JupiterQuoteRequest {
    /// Input mint (from token)
    pub input_mint: String,
    
    /// Output mint (to token)
    pub output_mint: String,
    
    /// Amount of input token (in lamports/smallest denomination)
    pub amount: u64,
    
    /// Slippage basis points (100 = 1%)
    pub slippage_bps: u64,
    
    /// Only exact in
    #[serde(skip_serializing_if = "Option::is_none")]
    pub only_direct_routes: Option<bool>,
}

/// Jupiter V6 Quote Response
#[derive(Debug, Deserialize)]
pub struct JupiterQuoteResponse {
    /// Input mint
    pub input_mint: String,
    
    /// Input amount
    pub in_amount: String,
    
    /// Output mint
    pub output_mint: String,
    
    /// Output amount
    pub out_amount: String,
    
    /// Other data omitted for brevity
    // ...
}

/// Jupiter V6 Swap Request
#[derive(Debug, Serialize)]
pub struct JupiterSwapRequest {
    /// Quote response
    pub quote_response: String, // Serialized JupiterQuoteResponse
    
    /// User public key
    pub user_public_key: String,
}

/// Jupiter V6 Swap Response
#[derive(Debug, Deserialize)]
pub struct JupiterSwapResponse {
    /// Swap transaction
    pub swap_transaction: String, // Base64 encoded transaction
    
    /// Other data omitted for brevity
    // ...
}

/// Jupiter DEX Client
pub struct JupiterClient {
    /// Rate limiter
    rate_limiter: Arc<RateLimiter>,
    
    /// Solana connection
    solana_connection: Arc<SolanaConnection>,
    
    /// Wallet manager
    wallet_manager: Arc<WalletManager>,
    
    /// Jupiter API base URL
    api_base_url: String,
}

impl JupiterClient {
    /// Create a new Jupiter client
    pub fn new(
        rate_limiter: Arc<RateLimiter>,
        solana_connection: Arc<SolanaConnection>,
        wallet_manager: Arc<WalletManager>,
    ) -> Self {
        info!("Initializing Jupiter DEX client");
        
        Self {
            rate_limiter,
            solana_connection,
            wallet_manager,
            api_base_url: "https://quote-api.jup.ag/v6".to_string(),
        }
    }
    
    /// Get a swap quote
    pub async fn get_quote(
        &self,
        input_mint: &str,
        output_mint: &str,
        amount: u64,
        slippage_bps: u64,
    ) -> Result<JupiterQuoteResponse> {
        // Check rate limiter
        self.rate_limiter.check_dex_query().await?;
        
        debug!("Getting Jupiter quote: {} {} to {} with slippage {}bps", 
               amount, input_mint, output_mint, slippage_bps);
        
        let request = JupiterQuoteRequest {
            input_mint: input_mint.to_string(),
            output_mint: output_mint.to_string(),
            amount,
            slippage_bps,
            only_direct_routes: Some(false),
        };
        
        let client = reqwest::Client::new();
        let response = client
            .post(format!("{}/quote", self.api_base_url))
            .json(&request)
            .send()
            .await
            .context("Failed to send Jupiter quote request")?;
        
        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!(
                "Jupiter quote request failed with status {}: {}", 
                status, error_text
            ));
        }
        
        let quote_response = response.json::<JupiterQuoteResponse>().await
            .context("Failed to parse Jupiter quote response")?;
        
        debug!("Got Jupiter quote: {} out for {} in", 
               quote_response.out_amount, quote_response.in_amount);
        
        Ok(quote_response)
    }
    
    /// Get a swap transaction
    pub async fn get_swap_transaction(
        &self,
        quote_response: &JupiterQuoteResponse,
    ) -> Result<Transaction> {
        // Check rate limiter
        self.rate_limiter.check_dex_query().await?;
        
        debug!("Creating Jupiter swap transaction");
        
        // Get user's public key
        let wallet = self.wallet_manager.get_active_wallet()?;
        let pubkey = wallet.pubkey().to_string();
        
        // Create swap request
        let quote_json = serde_json::to_string(quote_response)
            .context("Failed to serialize quote response")?;
        
        let request = JupiterSwapRequest {
            quote_response: quote_json,
            user_public_key: pubkey,
        };
        
        let client = reqwest::Client::new();
        let response = client
            .post(format!("{}/swap", self.api_base_url))
            .json(&request)
            .send()
            .await
            .context("Failed to send Jupiter swap request")?;
        
        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!(
                "Jupiter swap request failed with status {}: {}", 
                status, error_text
            ));
        }
        
        let swap_response = response.json::<JupiterSwapResponse>().await
            .context("Failed to parse Jupiter swap response")?;
        
        // Decode the transaction
        let transaction_data = base64::decode(&swap_response.swap_transaction)
            .context("Failed to decode swap transaction data")?;
        
        let transaction = bincode::deserialize(&transaction_data)
            .context("Failed to deserialize swap transaction")?;
        
        debug!("Created Jupiter swap transaction successfully");
        
        Ok(transaction)
    }
    
    /// Execute a swap
    pub async fn execute_swap(
        &self,
        input_mint: &str,
        output_mint: &str,
        amount: u64,
        slippage_bps: u64,
    ) -> Result<String> {
        // Get quote
        let quote = self.get_quote(input_mint, output_mint, amount, slippage_bps).await?;
        
        // Check order submission rate limiter
        self.rate_limiter.check_order_submission().await?;
        
        // Get swap transaction
        let transaction = self.get_swap_transaction(&quote).await?;
        
        // Sign and send transaction
        let signature = self.wallet_manager.sign_and_send_transaction(&transaction)?;
        
        info!("Executed Jupiter swap: {} {} to {}, signature: {}", 
              amount, input_mint, output_mint, signature);
        
        Ok(signature.to_string())
    }
}