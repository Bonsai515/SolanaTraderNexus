//! Activate Singularity Cross-Chain Oracle Agent
//!
//! This binary command-line tool activates the Singularity agent for live trading.
//! It configures the agent with real wallets and trading parameters, then starts it.

use anyhow::{Result, Context};
use clap::{Parser, Subcommand};
use std::path::PathBuf;
use std::str::FromStr;
use solana_sdk::pubkey::Pubkey;
use std::time::Duration;

#[path = "../agents/singularity/mod.rs"]
mod singularity;
use singularity::{AgentConfig, SingularityAgent, AgentState};

/// CLI arguments 
#[derive(Parser, Debug)]
#[clap(author, version, about)]
struct Args {
    #[clap(subcommand)]
    command: Commands,
}

/// Supported commands
#[derive(Subcommand, Debug)]
enum Commands {
    /// Start the Singularity agent
    Start {
        /// Trading wallet address
        #[clap(long, default_value = "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb")]
        trading_wallet: String,
        
        /// Profit wallet address
        #[clap(long, default_value = "6bLfHsp6eCFWZqGKZQaRwpVVLZRwKqcLt6QCKwLoxTqF")]
        profit_wallet: String,
        
        /// Fee wallet address
        #[clap(long, default_value = "9aBt1zPRUZmxttZ6Mk9AAU6XGS1TLQMZkpbCNBLH2Y2z")]
        fee_wallet: String,
        
        /// Use system wallet as trading wallet
        #[clap(long, default_value = "true")]
        use_system_wallet: bool,
        
        /// Maximum input amount (in USD)
        #[clap(long, default_value = "1000.0")]
        max_input: f64,
        
        /// Minimum profit percentage
        #[clap(long, default_value = "0.5")]
        min_profit_pct: f64,
        
        /// Dry run mode (no actual trades)
        #[clap(long, default_value = "false")]
        dry_run: bool,
    },
    
    /// Check the status of the Singularity agent
    Status,
    
    /// Stop the Singularity agent
    Stop,
}

#[tokio::main]
async fn main() -> Result<()> {
    // Parse command line arguments
    let args = Args::parse();
    
    // Process commands
    match args.command {
        Commands::Start {
            trading_wallet,
            profit_wallet,
            fee_wallet,
            use_system_wallet,
            max_input,
            min_profit_pct,
            dry_run,
        } => {
            // Validate wallet addresses
            let trading_pubkey = Pubkey::from_str(&trading_wallet)
                .context("Invalid trading wallet address")?;
            
            let profit_pubkey = Pubkey::from_str(&profit_wallet)
                .context("Invalid profit wallet address")?;
            
            let fee_pubkey = Pubkey::from_str(&fee_wallet)
                .context("Invalid fee wallet address")?;
            
            // Create agent configuration
            let mut config = AgentConfig::default();
            
            // Update wallet configuration
            config.executor_config.wallets.trading_wallet = trading_wallet;
            config.executor_config.wallets.profit_wallet = profit_wallet;
            config.executor_config.wallets.fee_wallet = Some(fee_wallet);
            config.executor_config.wallets.use_system_wallet = use_system_wallet;
            
            // Update strategy parameters
            config.strategy_params.max_input_amount = max_input;
            config.strategy_params.min_profit_percentage = min_profit_pct;
            
            // Set dry run mode
            config.executor_config.dry_run = dry_run;
            
            // Create and initialize agent
            let mut agent = SingularityAgent::new(config);
            
            println!("🚀 Initializing Singularity agent...");
            
            // Initialize agent
            agent.initialize().await?;
            
            // Start agent
            if dry_run {
                println!("🔍 Starting Singularity in DRY RUN mode (no real trades)");
            } else {
                println!("🔥 Starting Singularity for LIVE TRADING with REAL FUNDS");
                println!("⚠️  WARNING: This will use real funds!");
                
                // Short delay to allow for cancellation
                for i in (1..=5).rev() {
                    println!("Starting in {} seconds... Press Ctrl+C to cancel", i);
                    tokio::time::sleep(Duration::from_secs(1)).await;
                }
            }
            
            agent.start().await?;
            
            println!("✅ Singularity agent started successfully");
            
            // Keep running until interrupted
            println!("Singularity is now running. Press Ctrl+C to stop...");
            
            // Handle Ctrl+C
            let (tx, rx) = tokio::sync::oneshot::channel::<()>();
            
            tokio::spawn(async move {
                tokio::signal::ctrl_c().await.unwrap();
                let _ = tx.send(());
            });
            
            // Wait for Ctrl+C
            rx.await.ok();
            
            // Stop the agent
            println!("🛑 Stopping Singularity agent...");
            agent.stop().await?;
            
            println!("✅ Singularity agent stopped successfully");
        }
        
        Commands::Status => {
            println!("🔍 Checking Singularity agent status...");
            println!("This feature is not yet implemented.");
            println!("To check agent status, use the web dashboard or REST API.");
        }
        
        Commands::Stop => {
            println!("🛑 Stopping Singularity agent...");
            println!("This feature is not yet implemented.");
            println!("To stop the agent, use the web dashboard or REST API, or press Ctrl+C in the agent console.");
        }
    }
    
    Ok(())
}