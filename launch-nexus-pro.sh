#!/bin/bash
# Launch Nexus Pro Engine

echo "========================================"
echo "    LAUNCHING NEXUS PRO ENGINE         "
echo "========================================"

# Stop running processes
echo "Stopping current processes..."
pkill -f "ts-node" || true
pkill -f "npx tsx" || true
pkill -f "activate-" || true
sleep 2

# Set environment variables
export SYSTEM_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export TRADING_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export MAIN_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export WALLET_ADDRESS=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export RPC_URL=https://solana-api.syndica.io/rpc
export SOLANA_RPC=https://solana-api.syndica.io/rpc
export WEBSOCKET_URL=wss://solana-api.syndica.io/rpc
export USE_SYNDICA=true
export USE_INSTANT_NODES=false
export PRIMARY_PROVIDER=syndica
export DISABLE_INSTANT_NODES=true
export USE_REAL_FUNDS=true
export USE_WALLET_OVERRIDE=true
export RATE_LIMIT_FIX=true
export USE_AGGRESSIVE_CACHING=true
export USE_NEXUS_PRO=true
export NEXUS_CONFIG_PATH=config/nexus/nexus-pro-config.json

# Launch Nexus Pro Engine
echo "Launching Nexus Pro Engine with HP wallet and Syndica RPC..."
npx tsx activate-live-trading.ts

echo "Nexus Pro Engine launched"
echo "========================================"
