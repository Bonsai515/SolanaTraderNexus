/**
 * Adjust Profit Collection Interval
 * 
 * This script adjusts the profit collection interval to 4 minutes
 * for more frequent profit capture.
 */

import * as fs from 'fs';
import * as path from 'path';

// Critical paths
const DATA_DIR = './data';
const SYSTEM_MEMORY_PATH = path.join(DATA_DIR, 'system-memory.json');

// Update system memory configuration for profit collection
function updateSystemMemory(): boolean {
  try {
    // Default configuration if file doesn't exist
    let systemMemory: any = {
      features: {},
      config: {}
    };
    
    // Load existing configuration if it exists
    if (fs.existsSync(SYSTEM_MEMORY_PATH)) {
      try {
        systemMemory = JSON.parse(fs.readFileSync(SYSTEM_MEMORY_PATH, 'utf8'));
      } catch (e) {
        console.error('Error parsing system memory:', e);
        // Continue with default config if parsing fails
      }
    }
    
    // Update profit collection config
    if (!systemMemory.config) {
      systemMemory.config = {};
    }
    
    if (!systemMemory.config.profitCollection) {
      systemMemory.config.profitCollection = {};
    }
    
    // Set profit collection interval to 4 minutes
    systemMemory.config.profitCollection = {
      ...(systemMemory.config.profitCollection || {}),
      enabled: true,
      captureIntervalMinutes: 4,
      autoCapture: true,
      minProfitThreshold: 0.01,
      reinvestmentRate: 0.95,
      targetWallet: '31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e'
    };
    
    // Update last updated timestamp
    systemMemory.lastUpdated = new Date().toISOString();
    
    fs.writeFileSync(SYSTEM_MEMORY_PATH, JSON.stringify(systemMemory, null, 2));
    console.log(`Updated system memory at ${SYSTEM_MEMORY_PATH}`);
    return true;
  } catch (error) {
    console.error('Failed to update system memory:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Main function
async function main() {
  console.log('=============================================');
  console.log('⏱️ ADJUSTING PROFIT COLLECTION INTERVAL');
  console.log('=============================================\n');
  
  try {
    console.log('Adjusting profit collection interval to 4 minutes...');
    
    // Update system memory for profit collection
    updateSystemMemory();
    
    console.log('\n✅ PROFIT COLLECTION INTERVAL ADJUSTED');
    console.log('Your trading system will now collect profits every 4 minutes');
    console.log('- 95% of profits will be reinvested for compound growth');
    console.log('- 5% of profits will go to the Prophet wallet');
    console.log('\nRestart the trading system with:');
    console.log('npx tsx server/index.ts');
    console.log('=============================================');
    
    return true;
  } catch (error) {
    console.error('Error adjusting profit collection interval:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Run the script
main();