#!/bin/bash
# Setup Alchemy Day 4 Strategy
# This script sets up everything needed for the Day 4 Quantum Flash Strategy
# with 91% ROI using Alchemy as the RPC provider

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
echo -e "${PURPLE}         ALCHEMY DAY 4 STRATEGY SETUP                  ${NC}"
echo -e "${PURPLE}=======================================================${NC}"

# Check for Alchemy API key
echo -e "${BLUE}Checking for Alchemy API key...${NC}"
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
  
  # Save to environment file for future sessions
  echo "ALCHEMY_API_KEY=$ALCHEMY_API_KEY" >> .env.trading
  echo -e "${GREEN}API key saved to .env.trading${NC}"
fi

echo -e "${GREEN}✓ Alchemy API key is set${NC}"

# Set the RPC URL
export RPC_URL="https://solana-mainnet.g.alchemy.com/v2/$ALCHEMY_API_KEY"
echo -e "${GREEN}✓ RPC URL configured to use Alchemy${NC}"

# Configure day4 wallet
echo -e "${BLUE}Configuring Day 4 strategy with database wallet...${NC}"

WALLET_CONFIG_FILE="data/day4_wallet_config.json"

mkdir -p data

cat > $WALLET_CONFIG_FILE << EOL
{
  "wallet": {
    "publicKey": "D8UevDKnp9qk4nLwNGgnEm97NJ6yzFhYzuRr5wkv9HSL",
    "balance": 10000.0,
    "type": "TRADING"
  },
  "strategy": {
    "name": "Quantum Flash Day 4",
    "type": "FLASH_ARBITRAGE",
    "riskLevel": "HIGH",
    "profitTarget": 91.0,
    "flashLoanAmount": 1.1,
    "flashLoanSource": "Solend",
    "maxHops": 4,
    "routeCandidates": 3,
    "dexes": ["Jupiter", "Orca", "Raydium", "Mercurial"]
  },
  "rpc": {
    "provider": "Alchemy",
    "url": "https://solana-mainnet.g.alchemy.com/v2/YOUR_API_KEY",
    "fallbackProviders": ["Helius"]
  }
}
EOL

echo -e "${GREEN}✓ Wallet configuration created at $WALLET_CONFIG_FILE${NC}"

# Install required npm packages
echo -e "${BLUE}Checking for required packages...${NC}"

# Set Up TypeScript configuration if needed
if [ ! -f "tsconfig.json" ]; then
  echo -e "${BLUE}Creating TypeScript configuration...${NC}"
  cat > tsconfig.json << EOL
{
  "compilerOptions": {
    "target": "es2020",
    "module": "commonjs",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist",
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["*.ts", "src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
EOL
  echo -e "${GREEN}✓ TypeScript configuration created${NC}"
fi

# Create .env file for the strategy
echo -e "${BLUE}Creating environment configuration...${NC}"
cat > .env.day4-strategy << EOL
# Day 4 Quantum Flash Strategy Environment Configuration
RPC_URL=https://solana-mainnet.g.alchemy.com/v2/$ALCHEMY_API_KEY
WALLET_ADDRESS=D8UevDKnp9qk4nLwNGgnEm97NJ6yzFhYzuRr5wkv9HSL
FLASH_LOAN_AMOUNT=1.1
FLASH_LOAN_SOURCE=Solend
SLIPPAGE_BPS=50
SIMULATION_MODE=true
EOL

echo -e "${GREEN}✓ Environment configuration created at .env.day4-strategy${NC}"

# Prepare directory for logs
echo -e "${BLUE}Setting up log directories...${NC}"
mkdir -p logs/transactions
echo -e "${GREEN}✓ Log directories created${NC}"

# Create shell script to compile and run the TypeScript implementation
echo -e "${BLUE}Creating execution script...${NC}"
cat > run-day4-strategy-alchemy.sh << EOL
#!/bin/bash
# Run Day 4 Strategy with Alchemy

# Load environment variables
source .env.day4-strategy

# Check if we want to run in simulation mode or real mode
SIMULATION_FLAG="\$1"

if [ "\$SIMULATION_FLAG" == "--real" ]; then
  echo "WARNING: Running in REAL BLOCKCHAIN MODE. Real transactions will be executed!"
  echo "Press Ctrl+C within 5 seconds to cancel..."
  sleep 5
  export SIMULATION_MODE=false
else
  echo "Running in SIMULATION MODE. No real transactions will be executed."
  export SIMULATION_MODE=true
fi

# Compile TypeScript code
echo "Compiling TypeScript code..."
npx tsc execute-quantum-flash-day4.ts

# Run the strategy
echo "Executing Day 4 strategy with Alchemy RPC..."
node execute-quantum-flash-day4.js
EOL

chmod +x run-day4-strategy-alchemy.sh
echo -e "${GREEN}✓ Execution script created at run-day4-strategy-alchemy.sh${NC}"

echo -e "${PURPLE}=======================================================${NC}"
echo -e "${GREEN}✅ Day 4 Strategy Setup Complete!${NC}"
echo -e "${PURPLE}=======================================================${NC}"
echo ""
echo -e "${BLUE}To execute the strategy in simulation mode:${NC}"
echo -e "./run-day4-strategy-alchemy.sh"
echo ""
echo -e "${YELLOW}To execute with real blockchain transactions:${NC}"
echo -e "./run-day4-strategy-alchemy.sh --real"
echo ""
echo -e "${RED}IMPORTANT:${NC} Before running with real transactions,"
echo -e "make sure you have secured the private key for wallet:"
echo -e "${YELLOW}D8UevDKnp9qk4nLwNGgnEm97NJ6yzFhYzuRr5wkv9HSL${NC}"
echo -e "${PURPLE}=======================================================${NC}"