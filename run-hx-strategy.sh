#!/bin/bash
# Execute Day 4 Quantum Flash Strategy with HX System Wallet
# This script runs the high-profit Day 4 strategy (91% ROI) using the HX system wallet

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Clear the screen
clear

# Display header
echo -e "${PURPLE}=======================================================${NC}"
echo -e "${PURPLE}   QUANTUM FLASH STRATEGY - DAY 4 IMPLEMENTATION       ${NC}"
echo -e "${PURPLE}=======================================================${NC}"
echo -e "${PURPLE}Date:${NC} 2025-05-14 (Day 4 Market Conditions)"
echo -e "${PURPLE}Wallet:${NC} HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb (System Wallet)"
echo -e "${PURPLE}Flash Loan Amount:${NC} 1.1 SOL"
echo -e "${PURPLE}Flash Loan Source:${NC} Solend (0.09% fee)"
echo -e "${PURPLE}Expected ROI:${NC} 91%"
echo -e "${PURPLE}RPC:${NC} Alchemy (Premium)"
echo -e "${PURPLE}=======================================================${NC}"
echo ""

# Check for Alchemy API key
if [ -z "$ALCHEMY_API_KEY" ]; then
  echo -e "${YELLOW}ALCHEMY_API_KEY environment variable not set.${NC}"
  echo -e "Please enter your Alchemy API key:"
  read -p "> " ALCHEMY_API_KEY
  
  if [ -z "$ALCHEMY_API_KEY" ]; then
    echo -e "${RED}Error: Alchemy API key is required to continue.${NC}"
    exit 1
  fi
  
  # Export the key for this session
  export ALCHEMY_API_KEY="$ALCHEMY_API_KEY"
  export RPC_URL="https://solana-mainnet.g.alchemy.com/v2/$ALCHEMY_API_KEY"
else
  export RPC_URL="https://solana-mainnet.g.alchemy.com/v2/$ALCHEMY_API_KEY"
fi

echo -e "${GREEN}✓ RPC connection configured with Alchemy${NC}"
echo ""

# Check if we want to run in simulation mode or real mode
SIMULATION_FLAG="$1"

if [ "$SIMULATION_FLAG" == "--real" ]; then
  echo -e "${RED}WARNING: Running in REAL BLOCKCHAIN MODE. Real transactions will be executed!${NC}"
  echo -e "This will execute transactions with real SOL on the Solana blockchain."
  echo -e "Press Ctrl+C within 5 seconds to cancel..."
  sleep 5
  
  # Run with real transactions
  echo -e "${YELLOW}Executing Day 4 strategy with REAL transactions...${NC}"
  npx tsx execute-quantum-flash-with-hx.ts --real
else
  # Run in simulation mode
  echo -e "${BLUE}Executing Day 4 strategy in SIMULATION mode...${NC}"
  echo -e "(Use --real flag to execute with real transactions)"
  echo ""
  npx tsx execute-quantum-flash-with-hx.ts
fi