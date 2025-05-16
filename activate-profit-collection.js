// Activate Profit Collection Script
// This script activates the profit collection system and updates configurations

const fs = require('fs');
const path = require('path');

// Paths
const systemMemoryPath = path.join(__dirname, 'data', 'system_memory.json');
const profitConfigPath = path.join(__dirname, 'data', 'profit_config.json');

// Read and update system memory
let systemMemory = {};
try {
  const systemMemoryContent = fs.readFileSync(systemMemoryPath, 'utf-8');
  systemMemory = JSON.parse(systemMemoryContent);
} catch (error) {
  console.log('System memory file not found or invalid. Creating new configuration.');
  systemMemory = {};
}

// Update system memory with profit collection settings
systemMemory.features = systemMemory.features || {};
systemMemory.features.profitCollection = true;

systemMemory.config = systemMemory.config || {};
systemMemory.config.profitCollection = {
  enabled: true,
  captureIntervalMinutes: 30,
  autoCapture: true,
  minProfitThreshold: 0.01, // SOL
  reinvestmentRate: 0.95, // 95% reinvestment
  targetWallet: "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb"
};

// Write back to system memory
fs.writeFileSync(systemMemoryPath, JSON.stringify(systemMemory, null, 2));
console.log('✅ System memory updated with profit collection settings');

// Create profit configuration file
const profitConfig = {
  enabled: true,
  captureIntervalMinutes: 30,
  lastCaptureTime: new Date().toISOString(),
  totalProfitCollected: 0,
  wallets: [
    {
      address: "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb",
      label: "Main Profit Collection Wallet",
      profitShare: 0.05 // 5% direct profit
    },
    {
      address: "31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e",
      label: "Prophet Wallet",
      profitShare: 0.05 // 5% direct profit
    }
  ],
  reinvestment: {
    enabled: true,
    rate: 0.90, // 90% reinvestment
    targetWallet: "2qPJQ6fMWxNH4p8hjhqonJt1Fy4okf7ToDV4Z6nGLddm"
  }
};

// Create profit logs directory if it doesn't exist
const profitLogsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(profitLogsDir)) {
  fs.mkdirSync(profitLogsDir, { recursive: true });
}

// Write profit configuration
fs.writeFileSync(profitConfigPath, JSON.stringify(profitConfig, null, 2));
console.log('✅ Profit collection configuration created');

// Create empty profit log file if it doesn't exist
const profitLogPath = path.join(__dirname, 'logs', 'profit.json');
if (!fs.existsSync(profitLogPath)) {
  fs.writeFileSync(profitLogPath, JSON.stringify({ 
    totalProfit: 0, 
    lastUpdated: new Date().toISOString(),
    profitHistory: [] 
  }, null, 2));
  console.log('✅ Profit log file initialized');
}

console.log('✅ Profit collection system is now ACTIVE');
console.log('The system will automatically collect profits every 30 minutes');
console.log('Profit distribution: 10% to collection wallets, 90% reinvested for continued trading');