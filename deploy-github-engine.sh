#!/bin/bash

# Deploy Solana Transaction Engine from GitHub Repository
# This script clones and deploys a Solana transaction engine from a GitHub repository

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
RESET='\033[0m'

# Ensure logs directory exists
mkdir -p ./logs

# Log to file and stdout
log() {
  echo -e "${1}"
  echo "$(date '+%Y-%m-%d %H:%M:%S') - ${1}" >> ./logs/github-deploy.log
}

log "${BLUE}🚀 Deploying Solana Transaction Engine from GitHub${RESET}"
log "${BLUE}=======================================================${RESET}"

# Ask for the repository URL if not provided
if [ -z "$1" ]; then
  read -p "Enter your GitHub repository URL: " REPO_URL
else
  REPO_URL=$1
fi

# Create temporary directory for cloning
TEMP_DIR="temp_repo"
mkdir -p $TEMP_DIR
cd $TEMP_DIR

log "${YELLOW}Cloning repository: ${REPO_URL}${RESET}"

# Try to clone with token if available
if [ -n "$GITHUB_TOKEN" ]; then
  # Extract parts from the URL
  if [[ $REPO_URL == *"github.com"* ]]; then
    REPO_PART=$(echo $REPO_URL | sed -E 's/.*github.com\/(.+)(\.git)?/\1/')
    REPO_PROTOCOL=$(echo $REPO_URL | grep -oP '^(https?|git)')
    
    # Format the URL with token
    TOKEN_URL="${REPO_PROTOCOL}://${GITHUB_TOKEN}@github.com/${REPO_PART}"
    if [[ $REPO_URL == *.git ]]; then
      TOKEN_URL="${TOKEN_URL}.git"
    fi
    
    log "${YELLOW}Cloning with GitHub token...${RESET}"
    git clone $TOKEN_URL solana-engine 2>> ../logs/github-deploy.log
  else
    # Not a GitHub URL, try direct clone
    log "${YELLOW}Not a GitHub URL, trying direct clone...${RESET}"
    git clone $REPO_URL solana-engine 2>> ../logs/github-deploy.log
  fi
else
  # No token, try public clone
  log "${YELLOW}No GitHub token found, trying public clone...${RESET}"
  git clone $REPO_URL solana-engine 2>> ../logs/github-deploy.log
fi

# Check if clone was successful
if [ $? -ne 0 ]; then
  log "${RED}❌ Failed to clone repository. Please check the URL and try again.${RESET}"
  log "${YELLOW}If this is a private repository, make sure the GITHUB_TOKEN environment variable is set.${RESET}"
  cd ..
  exit 1
fi

# Move to the cloned directory
cd solana-engine

log "${GREEN}✅ Repository cloned successfully!${RESET}"
log "${YELLOW}Checking for transaction engine code...${RESET}"

# Look for Rust code
if [ -f "Cargo.toml" ]; then
  log "${GREEN}✅ Found Rust project (Cargo.toml)${RESET}"
  
  # Check for Solana dependencies
  if grep -q "solana" Cargo.toml; then
    log "${GREEN}✅ Found Solana dependencies in Cargo.toml${RESET}"
  else
    log "${YELLOW}⚠️ No Solana dependencies found in Cargo.toml, but continuing anyway${RESET}"
  fi
  
  # Build the Rust code
  log "${YELLOW}Building Rust code...${RESET}"
  cargo build --release >> ../../logs/github-deploy.log 2>&1
  
  if [ $? -ne 0 ]; then
    log "${RED}❌ Failed to build Rust code. Check the logs for errors.${RESET}"
    cd ../..
    exit 1
  fi
  
  log "${GREEN}✅ Rust code built successfully!${RESET}"
  
  # Copy the built binary to a location in PATH
  if [ -f "target/release/solana-transaction-engine" ]; then
    log "${YELLOW}Copying transaction engine binary...${RESET}"
    cp target/release/solana-transaction-engine ../../
    log "${GREEN}✅ Transaction engine binary deployed to project root${RESET}"
  else
    # Try to find the binary
    BINARY=$(find target/release -type f -executable | grep -v "\.d" | head -n 1)
    if [ -n "$BINARY" ]; then
      log "${YELLOW}Copying executable: $BINARY${RESET}"
      cp $BINARY ../../
      BINARY_NAME=$(basename $BINARY)
      log "${GREEN}✅ Transaction engine binary deployed as $BINARY_NAME${RESET}"
    else
      log "${RED}❌ Could not find compiled binary. Check the build output.${RESET}"
    fi
  fi
else
  log "${YELLOW}⚠️ No Cargo.toml found, looking for alternative engine code...${RESET}"
  
  # Look for TypeScript/JavaScript engine
  if [ -f "package.json" ]; then
    log "${GREEN}✅ Found Node.js project (package.json)${RESET}"
    
    # Check for solana dependencies
    if grep -q "solana" package.json || grep -q "web3.js" package.json; then
      log "${GREEN}✅ Found Solana dependencies in package.json${RESET}"
    else
      log "${YELLOW}⚠️ No Solana dependencies found in package.json, but continuing anyway${RESET}"
    fi
    
    # Install dependencies
    log "${YELLOW}Installing Node.js dependencies...${RESET}"
    npm install >> ../../logs/github-deploy.log 2>&1
    
    if [ $? -ne 0 ]; then
      log "${RED}❌ Failed to install Node.js dependencies. Check the logs for errors.${RESET}"
      cd ../..
      exit 1
    fi
    
    log "${GREEN}✅ Dependencies installed successfully!${RESET}"
    
    # Copy the entire project
    log "${YELLOW}Copying transaction engine files to project...${RESET}"
    cp -r * ../../
    log "${GREEN}✅ Transaction engine files deployed to project root${RESET}"
  else
    log "${RED}❌ No recognizable transaction engine code found.${RESET}"
    cd ../..
    exit 1
  fi
fi

# Return to project root
cd ../..

# Set up connections
log "${YELLOW}Setting up RPC connections...${RESET}"

# Save RPC URLs to environment variables
echo "export SOLANA_RPC_URL=https://solana-grpc-geyser.instantnodes.io:443" > .env.trading
echo "export SOLANA_WEBSOCKET_URL=wss://solana-api.instantnodes.io/token-${SOLANA_RPC_API_KEY}" >> .env.trading

# Set up Wormhole connection without API key
echo "export WORMHOLE_GUARDIAN_RPC=https://guardian.stable.productions" >> .env.trading

# Set up system wallet
echo "export SYSTEM_WALLET_ADDRESS=HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb" >> .env.trading

# Set this to use real funds for trading
echo "export USE_REAL_FUNDS=true" >> .env.trading

# Source the environment variables
source .env.trading

log "${GREEN}✅ Environment variables set up for the transaction engine${RESET}"

# Create a script to start the engine
cat > start-engine.sh << 'EOF'
#!/bin/bash

# Start the Solana transaction engine
source .env.trading

echo "🚀 Starting Solana Transaction Engine with REAL FUNDS..."

# Try to find the engine executable
if [ -f "solana-transaction-engine" ]; then
  echo "Starting Rust binary engine..."
  ./solana-transaction-engine
elif [ -f "main" ]; then
  echo "Starting Rust binary engine..."
  ./main
elif [ -f "index.js" ]; then
  echo "Starting Node.js engine..."
  node index.js
elif [ -f "index.ts" ]; then
  echo "Starting TypeScript engine..."
  ts-node index.ts
elif [ -f "src/main.rs" ]; then
  echo "Starting Rust engine from source..."
  cargo run --release
else
  echo "❌ Could not find engine entry point. Please start it manually."
  exit 1
fi
EOF

chmod +x start-engine.sh

log "${GREEN}✅ Created start-engine.sh script${RESET}"
log "${BLUE}=======================================================${RESET}"
log "${GREEN}✅ Solana Transaction Engine deployed successfully!${RESET}"
log "${YELLOW}To start the engine, run: ./start-engine.sh${RESET}"
log "${YELLOW}The engine is configured to use REAL FUNDS for trading${RESET}"
log "${BLUE}=======================================================${RESET}"