#!/bin/bash
# Start trading with HP wallet override

echo "========================================"
echo "    STARTING WITH HP WALLET OVERRIDE    "
echo "========================================"

# Stop running processes
pkill -f "ts-node" || true
pkill -f "npx tsx" || true
pkill -f "activate-" || true
sleep 2

# Export environment variables directly
export SYSTEM_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export TRADING_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export MAIN_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export WALLET_ADDRESS=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export USE_HELIUS=true
export USE_INSTANT_NODES=false
export RATE_LIMIT_FIX=true
export MAX_REQUESTS_PER_SECOND=10
export USE_AGGRESSIVE_CACHING=true

# Run directly with HP wallet
echo "Starting trading system with HP wallet (HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK)..."
npx tsx activate-live-trading.ts

echo "System started with HP wallet"
echo "========================================"
