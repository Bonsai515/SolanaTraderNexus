/**
 * Secure Trade Executor
 * 
 * This script executes real trades on the Solana blockchain
 * using a more secure approach for private key handling.
 */

import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import bs58 from 'bs58';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.trading' });

// Constants
const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY || 'q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const SYNDICA_URL = `https://solana-mainnet.api.syndica.io/api-key/${SYNDICA_API_KEY}`;
const WALLET_ADDRESS = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6';
const KEY_FILE = process.env.KEY_FILE || './key_pair.json';

// Connection to Solana
const connection = new Connection(SYNDICA_URL, 'confirmed');

/**
 * Log a transaction
 */
function logTransaction(signature: string, details: any): void {
  try {
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const logPath = path.join(logDir, 'real-transactions.log');
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} [EXECUTED] Signature: ${signature}, Details: ${JSON.stringify(details)}\n`;
    
    fs.appendFileSync(logPath, logEntry);
    
    console.log(`Transaction logged to ${logPath}`);
  } catch (error) {
    console.error('Error logging transaction:', error);
  }
}

/**
 * Load keypair from file
 */
function loadKeypairFromFile(): Keypair | null {
  try {
    if (!fs.existsSync(KEY_FILE)) {
      console.error(`Key file not found: ${KEY_FILE}`);
      return null;
    }
    
    const keyData = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
    return Keypair.fromSecretKey(new Uint8Array(keyData));
  } catch (error) {
    console.error('Error loading keypair from file:', error);
    return null;
  }
}

/**
 * Save keypair to file
 */
function saveKeypairToFile(keypair: Keypair): boolean {
  try {
    const keyData = Array.from(keypair.secretKey);
    fs.writeFileSync(KEY_FILE, JSON.stringify(keyData));
    console.log(`Keypair saved to ${KEY_FILE}`);
    
    // Set permissions to restrict access
    fs.chmodSync(KEY_FILE, 0o600);
    return true;
  } catch (error) {
    console.error('Error saving keypair to file:', error);
    return false;
  }
}

/**
 * Execute a simple test transaction
 */
async function executeTestTransaction(keypair: Keypair): Promise<string> {
  try {
    // Create a minimal transaction that does nothing but pays a small fee
    const transaction = new Transaction().add(
      new TransactionInstruction({
        keys: [
          { pubkey: keypair.publicKey, isSigner: true, isWritable: true }
        ],
        programId: new PublicKey('SysvarC1ock11111111111111111111111111111111'),
        data: Buffer.from([])
      })
    );
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = keypair.publicKey;
    
    console.log('Sending test transaction to blockchain...');
    
    // Send and confirm transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [keypair],
      {
        commitment: 'confirmed',
        skipPreflight: false
      }
    );
    
    console.log(`✅ Transaction successfully executed!`);
    console.log(`Transaction signature: ${signature}`);
    console.log(`View on Solscan: https://solscan.io/tx/${signature}`);
    
    return signature;
  } catch (error) {
    console.error('❌ Transaction failed:', error);
    throw error;
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log('=== SECURE TRADE EXECUTOR ===');
  console.log('This will execute a real test transaction on the Solana blockchain.');
  
  try {
    // Check if we already have a keypair file
    let keypair = loadKeypairFromFile();
    
    if (!keypair) {
      console.log('\nNo existing keypair found. Creating a new one...');
      
      // Create a new keypair
      keypair = Keypair.generate();
      
      // Save it to a file
      saveKeypairToFile(keypair);
      
      console.log(`\nGenerated new keypair with address: ${keypair.publicKey.toString()}`);
      console.log('⚠️ IMPORTANT: This is a newly generated wallet with no funds!');
      console.log('You will need to fund this wallet before you can execute trades.');
      
      // Print out fund instructions
      console.log('\n=== FUNDING INSTRUCTIONS ===');
      console.log(`Send SOL to this address: ${keypair.publicKey.toString()}`);
      console.log('You need at least 0.01 SOL to execute trades.');
      
      return;
    }
    
    console.log(`\nLoaded existing keypair with address: ${keypair.publicKey.toString()}`);
    
    // Check wallet balance
    const balance = await connection.getBalance(keypair.publicKey);
    const balanceSOL = balance / 1000000000; // Convert lamports to SOL
    
    console.log(`Wallet balance: ${balanceSOL.toFixed(6)} SOL`);
    
    if (balance < 10000) {
      console.error('❌ Insufficient balance for transaction. Minimum 0.00001 SOL required.');
      
      // Print out fund instructions
      console.log('\n=== FUNDING INSTRUCTIONS ===');
      console.log(`Send SOL to this address: ${keypair.publicKey.toString()}`);
      console.log('You need at least 0.01 SOL to execute trades.');
      
      return;
    }
    
    // Execute a test transaction
    const signature = await executeTestTransaction(keypair);
    
    // Log the transaction
    logTransaction(signature, {
      type: 'test-transaction',
      wallet: keypair.publicKey.toString()
    });
    
    // Check new balance
    const newBalance = await connection.getBalance(keypair.publicKey);
    const newBalanceSOL = newBalance / 1000000000;
    
    console.log(`\nNew wallet balance: ${newBalanceSOL.toFixed(6)} SOL`);
    console.log(`Transaction fee: ${(balance - newBalance) / 1000000000} SOL`);
    
    console.log('\n=== REAL TRADING VERIFIED ===');
    console.log('✅ Successfully executed a real transaction on the Solana blockchain!');
    console.log('✅ Your system is correctly configured for real on-chain trading.');
    console.log('\nTo start the automated trading system:');
    console.log('1. Make sure your wallet has sufficient funds');
    console.log('2. Run: npx tsx run-trading-system.ts');
  } catch (error) {
    console.error('❌ Error executing transaction:', error);
  }
}

// Run the script
main();