#!/bin/bash
# Run Quantum Flash Strategy with Real Blockchain Trading (1.1 SOL)

echo "===================================="
echo "QUANTUM FLASH STRATEGY - REAL TRADING"
echo "===================================="
echo ""
echo "Using Alchemy RPC for reliable connections"
echo "Using System Wallet with 1.534 SOL balance"
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

# Set Alchemy as the primary RPC provider
export SOLANA_RPC_URL="https://solana-mainnet.g.alchemy.com/v2/PPQbbM4WmrX_82GOP8QR5pJ_JsBvyLWR"

# Create logs directory
mkdir -p logs/transactions

# Run the trading strategy
echo "Executing Quantum Flash Strategy with real wallet..."
npx tsx run-flash-strategy.ts

echo ""
echo "Trading completed. Check logs for details."