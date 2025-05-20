#!/bin/bash
# Restart trading system with Syndica RPC

echo "========================================"
echo "    RESTARTING TRADING SYSTEM          "
echo "       WITH SYNDICA RPC                "
echo "========================================"
echo

# Stop running processes
echo "Stopping current trading system..."
pkill -f "ts-node" || true
pkill -f "npx tsx" || true
pkill -f "strategy.ts" || true
sleep 2

# Clean RPC cache
echo "Clearing old RPC cache..."
find ./data/rpc_cache -name "*.json" -mmin +60 -delete 2>/dev/null || true

# Export Syndica as RPC_URL
export RPC_URL="https://solana-api.syndica.io/rpc"

# Start with Syndica configuration
echo "Starting trading system with Syndica RPC..."
./launch-enhanced-system.sh &

echo "System restarted with Syndica as primary RPC"
echo "========================================"
