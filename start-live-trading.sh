#!/bin/bash

# Start Live Trading with Real Funds (TypeScript version)
# This script runs the TypeScript activation script with proper error handling

echo "====================================================="
echo "🚀 ACTIVATING LIVE TRADING WITH REAL FUNDS (TS Version)"
echo "====================================================="

# Check if the TypeScript file exists
if [ ! -f "./start-live-trading.ts" ]; then
  echo "❌ Error: start-live-trading.ts not found"
  exit 1
fi

# Run the TypeScript script
echo "Starting live trading with TypeScript version..."
npx tsx start-live-trading.ts

# Check exit code
if [ $? -eq 0 ]; then
  echo "✅ Live trading activated successfully"
  exit 0
else
  echo "❌ Live trading activation failed"
  exit 1
fi