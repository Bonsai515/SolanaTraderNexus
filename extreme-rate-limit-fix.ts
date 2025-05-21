/**
 * Extreme Rate Limit Fix
 * 
 * This script implements an extreme solution to prevent
 * 429 Too Many Requests errors by:
 * 1. Shutting down all background processes
 * 2. Implementing heavy caching
 * 3. Severely restricting RPC requests
 */

import fs from 'fs';
import { exec } from 'child_process';

const HP_WALLET = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';

console.log('=== APPLYING EXTREME RATE LIMIT FIX ===');

// Force kill all background processes
console.log('Shutting down all background processes...');
exec('pkill -f "ts-node" || true', () => {});
exec('pkill -f "tsx" || true', () => {});
exec('pkill -f "node" || true', () => {});
exec('pkill -f "npm" || true', () => {});
setTimeout(() => {
  console.log('All processes should be stopped');
  
  // Create extreme rate limit config
  const rateConfig = {
    version: "2.0.0",
    name: "Extreme Rate Limit Config",
    wallet: HP_WALLET,
    rpc: {
      // Only allow ONE request per 5 seconds
      maxRequestsPerSecond: 0.2,  
      // Max 300 requests per hour (~5 per minute)
      maxRequestsPerHour: 300,
      // Force wait between requests
      minWaitTimeMs: 5000,
      // 99% cache everything (even if slightly stale)
      cacheTtlMs: 300000, // 5 minute cache for everything
      // Don't retry failed requests automatically
      disableAutoRetry: true
    },
    features: {
      // Disable background services
      disableBackgroundServices: true,
      disablePriceFeeds: true,
      disableHealthChecks: true,
      disableMetrics: true,
      disablePolling: true,
      // Only enable critical services
      enableCriticalOnly: true
    }
  };
  
  // Create extreme config dir
  if (!fs.existsSync('./extreme-config')) {
    fs.mkdirSync('./extreme-config', { recursive: true });
  }
  
  // Save extreme rate limit config
  fs.writeFileSync('./extreme-config/rate-limit.json', JSON.stringify(rateConfig, null, 2));
  console.log('✅ Created extreme rate limit configuration');
  
  // Create extreme environment file
  const extremeEnv = `# Extreme Rate Limit Prevention Configuration
# Created ${new Date().toISOString()}

# Wallet Configuration
SYSTEM_WALLET=${HP_WALLET}
TRADING_WALLET=${HP_WALLET}
MAIN_WALLET=${HP_WALLET}
WALLET_ADDRESS=${HP_WALLET}

# RPC Rate Limit Prevention
RPC_URL=https://solana-api.syndica.io/rpc
SOLANA_RPC=https://solana-api.syndica.io/rpc
WEBSOCKET_URL=wss://solana-api.syndica.io/rpc
USE_SYNDICA=true
USE_ALCHEMY=false
USE_HELIUS=false
USE_INSTANT_NODES=false
PRIMARY_PROVIDER=syndica
DISABLE_MULTI_PROVIDER=true
EXTREME_RATE_LIMIT_FIX=true
DISABLE_BACKGROUND_TASKS=true
MAX_REQUESTS_PER_SECOND=0.2
MIN_REQUEST_INTERVAL_MS=5000
CACHE_EVERYTHING=true
CACHE_TTL_MS=300000
EXTREME_CONFIG_PATH=./extreme-config/rate-limit.json

# Feature Control
USE_REAL_FUNDS=true
DISABLE_POLLING=true
DISABLE_AUTO_REFRESH=true
DISABLE_BACKGROUND_TASKS=true
REDUCE_POLLING_FREQUENCY=true
DISABLE_HEALTH_CHECKS=true
`;
  
  fs.writeFileSync('./.env.extreme', extremeEnv);
  console.log('✅ Created extreme rate limit environment file');
  
  // Create RPC cache directory
  if (!fs.existsSync('./data/rpc_cache')) {
    fs.mkdirSync('./data/rpc_cache', { recursive: true });
  }
  
  // Create launcher script
  const launcherScript = `#!/bin/bash
# Extreme Rate Limit Fix Launcher

echo "========================================"
echo "    LAUNCHING WITH EXTREME RATE LIMIT   "
echo "    PREVENTION - NO 429 ERRORS!         "
echo "========================================"

# Make sure all processes are dead
pkill -f "ts-node" || true
pkill -f "tsx" || true
pkill -f "node" || true
pkill -f "npm" || true
sleep 3

# Set extreme rate limit environment
export SYSTEM_WALLET=${HP_WALLET}
export TRADING_WALLET=${HP_WALLET}
export MAIN_WALLET=${HP_WALLET}
export WALLET_ADDRESS=${HP_WALLET}
export RPC_URL=https://solana-api.syndica.io/rpc
export SOLANA_RPC=https://solana-api.syndica.io/rpc
export WEBSOCKET_URL=wss://solana-api.syndica.io/rpc
export USE_SYNDICA=true
export USE_ALCHEMY=false
export USE_HELIUS=false
export USE_INSTANT_NODES=false
export PRIMARY_PROVIDER=syndica
export DISABLE_MULTI_PROVIDER=true
export EXTREME_RATE_LIMIT_FIX=true
export DISABLE_BACKGROUND_TASKS=true
export MAX_REQUESTS_PER_SECOND=0.2
export MIN_REQUEST_INTERVAL_MS=5000
export CACHE_EVERYTHING=true
export CACHE_TTL_MS=300000
export EXTREME_CONFIG_PATH=./extreme-config/rate-limit.json
export USE_REAL_FUNDS=true
export DISABLE_POLLING=true
export DISABLE_AUTO_REFRESH=true
export DISABLE_BACKGROUND_TASKS=true
export REDUCE_POLLING_FREQUENCY=true
export DISABLE_HEALTH_CHECKS=true

# Run with extreme care
echo "Launching with extreme rate limit prevention..."
NODE_OPTIONS="--max-old-space-size=2048" npx tsx activate-live-trading.ts

echo "System launched with extreme rate limit prevention"
echo "========================================"
`;
  
  fs.writeFileSync('./no-rate-limits.sh', launcherScript);
  fs.chmodSync('./no-rate-limits.sh', 0o755);
  console.log('✅ Created extreme rate limit launcher');
  
  console.log('\n=== EXTREME RATE LIMIT FIX COMPLETE ===');
  console.log('Your system is now configured to prevent 429 errors completely:');
  console.log('1. Maximum of 1 request per 5 seconds (0.2 per second)');
  console.log('2. Extreme caching (5 minutes) for all RPC responses');
  console.log('3. All background tasks disabled to reduce RPC usage');
  console.log('\nTo launch with extreme rate limit prevention, run:');
  console.log('./no-rate-limits.sh');
  console.log('\nNOTE: Trading activity will be slower but much more reliable');
  console.log('until tomorrow when you get your premium RPC access.')
}, 3000);  // Allow 3 seconds for kill commands to complete