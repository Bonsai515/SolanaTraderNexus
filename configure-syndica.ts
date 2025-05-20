/**
 * Configure Syndica RPC
 * 
 * This script configures the system to use Syndica as the primary RPC provider,
 * which will significantly reduce rate limit errors.
 */

import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Load environment variables
config();

// Constants
const MAIN_WALLET_ADDRESS = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const CONFIG_DIR = './config';
const RPC_CONFIG_PATH = path.join(CONFIG_DIR, 'rpc-config.json');

// Make sure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Read existing RPC config if available
let rpcConfig: any = {
  rpcEndpoints: [],
  caching: {
    enabled: true,
    defaultTtlMs: 30000
  },
  rateLimiting: {
    enabled: true,
    requestsPerMinute: 60
  },
  fallback: {
    enabled: true,
    maxRetries: 3
  }
};

if (fs.existsSync(RPC_CONFIG_PATH)) {
  try {
    rpcConfig = JSON.parse(fs.readFileSync(RPC_CONFIG_PATH, 'utf8'));
  } catch (error) {
    console.error('Error reading existing RPC config:', error);
  }
}

// Define Syndica endpoint (using your environment variable if available)
const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY;
const SYNDICA_ENDPOINT = SYNDICA_API_KEY 
  ? `https://solana-api.syndica.io/access-token/${SYNDICA_API_KEY}/rpc`
  : 'https://solana-api.syndica.io/rpc'; // Fallback to public endpoint if no key

// Define all RPC endpoints with priorities
const rpcEndpoints = [
  // Syndica as highest priority
  {
    url: SYNDICA_ENDPOINT,
    priority: 1,
    weight: 10,
    rateLimit: { requestsPerMinute: 200 },
    name: 'Syndica Primary'
  },
  
  // Helius as secondary (if key available)
  ...(process.env.HELIUS_API_KEY ? [{
    url: `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
    priority: 2,
    weight: 5,
    rateLimit: { requestsPerMinute: 100 },
    name: 'Helius'
  }] : []),
  
  // Alchemy as tertiary (if key available)
  ...(process.env.ALCHEMY_API_KEY ? [{
    url: `https://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
    priority: 2,
    weight: 5,
    rateLimit: { requestsPerMinute: 100 },
    name: 'Alchemy'
  }] : []),
  
  // Fallback public endpoints
  {
    url: 'https://api.mainnet-beta.solana.com',
    priority: 3,
    weight: 1,
    rateLimit: { requestsPerMinute: 40 },
    name: 'Public Solana'
  },
  {
    url: 'https://solana-api.projectserum.com',
    priority: 3,
    weight: 1,
    rateLimit: { requestsPerMinute: 40 },
    name: 'Project Serum'
  }
];

// Update RPC config
rpcConfig.rpcEndpoints = rpcEndpoints;

// Write updated config
try {
  fs.writeFileSync(RPC_CONFIG_PATH, JSON.stringify(rpcConfig, null, 2));
  console.log(`✅ Updated RPC config with Syndica as primary endpoint at ${RPC_CONFIG_PATH}`);
} catch (error) {
  console.error('Error writing RPC config:', error);
}

// Create .env file with Syndica config (if not exists)
const envPath = './.env';
let envContent = '';

if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
}

// Add Syndica config if not already present
if (!envContent.includes('RPC_URL=')) {
  envContent += `\n# Primary RPC provider\nRPC_URL=${SYNDICA_ENDPOINT}\n`;
  
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Added Syndica RPC URL to .env file');
}

// Update connection configuration files
const connectionFiles = [
  './src/connection.ts',
  './src/utils/connection.ts',
  './server/connection.ts'
];

let updatedConnectionFile = false;

for (const filePath of connectionFiles) {
  if (fs.existsSync(filePath)) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Check if file already uses Syndica
      if (content.includes('syndica.io')) {
        console.log(`${filePath} already uses Syndica`);
        continue;
      }
      
      // Replace any hardcoded RPC URLs with Syndica
      const rpcUrlRegex = /(['"])https?:\/\/[^'"]*solana[^'"]*(['"])/g;
      content = content.replace(rpcUrlRegex, `$1${SYNDICA_ENDPOINT}$2`);
      
      // Replace any env variable references that might not use RPC_URL
      const envVarRegex = /process\.env\.[A-Z_]+_RPC|process\.env\.[A-Z_]+_URL/g;
      content = content.replace(envVarRegex, 'process.env.RPC_URL');
      
      fs.writeFileSync(filePath, content);
      console.log(`✅ Updated ${filePath} to use Syndica`);
      updatedConnectionFile = true;
    } catch (error) {
      console.error(`Error updating ${filePath}:`, error);
    }
  }
}

if (!updatedConnectionFile) {
  console.log('No connection files found or updated');
}

// Create Syndica monitor script
const monitorScriptPath = './monitor-syndica.sh';
const monitorScript = `#!/bin/bash
# Monitor Syndica RPC performance

echo "=== SYNDICA RPC MONITOR ==="
echo "Monitoring Syndica RPC performance..."

# Measure response time for getSlot
while true; do
  echo "$(date): Checking Syndica performance..."
  
  start_time=$(date +%s.%N)
  curl -s -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getSlot"}' ${SYNDICA_ENDPOINT} > /dev/null
  end_time=$(date +%s.%N)
  
  # Calculate duration in milliseconds
  duration=$(echo "($end_time - $start_time) * 1000" | bc)
  
  echo "Syndica response time: ${duration}ms"
  
  # Check if cache directory exists and count entries
  if [ -d "./data/rpc_cache" ]; then
    cache_count=$(ls -1 ./data/rpc_cache | wc -l)
    echo "RPC cache entries: ${cache_count}"
  fi
  
  sleep 10
done
`;

fs.writeFileSync(monitorScriptPath, monitorScript);
fs.chmodSync(monitorScriptPath, 0o755); // Make executable
console.log(`✅ Created Syndica monitor script at ${monitorScriptPath}`);

// Create restart script that uses Syndica
const restartScriptPath = './restart-with-syndica.sh';
const restartScript = `#!/bin/bash
# Restart trading system with Syndica RPC

echo "========================================"
echo "    RESTARTING TRADING SYSTEM          "
echo "       WITH SYNDICA RPC                "
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
find ./data/rpc_cache -name "*.json" -mmin +60 -delete 2>/dev/null || true

# Export Syndica as RPC_URL
export RPC_URL="${SYNDICA_ENDPOINT}"

# Start with Syndica configuration
echo "Starting trading system with Syndica RPC..."
./launch-enhanced-system.sh &

echo "System restarted with Syndica as primary RPC"
echo "========================================"
`;

fs.writeFileSync(restartScriptPath, restartScript);
fs.chmodSync(restartScriptPath, 0o755); // Make executable
console.log(`✅ Created restart script at ${restartScriptPath}`);

console.log('\n=== SYNDICA CONFIGURATION COMPLETE ===');
console.log('The system is now configured to use Syndica as the primary RPC provider');
console.log('This will significantly reduce rate limit errors and improve performance');

console.log('\nTo monitor Syndica performance, run:');
console.log('./monitor-syndica.sh');

console.log('\nTo restart the system with Syndica as the primary RPC, run:');
console.log('./restart-with-syndica.sh');

// Ask if user wants to restart now
console.log('\nWould you like to restart the system with Syndica now? (y/n)');
process.stdin.once('data', (data) => {
  const input = data.toString().trim().toLowerCase();
  
  if (input === 'y' || input === 'yes') {
    console.log('Restarting system with Syndica...');
    require('child_process').execSync('./restart-with-syndica.sh', { stdio: 'inherit' });
  } else {
    console.log('Restart skipped. You can restart manually later by running:');
    console.log('./restart-with-syndica.sh');
  }
  
  process.exit(0);
});