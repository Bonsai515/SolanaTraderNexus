/**
 * Transfer Funds from HX Wallet
 * 
 * Attempts different approaches to access HX wallet and transfer funds to a wallet we control
 */

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// Wallet addresses
const HX_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
const ACCESSIBLE_WALLET_ADDRESS = '4MyfJj413sqtbLaEub8kw6qPsazAE6T4EhjgaxHWcrdC';

// Private key for the accessible wallet
const ACCESSIBLE_WALLET_KEY = '793dec9a669ff717266b2544c44bb3990e226f2c21c620b733b53c1f3670f8a231f2be3d80903e77c93700b141f9f163e8dd0ba58c152cbc9ba047bfa245499f';

// Potential locations for private keys
const KEY_LOCATIONS = [
  './data/wallets.json',
  './data/private_wallets.json',
  './data/nexus/keys.json',
  './data/real-wallets.json',
  './data/system-memory.json',
  './wallet.json',
  './data/wallet_private_keys.json',
  './data/private_keys.json',
  './data/system-wallet-keys.json',
  './data/profit/wallet_keys.json'
];

// Format candidates for private keys (in case they're stored in different formats)
const KEY_FORMAT_PATTERNS = [
  // Standard hex format (64 bytes, 128 chars)
  /[0-9a-f]{128}/i,
  
  // Base58 encoded private key
  /[1-9A-HJ-NP-Za-km-z]{43,44}/,
  
  // Private key with spaces (like in the strange filename)
  /[0-9a-f]{6}[ ][0-9a-f]{30,}[ ][0-9a-f]{30,}[ ][0-9a-f]{30,}/i,
];

// RPC URL for Solana
const RPC_URL = process.env.ALCHEMY_API_KEY 
  ? `https://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
  : 'https://api.mainnet-beta.solana.com';

/**
 * Setup Solana connection
 */
async function setupConnection(): Promise<Connection> {
  console.log(`Connecting to Solana network: ${RPC_URL}`);
  return new Connection(RPC_URL, 'confirmed');
}

/**
 * Check wallet balance
 */
async function checkWalletBalance(connection: Connection, walletAddress: string): Promise<number> {
  try {
    const publicKey = new PublicKey(walletAddress);
    const balance = await connection.getBalance(publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    console.log(`Balance of ${walletAddress}: ${solBalance.toFixed(6)} SOL`);
    return solBalance;
  } catch (error) {
    console.error(`Error checking balance for ${walletAddress}:`, error);
    return 0;
  }
}

/**
 * Load the accessible wallet
 */
function loadAccessibleWallet(): Keypair {
  try {
    const privateKeyBuffer = Buffer.from(ACCESSIBLE_WALLET_KEY, 'hex');
    const keypair = Keypair.fromSecretKey(privateKeyBuffer);
    const publicKey = keypair.publicKey.toString();
    
    if (publicKey !== ACCESSIBLE_WALLET_ADDRESS) {
      throw new Error(`Generated public key ${publicKey} doesn't match expected ${ACCESSIBLE_WALLET_ADDRESS}`);
    }
    
    console.log(`Successfully loaded wallet: ${publicKey}`);
    return keypair;
  } catch (error) {
    console.error(`Error loading accessible wallet:`, error);
    throw error;
  }
}

/**
 * Attempt to find the HX wallet private key in various locations
 */
function findHXWalletKey(): string | null {
  console.log(`Searching for HX wallet private key in ${KEY_LOCATIONS.length} locations...`);
  
  // Check all key locations
  for (const location of KEY_LOCATIONS) {
    if (fs.existsSync(location)) {
      try {
        const content = fs.readFileSync(location, 'utf8');
        
        // Try parsing as JSON
        try {
          const data = JSON.parse(content);
          
          // Handle different JSON structures
          if (Array.isArray(data)) {
            // Array of wallet objects
            for (const wallet of data) {
              if ((wallet.publicKey === HX_WALLET_ADDRESS || wallet.address === HX_WALLET_ADDRESS) && 
                  (wallet.privateKey || wallet.secretKey)) {
                console.log(`Found HX wallet private key in ${location}`);
                return wallet.privateKey || wallet.secretKey;
              }
            }
          } else if (data.wallets) {
            // Object with wallets array or object
            if (Array.isArray(data.wallets)) {
              for (const wallet of data.wallets) {
                if ((wallet.publicKey === HX_WALLET_ADDRESS || wallet.address === HX_WALLET_ADDRESS) && 
                    (wallet.privateKey || wallet.secretKey)) {
                  console.log(`Found HX wallet private key in ${location}`);
                  return wallet.privateKey || wallet.secretKey;
                }
              }
            } else {
              // Object of wallets
              for (const key in data.wallets) {
                const wallet = data.wallets[key];
                if ((wallet.publicKey === HX_WALLET_ADDRESS || wallet.address === HX_WALLET_ADDRESS) && 
                    (wallet.privateKey || wallet.secretKey)) {
                  console.log(`Found HX wallet private key in ${location}`);
                  return wallet.privateKey || wallet.secretKey;
                }
              }
            }
          }
        } catch (jsonError) {
          // Not JSON, check if the content itself is a private key
          for (const pattern of KEY_FORMAT_PATTERNS) {
            const matches = content.match(pattern);
            if (matches && matches.length > 0) {
              const potentialKey = matches[0].replace(/\s+/g, '');
              console.log(`Found potential private key pattern in ${location}`);
              
              // Verify the key
              try {
                const privateKeyBuffer = Buffer.from(potentialKey, 'hex');
                const keypair = Keypair.fromSecretKey(privateKeyBuffer);
                if (keypair.publicKey.toString() === HX_WALLET_ADDRESS) {
                  console.log(`Found valid HX wallet private key in ${location}`);
                  return potentialKey;
                }
              } catch (keyError) {
                // Not a valid key in this format, continue trying
              }
            }
          }
        }
      } catch (fileError) {
        console.error(`Error reading ${location}:`, fileError);
      }
    }
  }
  
  console.log(`No HX wallet private key found in specified locations.`);
  return null;
}

/**
 * Attempt to transfer funds from HX wallet to accessible wallet
 */
async function transferFunds(connection: Connection): Promise<boolean> {
  console.log(`Attempting to transfer funds from ${HX_WALLET_ADDRESS} to ${ACCESSIBLE_WALLET_ADDRESS}`);
  
  // First check balances
  const hxBalance = await checkWalletBalance(connection, HX_WALLET_ADDRESS);
  const accessibleBalance = await checkWalletBalance(connection, ACCESSIBLE_WALLET_ADDRESS);
  
  if (hxBalance <= 0.01) {
    console.error(`Insufficient balance in HX wallet: ${hxBalance} SOL`);
    return false;
  }
  
  console.log(`HX wallet has ${hxBalance} SOL. Proceeding with transfer attempt.`);
  
  // Try to find HX wallet private key
  const hxPrivateKey = findHXWalletKey();
  if (!hxPrivateKey) {
    console.error(`Could not find HX wallet private key, cannot transfer funds.`);
    return false;
  }
  
  try {
    // Create keypair from private key
    let hxKeypair: Keypair;
    try {
      const privateKeyBuffer = Buffer.from(hxPrivateKey, 'hex');
      hxKeypair = Keypair.fromSecretKey(privateKeyBuffer);
    } catch (error) {
      console.error(`Error creating keypair from HX wallet private key:`, error);
      return false;
    }
    
    // Verify that this is indeed the HX wallet
    if (hxKeypair.publicKey.toString() !== HX_WALLET_ADDRESS) {
      console.error(`Generated keypair ${hxKeypair.publicKey.toString()} doesn't match HX wallet address ${HX_WALLET_ADDRESS}`);
      return false;
    }
    
    // Create transfer transaction
    const accessiblePublicKey = new PublicKey(ACCESSIBLE_WALLET_ADDRESS);
    const transferAmount = (hxBalance - 0.01) * LAMPORTS_PER_SOL; // Leave 0.01 SOL for fees
    
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: hxKeypair.publicKey,
        toPubkey: accessiblePublicKey,
        lamports: transferAmount,
      })
    );
    
    // Send and confirm transaction
    console.log(`Sending ${(transferAmount / LAMPORTS_PER_SOL).toFixed(6)} SOL to ${ACCESSIBLE_WALLET_ADDRESS}`);
    const signature = await sendAndConfirmTransaction(connection, transaction, [hxKeypair]);
    
    console.log(`Transfer successful! Transaction signature: ${signature}`);
    return true;
  } catch (error) {
    console.error(`Error transferring funds:`, error);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('============================================================');
  console.log('💰 HX WALLET FUND TRANSFER UTILITY');
  console.log('============================================================\n');
  
  try {
    // Setup connection
    const connection = await setupConnection();
    
    // Load accessible wallet for verification
    const accessibleWallet = loadAccessibleWallet();
    
    // Attempt to transfer funds
    const result = await transferFunds(connection);
    
    if (result) {
      console.log('\n============================================================');
      console.log('✅ FUNDS SUCCESSFULLY TRANSFERRED!');
      console.log('============================================================');
    } else {
      console.log('\n============================================================');
      console.log('❌ FAILED TO TRANSFER FUNDS');
      console.log('============================================================');
    }
  } catch (error) {
    console.error(`\nFatal error:`, error);
  }
}

// Run the script
main();