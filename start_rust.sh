#!/bin/bash

# Start the Solana Trading Platform with the Rust simple server
echo "Starting Solana Quantum Trading Platform with Rust server..."

# Build the simple server binary
echo "Building Rust server..."
cargo build --bin simple_main

# Check if build was successful
if [ $? -ne 0 ]; then
    echo "Failed to build Rust server!"
    exit 1
fi

# Start the Rust server
echo "Starting Rust server..."
./target/debug/simple_main