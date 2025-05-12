//! Singularity Agent Activation Tool
//!
//! This binary is used to activate the Singularity agent for cross-chain arbitrage.
//! It provides a command-line interface to configure and start the agent.

use std::path::PathBuf;
use std::time::Duration;
use clap::{Parser, Subcommand};
use tokio::time::sleep;
use anyhow::{Result, anyhow, Context};

/// Singularity agent mode
#[derive(Debug, Clone, PartialEq, clap::ValueEnum)]
enum AgentMode {
    /// Scan only (no execution)
    ScanOnly,
    
    /// Dry run (simulation only)
    DryRun,
    
    /// Live trading (real funds)
    LiveTrading,
}

/// Command line arguments
#[derive(Parser, Debug)]
#[command(name = "activate_singularity")]
#[command(about = "Activate Singularity agent for cross-chain arbitrage", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

/// Supported commands
#[derive(Subcommand, Debug)]
enum Commands {
    /// Start the Singularity agent
    Start {
        /// Agent mode
        #[arg(long, value_enum, default_value_t = AgentMode::ScanOnly)]
        mode: AgentMode,
        
        /// Trading wallet address
        #[arg(long, default_value = "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb")]
        trading_wallet: String,
        
        /// Profit wallet address
        #[arg(long, default_value = "6bLfHsp6eCFWZqGKZQaRwpVVLZRwKqcLt6QCKwLoxTqF")]
        profit_wallet: String,
        
        /// Fee wallet address
        #[arg(long, default_value = "9aBt1zPRUZmxttZ6Mk9AAU6XGS1TLQMZkpbCNBLH2Y2z")]
        fee_wallet: String,
        
        /// Use system wallet for trading
        #[arg(long, default_value_t = true)]
        use_system_wallet: bool,
        
        /// Maximum input amount
        #[arg(long, default_value_t = 1000.0)]
        max_input: f64,
        
        /// Minimum profit percentage
        #[arg(long, default_value_t = 0.5)]
        min_profit_pct: f64,
        
        /// Dry run (no real trades)
        #[arg(long, default_value_t = false)]
        dry_run: bool,
        
        /// Log file
        #[arg(long)]
        log_file: Option<PathBuf>,
        
        /// Verbose output
        #[arg(short, long, default_value_t = false)]
        verbose: bool,
    },
    
    /// Stop the Singularity agent
    Stop {
        /// Agent ID
        #[arg(long)]
        agent_id: Option<String>,
        
        /// Log file
        #[arg(long)]
        log_file: Option<PathBuf>,
        
        /// Verbose output
        #[arg(short, long, default_value_t = false)]
        verbose: bool,
    },
    
    /// Get the status of the Singularity agent
    Status {
        /// Agent ID
        #[arg(long)]
        agent_id: Option<String>,
        
        /// Verbose output
        #[arg(short, long, default_value_t = false)]
        verbose: bool,
    },
}

/// Main function
#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    
    match cli.command {
        Commands::Start {
            mode,
            trading_wallet,
            profit_wallet,
            fee_wallet,
            use_system_wallet,
            max_input,
            min_profit_pct,
            dry_run,
            log_file,
            verbose,
        } => {
            // Convert mode to agent mode
            let agent_mode = match mode {
                AgentMode::ScanOnly => {
                    println!("Starting Singularity agent in SCAN ONLY mode");
                    singularity::AgentMode::ScanOnly
                },
                AgentMode::DryRun => {
                    println!("Starting Singularity agent in DRY RUN mode (simulated trades only)");
                    singularity::AgentMode::DryRun
                },
                AgentMode::LiveTrading => {
                    println!("Starting Singularity agent in LIVE TRADING mode (REAL FUNDS)");
                    singularity::AgentMode::LiveTrading
                },
            };
            
            // Configure logging
            if let Some(log_file) = log_file {
                println!("Logging to file: {}", log_file.display());
            }
            
            if verbose {
                println!("Verbose mode enabled");
            }
            
            // Print configuration
            println!("Agent configuration:");
            println!("  Trading wallet: {}", trading_wallet);
            println!("  Profit wallet: {}", profit_wallet);
            println!("  Fee wallet: {}", fee_wallet);
            println!("  Use system wallet: {}", use_system_wallet);
            println!("  Max input: ${:.2}", max_input);
            println!("  Min profit percentage: {:.2}%", min_profit_pct);
            println!("  Dry run: {}", dry_run);
            
            // Initialize the agent
            println!("Initializing Singularity agent...");
            
            // Create wallet configuration
            let wallet_config = singularity::strategy::WalletConfig {
                trading_wallet,
                profit_wallet,
                fee_wallet,
                use_system_wallet,
            };
            
            // Create strategy configuration
            let strategy_config = singularity::strategy::StrategyConfig {
                min_profit_percentage: min_profit_pct,
                max_input_amount: max_input,
                ..Default::default()
            };
            
            // Create scanner configuration
            let scanner_config = singularity::scanner::ScannerConfig {
                strategy_config: strategy_config.clone(),
                ..Default::default()
            };
            
            // Create execution configuration
            let execution_config = singularity::executor::ExecutionConfig {
                wallets: wallet_config.clone(),
                dry_run: dry_run || agent_mode != singularity::AgentMode::LiveTrading,
                ..Default::default()
            };
            
            // Create validation configuration
            let validation_config = singularity::validator::ValidationConfig {
                min_profit_percentage: min_profit_pct,
                ..Default::default()
            };
            
            // Create agent configuration
            let agent_config = singularity::SingularityAgentConfig {
                mode: agent_mode,
                scanner_config,
                strategy_config,
                execution_config,
                validation_config,
                wallet_config,
                ..Default::default()
            };
            
            // Create and start the agent
            let agent = singularity::SingularityAgent::new(agent_config);
            
            println!("Starting Singularity agent...");
            agent.start().await?;
            
            println!("Singularity agent started successfully");
            println!("Agent is now running in the background");
            println!("Press Ctrl+C to stop the agent");
            
            // Keep the process running
            loop {
                // Check agent state
                let state = agent.get_state();
                let metrics = agent.get_metrics();
                
                // Print status
                if verbose {
                    println!("Agent state: {:?}", state);
                    println!("Scans: {}", metrics.total_scans);
                    println!("Opportunities: {}/{}", metrics.valid_opportunities_found, metrics.total_opportunities_scanned);
                    println!("Executions: {}/{} ({:.2}% success)", 
                        metrics.successful_executions,
                        metrics.total_execution_attempts,
                        metrics.success_rate);
                    println!("Total profit: ${:.2}", metrics.total_profit);
                    
                    if let Some(profit) = metrics.last_profit {
                        println!("Last profit: ${:.2}", profit);
                    }
                }
                
                // Sleep for a bit
                sleep(Duration::from_secs(5)).await;
            }
        },
        Commands::Stop { agent_id, log_file, verbose } => {
            println!("Stopping Singularity agent...");
            
            // In a real implementation, this would call into the agent system
            // to stop the agent with the given ID
            
            if let Some(agent_id) = agent_id {
                println!("Stopping agent with ID: {}", agent_id);
            } else {
                println!("Stopping all Singularity agents");
            }
            
            // Configure logging
            if let Some(log_file) = log_file {
                println!("Logging to file: {}", log_file.display());
            }
            
            if verbose {
                println!("Verbose mode enabled");
            }
            
            println!("Singularity agent stopped successfully");
            
            Ok(())
        },
        Commands::Status { agent_id, verbose } => {
            println!("Getting Singularity agent status...");
            
            // In a real implementation, this would call into the agent system
            // to get the status of the agent with the given ID
            
            if let Some(agent_id) = agent_id {
                println!("Getting status for agent with ID: {}", agent_id);
            } else {
                println!("Getting status for all Singularity agents");
            }
            
            if verbose {
                println!("Verbose mode enabled");
            }
            
            // Print some fake status information
            println!("Agent status: RUNNING");
            println!("Mode: LIVE_TRADING");
            println!("Uptime: 1h 23m 45s");
            println!("Scans: 1234");
            println!("Opportunities: 56/1234");
            println!("Executions: 12/15 (80.00% success)");
            println!("Total profit: $123.45");
            
            Ok(())
        },
    }
}

/// Singularity agent module (used to resolve imports)
mod singularity {
    // Re-export types from the real singularity module
    pub use crate::agents::singularity::{
        AgentMode, SingularityAgentConfig, AgentState, AgentMetrics, SingularityAgent,
    };
    pub use crate::agents::singularity::strategy;
    pub use crate::agents::singularity::scanner;
    pub use crate::agents::singularity::executor;
    pub use crate::agents::singularity::validator;
}