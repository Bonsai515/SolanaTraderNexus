#!/bin/bash

echo "====================================="
echo "🚀 RUNNING DAY 4 STRATEGY - PROPHET WALLET"
echo "====================================="

# Set environment variables for RPC
export ALCHEMY_API_KEY="PPQbbM4WmrX_82GOP8QR5pJ_JsBvyLWR"
export HELIUS_API_KEY="cf9047cb-d7ca-435f-a8cf-92a5b5557abb"

# Execute strategy with Prophet wallet
echo "Executing Quantum Flash Day 4 strategy with Prophet wallet..."
npx tsx execute-day4-with-prophet-wallet.ts

echo "====================================="
echo "Strategy execution complete"
echo "====================================="