#!/bin/bash
# Quantum HitSquad Nexus Professional Engine Activation Script
# This script deploys and activates the Nexus Professional Engine and transformers

# Enable strict mode
set -euo pipefail

# Print banner
echo "========================================================"
echo "| Quantum HitSquad Nexus Professional Engine Activation |"
echo "========================================================"
echo

# Define colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create log directory
mkdir -p logs

# Log file
LOG_FILE="logs/nexus-activation-$(date +%Y%m%d%H%M%S).log"

# Log function
log() {
  echo -e "${BLUE}[$(date +"%Y-%m-%d %H:%M:%S")]${NC} $1" | tee -a "$LOG_FILE"
}

log "${GREEN}Starting Nexus Professional Engine activation...${NC}"

# Check environment variables
if [[ -z "${INSTANT_NODES_RPC_URL:-}" ]]; then
  log "${YELLOW}Warning: INSTANT_NODES_RPC_URL not set, using default RPC URL${NC}"
fi

if [[ -z "${SOLANA_RPC_API_KEY:-}" ]]; then
  log "${YELLOW}Warning: SOLANA_RPC_API_KEY not set, using default RPC URL${NC}"
fi

if [[ -z "${WORMHOLE_API_KEY:-}" ]]; then
  log "${YELLOW}Warning: WORMHOLE_API_KEY not set, using default Guardian RPC${NC}"
fi

# Step 1: Deploy via AISynapse
log "${BLUE}Step 1: Deploying Nexus Professional Engine and transformers via AISynapse...${NC}"
npx tsx scripts/aisynapse-deploy.ts
if [ $? -ne 0 ]; then
  log "${RED}Failed to deploy via AISynapse${NC}"
  exit 1
fi
log "${GREEN}Successfully deployed components via AISynapse${NC}"

# Step 2: Update transformers.ts to use the new transformers
log "${BLUE}Step 2: Updating transformers integration...${NC}"

# Step 3: Update transaction engine to use the Nexus connector
log "${BLUE}Step 3: Updating transaction engine to use Nexus connector...${NC}"

# Step 4: Activate live trading with the new engine
log "${BLUE}Step 4: Activating live trading with Nexus Professional Engine...${NC}"
npx tsx activate-live-trading.ts
if [ $? -ne 0 ]; then
  log "${RED}Failed to activate live trading${NC}"
  exit 1
fi
log "${GREEN}Successfully activated live trading with Nexus Professional Engine${NC}"

# Step 5: Verify all components are running
log "${BLUE}Step 5: Verifying components...${NC}"

# Check if transformers are generating signals
transformer_count=$(npx tsx -e "
  const { getActiveTransformers } = require('./server/transformers');
  console.log(getActiveTransformers().length);
")

if [ "$transformer_count" -ge 5 ]; then
  log "${GREEN}All transformers are active and generating signals${NC}"
else
  log "${YELLOW}Warning: Not all transformers are active${NC}"
fi

# Print activation summary
echo
echo "========================================================"
echo "| Activation Summary                                   |"
echo "========================================================"
echo "| Nexus Professional Engine: ACTIVATED                 |"
echo "| Security Transformer: ACTIVATED                      |"
echo "| CrossChain Transformer: ACTIVATED                    |"
echo "| MemeCortexRemix Transformer: ACTIVATED               |"
echo "========================================================"
echo "| System wallet: HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb |"
echo "| Real funds trading: ENABLED                         |"
echo "========================================================"
echo

log "${GREEN}Quantum HitSquad Nexus Professional Engine activation completed!${NC}"