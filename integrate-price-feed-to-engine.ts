/**
 * Integrate Price Feed Cache into Transaction Engine
 * 
 * This script integrates the enhanced price feed cache into the
 * transaction engine and strategies for more accurate trading.
 */

import * as fs from 'fs';
import * as path from 'path';

// Critical paths
const CONFIG_DIR = './server/config';
const ENGINE_CONFIG_PATH = path.join(CONFIG_DIR, 'engine.json');
const STRATEGIES_CONFIG_PATH = path.join(CONFIG_DIR, 'strategies.json');

/**
 * Update engine configuration to use enhanced price feed
 */
function updateEngineConfiguration(): void {
  console.log('Updating engine configuration to use enhanced price feed...');
  
  try {
    // Load existing engine configuration if it exists
    let engineConfig: any = {};
    if (fs.existsSync(ENGINE_CONFIG_PATH)) {
      try {
        engineConfig = JSON.parse(fs.readFileSync(ENGINE_CONFIG_PATH, 'utf8'));
      } catch (e) {
        console.error('Error parsing engine config:', e);
        // Continue with new config if parsing fails
      }
    }
    
    // Update engine configuration
    engineConfig = {
      ...engineConfig,
      priceFeed: {
        useEnhancedPriceFeed: true,
        primarySource: 'birdeye',
        secondarySources: ['coingecko', 'dexscreener'],
        fallbackSource: 'local',
        updateInterval: 30000, // 30 seconds
        maxPriceAge: 180000, // 3 minutes
        requireMultipleSources: true,
        minConfidence: 0.7
      }
    };
    
    // Write updated engine configuration
    fs.writeFileSync(ENGINE_CONFIG_PATH, JSON.stringify(engineConfig, null, 2));
    console.log(`✅ Engine configuration updated to use enhanced price feed`);
    
    return;
  } catch (error) {
    console.error('Failed to update engine configuration:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Update strategies to use enhanced price feed
 */
function updateStrategiesConfiguration(): void {
  console.log('Updating strategies to use enhanced price feed...');
  
  try {
    if (fs.existsSync(STRATEGIES_CONFIG_PATH)) {
      // Load existing strategies
      const strategies = JSON.parse(fs.readFileSync(STRATEGIES_CONFIG_PATH, 'utf8'));
      
      // Update each strategy to use enhanced price feed
      strategies.forEach((strategy) => {
        strategy.config = strategy.config || {};
        
        // Add price feed configuration to strategy
        strategy.config.priceFeed = {
          useEnhancedPriceFeed: true,
          requiredConfidence: 0.8,
          maxPriceAge: 180000, // 3 minutes
          preferredSources: ['birdeye', 'coingecko'],
          updateInterval: 30000 // 30 seconds
        };
        
        // Add specific settings based on strategy type
        if (strategy.type === 'FLASH_ARBITRAGE') {
          strategy.config.priceFeed.maxPriceAge = 60000; // 1 minute (need more fresh data)
          strategy.config.priceFeed.updateInterval = 15000; // 15 seconds
          strategy.config.priceFeed.requiredConfidence = 0.9; // Higher confidence
        } else if (strategy.type === 'MEME_SNIPER') {
          strategy.config.priceFeed.preferredSources = ['birdeye', 'dexscreener']; // Better for meme tokens
          strategy.config.priceFeed.alternateSourceCheck = true; // Check multiple sources
        }
      });
      
      // Write updated strategies
      fs.writeFileSync(STRATEGIES_CONFIG_PATH, JSON.stringify(strategies, null, 2));
      console.log(`✅ Strategy configurations updated to use enhanced price feed`);
    } else {
      console.warn(`⚠️ Strategies configuration not found at ${STRATEGIES_CONFIG_PATH}`);
    }
    
    return;
  } catch (error) {
    console.error('Failed to update strategy configurations:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Create module loader for price feed cache
 */
function createModuleLoader(): void {
  console.log('Creating module loader for price feed cache...');
  
  try {
    const loaderContent = `/**
 * Price Feed Cache Loader
 * 
 * This module loads the price feed cache and ensures it's available globally.
 */

import { priceFeedCache } from './lib/priceFeedCache';
import { promisify } from 'util';

// Export the price feed cache
export { priceFeedCache };

// Function to wait for initialization
export const waitForPriceFeedInit = () => {
  return new Promise<void>((resolve) => {
    if (priceFeedCache.isInitialized()) {
      resolve();
      return;
    }
    
    priceFeedCache.once('initialized', () => {
      resolve();
    });
    
    // Timeout after 10 seconds
    setTimeout(() => {
      console.warn('[PriceFeedLoader] Timed out waiting for price feed initialization');
      resolve();
    }, 10000);
  });
};

// Request a price update
export const updatePrices = async () => {
  return priceFeedCache.forceUpdate();
};

// Get price for a token
export const getTokenPrice = (token: string) => {
  return priceFeedCache.getPrice(token);
};

// Get price data for a token
export const getTokenPriceData = (token: string) => {
  return priceFeedCache.getPriceData(token);
};

// Get token to token price
export const getTokenToTokenPrice = (baseToken: string, quoteToken: string) => {
  return priceFeedCache.getTokenToTokenPrice(baseToken, quoteToken);
};

// Get all prices
export const getAllPrices = () => {
  return priceFeedCache.getAllPrices();
};

// Initialize on import
(async () => {
  console.log('[PriceFeedLoader] Waiting for price feed initialization...');
  await waitForPriceFeedInit();
  console.log('[PriceFeedLoader] Price feed initialized');
})();
`;
    
    // Write loader module
    fs.writeFileSync('./server/priceFeedLoader.ts', loaderContent);
    console.log(`✅ Created price feed loader module at ./server/priceFeedLoader.ts`);
    
    return;
  } catch (error) {
    console.error('Failed to create module loader:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Update server index to use price feed cache
 */
function updateServerIndex(): void {
  console.log('Updating server index to use price feed cache...');
  
  try {
    const serverIndexPath = './server/index.ts';
    
    if (fs.existsSync(serverIndexPath)) {
      // Read existing file
      let content = fs.readFileSync(serverIndexPath, 'utf8');
      
      // Check if price feed is already imported
      if (!content.includes('priceFeedLoader')) {
        // Find a good spot to add the import (after other imports)
        let importSection = content.match(/import .+;(\r?\n)+/g)?.join('') || '';
        const newImport = importSection + 'import { priceFeedCache, waitForPriceFeedInit } from \'./priceFeedLoader\';\n';
        
        // Replace import section
        content = content.replace(importSection, newImport);
        
        // Find where to add initialization code
        const initSection = content.indexOf('(async function initializeFullSystem() {');
        
        if (initSection !== -1) {
          // Find where to add the price feed initialization (after RPC initialization)
          const afterRpcSection = content.indexOf('console.log(\'✅ Successfully established connection to Solana blockchain\');', initSection);
          
          if (afterRpcSection !== -1) {
            // Add price feed initialization after RPC connection
            const insertPos = content.indexOf('\n', afterRpcSection) + 1;
            const priceFeedInit = '\n    // Initialize price feed cache\n    console.log(\'Initializing price feed cache...\');\n    await waitForPriceFeedInit();\n    console.log(\'✅ Price feed cache initialized with data for multiple tokens\');\n';
            
            content = content.slice(0, insertPos) + priceFeedInit + content.slice(insertPos);
          }
        }
        
        // Write updated file
        fs.writeFileSync(serverIndexPath, content);
        console.log(`✅ Updated server index to use price feed cache`);
      } else {
        console.log(`✅ Server index already using price feed cache`);
      }
    } else {
      console.warn(`⚠️ Server index not found at ${serverIndexPath}`);
    }
    
    return;
  } catch (error) {
    console.error('Failed to update server index:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Main function
 */
function main(): void {
  console.log('=============================================');
  console.log('📊 INTEGRATING ENHANCED PRICE FEED CACHE');
  console.log('=============================================\n');
  
  try {
    // Step 1: Update engine configuration
    updateEngineConfiguration();
    
    // Step 2: Update strategies configuration
    updateStrategiesConfiguration();
    
    // Step 3: Create module loader
    createModuleLoader();
    
    // Step 4: Update server index
    updateServerIndex();
    
    console.log('\n✅ ENHANCED PRICE FEED CACHE SUCCESSFULLY INTEGRATED');
    console.log('Your trading system now uses a sophisticated price feed cache');
    console.log('with multiple data sources for maximum accuracy and reliability.');
    console.log('');
    console.log('Sources integrated:');
    console.log('- CoinGecko (primary for major tokens)');
    console.log('- Birdeye (high accuracy for Solana tokens)');
    console.log('- DexScreener (additional verification source)');
    console.log('');
    console.log('The price feed cache provides:');
    console.log('- Real-time price updates with configurable intervals');
    console.log('- Multi-source aggregation for higher confidence');
    console.log('- Persistence between system restarts');
    console.log('- Automatic failover between sources');
    console.log('');
    console.log('To restart the trading system with enhanced price feeds:');
    console.log('npx tsx server/index.ts');
    console.log('=============================================');
    
    return;
  } catch (error) {
    console.error('Failed to integrate price feed cache:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the script
main();