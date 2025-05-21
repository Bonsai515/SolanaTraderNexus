/**
 * Optimize RPC Provider Order
 * 
 * This script sets Syndica as primary (premium), followed by Alchemy, then Helius,
 * and disables Instant Nodes for now.
 */

import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Load environment variables
config();

console.log('=== OPTIMIZING RPC PROVIDER ORDER ===');

// Make sure config directory exists
const CONFIG_DIR = './config';
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Update RPC configuration
const RPC_CONFIG_PATH = path.join(CONFIG_DIR, 'multi-rpc-config.json');
if (fs.existsSync(RPC_CONFIG_PATH)) {
  console.log('Updating RPC provider order...');
  
  try {
    const rpcConfig = JSON.parse(fs.readFileSync(RPC_CONFIG_PATH, 'utf8'));
    
    // Create optimal priority order for providers
    const providers = [];
    
    // Add Syndica first (highest priority)
    const syndicaProvider = rpcConfig.providers.find(p => p.name === "Syndica");
    if (syndicaProvider) {
      syndicaProvider.priority = 1;
      syndicaProvider.weight = 10;
      syndicaProvider.inUse = true;
      providers.push(syndicaProvider);
      console.log('✅ Set Syndica as primary RPC provider (premium)');
    }
    
    // Add Alchemy second
    const alchemyProvider = rpcConfig.providers.find(p => p.name === "Alchemy");
    if (alchemyProvider) {
      alchemyProvider.priority = 2;
      alchemyProvider.weight = 8;
      alchemyProvider.inUse = true;
      providers.push(alchemyProvider);
      console.log('✅ Set Alchemy as secondary RPC provider');
    }
    
    // Add Helius third
    const heliusProvider = rpcConfig.providers.find(p => p.name === "Helius");
    if (heliusProvider) {
      heliusProvider.priority = 3;
      heliusProvider.weight = 6;
      heliusProvider.inUse = true;
      providers.push(heliusProvider);
      console.log('✅ Set Helius as tertiary RPC provider');
    }
    
    // Add the rest of the providers with lower priority
    const otherProviders = rpcConfig.providers.filter(p => 
      !["Syndica", "Alchemy", "Helius", "Instant Nodes"].includes(p.name)
    );
    
    otherProviders.forEach((provider, index) => {
      provider.priority = 4 + index;
      provider.weight = 2;
      provider.inUse = true;
      providers.push(provider);
    });
    
    // Add Instant Nodes as disabled
    const instantNodesProvider = rpcConfig.providers.find(p => p.name === "Instant Nodes");
    if (instantNodesProvider) {
      instantNodesProvider.priority = 10;
      instantNodesProvider.weight = 0;
      instantNodesProvider.inUse = false;
      providers.push(instantNodesProvider);
      console.log('✅ Disabled Instant Nodes (will be activated tomorrow)');
    }
    
    // Update the providers in config
    rpcConfig.providers = providers;
    
    // Add extra caching for rate limit protection
    if (rpcConfig.caching) {
      rpcConfig.caching.accountInfoTtlMs = 120000;     // 2 minutes
      rpcConfig.caching.balanceTtlMs = 120000;         // 2 minutes
      rpcConfig.caching.transactionTtlMs = 3600000;    // 1 hour
      rpcConfig.caching.blockTtlMs = 300000;           // 5 minutes
      rpcConfig.caching.slotTtlMs = 30000;             // 30 seconds
    }
    
    // Save updated config
    fs.writeFileSync(RPC_CONFIG_PATH, JSON.stringify(rpcConfig, null, 2));
    console.log('✅ Updated RPC configuration with optimal provider order');
  } catch (error) {
    console.error('Error updating RPC config:', error);
  }
}

// Update .env file
const envPath = './.env';
if (fs.existsSync(envPath)) {
  console.log('Updating environment variables...');
  let content = fs.readFileSync(envPath, 'utf8');
  
  // Set Syndica as primary RPC provider
  content = content.replace(/RPC_URL=.*$/gm, '');
  content = content.replace(/SOLANA_RPC=.*$/gm, '');
  
  const envUpdates = `
# Provider Order Configuration
RPC_URL=https://solana-api.syndica.io/rpc
SOLANA_RPC=https://solana-api.syndica.io/rpc
USE_SYNDICA=true
USE_INSTANT_NODES=false
PRIMARY_PROVIDER=syndica
SECONDARY_PROVIDER=alchemy
TERTIARY_PROVIDER=helius
`;
  
  fs.writeFileSync(envPath, content + envUpdates);
  console.log('✅ Updated environment variables with Syndica as primary');
}

// Create restart script
const restartScript = `#!/bin/bash
# Restart with Optimized Provider Order

echo "========================================"
echo "   RESTARTING WITH OPTIMIZED PROVIDERS  "
echo "========================================"

# Stop running processes
echo "Stopping current processes..."
pkill -f "ts-node" || true
pkill -f "npx tsx" || true
pkill -f "activate-" || true
sleep 2

# Export environment variables
export RPC_URL=https://solana-api.syndica.io/rpc
export SOLANA_RPC=https://solana-api.syndica.io/rpc
export USE_SYNDICA=true
export USE_INSTANT_NODES=false
export PRIMARY_PROVIDER=syndica
export SECONDARY_PROVIDER=alchemy
export TERTIARY_PROVIDER=helius
export SYSTEM_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export TRADING_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK

# Start system with optimized providers
echo "Starting system with optimized provider order..."
npx tsx activate-live-trading.ts

echo "System restarted with optimized provider order"
echo "========================================"
`;

fs.writeFileSync('./restart-optimized-providers.sh', restartScript);
fs.chmodSync('./restart-optimized-providers.sh', 0o755);
console.log('✅ Created restart script at ./restart-optimized-providers.sh');

console.log('\n=== RPC PROVIDER OPTIMIZATION COMPLETE ===');
console.log('Provider order set to: 1) Syndica, 2) Alchemy, 3) Helius');
console.log('Instant Nodes is disabled for now until tomorrow\'s upgrades');
console.log('To restart the system with this configuration, run:');
console.log('./restart-optimized-providers.sh');