#!/bin/bash

# Start Live Trading System
# This launches the system with real blockchain trading enabled

echo "=== STARTING LIVE TRADING SYSTEM ==="
echo "⚠️  WARNING: This will execute real blockchain transactions with real SOL"
echo "Your trading wallet: HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK"
echo "Available balance: ~0.8 SOL"

# Kill existing processes
pkill -f "node.*nexus" || true
sleep 2

# Set live trading environment variables
export NEXUS_LIVE_TRADING="true"
export NEXUS_SIMULATION_MODE="false"
export NEXUS_CONFIRM_TRANSACTIONS="true"
export NEXUS_USE_REAL_BLOCKCHAIN="true"
export NEXUS_TRADER_MODE="live"

# Apply live trading configurations
cp ./nexus_engine/config/live-trading/live-config.json ./nexus_engine/config/
cp ./nexus_engine/config/trading-mode.json ./nexus_engine/config/

echo "Live trading configuration applied"
echo "Risk management:"
echo "  • Max position size: 0.7 SOL (87.5% of balance)"
echo "  • Min profit threshold: 0.0001 SOL"
echo "  • Emergency stop loss: 15%"
echo "  • Daily loss limit: 0.08 SOL"

# Start the live trading system
echo "Starting live trading system..."
node --experimental-specifier-resolution=node --no-warnings ./nexus_engine/start.js --mode=live --confirm-transactions=true &

echo ""
echo "🚀 LIVE TRADING SYSTEM ACTIVATED"
echo "Your system is now executing real blockchain transactions"
echo "Monitor live trades in: ./logs/live-trades/"
echo ""
echo "⚠️  IMPORTANT: This system uses real SOL and executes real transactions"
echo "Monitor your wallet balance and trading activity closely"
