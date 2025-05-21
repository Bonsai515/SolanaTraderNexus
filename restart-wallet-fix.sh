#!/bin/bash
# Restart with Wallet Fix

echo "========================================"
echo "   RESTARTING WITH WALLET ACCESS FIX    "
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
export DISABLE_HX=true
export USE_WALLET_OVERRIDE=true
export RPC_URL=https://solana-api.syndica.io/rpc
export SOLANA_RPC=https://solana-api.syndica.io/rpc
export USE_SYNDICA=true
export USE_INSTANT_NODES=false
export PRIMARY_PROVIDER=syndica
export SECONDARY_PROVIDER=alchemy
export TERTIARY_PROVIDER=helius

# Start system with wallet fix
echo "Starting system with wallet access fix..."
npx tsx start-with-wallet-fix.ts

echo "System restarted with HP wallet only"
echo "========================================"
