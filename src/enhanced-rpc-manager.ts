/**
 * Enhanced RPC Management System
 * 
 * This module provides an advanced system for managing RPC connections
 * with proper header-based authentication and fallback mechanisms.
 */

const { Connection, ConnectionConfig, Commitment } = require('@solana/web3.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.trading' });

// Constants
const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY || 'q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const SYNDICA_URL = 'https://solana-api.syndica.io/rpc';
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const ALCHEMY_URL = `https://solana-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

// RPC Providers with priority levels
const RPC_PROVIDERS = [
  {
    name: 'Syndica',
    url: SYNDICA_URL,
    headerAuth: true,
    headerName: 'X-API-Key',
    apiKey: SYNDICA_API_KEY,
    priority: 1,
    maxRateLimit: 250, // Rate limit: 250 requests per second
    enabled: true
  },
  {
    name: 'Helius',
    url: HELIUS_URL,
    headerAuth: false,
    priority: 2,
    maxRateLimit: 120, // Rate limit: 120 requests per second
    enabled: true
  },
  {
    name: 'Alchemy',
    url: ALCHEMY_URL,
    headerAuth: false,
    priority: 3,
    maxRateLimit: 100, // Rate limit: 100 requests per second
    enabled: true
  }
];

// Track rate limits
const rpcUsage = {};
RPC_PROVIDERS.forEach(provider => {
  rpcUsage[provider.name] = {
    count: 0,
    lastReset: Date.now(),
    consecutiveFailures: 0
  };
});

// Track health status
let providerHealth = {};
RPC_PROVIDERS.forEach(provider => {
  providerHealth[provider.name] = {
    healthy: true,
    lastCheck: Date.now(),
    lastFailure: null,
    responseTime: 0
  };
});

/**
 * Update rate limit counter for a provider
 */
function updateRateLimit(providerName) {
  const now = Date.now();
  const usage = rpcUsage[providerName];
  
  // Reset counter if more than 1 second has passed
  if (now - usage.lastReset > 1000) {
    usage.count = 0;
    usage.lastReset = now;
  }
  
  // Increment counter
  usage.count++;
}

/**
 * Check if a provider is rate limited
 */
function isRateLimited(providerName) {
  const provider = RPC_PROVIDERS.find(p => p.name === providerName);
  const usage = rpcUsage[providerName];
  
  if (!provider) return true;
  
  return usage.count >= provider.maxRateLimit;
}

/**
 * Mark a provider as unhealthy
 */
function markUnhealthy(providerName, error) {
  providerHealth[providerName] = {
    healthy: false,
    lastCheck: Date.now(),
    lastFailure: Date.now(),
    responseTime: 0,
    error: error?.toString() || 'Unknown error'
  };
  
  rpcUsage[providerName].consecutiveFailures++;
  
  console.log(`⚠️ Marked ${providerName} as unhealthy: ${error?.toString() || 'Unknown error'}`);
}

/**
 * Mark a provider as healthy
 */
function markHealthy(providerName, responseTime) {
  providerHealth[providerName] = {
    healthy: true,
    lastCheck: Date.now(),
    lastFailure: null,
    responseTime
  };
  
  rpcUsage[providerName].consecutiveFailures = 0;
}

/**
 * Check health of all providers
 */
async function checkProvidersHealth() {
  for (const provider of RPC_PROVIDERS) {
    if (!provider.enabled) continue;
    
    try {
      const startTime = Date.now();
      
      const requestConfig = {
        method: 'post',
        url: provider.url,
        headers: {
          'Content-Type': 'application/json',
          ...(provider.headerAuth ? { [provider.headerName]: provider.apiKey } : {})
        },
        data: {
          jsonrpc: '2.0',
          id: 1,
          method: 'getBlockHeight',
          params: []
        },
        timeout: 5000 // 5 second timeout
      };
      
      const response = await axios(requestConfig);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      if (response.data && response.data.result !== undefined) {
        markHealthy(provider.name, responseTime);
        console.log(`✅ ${provider.name} health check passed in ${responseTime}ms`);
      } else {
        markUnhealthy(provider.name, 'Invalid response');
      }
    } catch (error) {
      markUnhealthy(provider.name, error);
    }
  }
}

/**
 * Get optimal provider based on health and rate limits
 */
function getOptimalProvider() {
  // Filter out unhealthy or rate-limited providers
  const availableProviders = RPC_PROVIDERS.filter(provider => {
    const health = providerHealth[provider.name];
    const isHealthy = health?.healthy || false;
    const notRateLimited = !isRateLimited(provider.name);
    return provider.enabled && isHealthy && notRateLimited;
  });
  
  if (availableProviders.length === 0) {
    // All providers are unhealthy or rate-limited, use the one with lowest consecutive failures
    const leastFailedProvider = RPC_PROVIDERS
      .filter(p => p.enabled)
      .sort((a, b) => rpcUsage[a.name].consecutiveFailures - rpcUsage[b.name].consecutiveFailures)[0];
    
    console.log(`⚠️ All providers are unhealthy or rate-limited. Using ${leastFailedProvider.name} as fallback.`);
    return leastFailedProvider;
  }
  
  // Sort by priority (lowest number is highest priority)
  return availableProviders.sort((a, b) => a.priority - b.priority)[0];
}

/**
 * Create a connection with the optimal provider
 */
function getOptimalConnection(commitment = 'confirmed') {
  const provider = getOptimalProvider();
  
  console.log(`Using ${provider.name} as RPC provider`);
  
  // Update rate limit counter
  updateRateLimit(provider.name);
  
  // Configure connection
  const config = {
    commitment,
    confirmTransactionInitialTimeout: 60000
  };
  
  // Add headers if needed
  if (provider.headerAuth) {
    config.httpHeaders = {
      [provider.headerName]: provider.apiKey
    };
  }
  
  return new Connection(provider.url, config);
}

/**
 * Set up fallback mechanisms for DEXes
 */
function setupDexFallbackMechanisms() {
  const dexConfigs = {
    'jupiter': {
      rpcProviders: [
        { name: 'Syndica', headerAuth: true, headerName: 'X-API-Key', apiKey: SYNDICA_API_KEY },
        { name: 'Helius', url: HELIUS_URL }
      ]
    },
    'raydium': {
      rpcProviders: [
        { name: 'Syndica', headerAuth: true, headerName: 'X-API-Key', apiKey: SYNDICA_API_KEY },
        { name: 'Helius', url: HELIUS_URL }
      ]
    },
    'orca': {
      rpcProviders: [
        { name: 'Syndica', headerAuth: true, headerName: 'X-API-Key', apiKey: SYNDICA_API_KEY },
        { name: 'Helius', url: HELIUS_URL }
      ]
    },
    'marinade': {
      rpcProviders: [
        { name: 'Syndica', headerAuth: true, headerName: 'X-API-Key', apiKey: SYNDICA_API_KEY },
        { name: 'Helius', url: HELIUS_URL }
      ]
    }
  };
  
  // Save to config file
  const configPath = path.join(process.cwd(), 'config', 'dex-rpc-config.json');
  const configDir = path.dirname(configPath);
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  fs.writeFileSync(configPath, JSON.stringify(dexConfigs, null, 2));
  console.log('✅ Set up DEX fallback mechanisms');
  
  return dexConfigs;
}

/**
 * Test the Syndica connection with proper header authentication
 */
async function testSyndicaConnection() {
  try {
    console.log('Testing Syndica connection with header authentication...');
    
    const requestConfig = {
      method: 'post',
      url: SYNDICA_URL,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': SYNDICA_API_KEY
      },
      data: {
        jsonrpc: '2.0',
        id: 1,
        method: 'getBlockHeight',
        params: []
      },
      timeout: 5000
    };
    
    const response = await axios(requestConfig);
    
    if (response.data && response.data.result !== undefined) {
      console.log(`✅ Syndica connection successful! Block height: ${response.data.result}`);
      return true;
    } else {
      console.error('❌ Syndica connection failed: Invalid response');
      return false;
    }
  } catch (error) {
    console.error('❌ Syndica connection failed:', error.message);
    return false;
  }
}

/**
 * Initialize the enhanced RPC manager
 */
async function initializeRpcManager() {
  console.log('Initializing Enhanced RPC Manager...');
  
  // Test Syndica connection
  const syndicaWorking = await testSyndicaConnection();
  
  if (!syndicaWorking) {
    console.warn('Syndica connection failed. Using fallback providers.');
    
    // Disable Syndica if not working
    const syndicaProvider = RPC_PROVIDERS.find(p => p.name === 'Syndica');
    if (syndicaProvider) {
      syndicaProvider.enabled = false;
    }
  }
  
  // Check health of all providers
  await checkProvidersHealth();
  
  // Set up DEX fallback mechanisms
  setupDexFallbackMechanisms();
  
  // Create optimal connection
  const connection = getOptimalConnection();
  
  // Start health check interval (every 30 seconds)
  setInterval(checkProvidersHealth, 30000);
  
  console.log('✅ Enhanced RPC Manager initialized');
  return { connection, providers: RPC_PROVIDERS };
}

// Export functions
module.exports = {
  initializeRpcManager,
  getOptimalConnection,
  testSyndicaConnection,
  checkProvidersHealth,
  setupDexFallbackMechanisms
};

// Start the manager when directly executed
if (require.main === module) {
  initializeRpcManager();
}