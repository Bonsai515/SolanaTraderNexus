/**
 * HX to Phantom Wallet Transfer with Key Formatting
 * 
 * This script attempts different formats of the private key
 * to properly transfer funds from HX wallet to Phantom wallet.
 */

import * as fs from 'fs';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';

// Configuration
const LOG_PATH = './hx-transfer-formatted.log';
const HX_WALLET = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
const PHANTOM_WALLET = '2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH';
const RPC_URL = 'https://api.mainnet-beta.solana.com';

// HX PRIVATE KEY (provided by user - may need formatting)
const ORIGINAL_KEY = "0b42ea00c0322d804745ec6c7bff1d6337eb1eefbc8e5d45d65e51bdcff596aeec7b957f34d2d910dd3da11f6d6";

// Initialize log
if (!fs.existsSync(LOG_PATH)) {
  fs.writeFileSync(LOG_PATH, '--- HX TO PHANTOM TRANSFER LOG (FORMATTED) ---\n');
}

// Log function
function log(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_PATH, logMessage + '\n');
}

// Connect to Solana
function connectToSolana(): Connection {
  try {
    log('Connecting to Solana via public RPC...');
    return new Connection(RPC_URL, 'confirmed');
  } catch (error) {
    log(`Failed to connect to RPC: ${(error as Error).message}`);
    throw error;
  }
}

// Check wallet balance
async function checkWalletBalance(connection: Connection, walletAddress: string): Promise<number> {
  try {
    const publicKey = new PublicKey(walletAddress);
    const balance = await connection.getBalance(publicKey);
    const balanceSOL = balance / LAMPORTS_PER_SOL;
    
    log(`${walletAddress} balance: ${balanceSOL.toFixed(6)} SOL`);
    return balance;
  } catch (error) {
    log(`Error checking wallet balance: ${(error as Error).message}`);
    return 0;
  }
}

// Try different key formats
function tryDifferentKeyFormats(): Keypair[] {
  const keypairs: Keypair[] = [];
  
  try {
    // 1. Try original key
    log('Trying original key format...');
    try {
      const key1 = Buffer.from(ORIGINAL_KEY, 'hex');
      if (key1.length === 64) {
        keypairs.push(Keypair.fromSecretKey(key1));
        log('Original key is valid length (64 bytes)');
      } else {
        log(`Original key has wrong length: ${key1.length} bytes (expected 64)`);
      }
    } catch (error) {
      log(`Error with original key: ${(error as Error).message}`);
    }
    
    // 2. Try padding the key if it's too short
    log('Trying padded key format...');
    try {
      const key2 = Buffer.from(ORIGINAL_KEY.padEnd(128, '0'), 'hex');
      if (key2.length === 64) {
        keypairs.push(Keypair.fromSecretKey(key2));
        log('Padded key is valid length (64 bytes)');
      } else {
        log(`Padded key has wrong length: ${key2.length} bytes (expected 64)`);
      }
    } catch (error) {
      log(`Error with padded key: ${(error as Error).message}`);
    }
    
    // 3. Try truncating the key if it's too long
    log('Trying truncated key format...');
    try {
      const key3 = Buffer.from(ORIGINAL_KEY.substring(0, 128), 'hex');
      if (key3.length === 64) {
        keypairs.push(Keypair.fromSecretKey(key3));
        log('Truncated key is valid length (64 bytes)');
      } else {
        log(`Truncated key has wrong length: ${key3.length} bytes (expected 64)`);
      }
    } catch (error) {
      log(`Error with truncated key: ${(error as Error).message}`);
    }
    
    // 4. Try with 0x prefix
    log('Trying key with 0x prefix...');
    try {
      const key4 = Buffer.from("0x" + ORIGINAL_KEY, 'hex');
      if (key4.length === 64) {
        keypairs.push(Keypair.fromSecretKey(key4));
        log('Key with 0x prefix is valid length (64 bytes)');
      } else {
        log(`Key with 0x prefix has wrong length: ${key4.length} bytes (expected 64)`);
      }
    } catch (error) {
      log(`Error with 0x prefix key: ${(error as Error).message}`);
    }
    
    // 5. Try separating bytes with commas
    log('Trying key with comma separated bytes...');
    try {
      // Convert hex to byte array
      const byteArray: number[] = [];
      for (let i = 0; i < ORIGINAL_KEY.length; i += 2) {
        const byteValue = parseInt(ORIGINAL_KEY.substring(i, i + 2), 16);
        if (!isNaN(byteValue)) {
          byteArray.push(byteValue);
        }
      }
      
      // If we got 64 bytes, try to use them
      if (byteArray.length === 64) {
        keypairs.push(Keypair.fromSecretKey(new Uint8Array(byteArray)));
        log('Comma separated key is valid length (64 bytes)');
      } else {
        // Try padding to 64 bytes
        while (byteArray.length < 64) {
          byteArray.push(0);
        }
        // Or truncate to 64 bytes
        const truncatedByteArray = byteArray.slice(0, 64);
        keypairs.push(Keypair.fromSecretKey(new Uint8Array(truncatedByteArray)));
        log(`Adjusted comma separated key to 64 bytes (original was ${byteArray.length} bytes)`);
      }
    } catch (error) {
      log(`Error with comma separated key: ${(error as Error).message}`);
    }
    
    // 6. Try with base58 encoding
    log('Trying base58 encoded key...');
    try {
      const bs58 = require('bs58');
      const key6 = bs58.decode(ORIGINAL_KEY);
      keypairs.push(Keypair.fromSecretKey(key6));
      log('Base58 key processed');
    } catch (error) {
      log(`Error with base58 key: ${(error as Error).message}`);
    }
    
    // Log results
    log(`Generated ${keypairs.length} potential keypairs to try`);
    for (let i = 0; i < keypairs.length; i++) {
      log(`Keypair ${i+1} address: ${keypairs[i].publicKey.toString()}`);
    }
    
    return keypairs;
  } catch (error) {
    log(`Error trying key formats: ${(error as Error).message}`);
    return [];
  }
}

// Transfer all SOL from HX to Phantom
async function transferAllFunds(
  connection: Connection,
  fromKeypair: Keypair,
  toAddress: string
): Promise<string | null> {
  try {
    const fromAddress = fromKeypair.publicKey.toString();
    log(`Attempting transfer from ${fromAddress}`);
    
    // Check if this keypair matches our expected HX wallet
    const isHXWallet = fromAddress === HX_WALLET;
    if (isHXWallet) {
      log(`✅ MATCH FOUND! The keypair matches the HX wallet address.`);
    } else {
      log(`This keypair does not match the HX wallet address.`);
    }
    
    // Get current balance
    const fromBalance = await connection.getBalance(fromKeypair.publicKey);
    
    if (fromBalance <= 0) {
      log(`No balance to transfer from ${fromAddress}`);
      return null;
    }
    
    log(`Found balance: ${fromBalance / LAMPORTS_PER_SOL} SOL`);
    
    // Calculate amount to transfer (leave some for fees)
    const fee = 5000; // 0.000005 SOL for fees
    const transferAmount = fromBalance - fee;
    
    if (transferAmount <= 0) {
      log(`Balance too low to transfer after fees`);
      return null;
    }
    
    log(`Transferring ${transferAmount / LAMPORTS_PER_SOL} SOL to ${toAddress}`);
    
    // Create transfer transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: new PublicKey(toAddress),
        lamports: transferAmount
      })
    );
    
    // Set recent blockhash and sign transaction
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = fromKeypair.publicKey;
    
    // Send and confirm transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [fromKeypair]
    );
    
    log(`✅ Transfer successful! Transaction signature: ${signature}`);
    log(`Solscan Link: https://solscan.io/tx/${signature}`);
    
    return signature;
  } catch (error) {
    log(`❌ Transfer failed: ${(error as Error).message}`);
    return null;
  }
}

// Verify the transfer
async function verifyTransfer(connection: Connection): Promise<boolean> {
  try {
    // Check balance after transfer
    const hxBalance = await checkWalletBalance(connection, HX_WALLET);
    const phantomBalance = await checkWalletBalance(connection, PHANTOM_WALLET);
    
    log(`After transfer: HX wallet has ${hxBalance / LAMPORTS_PER_SOL} SOL`);
    log(`After transfer: Phantom wallet has ${phantomBalance / LAMPORTS_PER_SOL} SOL`);
    
    return hxBalance < 10000; // Less than 0.00001 SOL remaining (successful transfer)
  } catch (error) {
    log(`Error verifying transfer: ${(error as Error).message}`);
    return false;
  }
}

// Main function
async function main() {
  try {
    log('Starting HX wallet transfer with key format checking...');
    
    // Connect to Solana
    const connection = connectToSolana();
    
    // Check initial balances
    const initialHxBalance = await checkWalletBalance(connection, HX_WALLET);
    const initialPhantomBalance = await checkWalletBalance(connection, PHANTOM_WALLET);
    
    log(`Initial HX wallet balance: ${initialHxBalance / LAMPORTS_PER_SOL} SOL`);
    log(`Initial Phantom wallet balance: ${initialPhantomBalance / LAMPORTS_PER_SOL} SOL`);
    
    // Try different key formats
    const keypairs = tryDifferentKeyFormats();
    
    if (keypairs.length === 0) {
      log('No valid keypairs could be generated. Cannot proceed with transfer.');
      return;
    }
    
    // Try each keypair until one works
    let transferSuccess = false;
    for (let i = 0; i < keypairs.length; i++) {
      const keypair = keypairs[i];
      log(`\nAttempting transfer with keypair ${i+1}...`);
      const signature = await transferAllFunds(connection, keypair, PHANTOM_WALLET);
      
      if (signature) {
        transferSuccess = true;
        
        // Wait a bit for the transaction to finalize
        log('Waiting 5 seconds for transaction to finalize...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Verify transfer
        const transferVerified = await verifyTransfer(connection);
        
        if (transferVerified) {
          log('✅ Transfer verification complete. Funds transferred successfully!');
          
          // Calculate the expected final balance
          const expectedFinalBalance = (initialHxBalance + initialPhantomBalance - 5000) / LAMPORTS_PER_SOL;
          log(`Expected final Phantom wallet balance: ~${expectedFinalBalance.toFixed(6)} SOL`);
          
          console.log('\n===== TRANSFER COMPLETED SUCCESSFULLY =====');
          console.log(`💰 Funds transferred successfully to Phantom wallet!`);
          console.log(`📝 Transaction: https://solscan.io/tx/${signature}`);
          console.log(`💼 Phantom wallet now has approximately ${expectedFinalBalance.toFixed(6)} SOL`);
          console.log('\nYour trading system is now ready to use with the enhanced capital!');
          break;
        } else {
          log('❌ Transfer verification failed. Please check wallet balances manually.');
        }
      } else {
        log(`Transfer with keypair ${i+1} failed. Trying next keypair...`);
      }
    }
    
    if (!transferSuccess) {
      log('❌ All transfer attempts failed. Could not access the HX wallet with the provided key.');
      log('Please check that the key is correct and try again, or work with the current Phantom wallet balance.');
    }
  } catch (error) {
    log(`Fatal error: ${(error as Error).message}`);
  }
}

// Run the main function
if (require.main === module) {
  main().catch(error => {
    log(`Unhandled error: ${error.message}`);
  });
}