#!/bin/bash

# Singularity Agent Activation Script
# This script activates the Singularity agent for cross-chain arbitrage trading

# Define colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Usage information
usage() {
  echo -e "${BLUE}Usage:${NC} $0 [options]"
  echo ""
  echo "Options:"
  echo "  -m, --mode MODE        Trading mode: scan_only, dry_run, live_trading (default: dry_run)"
  echo "  -s, --system-wallet    Use system wallet for trading (default: true)"
  echo "  -p, --profit PERCENT   Minimum profit percentage (default: 0.5)"
  echo "  -i, --input AMOUNT     Maximum input amount in USDC (default: 100.0)"
  echo "  -t, --trading WALLET   Trading wallet address (default: system wallet)"
  echo "  -r, --profit WALLET    Profit wallet address"
  echo "  -f, --fee WALLET       Fee wallet address"
  echo "  -h, --help             Show this help message"
  echo ""
  echo "Examples:"
  echo "  $0                     # Activate with default settings (dry_run mode)"
  echo "  $0 -m scan_only        # Activate in scan-only mode (no trades)"
  echo "  $0 -m live_trading     # ACTIVATE IN LIVE TRADING MODE WITH REAL FUNDS"
  echo "  $0 -p 1.0 -i 50        # Require 1% profit, max 50 USDC input"
  echo ""
  echo -e "${YELLOW}Warning:${NC} Live trading mode uses real funds and executes real transactions on the blockchain."
}

# Default values
MODE="dry_run"
USE_SYSTEM_WALLET=true
MIN_PROFIT_PCT=0.5
MAX_INPUT=100.0
TRADING_WALLET="HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb"
PROFIT_WALLET="6bLfHsp6eCFWZqGKZQaRwpVVLZRwKqcLt6QCKwLoxTqF"
FEE_WALLET="9aBt1zPRUZmxttZ6Mk9AAU6XGS1TLQMZkpbCNBLH2Y2z"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -m|--mode)
      MODE="$2"
      shift 2
      ;;
    -s|--system-wallet)
      USE_SYSTEM_WALLET=true
      shift
      ;;
    -p|--profit)
      MIN_PROFIT_PCT="$2"
      shift 2
      ;;
    -i|--input)
      MAX_INPUT="$2"
      shift 2
      ;;
    -t|--trading)
      TRADING_WALLET="$2"
      shift 2
      ;;
    -r|--profit)
      PROFIT_WALLET="$2"
      shift 2
      ;;
    -f|--fee)
      FEE_WALLET="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo -e "${RED}Error:${NC} Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

# Validate mode
if [[ "$MODE" != "scan_only" && "$MODE" != "dry_run" && "$MODE" != "live_trading" ]]; then
  echo -e "${RED}Error:${NC} Invalid mode: $MODE"
  echo "Valid modes are: scan_only, dry_run, live_trading"
  exit 1
fi

# Display activation parameters
echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}Singularity Agent Activation Parameters${NC}"
echo -e "${BLUE}==========================================${NC}"
echo -e "Mode:               ${YELLOW}$MODE${NC}"
echo -e "Use System Wallet:  ${YELLOW}$USE_SYSTEM_WALLET${NC}"
echo -e "Min Profit:         ${YELLOW}$MIN_PROFIT_PCT%${NC}"
echo -e "Max Input:          ${YELLOW}$MAX_INPUT USDC${NC}"
echo -e "Trading Wallet:     ${YELLOW}$TRADING_WALLET${NC}"
echo -e "Profit Wallet:      ${YELLOW}$PROFIT_WALLET${NC}"
echo -e "Fee Wallet:         ${YELLOW}$FEE_WALLET${NC}"
echo -e "${BLUE}==========================================${NC}"

# Confirm activation in live trading mode
if [[ "$MODE" == "live_trading" ]]; then
  echo -e "${RED}WARNING: You are about to activate Singularity in LIVE TRADING mode with REAL FUNDS!${NC}"
  echo -e "This will execute real transactions on the blockchain using your actual wallet balances."
  echo ""
  read -p "Are you sure you want to continue? (y/n): " confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Activation cancelled."
    exit 0
  fi
fi

# Construct the JSON payload
JSON_PAYLOAD=$(cat <<EOF
{
  "mode": "$MODE",
  "useSystemWallet": $USE_SYSTEM_WALLET,
  "minProfitPct": $MIN_PROFIT_PCT,
  "maxInput": $MAX_INPUT,
  "tradingWallet": "$TRADING_WALLET",
  "profitWallet": "$PROFIT_WALLET",
  "feeWallet": "$FEE_WALLET"
}
EOF
)

# API endpoint
API_URL="http://localhost:5000/api/singularity/activate"

# Make the API request
echo "Sending activation request to Singularity agent..."
echo "API URL: $API_URL"
echo "Payload:"
echo "$JSON_PAYLOAD" | jq . 2>/dev/null || echo "$JSON_PAYLOAD"
echo ""

response=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD")

# Parse and display the response
echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}Server Response${NC}"
echo -e "${BLUE}==========================================${NC}"
echo "$response" | jq . 2>/dev/null || echo "$response"
echo -e "${BLUE}==========================================${NC}"

# Check activation status
if echo "$response" | grep -q '"status":"success"'; then
  echo -e "${GREEN}✅ Singularity agent activated successfully!${NC}"
  
  # Check if it's running in live trading mode
  if echo "$response" | grep -q '"useRealFunds":true'; then
    echo -e "${RED}⚠️ WARNING: Singularity is running in LIVE TRADING mode with REAL FUNDS!${NC}"
  else
    echo -e "${BLUE}ℹ️ Singularity is running in $MODE mode (no real trades).${NC}"
  fi

  # Print instructions for checking status and stopping the agent
  echo ""
  echo -e "${BLUE}To check agent status:${NC}"
  echo "node test-singularity-status.js"
  
  echo ""
  echo -e "${BLUE}To stop the agent:${NC}"
  echo "node test-singularity-stop.js"
else
  echo -e "${RED}❌ Failed to activate Singularity agent.${NC}"
  echo "Please check the server response for details."
fi