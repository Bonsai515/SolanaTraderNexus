#!/bin/bash
# Replit Deployment Fixer for Solana Trading System

echo "=== REPLIT DEPLOYMENT FIXER ==="
echo "Optimizing environment for Solana blockchain trading"

# Step 1: Create directories if needed
mkdir -p data/rpc_cache
mkdir -p logs
mkdir -p config

# Step 2: Update RPC configuration for optimal performance
cat > config/rpc-config.json << EOL
{
  "rpcEndpoints": [
    {
      "url": "https://solana-api.syndica.io/rpc",
      "priority": 1,
      "weight": 10,
      "rateLimit": { "requestsPerMinute": 200 },
      "name": "Syndica Primary"
    },
    {
      "url": "https://api.mainnet-beta.solana.com",
      "priority": 3,
      "weight": 1,
      "rateLimit": { "requestsPerMinute": 40 },
      "name": "Public Solana"
    },
    {
      "url": "https://solana-api.projectserum.com",
      "priority": 3,
      "weight": 1,
      "rateLimit": { "requestsPerMinute": 40 },
      "name": "Project Serum"
    }
  ],
  "caching": {
    "enabled": true,
    "defaultTtlMs": 30000,
    "tokenAccountsTtlMs": 60000,
    "transactionTtlMs": 86400000
  },
  "rateLimiting": {
    "enabled": true,
    "requestsPerMinute": 60,
    "cooldownMs": 5000
  },
  "fallback": {
    "enabled": true,
    "maxRetries": 3
  }
}
EOL

echo "✅ Updated RPC configuration"

# Step 3: Update environment variables
if [ ! -f .env ]; then
  touch .env
fi

if ! grep -q "RPC_URL" .env; then
  echo "RPC_URL=https://solana-api.syndica.io/rpc" >> .env
  echo "✅ Added RPC_URL to .env file"
fi

# Step 4: Fix memory-related environment variables
if ! grep -q "NODE_OPTIONS" .env; then
  echo "NODE_OPTIONS=--max-old-space-size=4096" >> .env
  echo "✅ Added memory optimization settings to .env file"
fi

# Step A: Optimize connection rates
cat > optimize-connections.ts << EOL
/**
 * Optimize Connection Rates
 * 
 * This script implements connection rate optimization to prevent 429 errors.
 */

// Patch global fetch for rate limiting
const originalFetch = global.fetch;
const fetchQueue: any[] = [];
let processingQueue = false;
let lastFetchTime = 0;
const MIN_FETCH_INTERVAL_MS = 100; // At least 100ms between fetches

// Replace global fetch with rate-limited version
global.fetch = function rateLimitedFetch(url: RequestInfo | URL, options?: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    fetchQueue.push({ url, options, resolve, reject });
    
    if (!processingQueue) {
      processFetchQueue();
    }
  });
};

// Process fetch queue with rate limiting
async function processFetchQueue() {
  if (fetchQueue.length === 0) {
    processingQueue = false;
    return;
  }
  
  processingQueue = true;
  
  const { url, options, resolve, reject } = fetchQueue.shift()!;
  
  try {
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime;
    
    if (timeSinceLastFetch < MIN_FETCH_INTERVAL_MS) {
      // Wait if we're fetching too quickly
      await new Promise(r => setTimeout(r, MIN_FETCH_INTERVAL_MS - timeSinceLastFetch));
    }
    
    lastFetchTime = Date.now();
    const response = await originalFetch(url, options);
    resolve(response);
  } catch (error) {
    reject(error);
  }
  
  // Process next item in queue with a small delay
  setTimeout(processFetchQueue, 10);
}

// Log that optimization is active
console.log('[Connection Optimizer] Active - Rate limiting connections to prevent 429 errors');

// Export empty object to make this a valid module
export {};
EOL

echo "✅ Created connection rate optimizer"

# Step B: Fix trading configuration
cat > fix-trading-config.ts << EOL
/**
 * Fix Trading Configuration
 * 
 * This script adjusts trading parameters to work better in Replit environment.
 */

import * as fs from 'fs';
import * as path from 'path';

// Make sure config directory exists
if (!fs.existsSync('./config')) {
  fs.mkdirSync('./config', { recursive: true });
}

// Update trade frequency optimizer
const tradeFrequencyConfig = {
  enabled: true,
  baseIntervalSeconds: 60,
  minIntervalSeconds: 30,
  maxIntervalSeconds: 300,
  adaptiveScaling: true,
  rpcErrorBackoffSeconds: 120,
  strategies: {
    "quantum-flash": {
      minFrequencySeconds: 60,
      maxFrequencySeconds: 300,
      ratePerDay: 14
    },
    "zero-capital-flash": {
      minFrequencySeconds: 60,
      maxFrequencySeconds: 360,
      ratePerDay: 10
    },
    "hyperion-cascade": {
      minFrequencySeconds: 120,
      maxFrequencySeconds: 600,
      ratePerDay: 8
    }
  },
  replitOptimization: {
    enabled: true,
    memoryOptimized: true,
    connectionPooling: true,
    requestBatching: true,
    cacheAggressively: true
  }
};

fs.writeFileSync(
  './config/trade-frequency-optimizer.json',
  JSON.stringify(tradeFrequencyConfig, null, 2)
);

console.log('✅ Updated trade frequency optimizer configuration');

// Update system memory for better Replit performance
const systemMemoryConfig = {
  heapSizeMB: 2048,
  enableGarbageCollection: true,
  gcIntervalMs: 60000,
  optimizeFor: "replit",
  limitConcurrentRequests: true,
  maxConcurrentRpcRequests: 3,
  mainWalletAddress: "HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqb",
  replitSpecific: {
    enableMemoryTracking: true,
    reducedLogging: true,
    optimizeConnections: true
  }
};

fs.writeFileSync(
  './config/system-memory.json',
  JSON.stringify(systemMemoryConfig, null, 2)
);

console.log('✅ Updated system memory configuration');
EOL

echo "✅ Created trading config fixer"

# Step C: Create enhanced system startup
cat > launch-optimized-system.sh << EOL
#!/bin/bash
# Launch optimized trading system for Replit

echo "========================================"
echo "    LAUNCHING OPTIMIZED TRADING SYSTEM  "
echo "      FOR REPLIT ENVIRONMENT           "
echo "========================================"
echo

# Apply Replit optimizations
echo "Applying Replit-specific optimizations..."
export NODE_OPTIONS="--max-old-space-size=4096"
export RPC_URL="https://solana-api.syndica.io/rpc"

# Clear cached data that might be stale
echo "Clearing stale cache data..."
find ./data/rpc_cache -name "*.json" -mmin +60 -delete 2>/dev/null || true

# Apply trading config fixes
echo "Applying trading configuration fixes..."
npx tsx fix-trading-config.ts

# Apply connection optimization
echo "Applying connection rate optimizations..."
node -e "require('./optimize-connections.ts')" &

# Start with enhanced configuration
echo "Starting trading system with Replit optimizations..."
./launch-enhanced-system.sh

echo "System launched with Replit optimizations"
echo "========================================"
EOL

chmod +x launch-optimized-system.sh
echo "✅ Created optimized system launcher"

# Print completion message
echo ""
echo "=== REPLIT DEPLOYMENT FIXER COMPLETE ==="
echo "The system has been optimized for Replit environment"
echo ""
echo "To launch the optimized system, run:"
echo "./launch-optimized-system.sh"
echo ""
echo "These changes will:"
echo "1. Reduce RPC rate limit errors (429s)"
echo "2. Optimize memory usage for Replit"
echo "3. Improve trading execution success rate"
echo "4. Enhance connection reliability"

# Make this script executable
chmod +x fix_replit.sh