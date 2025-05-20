/**
 * Extreme Rate Limit Fix
 * 
 * This script implements extreme measures to fix rate limit issues:
 * 1. Completely disables Instant Nodes (exhausted)
 * 2. Forces Helius as primary provider
 * 3. Implements super-aggressive caching (5-10 minutes)
 * 4. Reduces request frequency to absolute minimum
 */

import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Load environment variables
config();

console.log('=== APPLYING EXTREME RATE LIMIT FIX ===');

// Create necessary directories
const CONFIG_DIR = './config';
const CACHE_DIR = './data/rpc_cache';

if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// 1. Update RPC configuration with extreme caching
const RPC_CONFIG_PATH = path.join(CONFIG_DIR, 'multi-rpc-config.json');
if (fs.existsSync(RPC_CONFIG_PATH)) {
  console.log('Updating RPC configuration with extreme settings...');
  
  try {
    const rpcConfig = JSON.parse(fs.readFileSync(RPC_CONFIG_PATH, 'utf8'));
    
    // Super-aggressive caching
    if (rpcConfig.caching) {
      rpcConfig.caching.enabled = true;
      rpcConfig.caching.accountInfoTtlMs = 300000;     // 5 minutes (was 30s)
      rpcConfig.caching.balanceTtlMs = 300000;         // 5 minutes (was 30s)
      rpcConfig.caching.transactionTtlMs = 86400000;   // 24 hours (was 1h)
      rpcConfig.caching.blockTtlMs = 600000;           // 10 minutes (was 1m)
      rpcConfig.caching.slotTtlMs = 60000;             // 1 minute (was 10s)
    }
    
    // Modify provider configuration
    if (rpcConfig.providers) {
      // Filter out Instant Nodes entirely
      rpcConfig.providers = rpcConfig.providers.filter(provider => 
        !provider.name.includes("Instant Nodes")
      );
      
      // Ensure Helius is first with highest priority
      const heliusProviders = rpcConfig.providers.filter(p => p.name === "Helius");
      const otherProviders = rpcConfig.providers.filter(p => p.name !== "Helius");
      
      if (heliusProviders.length > 0) {
        heliusProviders[0].priority = 1;
        heliusProviders[0].weight = 10;
      }
      
      rpcConfig.providers = [...heliusProviders, ...otherProviders];
    }
    
    // Add extreme rate limiting
    rpcConfig.rateLimit = {
      enabled: true,
      strategy: "fixed",
      maxRequestsPerSecond: 3,       // Only 3 requests per second
      maxRequestsPerMinute: 120,     // Only 120 requests per minute
      maxRequestsPerHour: 3000       // Only 3000 requests per hour
    };
    
    // Save updated config
    fs.writeFileSync(RPC_CONFIG_PATH, JSON.stringify(rpcConfig, null, 2));
    console.log('✅ Updated RPC configuration with extreme settings');
  } catch (error) {
    console.error('Error updating RPC config:', error);
  }
}

// 2. Update .env file with extreme rate limit settings
const envPath = './.env';
let envContent = '';

if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
  
  // Remove old settings
  envContent = envContent.replace(/RATE_LIMIT_FIX=.*$/gm, '');
  envContent = envContent.replace(/USE_INSTANT_NODES=.*$/gm, '');
  envContent = envContent.replace(/MAX_REQUESTS_PER_SECOND=.*$/gm, '');
  envContent = envContent.replace(/USE_AGGRESSIVE_CACHING=.*$/gm, '');
}

// Add extreme rate limit settings
const envUpdates = `
# Extreme Rate Limit Fix Configuration
RATE_LIMIT_FIX=true
USE_INSTANT_NODES=false
MAX_REQUESTS_PER_SECOND=3
USE_AGGRESSIVE_CACHING=true
FORCE_HELIUS=true
DISABLE_BACKGROUND_TASKS=true
REDUCE_POLLING_FREQUENCY=true
`;

fs.writeFileSync(envPath, envContent + envUpdates);
console.log('✅ Updated environment variables with extreme rate limit settings');

// 3. Create disk cache setup script
const cacheSetupScript = `/**
 * Setup Enhanced Disk Cache
 */

import * as fs from 'fs';
import * as path from 'path';

const CACHE_DIR = './data/rpc_cache';

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Create .cache file to indicate cache is active
fs.writeFileSync(path.join(CACHE_DIR, '.cache'), 'ACTIVE');

// Simple in-memory cache
const memoryCache = new Map();

// Export cache functions
export function getCachedData(key, defaultTtlMs = 300000) {
  // Check memory cache first
  if (memoryCache.has(key)) {
    const item = memoryCache.get(key);
    if (Date.now() < item.expiry) {
      return item.data;
    }
    memoryCache.delete(key);
  }
  
  // Then check disk cache
  const cacheFile = path.join(CACHE_DIR, \`\${key}.json\`);
  
  if (fs.existsSync(cacheFile)) {
    try {
      const stats = fs.statSync(cacheFile);
      const fileAge = Date.now() - stats.mtimeMs;
      
      if (fileAge < defaultTtlMs) {
        const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        
        // Also store in memory for faster access next time
        memoryCache.set(key, {
          data,
          expiry: Date.now() + defaultTtlMs
        });
        
        return data;
      }
    } catch (error) {
      console.error('Cache read error:', error);
    }
  }
  
  return null;
}

export function setCachedData(key, data, ttlMs = 300000) {
  // Set in memory cache
  memoryCache.set(key, {
    data,
    expiry: Date.now() + ttlMs
  });
  
  // Also set in disk cache
  const cacheFile = path.join(CACHE_DIR, \`\${key}.json\`);
  
  try {
    fs.writeFileSync(cacheFile, JSON.stringify(data));
  } catch (error) {
    console.error('Cache write error:', error);
  }
}

console.log('Enhanced disk cache system initialized');
`;

fs.writeFileSync('./src/utils/cache.ts', cacheSetupScript);
console.log('✅ Created enhanced disk cache system');

// 4. Create restart script with extreme rate limit fix
const restartScript = `#!/bin/bash
# Restart with Extreme Rate Limit Fix

echo "========================================"
echo "   RESTARTING WITH EXTREME RATE FIX    "
echo "========================================"

# Stop running processes
echo "Stopping current processes..."
pkill -f "ts-node" || true
pkill -f "npx tsx" || true
pkill -f "activate-" || true
sleep 2

# Clear temporary files
echo "Cleaning temporary files..."
find ./data -name "temp_*" -delete 2>/dev/null || true
find ./logs -name "*.log" -mmin +60 -delete 2>/dev/null || true

# Export environment variables
export RATE_LIMIT_FIX=true
export USE_INSTANT_NODES=false
export MAX_REQUESTS_PER_SECOND=3
export USE_AGGRESSIVE_CACHING=true
export FORCE_HELIUS=true
export DISABLE_BACKGROUND_TASKS=true
export REDUCE_POLLING_FREQUENCY=true
export SYSTEM_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export TRADING_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK

# Start system with minimal polling
echo "Starting system with extreme rate limit fix..."
npx tsx activate-live-trading.ts

echo "System restarted with extreme rate limit fix"
echo "========================================"
`;

fs.writeFileSync('./restart-extreme-fix.sh', restartScript);
fs.chmodSync('./restart-extreme-fix.sh', 0o755);
console.log('✅ Created restart script at ./restart-extreme-fix.sh');

console.log('\n=== EXTREME RATE LIMIT FIX COMPLETE ===');
console.log('To restart the system with these extreme fixes, run:');
console.log('./restart-extreme-fix.sh');