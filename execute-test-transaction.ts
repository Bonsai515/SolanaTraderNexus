/**
 * Execute Test Transaction
 * 
 * This script sends a small test transaction to the Solana blockchain
 * to verify that the system can actually execute on-chain transactions.
 */

import { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import bs58 from 'bs58';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.trading' });

// Constants
const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY || 'q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const SYNDICA_URL = `https://solana-mainnet.api.syndica.io/api-key/${SYNDICA_API_KEY}`;
const WALLET_ADDRESS = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';

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
 * Ask for private key input
 */
async function getPrivateKey(): Promise<Uint8Array | null> {
  // In a real system, you'd use a secure key management system or a hardware wallet
  // For this test, we'll ask for the private key directly
  
  console.log('\n=== SECURITY WARNING ===');
  console.log('You need to input your private key to execute a real transaction.');
  console.log('This is necessary for signing transactions but is NOT secure for production use.');
  console.log('Only use this for testing with small amounts.\n');
  
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    readline.question('Enter your private key (base58 encoded): ', (privateKeyBase58: string) => {
      readline.close();
      
      try {
        // Decode the private key
        const privateKey = bs58.decode(privateKeyBase58);
        return resolve(privateKey);
      } catch (error) {
        console.error('Invalid private key format:', error);
        return resolve(null);
      }
    });
  });
}

/**
 * Execute a real transaction using the provided keypair
 */
async function executeTransaction(keypair: Keypair): Promise<string> {
  try {
    // First, check current balance
    const balance = await connection.getBalance(keypair.publicKey);
    console.log(`Current wallet balance: ${balance / 1000000000} SOL`);
    
    if (balance < 10000) {
      throw new Error('Insufficient balance for transaction. Minimum 0.00001 SOL required.');
    }
    
    // Create a minimal transaction - transfer a tiny amount to yourself
    // This verifies on-chain execution without spending significant funds
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: keypair.publicKey,
        lamports: 5000 // 0.000005 SOL - minimal amount to demonstrate real execution
      })
    );
    
    // Get a recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = keypair.publicKey;
    
    console.log('Sending transaction to blockchain...');
    
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
    
    console.log(`✅ Transaction successfully executed on-chain!`);
    console.log(`Transaction signature: ${signature}`);
    console.log(`View on Solscan: https://solscan.io/tx/${signature}`);
    
    // Log the successful transaction
    logTransaction(signature, {
      type: 'test-transaction',
      blockhash,
      fee: '~5000 lamports',
      wallet: keypair.publicKey.toString()
    });
    
    // Check new balance to confirm transaction went through
    const newBalance = await connection.getBalance(keypair.publicKey);
    console.log(`New wallet balance: ${newBalance / 1000000000} SOL`);
    console.log(`Difference: ${(newBalance - balance) / 1000000000} SOL (includes fee)`);
    
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
  console.log('=== EXECUTE REAL ON-CHAIN TRANSACTION ===');
  console.log('This will send a real transaction to the Solana blockchain');
  console.log('to verify that the system can execute on-chain transactions.');
  
  try {
    // Get private key
    const privateKey = await getPrivateKey();
    
    if (!privateKey) {
      console.error('❌ No valid private key provided. Cannot execute transaction.');
      return;
    }
    
    // Create keypair from private key
    const keypair = Keypair.fromSecretKey(privateKey);
    
    // Verify public key matches expected wallet
    if (keypair.publicKey.toString() !== WALLET_ADDRESS) {
      console.warn(`⚠️ Warning: The provided private key does not match the expected wallet address.`);
      console.warn(`Expected: ${WALLET_ADDRESS}`);
      console.warn(`Actual: ${keypair.publicKey.toString()}`);
      
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const proceed = await new Promise((resolve) => {
        readline.question('Do you want to proceed with this wallet? (yes/no): ', (answer: string) => {
          readline.close();
          resolve(answer.toLowerCase() === 'yes');
        });
      });
      
      if (!proceed) {
        console.log('Transaction cancelled.');
        return;
      }
    }
    
    // Execute the transaction
    await executeTransaction(keypair);
    
    console.log('\n=== VERIFICATION COMPLETE ===');
    console.log('✅ The system has successfully executed a real on-chain transaction!');
    console.log('✅ This confirms ability to execute actual trades on the blockchain.');
    console.log('\nNow you can run the full trading system with:');
    console.log('npx tsx run-trading-system.ts');
  } catch (error) {
    console.error('❌ Failed to execute test transaction:', error);
  }
}

// Run the script
main();