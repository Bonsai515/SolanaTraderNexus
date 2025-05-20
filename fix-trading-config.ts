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
