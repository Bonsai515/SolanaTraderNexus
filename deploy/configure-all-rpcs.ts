/**
 * Configure All Available RPC Providers
 * 
 * This script configures the trading system to use all available RPC providers,
 * including Syndica, Helius, and Alchemy.
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
const RPC_CONFIG_PATH = path.join(CONFIG_DIR, 'multi-rpc-config.json');

console.log('=== CONFIGURING ALL RPC PROVIDERS ===');

// Make sure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Gather available RPC keys
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || '';

// Build array of RPC endpoints
const rpcEndpoints = [];

// Add paid endpoints with higher priority
if (HELIUS_API_KEY) {
  rpcEndpoints.push({
    name: "Helius",
    url: `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
    websocketUrl: `wss://mainnet.helius-rpc.com/ws?api-key=${HELIUS_API_KEY}`,
    priority: 1,
    weight: 10,
    rateLimit: { requestsPerMinute: 200 },
    inUse: true
  });
  console.log('✅ Added Helius RPC with API key');
}

if (ALCHEMY_API_KEY) {
  rpcEndpoints.push({
    name: "Alchemy",
    url: `https://solana-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    websocketUrl: `wss://solana-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    priority: 1,
    weight: 10,
    rateLimit: { requestsPerMinute: 200 },
    inUse: true
  });
  console.log('✅ Added Alchemy RPC with API key');
}

// Add Syndica (higher priority than public endpoints)
rpcEndpoints.push({
  name: "Syndica",
  url: "https://solana-api.syndica.io/rpc",
  websocketUrl: "wss://solana-api.syndica.io/rpc",
  priority: 2,
  weight: 5,
  rateLimit: { requestsPerMinute: 100 },
  inUse: true
});
console.log('✅ Added Syndica RPC');

// Always include public endpoints as fallbacks
rpcEndpoints.push({
  name: "Solana Public",
  url: "https://api.mainnet-beta.solana.com",
  websocketUrl: "wss://api.mainnet-beta.solana.com",
  priority: 3,
  weight: 1,
  rateLimit: { requestsPerMinute: 40 },
  inUse: true
});

rpcEndpoints.push({
  name: "Serum",
  url: "https://solana-api.projectserum.com",
  websocketUrl: "wss://solana-api.projectserum.com",
  priority: 3,
  weight: 1,
  rateLimit: { requestsPerMinute: 40 },
  inUse: true
});

// Mark Instant Nodes as disabled due to issues
rpcEndpoints.push({
  name: "Instant Nodes",
  url: "https://solana-api.instantnodes.io/token-NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9",
  websocketUrl: "",
  priority: 5,
  weight: 0,
  rateLimit: { requestsPerMinute: 0 },
  inUse: false  // Disabled
});

// Create configuration
const rpcConfig = {
  providers: rpcEndpoints,
  caching: {
    enabled: true,
    accountInfoTtlMs: 30000,     // 30 seconds
    balanceTtlMs: 30000,         // 30 seconds
    transactionTtlMs: 3600000,   // 1 hour
    blockTtlMs: 60000,           // 1 minute
    slotTtlMs: 10000             // 10 seconds
  },
  fallback: {
    enabled: true,
    maxRetries: 3,
    retryDelayMs: 500
  },
  loadBalancing: {
    enabled: true,
    strategy: "priority-weighted",  // Use highest priority first, distribute by weight
    healthCheckIntervalMs: 60000    // Check health every minute
  },
  streaming: {
    enabled: true,
    maxSubscriptions: 20,
    reconnectOnError: true,
    reconnectIntervalMs: 1000
  },
  rateLimit: {
    enabled: true,
    strategy: "provider-specific"  // Use each provider's specific rate limit
  },
  mainWalletAddress: MAIN_WALLET_ADDRESS
};

// Write configuration
try {
  fs.writeFileSync(RPC_CONFIG_PATH, JSON.stringify(rpcConfig, null, 2));
  console.log(`✅ Created multi-provider RPC config at ${RPC_CONFIG_PATH}`);
} catch (error) {
  console.error('Error writing RPC config:', error);
}

// Update .env file with multi-provider configuration
const envPath = './.env';
let envContent = '';

if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
  
  // Remove old RPC settings
  envContent = envContent.replace(/RPC_URL=.*$/gm, '');
  envContent = envContent.replace(/SOLANA_RPC=.*$/gm, '');
  envContent = envContent.replace(/BACKUP_RPC_URL=.*$/gm, '');
  envContent = envContent.replace(/USE_STREAMING_RPC=.*$/gm, '');
}

// Add multi-provider config
const primaryRpc = HELIUS_API_KEY ? 
  `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}` :
  (ALCHEMY_API_KEY ? 
    `https://solana-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}` : 
    "https://solana-api.syndica.io/rpc");

const envUpdates = `
# Multi-Provider RPC Configuration
RPC_URL=${primaryRpc}
SOLANA_RPC=${primaryRpc}
USE_MULTI_PROVIDER=true
USE_RPC_CACHING=true
`;

fs.writeFileSync(envPath, envContent + envUpdates);
console.log('✅ Updated environment variables with multi-provider configuration');

// Create RPC provider manager
const rpcManagerCode = `/**
 * Multi-Provider RPC Manager
 * 
 * This module manages multiple RPC providers and handles failover,
 * load balancing, and caching.
 */

import { Connection, PublicKey, VersionedTransaction, SendOptions } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// Load config
const CONFIG_PATH = path.join(__dirname, '../config/multi-rpc-config.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

// Set up connections for each provider
const connections = config.providers
  .filter(provider => provider.inUse)
  .map(provider => ({
    name: provider.name,
    connection: new Connection(provider.url),
    url: provider.url,
    priority: provider.priority,
    weight: provider.weight,
    rateLimit: provider.rateLimit,
    lastUsed: 0,
    errorCount: 0,
    requestCount: 0,
    cooldownUntil: 0
  }));

// Cache implementation
const cache = new Map();

// Get the best connection based on priority, errors, and load
function getBestConnection() {
  const now = Date.now();
  
  // Filter out connections on cooldown
  const availableConnections = connections.filter(conn => now > conn.cooldownUntil);
  
  if (availableConnections.length === 0) {
    // If all are on cooldown, use the one with shortest cooldown remaining
    connections.sort((a, b) => a.cooldownUntil - b.cooldownUntil);
    return connections[0];
  }
  
  // Sort by priority first, then by errors and request count
  availableConnections.sort((a, b) => {
    // Primary sort by priority (lower value = higher priority)
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    
    // Secondary sort by error count
    if (a.errorCount !== b.errorCount) {
      return a.errorCount - b.errorCount;
    }
    
    // Tertiary sort by recent usage and weight
    const aLoad = a.requestCount / a.weight;
    const bLoad = b.requestCount / b.weight;
    return aLoad - bLoad;
  });
  
  return availableConnections[0];
}

// Register a successful request
function registerSuccess(connection) {
  connection.lastUsed = Date.now();
  connection.requestCount++;
  
  // Reset consecutive error counter on success
  connection.consecutiveErrors = 0;
}

// Register a failed request
function registerError(connection) {
  connection.errorCount++;
  connection.consecutiveErrors = (connection.consecutiveErrors || 0) + 1;
  
  // Apply exponential backoff for consecutive errors
  if (connection.consecutiveErrors >= 3) {
    const cooldownMs = Math.min(30000, Math.pow(2, connection.consecutiveErrors) * 1000);
    connection.cooldownUntil = Date.now() + cooldownMs;
    console.log(\`[RPC Manager] Cooling down \${connection.name} for \${cooldownMs/1000}s due to errors\`);
  }
}

// Make a cached RPC request
async function makeRequest(method, params = []) {
  // Generate cache key
  const cacheKey = \`\${method}:\${JSON.stringify(params)}\`;
  
  // Check cache first
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() < cached.expiry) {
      return cached.data;
    }
  }
  
  // Try each connection until success
  let lastError;
  
  for (let attempt = 0; attempt < config.fallback.maxRetries; attempt++) {
    const connection = getBestConnection();
    
    try {
      console.log(\`[RPC Manager] Using \${connection.name} for \${method}\`);
      
      // Make the request
      const response = await connection.connection.rpcRequest(method, params);
      registerSuccess(connection);
      
      // Determine cache TTL based on method
      let ttl = 30000; // Default: 30 seconds
      
      if (method.includes('getTransaction') || method.includes('getSignature')) {
        ttl = config.caching.transactionTtlMs;
      } else if (method.includes('getAccountInfo')) {
        ttl = config.caching.accountInfoTtlMs;
      } else if (method.includes('getBalance')) {
        ttl = config.caching.balanceTtlMs;
      } else if (method.includes('getSlot')) {
        ttl = config.caching.slotTtlMs;
      } else if (method.includes('getBlock')) {
        ttl = config.caching.blockTtlMs;
      }
      
      // Cache the result
      if (config.caching.enabled) {
        cache.set(cacheKey, {
          data: response.result,
          expiry: Date.now() + ttl
        });
      }
      
      return response.result;
    } catch (error) {
      console.error(\`[RPC Manager] Error with \${connection.name}: \${error.message}\`);
      registerError(connection);
      lastError = error;
      
      // Wait before retry if needed
      if (attempt < config.fallback.maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, config.fallback.retryDelayMs));
      }
    }
  }
  
  // If we got here, all connections failed
  throw lastError || new Error('All RPC providers failed');
}

// Periodic connection health check
function startHealthCheck() {
  setInterval(async () => {
    for (const connection of connections) {
      try {
        await connection.connection.getSlot();
        console.log(\`[RPC Manager] Health check OK: \${connection.name}\`);
        
        // Reset error count on successful health check
        if (connection.errorCount > 0) {
          connection.errorCount = Math.max(0, connection.errorCount - 1);
        }
      } catch (error) {
        console.error(\`[RPC Manager] Health check failed: \${connection.name}\`);
        registerError(connection);
      }
    }
  }, config.loadBalancing.healthCheckIntervalMs);
}

// Start health checks if enabled
if (config.loadBalancing.enabled) {
  startHealthCheck();
}

// Exported methods that mirror the Connection API
export async function getBalance(pubkey: string | PublicKey): Promise<number> {
  const address = typeof pubkey === 'string' ? pubkey : pubkey.toBase58();
  return makeRequest('getBalance', [address]);
}

export async function getAccountInfo(pubkey: string | PublicKey, commitment?: string): Promise<any> {
  const address = typeof pubkey === 'string' ? pubkey : pubkey.toBase58();
  return makeRequest('getAccountInfo', [address, {commitment, encoding: 'jsonParsed'}]);
}

export async function getRecentBlockhash(): Promise<string> {
  const result = await makeRequest('getLatestBlockhash');
  return result.blockhash;
}

export async function sendTransaction(
  transaction: VersionedTransaction | Buffer | Uint8Array | string,
  options?: SendOptions
): Promise<string> {
  // Try sending on all providers until one succeeds
  let lastError;
  
  for (const connection of connections) {
    try {
      // Don't use higher level makeRequest to avoid caching and stay close to native API
      const signature = await connection.connection.sendRawTransaction(
        transaction instanceof VersionedTransaction ? transaction.serialize() : transaction,
        options
      );
      registerSuccess(connection);
      return signature;
    } catch (error) {
      console.error(\`[RPC Manager] Error sending transaction with \${connection.name}: \${error.message}\`);
      registerError(connection);
      lastError = error;
    }
  }
  
  throw lastError || new Error('Failed to send transaction on all providers');
}

export async function confirmTransaction(signature: string, commitment?: string): Promise<any> {
  // Don't cache confirmations
  const conn = getBestConnection();
  try {
    const result = await conn.connection.confirmTransaction(signature, commitment);
    registerSuccess(conn);
    return result;
  } catch (error) {
    registerError(conn);
    throw error;
  }
}

export async function getTokenAccountsByOwner(
  owner: string | PublicKey,
  filter: any,
  commitment?: string
): Promise<any> {
  const ownerAddress = typeof owner === 'string' ? owner : owner.toBase58();
  return makeRequest('getTokenAccountsByOwner', [ownerAddress, filter, {commitment, encoding: 'jsonParsed'}]);
}

export async function getProgramAccounts(
  programId: string | PublicKey,
  config?: any
): Promise<any> {
  const programAddress = typeof programId === 'string' ? programId : programId.toBase58();
  return makeRequest('getProgramAccounts', [programAddress, config]);
}

// Get current connection health and stats
export function getConnectionStats() {
  return connections.map(conn => ({
    name: conn.name,
    priority: conn.priority,
    weight: conn.weight,
    requestCount: conn.requestCount,
    errorCount: conn.errorCount,
    cooldownUntil: conn.cooldownUntil > Date.now() ? new Date(conn.cooldownUntil).toISOString() : null,
    url: conn.url
  }));
}

// Periodically clean up cache
setInterval(() => {
  const now = Date.now();
  let removedCount = 0;
  
  for (const [key, value] of cache.entries()) {
    if (value.expiry < now) {
      cache.delete(key);
      removedCount++;
    }
  }
  
  if (removedCount > 0) {
    console.log(\`[RPC Manager] Cleaned up \${removedCount} expired cache entries\`);
  }
}, 60000); // Every minute

// Export a raw connection for cases where direct access is needed
export function getRawConnection() {
  return getBestConnection().connection;
}`;

// Create directory and save the file
fs.mkdirSync('./src/utils', { recursive: true });
fs.writeFileSync('./src/utils/rpc-manager.ts', rpcManagerCode);
console.log('✅ Created multi-provider RPC manager at ./src/utils/rpc-manager.ts');

// Create usage example
const exampleCode = `/**
 * Multi-Provider RPC Manager Usage Example
 * 
 * This file shows how to use the optimized multi-provider RPC manager.
 */

import { 
  getBalance, 
  getAccountInfo, 
  getRecentBlockhash, 
  sendTransaction, 
  getConnectionStats
} from './utils/rpc-manager';
import { PublicKey } from '@solana/web3.js';

// Example usage
async function exampleUsage() {
  try {
    // Get wallet balance
    const walletAddress = '${MAIN_WALLET_ADDRESS}';
    const balance = await getBalance(walletAddress);
    console.log(\`Wallet balance: \${balance / 1_000_000_000} SOL\`);
    
    // Get account info
    const accountInfo = await getAccountInfo(walletAddress);
    console.log('Account info:', accountInfo);
    
    // Get recent blockhash
    const blockhash = await getRecentBlockhash();
    console.log('Recent blockhash:', blockhash);
    
    // Check connection stats
    const stats = getConnectionStats();
    console.log('RPC Connection Stats:');
    console.table(stats);
  } catch (error) {
    console.error('Error in example usage:', error);
  }
}

// Run the example
exampleUsage();`;

fs.writeFileSync('./src/rpc-example.ts', exampleCode);
console.log('✅ Created usage example at ./src/rpc-example.ts');

// Create restart script
const restartScript = `#!/bin/bash
# Restart trading system with multi-provider RPC configuration

echo "========================================"
echo "    RESTARTING TRADING SYSTEM          "
echo "    WITH MULTI-PROVIDER RPC            "
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
mkdir -p data/rpc_cache
find ./data/rpc_cache -name "*.json" -mmin +60 -delete 2>/dev/null || true

# Export environment variables
export USE_MULTI_PROVIDER=true
export USE_RPC_CACHING=true
export PRIMARY_RPC="${primaryRpc}"

# Start system
echo "Starting trading system with multi-provider RPC..."
./launch-enhanced-system.sh &

echo "System restarted with multi-provider RPC configuration"
echo "========================================"
`;

fs.writeFileSync('./restart-with-multi-provider.sh', restartScript);
fs.chmodSync('./restart-with-multi-provider.sh', 0o755); // Make executable
console.log('✅ Created restart script at ./restart-with-multi-provider.sh');

console.log('\n=== MULTI-PROVIDER RPC CONFIGURATION COMPLETE ===');
console.log('The system is now configured to use multiple RPC providers with:');
console.log('1. Automatic failover between providers');
console.log('2. Provider health monitoring');
console.log('3. Priority-based load balancing');
console.log('4. Aggressive response caching');

console.log('\nTo restart the system with this configuration, run:');
console.log('./restart-with-multi-provider.sh');

// Check if keys are available
if (!HELIUS_API_KEY && !ALCHEMY_API_KEY) {
  console.log('\n⚠️ No premium API keys detected!');
  console.log('For better performance, add your API keys to .env:');
  console.log('HELIUS_API_KEY=your_key_here');
  console.log('ALCHEMY_API_KEY=your_key_here');
}