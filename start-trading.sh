#!/bin/bash

# Script to start the trading system with real transactions

echo "===================================="
echo "    STARTING REAL TRADING SYSTEM    "
echo "===================================="

# Change this line if you want to use the test network instead of mainnet
export SOLANA_NETWORK="mainnet-beta"

# Check if everything is configured
if [ -f "./data/nexus_engine_config.json" ]; then
  echo "✅ Engine configuration found"
else
  echo "❌ Engine configuration not found. Running setup..."
  npx tsx enable-instant-nodes-trading.ts
fi

if [ -f "./server/transaction-queue.ts" ]; then
  echo "✅ Transaction queue module found"
else
  echo "❌ Transaction queue not found. Running setup..."
  npx tsx fix-rpc-rate-limits.ts
fi

if grep -q "privateKey" "./data/wallets.json"; then
  echo "✅ Wallet private key configured"
else
  echo "❌ Wallet private key not found. Running setup..."
  npx tsx setup-trading-wallet.ts
fi

# Start the system 
echo "Starting the trading system..."
echo "===================================="
echo "Press Ctrl+C to stop"
echo "===================================="

npx tsx server/index.ts