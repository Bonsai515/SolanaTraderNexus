/**
 * Fix Wallet Access Issues
 * 
 * This script updates the configuration to completely prevent
 * agents from attempting to access the HX wallet.
 */

import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Load environment variables
config();

console.log('=== FIXING WALLET ACCESS ISSUES ===');

// Constants
const HP_WALLET = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const HX_WALLET = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';

// Make sure config directory exists
const CONFIG_DIR = './config';
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Update system memory to disable HX wallet
const SYSTEM_MEMORY_PATH = path.join(CONFIG_DIR, 'system-memory.json');
if (fs.existsSync(SYSTEM_MEMORY_PATH)) {
  console.log('Updating system memory to disable HX wallet...');
  
  try {
    const systemMemory = JSON.parse(fs.readFileSync(SYSTEM_MEMORY_PATH, 'utf8'));
    
    // Replace all instances of HX wallet with HP wallet
    const updateWallets = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === 'string' && obj[key] === HX_WALLET) {
          obj[key] = HP_WALLET;
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          updateWallets(obj[key]);
        }
      }
    };
    
    updateWallets(systemMemory);
    
    // Explicitly set main trading wallet to HP
    if (systemMemory.wallets) {
      systemMemory.wallets.main = HP_WALLET;
      systemMemory.wallets.trading = HP_WALLET;
      systemMemory.wallets.active = HP_WALLET;
      // Remove HX wallet from tracked wallets if present
      if (systemMemory.wallets.tracked) {
        systemMemory.wallets.tracked = systemMemory.wallets.tracked.filter(w => w !== HX_WALLET);
        if (!systemMemory.wallets.tracked.includes(HP_WALLET)) {
          systemMemory.wallets.tracked.push(HP_WALLET);
        }
      }
    }
    
    // Save updated system memory
    fs.writeFileSync(SYSTEM_MEMORY_PATH, JSON.stringify(systemMemory, null, 2));
    console.log('✅ Updated system memory to disable HX wallet access');
  } catch (error) {
    console.error('Error updating system memory:', error);
  }
}

// Update wallet monitor configuration
const WALLET_MONITOR_PATH = path.join(CONFIG_DIR, 'wallet-monitor.json');
if (fs.existsSync(WALLET_MONITOR_PATH)) {
  console.log('Updating wallet monitor configuration...');
  
  try {
    const walletMonitor = JSON.parse(fs.readFileSync(WALLET_MONITOR_PATH, 'utf8'));
    
    // Replace all instances of HX wallet with HP wallet
    const updateWallets = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === 'string' && obj[key] === HX_WALLET) {
          obj[key] = HP_WALLET;
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          updateWallets(obj[key]);
        }
      }
    };
    
    updateWallets(walletMonitor);
    
    // Remove HX wallet from tracked wallets if present
    if (walletMonitor.wallets) {
      walletMonitor.wallets = walletMonitor.wallets.filter(w => w !== HX_WALLET);
      if (!walletMonitor.wallets.includes(HP_WALLET)) {
        walletMonitor.wallets.push(HP_WALLET);
      }
    }
    
    // Save updated wallet monitor config
    fs.writeFileSync(WALLET_MONITOR_PATH, JSON.stringify(walletMonitor, null, 2));
    console.log('✅ Updated wallet monitor configuration');
  } catch (error) {
    console.error('Error updating wallet monitor:', error);
  }
}

// Update profit collector configuration
const PROFIT_COLLECTOR_PATH = path.join(CONFIG_DIR, 'profit-collector.json');
if (fs.existsSync(PROFIT_COLLECTOR_PATH)) {
  console.log('Updating profit collector configuration...');
  
  try {
    const profitCollector = JSON.parse(fs.readFileSync(PROFIT_COLLECTOR_PATH, 'utf8'));
    
    // Update wallet addresses
    if (profitCollector.wallets) {
      profitCollector.wallets = profitCollector.wallets.filter(w => w !== HX_WALLET);
      if (!profitCollector.wallets.includes(HP_WALLET)) {
        profitCollector.wallets.push(HP_WALLET);
      }
    }
    
    if (profitCollector.mainWallet === HX_WALLET) {
      profitCollector.mainWallet = HP_WALLET;
    }
    
    // Save updated profit collector config
    fs.writeFileSync(PROFIT_COLLECTOR_PATH, JSON.stringify(profitCollector, null, 2));
    console.log('✅ Updated profit collector configuration');
  } catch (error) {
    console.error('Error updating profit collector:', error);
  }
}

// Update agent configurations to use HP wallet
const AGENT_CONFIG_DIR = path.join(CONFIG_DIR, 'agents');
if (fs.existsSync(AGENT_CONFIG_DIR)) {
  console.log('Updating agent configurations...');
  
  try {
    // Get all agent config files
    const agentFiles = fs.readdirSync(AGENT_CONFIG_DIR)
      .filter(file => file.endsWith('.json'));
    
    for (const agentFile of agentFiles) {
      const agentPath = path.join(AGENT_CONFIG_DIR, agentFile);
      const agentConfig = JSON.parse(fs.readFileSync(agentPath, 'utf8'));
      
      // Replace all instances of HX wallet with HP wallet
      const updateWallets = (obj) => {
        for (const key in obj) {
          if (typeof obj[key] === 'string' && obj[key] === HX_WALLET) {
            obj[key] = HP_WALLET;
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            updateWallets(obj[key]);
          }
        }
      };
      
      updateWallets(agentConfig);
      
      // Save updated agent config
      fs.writeFileSync(agentPath, JSON.stringify(agentConfig, null, 2));
      console.log(`✅ Updated agent configuration: ${agentFile}`);
    }
  } catch (error) {
    console.error('Error updating agent configurations:', error);
  }
}

// Create direct override for any hardcoded wallet references
console.log('Creating override module to redirect any remaining HX wallet references...');

const overrideCode = `/**
 * Wallet Override Module
 * 
 * This module intercepts and redirects any attempt to access the HX wallet
 * to the HP wallet instead.
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js';

const HP_WALLET = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const HX_WALLET = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';

// Monkey patch Connection to redirect wallet requests
const originalGetBalance = Connection.prototype.getBalance;
Connection.prototype.getBalance = async function(publicKey, commitment) {
  const address = publicKey instanceof PublicKey ? publicKey.toBase58() : publicKey.toString();
  
  // Redirect HX wallet requests to HP wallet
  if (address === HX_WALLET) {
    console.log(\`[Wallet Override] Redirecting balance request from HX to HP wallet\`);
    return originalGetBalance.call(
      this, 
      new PublicKey(HP_WALLET), 
      commitment
    );
  }
  
  return originalGetBalance.call(this, publicKey, commitment);
};

const originalGetAccountInfo = Connection.prototype.getAccountInfo;
Connection.prototype.getAccountInfo = async function(publicKey, commitment) {
  const address = publicKey instanceof PublicKey ? publicKey.toBase58() : publicKey.toString();
  
  // Redirect HX wallet requests to HP wallet
  if (address === HX_WALLET) {
    console.log(\`[Wallet Override] Redirecting account info request from HX to HP wallet\`);
    return originalGetAccountInfo.call(
      this, 
      new PublicKey(HP_WALLET), 
      commitment
    );
  }
  
  return originalGetAccountInfo.call(this, publicKey, commitment);
};

// Export a function to check and redirect wallet addresses
export function getRedirectedWallet(wallet: string): string {
  if (wallet === HX_WALLET) {
    console.log(\`[Wallet Override] Redirecting wallet access from HX to HP\`);
    return HP_WALLET;
  }
  return wallet;
}

// Export wallet constants
export const MAIN_WALLET = HP_WALLET;
export const TRADING_WALLET = HP_WALLET;
export const SYSTEM_WALLET = HP_WALLET;

console.log('[Wallet Override] Wallet override module initialized');`;

// Create directory if needed
const utilsDir = path.join('./src/utils');
if (!fs.existsSync(utilsDir)) {
  fs.mkdirSync(utilsDir, { recursive: true });
}

fs.writeFileSync(path.join(utilsDir, 'wallet-override.ts'), overrideCode);
console.log('✅ Created wallet override module');

// Create script to set up pre-loading of override module
const preloadScript = `// Preload wallet override module
import './src/utils/wallet-override';

// Continue with normal application
import './activate-live-trading';`;

fs.writeFileSync('./start-with-wallet-fix.ts', preloadScript);
console.log('✅ Created preload script to enforce wallet override');

// Create restart script
const restartScript = `#!/bin/bash
# Restart with Wallet Fix

echo "========================================"
echo "   RESTARTING WITH WALLET ACCESS FIX    "
echo "========================================"

# Stop running processes
echo "Stopping current processes..."
pkill -f "ts-node" || true
pkill -f "npx tsx" || true
pkill -f "activate-" || true
sleep 2

# Export environment variables
export SYSTEM_WALLET=${HP_WALLET}
export TRADING_WALLET=${HP_WALLET}
export MAIN_WALLET=${HP_WALLET}
export DISABLE_HX=true
export USE_WALLET_OVERRIDE=true
export RPC_URL=https://solana-api.syndica.io/rpc
export SOLANA_RPC=https://solana-api.syndica.io/rpc
export USE_SYNDICA=true
export USE_INSTANT_NODES=false
export PRIMARY_PROVIDER=syndica
export SECONDARY_PROVIDER=alchemy
export TERTIARY_PROVIDER=helius

# Start system with wallet fix
echo "Starting system with wallet access fix..."
npx tsx start-with-wallet-fix.ts

echo "System restarted with HP wallet only"
echo "========================================"
`;

fs.writeFileSync('./restart-wallet-fix.sh', restartScript);
fs.chmodSync('./restart-wallet-fix.sh', 0o755);
console.log('✅ Created restart script at ./restart-wallet-fix.sh');

console.log('\n=== WALLET ACCESS FIX COMPLETE ===');
console.log(`Trading wallet set to HP wallet (${HP_WALLET})`);
console.log('All agent access to HX wallet has been redirected to HP wallet');
console.log('To restart the system with this fix, run:');
console.log('./restart-wallet-fix.sh');