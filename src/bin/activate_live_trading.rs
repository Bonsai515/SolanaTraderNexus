use std::env;
use log::{info, error, LevelFilter};
use env_logger::Builder;
use chrono::Local;
use std::io::Write;

// Import from your crate
extern crate solana_quantum_trading as workspace;
use workspace::transaction_connector::get_transaction_connector;

fn main() {
    // Configure logging with timestamps
    Builder::new()
        .format(|buf, record| {
            writeln!(
                buf,
                "{} [{}] - {}",
                Local::now().format("%Y-%m-%d %H:%M:%S"),
                record.level(),
                record.args()
            )
        })
        .filter(None, LevelFilter::Info)
        .init();
    
    info!("===== ACTIVATING LIVE TRADING WITH REAL FUNDS =====");
    
    // Check for RPC API keys
    check_environment_variables();
    
    // Get the transaction connector (which connects to your GitHub engine)
    let connector = get_transaction_connector();
    
    info!("🔄 Connecting to transaction engine...");
    
    match connector.lock() {
        Ok(mut connector) => {
            // Make sure the transaction engine is initialized
            if !connector.initialized {
                match connector.initialize() {
                    Ok(_) => {
                        info!("✅ Transaction engine initialized successfully");
                    }
                    Err(e) => {
                        error!("❌ Failed to initialize transaction engine: {}", e);
                        std::process::exit(1);
                    }
                }
            }
            
            info!("💻 Transaction engine connected successfully");
            
            // Get statistics
            let (successful, failed) = connector.get_stats();
            info!("📊 Transaction stats: {} successful, {} failed", successful, failed);
            
            // Get system wallet balance if available
            let system_wallet_str = env::var("SYSTEM_WALLET")
                .unwrap_or_else(|_| "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb".to_string());
            
            info!("🔑 System wallet: {}", system_wallet_str);
            
            match solana_program::pubkey::Pubkey::from_str(&system_wallet_str) {
                Ok(pubkey) => {
                    match connector.get_wallet_balance(pubkey) {
                        Ok(balance) => {
                            info!("💰 System wallet balance: {} SOL", balance);
                        }
                        Err(e) => {
                            info!("⚠️ Failed to get system wallet balance: {}", e);
                        }
                    }
                }
                Err(e) => {
                    error!("❌ Invalid system wallet address: {}", e);
                }
            }
            
            // Execute a test transaction
            let test_data = r#"{
                "type": "LIVE_TRADING_ACTIVATION",
                "verify_real_funds": true,
                "priority": "HIGH"
            }"#;
            
            info!("🧪 Executing test transaction to verify live trading capability...");
            
            match connector.execute_transaction(test_data.as_bytes()) {
                Ok(result) => {
                    if result.success {
                        if let Some(signature) = result.signature {
                            info!("✅ Live trading verification transaction successful!");
                            info!("🔗 Transaction signature: {}", signature);
                            info!("🔍 View on Solscan: https://solscan.io/tx/{}", signature);
                        } else {
                            info!("✅ Live trading verification successful (no signature)");
                        }
                        
                        info!("");
                        info!("🎉 LIVE TRADING WITH REAL FUNDS IS NOW ACTIVE 🎉");
                        info!("📈 All agents are now trading with real funds");
                        info!("💎 Profit capture to the system wallet is enabled");
                        info!("");
                        info!("🤖 ACTIVE AGENTS:");
                        info!("  - Hyperion Flash Arbitrage Overlord (Flash Arb Strategy)");
                        info!("  - Quantum Omega Sniper (MemeCorTeX Integration)");
                        info!("  - Singularity Cross-Chain Oracle (Wormhole Integration)");
                        info!("");
                        info!("⚡ TRANSFORMERS CONNECTED:");
                        info!("  - MicroQHC (Quantum-Inspired Pattern Recognition)");
                        info!("  - MEME Cortex (Social Sentiment Analysis)");
                        info!("");
                        info!("System is now live and executing trades on mainnet with real funds!");
                    } else {
                        if let Some(error) = result.error {
                            error!("❌ Live trading verification failed: {}", error);
                        } else {
                            error!("❌ Live trading verification failed with unknown error");
                        }
                        std::process::exit(1);
                    }
                }
                Err(e) => {
                    error!("❌ Failed to execute live trading verification: {}", e);
                    std::process::exit(1);
                }
            }
        }
        Err(e) => {
            error!("❌ Failed to get transaction connector: {}", e);
            std::process::exit(1);
        }
    }
}

fn check_environment_variables() {
    // Check for InstantNodes RPC URL
    if let Ok(url) = env::var("INSTANT_NODES_RPC_URL") {
        info!("✅ InstantNodes RPC URL is set: {}", url);
    } else {
        info!("⚠️ InstantNodes RPC URL is not set, will use fallback");
    }
    
    // Check for Solana RPC API key
    if let Ok(_) = env::var("SOLANA_RPC_API_KEY") {
        info!("✅ Solana RPC API key is set");
    } else {
        info!("⚠️ Solana RPC API key is not set, will use fallback");
    }
    
    // Check for system wallet
    if let Ok(wallet) = env::var("SYSTEM_WALLET") {
        info!("✅ System wallet is set: {}", wallet);
    } else {
        info!("⚠️ System wallet is not set, will use default: HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb");
    }
    
    // Check for Wormhole API key
    if let Ok(_) = env::var("WORMHOLE_API_KEY") {
        info!("✅ Wormhole API key is set");
    } else {
        info!("⚠️ Wormhole API key is not set, will use Guardian RPCs");
    }
}

use std::str::FromStr;