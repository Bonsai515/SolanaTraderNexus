#!/bin/bash

# This script launches real on-chain trading using your wallet

# Color codes for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================${NC}"
echo -e "${GREEN}🚀 LAUNCHING REAL BLOCKCHAIN TRADING${NC}"
echo -e "${BLUE}=========================================${NC}"

# Check if environment file exists
if [ ! -f .env.trading ]; then
  echo -e "${RED}Error: .env.trading file not found!${NC}"
  echo -e "Please run setup-real-trading.ts first to create the environment file."
  exit 1
fi

echo -e "${YELLOW}Loading environment variables...${NC}"
source .env.trading

# Check if required environment variables are set
if [ -z "$HELIUS_API_KEY" ] || [ "$HELIUS_API_KEY" == "YOUR_HELIUS_API_KEY" ]; then
  echo -e "${RED}Error: Helius API key not set in .env.trading${NC}"
  echo -e "Please edit .env.trading and set your Helius API key."
  exit 1
fi

if [ -z "$TRADING_WALLET_PRIVATE_KEY" ] || [ "$TRADING_WALLET_PRIVATE_KEY" == "YOUR_PRIVATE_KEY_HERE" ]; then
  echo -e "${RED}Error: Trading wallet private key not set in .env.trading${NC}"
  echo -e "Please edit .env.trading and set your wallet private key."
  exit 1
fi

# Display current wallet balance
echo -e "${YELLOW}Checking wallet balance...${NC}"
npx tsx ./check-real-wallet-balance.ts

# Confirm with user before starting
echo -e "${YELLOW}WARNING: This will start REAL on-chain trading using your wallet and funds.${NC}"
echo -e "${YELLOW}Make sure you have reviewed the settings in .env.trading before proceeding.${NC}"
read -p "Are you sure you want to start real trading? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${RED}Aborting...${NC}"
  exit 1
fi

# Launch the real trading engine
echo -e "${GREEN}Starting real blockchain trading engine...${NC}"
npx tsx ./src/real-blockchain-trading.ts

# Handle script termination
trap 'echo -e "${RED}Trading engine stopped.${NC}"; exit 0' SIGINT SIGTERM

# Keep the script running
while true; do
  sleep 1
done