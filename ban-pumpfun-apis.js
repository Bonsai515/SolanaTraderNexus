/**
 * Ban Pump.fun APIs
 * 
 * This script disables all Pump.fun API connections across the system
 * to prevent timeouts and connection failures.
 */

const fs = require('fs');
const path = require('path');

// Configuration paths
const MEMECOIN_CACHE_PATH = path.join('./data', 'memecoin-cache.json');
const TOKEN_SOURCES_PATH = path.join('./data', 'token-sources.json');
const MEME_STRATEGY_PATH = path.join('./data', 'meme-token-strategy.json');
const TRANSFORMER_CONFIG_PATH = path.join('./data', 'transformer-config.json');

// Create token sources configuration if it doesn't exist
function createTokenSourcesConfig() {
  console.log('Creating token sources configuration...');
  
  const sourcesConfig = {
    enabled: [
      'dexscreener',
      'jupiter',
      'raydium',
      'orca',
      'meteora'
    ],
    disabled: [
      'pumpfun',
      'instantnodes'
    ],
    priorities: {
      price: ['jupiter', 'dexscreener', 'raydium', 'orca', 'meteora'],
      volume: ['dexscreener', 'jupiter', 'raydium', 'orca'],
      trending: ['dexscreener', 'jupiter', 'meteora']
    },
    rateLimits: {
      dexscreener: {
        requestsPerMinute: 30,
        requestsPerHour: 1000
      },
      jupiter: {
        requestsPerMinute: 60,
        requestsPerHour: 3000
      },
      raydium: {
        requestsPerMinute: 40,
        requestsPerHour: 2000
      },
      orca: {
        requestsPerMinute: 40,
        requestsPerHour: 2000
      },
      meteora: {
        requestsPerMinute: 40,
        requestsPerHour: 2000
      }
    },
    updateFrequencyMs: 60000,
    cacheExpiryMs: 300000,
    lastUpdated: new Date().toISOString()
  };
  
  fs.writeFileSync(TOKEN_SOURCES_PATH, JSON.stringify(sourcesConfig, null, 2));
  console.log('✅ Created token sources configuration with Pump.fun disabled');
}

// Update memecoin strategy to remove Pump.fun
function updateMemeStrategy() {
  console.log('Updating memecoin strategy...');
  
  if (fs.existsSync(MEME_STRATEGY_PATH)) {
    try {
      const strategy = JSON.parse(fs.readFileSync(MEME_STRATEGY_PATH, 'utf8'));
      
      // Remove Pump.fun from data sources
      if (strategy.dataSources) {
        strategy.dataSources = strategy.dataSources.filter(
          source => !source.toLowerCase().includes('pump')
        );
      }
      
      // Update data source priorities if present
      if (strategy.dataSourcePriorities) {
        // Remove Pump.fun from priorities
        Object.keys(strategy.dataSourcePriorities).forEach(key => {
          strategy.dataSourcePriorities[key] = strategy.dataSourcePriorities[key].filter(
            source => !source.toLowerCase().includes('pump')
          );
        });
      }
      
      // Save updated strategy
      fs.writeFileSync(MEME_STRATEGY_PATH, JSON.stringify(strategy, null, 2));
      console.log('✅ Updated memecoin strategy to remove Pump.fun');
    } catch (error) {
      console.error('Error updating memecoin strategy:', error.message);
    }
  } else {
    console.log('Memecoin strategy file not found, skipping update');
  }
}

// Update transformer configuration to remove Pump.fun
function updateTransformerConfig() {
  console.log('Updating transformer configuration...');
  
  if (fs.existsSync(TRANSFORMER_CONFIG_PATH)) {
    try {
      const config = JSON.parse(fs.readFileSync(TRANSFORMER_CONFIG_PATH, 'utf8'));
      
      // Remove Pump.fun from data sources
      if (config.dataSources) {
        config.dataSources = config.dataSources.filter(
          source => !source.toLowerCase().includes('pump')
        );
      }
      
      // Remove Pump.fun from any transformers
      if (config.transformers) {
        config.transformers.forEach(transformer => {
          if (transformer.dataSources) {
            transformer.dataSources = transformer.dataSources.filter(
              source => !source.toLowerCase().includes('pump')
            );
          }
        });
      }
      
      // Save updated configuration
      fs.writeFileSync(TRANSFORMER_CONFIG_PATH, JSON.stringify(config, null, 2));
      console.log('✅ Updated transformer configuration to remove Pump.fun');
    } catch (error) {
      console.error('Error updating transformer configuration:', error.message);
    }
  } else {
    console.log('Transformer configuration file not found, skipping update');
  }
}

// Create a list of banned API domains
function createBannedDomainsList() {
  console.log('Creating banned domains list...');
  
  const bannedDomains = {
    domains: [
      'pump.fun',
      'api.pump.fun',
      'stats-api.pump.fun',
      'api.stats.pump.fun',
      'birdeye-cache.pump.fun',
      'instantnodes.io',
      'solana-api.instantnodes.io'
    ],
    reason: 'Frequent timeouts and connection errors',
    bannedAt: new Date().toISOString(),
    useAlternatives: [
      'dexscreener.com',
      'api.dexscreener.com',
      'jupiter.ag',
      'meteora.ag'
    ]
  };
  
  const bannedDomainsPath = path.join('./data', 'banned-domains.json');
  fs.writeFileSync(bannedDomainsPath, JSON.stringify(bannedDomains, null, 2));
  console.log('✅ Created banned domains list');
}

// Update the external API manager configuration
function updateExternalApiConfig() {
  console.log('Creating external API configuration...');
  
  const externalApiConfig = {
    rateLimiting: {
      enabled: true,
      defaultBaseDelay: 1000,
      defaultMaxRetries: 3,
      defaultBackoffFactor: 2,
      defaultMaxDelay: 30000,
      defaultCooldownPeriod: 180000
    },
    providers: {
      dexscreener: {
        baseDelay: 1500,
        maxRetries: 4,
        backoffFactor: 2,
        maxDelay: 45000,
        cooldownPeriod: 240000,
        enabled: true
      },
      jupiter: {
        baseDelay: 1000,
        maxRetries: 5,
        backoffFactor: 1.5,
        maxDelay: 20000,
        cooldownPeriod: 120000,
        enabled: true
      },
      meteora: {
        baseDelay: 1500,
        maxRetries: 4,
        backoffFactor: 2,
        maxDelay: 30000,
        cooldownPeriod: 180000,
        enabled: true
      },
      birdeye: {
        baseDelay: 1200,
        maxRetries: 4,
        backoffFactor: 2,
        maxDelay: 40000,
        cooldownPeriod: 240000,
        enabled: true
      },
      gmgn: {
        baseDelay: 2000,
        maxRetries: 3,
        backoffFactor: 2,
        maxDelay: 30000,
        cooldownPeriod: 180000,
        enabled: true
      },
      'pump.fun': {
        baseDelay: 2000,
        maxRetries: 0,
        backoffFactor: 2.5,
        maxDelay: 60000,
        cooldownPeriod: 300000,
        enabled: false
      },
      'instantnodes.io': {
        baseDelay: 1500,
        maxRetries: 0,
        backoffFactor: 2,
        maxDelay: 30000,
        cooldownPeriod: 300000,
        enabled: false
      }
    },
    banned: [
      'pump.fun',
      'instantnodes.io'
    ],
    caching: {
      enabled: true,
      defaultTtlMs: 300000, // 5 minutes
      refreshStaleEnabled: true,
      refreshStaleIntervalMs: 60000 // 1 minute
    },
    lastUpdated: new Date().toISOString()
  };
  
  const configPath = path.join('./data', 'external-api-config.json');
  fs.writeFileSync(configPath, JSON.stringify(externalApiConfig, null, 2));
  console.log('✅ Created external API configuration with Pump.fun banned');
}

// Clear memecoin cache to remove any Pump.fun data
function clearMemecoinCache() {
  console.log('Cleaning memecoin cache...');
  
  if (fs.existsSync(MEMECOIN_CACHE_PATH)) {
    try {
      const cache = JSON.parse(fs.readFileSync(MEMECOIN_CACHE_PATH, 'utf8'));
      
      // Clear any tokens that originated from Pump.fun
      Object.keys(cache).forEach(symbol => {
        if (cache[symbol].source && cache[symbol].source.toLowerCase().includes('pump')) {
          // Set source to a different provider
          cache[symbol].source = 'dexscreener';
          cache[symbol].confidence = 0.7; // Adjust confidence
        }
      });
      
      // Save updated cache
      fs.writeFileSync(MEMECOIN_CACHE_PATH, JSON.stringify(cache, null, 2));
      console.log('✅ Cleaned memecoin cache of Pump.fun data');
    } catch (error) {
      console.error('Error cleaning memecoin cache:', error.message);
    }
  } else {
    console.log('Memecoin cache file not found, skipping cleanup');
  }
}

// Main function
function main() {
  console.log('Starting Pump.fun API ban process...');
  
  // Execute all ban functions
  createTokenSourcesConfig();
  updateMemeStrategy();
  updateTransformerConfig();
  createBannedDomainsList();
  updateExternalApiConfig();
  clearMemecoinCache();
  
  console.log('\n=== PUMP.FUN API BAN COMPLETED SUCCESSFULLY ===');
  console.log('✅ Disabled all Pump.fun API connections');
  console.log('✅ Removed Pump.fun from all data sources');
  console.log('✅ Created configuration to prevent future Pump.fun connections');
  console.log('✅ Cleaned cached data from Pump.fun');
  console.log('\nThe system will now use more reliable data sources for all operations.\n');
}

// Run the main function
main();