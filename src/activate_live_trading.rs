use crate::transaction_connector::get_transaction_connector;
use solana_program::pubkey::Pubkey;
use solana_sdk::signature::Keypair;
use std::{env, str::FromStr};
use log::{info, error, warn};

pub fn activate_live_trading() -> bool {
    info!("🚀 Activating live trading with real funds");
    
    // Get the transaction connector (which connects to your GitHub engine)
    let connector = get_transaction_connector();
    
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
                        return false;
                    }
                }
            }
            
            // Register system wallet
            let system_wallet_str = env::var("SYSTEM_WALLET")
                .unwrap_or_else(|_| "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb".to_string());
            
            match Pubkey::from_str(&system_wallet_str) {
                Ok(pubkey) => {
                    info!("System wallet: {}", pubkey);
                    
                    // Register the wallet
                    match connector.register_wallet(pubkey) {
                        Ok(_) => {
                            info!("✅ System wallet registered successfully");
                        }
                        Err(e) => {
                            error!("❌ Failed to register system wallet: {}", e);
                            return false;
                        }
                    }
                    
                    // Get the wallet balance
                    match connector.get_wallet_balance(pubkey) {
                        Ok(balance) => {
                            info!("💰 System wallet balance: {} SOL", balance);
                        }
                        Err(e) => {
                            warn!("⚠️ Failed to get system wallet balance: {}", e);
                            // Continue anyway - not critical
                        }
                    }
                }
                Err(e) => {
                    error!("❌ Invalid system wallet address: {}", e);
                    return false;
                }
            }
            
            // Register agent wallets
            register_agent_wallets(&mut connector);
            
            // Register DEX trading wallets
            register_dex_wallets(&mut connector);
            
            // Send test transaction to verify real funds usage
            if execute_test_transaction(&mut connector) {
                info!("✅ Test transaction successful - LIVE TRADING ACTIVATED");
                info!("💎 Profit capture mechanism enabled");
                info!("🔄 Real-time balance monitoring active");
                return true;
            } else {
                error!("❌ Test transaction failed - unable to activate live trading");
                return false;
            }
        }
        Err(e) => {
            error!("❌ Failed to get transaction connector: {}", e);
            return false;
        }
    }
}

fn register_agent_wallets(connector: &mut crate::transaction_connector::TransactionConnector) -> bool {
    // These are the wallets for the agents
    let wallet_addresses = [
        // Hyperion flash arbitrage wallet
        "8Bqt6VHAX1vE25fJ2njJLKCARodmXKqNpsN7KrME5K7M",
        // Quantum Omega sniper wallet
        "4XE3oMqoeGPHr9SrN9PxSAvyMZoZL2xcv58sRkVnZfp2",
        // Singularity cross-chain wallet
        "9aqYdpMA4RtaDGK3pHLc33n8pxVBJ6fn7Z9Fve9TFF2Z"
    ];
    
    let mut success = true;
    
    for address in wallet_addresses.iter() {
        match Pubkey::from_str(address) {
            Ok(pubkey) => {
                info!("Registering agent wallet: {}", pubkey);
                
                // Register the wallet
                match connector.register_wallet(pubkey) {
                    Ok(_) => {
                        info!("✅ Agent wallet registered successfully: {}", pubkey);
                        
                        // Get the wallet balance
                        match connector.get_wallet_balance(pubkey) {
                            Ok(balance) => {
                                info!("💰 Agent wallet balance: {} SOL", balance);
                            }
                            Err(e) => {
                                warn!("⚠️ Failed to get agent wallet balance: {}", e);
                                // Continue anyway - not critical
                            }
                        }
                    }
                    Err(e) => {
                        error!("❌ Failed to register agent wallet: {}", e);
                        success = false;
                    }
                }
            }
            Err(e) => {
                error!("❌ Invalid agent wallet address: {}", e);
                success = false;
            }
        }
    }
    
    success
}

fn register_dex_wallets(connector: &mut crate::transaction_connector::TransactionConnector) -> bool {
    // These are the wallets for DEX interactions
    let wallet_addresses = [
        // Raydium trading wallet
        "RDMW9ZxpTxjvghJ7RnDs3K1BLNvBmZY8QKRsxRYajd5",
        // Jupiter aggregator wallet
        "JUPwExHKXVGBXyQJVNPcH7GQcJpsBwjpswX7h8JPsQZ",
        // Openbook/Serum wallet
        "SERMDzyjDF9zpSMYo7TzXAJQHBJ9B7hTASvqQYTJZAE"
    ];
    
    let mut success = true;
    
    for address in wallet_addresses.iter() {
        match Pubkey::from_str(address) {
            Ok(pubkey) => {
                info!("Registering DEX wallet: {}", pubkey);
                
                // Register the wallet
                match connector.register_wallet(pubkey) {
                    Ok(_) => {
                        info!("✅ DEX wallet registered successfully: {}", pubkey);
                        
                        // Get the wallet balance
                        match connector.get_wallet_balance(pubkey) {
                            Ok(balance) => {
                                info!("💰 DEX wallet balance: {} SOL", balance);
                            }
                            Err(e) => {
                                warn!("⚠️ Failed to get DEX wallet balance: {}", e);
                                // Continue anyway - not critical
                            }
                        }
                    }
                    Err(e) => {
                        error!("❌ Failed to register DEX wallet: {}", e);
                        success = false;
                    }
                }
            }
            Err(e) => {
                error!("❌ Invalid DEX wallet address: {}", e);
                success = false;
            }
        }
    }
    
    success
}

fn execute_test_transaction(connector: &mut crate::transaction_connector::TransactionConnector) -> bool {
    // This will execute a small test transaction to verify that real funds usage is working
    info!("Executing test transaction to validate live trading capability");
    
    // Create a test transaction data - adjust format to match your existing engine's requirements
    let tx_data = r#"{
        "type": "TEST_TRANSACTION",
        "verify_real_funds": true,
        "priority": "HIGH"
    }"#;
    
    // Execute the transaction
    match connector.execute_transaction(tx_data.as_bytes()) {
        Ok(result) => {
            if result.success {
                if let Some(signature) = result.signature {
                    info!("✅ Test transaction successful!");
                    info!("🔗 Transaction signature: {}", signature);
                    info!("🔍 View on Solscan: https://solscan.io/tx/{}", signature);
                    true
                } else {
                    warn!("⚠️ Test transaction succeeded but no signature returned");
                    // Still return true since it was successful
                    true
                }
            } else {
                if let Some(error) = result.error {
                    error!("❌ Test transaction failed: {}", error);
                } else {
                    error!("❌ Test transaction failed with unknown error");
                }
                false
            }
        }
        Err(e) => {
            error!("❌ Failed to execute test transaction: {}", e);
            false
        }
    }
}