#!/bin/bash

# Real Blockchain Trading Launcher
# This script starts the trading system with real blockchain transaction execution

echo "=== STARTING REAL BLOCKCHAIN TRADING ==="
echo "Trading Wallet: HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK"
echo "Profit Wallet: 31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e"

# Load configurations
echo "Loading real trading configuration..."
export TRADING_MODE="REAL_BLOCKCHAIN"
export SIMULATION="false"
export TRADE_FREQUENCY="120"

# Start transaction tracker
echo "Starting transaction tracker..."
node -e "require('./server/lib/real-transaction-tracker').initialize()"

# Start Nexus Engine with real blockchain mode
echo "Starting Nexus Engine in REAL BLOCKCHAIN mode..."
node ./nexus_engine/start-nexus-engine.js --mode=REAL_BLOCKCHAIN --simulation=false

echo "Real blockchain trading is now active"
echo "Monitor your trades at REAL_PROFIT_DASHBOARD.md and REAL_BLOCKCHAIN_TRANSACTIONS.md"
