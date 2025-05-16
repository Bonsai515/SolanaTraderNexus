#!/bin/bash

# Enhance Trading Features Script
# This script activates the specialized trading features with flash loans and meme sniping

echo "=========================================================="
echo "  ACTIVATING ENHANCED TRADING FEATURES"
echo "=========================================================="

# Create environment file with nuclear strategy settings
cat > .env.enhanced << EOF
# Enhanced Trading Configuration
ENABLE_FLASH_LOANS=true
FLASH_LOAN_MIN_PROFIT_USD=5.00
FLASH_LOAN_MAX_SIZE_USD=10000
FLASH_LOAN_MAX_SLIPPAGE_BPS=30
ENABLE_MEV_PROTECTION=true

# Meme Token Sniper Configuration
ENABLE_MEME_SNIPER=true
MEME_SNIPER_MAX_BUY_USD=100
MEME_SNIPER_MIN_LIQUIDITY_USD=5000
MEME_SNIPER_MAX_SLIPPAGE_BPS=100
MEME_SNIPER_PROFIT_TARGET=30
MEME_SNIPER_STOP_LOSS=15

# Nuclear Strategies Configuration
ENABLE_NUCLEAR_STRATEGIES=true
NUCLEAR_MIN_CONFIDENCE=70
NUCLEAR_MAX_EXPOSURE_PCT=10
EOF

echo "✅ Enhanced trading configuration created"

# Merge with existing .env file
cat .env.enhanced >> .env
echo "✅ Environment variables updated"

# Create a feature activation script
cat > activate-features.js << EOF
// This script activates specific trading features in the Hyperion system
const fs = require('fs');

// Write to the system memory file to activate features
const systemMemory = {
  features: {
    flashLoans: true,
    memeSniper: true,
    crossChainArbitrage: true,
    nuclearStrategies: true
  },
  config: {
    flashLoans: {
      enabled: true,
      minProfitUsd: 5.0,
      maxSizeUsd: 10000,
      maxSlippageBps: 30
    },
    memeSniper: {
      enabled: true,
      maxBuyUsd: 100,
      minLiquidityUsd: 5000,
      maxSlippageBps: 100,
      profitTarget: 30,
      stopLoss: 15
    }
  }
};

// Write the configuration to system memory file
fs.writeFileSync('./data/system_memory.json', JSON.stringify(systemMemory, null, 2));
console.log('✅ System memory updated with enhanced feature activation');
EOF

# Run the feature activation script
node activate-features.js

echo "✅ Enhanced features activated in system memory"

# Start the system with enhanced features
echo "Starting system with enhanced trading features..."
npx tsx server/index.ts