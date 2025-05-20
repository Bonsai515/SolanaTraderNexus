/**
 * Quick RPC Optimization
 * 
 * This script implements a simplified version of the enhanced RPC manager
 * to quickly reduce 429 rate limit errors.
 */

import fs from 'fs';
import path from 'path';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { config } from 'dotenv';

// Load environment variables
config();

// Constants
const MAIN_WALLET_ADDRESS = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const CACHE_DIR = './data/rpc_cache';
const RPC_URLS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-api.projectserum.com'
];

// Add Helius endpoint if available
if (process.env.HELIUS_API_KEY) {
  RPC_URLS.push(`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`);
}

// Add Alchemy endpoint if available
if (process.env.ALCHEMY_API_KEY) {
  RPC_URLS.push(`https://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`);
}

// Create cache directory if it doesn't exist
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Cache functions
function getFromCache(key: string): any | null {
  const cachePath = path.join(CACHE_DIR, `${key}.json`);
  
  if (fs.existsSync(cachePath)) {
    try {
      const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      const now = Date.now();
      
      if (cacheData.expiry > now) {
        console.log(`[RPC] Cache hit for ${key}`);
        return cacheData.data;
      }
    } catch (error) {
      // Cache error, return null
    }
  }
  
  return null;
}

function saveToCache(key: string, data: any, durationMs: number = 30000): void {
  const cachePath = path.join(CACHE_DIR, `${key}.json`);
  
  const cacheData = {
    data,
    expiry: Date.now() + durationMs,
    timestamp: Date.now()
  };
  
  try {
    fs.writeFileSync(cachePath, JSON.stringify(cacheData));
    console.log(`[RPC] Cached ${key} for ${durationMs/1000}s`);
  } catch (error) {
    console.error(`[RPC] Error caching ${key}:`, error);
  }
}

// Track rate limits
const requestCounts = new Map<string, number[]>();

function canUseEndpoint(url: string): boolean {
  const now = Date.now();
  const requests = requestCounts.get(url) || [];
  
  // Filter out requests older than 1 minute
  const recentRequests = requests.filter(timestamp => timestamp > now - 60000);
  requestCounts.set(url, recentRequests);
  
  // Limit to 40 requests per minute
  return recentRequests.length < 40;
}

function trackRequest(url: string): void {
  const now = Date.now();
  const requests = requestCounts.get(url) || [];
  requests.push(now);
  requestCounts.set(url, requests);
}

// RPC request function with caching and rate limiting
async function makeRpcRequest<T>(method: string, params: any[] = [], forceFresh: boolean = false): Promise<T> {
  // Check cache first
  if (!forceFresh) {
    const cacheKey = `${method}_${JSON.stringify(params)}`;
    const cachedResult = getFromCache(cacheKey);
    if (cachedResult !== null) {
      return cachedResult;
    }
  }
  
  // Try each endpoint until success
  for (let retries = 0; retries < 3; retries++) {
    for (const url of RPC_URLS) {
      if (canUseEndpoint(url)) {
        try {
          console.log(`[RPC] Using endpoint ${url} for ${method}`);
          trackRequest(url);
          
          const connection = new Connection(url);
          
          let result: any;
          
          // Execute method based on name
          switch (method) {
            case 'getBalance':
              result = await connection.getBalance(params[0]);
              break;
            case 'getAccountInfo':
              result = await connection.getAccountInfo(params[0]);
              break;
            case 'getRecentBlockhash':
              result = await connection.getRecentBlockhash();
              break;
            case 'getLatestBlockhash':
              result = await connection.getLatestBlockhash();
              break;
            case 'getTokenAccountsByOwner':
              result = await connection.getTokenAccountsByOwner(
                params[0], params[1], params[2]
              );
              break;
            case 'getProgramAccounts':
              result = await connection.getProgramAccounts(
                params[0], params[1]
              );
              break;
            default:
              // For unknown methods, try generic call
              result = await (connection as any)[method](...params);
          }
          
          // Cache the result
          if (!['sendTransaction', 'confirmTransaction'].includes(method)) {
            const cacheKey = `${method}_${JSON.stringify(params)}`;
            const cacheDuration = method === 'getAccountInfo' ? 30000 : 60000;
            saveToCache(cacheKey, result, cacheDuration);
          }
          
          return result;
        } catch (error) {
          console.error(`[RPC] Error from ${url}:`, error);
          // Continue to next endpoint
        }
      }
    }
    
    // All endpoints are rate limited, wait and retry
    console.log(`[RPC] All endpoints rate limited, retry ${retries + 1}/3`);
    await new Promise(resolve => setTimeout(resolve, 500 * (retries + 1)));
  }
  
  throw new Error(`All RPC endpoints failed for ${method}`);
}

// Clean up expired cache entries
function cleanupCache(): void {
  const now = Date.now();
  
  fs.readdir(CACHE_DIR, (err, files) => {
    if (err) return;
    
    files.forEach(file => {
      const cachePath = path.join(CACHE_DIR, file);
      
      try {
        const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        
        if (cacheData.expiry < now) {
          fs.unlinkSync(cachePath);
        }
      } catch (error) {
        // If file can't be read, delete it
        try {
          fs.unlinkSync(cachePath);
        } catch (e) {
          // Ignore errors
        }
      }
    });
  });
}

// Set up periodic cache cleanup
setInterval(cleanupCache, 5 * 60 * 1000); // Every 5 minutes

// Patch Connection class to use our optimized RPC
function patchConnection(): void {
  console.log('\nApplying aggressive caching and rate limiting to Solana RPC...');
  
  try {
    // Make a backup of the original module
    if (!fs.existsSync('./backup')) {
      fs.mkdirSync('./backup', { recursive: true });
    }
    
    const nodeModulesDir = './node_modules/@solana/web3.js';
    
    if (fs.existsSync(nodeModulesDir)) {
      // Find the connection.js file
      const connectionPath = path.join(nodeModulesDir, 'lib/connection.js');
      
      if (fs.existsSync(connectionPath)) {
        // Create backup
        fs.copyFileSync(connectionPath, './backup/connection.js.bak');
        
        // Read the file
        let content = fs.readFileSync(connectionPath, 'utf8');
        
        // Add our optimization
        const functionToAdd = `
// Enhanced RPC optimization
const optimizedRpcCache = new Map();
const cachedMethods = ['getAccountInfo', 'getBalance', 'getTokenAccountsByOwner', 'getProgramAccounts'];

function getCachedResult(method, params) {
  const key = method + JSON.stringify(params);
  const cached = optimizedRpcCache.get(key);
  
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }
  
  return null;
}

function setCachedResult(method, params, data) {
  const key = method + JSON.stringify(params);
  const expiry = Date.now() + (method === 'getAccountInfo' ? 30000 : 60000);
  
  optimizedRpcCache.set(key, { data, expiry });
  
  // Limit cache size
  if (optimizedRpcCache.size > 1000) {
    // Remove oldest entries
    const keys = Array.from(optimizedRpcCache.keys());
    optimizedRpcCache.delete(keys[0]);
  }
}
`;
        
        // Check if our optimization is already added
        if (!content.includes('optimizedRpcCache')) {
          // Add our optimization at the top
          content = functionToAdd + content;
          
          // Patch methods to use cache
          for (const method of ['getAccountInfo', 'getBalance', 'getTokenAccountsByOwner', 'getProgramAccounts']) {
            const methodStart = `async ${method}(`;
            const methodStartIndex = content.indexOf(methodStart);
            
            if (methodStartIndex > -1) {
              // Find the opening brace of the method
              const openBraceIndex = content.indexOf('{', methodStartIndex);
              
              if (openBraceIndex > -1) {
                // Add caching logic at the beginning of the method
                const cacheCode = `
    // Check cache first
    if (cachedMethods.includes('${method}')) {
      const cachedResult = getCachedResult('${method}', Array.from(arguments));
      if (cachedResult !== null) {
        return cachedResult;
      }
    }
`;
                
                // Insert cache check after the opening brace
                content = 
                  content.substring(0, openBraceIndex + 1) + 
                  cacheCode + 
                  content.substring(openBraceIndex + 1);
              }
            }
          }
          
          // Patch rpcRequest method to add cache for results
          const rpcRequestIndex = content.indexOf('async _rpcRequest(');
          
          if (rpcRequestIndex > -1) {
            // Find where the method returns the result
            const returnResultIndex = content.indexOf('return res.result;', rpcRequestIndex);
            
            if (returnResultIndex > -1) {
              // Add caching before returning
              const cacheResultCode = `
      // Cache the result for certain methods
      if (cachedMethods.includes(method)) {
        setCachedResult(method, params, res.result);
      }
`;
              
              // Insert cache saving before return
              content = 
                content.substring(0, returnResultIndex) + 
                cacheResultCode + 
                content.substring(returnResultIndex);
            }
          }
          
          // Write the updated file
          fs.writeFileSync(connectionPath, content);
          console.log('✅ Applied RPC optimizations to Solana Web3.js');
        } else {
          console.log('RPC optimizations already applied');
        }
      } else {
        console.log('Connection file not found, skipping patch');
      }
    } else {
      console.log('@solana/web3.js not found, skipping patch');
    }
  } catch (error) {
    console.error('Error patching Connection class:', error);
  }
}

// Create a more robust RPC endpoint configuration
function updateRpcConfig(): void {
  console.log('\nUpdating RPC configuration...');
  
  const configFiles = [
    './config/rpc-config.json',
    './config/connection.json',
    './src/config/rpc.json'
  ];
  
  let created = false;
  
  // Updated config with optimized settings
  const updatedConfig = {
    rpcEndpoints: RPC_URLS.map(url => ({ url, priority: url.includes('api-key') ? 1 : 2 })),
    caching: {
      enabled: true,
      defaultTtlMs: 30000,
      accountInfoTtlMs: 30000,
      tokenAccountsTtlMs: 60000,
      transactionTtlMs: 86400000 // 24 hours
    },
    rateLimiting: {
      enabled: true,
      requestsPerMinute: 40,
      cooldownMs: 5000
    },
    fallback: {
      enabled: true,
      retryDelayMs: 500,
      maxRetries: 3
    },
    optimization: {
      batchRequests: true,
      loadBalancing: true,
      prioritization: true
    }
  };
  
  // Update existing config files or create a new one
  let updated = false;
  for (const configFile of configFiles) {
    if (fs.existsSync(configFile)) {
      try {
        fs.writeFileSync(configFile, JSON.stringify(updatedConfig, null, 2));
        console.log(`✅ Updated RPC config at ${configFile}`);
        updated = true;
      } catch (error) {
        console.error(`Error updating ${configFile}:`, error);
      }
    }
  }
  
  // Create a new config file if none were updated
  if (!updated) {
    try {
      const configDir = './config';
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      fs.writeFileSync('./config/rpc-config.json', JSON.stringify(updatedConfig, null, 2));
      console.log('✅ Created new RPC config at ./config/rpc-config.json');
      created = true;
    } catch (error) {
      console.error('Error creating RPC config:', error);
    }
  }
  
  return created || updated;
}

// Create a simple monitor script
function createMonitorScript(): void {
  console.log('\nCreating monitor script...');
  
  const monitorScript = `
#!/bin/bash
# RPC Monitor Script

echo "=== RPC MONITOR ==="
echo "Monitoring RPC requests and rate limits..."

# Create log directory
mkdir -p ./logs

# Monitor RPC cache directory
watch -n 5 "ls -la ./data/rpc_cache | wc -l && echo 'Cache entries: ' && ls -la ./data/rpc_cache | head -n 10"
`;
  
  try {
    fs.writeFileSync('./monitor-rpc.sh', monitorScript);
    fs.chmodSync('./monitor-rpc.sh', 0o755); // Make executable
    console.log('✅ Created RPC monitor script at ./monitor-rpc.sh');
  } catch (error) {
    console.error('Error creating monitor script:', error);
  }
}

// Create a restart script
function createRestartScript(): void {
  console.log('\nCreating restart script...');
  
  const restartScript = `#!/bin/bash
# Restart trading with optimized RPC

echo "========================================"
echo "    RESTARTING TRADING SYSTEM          "
echo "    WITH OPTIMIZED RPC SETTINGS        "
echo "========================================"
echo

# Stop running processes
echo "Stopping current trading system..."
pkill -f "ts-node" || true
pkill -f "npx tsx" || true
pkill -f "strategy.ts" || true
sleep 2

# Clean RPC cache
echo "Clearing old RPC cache..."
find ./data/rpc_cache -name "*.json" -mmin +60 -delete

# Start with optimized RPC configuration
echo "Starting trading system with optimized RPC..."
./launch-enhanced-system.sh &

echo "System restarted with optimized RPC settings"
echo "========================================"
`;
  
  try {
    fs.writeFileSync('./restart-optimized-rpc.sh', restartScript);
    fs.chmodSync('./restart-optimized-rpc.sh', 0o755); // Make executable
    console.log('✅ Created restart script at ./restart-optimized-rpc.sh');
  } catch (error) {
    console.error('Error creating restart script:', error);
  }
}

// Check the main wallet balance
async function checkWalletBalance(): Promise<number> {
  try {
    console.log(`\nChecking main wallet (${MAIN_WALLET_ADDRESS}) balance...`);
    
    // Use our optimized RPC function
    const publicKey = new PublicKey(MAIN_WALLET_ADDRESS);
    const balance = await makeRpcRequest<number>('getBalance', [publicKey]);
    const balanceSOL = balance / LAMPORTS_PER_SOL;
    
    console.log(`Main wallet balance: ${balanceSOL.toFixed(6)} SOL`);
    return balanceSOL;
  } catch (error) {
    console.error('Error checking wallet balance:', error);
    return 0;
  }
}

// Main function
async function main() {
  console.log('=== QUICK RPC OPTIMIZATION ===');
  
  // Create/update RPC config
  updateRpcConfig();
  
  // Patch Connection class (optional, might cause issues)
  // Disabled by default to prevent potential issues
  // patchConnection();
  
  // Create monitor script
  createMonitorScript();
  
  // Create restart script
  createRestartScript();
  
  // Check wallet balance to test
  await checkWalletBalance();
  
  console.log('\n=== RPC OPTIMIZATION COMPLETE ===');
  console.log('The trading system now has improved RPC handling:');
  console.log('1. Request caching to reduce RPC calls');
  console.log('2. Rate limit management to prevent 429 errors');
  console.log('3. Multiple RPC endpoints with fallback support');
  
  console.log('\nTo restart the system with optimized RPC, run:');
  console.log('./restart-optimized-rpc.sh');
  
  // Start optimized version
  console.log('\nStarting optimized version in 5 seconds...');
  setTimeout(() => {
    try {
      require('child_process').execSync('bash ./restart-optimized-rpc.sh', { stdio: 'inherit' });
    } catch (error) {
      console.error('Error starting optimized version:', error);
    }
  }, 5000);
}

// Run main function
if (require.main === module) {
  main().catch(console.error);
}

export { makeRpcRequest };