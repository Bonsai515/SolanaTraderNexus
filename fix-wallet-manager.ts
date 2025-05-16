/**
 * Fix Wallet Manager Connection to Nexus Engine
 * 
 * This script fixes the wallet manager's connection to the Nexus engine
 * to properly retrieve wallet addresses for trading.
 */

import * as fs from 'fs';
import * as path from 'path';

// Fix wallet manager
function fixWalletManager(): void {
  const walletManagerPath = path.join(__dirname, 'server', 'walletManager.ts');
  
  try {
    // Check if file exists
    if (!fs.existsSync(walletManagerPath)) {
      console.error('❌ Wallet manager file not found');
      return;
    }
    
    let code = fs.readFileSync(walletManagerPath, 'utf-8');
    
    // Fix wallet address retrieval
    if (code.includes('getNexusMainWallet')) {
      // Fix main wallet getter
      code = code.replace(
        'export function getNexusMainWallet(): string {',
        `export function getNexusMainWallet(): string {
  // Get from system memory first or from environment variable
  try {
    const systemMemoryPath = path.join(__dirname, '..', 'data', 'system_memory.json');
    if (fs.existsSync(systemMemoryPath)) {
      const systemMemory = JSON.parse(fs.readFileSync(systemMemoryPath, 'utf-8'));
      if (systemMemory?.config?.trading?.mainWalletAddress) {
        return systemMemory.config.trading.mainWalletAddress;
      }
    }
    
    // Fallback to environment variable or default
    if (process.env.MAIN_WALLET_ADDRESS) {
      return process.env.MAIN_WALLET_ADDRESS;
    }
    
    // Final fallback to default wallet
    return "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb";
  } catch (error) {
    logger.error(\`Failed to get main wallet address: \${error.message}\`);
    return "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb";
  }`
      );
      
      // Fix secondary wallet getter
      code = code.replace(
        'export function getNexusSecondaryWallet(): string {',
        `export function getNexusSecondaryWallet(): string {
  // Get from system memory first or from environment variable
  try {
    const systemMemoryPath = path.join(__dirname, '..', 'data', 'system_memory.json');
    if (fs.existsSync(systemMemoryPath)) {
      const systemMemory = JSON.parse(fs.readFileSync(systemMemoryPath, 'utf-8'));
      if (systemMemory?.config?.trading?.secondaryWalletAddress) {
        return systemMemory.config.trading.secondaryWalletAddress;
      }
    }
    
    // Fallback to environment variable or default
    if (process.env.SECONDARY_WALLET_ADDRESS) {
      return process.env.SECONDARY_WALLET_ADDRESS;
    }
    
    // Final fallback to default wallet
    return "31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e";
  } catch (error) {
    logger.error(\`Failed to get secondary wallet address: \${error.message}\`);
    return "31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e";
  }`
      );
      
      // Fix prophet wallet getter
      code = code.replace(
        'export function getNexusProphetWallet(): string {',
        `export function getNexusProphetWallet(): string {
  // Get from system memory first or from environment variable
  try {
    const systemMemoryPath = path.join(__dirname, '..', 'data', 'system_memory.json');
    if (fs.existsSync(systemMemoryPath)) {
      const systemMemory = JSON.parse(fs.readFileSync(systemMemoryPath, 'utf-8'));
      if (systemMemory?.config?.trading?.prophetWalletAddress) {
        return systemMemory.config.trading.prophetWalletAddress;
      }
    }
    
    // Fallback to environment variable or default
    if (process.env.PROPHET_WALLET_ADDRESS) {
      return process.env.PROPHET_WALLET_ADDRESS;
    }
    
    // Final fallback to default wallet
    return "31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e";
  } catch (error) {
    logger.error(\`Failed to get prophet wallet address: \${error.message}\`);
    return "31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e";
  }`
      );
      
      // Add import for fs and path if needed
      if (!code.includes('import * as fs from')) {
        code = code.replace(
          'import { logger } from ',
          'import * as fs from \'fs\';\nimport * as path from \'path\';\nimport { logger } from '
        );
      }
      
      // Save updated file
      fs.writeFileSync(walletManagerPath, code);
      console.log('✅ Fixed wallet manager connection to Nexus engine');
    } else {
      console.log('⚠️ Wallet manager file doesn\'t contain expected function signatures');
    }
  } catch (error) {
    console.error(`❌ Failed to fix wallet manager: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Update system memory with wallet addresses
function updateSystemMemory(): void {
  const systemMemoryPath = path.join(__dirname, 'data', 'system_memory.json');
  
  try {
    // Get wallet information from wallets.json
    const walletsPath = path.join(__dirname, 'data', 'wallets.json');
    if (!fs.existsSync(walletsPath)) {
      console.error('❌ Wallets file not found');
      return;
    }
    
    const wallets = JSON.parse(fs.readFileSync(walletsPath, 'utf-8'));
    
    // Find wallet addresses
    const mainWallet = wallets.find(w => w.publicKey === 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb')?.publicKey || 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
    const prophetWallet = wallets.find(w => w.label?.includes('Prophet'))?.publicKey || '31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e';
    const tradingWallet = wallets.find(w => w.type === 'TRADING' && w.isActive)?.publicKey || '2qPJQ6fMWxNH4p8hjhqonJt1Fy4okf7ToDV4Z6nGLddm';
    
    // Read or create system memory
    let systemMemory = {};
    if (fs.existsSync(systemMemoryPath)) {
      systemMemory = JSON.parse(fs.readFileSync(systemMemoryPath, 'utf-8'));
    }
    
    // Ensure config exists
    if (!systemMemory.config) {
      systemMemory.config = {};
    }
    
    // Add trading config with wallet addresses
    systemMemory.config.trading = {
      ...(systemMemory.config.trading || {}),
      useRealFunds: true,
      mainWalletAddress: mainWallet,
      secondaryWalletAddress: prophetWallet,
      prophetWalletAddress: prophetWallet,
      tradingWalletAddress: tradingWallet
    };
    
    // Write updated system memory
    fs.writeFileSync(systemMemoryPath, JSON.stringify(systemMemory, null, 2));
    console.log('✅ Updated system memory with wallet addresses');
  } catch (error) {
    console.error(`❌ Failed to update system memory: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Main function
function main(): void {
  console.log('=======================================================');
  console.log('  FIXING WALLET MANAGER CONNECTION TO NEXUS ENGINE');
  console.log('=======================================================');
  
  // Fix wallet manager
  fixWalletManager();
  
  // Update system memory
  updateSystemMemory();
  
  console.log('=======================================================');
  console.log('✅ WALLET MANAGER CONNECTION FIX COMPLETE');
  console.log('Restart the system to apply these changes.');
  console.log('=======================================================');
}

// Execute if called directly
if (require.main === module) {
  main();
}