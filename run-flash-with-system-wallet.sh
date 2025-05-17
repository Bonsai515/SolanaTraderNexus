#!/bin/bash
# Run Quantum Flash Strategy with System Wallet and Alchemy RPC

echo "===================================="
echo "QUANTUM FLASH STRATEGY - REAL TRADING"
echo "===================================="
echo ""
echo "This script executes the Quantum Flash Strategy with 1.1 SOL using:"
echo "- System Wallet (HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb)"
echo "- Alchemy RPC (for reliable connections)"
echo ""
echo "Strategy details:"
echo " - Day 1 (Conservative)"
echo " - Amount: 1.1 SOL"
echo " - Expected profit: ~7% (0.077 SOL)"
echo " - Slippage: 0.3%"
echo " - Flash loans: Enabled (Solend)"
echo ""
echo "Press ENTER to start or Ctrl+C to cancel..."
read

# Create logs directory
mkdir -p logs/transactions

# Set Alchemy as the primary RPC provider
export SOLANA_RPC_URL="https://solana-mainnet.g.alchemy.com/v2/PPQbbM4WmrX_82GOP8QR5pJ_JsBvyLWR"
export HELIUS_API_KEY="f1f60ee0-24e4-45ac-94c9-01d4bd368b05"

# Run both the dashboard and trading in parallel
echo "Starting monitoring dashboard..."
npx tsx flash-trading-dashboard.ts &
DASHBOARD_PID=$!

# Wait for dashboard to initialize
sleep 2

# Run the specialized wallet script
echo "Executing real blockchain trading with system wallet..."
npx tsx execute-flash-with-wallet.ts

# Wait for user to press enter to exit
echo ""
echo "Trading completed. Press ENTER to close the dashboard..."
read

# Kill the dashboard process
kill $DASHBOARD_PID
echo "Dashboard closed. Trading logs are stored in logs/transactions directory."