#!/bin/bash
# Direct Syndica Launch Script

# Kill any running processes
pkill -f "ts-node" || true
pkill -f "tsx" || true
pkill -f "activate-" || true
pkill -f "node" || true
pkill -f "npm" || true
sleep 2

echo "====================================="
echo "   LAUNCHING WITH DIRECT SYNDICA     "
echo "====================================="

# Set environment variables
export SYSTEM_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export TRADING_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export MAIN_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export WALLET_ADDRESS=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export RPC_URL=https://solana-api.syndica.io/api-key/q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk/rpc
export SOLANA_RPC=https://solana-api.syndica.io/api-key/q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk/rpc
export WEBSOCKET_URL=wss://chainstream.api.syndica.io/api-key/q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk
export SYNDICA_API_KEY=q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk
export USE_SYNDICA=true
export USE_ALCHEMY=false
export USE_HELIUS=false
export USE_INSTANT_NODES=false
export PRIMARY_PROVIDER=syndica
export USE_REAL_FUNDS=true
export DISABLE_INSTANT_NODES=true
export USE_DIRECT_SYNDICA=true
export SYNDICA_DIRECT_RPC=https://solana-api.syndica.io/api-key/q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk/rpc
export SYNDICA_DIRECT_WS=wss://chainstream.api.syndica.io/api-key/q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk

# Start with premium Syndica
echo "Launching system with direct Syndica connection..."
npx tsx activate-live-trading.ts

echo "System launched"
echo "====================================="
