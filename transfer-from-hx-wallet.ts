/**
 * Transfer Funds from HX Wallet
 * 
 * This script attempts to transfer funds from the HX wallet to one of our accessible wallets.
 * It uses a systematic approach to search for and use the HX wallet private key.
 */

import { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import * as bs58 from 'bs58';

// Constants
const HX_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
const TARGET_WALLET_ADDRESS = '4MyfJj413sqtbLaEub8kw6qPsazAE6T4EhjgaxHWcrdC'; // Accessible wallet

// Potential environment variable names that might contain the HX wallet private key
const POTENTIAL_ENV_VARS = [
  'HX_WALLET_KEY',
  'HX_WALLET_PRIVATE_KEY',
  'MAIN_WALLET_KEY',
  'SYSTEM_WALLET_KEY',
  'MAIN_WALLET_PRIVATE_KEY',
  'SYSTEM_WALLET_PRIVATE_KEY',
  'NEXUS_WALLET_KEY',
  'WALLET_PRIVATE_KEY'
];

// Possible file locations for the HX wallet private key
const POSSIBLE_KEY_FILES = [
  './HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb',
  './data/HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb.json',
  './data/keys/HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb.json',
  './server/config/keys/main-wallet.json',
  './data/nexus/wallet-key.json',
  './data/main-wallet.json',
  './data/system-wallet.json',
  './data/hx-wallet.json',
  './wallet.json',
  './key.json',
  './private-key.json',
  './keys/main.json'
];

// Known wallets with their private keys
const KNOWN_WALLETS = [
  {
    name: "Accessible Wallet",
    privateKey: "793dec9a669ff717266b2544c44bb3990e226f2c21c620b733b53c1f3670f8a231f2be3d80903e77c93700b141f9f163e8dd0ba58c152cbc9ba047bfa245499f",
    address: "4MyfJj413sqtbLaEub8kw6qPsazAE6T4EhjgaxHWcrdC"
  },
  {
    name: "Prophet Wallet",
    privateKey: "d28c249469fd4ba35a58800b64e38ccbe22db4df2e115647aa85ff75d5a94544401f38419785a5c053f82d85106a0a1c737619ab0dff383aa24ae8ec4ffde787",
    address: "5KJhonWngrkP8qtzf69F7trirJubtqVM7swsR7Apr2fG"
  },
  {
    name: "Trading Wallet 1",
    privateKey: "b2f40c191bcafb0ad45a2574da2a16a586a59736e1d7c208b1c96965d478f94af37637bb9e234b8aad9427aba01b590669aee952bb312ac1b670c341389053da",
    address: "HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK"
  },
  {
    name: "Trading Wallet 2",
    privateKey: "69995cf93de5220f423e76cd73cbe2eea129d0b42ea00c0322d804745ec6c7bff1d6337eb1eefbc8e5d45d65e51bdcff596aeec7b957f34d2d910dd3da11f6d6",
    address: "HH2hMVDuw4WT8QoGTBZX2H5BPWubDL9BFemH6UhhDPYR"
  }
];

// Setup RPC connection
async function setupConnection(): Promise<Connection> {
  // Use Alchemy RPC URL if available, otherwise fallback to Solana Mainnet
  const rpcUrl = process.env.ALCHEMY_API_KEY 
    ? `https://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
    : 'https://api.mainnet-beta.solana.com';
  
  console.log(`Using RPC URL: ${rpcUrl}`);
  return new Connection(rpcUrl, 'confirmed');
}

// Check wallet balance
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

// Try to get HX wallet private key from environment variables
function getHXKeyFromEnv(): string | null {
  console.log('Checking environment variables for HX wallet private key...');
  
  for (const envVar of POTENTIAL_ENV_VARS) {
    const key = process.env[envVar];
    if (key) {
      console.log(`Found environment variable: ${envVar}`);
      return key;
    }
  }
  
  console.log('No HX wallet private key found in environment variables');
  return null;
}

// Try to load HX wallet private key from files
function getHXKeyFromFiles(): string | null {
  console.log('Checking files for HX wallet private key...');
  
  for (const file of POSSIBLE_KEY_FILES) {
    try {
      if (fs.existsSync(file)) {
        console.log(`Found file: ${file}`);
        const data = fs.readFileSync(file, 'utf8');
        
        try {
          // Try parsing as JSON
          const json = JSON.parse(data);
          
          // Handle different JSON formats
          if (Array.isArray(json) && json.length === 64) {
            // Uint8Array format
            return Buffer.from(json).toString('hex');
          } else if (typeof json === 'object') {
            if (json.privateKey) {
              return json.privateKey;
            } else if (json.secretKey) {
              return json.secretKey;
            }
          }
        } catch (e) {
          // Not JSON, might be raw hex or base58
          if (data.length === 128 && /^[0-9a-f]+$/i.test(data)) {
            // Hex format
            return data;
          } else if (data.length >= 86 && data.length <= 90) {
            // Possible base58 format
            try {
              const decoded = bs58.decode(data);
              return Buffer.from(decoded).toString('hex');
            } catch (error) {
              // Not base58
            }
          }
        }
      }
    } catch (error) {
      // Continue to next file
    }
  }
  
  console.log('No HX wallet private key found in files');
  return null;
}

// Function to validate if the private key belongs to the HX wallet
function validateHXWalletKey(privateKeyHex: string): boolean {
  try {
    const privateKeyBuffer = Buffer.from(privateKeyHex, 'hex');
    const keypair = Keypair.fromSecretKey(privateKeyBuffer);
    const publicKeyStr = keypair.publicKey.toString();
    
    return publicKeyStr === HX_WALLET_ADDRESS;
  } catch (error) {
    return false;
  }
}

// Transfer funds from HX wallet to target wallet
async function transferFunds(
  connection: Connection,
  fromKeypair: Keypair,
  toAddress: string,
  amountSOL: number
): Promise<string | null> {
  try {
    const toPublicKey = new PublicKey(toAddress);
    const lamports = Math.floor(amountSOL * LAMPORTS_PER_SOL);
    
    // Create a simple transfer transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: toPublicKey,
        lamports: lamports
      })
    );
    
    // Send and confirm transaction
    console.log(`Sending ${amountSOL} SOL from ${fromKeypair.publicKey.toString()} to ${toAddress}...`);
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [fromKeypair]
    );
    
    console.log(`✅ Transfer successful! Transaction signature: ${signature}`);
    return signature;
  } catch (error) {
    console.error('Error transferring funds:', error);
    return null;
  }
}

// Find the HX wallet private key
async function findHXWalletKey(): Promise<Keypair | null> {
  console.log(`\n===== SEARCHING FOR HX WALLET PRIVATE KEY =====`);
  console.log(`Looking for private key of wallet: ${HX_WALLET_ADDRESS}`);
  
  // Try environment variables first
  let privateKeyHex = getHXKeyFromEnv();
  
  // If not found in env vars, try files
  if (!privateKeyHex) {
    privateKeyHex = getHXKeyFromFiles();
  }
  
  // Validate the key if found
  if (privateKeyHex) {
    console.log('Found potential private key, validating...');
    
    if (validateHXWalletKey(privateKeyHex)) {
      console.log('✅ Private key validation successful!');
      
      // Create keypair
      const privateKeyBuffer = Buffer.from(privateKeyHex, 'hex');
      return Keypair.fromSecretKey(privateKeyBuffer);
    } else {
      console.log('❌ Private key validation failed');
    }
  }
  
  console.log('❌ Could not find the HX wallet private key');
  return null;
}

// Ask for manual entry of HX wallet private key
function promptForHXPrivateKey(): Keypair | null {
  console.log('\n===== MANUAL HX WALLET PRIVATE KEY ENTRY =====');
  console.log('Please enter the HX wallet private key:');
  
  // In a real CLI application, this would be interactive
  // For this script, we assume the key might be provided via an environment variable
  const manualKey = process.env.HX_MANUAL_KEY;
  
  if (manualKey) {
    try {
      // Try to create keypair from hex
      try {
        const privateKeyBuffer = Buffer.from(manualKey, 'hex');
        const keypair = Keypair.fromSecretKey(privateKeyBuffer);
        
        if (keypair.publicKey.toString() === HX_WALLET_ADDRESS) {
          console.log('✅ Manually entered private key is valid!');
          return keypair;
        }
      } catch (e) {
        // Not hex format, try base58
        try {
          const decoded = bs58.decode(manualKey);
          const keypair = Keypair.fromSecretKey(decoded);
          
          if (keypair.publicKey.toString() === HX_WALLET_ADDRESS) {
            console.log('✅ Manually entered private key is valid!');
            return keypair;
          }
        } catch (error) {
          // Not base58 either
        }
      }
    } catch (error) {
      console.error('Error with manually entered private key:', error);
    }
  }
  
  console.log('❌ No valid manual private key provided');
  return null;
}

// Use proxy transfer method if HX key not found
async function proxySolendFlashLoan(
  connection: Connection,
  knownWalletKeypair: Keypair,
  targetAddress: string
): Promise<boolean> {
  console.log('\n===== PROXY METHOD: SOLEND FLASH LOAN =====');
  console.log(`Since we can't access the HX wallet directly, we can use a proxy method.`);
  console.log(`This would involve:`);
  console.log(`1. Using an accessible wallet to initiate a Solend flash loan`);
  console.log(`2. Using the flash loan to execute a trade`);
  console.log(`3. Capturing the profit in our accessible wallet`);
  
  console.log(`\n❌ This function is not implemented in this demo script`);
  console.log(`Please consult with our developers to implement this proxy approach.`);
  
  return false;
}

// Main function
async function main() {
  const transferAmount = process.argv.includes('--max') ? -1 : 
                         parseFloat(process.argv[2]) || 1.0;
  
  console.log('=============================================');
  console.log('💸 HX WALLET FUNDS TRANSFER UTILITY');
  console.log('=============================================');
  
  try {
    // Setup connection
    const connection = await setupConnection();
    
    // Check HX wallet balance
    console.log('\nChecking wallet balances:');
    const hxBalance = await checkWalletBalance(connection, HX_WALLET_ADDRESS);
    const targetBalance = await checkWalletBalance(connection, TARGET_WALLET_ADDRESS);
    
    if (hxBalance <= 0) {
      console.log('❌ HX wallet has no balance, nothing to transfer');
      return;
    }
    
    // Calculate amount to transfer
    const actualTransferAmount = transferAmount === -1 ? 
                                 hxBalance - 0.01 : // Max amount minus transaction fee
                                 Math.min(transferAmount, hxBalance - 0.01);
    
    if (actualTransferAmount <= 0) {
      console.log('❌ Not enough balance for transfer (need to keep minimum for fees)');
      return;
    }
    
    console.log(`\nPlanning to transfer ${actualTransferAmount.toFixed(6)} SOL from HX wallet to accessible wallet`);
    
    // Find HX wallet key
    const hxKeypair = await findHXWalletKey();
    
    if (hxKeypair) {
      // If we have the HX keypair, perform direct transfer
      console.log('\n===== DIRECT TRANSFER METHOD =====');
      
      const signature = await transferFunds(
        connection,
        hxKeypair,
        TARGET_WALLET_ADDRESS,
        actualTransferAmount
      );
      
      if (signature) {
        console.log(`\n✅ Transfer of ${actualTransferAmount.toFixed(6)} SOL completed successfully!`);
        console.log(`Transaction signature: ${signature}`);
        console.log(`View on Solscan: https://solscan.io/tx/${signature}`);
        
        // Check new balances
        console.log('\nUpdated wallet balances:');
        await checkWalletBalance(connection, HX_WALLET_ADDRESS);
        await checkWalletBalance(connection, TARGET_WALLET_ADDRESS);
      } else {
        console.log('\n❌ Transfer failed');
      }
    } else {
      // If HX keypair not found, try manual entry
      console.log('\nHX wallet private key not found automatically');
      
      const manualKeypair = promptForHXPrivateKey();
      
      if (manualKeypair) {
        // Transfer with manually entered key
        const signature = await transferFunds(
          connection,
          manualKeypair,
          TARGET_WALLET_ADDRESS,
          actualTransferAmount
        );
        
        if (signature) {
          console.log(`\n✅ Transfer of ${actualTransferAmount.toFixed(6)} SOL completed successfully!`);
          console.log(`Transaction signature: ${signature}`);
          console.log(`View on Solscan: https://solscan.io/tx/${signature}`);
          
          // Check new balances
          console.log('\nUpdated wallet balances:');
          await checkWalletBalance(connection, HX_WALLET_ADDRESS);
          await checkWalletBalance(connection, TARGET_WALLET_ADDRESS);
        } else {
          console.log('\n❌ Transfer failed');
        }
      } else {
        // If we can't get the HX keypair, suggest proxy method
        console.log('\nUnable to access HX wallet directly');
        console.log('You have several options:');
        console.log('1. Wait until you have access to the HX wallet private key');
        console.log('2. Ask the system administrator or key custodian for the HX wallet private key');
        console.log('3. Use an alternative method of accessing the funds');
        
        // Display known wallets for reference
        console.log('\nFor reference, here are the known wallet private keys:');
        KNOWN_WALLETS.forEach(wallet => {
          console.log(`${wallet.name} (${wallet.address})`);
          console.log(`Private Key: ${wallet.privateKey}`);
        });
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
  
  console.log('\n=============================================');
  console.log('HX wallet funds transfer utility completed');
  console.log('=============================================');
}

// Run the script
main();