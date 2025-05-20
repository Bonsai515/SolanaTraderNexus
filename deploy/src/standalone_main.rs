// Standalone entry point for Solana Trading Platform
// This file is used as the main entry point when deploying without Node.js

use solana_quantum_trading::simple_server::start_server;

fn main() {
    println!("🚀 Starting Solana Quantum Trading Platform (Standalone Mode)");
    println!("🌟 This server provides a simplified interface to the platform");
    
    // Start the HTTP server
    start_server();
}