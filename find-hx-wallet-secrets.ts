/**
 * Find HX Wallet Private Key
 * 
 * This script searches for the private key of the HX wallet
 * using various methods and known patterns.
 */

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// Constants
const HX_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
const RPC_URL = 'https://empty-hidden-spring.solana-mainnet.quiknode.pro/ea24f1bb95ea3b2dc4cddbe74a4bce8e10eaa88e/';
const BACKUP_RPC_URL = 'https://api.mainnet-beta.solana.com';

// The key you provided in array format
const PROVIDED_KEY = [
  121, 61, 236, 154, 102, 159, 247, 23, 38,
  107, 37, 68, 196, 75, 179, 153,
  14, 34, 111, 44, 33, 198, 32, 183, 51,
  181, 60, 31, 54, 112, 248, 162,
  49, 242, 190, 61, 128, 144, 62, 119, 201,
  55, 0, 177, 65, 249, 241, 99,
  232, 221, 11, 165, 140, 21, 44, 188, 155,
  160, 71, 191, 162, 69, 73, 159
];

// Connect to Solana
function connectToSolana(): Connection {
  try {
    console.log('Connecting to Solana via premium QuickNode RPC...');
    return new Connection(RPC_URL, 'confirmed');
  } catch (error) {
    console.log(`Failed to connect to premium RPC: ${(error as Error).message}`);
    console.log('Falling back to public RPC...');
    return new Connection(BACKUP_RPC_URL, 'confirmed');
  }
}

// Check wallet balance
async function checkWalletBalance(connection: Connection, walletAddress: string): Promise<number> {
  try {
    const publicKey = new PublicKey(walletAddress);
    const balance = await connection.getBalance(publicKey);
    const balanceSOL = balance / LAMPORTS_PER_SOL;
    
    console.log(`${walletAddress} balance: ${balanceSOL.toFixed(6)} SOL`);
    return balance;
  } catch (error) {
    console.log(`Error checking wallet balance: ${(error as Error).message}`);
    return 0;
  }
}

// Try key with different formats
function tryKeyVariations() {
  console.log('\n=== TRYING KEY VARIATIONS ===');
  
  try {
    // Try direct array
    console.log('\nTrying provided key array directly...');
    try {
      const keypair = Keypair.fromSecretKey(new Uint8Array(PROVIDED_KEY));
      const address = keypair.publicKey.toString();
      console.log(`Generated address: ${address}`);
      console.log(`Matches HX wallet: ${address === HX_WALLET_ADDRESS}`);
    } catch (error) {
      console.log(`Error using direct array: ${(error as Error).message}`);
    }
    
    // Try reversed array
    console.log('\nTrying reversed key array...');
    try {
      const reversed = [...PROVIDED_KEY].reverse();
      const keypair = Keypair.fromSecretKey(new Uint8Array(reversed));
      const address = keypair.publicKey.toString();
      console.log(`Generated address: ${address}`);
      console.log(`Matches HX wallet: ${address === HX_WALLET_ADDRESS}`);
    } catch (error) {
      console.log(`Error using reversed array: ${(error as Error).message}`);
    }

    // Try with BIP39 mnemonic pattern
    console.log('\nTrying reordering the array in groups...');
    try {
      // Reorder words (groups of 4 bytes)
      const words = [];
      for (let i = 0; i < PROVIDED_KEY.length; i += 4) {
        const word = PROVIDED_KEY.slice(i, i + 4);
        words.push(word);
      }
      
      // Try different word orderings
      for (let i = 0; i < Math.min(5, words.length); i++) {
        try {
          const reordered = [];
          const startOffset = i;
          for (let j = 0; j < words.length; j++) {
            const wordIdx = (startOffset + j) % words.length;
            reordered.push(...words[wordIdx]);
          }
          
          const keypair = Keypair.fromSecretKey(new Uint8Array(reordered));
          const address = keypair.publicKey.toString();
          console.log(`Reordering start=${i}, generated: ${address}`);
          console.log(`Matches HX wallet: ${address === HX_WALLET_ADDRESS}`);
          
          if (address === HX_WALLET_ADDRESS) {
            console.log('✅ Found matching key through reordering!');
            break;
          }
        } catch (error) {
          // Silently skip reordering errors
        }
      }
    } catch (error) {
      console.log(`Error reordering: ${(error as Error).message}`);
    }
    
    // Try converting to hex and back
    console.log('\nTrying hex conversion...');
    try {
      const hexString = Buffer.from(new Uint8Array(PROVIDED_KEY)).toString('hex');
      console.log(`Hex representation: ${hexString}`);
      
      const hexBuffer = Buffer.from(hexString, 'hex');
      const keypair = Keypair.fromSecretKey(new Uint8Array(hexBuffer));
      const address = keypair.publicKey.toString();
      console.log(`Generated address: ${address}`);
      console.log(`Matches HX wallet: ${address === HX_WALLET_ADDRESS}`);
    } catch (error) {
      console.log(`Error using hex: ${(error as Error).message}`);
    }
  } catch (error) {
    console.log(`Error trying key variations: ${(error as Error).message}`);
  }
}

// Try keys from files
function tryKeysFromFiles() {
  console.log('\n=== SEARCHING FILES FOR KEYS ===');
  
  const potentialFiles = [
    './data/private_wallets.json',
    './data/wallets.json',
    './data/real-wallets.json',
    './wallet.json',
    './data/nexus/keys.json'
  ];
  
  for (const file of potentialFiles) {
    if (fs.existsSync(file)) {
      console.log(`\nChecking ${file}...`);
      try {
        const content = fs.readFileSync(file, 'utf8');
        const data = JSON.parse(content);
        
        // Check if data is an array
        if (Array.isArray(data)) {
          for (const item of data) {
            if (
              (item.publicKey === HX_WALLET_ADDRESS || item.address === HX_WALLET_ADDRESS) &&
              (item.privateKey || item.secretKey)
            ) {
              console.log(`✅ Found HX wallet info in ${file}`);
              
              const keyHex = item.privateKey || item.secretKey;
              console.log(`Private key format: ${typeof keyHex}`);
              console.log(`Private key length: ${keyHex.length}`);
              
              try {
                const keyBuffer = Buffer.from(keyHex, 'hex');
                const keypair = Keypair.fromSecretKey(new Uint8Array(keyBuffer));
                console.log(`Verified key generates address: ${keypair.publicKey.toString()}`);
                return;  // Success
              } catch (error) {
                console.log(`Error creating keypair: ${(error as Error).message}`);
              }
            }
          }
        } 
        // Check if data has a wallets key
        else if (data.wallets) {
          if (Array.isArray(data.wallets)) {
            for (const item of data.wallets) {
              if (
                (item.publicKey === HX_WALLET_ADDRESS || item.address === HX_WALLET_ADDRESS) &&
                (item.privateKey || item.secretKey)
              ) {
                console.log(`✅ Found HX wallet info in ${file}.wallets`);
                
                const keyHex = item.privateKey || item.secretKey;
                console.log(`Private key format: ${typeof keyHex}`);
                console.log(`Private key length: ${keyHex.length}`);
                
                try {
                  const keyBuffer = Buffer.from(keyHex, 'hex');
                  const keypair = Keypair.fromSecretKey(new Uint8Array(keyBuffer));
                  console.log(`Verified key generates address: ${keypair.publicKey.toString()}`);
                  return;  // Success
                } catch (error) {
                  console.log(`Error creating keypair: ${(error as Error).message}`);
                }
              }
            }
          }
        }
      } catch (error) {
        console.log(`Error processing ${file}: ${(error as Error).message}`);
      }
    } else {
      console.log(`File not found: ${file}`);
    }
  }
  
  console.log('❌ Could not find HX wallet information in files');
}

// Main function
async function main() {
  console.log('=== HX WALLET PRIVATE KEY FINDER ===');
  console.log(`Looking for private key for wallet: ${HX_WALLET_ADDRESS}`);
  
  // Connect to Solana
  const connection = connectToSolana();
  
  // Check HX wallet balance
  const hxBalance = await checkWalletBalance(connection, HX_WALLET_ADDRESS);
  
  if (hxBalance <= 0) {
    console.log('❌ HX wallet has no balance. Verify the wallet address is correct.');
    return;
  }
  
  // Try key variations based on the provided key
  tryKeyVariations();
  
  // Search for wallet information in files
  tryKeysFromFiles();
}

// Run the main function
main().catch(console.error);