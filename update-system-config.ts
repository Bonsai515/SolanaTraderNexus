/**
 * Update System Configuration
 * 
 * This script updates wallet addresses and rate limiting across the system
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const HPN_WALLET_ADDRESS = 'HPN9rV3Ja5FCgT3WiNLK6PWrPkLZs3zXE1QWWwJGmvmF';

// Files that need updating with the new wallet address
const WALLET_CONFIG_FILES = [
  './server/config/wallet-config.ts',
  './server/nexus-transaction-engine.ts',
  './server/activate-initial-strategies.ts'
];

// Update wallet address in a specific file
function updateWalletInFile(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${filePath}`);
      return false;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace HX wallet address with the HPN wallet
    let updated = content.replace(/HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb/g, HPN_WALLET_ADDRESS);
    
    if (content === updated) {
      // Try other possible wallet addresses if no HX was found
      updated = content.replace(/31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e/g, HPN_WALLET_ADDRESS);
    }
    
    // Only write if there were changes
    if (content !== updated) {
      fs.writeFileSync(filePath, updated);
      console.log(`✅ Updated wallet address in ${filePath}`);
      return true;
    } else {
      console.log(`No changes needed in ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`Error updating wallet in ${filePath}:`, error);
    return false;
  }
}

// Update rate limit configurations and remove CoinGecko as a data source
function updateRateLimits(): boolean {
  try {
    // Check if the rate limit config exists
    const rateLimitPath = './server/lib/externalApiManager.ts';
    if (!fs.existsSync(rateLimitPath)) {
      console.log(`Rate limit manager not found: ${rateLimitPath}`);
      return false;
    }
    
    let content = fs.readFileSync(rateLimitPath, 'utf8');
    
    // Find the rate limit configuration section
    if (content.includes('requestsPerMinute')) {
      // Disable CoinGecko completely
      if (content.includes('fetchCoinGeckoPrices')) {
        content = content.replace(
          /async function fetchCoinGeckoPrices[^}]*}/g, 
          `async function fetchCoinGeckoPrices() {
    logger.info("CoinGecko API disabled to prevent rate limiting");
    return { success: false, data: {} };
  }`);
      }
      
      // Update Jupiter rate limits
      content = content.replace(/Jupiter:[\s]*{[^}]*}/g, 
        `Jupiter: {
      requestsPerMinute: 30,
      maxConcurrent: 2,
      backoffMultiplier: 1.5,
      initialBackoffMs: 2000,
      maxBackoffMs: 30000,
      cooldownAfterFailures: 5,
      cooldownTimeMs: 60000
    }`);
    
      // Update Solana RPC rate limits
      content = content.replace(/SolanaRPC:[\s]*{[^}]*}/g, 
        `SolanaRPC: {
      requestsPerMinute: 25,
      maxConcurrent: 2,
      backoffMultiplier: 1.5,
      initialBackoffMs: 2000,
      maxBackoffMs: 30000,
      cooldownAfterFailures: 4,
      cooldownTimeMs: 90000
    }`);
      
      fs.writeFileSync(rateLimitPath, content);
      console.log(`✅ Updated rate limits in ${rateLimitPath}`);
      return true;
    } else {
      console.log(`Rate limit configuration section not found in ${rateLimitPath}`);
      return false;
    }
  } catch (error) {
    console.error('Error updating rate limits:', error);
    return false;
  }
}

// Update wallet balance alert thresholds
function updateBalanceAlerts(): boolean {
  try {
    const monitorPath = './server/wallet-monitor.ts';
    if (!fs.existsSync(monitorPath)) {
      console.log(`Wallet monitor not found: ${monitorPath}`);
      return false;
    }
    
    let content = fs.readFileSync(monitorPath, 'utf8');
    
    // Reduce the alert frequency and adjust the balance thresholds
    if (content.includes('MIN_SOL_BALANCE')) {
      content = content.replace(/MIN_SOL_BALANCE[\s]*=[\s]*[0-9.]+/g, 'MIN_SOL_BALANCE = 0.01');
      content = content.replace(/CHECK_INTERVAL_MS[\s]*=[\s]*[0-9]+/g, 'CHECK_INTERVAL_MS = 120000');
      
      fs.writeFileSync(monitorPath, content);
      console.log(`✅ Updated balance alert thresholds in ${monitorPath}`);
      return true;
    } else {
      console.log(`Balance alert configuration not found in ${monitorPath}`);
      return false;
    }
  } catch (error) {
    console.error('Error updating balance alerts:', error);
    return false;
  }
}

// Main function
async function main() {
  console.log('Updating system configuration...');
  
  // Update wallet address in configuration files
  let updatedWalletCount = 0;
  for (const file of WALLET_CONFIG_FILES) {
    if (updateWalletInFile(file)) {
      updatedWalletCount++;
    }
  }
  console.log(`Updated wallet address in ${updatedWalletCount} files`);
  
  // Update rate limits to reduce 429 errors
  updateRateLimits();
  
  // Update balance alert thresholds
  updateBalanceAlerts();
  
  console.log('✅ System configuration update complete');
  console.log(`Trading wallet set to: ${HPN_WALLET_ADDRESS}`);
  console.log('API rate limits reduced to prevent 429 errors');
}

// Run the script
main().catch(error => {
  console.error('Error:', error);
});