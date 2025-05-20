#!/bin/bash
# Restart with Updated Trading Wallet

echo "========================================"
echo "    RESTARTING WITH UPDATED WALLET     "
echo "========================================"

# Stop running processes
echo "Stopping current processes..."
pkill -f "ts-node" || true
pkill -f "npx tsx" || true
pkill -f "activate-" || true
sleep 2

# Export environment variables
export SYSTEM_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export TRADING_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export MAIN_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export RATE_LIMIT_FIX=true
export USE_INSTANT_NODES=false
export MAX_REQUESTS_PER_SECOND=10
export USE_AGGRESSIVE_CACHING=true

# Start system
echo "Starting system with updated trading wallet..."
npx tsx activate-live-trading.ts

echo "System restarted with trading wallet: HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK"
echo "========================================"
