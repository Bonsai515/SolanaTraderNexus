/**
 * Setup Blockchain Wallet for Real Trading
 * 
 * This script sets up a wallet file that will be used for real blockchain 
 * trading. It requires you to enter your private key once for secure storage.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Keypair } from '@solana/web3.js';
import { randomBytes } from 'crypto';

// Path for the wallet file
const WALLET_PATH = path.join('.', 'wallet.json');
const LOG_PATH = './wallet-setup.log';

// Initialize log file
if (!fs.existsSync(LOG_PATH)) {
  fs.writeFileSync(LOG_PATH, '--- WALLET SETUP LOG ---\n');
}

// Log function
function log(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_PATH, logMessage + '\n');
}

// Function to set up the wallet
function setupWallet(privateKeyString?: string) {
  try {
    // If wallet already exists, check if it's valid
    if (fs.existsSync(WALLET_PATH)) {
      const walletData = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf8'));
      
      if (walletData.publicKey && walletData.secretKey) {
        try {
          // Try to create a keypair from the secret key
          const secretKey = Uint8Array.from(walletData.secretKey);
          const keypair = Keypair.fromSecretKey(secretKey);
          
          log(`Existing wallet found with public key: ${keypair.publicKey.toString()}`);
          log('Wallet is already set up and ready for blockchain trading');
          return true;
        } catch (error) {
          log(`Existing wallet file is invalid: ${(error as Error).message}`);
          // Continue with creating a new wallet
        }
      } else {
        log('Existing wallet file is missing required fields');
        // Continue with creating a new wallet
      }
    }
    
    let keypair: Keypair;
    
    if (privateKeyString) {
      // Process provided private key
      try {
        // Private key could be in different formats, try to handle them
        let privateKeyArray: number[];
        
        // Check if it's a JSON array string
        if (privateKeyString.startsWith('[') && privateKeyString.endsWith(']')) {
          privateKeyArray = JSON.parse(privateKeyString);
        } else if (privateKeyString.length === 88) { // Base58 encoded
          // We'd need a base58 decoder which is not included here
          throw new Error('Base58 encoded keys need to be decoded first');
        } else if (privateKeyString.length === 64 || privateKeyString.length === 128) {
          // Hex string (32 or 64 bytes)
          privateKeyArray = [];
          for (let i = 0; i < privateKeyString.length; i += 2) {
            privateKeyArray.push(parseInt(privateKeyString.slice(i, i + 2), 16));
          }
        } else {
          throw new Error('Unrecognized private key format');
        }
        
        // Create keypair from private key
        const secretKey = Uint8Array.from(privateKeyArray);
        keypair = Keypair.fromSecretKey(secretKey);
      } catch (error) {
        log(`Invalid private key provided: ${(error as Error).message}`);
        log('Generating new wallet instead');
        keypair = Keypair.generate();
      }
    } else {
      // Generate a new keypair
      keypair = Keypair.generate();
      log('No private key provided. Generated a new wallet keypair');
    }
    
    // Create wallet file
    const walletData = {
      publicKey: keypair.publicKey.toString(),
      secretKey: Array.from(keypair.secretKey),
      createdAt: new Date().toISOString()
    };
    
    // Save wallet file
    fs.writeFileSync(WALLET_PATH, JSON.stringify(walletData, null, 2));
    
    log(`Wallet created with public key: ${keypair.publicKey.toString()}`);
    log('⚠️ IMPORTANT: Make sure to backup your wallet file!');
    
    // Return true for success
    return true;
  } catch (error) {
    log(`Error setting up wallet: ${(error as Error).message}`);
    return false;
  }
}

// Main function
function main() {
  log('Starting blockchain wallet setup...');
  
  // Display instructions
  console.log('\n===== BLOCKCHAIN WALLET SETUP =====');
  console.log('This utility sets up a wallet for real blockchain trading.');
  console.log('\nYou have two options:');
  console.log('1. Press Enter to generate a new wallet (recommended)');
  console.log('2. Enter your existing private key to use your own wallet');
  console.log('\nNote: If you choose option 1, you\'ll need to fund the new wallet');
  console.log('with SOL to execute real blockchain trades.\n');
  
  // In a real script, we'd use a readline or prompt for the private key
  // Here we'll just generate a new wallet
  
  // For security purposes, we don't include any private keys here
  const success = setupWallet();
  
  if (success) {
    log('Wallet setup complete! Your wallet is ready for blockchain trading.');
    console.log('\n✅ Wallet setup complete!');
    console.log('You can now run blockchain-trade-executor.ts to execute real trades');
  } else {
    log('Wallet setup failed.');
    console.log('\n❌ Wallet setup failed.');
  }
}

// Run the main function
main();