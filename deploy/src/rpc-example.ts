/**
 * Multi-Provider RPC Manager Usage Example
 * 
 * This file shows how to use the optimized multi-provider RPC manager.
 */

import { 
  getBalance, 
  getAccountInfo, 
  getRecentBlockhash, 
  sendTransaction, 
  getConnectionStats
} from './utils/rpc-manager';
import { PublicKey } from '@solana/web3.js';

// Example usage
async function exampleUsage() {
  try {
    // Get wallet balance
    const walletAddress = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
    const balance = await getBalance(walletAddress);
    console.log(`Wallet balance: ${balance / 1_000_000_000} SOL`);
    
    // Get account info
    const accountInfo = await getAccountInfo(walletAddress);
    console.log('Account info:', accountInfo);
    
    // Get recent blockhash
    const blockhash = await getRecentBlockhash();
    console.log('Recent blockhash:', blockhash);
    
    // Check connection stats
    const stats = getConnectionStats();
    console.log('RPC Connection Stats:');
    console.table(stats);
  } catch (error) {
    console.error('Error in example usage:', error);
  }
}

// Run the example
exampleUsage();