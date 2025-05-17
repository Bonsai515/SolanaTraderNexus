#!/bin/bash
# Execute Quantum Flash Strategy using Alchemy RPC with 1.1 SOL

echo "======================================"
echo "QUANTUM FLASH STRATEGY - REAL TRADING"
echo "======================================"
echo ""
echo "This script will execute the Quantum Flash Strategy with exactly 1.1 SOL using:"
echo " - System wallet: HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb"
echo " - Alchemy RPC: Fast, reliable connection"
echo " - Day 1 conservative strategy: 0.3% slippage, ~7% profit target"
echo ""
echo "Press ENTER to start real blockchain trading or Ctrl+C to cancel..."
read

# Create required directories
mkdir -p logs/transactions

# Force use of Alchemy RPC for reliability
export SOLANA_RPC_URL="https://solana-mainnet.g.alchemy.com/v2/PPQbbM4WmrX_82GOP8QR5pJ_JsBvyLWR"
export NEXT_PUBLIC_ALCHEMY_RPC="https://solana-mainnet.g.alchemy.com/v2/PPQbbM4WmrX_82GOP8QR5pJ_JsBvyLWR"
export HELIUS_RPC="https://mainnet.helius-rpc.com/?api-key=f1f60ee0-24e4-45ac-94c9-01d4bd368b05"

# Execute our optimized strategy
echo "Starting real blockchain trading with 1.1 SOL..."
npx tsx run-flash-strategy.ts

echo ""
echo "Trading execution complete. See logs/transactions for details on profit/loss."