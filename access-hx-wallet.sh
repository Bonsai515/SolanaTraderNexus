#!/bin/bash

echo "====================================="
echo "🔑 HX WALLET ACCESS UTILITY"
echo "====================================="

# Check if private key is provided
if [ -z "$1" ]; then
  echo "❌ Error: HX wallet private key not provided"
  echo ""
  echo "Usage: ./access-hx-wallet.sh [PRIVATE_KEY] [ACTION]"
  echo "  PRIVATE_KEY: The private key for HX wallet HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb"
  echo "  ACTION: (optional) 1 for executing Day 4 strategy, 2 for transferring funds (default: 1)"
  echo ""
  echo "Example: ./access-hx-wallet.sh abcdef1234567890... 2"
  exit 1
fi

# Set the private key
HX_PRIVATE_KEY="$1"

# Set action (default to 1 - execute strategy)
ACTION="${2:-1}"

# Set environment variables for RPC
export ALCHEMY_API_KEY="PPQbbM4WmrX_82GOP8QR5pJ_JsBvyLWR"
export HELIUS_API_KEY="cf9047cb-d7ca-435f-a8cf-92a5b5557abb"

# Set environment variables for script
export HX_WALLET_KEY="$HX_PRIVATE_KEY"
export ACTION="$ACTION"

# Display action
if [ "$ACTION" = "1" ]; then
  echo "Action: Execute Day 4 Strategy"
else
  echo "Action: Transfer Funds to Safe Wallet"
fi

# Execute with HX wallet
echo "Running with HX wallet private key..."
npx tsx execute-with-hx-wallet.ts

echo "====================================="
echo "HX wallet operation complete"
echo "====================================="