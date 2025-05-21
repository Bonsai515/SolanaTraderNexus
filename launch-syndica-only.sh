#!/bin/bash
# Syndica-Only Mode Launcher

echo "========================================"
echo "     LAUNCHING SYNDICA-ONLY MODE        "
echo "========================================"

# Stop running processes
echo "Stopping current processes..."
pkill -f "ts-node" || true
pkill -f "tsx" || true
pkill -f "npx tsx" || true
pkill -f "activate-" || true
sleep 2

# Override environment with Syndica-only mode
echo "Setting Syndica-only environment..."
export SYSTEM_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export TRADING_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export MAIN_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export WALLET_ADDRESS=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export RPC_URL=https://solana-api.syndica.io/rpc
export SOLANA_RPC=https://solana-api.syndica.io/rpc
export WEBSOCKET_URL=wss://solana-api.syndica.io/rpc
export USE_SYNDICA=true
export USE_ALCHEMY=false
export USE_HELIUS=false
export USE_INSTANT_NODES=false
export PRIMARY_PROVIDER=syndica
export DISABLE_INSTANT_NODES=true
export DISABLE_MULTI_PROVIDER=true
export FORCE_SYNDICA_ONLY=true
export USE_REAL_FUNDS=true
export USE_WALLET_OVERRIDE=true
export RATE_LIMIT_FIX=true
export USE_AGGRESSIVE_CACHING=true
export ISOLATE_SYNDICA=true
export MAX_RPC_REQUESTS_PER_SECOND=2
export DISABLE_BACKGROUND_TASKS=true
export REDUCE_POLLING_FREQUENCY=true

# First, run the override to ensure Syndica-only mode
echo "Enabling Syndica override..."
npx tsx ./src/syndica-override.ts

# Then start the system
echo "Launching system in Syndica-only mode..."
NODE_OPTIONS="--require ./src/syndica-override.ts" npx tsx activate-live-trading.ts

echo "Syndica-only mode launched"
echo "========================================"
