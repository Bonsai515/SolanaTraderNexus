/**
 * Comprehensive HX Wallet Recovery Tool
 * 
 * This script attempts multiple approaches to recover the private key for the HX wallet
 * and transfer the funds to your main trading wallet.
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
const TARGET_WALLET_ADDRESS = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK'; // Main trading wallet
const RPC_URL = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';

// Possible locations of private key
const KEY_FILES = [
  './data/wallets.json',
  './data/private_wallets.json',
  './data/keys.json',
  './data/real-wallets.json',
  './data/system-wallets.json',
  './data/nexus/keys.json',
  './data/nexus/wallets.json',
  './wallet.json',
  './key.json',
  './data/system-memory.json',
  './793dec9a669ff717266b2544c44bb3990e226f2c21c620b733b53c1f3670f8a231f2be3d80903e77c93700b141f9f163e8dd0ba58c152cbc9ba047bfa245499f',
  './793dec9a669ff717266b2544c44bb3990e2 26f2c21c620b733b53c1f3670f8a231f2be3 d80903e77c93700b141f9f163e8dd0ba58c 152cbc9ba047bfa245499f key'
];

// Recursively search for potential key files
function findPotentialKeyFiles(dir: string = '.', depth: number = 3): string[] {
  if (depth <= 0) return [];
  
  let results: string[] = [];
  try {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        // Skip node_modules and other problematic directories
        if (file === 'node_modules' || file === '.git' || file === 'target') continue;
        
        // Recursively search subdirectories
        results = results.concat(findPotentialKeyFiles(filePath, depth - 1));
      } else if (
        file.includes('wallet') || 
        file.includes('key') || 
        file.includes('secret') || 
        file.includes('private') ||
        file.endsWith('.json') || 
        file.endsWith('.key')
      ) {
        results.push(filePath);
      }
    }
  } catch (error) {
    console.error(`Error searching directory ${dir}:`, error);
  }
  
  return results;
}

// Check if a string could be a private key
function isPotentialPrivateKey(str: string): boolean {
  // Check if it's a hex encoded private key (64 bytes = 128 hex chars)
  if (/^[0-9a-f]{128}$/i.test(str)) {
    return true;
  }
  
  // Check if it's a base58 encoded private key (64 bytes in base58 is approximately 86-90 chars)
  if (/^[1-9A-HJ-NP-Za-km-z]{86,90}$/.test(str)) {
    return true;
  }
  
  // Check for array that might be Uint8Array data
  try {
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed) && parsed.length === 64) {
      // Check if all entries are numbers 0-255
      return parsed.every(num => typeof num === 'number' && num >= 0 && num <= 255);
    }
  } catch (e) {
    // Not JSON
  }
  
  return false;
}

// Try to create keypair from potential private key
function tryCreateKeypair(privateKeyStr: string): Keypair | null {
  try {
    // Case 1: Hex string
    if (/^[0-9a-f]{128}$/i.test(privateKeyStr)) {
      const privateKeyBuffer = Buffer.from(privateKeyStr, 'hex');
      return Keypair.fromSecretKey(new Uint8Array(privateKeyBuffer));
    }
    
    // Case 2: Base58 encoded
    if (/^[1-9A-HJ-NP-Za-km-z]{86,90}$/.test(privateKeyStr)) {
      const decoded = bs58.decode(privateKeyStr);
      return Keypair.fromSecretKey(new Uint8Array(decoded));
    }
    
    // Case 3: JSON array of numbers
    try {
      const parsed = JSON.parse(privateKeyStr);
      if (Array.isArray(parsed) && parsed.length === 64) {
        return Keypair.fromSecretKey(new Uint8Array(parsed));
      }
    } catch (e) {
      // Not JSON
    }
    
    return null;
  } catch (error) {
    console.log('Error creating keypair:', error);
    return null;
  }
}

// Search for HX wallet private key in all potential files
async function findHXWalletKey(): Promise<Keypair | null> {
  console.log(`\n=== SEARCHING FOR HX WALLET KEY ===`);
  console.log(`Target address: ${HX_WALLET_ADDRESS}`);
  
  // Start with the predefined key files
  console.log(`\nChecking ${KEY_FILES.length} predefined key files...`);
  for (const file of KEY_FILES) {
    if (fs.existsSync(file)) {
      console.log(`Checking file: ${file}`);
      try {
        const content = fs.readFileSync(file, 'utf8');
        
        // Try parsing as JSON
        try {
          const data = JSON.parse(content);
          
          // Check for different JSON formats
          
          // Format 1: Array of numbers (Uint8Array data)
          if (Array.isArray(data) && data.length === 64) {
            const keypair = Keypair.fromSecretKey(new Uint8Array(data));
            if (keypair.publicKey.toString() === HX_WALLET_ADDRESS) {
              console.log(`✅ Found HX wallet key in ${file} (Uint8Array format)`);
              return keypair;
            }
          }
          
          // Format 2: Array of wallet objects
          if (Array.isArray(data)) {
            for (const item of data) {
              if (
                (item.publicKey === HX_WALLET_ADDRESS || item.address === HX_WALLET_ADDRESS) && 
                (item.privateKey || item.secretKey)
              ) {
                console.log(`✅ Found HX wallet key in ${file} (wallet object in array)`);
                const privateKey = item.privateKey || item.secretKey;
                const keypair = tryCreateKeypair(privateKey);
                if (keypair && keypair.publicKey.toString() === HX_WALLET_ADDRESS) {
                  return keypair;
                }
              }
            }
          }
          
          // Format 3: Object with wallets property
          if (data.wallets) {
            if (Array.isArray(data.wallets)) {
              // Array of wallet objects
              for (const wallet of data.wallets) {
                if (
                  (wallet.publicKey === HX_WALLET_ADDRESS || wallet.address === HX_WALLET_ADDRESS) && 
                  (wallet.privateKey || wallet.secretKey)
                ) {
                  console.log(`✅ Found HX wallet key in ${file} (wallet object in wallets array)`);
                  const privateKey = wallet.privateKey || wallet.secretKey;
                  const keypair = tryCreateKeypair(privateKey);
                  if (keypair && keypair.publicKey.toString() === HX_WALLET_ADDRESS) {
                    return keypair;
                  }
                }
              }
            } else if (typeof data.wallets === 'object') {
              // Object with wallet addresses as keys
              for (const [address, wallet] of Object.entries(data.wallets)) {
                if (
                  address === HX_WALLET_ADDRESS && 
                  (wallet.privateKey || wallet.secretKey)
                ) {
                  console.log(`✅ Found HX wallet key in ${file} (wallet in wallets object)`);
                  const privateKey = wallet.privateKey || wallet.secretKey;
                  const keypair = tryCreateKeypair(privateKey);
                  if (keypair && keypair.publicKey.toString() === HX_WALLET_ADDRESS) {
                    return keypair;
                  }
                }
              }
            }
          }
          
          // Format 4: Direct object with keys
          if (
            (data.publicKey === HX_WALLET_ADDRESS || data.address === HX_WALLET_ADDRESS) && 
            (data.privateKey || data.secretKey)
          ) {
            console.log(`✅ Found HX wallet key in ${file} (direct wallet object)`);
            const privateKey = data.privateKey || data.secretKey;
            const keypair = tryCreateKeypair(privateKey);
            if (keypair && keypair.publicKey.toString() === HX_WALLET_ADDRESS) {
              return keypair;
            }
          }
          
        } catch (e) {
          // Not JSON, check if content is a private key itself
          const keypair = tryCreateKeypair(content.trim());
          if (keypair && keypair.publicKey.toString() === HX_WALLET_ADDRESS) {
            console.log(`✅ Found HX wallet key in ${file} (raw key)`);
            return keypair;
          }
        }
        
        // Scan for potential private keys within the file text
        const hexKeyPattern = /[0-9a-f]{128}/gi;
        const matches = content.match(hexKeyPattern);
        if (matches && matches.length > 0) {
          console.log(`Found ${matches.length} potential hex keys in ${file}`);
          
          for (const potentialKey of matches) {
            const keypair = tryCreateKeypair(potentialKey);
            if (keypair && keypair.publicKey.toString() === HX_WALLET_ADDRESS) {
              console.log(`✅ Found HX wallet key in ${file} (embedded hex key)`);
              return keypair;
            }
          }
        }
        
      } catch (error) {
        console.log(`Error reading file ${file}:`, error);
      }
    }
  }
  
  // Search for additional potential key files
  console.log(`\nSearching for additional potential key files...`);
  const additionalFiles = findPotentialKeyFiles();
  console.log(`Found ${additionalFiles.length} additional potential key files`);
  
  for (const file of additionalFiles) {
    if (KEY_FILES.includes(file)) continue; // Skip files we already checked
    
    console.log(`Checking file: ${file}`);
    try {
      const content = fs.readFileSync(file, 'utf8');
      
      // Try parsing as JSON
      try {
        const data = JSON.parse(content);
        
        // Check formats (same as above)
        if (Array.isArray(data) && data.length === 64) {
          const keypair = Keypair.fromSecretKey(new Uint8Array(data));
          if (keypair.publicKey.toString() === HX_WALLET_ADDRESS) {
            console.log(`✅ Found HX wallet key in ${file} (Uint8Array format)`);
            return keypair;
          }
        }
        
        if (Array.isArray(data)) {
          for (const item of data) {
            if (
              (item.publicKey === HX_WALLET_ADDRESS || item.address === HX_WALLET_ADDRESS) && 
              (item.privateKey || item.secretKey)
            ) {
              console.log(`✅ Found HX wallet key in ${file} (wallet object in array)`);
              const privateKey = item.privateKey || item.secretKey;
              const keypair = tryCreateKeypair(privateKey);
              if (keypair && keypair.publicKey.toString() === HX_WALLET_ADDRESS) {
                return keypair;
              }
            }
          }
        }
        
        if (data.wallets) {
          if (Array.isArray(data.wallets)) {
            for (const wallet of data.wallets) {
              if (
                (wallet.publicKey === HX_WALLET_ADDRESS || wallet.address === HX_WALLET_ADDRESS) && 
                (wallet.privateKey || wallet.secretKey)
              ) {
                console.log(`✅ Found HX wallet key in ${file} (wallet object in wallets array)`);
                const privateKey = wallet.privateKey || wallet.secretKey;
                const keypair = tryCreateKeypair(privateKey);
                if (keypair && keypair.publicKey.toString() === HX_WALLET_ADDRESS) {
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
                console.log(`✅ Found HX wallet key in ${file} (wallet in wallets object)`);
                const privateKey = wallet.privateKey || wallet.secretKey;
                const keypair = tryCreateKeypair(privateKey);
                if (keypair && keypair.publicKey.toString() === HX_WALLET_ADDRESS) {
                  return keypair;
                }
              }
            }
          }
        }
        
        if (
          (data.publicKey === HX_WALLET_ADDRESS || data.address === HX_WALLET_ADDRESS) && 
          (data.privateKey || data.secretKey)
        ) {
          console.log(`✅ Found HX wallet key in ${file} (direct wallet object)`);
          const privateKey = data.privateKey || data.secretKey;
          const keypair = tryCreateKeypair(privateKey);
          if (keypair && keypair.publicKey.toString() === HX_WALLET_ADDRESS) {
            return keypair;
          }
        }
        
      } catch (e) {
        // Not JSON, check if content is a private key itself
        const keypair = tryCreateKeypair(content.trim());
        if (keypair && keypair.publicKey.toString() === HX_WALLET_ADDRESS) {
          console.log(`✅ Found HX wallet key in ${file} (raw key)`);
          return keypair;
        }
      }
      
      // Scan for potential private keys within the file text
      const hexKeyPattern = /[0-9a-f]{128}/gi;
      const matches = content.match(hexKeyPattern);
      if (matches && matches.length > 0) {
        console.log(`Found ${matches.length} potential hex keys in ${file}`);
        
        for (const potentialKey of matches) {
          const keypair = tryCreateKeypair(potentialKey);
          if (keypair && keypair.publicKey.toString() === HX_WALLET_ADDRESS) {
            console.log(`✅ Found HX wallet key in ${file} (embedded hex key)`);
            return keypair;
          }
        }
      }
      
    } catch (error) {
      console.log(`Error reading file ${file}:`, error);
    }
  }
  
  console.log('\n❌ Could not find HX wallet private key in any files.');
  return null;
}

// Check wallet balance and status
async function checkWalletBalance(address: string): Promise<number> {
  try {
    console.log(`\nChecking balance for wallet: ${address}`);
    const connection = new Connection(RPC_URL, 'confirmed');
    const publicKey = new PublicKey(address);
    const balance = await connection.getBalance(publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    console.log(`Balance: ${solBalance} SOL`);
    return solBalance;
  } catch (error) {
    console.error('Error checking wallet balance:', error);
    return 0;
  }
}

// Transfer funds from HX wallet to target wallet
async function transferFunds(keypair: Keypair, targetAddress: string, amountSol: number): Promise<string> {
  console.log(`\n=== TRANSFERRING FUNDS ===`);
  console.log(`From: ${keypair.publicKey.toString()}`);
  console.log(`To: ${targetAddress}`);
  console.log(`Amount: ${amountSol} SOL`);
  
  try {
    const connection = new Connection(RPC_URL, 'confirmed');
    const targetPublicKey = new PublicKey(targetAddress);
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash('finalized');
    
    // Create transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: targetPublicKey,
        lamports: Math.floor(amountSol * LAMPORTS_PER_SOL) - 5000 // Leave 5000 lamports for fee
      })
    );
    
    // Set recent blockhash and fee payer
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = keypair.publicKey;
    
    // Sign transaction
    transaction.sign(keypair);
    
    // Send transaction
    const signature = await connection.sendRawTransaction(transaction.serialize());
    console.log(`Transaction sent with signature: ${signature}`);
    
    // Confirm transaction
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    console.log(`Transaction confirmed: ${confirmation.value.err ? 'Failed' : 'Success'}`);
    
    return signature;
  } catch (error) {
    console.error('Error transferring funds:', error);
    throw error;
  }
}

// Main function
async function main() {
  console.log('\n=== HX WALLET RECOVERY TOOL ===');
  
  // Check HX wallet balance
  const hxBalance = await checkWalletBalance(HX_WALLET_ADDRESS);
  
  if (hxBalance <= 0) {
    console.log('⚠️ HX wallet has no balance. Exiting.');
    return;
  }
  
  // Check target wallet balance before
  const targetBalanceBefore = await checkWalletBalance(TARGET_WALLET_ADDRESS);
  
  // Find HX wallet private key
  const hxKeypair = await findHXWalletKey();
  
  if (!hxKeypair) {
    console.log('❌ Could not recover HX wallet private key. Exiting.');
    return;
  }
  
  // Verify the keypair matches the expected address
  if (hxKeypair.publicKey.toString() !== HX_WALLET_ADDRESS) {
    console.log(`❌ Keypair public key (${hxKeypair.publicKey.toString()}) doesn't match expected HX wallet address.`);
    return;
  }
  
  // Transfer funds (leave a small amount for fees)
  const transferAmount = hxBalance - 0.01;
  if (transferAmount <= 0) {
    console.log('⚠️ Not enough balance to transfer.');
    return;
  }
  
  try {
    const signature = await transferFunds(hxKeypair, TARGET_WALLET_ADDRESS, transferAmount);
    console.log(`\n✅ Transferred ${transferAmount} SOL to ${TARGET_WALLET_ADDRESS}`);
    console.log(`Transaction signature: ${signature}`);
    
    // Check target wallet balance after
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for confirmation
    const targetBalanceAfter = await checkWalletBalance(TARGET_WALLET_ADDRESS);
    console.log(`\nTarget wallet balance increased by ${(targetBalanceAfter - targetBalanceBefore).toFixed(6)} SOL`);
    
    console.log('\n=== RECOVERY COMPLETE ===');
  } catch (error) {
    console.error('\n❌ Error during fund transfer:', error);
  }
}

// Run the main function
main()
  .catch(console.error);