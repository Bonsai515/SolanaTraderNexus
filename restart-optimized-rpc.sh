#!/bin/bash
# Restart trading with optimized RPC

echo "========================================"
echo "    RESTARTING TRADING SYSTEM          "
echo "    WITH OPTIMIZED RPC SETTINGS        "
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
find ./data/rpc_cache -name "*.json" -mmin +60 -delete

# Start with optimized RPC configuration
echo "Starting trading system with optimized RPC..."
./launch-enhanced-system.sh &

echo "System restarted with optimized RPC settings"
echo "========================================"
