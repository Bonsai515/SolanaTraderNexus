// Simple entry point for Solana Trading Platform
// This is used for deployment in environments that may not have
// all dependencies required for the full system

use solana_quantum_trading::simple_server;

fn main() {
    println!("Starting Solana Trading Platform (Simplified Server)");
    
    // Start the simple HTTP server
    simple_server::start_server();
}