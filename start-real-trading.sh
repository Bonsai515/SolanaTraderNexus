#!/bin/bash

# Real Blockchain Trading Launcher
# This script starts all components needed for real blockchain trading

echo "=== STARTING REAL BLOCKCHAIN TRADING ==="
echo "Trading Wallet: HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK"
echo "Profit Wallet: 31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e"

# Force trading on
echo "Setting trading mode to REAL_BLOCKCHAIN..."
export TRADING_MODE="REAL_BLOCKCHAIN"
export SIMULATION="false"
export FORCE_TRADING="true"

# Start profit tracker
echo "Starting profit tracker..."
npx ts-node ./nexus_engine/profit-tracker.ts

# Start transaction executor
echo "Starting transaction executor..."
npx ts-node ./nexus_engine/transaction-executor.ts

# Start Nexus Engine
echo "Starting Nexus Engine in REAL_BLOCKCHAIN mode..."
node ./nexus_engine/start-nexus-engine.js --mode=REAL_BLOCKCHAIN --simulation=false

echo "Real blockchain trading is now active"
echo "Monitor your trades at REAL_PROFIT_DASHBOARD.md"
