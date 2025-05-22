/**
 * Direct HX to Phantom Wallet Transfer
 * 
 * This script directly transfers all SOL from the HX wallet
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
const LOG_PATH = './direct-hx-transfer.log';
const HX_WALLET = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
const PHANTOM_WALLET = '2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH';
const RPC_URL = 'https://empty-hidden-spring.solana-mainnet.quiknode.pro/ea24f1bb95ea3b2dc4cddbe74a4bce8e10eaa88e/';
const BACKUP_RPC_URL = 'https://api.mainnet-beta.solana.com';

// HX PRIVATE KEY - This appears to be the filename itself, as a hex string
const HX_PRIVATE_KEY_HEX = "793dec9a669ff717266b2544c44bb3990e226f2c21c620b733b53c1f3670f8a231f2be3d80903e77c93700b141f9f163e8dd0ba58c152cbc9ba047bfa245499f";

// Initialize log
if (!fs.existsSync(LOG_PATH)) {
  fs.writeFileSync(LOG_PATH, '--- DIRECT HX TO PHANTOM TRANSFER LOG ---\n');
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
    // Convert hex string to Uint8Array
    const privateKeyBuffer = Buffer.from(HX_PRIVATE_KEY_HEX, 'hex');
    const secretKey = new Uint8Array(privateKeyBuffer);
    
    // Create the keypair from the secret key
    const keypair = Keypair.fromSecretKey(secretKey);
    
    // Verify the keypair matches the expected public key
    if (keypair.publicKey.toString() !== HX_WALLET) {
      throw new Error(`Keypair public key (${keypair.publicKey.toString()}) doesn't match expected HX wallet (${HX_WALLET})`);
    }
    
    log(`Successfully created keypair for HX wallet`);
    return keypair;
  } catch (error) {
    log(`Error creating keypair: ${(error as Error).message}`);
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

// Transfer all SOL from HX to Phantom
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
    log('Starting direct transfer from HX wallet to Phantom wallet...');
    
    // Connect to Solana
    const connection = connectToSolana();
    
    // Check initial balances
    const initialHxBalance = await checkWalletBalance(connection, HX_WALLET);
    const initialPhantomBalance = await checkWalletBalance(connection, PHANTOM_WALLET);
    
    log(`Initial HX wallet balance: ${initialHxBalance / LAMPORTS_PER_SOL} SOL`);
    log(`Initial Phantom wallet balance: ${initialPhantomBalance / LAMPORTS_PER_SOL} SOL`);
    
    // Create keypair from private key
    const keypair = createKeypairFromPrivateKey();
    
    // Transfer funds
    const signature = await transferAllFunds(connection, keypair, PHANTOM_WALLET);
    
    if (signature) {
      // Verify transfer
      const transferVerified = await verifyTransfer(connection);
      
      if (transferVerified) {
        log('✅ Transfer verification complete. All funds transferred successfully!');
        
        // Calculate the expected final balance
        const expectedFinalBalance = (initialHxBalance + initialPhantomBalance - 5000) / LAMPORTS_PER_SOL;
        log(`Expected final Phantom wallet balance: ~${expectedFinalBalance.toFixed(6)} SOL`);
        
        console.log('\n===== TRANSFER COMPLETED SUCCESSFULLY =====');
        console.log(`💰 All funds transferred from HX wallet to Phantom wallet!`);
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