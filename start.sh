#!/bin/bash

# Start the Solana Trading System
echo "Starting Solana Trading System with Quantum-Inspired Transformers..."

# Check if Cargo is installed
if ! command -v cargo &> /dev/null; then
    echo "Cargo is not installed. Please install Rust and Cargo."
    exit 1
fi

# Build and run the project
echo "Building project..."
cargo build || { echo "Build failed"; exit 1; }

echo "Running project..."
cargo run