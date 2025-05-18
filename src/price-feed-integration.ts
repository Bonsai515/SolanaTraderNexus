/**
 * Price Feed Integration
 * 
 * This module integrates the enhanced price feed with the trading strategies.
 */

import fs from 'fs';
import path from 'path';
import {
  getTokenPrice,
  getMultipleTokenPrices,
  getCachedSolPrice,
  getSupportedTokens,
  startPriceMonitor
} from './price-feed';

// Configuration paths
const CONFIG_DIR = './config';
const STRATEGIES_CONFIG_PATH = path.join(CONFIG_DIR, 'strategies-price-feed.json');
const SYSTEM_MEMORY_DIR = path.join('./data', 'system-memory');
const SYSTEM_MEMORY_PATH = path.join(SYSTEM_MEMORY_DIR, 'system-memory.json');

// Ensure directories exist
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

if (!fs.existsSync(SYSTEM_MEMORY_DIR)) {
  fs.mkdirSync(SYSTEM_MEMORY_DIR, { recursive: true });
}

/**
 * Configure price feed integration with trading strategies
 */
function configurePriceFeedIntegration(): boolean {
  try {
    console.log('Configuring price feed integration with trading strategies...');
    
    // Create strategies price feed configuration
    const strategiesConfig = {
      version: '1.0.0',
      strategies: {
        'quantum-flash': {
          enabled: true,
          tokens: ['SOL', 'USDC', 'USDT', 'ETH', 'BTC', 'JUP', 'BONK', 'WIF'],
          refreshIntervalMs: 1000, // Fast refresh for flash loans
          useCaching: true,
          requireMultipleSources: true,
          minSources: 2
        },
        'quantum-omega': {
          enabled: true,
          tokens: ['SOL', 'USDC', 'BONK', 'WIF', 'MEME', 'CAT', 'PNUT'],
          refreshIntervalMs: 2000, // Slower refresh for meme token strategy
          useCaching: true,
          requireMultipleSources: true,
          minSources: 2
        },
        'zero-capital': {
          enabled: true,
          tokens: ['SOL', 'USDC', 'USDT', 'ETH', 'BTC', 'JUP'],
          refreshIntervalMs: 1000, // Fast refresh for zero capital strategy
          useCaching: true,
          requireMultipleSources: true,
          minSources: 2
        },
        'hyperion': {
          enabled: true,
          tokens: ['SOL', 'USDC', 'USDT', 'ETH', 'BTC', 'JUP', 'BONK', 'WIF'],
          refreshIntervalMs: 500, // Fastest refresh for neural strategy
          useCaching: true,
          requireMultipleSources: true,
          minSources: 2
        }
      },
      alertThresholds: {
        priceChange: {
          major: 5.0,  // 5% price change alert
          critical: 10.0 // 10% price change alert
        },
        sourceFailure: {
          warning: 0.2, // 20% failure rate
          critical: 0.5 // 50% failure rate
        },
        latency: {
          warning: 1000, // 1000ms warning
          critical: 3000 // 3000ms critical
        }
      }
    };
    
    // Write strategies configuration to file
    fs.writeFileSync(
      STRATEGIES_CONFIG_PATH,
      JSON.stringify(strategiesConfig, null, 2)
    );
    
    console.log(`✅ Strategies price feed configuration saved to ${STRATEGIES_CONFIG_PATH}`);
    
    return true;
  } catch (error) {
    console.error('Error configuring price feed integration:', error);
    return false;
  }
}

/**
 * Update system memory to use enhanced price feed
 */
function updateSystemMemory(): boolean {
  try {
    console.log('Updating system memory to use enhanced price feed...');
    
    // Read current system memory if it exists
    let systemMemory: any = {};
    
    if (fs.existsSync(SYSTEM_MEMORY_PATH)) {
      try {
        const systemMemoryData = fs.readFileSync(SYSTEM_MEMORY_PATH, 'utf-8');
        systemMemory = JSON.parse(systemMemoryData);
      } catch (error) {
        console.warn('Error reading system memory, creating new one:', error);
      }
    }
    
    // Update price feed configuration in system memory
    systemMemory.priceFeed = {
      ...systemMemory.priceFeed,
      useCoinGecko: false,
      useEnhancedFeeds: true,
      useJupiter: true,
      useBirdeye: true,
      usePyth: true,
      registryPath: './config/price-feed-registry.json',
      lastUpdated: new Date().toISOString()
    };
    
    // Make sure features object exists
    if (!systemMemory.features) {
      systemMemory.features = {};
    }
    
    // Update features
    systemMemory.features.enhancedPriceFeeds = true;
    systemMemory.features.coinGecko = false;
    
    // Save updated system memory
    fs.writeFileSync(SYSTEM_MEMORY_PATH, JSON.stringify(systemMemory, null, 2));
    
    console.log(`✅ System memory updated to use enhanced price feed at ${SYSTEM_MEMORY_PATH}`);
    
    return true;
  } catch (error) {
    console.error('Error updating system memory:', error);
    return false;
  }
}

/**
 * Create price feed injection for trading strategies
 */
function createStrategyInjection(): boolean {
  try {
    console.log('Creating price feed injection for trading strategies...');
    
    // Create the integration directory if it doesn't exist
    const integrationDir = path.join('./server', 'integrations');
    if (!fs.existsSync(integrationDir)) {
      fs.mkdirSync(integrationDir, { recursive: true });
    }
    
    // Create the integration file content
    const integrationCode = `/**
 * Enhanced Price Feed Integration for Trading Strategies
 * Auto-generated - DO NOT MODIFY DIRECTLY
 */

import {
  getTokenPrice,
  getMultipleTokenPrices,
  getCachedSolPrice,
  getSupportedTokens
} from '../../src/price-feed';

/**
 * Get price for a token with strategy-specific options
 */
async function getTokenPriceForStrategy(token: string, strategy: string): Promise<number> {
  // Strategy-specific logic can be added here
  return getTokenPrice(token);
}

/**
 * Get multiple token prices for a strategy
 */
async function getTokenPricesForStrategy(tokens: string[], strategy: string): Promise<Record<string, number>> {
  // Strategy-specific logic can be added here
  return getMultipleTokenPrices(tokens);
}

/**
 * Interface for price feed service
 */
const enhancedPriceFeedService = {
  // Core price methods
  getTokenPrice,
  getMultipleTokenPrices,
  getCachedSolPrice,
  getSupportedTokens,
  
  // Strategy-specific methods
  getTokenPriceForStrategy,
  getTokenPricesForStrategy,
  
  // Convenience methods for strategies
  getSolPrice: getCachedSolPrice,
  
  // Strategy-specific convenience methods
  getQuantumFlashPrice: (token: string) => getTokenPriceForStrategy(token, 'quantum-flash'),
  getQuantumOmegaPrice: (token: string) => getTokenPriceForStrategy(token, 'quantum-omega'),
  getZeroCapitalPrice: (token: string) => getTokenPriceForStrategy(token, 'zero-capital'),
  getHyperionPrice: (token: string) => getTokenPriceForStrategy(token, 'hyperion')
};

export default enhancedPriceFeedService;
`;
    
    // Write the integration file
    const integrationPath = path.join(integrationDir, 'enhanced-price-feed.ts');
    fs.writeFileSync(integrationPath, integrationCode);
    
    console.log(`✅ Strategy integration module created at ${integrationPath}`);
    
    return true;
  } catch (error) {
    console.error('Error creating strategy integration:', error);
    return false;
  }
}

/**
 * Create system README for the price feed
 */
function createPriceFeedReadme(): boolean {
  try {
    console.log('Creating README for the price feed...');
    
    const readmeContent = `# Enhanced Price Feed System

## Overview
The Enhanced Price Feed System provides reliable, fast, and accurate price data for all trading strategies. It's designed to avoid rate limits by using multiple price sources with smart caching.

## Key Features
- **Multiple Price Sources**: Jupiter, Birdeye, Pyth, and Helius DEX pools
- **Smart Caching**: 5-second TTL cache to stay under API rate limits
- **Advanced Monitoring**: Track success rates, latency, and other key metrics
- **Dashboard**: Visual interface for monitoring price data quality

## Available Endpoints
- GET /api/tokens - List all supported tokens
- GET /api/price/:token - Get price for a specific token
- POST /api/prices - Get multiple token prices
- GET /api/metrics/sources - Source metrics
- GET /api/metrics/prices - Price metrics history
- GET /api/dashboard - Dashboard data
- GET /health - Health check endpoint

## Integration with Trading Strategies
All trading strategies now use this enhanced price feed system:
- Quantum Flash Loan strategy
- Quantum Omega Meme Token strategy
- Zero Capital Flash Loan strategy
- Hyperion Neural Flash strategy

## Monitoring
The system provides detailed monitoring:
- Source success rates and latency
- Cache hit/miss rates
- Price update history
- System resource usage

## Dashboard
Access the dashboard at: http://localhost:3030/
`;
    
    // Write the README
    const readmePath = path.join('./docs', 'PRICE-FEED.md');
    
    // Create docs directory if it doesn't exist
    const docsDir = path.join('./docs');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }
    
    fs.writeFileSync(readmePath, readmeContent);
    
    console.log(`✅ Price feed README created at ${readmePath}`);
    
    return true;
  } catch (error) {
    console.error('Error creating price feed README:', error);
    return false;
  }
}

/**
 * Main function to integrate price feed with strategies
 */
async function integratePriceFeed(): Promise<void> {
  console.log('\n=======================================================');
  console.log('🚀 INTEGRATING ENHANCED PRICE FEED WITH TRADING STRATEGIES');
  console.log('=======================================================');
  
  try {
    // Configure price feed integration
    const configResult = configurePriceFeedIntegration();
    
    // Update system memory
    const memoryResult = updateSystemMemory();
    
    // Create strategy injection
    const injectionResult = createStrategyInjection();
    
    // Create README
    const readmeResult = createPriceFeedReadme();
    
    if (configResult && memoryResult && injectionResult && readmeResult) {
      console.log('\n✅ Price feed successfully integrated with trading strategies!');
      console.log('\nThe enhanced price feed is now available to all trading strategies:');
      console.log('1. Quantum Flash Loan strategy');
      console.log('2. Quantum Omega Meme Token strategy');
      console.log('3. Zero Capital Flash Loan strategy');
      console.log('4. Hyperion Neural Flash strategy');
      
      console.log('\nTo monitor the price feed:');
      console.log('- Start the price feed server: npx tsx src/price-feed-server.ts');
      console.log('- Access the dashboard at: http://localhost:3030/');
      console.log('\n=======================================================');
    } else {
      console.error('\n❌ Error integrating price feed with strategies.');
      console.log('\n=======================================================');
    }
  } catch (error) {
    console.error('\n❌ Error integrating price feed:', error);
    console.log('\n=======================================================');
  }
}

// Export integration functions
export {
  configurePriceFeedIntegration,
  updateSystemMemory,
  createStrategyInjection,
  createPriceFeedReadme,
  integratePriceFeed
};

// Auto-execute if run directly
if (require.main === module) {
  integratePriceFeed().catch(error => {
    console.error('Error running price feed integration:', error);
  });
}