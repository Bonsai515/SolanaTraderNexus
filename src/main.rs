use solana_program::pubkey::Pubkey;
use solana_sdk::signature::Keypair;
use std::{env, str::FromStr, thread, time::Duration};
use workspace::SolanaEngine;

fn main() {
    println!("Solana Direct Transaction Engine");
    println!("================================");
    
    // Initialize the Solana engine
    let engine = SolanaEngine::new();
    
    // System wallet for profit collection
    let system_wallet_str = env::var("SYSTEM_WALLET")
        .unwrap_or_else(|_| "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb".to_string());
    
    // Parse the system wallet address
    match Pubkey::from_str(&system_wallet_str) {
        Ok(wallet) => {
            println!("Using system wallet: {}", wallet);
            
            // Register the wallet for monitoring
            engine.register_wallet(wallet);
            
            // Get the wallet balance
            match engine.get_wallet_balance(&wallet) {
                Ok(balance) => {
                    println!("System wallet balance: {} SOL", balance);
                }
                Err(e) => {
                    println!("Failed to get system wallet balance: {}", e);
                }
            }
            
            // Start the trading engine
            println!("Transaction engine started and directly connected to Solana blockchain!");
            println!("Monitoring wallet for balance changes...");
            
            // Keep the program running and monitoring the wallet
            let mut last_check = std::time::Instant::now();
            
            loop {
                // Check wallet balance periodically
                if last_check.elapsed().as_secs() >= 30 {
                    match engine.get_wallet_balance(&wallet) {
                        Ok(balance) => {
                            println!("[{}] System wallet balance: {} SOL", 
                                     chrono::Local::now().format("%Y-%m-%d %H:%M:%S"),
                                     balance);
                            
                            // Get transaction stats
                            let (successful, failed) = engine.get_stats();
                            println!("Transaction stats: {} successful, {} failed", successful, failed);
                        }
                        Err(e) => {
                            println!("Failed to get wallet balance: {}", e);
                        }
                    }
                    
                    last_check = std::time::Instant::now();
                }
                
                // Sleep to avoid high CPU usage
                thread::sleep(Duration::from_secs(1));
            }
        }
        Err(e) => {
            println!("Invalid system wallet address: {}", e);
        }
    }
}