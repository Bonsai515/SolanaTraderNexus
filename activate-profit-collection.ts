/**
 * Activate Profit Collection System
 * 
 * This script activates the profit collection system and configures profit capture.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as logger from './server/logger';

// Define interfaces for type safety
interface ProfitWallet {
  address: string;
  label: string;
  profitShare: number;
}

interface ReinvestmentConfig {
  enabled: boolean;
  rate: number;
  targetWallet: string;
}

interface ProfitConfig {
  enabled: boolean;
  captureIntervalMinutes: number;
  lastCaptureTime: string;
  totalProfitCollected: number;
  wallets: ProfitWallet[];
  reinvestment: ReinvestmentConfig;
}

interface ProfitLogEntry {
  timestamp: string;
  amount: number;
  sourceWallet: string;
  destinationWallet: string;
  transactionSignature?: string;
}

interface ProfitLog {
  totalProfit: number;
  lastUpdated: string;
  profitHistory: ProfitLogEntry[];
}

interface SystemMemoryConfig {
  profitCollection: {
    enabled: boolean;
    captureIntervalMinutes: number;
    autoCapture: boolean;
    minProfitThreshold: number;
    reinvestmentRate: number;
    targetWallet: string;
  };
}

interface SystemMemory {
  features?: {
    profitCollection?: boolean;
  };
  config?: SystemMemoryConfig;
}

// Paths
const systemMemoryPath = path.join(__dirname, 'data', 'system_memory.json');
const profitConfigPath = path.join(__dirname, 'data', 'profit_config.json');
const profitLogPath = path.join(__dirname, 'logs', 'profit.json');

/**
 * Update system memory with profit collection settings
 */
function updateSystemMemory(): void {
  // Read and update system memory
  let systemMemory: SystemMemory = {};
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
}

/**
 * Create profit configuration
 */
function createProfitConfig(): void {
  // Create profit configuration file
  const profitConfig: ProfitConfig = {
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

  // Write profit configuration
  fs.writeFileSync(profitConfigPath, JSON.stringify(profitConfig, null, 2));
  console.log('✅ Profit collection configuration created');
}

/**
 * Initialize profit logs
 */
function initializeProfitLogs(): void {
  // Create profit logs directory if it doesn't exist
  const profitLogsDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(profitLogsDir)) {
    fs.mkdirSync(profitLogsDir, { recursive: true });
  }

  // Create empty profit log file if it doesn't exist
  if (!fs.existsSync(profitLogPath)) {
    const initialProfitLog: ProfitLog = {
      totalProfit: 0,
      lastUpdated: new Date().toISOString(),
      profitHistory: []
    };
    
    fs.writeFileSync(profitLogPath, JSON.stringify(initialProfitLog, null, 2));
    console.log('✅ Profit log file initialized');
  }
}

/**
 * Main function to activate profit collection
 */
function activateProfitCollection(): void {
  console.log('======================================================');
  console.log('  ACTIVATING PROFIT COLLECTION SYSTEM');
  console.log('======================================================');
  
  try {
    updateSystemMemory();
    createProfitConfig();
    initializeProfitLogs();
    
    console.log('✅ Profit collection system is now ACTIVE');
    console.log('The system will automatically collect profits every 30 minutes');
    console.log('Profit distribution: 10% to collection wallets, 90% reinvested for continued trading');
  } catch (error) {
    console.error('❌ Error activating profit collection:', error instanceof Error ? error.message : String(error));
  }
}

// Execute the activation
activateProfitCollection();