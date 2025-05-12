#!/bin/bash

# Neural Nexus Transaction Engine Deployment Script
# This script deploys and activates the Solana transaction engine

# Set up colors for terminal output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=======================================================${NC}"
echo -e "${BLUE}= Neural Nexus Solana Transaction Engine Deployment   =${NC}"
echo -e "${BLUE}=======================================================${NC}"

# Check if INSTANT_NODES_RPC_URL is set
if [ -z "$INSTANT_NODES_RPC_URL" ]; then
  echo -e "${YELLOW}Warning: INSTANT_NODES_RPC_URL environment variable not set!${NC}"
  echo -e "${YELLOW}Using default Solana public RPC endpoints (limited rate).${NC}"
  export INSTANT_NODES_RPC_URL="https://api.mainnet-beta.solana.com"
fi

# Verify that Rust is installed
if ! command -v rustc &> /dev/null; then
  echo -e "${RED}Error: Rust compiler not found. Please install Rust.${NC}"
  exit 1
fi

# Set the system wallet
if [ -z "$SYSTEM_WALLET" ]; then
  echo -e "${YELLOW}Using default system wallet for profit collection.${NC}"
  export SYSTEM_WALLET="HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb"
fi

echo -e "${GREEN}System wallet set to: ${SYSTEM_WALLET}${NC}"

# Build the transaction engine with optimizations
echo -e "${BLUE}Building Solana transaction engine...${NC}"
cd src
cargo build --release --bin solana_quantum_trading

# Check if build succeeded
if [ $? -ne 0 ]; then
  echo -e "${RED}Error: Failed to build transaction engine!${NC}"
  exit 1
fi

echo -e "${GREEN}Transaction engine built successfully!${NC}"

# Set up proper linking
echo -e "${BLUE}Setting up transaction engine connections...${NC}"

# Activate the connection between connector and engine
echo -e "${BLUE}Activating connection to Solana blockchain...${NC}"

# Initialize the transaction engine
echo "export SOLANA_RPC_URL=$INSTANT_NODES_RPC_URL" > .env.transaction
echo "export SYSTEM_WALLET=$SYSTEM_WALLET" >> .env.transaction

# Create activation script
cat > activate-transaction-engine.js << 'EOL'
const { execSync } = require('child_process');
const fs = require('fs');

// Load environment variables
require('dotenv').config({ path: '.env.transaction' });

console.log('Activating Solana transaction engine...');

try {
  // Call the Rust activation function
  execSync('./target/release/solana_quantum_trading', { stdio: 'inherit' });
  console.log('✅ Transaction engine activated successfully!');
  
  // Create status file to indicate successful activation
  fs.writeFileSync('.transaction_engine_active', JSON.stringify({
    status: 'active',
    timestamp: new Date().toISOString(),
    wallet: process.env.SYSTEM_WALLET || 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb'
  }));
  
  process.exit(0);
} catch (error) {
  console.error('❌ Failed to activate transaction engine:', error);
  process.exit(1);
}
EOL

# Make scripts executable
chmod +x activate-transaction-engine.js

echo -e "${GREEN}Deployment completed successfully!${NC}"
echo -e "${GREEN}Transaction engine is now deployed and ready for activation.${NC}"
echo -e "${YELLOW}To activate live trading, use the web interface or run:${NC}"
echo -e "${YELLOW}node activate-transaction-engine.js${NC}"
echo -e "${BLUE}=======================================================${NC}"