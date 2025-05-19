/**
 * Fix Syndica Connection Format
 * 
 * This script fixes the Syndica connection by using the proper URL format
 * and authentication method according to the Syndica documentation.
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
const SYNDICA_URL = `https://solana-mainnet.api.syndica.io/api-key/${SYNDICA_API_KEY}`;
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

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

/**
 * Test Syndica connection with correct URL format
 */
async function testSyndicaConnection(): Promise<boolean> {
  try {
    console.log('Testing Syndica connection with correct URL format...');
    
    const requestConfig = {
      method: 'post',
      url: SYNDICA_URL,
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        jsonrpc: '2.0',
        id: '1',
        method: 'getHealth'
      },
      timeout: 10000
    };
    
    console.log(`Using Syndica URL: ${SYNDICA_URL}`);
    const response = await axios(requestConfig);
    
    if (response.data && !response.data.error) {
      console.log(`✅ Syndica connection successful!`);
      console.log(`Response: ${JSON.stringify(response.data, null, 2)}`);
      return true;
    } else {
      console.error('❌ Syndica connection failed: Invalid response');
      console.error(`Response: ${JSON.stringify(response.data, null, 2)}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Syndica connection failed:', error);
    return false;
  }
}

/**
 * Update RPC configuration to use Syndica with correct format
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
          headerAuth: false, // Using API key in URL, not headers
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
    console.log('✅ Updated RPC configuration to use Syndica with correct URL format');
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
    console.log('✅ Updated .env.trading with Syndica settings using correct URL format');
    return true;
  } catch (error) {
    console.error('❌ Error updating .env.trading file:', error);
    return false;
  }
}

/**
 * Create connection factory for Syndica
 */
function createConnectionFactory(): boolean {
  try {
    const factoryPath = path.join(process.cwd(), 'src', 'syndica-connection-factory.ts');
    
    const factoryCode = `/**
 * Syndica Connection Factory
 * 
 * This module provides a factory for creating properly configured Syndica connections
 * using the correct URL format and authentication method.
 */

import { Connection, ConnectionConfig, Commitment } from '@solana/web3.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.trading' });

// Constants
const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY || 'q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const SYNDICA_URL = \`https://solana-mainnet.api.syndica.io/api-key/\${SYNDICA_API_KEY}\`;

/**
 * Create a Solana connection with Syndica using the correct URL format
 */
export function createSyndicaConnection(commitment: Commitment = 'confirmed'): Connection {
  const config: ConnectionConfig = {
    commitment,
    confirmTransactionInitialTimeout: 60000
  };
  
  return new Connection(SYNDICA_URL, config);
}

/**
 * Get optimal connection based on environment settings
 */
export function getOptimalConnection(commitment: Commitment = 'confirmed'): Connection {
  // If Syndica is the primary provider, use it
  if (process.env.PRIMARY_RPC_PROVIDER === 'syndica') {
    return createSyndicaConnection(commitment);
  }
  
  // Otherwise use Helius
  const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
  const HELIUS_URL = \`https://mainnet.helius-rpc.com/?api-key=\${HELIUS_API_KEY}\`;
  
  return new Connection(HELIUS_URL, {
    commitment,
    confirmTransactionInitialTimeout: 60000
  });
}`;
    
    fs.writeFileSync(factoryPath, factoryCode);
    console.log('✅ Created Syndica connection factory with correct URL format');
    return true;
  } catch (error) {
    console.error('❌ Error creating connection factory:', error);
    return false;
  }
}

/**
 * Main function to fix Syndica connection
 */
async function fixSyndicaConnection(): Promise<void> {
  console.log('=== FIXING SYNDICA CONNECTION FORMAT ===');
  
  // Test Syndica connection with correct URL format
  const connectionWorks = await testSyndicaConnection();
  
  if (connectionWorks) {
    // Update RPC config
    updateRpcConfig();
    
    // Update environment variables
    updateEnvFile();
    
    // Create connection factory
    createConnectionFactory();
    
    console.log('\n=== SYNDICA CONNECTION FORMAT FIXED ===');
    console.log('✅ Using correct URL format: https://solana-mainnet.api.syndica.io/api-key/<YOUR_API_KEY>');
    console.log('✅ All configurations updated to use Syndica properly');
    
    console.log('\nYou can now run the trading system with Syndica as the primary RPC provider.');
  } else {
    console.error('\n❌ Syndica connection test failed with correct URL format.');
    console.error('Please check your Syndica API key and try again.');
    console.error(`Current key: ${SYNDICA_API_KEY}`);
  }
}

// Run the update
fixSyndicaConnection();