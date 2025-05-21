#!/bin/bash
# Restart with Instant Nodes Disabled

echo "========================================"
echo "   RESTARTING WITHOUT INSTANT NODES     "
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
export USE_ALCHEMY=true
export USE_HELIUS=true
export USE_INSTANT_NODES=false
export PRIMARY_PROVIDER=syndica
export SECONDARY_PROVIDER=alchemy
export TERTIARY_PROVIDER=helius
export DISABLE_INSTANT_NODES=true
export SYSTEM_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export TRADING_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK

# Start system without Instant Nodes
echo "Starting system without Instant Nodes..."
npx tsx start-with-wallet-fix.ts

echo "System restarted without Instant Nodes"
echo "========================================"
