#!/bin/bash

# Custom build script for Rust-based Solana Trading Platform
echo "🔨 Building Rust-based Solana Trading Platform..."

# Ensure we have Rust installed
if ! command -v cargo &> /dev/null; then
    echo "❌ Cargo is not installed! Installing Rust toolchain..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
fi

# Build the standalone binary
echo "🚀 Building standalone binary..."
cargo build --bin standalone --release

# Copy the standalone binary to the root directory for easier access
echo "📦 Copying binary to root directory..."
cp target/release/standalone ./standalone

# Ensure we also have the HTML interface
echo "🌐 Setting up HTML interface..."
if [ ! -f "index.html" ]; then
    if [ -f "standalone.html" ]; then
        cp standalone.html index.html
    else
        echo "<html><body><h1>Solana Quantum Trading Platform</h1><p>Server is running, but no interface was found. API endpoints are available at /api/*</p></body></html>" > index.html
    fi
fi

echo "✅ Build complete! Run the application with ./standalone"