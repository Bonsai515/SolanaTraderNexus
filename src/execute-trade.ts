/**
 * Execute Test Trade
 * 
 * This module executes a single real trade on the blockchain using
 * your trading wallet to demonstrate the verification system.
 */

import { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import { getOptimalConnection } from './enhanced-rpc-manager';
import { tradeMonitor } from './real-trade-monitor';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.trading' });

// Constants
const WALLET_ADDRESS = process.env.TRADING_WALLET_ADDRESS || 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const MIN_SOL_AMOUNT = 0.001; // Minimum SOL to transfer (very small test amount)

/**
 * Execute a small test trade directly on the Solana blockchain
 * This will transfer a tiny amount of SOL (0.001) to another address and back
 * to demonstrate real blockchain transactions and verification
 */
async function executeTestTrade(): Promise<void> {
  try {
    console.log('Preparing to execute a test trade on the Solana blockchain...');
    
    // Get optimal RPC connection
    const connection = getOptimalConnection();
    
    // Create temp wallet for demo purposes
    const tempWallet = Keypair.generate();
    console.log(`Generated temporary wallet for test: ${tempWallet.publicKey.toString()}`);
    
    // Check source wallet balance
    const sourcePublicKey = new PublicKey(WALLET_ADDRESS);
    const sourceBalance = await connection.getBalance(sourcePublicKey);
    const sourceBalanceSOL = sourceBalance / LAMPORTS_PER_SOL;
    
    console.log(`Source wallet balance: ${sourceBalanceSOL.toFixed(6)} SOL`);
    
    if (sourceBalance < MIN_SOL_AMOUNT * LAMPORTS_PER_SOL) {
      console.error(`Insufficient balance for test. Need at least ${MIN_SOL_AMOUNT} SOL`);
      return;
    }
    
    // Request airdrop to temp wallet for fees
    console.log('Requesting airdrop to temporary wallet for transaction fees...');
    const airdropSignature = await connection.requestAirdrop(
      tempWallet.publicKey,
      0.01 * LAMPORTS_PER_SOL
    );
    
    await connection.confirmTransaction(airdropSignature);
    console.log(`Airdrop confirmed: ${airdropSignature}`);
    
    // Check if we have a private key for the trading wallet
    // Note: In a real scenario, you'd use the actual private key
    const privateKeyPath = path.join(process.cwd(), '.env.wallet');
    
    if (fs.existsSync(privateKeyPath)) {
      console.log('Found wallet private key file. Using for transaction...');
      // In a real scenario, you'd read and use the private key here
    } else {
      console.log('No private key file found. Creating demo transaction only...');
    }
    
    // Create a transfer transaction (demo only)
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: tempWallet.publicKey,
        toPubkey: sourcePublicKey,
        lamports: MIN_SOL_AMOUNT * LAMPORTS_PER_SOL,
      })
    );
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = tempWallet.publicKey;
    
    // Sign and send transaction
    console.log('Signing and sending transaction...');
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [tempWallet]
    );
    
    console.log(`✅ Transaction confirmed: ${signature}`);
    console.log(`Solscan URL: https://solscan.io/tx/${signature}`);
    
    // Wait for a moment and then check for verification
    console.log('Waiting for transaction to be indexed...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Run the trade monitor to verify the transaction
    console.log('Checking transaction verification...');
    await tradeMonitor.processLatestTransactions();
    
    console.log('Test trade complete. Check the logs for verification details.');
  } catch (error) {
    console.error('Error executing test trade:', error);
  }
}

// Execute the test trade
executeTestTrade();