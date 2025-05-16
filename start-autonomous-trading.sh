#!/bin/bash

# Autonomous Trading System Startup Script

echo "==============================================="
echo "🚀 STARTING AUTONOMOUS TRADING SYSTEM"
echo "==============================================="
echo ""

# Load real trading environment variables
echo "Loading real trading environment..."
source .env.real-trading

# Verify system configuration
echo "Verifying system configuration..."
if [ -f "./server/config/autonomous.json" ] && [ -f "./server/config/safety.json" ] && [ -f "./server/config/rpc.json" ]; then
  echo "✅ System configuration verified"
else
  echo "❌ System configuration missing"
  echo "Run 'npx tsx finalize-autonomous-system.ts' first"
  exit 1
fi

# Check for wallet
echo "Checking for wallet..."
if [ -n "$MAIN_WALLET_ADDRESS" ]; then
  echo "✅ Wallet address: $MAIN_WALLET_ADDRESS"
else
  echo "❌ Wallet address not set"
  exit 1
fi

# Run system with real trading
echo "Starting autonomous trading system with real funds..."
echo ""
echo "IMPORTANT: This will execute REAL BLOCKCHAIN TRANSACTIONS"
echo "using your wallet with REAL FUNDS"
echo ""

# Start the system
npx tsx server/index.ts

# Exit with the system's exit code
exit $?
