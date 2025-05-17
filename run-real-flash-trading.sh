#!/bin/bash
# Run Quantum Flash Strategy with Real Blockchain Trading (1.1 SOL)

echo "===================================="
echo "QUANTUM FLASH STRATEGY - REAL TRADING"
echo "===================================="
echo ""
echo "This script will run the Quantum Flash Strategy with 1.1 SOL on the real Solana blockchain."
echo "It will automatically answer 'y' to confirmation prompts."
echo ""
echo "Strategy details:"
echo " - Day 1 (Conservative)"
echo " - Amount: 1.1 SOL"
echo " - Expected profit: ~7% (0.077 SOL)"
echo " - Slippage: 0.3%"
echo " - Flash loans: Enabled (Solend)"
echo " - Cross-margin leverage: Disabled"
echo ""
echo "Press ENTER to start or Ctrl+C to cancel..."
read

# Create logs directory
mkdir -p logs/transactions

# Run both the dashboard and trading in parallel
echo "Starting monitoring dashboard..."
npx tsx flash-trading-dashboard.ts &
DASHBOARD_PID=$!

# Wait for dashboard to initialize
sleep 2

# Run the actual trading with auto-confirmation
echo "Executing real blockchain trading..."
echo "y" | npx tsx execute-real-flash-trading.ts 1 1.1

# Wait for user to press enter to exit
echo ""
echo "Trading completed. Press ENTER to close the dashboard..."
read

# Kill the dashboard process
kill $DASHBOARD_PID
echo "Dashboard closed. Trading logs are stored in logs/transactions directory."