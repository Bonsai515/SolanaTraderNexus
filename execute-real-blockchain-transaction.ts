/**
 * Execute Real Blockchain Transaction
 * 
 * This script executes a real transaction on the Solana blockchain
 * to verify that your wallet is configured correctly.
 */

import { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import bs58 from 'bs58';
import dotenv from 'dotenv';
import * as readline from 'readline';

// Load environment variables
dotenv.config({ path: '.env.trading' });

// Constants
const WALLET_ADDRESS = process.env.WALLET_ADDRESS || 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY || 'q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const SYNDICA_URL = `https://solana-mainnet.api.syndica.io/api-key/${SYNDICA_API_KEY}`;

// Solana connection
const connection = new Connection(SYNDICA_URL, 'confirmed');

/**
 * Create keypair from private key
 */
function createKeypairFromPrivateKey(privateKeyBase58: string): Keypair | null {
  try {
    const privateKey = bs58.decode(privateKeyBase58);
    return Keypair.fromSecretKey(privateKey);
  } catch (error) {
    console.error('Error creating keypair:', error);
    return null;
  }
}

/**
 * Execute a simple self-transfer transaction on Solana
 */
async function executeSelfTransfer(
  fromKeypair: Keypair,
  lamports: number = 10000 // 0.00001 SOL
): Promise<string> {
  try {
    console.log(`Executing self-transfer transaction of ${lamports / 1000000000} SOL...`);
    
    // Create a transaction that sends a small amount of SOL from the wallet to itself
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: fromKeypair.publicKey,
        lamports: lamports,
      })
    );
    
    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromKeypair.publicKey;
    
    // Sign and send transaction
    console.log('Sending transaction to blockchain...');
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [fromKeypair],
      {
        commitment: 'confirmed',
        skipPreflight: false
      }
    );
    
    console.log(`Transaction confirmed! Signature: ${signature}`);
    console.log(`Transaction URL: https://solscan.io/tx/${signature}`);
    
    return signature;
  } catch (error) {
    console.error('Error executing transaction:', error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('=== EXECUTE REAL BLOCKCHAIN TRANSACTION ===');
  console.log(`Wallet Address: ${WALLET_ADDRESS}`);
  
  try {
    // Check wallet balance
    const balance = await connection.getBalance(new PublicKey(WALLET_ADDRESS));
    const balanceSOL = balance / 1000000000; // Convert lamports to SOL
    
    console.log(`Current wallet balance: ${balanceSOL.toFixed(6)} SOL`);
    
    if (balance < 20000) { // Need at least 0.00002 SOL for transaction fee + transfer
      console.error('Insufficient balance for transaction. Need at least 0.00002 SOL.');
      return;
    }
    
    // Ask for private key
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    console.log('\n=== SECURITY NOTICE ===');
    console.log('You need to provide your private key to execute a real transaction.');
    console.log('This is necessary for signing on-chain transactions.');
    console.log('This private key will ONLY be used for this transaction and will not be stored.');
    
    const privateKey = await new Promise<string>((resolve) => {
      rl.question('\nEnter your private key (base58 encoded): ', (answer) => {
        resolve(answer.trim());
      });
    });
    
    rl.close();
    
    // Create keypair from private key
    const keypair = createKeypairFromPrivateKey(privateKey);
    if (!keypair) {
      console.error('Invalid private key. Cannot proceed.');
      return;
    }
    
    // Verify that the keypair matches the expected wallet address
    const publicKeyString = keypair.publicKey.toBase58();
    if (publicKeyString !== WALLET_ADDRESS) {
      console.warn(`Warning: The provided keypair (${publicKeyString}) does not match the configured wallet address (${WALLET_ADDRESS}).`);
      
      const confirmRl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const confirm = await new Promise<string>((resolve) => {
        confirmRl.question('Do you want to proceed with this keypair anyway? (yes/no): ', (answer) => {
          resolve(answer.toLowerCase());
        });
      });
      
      confirmRl.close();
      
      if (confirm !== 'yes') {
        console.log('Transaction cancelled.');
        return;
      }
    }
    
    // Execute transaction
    console.log('\nExecuting transaction...');
    const signature = await executeSelfTransfer(keypair);
    
    // Get updated balance
    const newBalance = await connection.getBalance(keypair.publicKey);
    const newBalanceSOL = newBalance / 1000000000;
    
    console.log('\n=== TRANSACTION SUCCESSFUL ===');
    console.log(`Transaction signature: ${signature}`);
    console.log(`View on Solscan: https://solscan.io/tx/${signature}`);
    console.log(`New wallet balance: ${newBalanceSOL.toFixed(6)} SOL`);
    console.log(`Transaction fee: ${(balance - newBalance) / 1000000000} SOL`);
    
    console.log('\n=== BLOCKCHAIN VERIFICATION COMPLETE ===');
    console.log('✅ Your wallet is correctly configured for blockchain transactions.');
    console.log('✅ The trading system can now execute real trades using your wallet.');
    
  } catch (error) {
    console.error('Error executing transaction:', error);
  }
}

// Run the main function
main();