#!/bin/bash
# Execute Real Blockchain Trading with Quantum Flash Strategy (1.1 SOL)

echo "========================================================"
echo "     REAL BLOCKCHAIN TRADING - QUANTUM FLASH STRATEGY   "
echo "========================================================"
echo ""
echo "⚠️  WARNING: This script will execute REAL transactions on the Solana blockchain! ⚠️"
echo ""
echo "Configuration:"
echo " - System Wallet: HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb"
echo " - Amount: 1.1 SOL"
echo " - Strategy: Day 1 (Conservative)"
echo " - Expected Profit: ~7% (0.077 SOL)"
echo " - Slippage: 0.3%"
echo " - RPC Provider: Alchemy (reliable connection)"
echo ""
echo "Do you want to proceed with REAL blockchain trading? (yes/no)"
read answer

if [[ "$answer" != "yes" ]]; then
  echo "Trading cancelled. Exiting."
  exit 0
fi

# Set Alchemy as the primary RPC provider
export SOLANA_RPC_URL="https://solana-mainnet.g.alchemy.com/v2/PPQbbM4WmrX_82GOP8QR5pJ_JsBvyLWR"

# Create logs directory
mkdir -p logs/transactions

# Execute real blockchain trading
echo "Executing real blockchain trading..."
node execute-real-blockchain-trade.js

echo ""
echo "Transaction complete. Check logs for details."