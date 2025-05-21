#!/bin/bash
# Force Syndica RPC Launcher

echo "========================================"
echo "    LAUNCHING WITH SYNDICA ONLY MODE    "
echo "========================================"

# Stop any running processes
pkill -f "ts-node" || true
pkill -f "tsx" || true
pkill -f "npx tsx" || true
pkill -f "activate-" || true
sleep 2

# Set all necessary environment variables
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
export SYNDICA_CONFIG_PATH="./config/syndica-only.json"
export USE_REAL_FUNDS=true

# Launch trading with Syndica only
echo "Launching trading system with Syndica only..."
npx tsx activate-live-trading.ts

echo "System launched with Syndica only"
echo "========================================"
