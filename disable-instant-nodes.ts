/**
 * Completely Disable Instant Nodes
 * 
 * This script removes Instant Nodes from all RPC configurations
 * and forces Syndica -> Alchemy -> Helius order.
 */

import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Load environment variables
config();

console.log('=== DISABLING INSTANT NODES ===');

// Make sure config directory exists
const CONFIG_DIR = './config';
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Update RPC configuration
const RPC_CONFIG_PATH = path.join(CONFIG_DIR, 'multi-rpc-config.json');
if (fs.existsSync(RPC_CONFIG_PATH)) {
  console.log('Removing Instant Nodes from RPC configuration...');
  
  try {
    const rpcConfig = JSON.parse(fs.readFileSync(RPC_CONFIG_PATH, 'utf8'));
    
    // Remove Instant Nodes entirely
    rpcConfig.providers = rpcConfig.providers.filter(provider => 
      !provider.name.includes("Instant Nodes")
    );
    
    // Make sure providers are in the right order
    let orderedProviders = [];
    
    // Add Syndica with highest priority
    const syndicaProvider = rpcConfig.providers.find(p => p.name === "Syndica");
    if (syndicaProvider) {
      syndicaProvider.priority = 1;
      syndicaProvider.weight = 10;
      syndicaProvider.inUse = true;
      orderedProviders.push(syndicaProvider);
    }
    
    // Add Alchemy second
    const alchemyProvider = rpcConfig.providers.find(p => p.name === "Alchemy");
    if (alchemyProvider) {
      alchemyProvider.priority = 2;
      alchemyProvider.weight = 8;
      alchemyProvider.inUse = true;
      orderedProviders.push(alchemyProvider);
    }
    
    // Add Helius third
    const heliusProvider = rpcConfig.providers.find(p => p.name === "Helius");
    if (heliusProvider) {
      heliusProvider.priority = 3;
      heliusProvider.weight = 6;
      heliusProvider.inUse = true;
      orderedProviders.push(heliusProvider);
    }
    
    // Add remaining providers
    const otherProviders = rpcConfig.providers.filter(p => 
      !["Syndica", "Alchemy", "Helius"].includes(p.name)
    );
    
    orderedProviders = [...orderedProviders, ...otherProviders];
    rpcConfig.providers = orderedProviders;
    
    // Save updated config
    fs.writeFileSync(RPC_CONFIG_PATH, JSON.stringify(rpcConfig, null, 2));
    console.log('✅ Removed Instant Nodes from RPC configuration');
  } catch (error) {
    console.error('Error updating RPC config:', error);
  }
}

// Update all .env files to prevent Instant Nodes usage
const envFiles = [
  './.env',
  './.env.trading',
  './.env.real-trading',
  './.env.force-real',
  './.env.jito',
  './.env.enhanced',
  './.env.override'
];

for (const envPath of envFiles) {
  if (fs.existsSync(envPath)) {
    console.log(`Updating ${envPath} to disable Instant Nodes...`);
    let content = fs.readFileSync(envPath, 'utf8');
    
    // Remove Instant Nodes references
    content = content.replace(/INSTANT_NODES_URL=.*$/gm, '');
    content = content.replace(/USE_INSTANT_NODES=.*$/gm, 'USE_INSTANT_NODES=false');
    
    // Set Syndica as primary
    if (!content.includes('RPC_URL=https://solana-api.syndica.io/rpc')) {
      content = content.replace(/RPC_URL=.*$/gm, 'RPC_URL=https://solana-api.syndica.io/rpc');
    }
    
    if (!content.includes('SOLANA_RPC=https://solana-api.syndica.io/rpc')) {
      content = content.replace(/SOLANA_RPC=.*$/gm, 'SOLANA_RPC=https://solana-api.syndica.io/rpc');
    }
    
    // Add clear provider order
    const providerOrderUpdates = `
# Provider Order (Instant Nodes Disabled)
USE_SYNDICA=true
USE_ALCHEMY=true
USE_HELIUS=true
USE_INSTANT_NODES=false
PRIMARY_PROVIDER=syndica
SECONDARY_PROVIDER=alchemy
TERTIARY_PROVIDER=helius
DISABLE_INSTANT_NODES=true
`;
    
    if (!content.includes('DISABLE_INSTANT_NODES=true')) {
      content += providerOrderUpdates;
    }
    
    fs.writeFileSync(envPath, content);
    console.log(`✅ Updated ${envPath} to disable Instant Nodes`);
  }
}

// Create restart script
const restartScript = `#!/bin/bash
# Restart with Instant Nodes Disabled

echo "========================================"
echo "   RESTARTING WITHOUT INSTANT NODES     "
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
export USE_ALCHEMY=true
export USE_HELIUS=true
export USE_INSTANT_NODES=false
export PRIMARY_PROVIDER=syndica
export SECONDARY_PROVIDER=alchemy
export TERTIARY_PROVIDER=helius
export DISABLE_INSTANT_NODES=true
export SYSTEM_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export TRADING_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK

# Start system without Instant Nodes
echo "Starting system without Instant Nodes..."
npx tsx start-with-wallet-fix.ts

echo "System restarted without Instant Nodes"
echo "========================================"
`;

fs.writeFileSync('./restart-no-instant-nodes.sh', restartScript);
fs.chmodSync('./restart-no-instant-nodes.sh', 0o755);
console.log('✅ Created restart script at ./restart-no-instant-nodes.sh');

console.log('\n=== INSTANT NODES DISABLED ===');
console.log('Instant Nodes has been completely removed from the configuration');
console.log('Provider order set to: 1) Syndica, 2) Alchemy, 3) Helius');
console.log('To restart the system without Instant Nodes, run:');
console.log('./restart-no-instant-nodes.sh');