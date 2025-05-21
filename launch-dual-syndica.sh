#!/bin/bash
# Dual Premium Syndica Launcher

echo "========================================"
echo "   LAUNCHING WITH DUAL PREMIUM SYNDICA  "
echo "========================================"

# Stop any running processes
pkill -f "ts-node" || true
pkill -f "tsx" || true
pkill -f "npx tsx" || true
pkill -f "activate-" || true
pkill -f "node" || true
sleep 2

# Set environment variables for dual Syndica
export SYSTEM_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export TRADING_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export MAIN_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export WALLET_ADDRESS=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export PRIMARY_RPC_URL=https://solana-api.syndica.io/api-key/q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk/rpc
export SECONDARY_RPC_URL=https://solana-api.syndica.io/api-key/pCvktxK4Qc2JhNhVme1gpW9yZYxpVi53tQqroouPqJLtssQV28hVkaDk5zjL7W9SY7GPic9AqTXhRBMvdVemjd3vRHs1ypfPci/rpc
export PRIMARY_WS_URL=wss://chainstream.api.syndica.io/api-key/q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk
export SECONDARY_WS_URL=wss://chainstream.api.syndica.io/api-key/pCvktxK4Qc2JhNhVme1gpW9yZYxpVi53tQqroouPqJLtssQV28hVkaDk5zjL7W9SY7GPic9AqTXhRBMvdVemjd3vRHs1ypfPci
export PRIMARY_API_KEY=q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk
export SECONDARY_API_KEY=pCvktxK4Qc2JhNhVme1gpW9yZYxpVi53tQqroouPqJLtssQV28hVkaDk5zjL7W9SY7GPic9AqTXhRBMvdVemjd3vRHs1ypfPci
export RPC_URL=https://solana-api.syndica.io/api-key/q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk/rpc
export SOLANA_RPC=https://solana-api.syndica.io/api-key/q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk/rpc
export WEBSOCKET_URL=wss://chainstream.api.syndica.io/api-key/q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk
export USE_SYNDICA=true
export USE_DUAL_SYNDICA=true
export USE_ALCHEMY=false
export USE_HELIUS=false
export USE_INSTANT_NODES=false
export PRIMARY_PROVIDER=syndica
export DISABLE_MULTI_PROVIDER=true
export DUAL_CONFIG_PATH=./config/dual-syndica.json
export DUAL_CONN_MODULE=./src/dual-syndica.ts
export USE_REAL_FUNDS=true
export USE_WALLET_OVERRIDE=true
export USE_PREMIUM_ENDPOINTS=true

# Launch with dual premium Syndica
echo "Launching system with dual premium Syndica..."
npx tsx activate-live-trading.ts

echo "System launched with dual premium Syndica"
echo "========================================"
