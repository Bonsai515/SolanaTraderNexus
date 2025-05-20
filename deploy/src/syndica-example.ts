/**
 * Syndica RPC Client Usage Example
 * 
 * This file shows how to use the optimized Syndica RPC client.
 */

import { getBalance, getAccountInfo, getRecentBlockhash, sendTransaction, getMultipleTokenBalances } from './utils/syndica-client';
import { PublicKey } from '@solana/web3.js';

// Example use cases
async function exampleUsage() {
  try {
    // Get SOL balance
    const walletAddress = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
    const balance = await getBalance(walletAddress);
    console.log(`Wallet balance: ${balance / 1_000_000_000} SOL`);
    
    // Get multiple token balances in one call
    const tokenMints = [
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      'So11111111111111111111111111111111111111112'   // Wrapped SOL
    ];
    
    const tokenBalances = await getMultipleTokenBalances(walletAddress, tokenMints);
    console.log('Token balances:', tokenBalances);
    
    // Get recent blockhash (cached)
    const blockhash = await getRecentBlockhash();
    console.log('Recent blockhash:', blockhash);
    
  } catch (error) {
    console.error('Error in example usage:', error);
  }
}

// Run the example
exampleUsage();