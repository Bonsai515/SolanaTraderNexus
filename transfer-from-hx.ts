/**
 * Transfer funds from HX wallet to main wallet
 * 
 * This script searches for the HX wallet private key and transfers
 * all funds to the main wallet where we have the private key.
 */

import { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import * as bs58 from 'bs58';
import { config } from 'dotenv';

// Load environment variables
config();

// Constants
const HX_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
const MAIN_WALLET_ADDRESS = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqb';
const RPC_URL = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';

// List of possible keys to check
const POSSIBLE_PRIVATE_KEYS = [
  // Derived from file pattern in previous scripts
  '793dec9a669ff717266b2544c44bb3990e226f2c21c620b733b53c1f3670f8a231f2be3d80903e77c93700b141f9f163e8dd0ba58c152cbc9ba047bfa245499f',
  
  // Alternative formats (remove spaces)
  '793dec9a669ff717266b2544c44bb3990e226f2c21c620b733b53c1f3670f8a231f2be3d80903e77c93700b141f9f163e8dd0ba58c152cbc9ba047bfa245499f'.replace(/\s+/g, ''),
  
  // Try with different segmentation
  '793dec9a669ff717266b2544c44bb3990e2 26f2c21c620b733b53c1f3670f8a231f2be3 d80903e77c93700b141f9f163e8dd0ba58c 152cbc9ba047bfa245499f'.replace(/\s+/g, '')
];

// List of possible locations for private keys
const KEY_LOCATIONS = [
  './data/keys.json',
  './data/wallets.json',
  './data/private_wallets.json',
  './data/real-wallets.json',
  './data/system-memory.json',
  './data/nexus/keys.json',
  './wallet.json',
  './data/transactionEngine/wallets.json',
  './793dec9a669ff717266b2544c44bb3990e226f2c21c620b733b53c1f3670f8a231f2be3d80903e77c93700b141f9f163e8dd0ba58c152cbc9ba047bfa245499f',
  './793dec9a669ff717266b2544c44bb3990e2 26f2c21c620b733b53c1f3670f8a231f2be3 d80903e77c93700b141f9f163e8dd0ba58c 152cbc9ba047bfa245499f key'
];

// Check wallet balances
async function checkWalletBalances(): Promise<{ hxBalance: number, mainBalance: number }> {
  console.log('\nChecking wallet balances...');
  
  try {
    const connection = new Connection(RPC_URL);
    
    // Check HX wallet balance
    const hxPublicKey = new PublicKey(HX_WALLET_ADDRESS);
    const hxBalance = await connection.getBalance(hxPublicKey);
    const hxBalanceSOL = hxBalance / LAMPORTS_PER_SOL;
    console.log(`HX wallet balance: ${hxBalanceSOL.toFixed(6)} SOL`);
    
    // Check main wallet balance
    const mainPublicKey = new PublicKey(MAIN_WALLET_ADDRESS);
    const mainBalance = await connection.getBalance(mainPublicKey);
    const mainBalanceSOL = mainBalance / LAMPORTS_PER_SOL;
    console.log(`Main wallet balance: ${mainBalanceSOL.toFixed(6)} SOL`);
    
    return {
      hxBalance: hxBalanceSOL,
      mainBalance: mainBalanceSOL
    };
  } catch (error) {
    console.error('Error checking wallet balances:', error);
    return {
      hxBalance: 0,
      mainBalance: 0
    };
  }
}

// Try to create keypair from a string
function tryCreateKeypair(privateKeyStr: string): Keypair | null {
  try {
    // Try as hex string
    if (/^[0-9a-f]{128}$/i.test(privateKeyStr)) {
      const privateKeyBuffer = Buffer.from(privateKeyStr, 'hex');
      const keypair = Keypair.fromSecretKey(new Uint8Array(privateKeyBuffer));
      return keypair;
    }
    
    // Try as array of numbers
    try {
      const arr = JSON.parse(privateKeyStr);
      if (Array.isArray(arr) && arr.length === 64) {
        const keypair = Keypair.fromSecretKey(new Uint8Array(arr));
        return keypair;
      }
    } catch (e) {
      // Not valid JSON
    }
    
    // Try as base58
    try {
      const decoded = bs58.decode(privateKeyStr);
      if (decoded.length === 64) {
        const keypair = Keypair.fromSecretKey(new Uint8Array(decoded));
        return keypair;
      }
    } catch (e) {
      // Not valid base58
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

// Search for HX wallet private key
async function findHXWalletPrivateKey(): Promise<Keypair | null> {
  console.log('\nSearching for HX wallet private key...');
  
  // Try hardcoded keys
  for (const key of POSSIBLE_PRIVATE_KEYS) {
    try {
      const keypair = tryCreateKeypair(key);
      if (keypair && keypair.publicKey.toString() === HX_WALLET_ADDRESS) {
        console.log('✅ Found HX wallet private key in hardcoded list');
        return keypair;
      }
    } catch (error) {
      // Continue to next key
    }
  }
  
  // Search in possible locations
  for (const location of KEY_LOCATIONS) {
    if (fs.existsSync(location)) {
      try {
        console.log(`Checking ${location}...`);
        const content = fs.readFileSync(location, 'utf8');
        
        // Try direct content as key
        try {
          const keypair = tryCreateKeypair(content.trim());
          if (keypair && keypair.publicKey.toString() === HX_WALLET_ADDRESS) {
            console.log(`✅ Found HX wallet private key in ${location}`);
            return keypair;
          }
        } catch (e) {
          // Not a direct key
        }
        
        // Try parsing as JSON
        try {
          const data = JSON.parse(content);
          
          // Check array of wallets
          if (Array.isArray(data)) {
            for (const item of data) {
              if (
                (item.publicKey === HX_WALLET_ADDRESS || item.address === HX_WALLET_ADDRESS) && 
                (item.privateKey || item.secretKey)
              ) {
                const privateKey = item.privateKey || item.secretKey;
                const keypair = tryCreateKeypair(privateKey);
                if (keypair && keypair.publicKey.toString() === HX_WALLET_ADDRESS) {
                  console.log(`✅ Found HX wallet private key in ${location} (wallet array)`);
                  return keypair;
                }
              }
            }
          }
          
          // Check object with wallets property
          if (data.wallets) {
            if (Array.isArray(data.wallets)) {
              for (const wallet of data.wallets) {
                if (
                  (wallet.publicKey === HX_WALLET_ADDRESS || wallet.address === HX_WALLET_ADDRESS) && 
                  (wallet.privateKey || wallet.secretKey)
                ) {
                  const privateKey = wallet.privateKey || wallet.secretKey;
                  const keypair = tryCreateKeypair(privateKey);
                  if (keypair && keypair.publicKey.toString() === HX_WALLET_ADDRESS) {
                    console.log(`✅ Found HX wallet private key in ${location} (wallets array)`);
                    return keypair;
                  }
                }
              }
            } else if (typeof data.wallets === 'object') {
              for (const [address, wallet] of Object.entries(data.wallets)) {
                if (
                  address === HX_WALLET_ADDRESS && 
                  (wallet.privateKey || wallet.secretKey)
                ) {
                  const privateKey = wallet.privateKey || wallet.secretKey;
                  const keypair = tryCreateKeypair(privateKey);
                  if (keypair && keypair.publicKey.toString() === HX_WALLET_ADDRESS) {
                    console.log(`✅ Found HX wallet private key in ${location} (wallets object)`);
                    return keypair;
                  }
                }
              }
            }
          }
          
          // Check direct wallet object
          if (
            (data.publicKey === HX_WALLET_ADDRESS || data.address === HX_WALLET_ADDRESS) && 
            (data.privateKey || data.secretKey)
          ) {
            const privateKey = data.privateKey || data.secretKey;
            const keypair = tryCreateKeypair(privateKey);
            if (keypair && keypair.publicKey.toString() === HX_WALLET_ADDRESS) {
              console.log(`✅ Found HX wallet private key in ${location} (direct wallet object)`);
              return keypair;
            }
          }
        } catch (e) {
          // Not JSON or error parsing
        }
        
        // Search for hex private keys in the file
        const hexPattern = /[0-9a-f]{128}/gi;
        const matches = content.match(hexPattern);
        if (matches) {
          for (const match of matches) {
            try {
              const keypair = tryCreateKeypair(match);
              if (keypair && keypair.publicKey.toString() === HX_WALLET_ADDRESS) {
                console.log(`✅ Found HX wallet private key in ${location} (hex pattern match)`);
                return keypair;
              }
            } catch (e) {
              // Not a valid key
            }
          }
        }
      } catch (error) {
        console.error(`Error checking ${location}:`, error);
      }
    }
  }
  
  // Search environment variables
  for (const [key, value] of Object.entries(process.env)) {
    if (
      (key.includes('KEY') || key.includes('PRIVATE') || key.includes('SECRET')) &&
      value && value.length > 30
    ) {
      try {
        const keypair = tryCreateKeypair(value);
        if (keypair && keypair.publicKey.toString() === HX_WALLET_ADDRESS) {
          console.log(`✅ Found HX wallet private key in environment variable ${key}`);
          return keypair;
        }
      } catch (e) {
        // Not a valid key
      }
    }
  }
  
  console.log('❌ Could not find HX wallet private key');
  return null;
}

// Create a new keypair for manual entry
async function createKeypairForManualEntry(): Promise<Keypair> {
  console.log('\nCreating a new keypair for manual transfer...');
  
  const keypair = Keypair.generate();
  console.log(`Generated new keypair with public key: ${keypair.publicKey.toString()}`);
  console.log(`Private key (keep safe!): ${Buffer.from(keypair.secretKey).toString('hex')}`);
  
  return keypair;
}

// Transfer funds from one wallet to another
async function transferFunds(sourceKeypair: Keypair, destinationAddress: string, amountSOL: number): Promise<string> {
  console.log(`\nTransferring ${amountSOL.toFixed(6)} SOL to ${destinationAddress}...`);
  
  try {
    const connection = new Connection(RPC_URL);
    const destinationPublicKey = new PublicKey(destinationAddress);
    
    // Calculate lamports (leave some for fees)
    const lamports = Math.floor(amountSOL * LAMPORTS_PER_SOL) - 5000; // Subtract 5000 lamports for fee
    
    // Create transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: sourceKeypair.publicKey,
        toPubkey: destinationPublicKey,
        lamports
      })
    );
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = sourceKeypair.publicKey;
    
    // Sign transaction
    transaction.sign(sourceKeypair);
    
    // Send transaction
    const signature = await connection.sendRawTransaction(transaction.serialize());
    console.log(`Transaction sent with signature: ${signature}`);
    
    // Confirm transaction
    await connection.confirmTransaction(signature);
    console.log('Transaction confirmed!');
    
    return signature;
  } catch (error) {
    console.error('Error transferring funds:', error);
    throw error;
  }
}

// Main function
async function main() {
  console.log('=== HX WALLET FUNDS TRANSFER ===');
  
  // Check wallet balances
  const { hxBalance, mainBalance } = await checkWalletBalances();
  
  if (hxBalance < 0.01) {
    console.error('HX wallet has insufficient balance. Aborting.');
    return;
  }
  
  // Find HX wallet private key
  const hxKeypair = await findHXWalletPrivateKey();
  
  if (!hxKeypair) {
    console.log('\nUnable to find HX wallet private key automatically.');
    console.log('Please contact support or provide the private key manually to transfer the funds.');
    return;
  }
  
  try {
    // Verify keypair
    if (hxKeypair.publicKey.toString() !== HX_WALLET_ADDRESS) {
      console.error('Keypair verification failed. Public key does not match HX wallet address.');
      return;
    }
    
    // Transfer funds (leave 0.01 SOL for fees)
    const transferAmount = hxBalance - 0.01;
    await transferFunds(hxKeypair, MAIN_WALLET_ADDRESS, transferAmount);
    
    // Check updated balances
    console.log('\nChecking updated balances...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for blockchain confirmation
    const updatedBalances = await checkWalletBalances();
    
    console.log('\n=== FUNDS TRANSFER COMPLETE ===');
    console.log(`Transferred ${transferAmount.toFixed(6)} SOL from HX wallet to main wallet`);
    
    // Calculate the increase
    const increase = updatedBalances.mainBalance - mainBalance;
    if (increase > 0) {
      console.log(`Main wallet balance increased by ${increase.toFixed(6)} SOL`);
    }
  } catch (error) {
    console.error('Error in fund transfer:', error);
    
    console.log('\nAttempting alternate method...');
    console.log('Generating small transfer to verify key...');
    
    try {
      // Try a small test transfer first
      await transferFunds(hxKeypair, MAIN_WALLET_ADDRESS, 0.01);
      console.log('Small transfer successful, proceeding with full transfer...');
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Transfer remaining funds
      const remainingBalance = hxBalance - 0.02; // Leave 0.02 (0.01 already sent + 0.01 for fees)
      if (remainingBalance > 0) {
        await transferFunds(hxKeypair, MAIN_WALLET_ADDRESS, remainingBalance);
      }
    } catch (secondError) {
      console.error('Error in alternate transfer method:', secondError);
    }
  }
}

// Run the main function
main()
  .catch(console.error);