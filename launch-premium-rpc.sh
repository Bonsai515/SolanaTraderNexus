#!/bin/bash
# Launch with Premium RPC Optimization

echo "========================================"
echo "  LAUNCHING WITH PREMIUM RPC (SYNDICA)  "
echo "========================================"

# Stop running processes
echo "Stopping current processes..."
pkill -f "ts-node" || true
pkill -f "npx tsx" || true
pkill -f "activate-" || true
sleep 2

# Set environment variables
export RPC_URL=https://solana-api.syndica.io/rpc
export SOLANA_RPC=https://solana-api.syndica.io/rpc
export WEBSOCKET_URL=wss://solana-api.syndica.io/rpc
export USE_SYNDICA=true
export USE_ALCHEMY=false
export USE_HELIUS=false
export USE_INSTANT_NODES=false
export PRIMARY_PROVIDER=syndica
export DISABLE_MULTI_PROVIDER=true
export USE_PREMIUM_ONLY=true
export MAX_RPC_REQUESTS_PER_SECOND=2
export USE_EXTREME_CACHING=true
export DISABLE_BACKGROUND_TASKS=true
export REDUCE_POLLING_FREQUENCY=true
export SYSTEM_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export TRADING_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export MAIN_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export WALLET_ADDRESS=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK

# Launch trading system
echo "Launching trading system with premium RPC optimization..."
npx tsx activate-live-trading.ts

echo "System launched with premium RPC optimization"
echo "========================================"
