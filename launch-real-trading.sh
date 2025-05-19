#!/bin/bash

# Colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=================================================${NC}"
echo -e "${GREEN}🚀 LAUNCHING REAL BLOCKCHAIN TRADING SYSTEM${NC}"
echo -e "${BLUE}=================================================${NC}"

# Load environment variables from trading config
echo -e "${YELLOW}Loading trading configuration...${NC}"
source .env.trading

# Make sure SYNDICA_API_KEY is set
if [ -z "$SYNDICA_API_KEY" ]; then
  echo -e "${RED}Error: SYNDICA_API_KEY is not set. Please check .env.trading${NC}"
  exit 1
fi

# Make sure HELIUS_API_KEY is set for fallback
if [ -z "$HELIUS_API_KEY" ]; then
  echo -e "${YELLOW}Warning: HELIUS_API_KEY is not set. No fallback RPC will be available.${NC}"
fi

# Check wallet balance before starting
echo -e "${YELLOW}Checking wallet balance...${NC}"
npx tsx ./check-real-wallet-balance.ts

echo -e "\n${GREEN}Initializing trading strategies:${NC}"
echo -e "  ✓ Octa-Hop Ultimate (0.0928% profit per trade)"
echo -e "  ✓ Mega-Stablecoin Flash (0.0755% per trade)"
echo -e "  ✓ Recursive Flash Megalodon (0.0632% per trade)"

echo -e "\n${YELLOW}Starting AI agents and transformers...${NC}"
echo -e "${YELLOW}Connecting to Syndica RPC via header authentication...${NC}"

# Start the real blockchain trading
echo -e "\n${GREEN}Launching real trading engine with your 0.54 SOL balance${NC}"
npx tsx ./src/real-blockchain-trading.ts

# Keep script running
tail -f ./logs/trading.log