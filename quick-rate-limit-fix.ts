/**
 * Quick Rate Limit Fix
 * 
 * This script implements simple fixes to reduce rate limit issues:
 * 1. Disables the exhausted Instant Nodes provider
 * 2. Increases retry delays and cache times
 * 3. Reduces request frequency
 */

import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Load environment variables
config();

console.log('=== APPLYING QUICK RATE LIMIT FIX ===');

// Make sure config directory exists
const CONFIG_DIR = './config';
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Update RPC configuration
const RPC_CONFIG_PATH = path.join(CONFIG_DIR, 'multi-rpc-config.json');

if (fs.existsSync(RPC_CONFIG_PATH)) {
  console.log('Updating RPC configuration...');
  
  try {
    const rpcConfig = JSON.parse(fs.readFileSync(RPC_CONFIG_PATH, 'utf8'));
    
    // Increase cache duration
    if (rpcConfig.caching) {
      rpcConfig.caching.accountInfoTtlMs = 60000;     // 1 minute (was 30s)
      rpcConfig.caching.balanceTtlMs = 60000;         // 1 minute (was 30s)
      rpcConfig.caching.transactionTtlMs = 7200000;   // 2 hours (was 1h)
      rpcConfig.caching.blockTtlMs = 120000;          // 2 minutes (was 1m)
      rpcConfig.caching.slotTtlMs = 20000;            // 20 seconds (was 10s)
    }
    
    // Disable Instant Nodes since it's exhausted
    if (rpcConfig.providers) {
      rpcConfig.providers = rpcConfig.providers.map(provider => {
        if (provider.name === "Instant Nodes") {
          provider.inUse = false;  // Disable InstantNodes
        }
        return provider;
      });
    }
    
    // Save updated config
    fs.writeFileSync(RPC_CONFIG_PATH, JSON.stringify(rpcConfig, null, 2));
    console.log('✅ Updated RPC configuration');
  } catch (error) {
    console.error('Error updating RPC config:', error);
  }
}

// Update .env file with rate limit fix environment variables
const envPath = './.env';
let envContent = '';

if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
  
  // Remove old rate limit settings
  envContent = envContent.replace(/RATE_LIMIT_FIX=.*$/gm, '');
  envContent = envContent.replace(/USE_INSTANT_NODES=.*$/gm, '');
}

// Add rate limit fix environment variables
const envUpdates = `
# Rate Limit Fix Configuration
RATE_LIMIT_FIX=true
USE_INSTANT_NODES=false
MAX_REQUESTS_PER_SECOND=10
USE_AGGRESSIVE_CACHING=true
`;

fs.writeFileSync(envPath, envContent + envUpdates);
console.log('✅ Updated environment variables with rate limit fix settings');

// Create a simple script to restart with rate limit fix
const restartScript = `#!/bin/bash
# Restart with Rate Limit Fix

echo "========================================"
echo "    RESTARTING WITH RATE LIMIT FIX     "
echo "========================================"

# Stop running processes
echo "Stopping current processes..."
pkill -f "ts-node" || true
pkill -f "npx tsx" || true
pkill -f "activate-" || true
sleep 2

# Export environment variables
export RATE_LIMIT_FIX=true
export USE_INSTANT_NODES=false
export MAX_REQUESTS_PER_SECOND=10
export USE_AGGRESSIVE_CACHING=true

# Start system
echo "Starting system with rate limit fix..."
npx tsx activate-live-trading.ts

echo "System restarted with rate limit fix"
echo "========================================"
`;

fs.writeFileSync('./restart-with-rate-fix.sh', restartScript);
fs.chmodSync('./restart-with-rate-fix.sh', 0o755);
console.log('✅ Created restart script at ./restart-with-rate-fix.sh');

console.log('\n=== QUICK RATE LIMIT FIX COMPLETE ===');
console.log('To restart the system with these fixes, run:');
console.log('./restart-with-rate-fix.sh');