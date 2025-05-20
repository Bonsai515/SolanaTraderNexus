#!/bin/bash
# Restart trading system with multi-provider RPC configuration

echo "========================================"
echo "    RESTARTING TRADING SYSTEM          "
echo "    WITH MULTI-PROVIDER RPC            "
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
mkdir -p data/rpc_cache
find ./data/rpc_cache -name "*.json" -mmin +60 -delete 2>/dev/null || true

# Export environment variables
export USE_MULTI_PROVIDER=true
export USE_RPC_CACHING=true
export PRIMARY_RPC="https://mainnet.helius-rpc.com/?api-key=5d0d1d98-4695-4a7d-b8a0-d4f9836da17f"

# Start system
echo "Starting trading system with multi-provider RPC..."
./launch-enhanced-system.sh &

echo "System restarted with multi-provider RPC configuration"
echo "========================================"
