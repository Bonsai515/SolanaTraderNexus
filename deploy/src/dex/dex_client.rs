use crate::dex::{
    rate_limiter::RateLimiter,
    price_feed::{PriceFeed, PriceFeedConfig},
    jupiter::JupiterClient,
    raydium::RaydiumClient,
    openbook::{OpenbookClient, Side as OpenbookSide},
};
use crate::dex::lending::solend::SolendClient;
use crate::solana::{SolanaConnection, WalletManager};
use crate::models::{MarketData, TokenPrice};
use anyhow::{Result, Context};
use log::{info, warn, debug, error};
use std::sync::Arc;
use std::collections::HashMap;

/// DEX selection for swap
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DexSource {
    /// Auto-select best DEX
    Auto,
    /// Use Jupiter
    Jupiter,
    /// Use Raydium
    Raydium,
    /// Use Openbook
    Openbook,
}

/// Side of a trade
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TradeSide {
    /// Buy base token
    Buy,
    /// Sell base token
    Sell,
}

/// Trading strategy
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TradingStrategy {
    /// Market making (place limit orders on both sides)
    MarketMaking,
    /// Range trading (buy at support, sell at resistance)
    RangeTrading,
    /// Momentum trading (follow trend)
    MomentumTrading,
    /// Arbitrage (exploit price differences between venues)
    Arbitrage,
}

/// All-in-one DEX client
pub struct DexClient {
    /// Rate limiter
    rate_limiter: Arc<RateLimiter>,
    
    /// Price feed
    price_feed: Arc<PriceFeed>,
    
    /// Jupiter client
    jupiter: Arc<JupiterClient>,
    
    /// Raydium client
    raydium: Arc<RaydiumClient>,
    
    /// Openbook client
    openbook: Arc<OpenbookClient>,
    
    /// Solend client
    solend: Arc<SolendClient>,
    
    /// Active strategies
    active_strategies: HashMap<String, TradingStrategy>,
}

impl DexClient {
    /// Create a new DEX client
    pub async fn new(
        solana_connection: Arc<SolanaConnection>,
        wallet_manager: Arc<WalletManager>,
    ) -> Result<Self> {
        info!("Initializing DEX client");
        
        // Create rate limiter
        let rate_limiter = Arc::new(RateLimiter::new());
        
        // Create price feed
        let price_feed_config = PriceFeedConfig::default();
        let price_feed = Arc::new(PriceFeed::new(
            price_feed_config,
            Arc::clone(&rate_limiter),
            Arc::clone(&solana_connection),
        ));
        
        // Create Jupiter client
        let jupiter = Arc::new(JupiterClient::new(
            Arc::clone(&rate_limiter),
            Arc::clone(&solana_connection),
            Arc::clone(&wallet_manager),
        ));
        
        // Create Raydium client
        let raydium = Arc::new(RaydiumClient::new(
            Arc::clone(&rate_limiter),
            Arc::clone(&solana_connection),
            Arc::clone(&wallet_manager),
        )?);
        
        // Create Openbook client
        let openbook = Arc::new(OpenbookClient::new(
            Arc::clone(&rate_limiter),
            Arc::clone(&solana_connection),
            Arc::clone(&wallet_manager),
        )?);
        
        // Create Solend client
        let solend = Arc::new(SolendClient::new(
            Arc::clone(&rate_limiter),
            Arc::clone(&solana_connection),
            Arc::clone(&wallet_manager),
        )?);
        
        // Initialize all clients
        let client = Self {
            rate_limiter,
            price_feed,
            jupiter,
            raydium,
            openbook,
            solend,
            active_strategies: HashMap::new(),
        };
        
        // Start the price feed
        client.price_feed.start()?;
        
        // Initialize pools and markets
        client.initialize_markets().await?;
        
        info!("DEX client initialized successfully");
        
        Ok(client)
    }
    
    /// Initialize all markets and pools
    async fn initialize_markets(&self) -> Result<()> {
        // Initialize Raydium pools
        let mut raydium = self.raydium.clone();
        raydium.initialize_pools().await?;
        
        // Initialize Openbook markets  
        let mut openbook = self.openbook.clone();
        openbook.initialize_markets().await?;
        
        // Initialize Solend pools
        let mut solend = self.solend.clone();
        solend.initialize_pools().await?;
        
        Ok(())
    }
    
    /// Get latest market data
    pub fn get_market_data(&self) -> Result<MarketData> {
        self.price_feed.get_market_data()
    }
    
    /// Add token to price feed
    pub fn add_token(&self, token_symbol: &str) -> Result<()> {
        self.price_feed.add_token(token_symbol)
    }
    
    /// Get token price
    pub fn get_token_price(&self, token_symbol: &str) -> Result<TokenPrice> {
        let market_data = self.get_market_data()?;
        
        market_data.tokens.iter()
            .find(|t| t.symbol == token_symbol)
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("Token price not found: {}", token_symbol))
    }
    
    /// Swap tokens using best available DEX
    pub async fn swap_tokens(
        &self,
        input_mint: &str,
        output_mint: &str,
        amount: f64,
        slippage_bps: u64,
        dex: DexSource,
    ) -> Result<String> {
        info!("Swapping {} tokens: {} -> {}", amount, input_mint, output_mint);
        
        // Convert amount to lamports/smallest unit
        let amount_in_smallest_unit = (amount * 1_000_000_000.0) as u64; // Assuming 9 decimals
        
        // Use specified DEX or find best price
        match dex {
            DexSource::Jupiter => {
                self.jupiter.execute_swap(
                    input_mint, 
                    output_mint, 
                    amount_in_smallest_unit, 
                    slippage_bps
                ).await
            },
            DexSource::Raydium => {
                self.raydium.execute_swap(
                    input_mint,
                    output_mint,
                    amount_in_smallest_unit,
                    slippage_bps
                ).await
            },
            DexSource::Openbook => {
                // For Openbook, we need to convert to a market order on the appropriate market
                let market_id = format!("{}/{}", 
                    self.token_mint_to_symbol(input_mint)?,
                    self.token_mint_to_symbol(output_mint)?
                );
                
                self.openbook.execute_market_order(
                    &market_id,
                    OpenbookSide::Sell, // Selling input token for output token
                    amount,
                    1.0, // 1% max price impact
                ).await
            },
            DexSource::Auto => {
                // Get quotes from all DEXes and use the best one
                // For simplicity, we'll just use Jupiter for now
                self.jupiter.execute_swap(
                    input_mint,
                    output_mint,
                    amount_in_smallest_unit,
                    slippage_bps
                ).await
            }
        }
    }
    
    /// Deposit tokens to lending protocol
    pub async fn deposit_to_lending(
        &self,
        token_mint: &str,
        amount: f64,
    ) -> Result<String> {
        info!("Depositing {} tokens (mint: {}) to lending protocol", amount, token_mint);
        
        // For now, we'll just use Solend
        self.solend.deposit(token_mint, amount).await
    }
    
    /// Withdraw tokens from lending protocol
    pub async fn withdraw_from_lending(
        &self,
        token_mint: &str,
        amount: f64,
    ) -> Result<String> {
        info!("Withdrawing {} tokens (mint: {}) from lending protocol", amount, token_mint);
        
        // For now, we'll just use Solend
        self.solend.withdraw(token_mint, amount).await
    }
    
    /// Borrow tokens from lending protocol
    pub async fn borrow_from_lending(
        &self,
        token_mint: &str,
        amount: f64,
    ) -> Result<String> {
        info!("Borrowing {} tokens (mint: {}) from lending protocol", amount, token_mint);
        
        // For now, we'll just use Solend
        self.solend.borrow(token_mint, amount).await
    }
    
    /// Repay borrowed tokens to lending protocol
    pub async fn repay_to_lending(
        &self,
        token_mint: &str,
        amount: f64,
    ) -> Result<String> {
        info!("Repaying {} tokens (mint: {}) to lending protocol", amount, token_mint);
        
        // For now, we'll just use Solend
        self.solend.repay(token_mint, amount).await
    }
    
    /// Get lending protocol obligation/position
    pub async fn get_lending_position(&self) -> Result<String> {
        info!("Getting lending protocol position");
        
        // Get Solend obligation
        let obligation = self.solend.get_user_obligation().await?
            .ok_or_else(|| anyhow::anyhow!("No lending obligation found"))?;
        
        // Format as a readable string
        let mut result = format!("Lending Position (Health Factor: {:.2})\n", obligation.health_factor);
        
        // Add deposits
        result.push_str("Deposits:\n");
        for deposit in &obligation.deposits {
            result.push_str(&format!("  {:.6} {} (${:.2})\n", 
                                    deposit.amount, deposit.symbol, deposit.usd_value));
        }
        
        // Add borrows
        result.push_str("Borrows:\n");
        for borrow in &obligation.borrows {
            result.push_str(&format!("  {:.6} {} (${:.2})\n", 
                                    borrow.amount, borrow.symbol, borrow.usd_value));
        }
        
        Ok(result)
    }
    
    /// Place a limit order on Openbook
    pub async fn place_limit_order(
        &self,
        market_id: &str,
        side: TradeSide,
        price: f64,
        size: f64,
    ) -> Result<String> {
        info!("Placing limit order: market={}, side={:?}, price={}, size={}", 
              market_id, side, price, size);
        
        // Convert TradeSide to OpenbookSide
        let openbook_side = match side {
            TradeSide::Buy => OpenbookSide::Buy,
            TradeSide::Sell => OpenbookSide::Sell,
        };
        
        // Place the order
        self.openbook.place_limit_order(market_id, openbook_side, price, size).await
    }
    
    /// Activate a trading strategy
    pub fn activate_strategy(
        &mut self,
        token_pair: &str,
        strategy: TradingStrategy,
    ) -> Result<()> {
        info!("Activating {:?} strategy for {}", strategy, token_pair);
        
        self.active_strategies.insert(token_pair.to_string(), strategy);
        
        Ok(())
    }
    
    /// Deactivate a trading strategy
    pub fn deactivate_strategy(
        &mut self,
        token_pair: &str,
    ) -> Result<()> {
        info!("Deactivating strategy for {}", token_pair);
        
        self.active_strategies.remove(token_pair);
        
        Ok(())
    }
    
    /// Helper method to convert token mint to symbol
    fn token_mint_to_symbol(&self, token_mint: &str) -> Result<String> {
        // In a real implementation, you would look up the mint in a registry
        // For now, we'll just use well-known mints
        match token_mint {
            "So11111111111111111111111111111111111111112" => Ok("SOL".to_string()),
            "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" => Ok("USDC".to_string()),
            "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E" => Ok("BTC".to_string()),
            "2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk" => Ok("ETH".to_string()),
            "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R" => Ok("RAY".to_string()),
            "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE" => Ok("ORCA".to_string()),
            "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" => Ok("BONK".to_string()),
            "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN" => Ok("JUP".to_string()),
            _ => Err(anyhow::anyhow!("Unknown token mint: {}", token_mint)),
        }
    }
}