/**
 * Transaction Executor
 * 
 * This module handles the actual execution of transactions on the Solana blockchain.
 */

import { Connection, PublicKey, Transaction, SystemProgram, Keypair, sendAndConfirmTransaction } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.trading' });

// Constants
const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY || 'q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const SYNDICA_URL = `https://solana-mainnet.api.syndica.io/api-key/${SYNDICA_API_KEY}`;
const TRANSACTION_ENABLED = process.env.TRANSACTION_EXECUTION_ENABLED === 'true';
const USE_REAL_FUNDS = process.env.USE_REAL_FUNDS === 'true';
const WALLET_ADDRESS = process.env.TRADING_WALLET_ADDRESS || 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';

// Establish connection
const connection = new Connection(SYNDICA_URL);

/**
 * Log a transaction to file
 */
function logTransaction(action: string, details: any): void {
  try {
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const logPath = path.join(logDir, 'transactions.log');
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} [${action}] ${JSON.stringify(details)}
`;
    
    fs.appendFileSync(logPath, logEntry);
  } catch (error) {
    console.error('Error logging transaction:', error);
  }
}

/**
 * Execute a transaction on the Solana blockchain
 */
export async function executeTransaction(
  transaction: Transaction,
  signers: Keypair[],
  options: {
    skipPreflight?: boolean;
    preflightCommitment?: string;
    maxRetries?: number;
  } = {}
): Promise<string> {
  // Check if transaction execution is enabled
  if (!TRANSACTION_ENABLED || !USE_REAL_FUNDS) {
    const message = 'Transaction execution is disabled. Enable with TRANSACTION_EXECUTION_ENABLED=true and USE_REAL_FUNDS=true';
    console.log(message);
    logTransaction('SKIPPED', { message, transaction: transaction.serialize().toString() });
    throw new Error(message);
  }
  
  try {
    // Send and confirm the transaction
    console.log('Sending transaction to Solana blockchain...');
    
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      signers,
      {
        skipPreflight: options.skipPreflight || false,
        preflightCommitment: options.preflightCommitment || 'confirmed',
        maxRetries: options.maxRetries || 3
      }
    );
    
    console.log(`Transaction confirmed! Signature: ${signature}`);
    
    // Log the successful transaction
    logTransaction('SUCCESS', {
      signature,
      transaction: transaction.serialize().toString(),
      signers: signers.map(s => s.publicKey.toString())
    });
    
    return signature;
  } catch (error) {
    console.error('Transaction failed:', error);
    
    // Log the failed transaction
    logTransaction('FAILED', {
      error: error.toString(),
      transaction: transaction.serialize().toString(),
      signers: signers.map(s => s.publicKey.toString())
    });
    
    throw error;
  }
}

/**
 * Create and send a test transaction
 */
export async function sendTestTransaction(keypair: Keypair): Promise<string> {
  try {
    // Create a simple transaction to send 0.000001 SOL to self
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: keypair.publicKey,
        lamports: 1000 // 0.000001 SOL
      })
    );
    
    // Get a recent blockhash
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = keypair.publicKey;
    
    // Send the transaction
    return executeTransaction(transaction, [keypair]);
  } catch (error) {
    console.error('Test transaction failed:', error);
    throw error;
  }
}

// Export functions
export default {
  executeTransaction,
  sendTestTransaction
};