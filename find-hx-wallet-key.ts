/**
 * Find HX Wallet Private Key
 * 
 * This script correctly searches for the private key of the HX wallet
 * across multiple possible file locations.
 */

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// HX wallet address we're looking for
const HX_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';

// Potential file paths to search
const POTENTIAL_FILES = [
  './data/wallets.json',
  './data/private_wallets.json',
  './data/real-wallets.json',
  './data/nexus/keys.json',
  './data/system-memory.json',
  './wallet.json'
];

// Additional private key files that might contain the key
const ADDITIONAL_KEY_FILES = [
  './793dec9a669ff717266b2544c44bb3990e226f2c21c620b733b53c1f3670f8a231f2be3d80903e77c93700b141f9f163e8dd0ba58c152cbc9ba047bfa245499f',
  './793dec9a669ff717266b2544c44bb3990e2 26f2c21c620b733b53c1f3670f8a231f2be3 d80903e77c93700b141f9f163e8dd0ba58c 152cbc9ba047bfa245499f key'
];

/**
 * Search for the HX wallet in a JSON file
 * This handles different JSON structures we've seen
 */
function searchInJsonFile(filePath: string): string | null {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log(`File ${filePath} does not exist.`);
      return null;
    }
    
    // Read file content
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    try {
      // Parse JSON content
      const jsonData = JSON.parse(fileContent);
      
      // Case 1: Array of wallet objects
      if (Array.isArray(jsonData)) {
        for (const wallet of jsonData) {
          // Check if publicKey or address matches
          if ((wallet.publicKey === HX_WALLET_ADDRESS || wallet.address === HX_WALLET_ADDRESS) && 
              (wallet.privateKey || wallet.secretKey)) {
            console.log(`Found HX wallet private key in ${filePath}`);
            return wallet.privateKey || wallet.secretKey;
          }
        }
      }
      
      // Case 2: Object with wallets array
      else if (jsonData.wallets && Array.isArray(jsonData.wallets)) {
        for (const wallet of jsonData.wallets) {
          // Check if publicKey or address matches
          if ((wallet.publicKey === HX_WALLET_ADDRESS || wallet.address === HX_WALLET_ADDRESS) && 
              (wallet.privateKey || wallet.secretKey)) {
            console.log(`Found HX wallet private key in ${filePath}`);
            return wallet.privateKey || wallet.secretKey;
          }
        }
      }
      
      // Case 3: Object with differently formatted wallets
      else if (jsonData.wallets && typeof jsonData.wallets === 'object') {
        // Check each wallet property
        for (const key in jsonData.wallets) {
          const wallet = jsonData.wallets[key];
          if ((wallet.publicKey === HX_WALLET_ADDRESS || wallet.address === HX_WALLET_ADDRESS) && 
              (wallet.privateKey || wallet.secretKey)) {
            console.log(`Found HX wallet private key in ${filePath}`);
            return wallet.privateKey || wallet.secretKey;
          }
        }
      }
      
      // Case 4: Hierarchical object with wallet info nested deeper
      else if (jsonData.config && jsonData.config.wallets) {
        const wallets = jsonData.config.wallets;
        for (const key in wallets) {
          const wallet = wallets[key];
          if ((wallet.publicKey === HX_WALLET_ADDRESS || wallet.address === HX_WALLET_ADDRESS) && 
              (wallet.privateKey || wallet.secretKey)) {
            console.log(`Found HX wallet private key in ${filePath}`);
            return wallet.privateKey || wallet.secretKey;
          }
        }
      }
      
      // Case 5: Special format for main wallet
      else if (jsonData.main && (jsonData.main.address === HX_WALLET_ADDRESS) && jsonData.main.privateKey) {
        console.log(`Found HX wallet private key in ${filePath}`);
        return jsonData.main.privateKey;
      }
      
      console.log(`No matching wallet found in ${filePath}`);
      return null;
      
    } catch (jsonError) {
      console.error(`Error parsing JSON in ${filePath}:`, jsonError);
      return null;
    }
  } catch (fileError) {
    console.error(`Error reading file ${filePath}:`, fileError);
    return null;
  }
}

/**
 * Check direct key files that might contain the private key
 */
function checkDirectKeyFiles(): string | null {
  for (const filePath of ADDITIONAL_KEY_FILES) {
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8').trim();
        
        // If this is a direct private key
        if (content.length > 0 && !content.includes('{') && !content.includes('[')) {
          console.log(`Found possible private key in ${filePath}`);
          return content;
        }
      } catch (error) {
        console.error(`Error reading from ${filePath}:`, error);
      }
    }
  }
  
  return null;
}

/**
 * Validate if a private key corresponds to the HX wallet address
 */
function validatePrivateKey(privateKey: string): boolean {
  try {
    // Try with hex format
    try {
      const privateKeyBuffer = Buffer.from(privateKey, 'hex');
      const keypair = Keypair.fromSecretKey(privateKeyBuffer);
      const publicKeyStr = keypair.publicKey.toString();
      
      if (publicKeyStr === HX_WALLET_ADDRESS) {
        console.log('✅ Valid private key for HX wallet! Derived public key matches.');
        return true;
      } else {
        console.log(`❌ Private key is valid but resolves to ${publicKeyStr}, not ${HX_WALLET_ADDRESS}`);
        return false;
      }
    } catch (hexError) {
      // If hex format fails, try with base58 or other formats
      console.error('Error using hex format:', hexError);
      return false;
    }
  } catch (error) {
    console.error('Error validating private key:', error);
    return false;
  }
}

/**
 * Main function to find HX wallet private key
 */
function findHXWalletKey(): void {
  console.log(`Searching for private key of HX wallet: ${HX_WALLET_ADDRESS}`);
  console.log('==========================================================');
  
  // Search in all potential JSON files
  for (const filePath of POTENTIAL_FILES) {
    const privateKey = searchInJsonFile(filePath);
    
    if (privateKey) {
      console.log('==========================================================');
      console.log('Found private key candidate, validating...');
      
      if (validatePrivateKey(privateKey)) {
        console.log('==========================================================');
        console.log('PRIVATE KEY:', privateKey);
        console.log('==========================================================');
        console.log('To use this key, run:');
        console.log(`export HX_WALLET_PRIVATE_KEY="${privateKey}"`);
        console.log('==========================================================');
        return;
      }
    }
  }
  
  // Check direct key files
  const directKey = checkDirectKeyFiles();
  if (directKey) {
    console.log('==========================================================');
    console.log('Found potential direct key file, validating...');
    
    if (validatePrivateKey(directKey)) {
      console.log('==========================================================');
      console.log('PRIVATE KEY:', directKey);
      console.log('==========================================================');
      console.log('To use this key, run:');
      console.log(`export HX_WALLET_PRIVATE_KEY="${directKey}"`);
      console.log('==========================================================');
      return;
    }
  }
  
  console.log('==========================================================');
  console.log('❌ Could not find valid private key for HX wallet.');
  console.log('==========================================================');
}

// Run the script
findHXWalletKey();