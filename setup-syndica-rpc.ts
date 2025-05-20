/**
 * Setup Syndica RPC Configuration
 * 
 * This script configures the system to use Syndica as the primary RPC provider.
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

console.log('=== SETTING UP SYNDICA RPC ===');

// Make sure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Define Syndica endpoint (using your environment variable if available)
const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY;
const SYNDICA_ENDPOINT = SYNDICA_API_KEY 
  ? `https://solana-api.syndica.io/access-token/${SYNDICA_API_KEY}/rpc`
  : 'https://solana-api.syndica.io/rpc'; // Fallback to public endpoint if no key

console.log(`Using Syndica endpoint: ${SYNDICA_ENDPOINT}`);

// Define all RPC endpoints with priorities
const rpcConfig = {
  rpcEndpoints: [
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
    
    // Public endpoints as fallbacks
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
  ],
  caching: {
    enabled: true,
    defaultTtlMs: 30000,
    tokenAccountsTtlMs: 60000,
    transactionTtlMs: 86400000 // 24 hours
  },
  rateLimiting: {
    enabled: true,
    requestsPerMinute: 60,
    cooldownMs: 5000
  },
  fallback: {
    enabled: true,
    maxRetries: 3
  }
};

// Write RPC config
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

console.log('\nTo restart the system with Syndica as the primary RPC, run:');
console.log('./restart-with-syndica.sh');

// Automatically restart if running directly
if (require.main === module) {
  console.log('\nRestarting system with Syndica...');
  require('child_process').execSync('./restart-with-syndica.sh', { stdio: 'inherit' });
}