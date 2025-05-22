#!/bin/bash
# Start Maximum Frequency Trading with Phantom Wallet and Nexus Pro Engine

echo "===== STARTING MAXIMUM FREQUENCY TRADING SYSTEM ====="
echo "⚠️ ⚠️ MAXIMUM FREQUENCY MODE ENABLED ⚠️ ⚠️"
echo "Wallet: 2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH"
echo "Connecting to Solana blockchain with 4x priority fees..."

# Ensure Nexus Engine is ready
mkdir -p ./nexus_engine/logs

# Kill any existing processes
pkill -f "npx ts-node ./nexus_engine/start.ts" || true
pkill -f "npx ts-node ./trade-monitor-simple.ts" || true

# Start the Nexus Pro Engine in ultra mode
echo "Starting Nexus Pro Engine in MAXIMUM FREQUENCY mode..."
npx ts-node ./nexus_engine/start.ts --wallet=2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH --config=./nexus_engine/config --mode=ultra &

# Start the trade monitor
echo "Starting trade monitor..."
npx ts-node ./trade-monitor-simple.ts --wallet=2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH &

# Start auto trade updates for real-time notifications
echo "Starting real-time trade notifications..."
npx ts-node ./auto-trade-updates.ts &

echo "===== MAXIMUM FREQUENCY TRADING SYSTEM STARTED ====="
echo "⚠️ ⚠️ WARNING: Maximum frequency mode uses ultra-aggressive parameters ⚠️ ⚠️"
echo "Use Ctrl+C to stop the trading system"
echo "Logs are available in nexus_engine/logs"

# Keep the script running
wait
