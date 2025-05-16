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
