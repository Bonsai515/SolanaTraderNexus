/**
 * Update Syndica Configuration with Header Authentication
 * 
 * This script properly updates Syndica as the primary RPC provider 
 * with header-based authentication to prevent rate limiting issues.
 */

import { Connection, ConnectionConfig, Commitment } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.trading' });

// Constants
const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY || 'q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const SYNDICA_URL = 'https://solana-api.syndica.io/rpc';
const CONFIG_DIR = path.join(process.cwd(), 'config');

// Type definitions
interface RateLimit {
  enabled: boolean;
  requestsPerSecond: number;
  requestsPerMinute: number;
  cooldownPeriodMs: number;
}

interface ProviderConfig {
  name: string;
  url: string;
  headerAuth: boolean;
  headerName?: string;
  apiKey?: string;
  priority: number;
  enabled: boolean;
  maxRequestsPerSecond: number;
  maxRequestsPerMinute: number;
}

interface RateLimitConfig {
  global: RateLimit;
  providers: {
    syndica: RateLimit & {
      useHeaderAuth: boolean;
      headerName: string;
      apiKey: string;
      maxConcurrentRequests: number;
    };
  };
  priorities: {
    trade: {
      enabled: boolean;
      requestsPerMinute: number;
      requestsPerHour: number;
    };
    price: {
      enabled: boolean;
      requestsPerMinute: number;
      requestsPerHour: number;
    };
    market: {
      enabled: boolean;
      requestsPerMinute: number;
      requestsPerHour: number;
    };
  };
  adaptiveThrottling: boolean;
}

interface RpcConfig {
  providers: ProviderConfig[];
  requestSettings: {
    maxRetries: number;
    retryDelayMs: number;
    priorityRequests: string[];
    lowPriorityRequests: string[];
    batchRequests: boolean;
    requestTimeoutMs: number;
  };
  rateLimiting: {
    enabled: boolean;
    cooldownPeriodMs: number;
    adaptiveThrottling: boolean;
  };
}

interface AgentConfig {
  rpcSettings: {
    provider: string;
    url: string;
    useHeaderAuth: boolean;
    headerName: string;
    apiKey: string;
    maxRequestsPerMinute: number;
  };
  tradingSettings: {
    maxTransactionsPerHour: number;
    minTimeBetweenTradesMs: number;
    executionPriority: string;
    useRandomDelay: boolean;
  };
  minProfitThresholdPercent: number;
  maxSlippageBps: number;
  requestThrottling: {
    enabled: boolean;
    maxRequestsPerMinute: number;
  };
}

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

/**
 * Configure rate limits optimized for Syndica
 */
function configureRateLimits(): boolean {
  try {
    const rateLimitPath = path.join(CONFIG_DIR, 'rate-limits.json');
    
    const rateLimitConfig: RateLimitConfig = {
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
          apiKey: SYNDICA_API_KEY,
          cooldownPeriodMs: 12000
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
    console.error('❌ Error configuring rate limits:', error);
    return false;
  }
}

/**
 * Update RPC configuration to use Syndica
 */
function updateRpcConfig(): boolean {
  try {
    const configPath = path.join(CONFIG_DIR, 'rpc-config.json');
    
    // Create optimized RPC config
    const rpcConfig: RpcConfig = {
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
          headerAuth: false,
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
    console.error('❌ Error updating RPC configuration:', error);
    return false;
  }
}

/**
 * Update .env.trading file with Syndica settings
 */
function updateEnvFile(): boolean {
  try {
    const envPath = path.join(process.cwd(), '.env.trading');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Update Syndica settings
    const settings: Record<string, string> = {
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
    console.error('❌ Error updating .env.trading file:', error);
    return false;
  }
}

/**
 * Update all trading agent configurations
 */
function updateAgentConfigs(): boolean {
  const agents = ['hyperion', 'quantum-omega', 'aimodelsynapse', 'singularity'];
  
  for (const agent of agents) {
    try {
      const configPath = path.join(CONFIG_DIR, `${agent}-config.json`);
      
      const agentConfig: AgentConfig = {
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
      console.error(`❌ Error updating ${agent} configuration:`, error);
    }
  }
  
  return true;
}

/**
 * Test Syndica connection with proper header authentication
 */
async function testSyndicaConnection(): Promise<boolean> {
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
    console.error('❌ Syndica connection failed:', error);
    return false;
  }
}

/**
 * Create optimized Solana connection
 */
function createOptimizedConnection(commitment: Commitment = 'confirmed'): Connection {
  // Configure connection settings
  const config: ConnectionConfig = {
    commitment,
    confirmTransactionInitialTimeout: 60000,
    httpHeaders: {
      'X-API-Key': SYNDICA_API_KEY
    }
  };
  
  return new Connection(SYNDICA_URL, config);
}

/**
 * Create optimized trading starter script
 */
function createTradingStarter(): boolean {
  try {
    const starterPath = path.join(process.cwd(), 'start-optimized-trading.ts');
    
    const starterCode = `/**
 * Optimized Trading Starter
 * 
 * This script starts the trading system with optimized Syndica configuration
 * and proper rate limiting to execute real trades without 429 errors.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// Define types
interface RateLimit {
  requestsPerSecond: number;
  requestsPerMinute: number;
}

interface TradeFrequency {
  tradesPerHour: number;
  minDelaySecs: number;
}

interface TradingParams {
  minProfitThresholdPercent: number;
  tradeFrequency: TradeFrequency;
  maxSlippageBps: number;
}

// Load settings
const CONFIG_DIR = path.join(process.cwd(), 'config');
const rateLimitConfigPath = path.join(CONFIG_DIR, 'rate-limits.json');
const tradingParamsPath = path.join(CONFIG_DIR, 'trading-params.json');

// Load configuration files if they exist
let rateLimit: RateLimit = { requestsPerSecond: 1, requestsPerMinute: 12 };
let tradingParams: TradingParams = { 
  minProfitThresholdPercent: 1.0, 
  tradeFrequency: { tradesPerHour: 3, minDelaySecs: 300 },
  maxSlippageBps: 100
};

if (fs.existsSync(rateLimitConfigPath)) {
  const rateLimitConfig = JSON.parse(fs.readFileSync(rateLimitConfigPath, 'utf8'));
  rateLimit = rateLimitConfig.global;
}

if (fs.existsSync(tradingParamsPath)) {
  tradingParams = JSON.parse(fs.readFileSync(tradingParamsPath, 'utf8'));
}

// Display startup message
console.log('=== STARTING OPTIMIZED TRADING SYSTEM WITH SYNDICA ===');
console.log(\`Rate limit: \${rateLimit.requestsPerSecond} req/sec, \${rateLimit.requestsPerMinute} req/min\`);
console.log(\`Trade frequency: \${tradingParams.tradeFrequency.tradesPerHour} per hour, min \${tradingParams.tradeFrequency.minDelaySecs}s between trades\`);
console.log(\`Min profit threshold: \${tradingParams.minProfitThresholdPercent}%\`);
console.log(\`Max slippage: \${tradingParams.maxSlippageBps / 100}%\`);

// Start the trading monitor
console.log('\\nStarting trade monitor...');
const monitor = spawn('npx', ['tsx', './src/real-trade-monitor.ts'], { 
  stdio: 'inherit',
  detached: true
});

// Keep the script running
process.stdin.resume();

// Handle exit
process.on('SIGINT', () => {
  console.log('\\nShutting down trading system...');
  process.exit();
});

console.log('\\n✅ Optimized trading system is now running with Syndica as primary RPC.');
console.log('You will receive notifications of verified real trades as they occur.');
console.log('Press Ctrl+C to stop the trading system.');`;
    
    fs.writeFileSync(starterPath, starterCode);
    console.log('✅ Created TypeScript trading starter');
    return true;
  } catch (error) {
    console.error('❌ Error creating trading starter:', error);
    return false;
  }
}

/**
 * Main function to update Syndica configuration
 */
async function updateSyndicaConfig(): Promise<void> {
  console.log('=== UPDATING SYNDICA CONFIGURATION WITH TYPESCRIPT ===');
  
  // Test Syndica connection first
  const connectionWorks = await testSyndicaConnection();
  
  if (connectionWorks) {
    // Configure rate limits for Syndica
    configureRateLimits();
    
    // Update RPC config
    updateRpcConfig();
    
    // Update environment variables
    updateEnvFile();
    
    // Update agent configs
    updateAgentConfigs();
    
    // Create optimized trading starter
    createTradingStarter();
    
    console.log('\n=== SYNDICA CONFIGURATION UPDATED ===');
    console.log('✅ Syndica configured as primary RPC provider with proper header authentication');
    console.log('✅ Rate limits optimized to prevent 429 errors');
    console.log('✅ All trading agents updated to use Syndica correctly');
    
    console.log('\nPlease run the following command to restart with the new configuration:');
    console.log('npx tsx start-optimized-trading.ts');
  } else {
    console.error('\n❌ Syndica connection test failed.');
    console.error('Please check your Syndica API key and try again.');
  }
}

// Run the update
updateSyndicaConfig();