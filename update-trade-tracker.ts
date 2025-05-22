/**
 * Update Trade Tracker
 * 
 * This script updates the trade tracker and wallet monitor
 * to use the HPN wallet address.
 */

import * as fs from 'fs';
import * as path from 'path';

// Configuration
const HPN_WALLET_ADDRESS = 'HPN9rV3Ja5FCgT3WiNLK6PWrPkLZs3zXE1QWWwJGmvmF';
const OLD_WALLET_ADDRESSES = [
  'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb',
  '31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e'
];

// Utility function to log messages
function log(message: string): void {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// Find and update wallet addresses in a file
function updateWalletAddressInFile(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) {
      log(`File not found: ${filePath}`);
      return false;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let updated = false;

    // Replace old wallet addresses with HPN wallet
    for (const oldAddress of OLD_WALLET_ADDRESSES) {
      if (content.includes(oldAddress)) {
        content = content.replace(new RegExp(oldAddress, 'g'), HPN_WALLET_ADDRESS);
        updated = true;
      }
    }

    // Only write if changes were made
    if (updated) {
      fs.writeFileSync(filePath, content);
      log(`✅ Updated wallet address in ${filePath}`);
      return true;
    } else {
      log(`No wallet addresses to update in ${filePath}`);
      return false;
    }
  } catch (error) {
    log(`Error updating ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

// Main function to update all trade tracker files
async function main() {
  log('Starting trade tracker update...');
  
  const filesToUpdate = [
    './server/trade-tracker.ts',
    './server/wallet-monitor.ts',
    './server/neural-communication-hub.ts',
    './server/solana/connection-manager.ts',
    './server/nexus-transaction-engine.ts',
    './server/strategies/quantumOmegaSniperController.ts',
    './server/transformers/memeTokenNeuralTransformer.ts'
  ];
  
  let updatedCount = 0;
  
  for (const file of filesToUpdate) {
    if (updateWalletAddressInFile(file)) {
      updatedCount++;
    }
  }
  
  log(`Updated wallet address in ${updatedCount} files`);
  
  // Create a test file to verify wallet address
  const testFilePath = './server/wallet-info.ts';
  const testFileContent = `/**
 * Wallet Information
 * 
 * This file contains wallet addresses for reference.
 */

// Current wallet configuration
export const WALLET_INFO = {
  tradingWallet: '${HPN_WALLET_ADDRESS}',
  balance: 0.5 // SOL
};

export default WALLET_INFO;
`;

  fs.writeFileSync(testFilePath, testFileContent);
  log(`✅ Created wallet info file at ${testFilePath}`);
  
  log('Trade tracker update completed successfully');
}

// Run the script
main().catch(error => {
  log(`Error: ${error instanceof Error ? error.message : String(error)}`);
});