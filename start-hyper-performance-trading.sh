#!/bin/bash

# Hyper-Performance Trading Launch Script
# This script launches the trading system with all optimizations enabled

echo "=== LAUNCHING HYPER-PERFORMANCE TRADING SYSTEM ==="
echo "Trading wallet: HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK"
echo "Profit wallet: 31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e"

# Apply all optimizations
echo "Applying all performance optimizations..."

# Use premium RPC endpoints
cp ./config/rpc-performance.json ./config/rpc-config.json

# Use optimized execution parameters
mkdir -p ./nexus_engine/config
cp ./nexus_engine/config/optimized/* ./nexus_engine/config/

# Apply optimized token list
cp ./config/advanced-tokens.json ./nexus_engine/config/tokens.json

# Set environment variables for performance
export NODE_OPTIONS="--max-old-space-size=4096"
export NEXUS_PERFORMANCE_MODE="ultra"
export NEXUS_EXECUTION_THREADS=4
export NEXUS_CACHE_OPTIMIZATION=true
export NEXUS_PARALLEL_EXECUTION=true
export NEXUS_FAST_CONFIRMATION=true
export NEXUS_TRADER_MODE="hyper-performance"

# Start the trading system
echo "Starting hyper-performance trading system with 15 tokens and 20-second trade cycles..."
node --experimental-specifier-resolution=node --no-warnings ./nexus_engine/start.js --mode=hyper-performance --tokens=15 --cycle=20 &

echo ""
echo "✅ HYPER-PERFORMANCE TRADING SYSTEM LAUNCHED"
echo "Your trading system is now running at maximum efficiency"
echo "- Trading 15 tokens with 20-second cycles"
echo "- Using optimized transaction execution"
echo "- Neural transformers enabled for price prediction"
echo "- Premium Syndica+QuickNode RPC connection"
echo ""
echo "Monitor your profits in the dashboard: ./HYPER_AGGRESSIVE_PROFIT_DASHBOARD.md"
