/**
 * Update Wallet Address Script
 * 
 * This script updates all references to HX wallet address
 * and replaces them with the HP trading wallet address
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Configuration
const OLD_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
const HP_WALLET_ADDRESS = 'HP9h31ZkN5NbJfHBWZgXz3YWejYJA7sKB6uBjrMvGYFv'; // HP wallet

// Utility function to log with timestamp
function log(message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

// Find all files containing the old wallet address
function findFilesWithWalletAddress(): string[] {
  try {
    const command = `grep -r "${OLD_WALLET_ADDRESS}" --include="*.ts" --include="*.js" --include="*.json" . | grep -v "node_modules" | cut -d':' -f1`;
    const result = execSync(command).toString().trim();
    
    if (!result) {
      return [];
    }
    
    return [...new Set(result.split('\n'))]; // Remove duplicates
  } catch (error) {
    log(`Error finding files: ${error}`);
    return [];
  }
}

// Update the wallet address in a file
function updateWalletAddressInFile(filePath: string): boolean {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Skip if file doesn't contain the old address
    if (!content.includes(OLD_WALLET_ADDRESS)) {
      return false;
    }
    
    // Replace all occurrences
    const newContent = content.replace(new RegExp(OLD_WALLET_ADDRESS, 'g'), HP_WALLET_ADDRESS);
    
    // Write the updated content back to the file
    fs.writeFileSync(filePath, newContent);
    
    log(`Updated wallet address in: ${filePath}`);
    return true;
  } catch (error) {
    log(`Error updating ${filePath}: ${error}`);
    return false;
  }
}

// Main function
async function main() {
  log('Starting wallet address update process...');
  
  // Find all files containing the old wallet address
  const files = findFilesWithWalletAddress();
  
  if (files.length === 0) {
    log('No files found containing the old wallet address.');
    return;
  }
  
  log(`Found ${files.length} files containing the old wallet address.`);
  
  // Update each file
  let updatedCount = 0;
  
  for (const file of files) {
    const updated = updateWalletAddressInFile(file);
    if (updated) {
      updatedCount++;
    }
  }
  
  log(`Updated wallet address in ${updatedCount} files.`);
  log('Wallet address update completed.');
}

main().catch(error => {
  log(`Error: ${error}`);
  process.exit(1);
});