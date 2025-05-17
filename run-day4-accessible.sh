#!/bin/bash

# Run Day 4 Strategy with Accessible Wallet
# This script makes it easy to execute the Day 4 strategy with our accessible wallet

# Default to simulation mode if no arguments provided
MODE=${1:-simulation}
AMOUNT=${2:-1.1}

# Set Alchemy API key if available
export ALCHEMY_API_KEY="PPQbbM4WmrX_82GOP8QR5pJ_JsBvyLWR"

echo "======================================================"
echo "🚀 RUNNING DAY 4 STRATEGY WITH ACCESSIBLE WALLET"
echo "======================================================"
echo "Mode: $MODE"
echo "Amount: $AMOUNT SOL"
echo "======================================================"

# Execute the strategy
npx tsx execute-day4-with-accessible-wallet.ts $MODE $AMOUNT

# If successful and in simulation mode, ask if user wants to run in real mode
if [ $? -eq 0 ] && [ "$MODE" == "simulation" ]; then
  echo ""
  echo "Simulation was successful! Would you like to run with real transactions? (y/n)"
  read -r ANSWER
  if [[ "$ANSWER" =~ ^[Yy]$ ]]; then
    echo "Running with real transactions..."
    npx tsx execute-day4-with-accessible-wallet.ts real $AMOUNT
  fi
fi