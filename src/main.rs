// Hyperion Flash Arbitrage Overlord - Rust Transaction Engine
// Core entry point for the Rust-based transaction execution system

mod transaction_engine;

use std::env;
use std::process;
use transaction_engine::{
    initialize_transaction_engine, 
    register_wallet, 
    execute_transaction,
    PriorityLevel,
    TransactionParams
};

fn main() {
    println!("🚀 Starting Hyperion Flash Arbitrage Overlord transaction engine...");
    
    // Get RPC URL from environment variables or use default
    let rpc_url = env::var("INSTANT_NODES_RPC_URL")
        .or_else(|_| env::var("SOLANA_RPC_API_KEY"))
        .unwrap_or_else(|_| {
            println!("⚠️ Warning: No RPC URL provided, using default Solana public RPC");
            "https://api.mainnet-beta.solana.com".to_string()
        });
    
    println!("Initializing transaction engine with RPC URL: {}", 
             rpc_url.replace("/v2/", "/v2/***"));
    
    // Initialize the transaction engine
    if !initialize_transaction_engine(&rpc_url) {
        eprintln!("❌ Error: Failed to initialize transaction engine");
        process::exit(1);
    }
    
    println!("✅ Transaction engine initialized successfully");
    
    // Register system wallet
    let system_wallet = env::var("SYSTEM_WALLET")
        .unwrap_or_else(|_| "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb".to_string());
    
    println!("Registering system wallet: {}", system_wallet);
    
    if !register_wallet(&system_wallet) {
        eprintln!("❌ Error: Failed to register system wallet");
        process::exit(1);
    }
    
    println!("✅ System wallet registered successfully");
    
    // Register agent wallets
    let agent_wallets = [
        "8Bqt6VHAX1vE25fJ2njJLKCARodmXKqNpsN7KrME5K7M", // Hyperion
        "4XE3oMqoeGPHr9SrN9PxSAvyMZoZL2xcv58sRkVnZfp2", // Quantum Omega
        "9aqYdpMA4RtaDGK3pHLc33n8pxVBJ6fn7Z9Fve9TFF2Z", // Singularity
    ];
    
    for wallet in &agent_wallets {
        println!("Registering agent wallet: {}", wallet);
        if !register_wallet(wallet) {
            eprintln!("⚠️ Warning: Failed to register agent wallet: {}", wallet);
        } else {
            println!("✅ Agent wallet registered: {}", wallet);
        }
    }
    
    // Execute a test transaction to verify engine functionality
    println!("Executing test transaction...");
    
    let test_params = TransactionParams {
        transaction_type: "TEST".to_string(),
        wallet_address: system_wallet.clone(),
        amount: Some(0.001),
        token: Some("SOL".to_string()),
        priority: PriorityLevel::Low,
        memo: Some("Test transaction for engine verification".to_string()),
        verify_real_funds: true,
    };
    
    match execute_transaction(test_params) {
        Ok(result) => {
            println!("✅ Test transaction executed successfully:");
            println!("  Transaction ID: {}", result.id);
            println!("  Signature: {}", result.signature.unwrap_or_else(|| "None".to_string()));
            println!("  Fee: {} SOL", result.fee.unwrap_or(0.0));
            println!("  Compute Units: {}", result.compute_units.unwrap_or(0));
        },
        Err(error) => {
            eprintln!("❌ Error executing test transaction: {}", error);
            process::exit(1);
        }
    }
    
    println!("🎉 HYPERION FLASH ARBITRAGE OVERLORD transaction engine is now LIVE");
    println!("💻 Actively monitoring for arbitrage opportunities");
    println!("💰 Ready to execute profitable trades on the blockchain");
    println!("🔄 Configure agents via the API for automated trading");
}