/**
 * Wallet Setup Utility
 * 
 * This script helps set up your wallet for direct blockchain trading.
 * It securely saves your private key for use with trading strategies.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Keypair, PublicKey } from '@solana/web3.js';
import * as readlineSync from 'readline-sync';
import * as crypto from 'crypto';

// Constants
const WALLET_PATH = './wallet.json';
const EXPECTED_PUBLIC_KEY = '2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH';
const LOG_PATH = './wallet-setup.log';

// Initialize log
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

// Generate encryption key based on a password
function deriveEncryptionKey(password: string): Buffer {
  return crypto.scryptSync(password, 'solana-trading-salt', 32);
}

// Encrypt data with a password
function encryptData(data: string, password: string): string {
  const key = deriveEncryptionKey(password);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// Decrypt data with a password
function decryptData(encryptedData: string, password: string): string {
  const key = deriveEncryptionKey(password);
  const parts = encryptedData.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Check if wallet exists
function walletExists(): boolean {
  return fs.existsSync(WALLET_PATH);
}

// Validate a private key
function validatePrivateKey(privateKeyString: string): Uint8Array | null {
  try {
    // Handle different private key formats
    let privateKeyArray: number[];
    
    // Check if it's a JSON array
    if (privateKeyString.startsWith('[') && privateKeyString.endsWith(']')) {
      privateKeyArray = JSON.parse(privateKeyString);
    } 
    // Check if it's a hex string
    else if (/^[0-9a-fA-F]+$/.test(privateKeyString)) {
      privateKeyArray = [];
      for (let i = 0; i < privateKeyString.length; i += 2) {
        privateKeyArray.push(parseInt(privateKeyString.slice(i, i + 2), 16));
      }
    } 
    // Assume it's a comma-separated list of numbers
    else {
      privateKeyArray = privateKeyString.split(',').map(n => parseInt(n.trim(), 10));
    }
    
    // Check if we have a valid length for a private key
    if (privateKeyArray.length !== 64) {
      log(`Invalid private key length: ${privateKeyArray.length} (expected 64)`);
      return null;
    }
    
    // Convert to Uint8Array
    return new Uint8Array(privateKeyArray);
  } catch (error) {
    log(`Error validating private key: ${(error as Error).message}`);
    return null;
  }
}

// Create a wallet based on private key
function createWallet(privateKey: Uint8Array, password: string): boolean {
  try {
    const keypair = Keypair.fromSecretKey(privateKey);
    const publicKey = keypair.publicKey.toString();
    
    // Check if public key matches expected
    if (publicKey !== EXPECTED_PUBLIC_KEY) {
      log(`Warning: Generated public key ${publicKey} does not match expected ${EXPECTED_PUBLIC_KEY}`);
      
      // Ask for confirmation
      const confirmationMessage = `The wallet public key (${publicKey}) doesn't match the expected primary wallet address. Continue anyway?`;
      if (!readlineSync.keyInYN(confirmationMessage)) {
        log('Wallet creation canceled by user');
        return false;
      }
    }
    
    // Encrypt private key
    const privateKeyJson = JSON.stringify(Array.from(privateKey));
    const encryptedPrivateKey = encryptData(privateKeyJson, password);
    
    // Save wallet data
    const walletData = {
      publicKey,
      encryptedPrivateKey,
      createdAt: new Date().toISOString()
    };
    
    fs.writeFileSync(WALLET_PATH, JSON.stringify(walletData, null, 2));
    log(`Wallet created successfully with public key: ${publicKey}`);
    
    return true;
  } catch (error) {
    log(`Error creating wallet: ${(error as Error).message}`);
    return false;
  }
}

// Save wallet in raw format (for compatibility with existing code)
function saveRawWallet(privateKey: Uint8Array): boolean {
  try {
    const keypair = Keypair.fromSecretKey(privateKey);
    const publicKey = keypair.publicKey.toString();
    
    // Save wallet in format compatible with existing code
    const walletData = {
      publicKey,
      secretKey: Array.from(privateKey),
      createdAt: new Date().toISOString()
    };
    
    fs.writeFileSync(WALLET_PATH, JSON.stringify(walletData, null, 2));
    log(`Wallet saved in raw format with public key: ${publicKey}`);
    
    return true;
  } catch (error) {
    log(`Error saving raw wallet: ${(error as Error).message}`);
    return false;
  }
}

// Main function
async function main() {
  console.clear();
  console.log('======================================');
  console.log('  SOLANA BLOCKCHAIN WALLET SETUP');
  console.log('======================================');
  console.log('\nThis utility will set up your wallet for blockchain trading.');
  
  if (walletExists()) {
    console.log('\nA wallet file already exists. Options:');
    console.log('1. Use existing wallet');
    console.log('2. Create new wallet (overwrites existing)');
    
    const choice = readlineSync.questionInt('Choose an option (1-2): ', { 
      limitMessage: 'Please enter 1 or 2',
      limit: [1, 2]
    });
    
    if (choice === 1) {
      console.log('\nUsing existing wallet.');
      log('User chose to use existing wallet');
      return;
    }
  }
  
  console.log('\nPlease enter your private key to create a wallet for direct blockchain trading.');
  console.log('This key will be stored securely for executing real trades on your behalf.');
  console.log('\nWARNING: Never share your private key with anyone!');
  
  const privateKeyInput = readlineSync.question('\nEnter private key: ', {
    hideEchoBack: true
  });
  
  // Validate private key
  const privateKey = validatePrivateKey(privateKeyInput);
  if (!privateKey) {
    console.log('\n❌ Invalid private key format. Please try again.');
    return;
  }
  
  // Create keypair from private key
  const keypair = Keypair.fromSecretKey(privateKey);
  const publicKey = keypair.publicKey.toString();
  
  console.log(`\nGenerated public key: ${publicKey}`);
  
  // Check if it matches the expected public key
  if (publicKey !== EXPECTED_PUBLIC_KEY) {
    console.log(`\n⚠️ Warning: The generated public key doesn't match the expected primary wallet address (${EXPECTED_PUBLIC_KEY}).`);
    
    const continueAnyway = readlineSync.keyInYN('Continue with this wallet anyway?');
    if (!continueAnyway) {
      console.log('\nWallet setup canceled.');
      return;
    }
  }
  
  // Ask for password if using encryption
  const useEncryption = readlineSync.keyInYN('\nWould you like to encrypt your private key with a password?');
  
  if (useEncryption) {
    const password = readlineSync.question('Create a password: ', {
      hideEchoBack: true
    });
    
    const confirmPassword = readlineSync.question('Confirm password: ', {
      hideEchoBack: true
    });
    
    if (password !== confirmPassword) {
      console.log('\n❌ Passwords do not match. Please try again.');
      return;
    }
    
    // Create encrypted wallet
    const success = createWallet(privateKey, password);
    
    if (success) {
      console.log('\n✅ Wallet created successfully!');
      console.log(`Public Key: ${publicKey}`);
      console.log('Your private key has been encrypted and saved.');
    } else {
      console.log('\n❌ Failed to create wallet. See log for details.');
    }
  } else {
    // Save in raw format
    const success = saveRawWallet(privateKey);
    
    if (success) {
      console.log('\n✅ Wallet saved successfully!');
      console.log(`Public Key: ${publicKey}`);
      console.log('Your private key has been saved in raw format.');
    } else {
      console.log('\n❌ Failed to save wallet. See log for details.');
    }
  }
  
  console.log('\nYour wallet is now ready for blockchain trading.');
}

// Run the main function
if (require.main === module) {
  main().catch(error => {
    console.error('Error in wallet setup:', error);
    log(`Fatal error: ${error.message}`);
  });
}