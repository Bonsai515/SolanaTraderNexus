#!/bin/bash
# Start Aggressive Trading with Phantom Wallet and Nexus Pro Engine

echo "===== STARTING AGGRESSIVE TRADING SYSTEM ====="
echo "⚠️ AGGRESSIVE MODE ENABLED ⚠️"
echo "Wallet: 2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH"
echo "Connecting to Solana blockchain with priority fees..."

# Ensure Nexus Engine is ready
mkdir -p ./nexus_engine/logs

# Start the Nexus Pro Engine in aggressive mode
echo "Starting Nexus Pro Engine in AGGRESSIVE mode..."
npx ts-node ./nexus_engine/start.ts --wallet=2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH --config=./nexus_engine/config --mode=aggressive &

# Start the trade monitor
echo "Starting trade monitor..."
npx ts-node ./trade-monitor-simple.ts --wallet=2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH &

echo "===== AGGRESSIVE TRADING SYSTEM STARTED ====="
echo "⚠️ WARNING: Aggressive mode uses higher position sizes and increased risk parameters"
echo "Use Ctrl+C to stop the trading system"
echo "Logs are available in nexus_engine/logs"

# Keep the script running
wait
