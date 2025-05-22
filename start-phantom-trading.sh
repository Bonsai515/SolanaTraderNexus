#!/bin/bash
# Start Phantom Wallet Trading with Nexus Pro Engine

echo "===== STARTING PHANTOM WALLET TRADING SYSTEM ====="
echo "Wallet: 2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH"
echo "Connecting to Solana blockchain..."

# Ensure Nexus Engine is ready
mkdir -p ./nexus_engine/logs

# Start the Nexus Pro Engine
echo "Starting Nexus Pro Engine..."
node ./nexus_engine/start.js --wallet=2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH --config=./nexus_engine/config &

# Start the trade monitor
echo "Starting trade monitor..."
node ./trade-monitor-simple.js --wallet=2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH &

echo "===== TRADING SYSTEM STARTED ====="
echo "Use Ctrl+C to stop the trading system"
echo "Logs are available in nexus_engine/logs"

# Keep the script running
wait
