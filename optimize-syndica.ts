/**
 * Optimize Syndica RPC Usage
 * 
 * This script optimizes the system to make the most of Syndica's
 * premium RPC capabilities.
 */

import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Load environment variables
config();

// Constants
const MAIN_WALLET_ADDRESS = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const CONFIG_DIR = './config';
const RPC_CONFIG_PATH = path.join(CONFIG_DIR, 'syndica-config.json');

console.log('=== OPTIMIZING SYNDICA RPC USAGE ===');

// Make sure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Create Syndica streaming connection config
const syndicaConfig = {
  primaryRpc: "https://solana-api.syndica.io/rpc",
  useStreamingRpc: true,
  streamingRpcConfig: {
    url: "wss://solana-api.syndica.io/rpc",
    reconnectOnError: true,
    reconnectInterval: 1000,
    maxReconnectAttempts: 5
  },
  caching: {
    enabled: true,
    accountTtlMs: 30000,          // 30 seconds for account data
    blockTtlMs: 60000,            // 60 seconds for block data
    signatureTtlMs: 3600000,      // 1 hour for signature data
    transactionTtlMs: 86400000    // 24 hours for confirmed transaction data
  },
  fallbackProviders: [
    {
      url: "https://api.mainnet-beta.solana.com",
      priority: 2
    },
    {
      url: "https://solana-api.projectserum.com",
      priority: 2
    }
  ],
  rateLimit: {
    maxRequestsPerSecond: 10,     // Per second rate limit
    maxRequestsPerMinute: 500,    // Per minute rate limit 
    maxWebsocketSubscriptions: 20 // Max simultaneous WS subscriptions
  },
  optimizations: {
    batchRequests: true,        // Batch similar requests
    deduplicate: true,          // Deduplicate identical requests
    prioritizeByType: true      // Prioritize important request types
  }
};

// Write Syndica config
try {
  fs.writeFileSync(RPC_CONFIG_PATH, JSON.stringify(syndicaConfig, null, 2));
  console.log(`✅ Created optimized Syndica config at ${RPC_CONFIG_PATH}`);
} catch (error) {
  console.error('Error writing Syndica config:', error);
}

// Update .env file with Syndica config
const envPath = './.env';
let envContent = '';

if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
  
  // Remove old RPC settings
  envContent = envContent.replace(/RPC_URL=.*$/gm, '');
  envContent = envContent.replace(/SOLANA_RPC=.*$/gm, '');
}

// Add Syndica config
const envUpdates = `
# Syndica RPC Configuration
RPC_URL=https://solana-api.syndica.io/rpc
SOLANA_RPC=https://solana-api.syndica.io/rpc
SOLANA_STREAMING_RPC=wss://solana-api.syndica.io/rpc
USE_STREAMING_RPC=true
OPTIMIZE_RPC_USAGE=true
BATCH_RPC_REQUESTS=true
`;

fs.writeFileSync(envPath, envContent + envUpdates);
console.log('✅ Updated environment variables with Syndica configuration');

// Create a streamlined RPC client
const rpcClientCode = `/**
 * Optimized Syndica RPC Client
 * 
 * A streamlined client for making efficient RPC calls to Syndica.
 */

import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// Load config
const CONFIG_PATH = path.join(__dirname, '../config/syndica-config.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

// Create connection
const connection = new Connection(config.primaryRpc);

// Cache for RPC responses
const responseCache = new Map();

// Make RPC request with caching
async function makeRpcRequest(method: string, params: any[] = []): Promise<any> {
  // Generate cache key
  const cacheKey = \`\${method}-\${JSON.stringify(params)}\`;
  
  // Check cache
  if (responseCache.has(cacheKey)) {
    const cached = responseCache.get(cacheKey);
    if (Date.now() < cached.expiresAt) {
      return cached.data;
    }
  }
  
  // Make request
  const response = await connection.rpcRequest(method, params);
  
  // Determine cache TTL based on method
  let ttl = 30000; // Default 30 seconds
  
  if (method.includes('getTransaction') || method.includes('getSignature')) {
    ttl = 86400000; // 24 hours for transaction data
  } else if (method.includes('getAccountInfo') || method.includes('getProgramAccounts')) {
    ttl = 30000; // 30 seconds for account data
  } else if (method.includes('getBlock') || method.includes('getSlot')) {
    ttl = 60000; // 60 seconds for block data
  }
  
  // Cache response
  responseCache.set(cacheKey, {
    data: response.result,
    expiresAt: Date.now() + ttl
  });
  
  // Clean up old cache entries periodically
  if (responseCache.size > 1000) {
    const now = Date.now();
    for (const [key, value] of responseCache.entries()) {
      if (value.expiresAt < now) {
        responseCache.delete(key);
      }
    }
  }
  
  return response.result;
}

// Common RPC methods
export async function getBalance(pubkey: string | PublicKey): Promise<number> {
  const address = typeof pubkey === 'string' ? pubkey : pubkey.toBase58();
  return makeRpcRequest('getBalance', [address]);
}

export async function getAccountInfo(pubkey: string | PublicKey): Promise<any> {
  const address = typeof pubkey === 'string' ? pubkey : pubkey.toBase58();
  return makeRpcRequest('getAccountInfo', [address, {encoding: 'jsonParsed'}]);
}

export async function getRecentBlockhash(): Promise<string> {
  const result = await makeRpcRequest('getLatestBlockhash');
  return result.blockhash;
}

export async function sendTransaction(transaction: VersionedTransaction): Promise<string> {
  // Don't cache transactions
  return connection.sendRawTransaction(transaction.serialize());
}

// Get multiple token balances in a single call
export async function getMultipleTokenBalances(walletAddress: string, tokenMints: string[]): Promise<{[mint: string]: number}> {
  const accounts = await makeRpcRequest('getTokenAccountsByOwner', [
    walletAddress,
    { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
    { encoding: 'jsonParsed' }
  ]);
  
  const balances: {[mint: string]: number} = {};
  
  for (const account of accounts) {
    const mint = account.account.data.parsed.info.mint;
    const amount = account.account.data.parsed.info.tokenAmount.uiAmount;
    
    if (tokenMints.includes(mint)) {
      balances[mint] = amount;
    }
  }
  
  return balances;
}

// Export connection for direct use if needed
export { connection };`;

// Create file
fs.mkdirSync('./src/utils', { recursive: true });
fs.writeFileSync('./src/utils/syndica-client.ts', rpcClientCode);
console.log('✅ Created optimized Syndica RPC client at ./src/utils/syndica-client.ts');

// Create a usage example
const usageExampleCode = `/**
 * Syndica RPC Client Usage Example
 * 
 * This file shows how to use the optimized Syndica RPC client.
 */

import { getBalance, getAccountInfo, getRecentBlockhash, sendTransaction, getMultipleTokenBalances } from './utils/syndica-client';
import { PublicKey } from '@solana/web3.js';

// Example use cases
async function exampleUsage() {
  try {
    // Get SOL balance
    const walletAddress = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
    const balance = await getBalance(walletAddress);
    console.log(\`Wallet balance: \${balance / 1_000_000_000} SOL\`);
    
    // Get multiple token balances in one call
    const tokenMints = [
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      'So11111111111111111111111111111111111111112'   // Wrapped SOL
    ];
    
    const tokenBalances = await getMultipleTokenBalances(walletAddress, tokenMints);
    console.log('Token balances:', tokenBalances);
    
    // Get recent blockhash (cached)
    const blockhash = await getRecentBlockhash();
    console.log('Recent blockhash:', blockhash);
    
  } catch (error) {
    console.error('Error in example usage:', error);
  }
}

// Run the example
exampleUsage();`;

fs.writeFileSync('./src/syndica-example.ts', usageExampleCode);
console.log('✅ Created usage example at ./src/syndica-example.ts');

// Create restart script
const restartScript = `#!/bin/bash
# Restart trading system with optimized Syndica RPC

echo "========================================"
echo "    RESTARTING TRADING SYSTEM          "
echo "    WITH OPTIMIZED SYNDICA RPC         "
echo "========================================"
echo

# Stop running processes
echo "Stopping current trading system..."
pkill -f "ts-node" || true
pkill -f "npx tsx" || true
pkill -f "strategy.ts" || true
sleep 2

# Clean RPC cache
echo "Clearing stale cache data..."
find ./data/rpc_cache -name "*.json" -mmin +60 -delete 2>/dev/null || true

# Export environment variables
export RPC_URL="https://solana-api.syndica.io/rpc"
export SOLANA_RPC="https://solana-api.syndica.io/rpc"
export USE_STREAMING_RPC="true"
export OPTIMIZE_RPC_USAGE="true"
export BATCH_RPC_REQUESTS="true"

# Start system
echo "Starting trading system with optimized Syndica RPC..."
./launch-enhanced-system.sh &

echo "System restarted with optimized Syndica RPC configuration"
echo "========================================"
`;

fs.writeFileSync('./restart-with-syndica.sh', restartScript);
fs.chmodSync('./restart-with-syndica.sh', 0o755); // Make executable
console.log('✅ Created restart script at ./restart-with-syndica.sh');

console.log('\n=== SYNDICA OPTIMIZATION COMPLETE ===');
console.log('The system is now configured to make the most of Syndica\'s RPC capabilities');
console.log('To get the best results, you should:');
console.log('1. Add your premium Syndica API key once you have it');
console.log('2. Increase your SOL capital to enable larger trade sizes');
console.log('3. Use the Jupiter API for even more efficient price feeds');

console.log('\nTo restart the system with optimized Syndica RPC, run:');
console.log('./restart-with-syndica.sh');