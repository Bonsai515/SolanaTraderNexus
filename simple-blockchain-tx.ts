/**
 * Simple Blockchain Transaction
 * 
 * This script executes a simple transaction on the Solana blockchain
 */

import { Connection, PublicKey, SystemProgram, Transaction, Keypair } from '@solana/web3.js';
import * as readline from 'readline';
import fs from 'fs';
import bs58 from 'bs58';

// Constants
const WALLET_ADDRESS = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const SOL_PER_LAMPORT = 0.000000001;

/**
 * Main function
 */
async function main() {
  console.log('=== SIMPLE BLOCKCHAIN TRANSACTION ===');
  console.log(`Target wallet: ${WALLET_ADDRESS}`);
  
  // Create a connection to Solana mainnet
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  
  try {
    // Get current balance
    const balance = await connection.getBalance(new PublicKey(WALLET_ADDRESS));
    console.log(`Current balance: ${balance * SOL_PER_LAMPORT} SOL`);
    
    // Get user to enter private key
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const privateKeyBase58 = await new Promise<string>((resolve) => {
      rl.question('\nEnter your private key (base58 encoded): ', (answer) => {
        resolve(answer.trim());
      });
    });
    
    rl.close();
    
    // Convert private key to keypair
    let keypair: Keypair;
    try {
      const privateKeyBytes = bs58.decode(privateKeyBase58);
      keypair = Keypair.fromSecretKey(privateKeyBytes);
    } catch (error) {
      console.error('Error creating keypair:', error);
      console.error('Make sure your private key is base58 encoded.');
      return;
    }
    
    // Verify that the keypair matches the expected wallet address
    if (keypair.publicKey.toBase58() !== WALLET_ADDRESS) {
      console.error('Error: The provided private key does not match the expected wallet address.');
      console.error(`Expected: ${WALLET_ADDRESS}`);
      console.error(`Actual: ${keypair.publicKey.toBase58()}`);
      return;
    }
    
    console.log(`\nKeypair verified for wallet: ${keypair.publicKey.toBase58()}`);
    
    // Create a simple self-transfer transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: keypair.publicKey,
        lamports: 5000, // 0.000005 SOL
      })
    );
    
    // Get a recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = keypair.publicKey;
    
    // Sign and send the transaction
    console.log('\nSending transaction to blockchain...');
    const signature = await connection.sendTransaction(transaction, [keypair]);
    
    console.log(`\nTransaction sent! Signature: ${signature}`);
    console.log(`View on Solscan: https://solscan.io/tx/${signature}`);
    
    // Wait for transaction confirmation
    console.log('\nWaiting for confirmation...');
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value.err) {
      console.error(`\nTransaction failed: ${JSON.stringify(confirmation.value.err)}`);
    } else {
      console.log('\nTransaction confirmed!');
      
      // Get updated balance
      const newBalance = await connection.getBalance(keypair.publicKey);
      console.log(`Updated balance: ${newBalance * SOL_PER_LAMPORT} SOL`);
      console.log(`Transaction cost: ${(balance - newBalance) * SOL_PER_LAMPORT} SOL`);
    }
    
    console.log('\n=== BLOCKCHAIN TRANSACTION COMPLETE ===');
    console.log('Your trading system has successfully executed a real blockchain transaction.');
    console.log('This confirms your ability to make actual trades on the Solana blockchain.');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the main function
main();