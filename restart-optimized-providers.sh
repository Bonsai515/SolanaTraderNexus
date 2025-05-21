#!/bin/bash
# Restart with Optimized Provider Order

echo "========================================"
echo "   RESTARTING WITH OPTIMIZED PROVIDERS  "
echo "========================================"

# Stop running processes
echo "Stopping current processes..."
pkill -f "ts-node" || true
pkill -f "npx tsx" || true
pkill -f "activate-" || true
sleep 2

# Export environment variables
export RPC_URL=https://solana-api.syndica.io/rpc
export SOLANA_RPC=https://solana-api.syndica.io/rpc
export USE_SYNDICA=true
export USE_INSTANT_NODES=false
export PRIMARY_PROVIDER=syndica
export SECONDARY_PROVIDER=alchemy
export TERTIARY_PROVIDER=helius
export SYSTEM_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export TRADING_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK

# Start system with optimized providers
echo "Starting system with optimized provider order..."
npx tsx activate-live-trading.ts

echo "System restarted with optimized provider order"
echo "========================================"
