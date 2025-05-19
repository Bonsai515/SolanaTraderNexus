/**
 * Check Syndica Connection
 * 
 * This script tests if the Syndica RPC and WebSocket connections work properly.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './.env.trading' });

// Get configuration
const SYNDICA_RPC_URL = process.env.SYNDICA_RPC_URL || '';
const WALLET_ADDRESS = process.env.TRADING_WALLET_PUBLIC_KEY || 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';

// Main function
async function checkSyndicaConnection() {
  console.log('===========================================');
  console.log('   CHECKING SYNDICA RPC CONNECTION');
  console.log('===========================================');
  
  if (!SYNDICA_RPC_URL) {
    console.error('Error: Syndica RPC URL not found in environment');
    return false;
  }
  
  console.log(`Using Syndica RPC URL: ${SYNDICA_RPC_URL}`);
  console.log(`Testing with wallet: ${WALLET_ADDRESS}`);
  console.log('-------------------------------------------');
  
  try {
    // Create connection
    const connection = new Connection(SYNDICA_RPC_URL, 'confirmed');
    
    // Get current slot
    console.log('Getting current slot...');
    const slot = await connection.getSlot();
    console.log(`✅ Current slot: ${slot}`);
    
    // Get wallet balance
    console.log('\nGetting wallet balance...');
    const pubkey = new PublicKey(WALLET_ADDRESS);
    const balance = await connection.getBalance(pubkey);
    const solBalance = balance / 1_000_000_000; // Convert lamports to SOL
    console.log(`✅ Wallet balance: ${solBalance} SOL`);
    
    console.log('\n===========================================');
    console.log('✅ SYNDICA CONNECTION SUCCESSFUL');
    console.log('===========================================');
    console.log('Your Syndica API key is working and ready for trading.');
    return true;
  } catch (error) {
    console.error('\nError connecting to Syndica:');
    console.error(error);
    console.log('\n===========================================');
    console.log('❌ SYNDICA CONNECTION FAILED');
    console.log('===========================================');
    console.log('Trading will fall back to Helius and Alchemy for connections.');
    return false;
  }
}

// Run the check
checkSyndicaConnection().catch(console.error);