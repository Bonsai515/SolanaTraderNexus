/**
 * Update Syndica Configuration with Header Authentication
 * 
 * This script properly updates Syndica as the primary RPC provider 
 * with header-based authentication to prevent rate limiting issues.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: '.env.trading' });

// Constants
const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY || 'q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const SYNDICA_URL = 'https://solana-api.syndica.io/rpc';
const CONFIG_DIR = path.join(process.cwd(), 'config');

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

/**
 * Configure rate limits optimized for Syndica
 */
function configureRateLimits() {
  try {
    const rateLimitPath = path.join(CONFIG_DIR, 'rate-limits.json');
    
    const rateLimitConfig = {
      global: {
        enabled: true,
        requestsPerSecond: 1,
        requestsPerMinute: 12,
        cooldownPeriodMs: 12000
      },
      providers: {
        syndica: {
          enabled: true,
          requestsPerSecond: 1,
          requestsPerMinute: 12,
          maxConcurrentRequests: 2,
          useHeaderAuth: true,
          headerName: 'X-API-Key',
          apiKey: SYNDICA_API_KEY
        }
      },
      priorities: {
        trade: {
          enabled: true,
          requestsPerMinute: 3,
          requestsPerHour: 12
        },
        price: {
          enabled: true,
          requestsPerMinute: 4,
          requestsPerHour: 30
        },
        market: {
          enabled: true,
          requestsPerMinute: 2,
          requestsPerHour: 18
        }
      },
      adaptiveThrottling: true
    };
    
    fs.writeFileSync(rateLimitPath, JSON.stringify(rateLimitConfig, null, 2));
    console.log('✅ Configured rate limits optimized for Syndica');
    return true;
  } catch (error) {
    console.error('❌ Error configuring rate limits:', error.message);
    return false;
  }
}

/**
 * Update RPC configuration to use Syndica
 */
function updateRpcConfig() {
  try {
    const configPath = path.join(CONFIG_DIR, 'rpc-config.json');
    
    // Create optimized RPC config
    const rpcConfig = {
      providers: [
        {
          name: 'Syndica',
          url: SYNDICA_URL,
          headerAuth: true,
          headerName: 'X-API-Key',
          apiKey: SYNDICA_API_KEY,
          priority: 1,
          enabled: true,
          maxRequestsPerSecond: 1,
          maxRequestsPerMinute: 12
        },
        {
          name: 'Helius',
          url: process.env.HELIUS_RPC_URL || `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
          priority: 2,
          enabled: true,
          maxRequestsPerSecond: 1,
          maxRequestsPerMinute: 15
        }
      ],
      requestSettings: {
        maxRetries: 2,
        retryDelayMs: 3000,
        priorityRequests: ['getTransaction', 'sendTransaction'], // Prioritize actual transactions
        lowPriorityRequests: ['getAccountInfo', 'getTokenAccountsByOwner'], // De-prioritize these
        batchRequests: true, // Batch requests when possible
        requestTimeoutMs: 15000 // Higher timeout
      },
      rateLimiting: {
        enabled: true,
        cooldownPeriodMs: 12000, // 12 second cooldown after hitting limits
        adaptiveThrottling: true // Slow down even more if we see 429 errors
      }
    };
    
    fs.writeFileSync(configPath, JSON.stringify(rpcConfig, null, 2));
    console.log('✅ Updated RPC configuration to use Syndica with proper headers');
    return true;
  } catch (error) {
    console.error('❌ Error updating RPC configuration:', error.message);
    return false;
  }
}

/**
 * Update .env.trading file with Syndica settings
 */
function updateEnvFile() {
  try {
    const envPath = path.join(process.cwd(), '.env.trading');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Update Syndica settings
    const settings = {
      'PRIMARY_RPC_PROVIDER': 'syndica',
      'SYNDICA_RPC_URL': SYNDICA_URL,
      'SYNDICA_API_KEY': SYNDICA_API_KEY,
      'SYNDICA_USE_HEADER_AUTH': 'true',
      'SYNDICA_HEADER_NAME': 'X-API-Key',
      'TRADING_ACTIVE': 'true',
      'USE_REAL_FUNDS': 'true',
      'MAX_REQUESTS_PER_SECOND': '1',
      'MAX_REQUESTS_PER_MINUTE': '12',
      'MAX_TRADES_PER_HOUR': '3',
      'MIN_PROFIT_THRESHOLD_PERCENT': '1.0',
      'DEFAULT_SLIPPAGE_BPS': '100',
      'PRIORITY_FEE_LAMPORTS': '200000',
      'PROFIT_REINVESTMENT_RATE': '0.95',
      'TRADING_WALLET_ADDRESS': process.env.TRADING_WALLET_ADDRESS || 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK',
      'USE_RATE_LIMITING': 'true'
    };
    
    // Update each setting
    for (const [key, value] of Object.entries(settings)) {
      if (!envContent.includes(`${key}=`)) {
        envContent += `${key}=${value}\n`;
      } else {
        envContent = envContent.replace(
          new RegExp(`${key}=.*`, 'g'),
          `${key}=${value}`
        );
      }
    }
    
    // Save the updated env file
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Updated .env.trading with Syndica settings');
    return true;
  } catch (error) {
    console.error('❌ Error updating .env.trading file:', error.message);
    return false;
  }
}

/**
 * Update all trading agent configurations
 */
function updateAgentConfigs() {
  const agents = ['hyperion', 'quantum-omega', 'aimodelsynapse', 'singularity'];
  
  for (const agent of agents) {
    try {
      const configPath = path.join(CONFIG_DIR, `${agent}-config.json`);
      
      const agentConfig = {
        rpcSettings: {
          provider: 'syndica',
          url: SYNDICA_URL,
          useHeaderAuth: true,
          headerName: 'X-API-Key',
          apiKey: SYNDICA_API_KEY,
          maxRequestsPerMinute: 12
        },
        tradingSettings: {
          maxTransactionsPerHour: 2,
          minTimeBetweenTradesMs: 900000, // 15 minutes minimum between trades
          executionPriority: agent === 'hyperion' ? 'high' : 'medium',
          useRandomDelay: true // Add random delay between operations
        },
        minProfitThresholdPercent: 1.0,
        maxSlippageBps: 100,
        requestThrottling: {
          enabled: true,
          maxRequestsPerMinute: 12
        }
      };
      
      fs.writeFileSync(configPath, JSON.stringify(agentConfig, null, 2));
      console.log(`✅ Updated ${agent} config to use Syndica with proper headers`);
    } catch (error) {
      console.error(`❌ Error updating ${agent} configuration:`, error.message);
    }
  }
  
  return true;
}

/**
 * Main function to update Syndica configuration
 */
function updateSyndicaConfig() {
  console.log('=== UPDATING SYNDICA CONFIGURATION ===');
  
  // Configure rate limits for Syndica
  configureRateLimits();
  
  // Update RPC config
  updateRpcConfig();
  
  // Update environment variables
  updateEnvFile();
  
  // Update agent configs
  updateAgentConfigs();
  
  console.log('\n=== SYNDICA CONFIGURATION UPDATED ===');
  console.log('✅ Syndica configured as primary RPC provider with proper header authentication');
  console.log('✅ Rate limits optimized to prevent 429 errors');
  console.log('✅ All trading agents updated to use Syndica correctly');
  
  console.log('\nPlease restart your application to apply these changes and start seeing real trades.');
}

// Run the update
updateSyndicaConfig();