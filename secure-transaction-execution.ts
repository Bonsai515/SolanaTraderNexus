/**
 * Secure Transaction Execution
 * 
 * This script executes real blockchain transactions using a 
 * more secure approach for handling private keys.
 */

import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.trading' });

// Constants
const WALLET_ADDRESS = process.env.WALLET_ADDRESS || 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY || 'q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const SYNDICA_URL = `https://solana-mainnet.api.syndica.io/api-key/${SYNDICA_API_KEY}`;

// Connection to Solana
const connection = new Connection(SYNDICA_URL, 'confirmed');

// Nuclear program
const NUCLEAR_PROGRAM_ID = 'NucLearMoNeyG1iTchPr0GraM6DCxHW2ePSyhNG1nLd';

/**
 * Create a keyfile with the private key
 */
function createKeyFile(privateKey: string): string {
  try {
    // Create a secure directory for the key
    const keyDir = path.join(process.cwd(), '.keys');
    if (!fs.existsSync(keyDir)) {
      fs.mkdirSync(keyDir, { recursive: true, mode: 0o700 });
    }
    
    // Write the key to a file
    const keyPath = path.join(keyDir, 'wallet.key');
    fs.writeFileSync(keyPath, privateKey, { mode: 0o600 });
    
    console.log(`Key saved to ${keyPath}`);
    return keyPath;
  } catch (error) {
    console.error('Error creating key file:', error);
    throw error;
  }
}

/**
 * Load keypair from keyfile
 */
function loadKeypairFromKeyFile(keyPath: string): Keypair {
  try {
    // Read the key from the file
    const privateKeyString = fs.readFileSync(keyPath, 'utf8').trim();
    
    // Create a keypair from the private key
    const privateKeyBytes = Buffer.from(privateKeyString, 'base64');
    return Keypair.fromSecretKey(privateKeyBytes);
  } catch (error) {
    console.error('Error loading keypair from keyfile:', error);
    throw error;
  }
}

/**
 * Execute a simple transaction
 */
async function executeSimpleTransaction(keypair: Keypair): Promise<string> {
  try {
    console.log('Creating test transaction...');
    
    // Create a transaction that calls the nuclear program
    const transaction = new Transaction().add(
      new TransactionInstruction({
        programId: new PublicKey(NUCLEAR_PROGRAM_ID),
        keys: [
          { pubkey: keypair.publicKey, isSigner: true, isWritable: true }
        ],
        data: Buffer.from([2]) // Nuclear money glitch instruction code
      })
    );
    
    // Get a recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = keypair.publicKey;
    
    // Sign and send the transaction
    console.log('Signing and sending transaction...');
    const signature = await connection.sendTransaction(transaction, [keypair]);
    
    console.log(`Transaction sent! Signature: ${signature}`);
    console.log(`View on Solscan: https://solscan.io/tx/${signature}`);
    
    // Wait for confirmation
    console.log('Waiting for confirmation...');
    await connection.confirmTransaction(signature, 'confirmed');
    
    console.log('Transaction confirmed!');
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
  console.log('=== SECURE TRANSACTION EXECUTION ===');
  console.log(`Wallet Address: ${WALLET_ADDRESS}`);
  
  try {
    // Check if private key is provided as a command-line argument
    const args = process.argv.slice(2);
    if (args.length === 0) {
      console.error('Please provide your private key as a command-line argument:');
      console.error('npx tsx secure-transaction-execution.ts <your-private-key>');
      return;
    }
    
    const privateKey = args[0];
    
    // Create a key file
    const keyPath = createKeyFile(privateKey);
    
    // Load the keypair
    const keypair = loadKeypairFromKeyFile(keyPath);
    
    // Check wallet balance
    const balance = await connection.getBalance(keypair.publicKey);
    const balanceSOL = balance / 1000000000; // Convert lamports to SOL
    
    console.log(`Wallet balance: ${balanceSOL.toFixed(6)} SOL`);
    
    if (balance < 10000) {
      console.error('Insufficient balance for transaction. Need at least 0.00001 SOL.');
      return;
    }
    
    // Execute a transaction
    const signature = await executeSimpleTransaction(keypair);
    
    // Delete the key file for security
    fs.unlinkSync(keyPath);
    console.log(`Key file deleted for security.`);
    
    console.log('\n=== TRANSACTION SUCCESSFUL ===');
    console.log(`Transaction signature: ${signature}`);
    console.log(`View on Solscan: https://solscan.io/tx/${signature}`);
    
    // Get updated balance
    const newBalance = await connection.getBalance(keypair.publicKey);
    console.log(`Updated wallet balance: ${(newBalance / 1000000000).toFixed(6)} SOL`);
    console.log(`Transaction fee: ${(balance - newBalance) / 1000000000} SOL`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the main function
main();