#!/bin/bash

# Start real on-chain trading with transformers and AI agents
# This script launches the trading system with the wallet balance

# Colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================${NC}"
echo -e "${GREEN}🚀 STARTING REAL BLOCKCHAIN TRADING${NC}"
echo -e "${BLUE}=========================================${NC}"

# Load environment variables
echo -e "${YELLOW}Loading environment variables...${NC}"
source .env.trading

# Check current wallet balance
echo -e "${YELLOW}Checking wallet balance before trading...${NC}"
npx tsx ./check-real-wallet-balance.ts

echo -e "\n${YELLOW}Initializing AI transformers and agents...${NC}"
echo -e "${YELLOW}Starting with Syndica API connection for maximum performance${NC}"

# Start the real trading engine
echo -e "\n${GREEN}Launching trading engine with strategies:${NC}"
echo -e "  • Octa-Hop Ultimate Strategy"
echo -e "  • Mega-Stablecoin Flash Strategy"
echo -e "  • Recursive Flash Megalodon Strategy"

echo -e "\n${YELLOW}Starting blockchain connection...${NC}"
npx tsx ./src/real-blockchain-trading.ts

# Keep the script running
while true; do
  sleep 1
done