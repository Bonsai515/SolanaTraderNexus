#!/bin/bash
# Restart trading system with optimized Syndica RPC

echo "========================================"
echo "    RESTARTING TRADING SYSTEM          "
echo "    WITH OPTIMIZED SYNDICA RPC         "
echo "========================================"
echo

# Stop running processes
echo "Stopping current trading system..."
pkill -f "ts-node" || true
pkill -f "npx tsx" || true
pkill -f "strategy.ts" || true
sleep 2

# Clean RPC cache
echo "Clearing stale cache data..."
find ./data/rpc_cache -name "*.json" -mmin +60 -delete 2>/dev/null || true

# Export environment variables
export RPC_URL="https://solana-api.syndica.io/rpc"
export SOLANA_RPC="https://solana-api.syndica.io/rpc"
export USE_STREAMING_RPC="true"
export OPTIMIZE_RPC_USAGE="true"
export BATCH_RPC_REQUESTS="true"

# Start system
echo "Starting trading system with optimized Syndica RPC..."
./launch-enhanced-system.sh &

echo "System restarted with optimized Syndica RPC configuration"
echo "========================================"
