/**
 * Activate Enhanced Price Feeds
 * 
 * This script activates enhanced price feeds for all trading strategies,
 * prioritizing fast and reliable sources while avoiding rate limits.
 */

import * as fs from 'fs';
import * as path from 'path';

// Configuration Constants
const CONFIG_DIR = './config';
const DATA_DIR = './data';

// Enhanced price feed configurations
interface PriceSource {
  name: string;
  url: string;
  priority: number;
  refreshIntervalMs: number;
}

interface TokenOverride {
  primarySource: string;
  minRefreshIntervalMs: number;
}

interface PriceFeedConfig {
  version: string;
  primarySources: PriceSource[];
  secondarySources: PriceSource[];
  specializedSources?: PriceSource[];
  tokenSpecificOverrides: {
    [key: string]: TokenOverride;
  };
  backupStrategies: {
    failoverEnabled: boolean;
    rotationEnabled: boolean;
    cacheTimeMs: number;
  };
}

/**
 * Setup basic directory structure
 */
function setupDirectories(): void {
  console.log('Setting up directories...');
  
  // Create config directory if it doesn't exist
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  
  // Create data directory if it doesn't exist
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  
  console.log('✅ Directories set up');
}

/**
 * Configure enhanced core price feed
 */
function configureCorePriceFeed(): boolean {
  try {
    console.log('Configuring core price feed...');
    
    const corePriceFeedConfig: PriceFeedConfig = {
      version: '2.1.0',
      primarySources: [
        {
          name: 'Jupiter',
          url: 'https://price.jup.ag/v4',
          priority: 1,
          refreshIntervalMs: 500
        },
        {
          name: 'Birdeye',
          url: 'https://public-api.birdeye.so',
          priority: 2,
          refreshIntervalMs: 750
        },
        {
          name: 'Orca',
          url: 'https://api.orca.so',
          priority: 3,
          refreshIntervalMs: 1000
        }
      ],
      secondarySources: [
        {
          name: 'Pyth',
          url: 'https://api.pyth.network',
          priority: 1,
          refreshIntervalMs: 500
        },
        {
          name: 'Switchboard',
          url: 'https://api.switchboard.xyz',
          priority: 2,
          refreshIntervalMs: 750
        },
        {
          name: 'DexScreener',
          url: 'https://api.dexscreener.com',
          priority: 3,
          refreshIntervalMs: 1500
        }
      ],
      specializedSources: [
        {
          name: 'geyser',
          url: 'https://beta.geyser.gg/api/v1/prices',
          priority: 1,
          refreshIntervalMs: 250
        },
        {
          name: 'SolanaFM',
          url: 'https://api.solana.fm',
          priority: 3,
          refreshIntervalMs: 1500
        }
      ],
      tokenSpecificOverrides: {
        'SOL': {
          primarySource: 'Jupiter',
          minRefreshIntervalMs: 300
        },
        'USDC': {
          primarySource: 'Jupiter',
          minRefreshIntervalMs: 300
        },
        'USDT': {
          primarySource: 'Jupiter',
          minRefreshIntervalMs: 300
        },
        'ETH': {
          primarySource: 'Jupiter',
          minRefreshIntervalMs: 500
        },
        'BTC': {
          primarySource: 'Jupiter',
          minRefreshIntervalMs: 500
        },
        'BONK': {
          primarySource: 'Birdeye',
          minRefreshIntervalMs: 500
        },
        'WIF': {
          primarySource: 'Birdeye',
          minRefreshIntervalMs: 500
        },
        'JUP': {
          primarySource: 'Jupiter',
          minRefreshIntervalMs: 500
        },
        'MEME': {
          primarySource: 'Birdeye',
          minRefreshIntervalMs: 500
        }
      },
      backupStrategies: {
        failoverEnabled: true,
        rotationEnabled: true,
        cacheTimeMs: 30000
      }
    };
    
    // Save core price feed configuration
    const corePriceFeedPath = path.join(CONFIG_DIR, 'core-price-feed.json');
    fs.writeFileSync(corePriceFeedPath, JSON.stringify(corePriceFeedConfig, null, 2));
    console.log(`✅ Core price feed configuration saved to ${corePriceFeedPath}`);
    
    return true;
  } catch (error) {
    console.error('Error configuring core price feed:', error);
    return false;
  }
}

/**
 * Configure Quantum Flash price feed
 */
function configureQuantumFlashPriceFeed(): boolean {
  try {
    console.log('Configuring Quantum Flash price feed...');
    
    const flashPriceFeedConfig: PriceFeedConfig = {
      version: '2.1.0',
      primarySources: [
        {
          name: 'Jupiter',
          url: 'https://price.jup.ag/v4',
          priority: 1,
          refreshIntervalMs: 250 // Ultra-fast for flash loans
        },
        {
          name: 'Birdeye',
          url: 'https://public-api.birdeye.so',
          priority: 2,
          refreshIntervalMs: 500
        },
        {
          name: 'Orca',
          url: 'https://api.orca.so',
          priority: 3,
          refreshIntervalMs: 500
        }
      ],
      secondarySources: [
        {
          name: 'Pyth',
          url: 'https://api.pyth.network',
          priority: 1,
          refreshIntervalMs: 250
        },
        {
          name: 'Switchboard',
          url: 'https://api.switchboard.xyz',
          priority: 2,
          refreshIntervalMs: 500
        }
      ],
      specializedSources: [
        {
          name: 'SolendPrices',
          url: 'https://api.solend.fi/v1/prices',
          priority: 1,
          refreshIntervalMs: 250
        },
        {
          name: 'RaydiumSnapshot',
          url: 'https://api.raydium.io/v2/main/pool',
          priority: 1,
          refreshIntervalMs: 500
        }
      ],
      tokenSpecificOverrides: {
        'SOL': {
          primarySource: 'Jupiter',
          minRefreshIntervalMs: 200
        },
        'USDC': {
          primarySource: 'Jupiter',
          minRefreshIntervalMs: 200
        },
        'USDT': {
          primarySource: 'Jupiter',
          minRefreshIntervalMs: 200
        },
        'ETH': {
          primarySource: 'Jupiter',
          minRefreshIntervalMs: 250
        },
        'BTC': {
          primarySource: 'Jupiter',
          minRefreshIntervalMs: 250
        },
        'BONK': {
          primarySource: 'Jupiter',
          minRefreshIntervalMs: 300
        },
        'JUP': {
          primarySource: 'Jupiter',
          minRefreshIntervalMs: 300
        }
      },
      backupStrategies: {
        failoverEnabled: true,
        rotationEnabled: true,
        cacheTimeMs: 10000 // Short cache time for flash loans
      }
    };
    
    // Save Quantum Flash price feed configuration
    const flashPriceFeedPath = path.join(CONFIG_DIR, 'quantum-flash-price-feed.json');
    fs.writeFileSync(flashPriceFeedPath, JSON.stringify(flashPriceFeedConfig, null, 2));
    console.log(`✅ Quantum Flash price feed configuration saved to ${flashPriceFeedPath}`);
    
    return true;
  } catch (error) {
    console.error('Error configuring Quantum Flash price feed:', error);
    return false;
  }
}

/**
 * Configure meme token price feed (Quantum Omega)
 */
function configureMemeTokenPriceFeed(): boolean {
  try {
    console.log('Configuring meme token price feed for Quantum Omega...');
    
    const memePriceFeedConfig: PriceFeedConfig = {
      version: '2.1.0',
      primarySources: [
        {
          name: 'Birdeye',
          url: 'https://public-api.birdeye.so',
          priority: 1,
          refreshIntervalMs: 1000
        },
        {
          name: 'Jupiter',
          url: 'https://price.jup.ag/v4',
          priority: 2,
          refreshIntervalMs: 1500
        },
        {
          name: 'DexScreener',
          url: 'https://api.dexscreener.com',
          priority: 3,
          refreshIntervalMs: 2000
        }
      ],
      secondarySources: [
        {
          name: 'SolScan',
          url: 'https://api.solscan.io',
          priority: 1,
          refreshIntervalMs: 3000
        },
        {
          name: 'SolanaFM',
          url: 'https://api.solana.fm',
          priority: 2,
          refreshIntervalMs: 3000
        }
      ],
      specializedSources: [
        {
          name: 'pumpfun',
          url: 'https://api.pump.fun',
          priority: 1,
          refreshIntervalMs: 1000
        },
        {
          name: 'gmgn',
          url: 'https://api.gmgn.ai',
          priority: 2,
          refreshIntervalMs: 1500
        },
        {
          name: 'proton',
          url: 'https://protonai.xyz/api',
          priority: 3,
          refreshIntervalMs: 2000
        }
      ],
      tokenSpecificOverrides: {
        'BONK': {
          primarySource: 'Birdeye',
          minRefreshIntervalMs: 500
        },
        'WIF': {
          primarySource: 'Birdeye',
          minRefreshIntervalMs: 500
        },
        'MEME': {
          primarySource: 'Birdeye',
          minRefreshIntervalMs: 500
        },
        'CAT': {
          primarySource: 'pumpfun',
          minRefreshIntervalMs: 750
        },
        'PNUT': {
          primarySource: 'pumpfun',
          minRefreshIntervalMs: 750
        }
      },
      backupStrategies: {
        failoverEnabled: true,
        rotationEnabled: true,
        cacheTimeMs: 20000
      }
    };
    
    // Save meme token price feed configuration
    const memePriceFeedPath = path.join(CONFIG_DIR, 'meme-token-price-feed.json');
    fs.writeFileSync(memePriceFeedPath, JSON.stringify(memePriceFeedConfig, null, 2));
    console.log(`✅ Meme token price feed configuration saved to ${memePriceFeedPath}`);
    
    return true;
  } catch (error) {
    console.error('Error configuring meme token price feed:', error);
    return false;
  }
}

/**
 * Configure Hyperion neural price feed
 */
function configureHyperionPriceFeed(): boolean {
  try {
    console.log('Configuring Hyperion neural price feed...');
    
    const hyperionPriceFeedConfig: PriceFeedConfig = {
      version: '2.1.0',
      primarySources: [
        {
          name: 'Jupiter',
          url: 'https://price.jup.ag/v4',
          priority: 1,
          refreshIntervalMs: 250
        },
        {
          name: 'Birdeye',
          url: 'https://public-api.birdeye.so',
          priority: 2,
          refreshIntervalMs: 500
        },
        {
          name: 'Orca',
          url: 'https://api.orca.so',
          priority: 3,
          refreshIntervalMs: 750
        }
      ],
      secondarySources: [
        {
          name: 'Pyth',
          url: 'https://api.pyth.network',
          priority: 1,
          refreshIntervalMs: 250
        },
        {
          name: 'Switchboard',
          url: 'https://api.switchboard.xyz',
          priority: 2,
          refreshIntervalMs: 500
        },
        {
          name: 'DexScreener',
          url: 'https://api.dexscreener.com',
          priority: 3,
          refreshIntervalMs: 1000
        }
      ],
      specializedSources: [
        {
          name: 'geyser',
          url: 'https://beta.geyser.gg/api/v1/prices',
          priority: 1,
          refreshIntervalMs: 250
        },
        {
          name: 'SolanaFM',
          url: 'https://api.solana.fm',
          priority: 2,
          refreshIntervalMs: 1000
        }
      ],
      tokenSpecificOverrides: {
        'SOL': {
          primarySource: 'Jupiter',
          minRefreshIntervalMs: 200
        },
        'USDC': {
          primarySource: 'Jupiter',
          minRefreshIntervalMs: 200
        },
        'USDT': {
          primarySource: 'Jupiter',
          minRefreshIntervalMs: 200
        },
        'ETH': {
          primarySource: 'Jupiter',
          minRefreshIntervalMs: 250
        },
        'BTC': {
          primarySource: 'Jupiter',
          minRefreshIntervalMs: 250
        },
        'JUP': {
          primarySource: 'Jupiter',
          minRefreshIntervalMs: 300
        }
      },
      backupStrategies: {
        failoverEnabled: true,
        rotationEnabled: true,
        cacheTimeMs: 10000
      }
    };
    
    // Save Hyperion price feed configuration
    const hyperionPriceFeedPath = path.join(CONFIG_DIR, 'hyperion-neural-price-feed.json');
    fs.writeFileSync(hyperionPriceFeedPath, JSON.stringify(hyperionPriceFeedConfig, null, 2));
    console.log(`✅ Hyperion neural price feed configuration saved to ${hyperionPriceFeedPath}`);
    
    return true;
  } catch (error) {
    console.error('Error configuring Hyperion neural price feed:', error);
    return false;
  }
}

/**
 * Configure price feed registry
 */
function configurePriceFeedRegistry(): boolean {
  try {
    console.log('Configuring price feed registry...');
    
    const priceFeedRegistry = {
      version: '2.1.0',
      strategyMappings: {
        'quantum-flash': 'quantum-flash-price-feed.json',
        'quantum-omega': 'meme-token-price-feed.json',
        'zero-capital': 'quantum-flash-price-feed.json', // Zero capital uses same feed as quantum flash
        'hyperion': 'hyperion-neural-price-feed.json',
        'default': 'core-price-feed.json'
      },
      cachePolicy: {
        enabled: true,
        defaultTtlMs: 20000,
        strategySpecificTtl: {
          'quantum-flash': 5000,
          'quantum-omega': 30000,
          'zero-capital': 5000,
          'hyperion': 10000
        }
      },
      rateLimitPolicy: {
        enabled: true,
        defaultRequestsPerMinute: 60,
        sourceSpecificLimits: {
          'Jupiter': 120,
          'Birdeye': 100,
          'Pyth': 150,
          'geyser': 200,
          'pumpfun': 30,
          'gmgn': 30,
          'proton': 30
        }
      },
      failoverPolicy: {
        enabled: true,
        maxFailuresBeforeSwitch: 3,
        blacklistTimeMs: 120000,
        rotationIntervalMs: 300000
      }
    };
    
    // Save price feed registry
    const registryPath = path.join(CONFIG_DIR, 'price-feed-registry.json');
    fs.writeFileSync(registryPath, JSON.stringify(priceFeedRegistry, null, 2));
    console.log(`✅ Price feed registry saved to ${registryPath}`);
    
    return true;
  } catch (error) {
    console.error('Error configuring price feed registry:', error);
    return false;
  }
}

/**
 * Update system memory to use enhanced price feeds
 */
function updateSystemMemory(): boolean {
  try {
    console.log('Updating system memory to use enhanced price feeds...');
    
    // Create system memory directory if it doesn't exist
    const systemMemoryDir = path.join(DATA_DIR, 'system-memory');
    if (!fs.existsSync(systemMemoryDir)) {
      fs.mkdirSync(systemMemoryDir, { recursive: true });
    }
    
    // Read current system memory if it exists
    let systemMemory: any = {};
    const systemMemoryPath = path.join(systemMemoryDir, 'system-memory.json');
    
    if (fs.existsSync(systemMemoryPath)) {
      try {
        const systemMemoryData = fs.readFileSync(systemMemoryPath, 'utf-8');
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
      registryPath: 'config/price-feed-registry.json',
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
    fs.writeFileSync(systemMemoryPath, JSON.stringify(systemMemory, null, 2));
    console.log(`✅ System memory updated to use enhanced price feeds at ${systemMemoryPath}`);
    
    return true;
  } catch (error) {
    console.error('Error updating system memory:', error);
    return false;
  }
}

/**
 * Main function to activate enhanced price feeds
 */
function activateEnhancedPriceFeeds(): void {
  console.log('\n=======================================================');
  console.log('🚀 ACTIVATING ENHANCED PRICE FEEDS');
  console.log('=======================================================');
  
  try {
    // Setup directories
    setupDirectories();
    
    // Configure price feeds
    configureCorePriceFeed();
    configureQuantumFlashPriceFeed();
    configureMemeTokenPriceFeed();
    configureHyperionPriceFeed();
    
    // Configure price feed registry
    configurePriceFeedRegistry();
    
    // Update system memory
    updateSystemMemory();
    
    console.log('\n✅ Enhanced price feeds activated successfully!');
    console.log('\nAll trading strategies will now use the enhanced price feeds');
    console.log('This eliminates CoinGecko rate limiting issues and provides faster updates');
    console.log('\n=======================================================');
  } catch (error) {
    console.error('\n❌ Error activating enhanced price feeds:', error);
    console.error('\nPlease try again or check the error logs for details.');
    console.log('\n=======================================================');
  }
}

// Execute the activation
activateEnhancedPriceFeeds();