/**
 * Direct Wallet Transfer Utility
 * 
 * This script transfers all funds from the found wallet
 * to your Phantom wallet for trading through Nexus.
 */

import * as fs from 'fs';
import * as path from 'path';
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
const LOG_PATH = './direct-wallet-transfer.log';
const PHANTOM_WALLET = '2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH';
const RPC_URL = 'https://empty-hidden-spring.solana-mainnet.quiknode.pro/ea24f1bb95ea3b2dc4cddbe74a4bce8e10eaa88e/';
const BACKUP_RPC_URL = 'https://api.mainnet-beta.solana.com';

// The complete private key you provided
const PRIVATE_KEY_HEX = "793dec9a669ff717266b2544c44bb3990e226f2c21c620b733b53c1f3670f8a231f2be3d80903e77c93700b141f9f163e8dd0ba58c152cbc9ba047bfa245499f";

// Alternative key format from your latest message
const ALTERNATIVE_KEY = [
  121, 61, 236, 154, 102, 159, 247, 23, 38,
  107, 37, 68, 196, 75, 179, 153,
  14, 34, 111, 44, 33, 198, 32, 183, 51,
  181, 60, 31, 54, 112, 248, 162,
  49, 242, 190, 61, 128, 144, 62, 119, 201,
  55, 0, 177, 65, 249, 241, 99,
  232, 221, 11, 165, 140, 21, 44, 188, 155,
  160, 71, 191, 162, 69, 73, 159
];

// Initialize log
if (!fs.existsSync(LOG_PATH)) {
  fs.writeFileSync(LOG_PATH, '--- DIRECT WALLET TRANSFER LOG ---\n');
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
    log('Connecting to Solana via premium QuickNode RPC...');
    return new Connection(RPC_URL, 'confirmed');
  } catch (error) {
    log(`Failed to connect to premium RPC: ${(error as Error).message}`);
    log('Falling back to public RPC...');
    return new Connection(BACKUP_RPC_URL, 'confirmed');
  }
}

// Create keypair from private key
function createKeypairFromPrivateKey(): Keypair {
  try {
    // First try the array format
    log('Trying to create keypair from integer array...');
    const keypairFromArray = Keypair.fromSecretKey(new Uint8Array(ALTERNATIVE_KEY));
    log(`Generated wallet address from array: ${keypairFromArray.publicKey.toString()}`);
    
    // Return the keypair created from the array
    return keypairFromArray;
  } catch (arrayError) {
    log(`Error creating keypair from array: ${(arrayError as Error).message}`);
    
    // Fall back to hex string if array fails
    try {
      log('Falling back to hex string format...');
      const privateKeyBuffer = Buffer.from(PRIVATE_KEY_HEX, 'hex');
      const secretKey = new Uint8Array(privateKeyBuffer);
      
      // Create the keypair from the secret key
      const keypair = Keypair.fromSecretKey(secretKey);
      
      // Display the wallet address
      log(`Generated wallet address from hex: ${keypair.publicKey.toString()}`);
      return keypair;
    } catch (hexError) {
      log(`Error creating keypair from hex: ${(hexError as Error).message}`);
      throw hexError;
    }
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

// Transfer all SOL from source to Phantom
async function transferAllFunds(
  connection: Connection,
  fromKeypair: Keypair,
  toAddress: string
): Promise<string | null> {
  try {
    // Get current balance
    const fromBalance = await connection.getBalance(fromKeypair.publicKey);
    
    if (fromBalance <= 0) {
      log(`No balance to transfer from ${fromKeypair.publicKey.toString()}`);
      return null;
    }
    
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
async function verifyTransfer(connection: Connection, sourceWalletAddress: string): Promise<boolean> {
  try {
    // Check balance after transfer
    const sourceBalance = await checkWalletBalance(connection, sourceWalletAddress);
    const phantomBalance = await checkWalletBalance(connection, PHANTOM_WALLET);
    
    log(`After transfer: Source wallet has ${sourceBalance / LAMPORTS_PER_SOL} SOL`);
    log(`After transfer: Phantom wallet has ${phantomBalance / LAMPORTS_PER_SOL} SOL`);
    
    return sourceBalance < 10000; // Less than 0.00001 SOL remaining (successful transfer)
  } catch (error) {
    log(`Error verifying transfer: ${(error as Error).message}`);
    return false;
  }
}

// Main function
async function main() {
  try {
    log('Starting direct wallet transfer to Phantom wallet...');
    
    // Connect to Solana
    const connection = connectToSolana();
    
    // Create keypair from private key
    const keypair = createKeypairFromPrivateKey();
    const sourceWalletAddress = keypair.publicKey.toString();
    
    // Check initial balances
    const initialSourceBalance = await checkWalletBalance(connection, sourceWalletAddress);
    const initialPhantomBalance = await checkWalletBalance(connection, PHANTOM_WALLET);
    
    log(`Initial source wallet balance: ${initialSourceBalance / LAMPORTS_PER_SOL} SOL`);
    log(`Initial Phantom wallet balance: ${initialPhantomBalance / LAMPORTS_PER_SOL} SOL`);
    
    // Transfer funds
    const signature = await transferAllFunds(connection, keypair, PHANTOM_WALLET);
    
    if (signature) {
      // Verify transfer
      const transferVerified = await verifyTransfer(connection, sourceWalletAddress);
      
      if (transferVerified) {
        log('✅ Transfer verification complete. All funds transferred successfully!');
        
        // Calculate the expected final balance
        const expectedFinalBalance = (initialSourceBalance + initialPhantomBalance - 5000) / LAMPORTS_PER_SOL;
        log(`Expected final Phantom wallet balance: ~${expectedFinalBalance.toFixed(6)} SOL`);
        
        console.log('\n===== TRANSFER COMPLETED SUCCESSFULLY =====');
        console.log(`💰 All funds transferred from ${sourceWalletAddress} to Phantom wallet!`);
        console.log(`📝 Transaction: https://solscan.io/tx/${signature}`);
        console.log(`💼 Phantom wallet now has approximately ${expectedFinalBalance.toFixed(6)} SOL`);
        console.log('\nYour trading system is now ready to use with the enhanced capital!');
      } else {
        log('❌ Transfer verification failed. Please check wallet balances manually.');
      }
    } else {
      log('❌ Transfer failed. No transaction signature returned.');
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