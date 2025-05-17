#!/bin/bash

echo "====================================="
echo "🔑 HX WALLET ACCESS UTILITY"
echo "====================================="

# Check if private key is provided
if [ -z "$1" ]; then
  echo "❌ Error: HX wallet private key not provided"
  echo ""
  echo "Usage: ./access-hx-wallet.sh [PRIVATE_KEY] [ACTION] [DESTINATION_WALLET]"
  echo "  PRIVATE_KEY: The private key for HX wallet HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb"
  echo "  ACTION: (optional) 1 for executing Day 4 strategy, 2 for transferring funds (default: 2)"
  echo "  DESTINATION_WALLET: (optional) Wallet address to send funds to"
  echo ""
  echo "Examples:"
  echo "./access-hx-wallet.sh your_private_key_here"
  echo "./access-hx-wallet.sh your_private_key_here 2"
  echo "./access-hx-wallet.sh your_private_key_here 2 4MyfJj413sqtbLaEub8kw6qPsazAE6T4EhjgaxHWcrdC"
  echo ""
  echo "Known destination wallets:"
  echo "- 4MyfJj413sqtbLaEub8kw6qPsazAE6T4EhjgaxHWcrdC (Accessible Wallet)"
  echo "- 5KJhonWngrkP8qtzf69F7trirJubtqVM7swsR7Apr2fG (Prophet Wallet)"
  echo "- HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK (Trading Wallet 1)"
  echo "- HH2hMVDuw4WT8QoGTBZX2H5BPWubDL9BFemH6UhhDPYR (Trading Wallet 2)"
  exit 1
fi

# Set the private key
HX_PRIVATE_KEY="$1"

# Set action (default to 2 - transfer funds)
ACTION="${2:-2}"

# Set destination wallet (default to Accessible Wallet)
DESTINATION_WALLET="${3:-4MyfJj413sqtbLaEub8kw6qPsazAE6T4EhjgaxHWcrdC}"

# Validate wallet address format (basic check)
if [[ ! $DESTINATION_WALLET =~ ^[1-9A-HJ-NP-Za-km-z]{32,44}$ ]]; then
  echo "❌ Warning: The destination wallet format doesn't look correct"
  echo "Are you sure you want to continue? (y/n)"
  read -r CONFIRM
  if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
    echo "Operation cancelled."
    exit 1
  fi
fi

# Set environment variables for RPC
export ALCHEMY_API_KEY="PPQbbM4WmrX_82GOP8QR5pJ_JsBvyLWR"
export HELIUS_API_KEY="cf9047cb-d7ca-435f-a8cf-92a5b5557abb"

# Set environment variables for script
export HX_WALLET_KEY="$HX_PRIVATE_KEY"
export ACTION="$ACTION"
export DESTINATION_WALLET="$DESTINATION_WALLET"

# Display action
if [ "$ACTION" = "1" ]; then
  echo "Action: Execute Day 4 Strategy"
else
  echo "Action: Transfer Funds to Wallet $DESTINATION_WALLET"
fi

# Execute with HX wallet
echo "Running with HX wallet private key..."
npx tsx execute-with-hx-wallet.ts

echo "====================================="
echo "HX wallet operation complete"
echo "====================================="