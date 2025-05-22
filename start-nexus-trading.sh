#!/bin/bash

# Nexus Trading Launcher
# This script starts the Nexus trading engine with real blockchain transactions

echo "=== STARTING NEXUS TRADING ENGINE ==="
echo "Mode: REAL_BLOCKCHAIN"
echo "Simulation: DISABLED"
echo "Trading Wallet: HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK"
echo "Profit Wallet: 31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e"

# Load configurations
echo "Loading strategy configurations..."
export TRADING_MODE="REAL_BLOCKCHAIN"
export SIMULATION="false"
export TRADE_FREQUENCY="120"

# Start Nexus Engine
echo "Starting Nexus Engine..."
node ./nexus_engine/start-nexus-engine.js --mode=REAL_BLOCKCHAIN --simulation=false

echo "Nexus Engine started successfully"
echo "Monitor your trades in the trading dashboard"
