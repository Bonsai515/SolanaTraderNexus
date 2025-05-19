/**
 * Test Syndica API Connection
 * 
 * This script tests the connection to the Syndica RPC endpoint.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './.env.trading' });

// Syndica RPC URL
const SYNDICA_RPC_URL = process.env.SYNDICA_RPC_URL || '';

async function testSyndicaConnection() {
  console.log('====================================');
  console.log('SYNDICA RPC CONNECTION TEST');
  console.log('====================================');
  
  if (!SYNDICA_RPC_URL) {
    console.error('❌ Syndica RPC URL not found in environment variables');
    return false;
  }
  
  console.log(`Using Syndica RPC URL: ${SYNDICA_RPC_URL}`);
  
  try {
    // Create Connection object
    console.log('\nInitializing connection...');
    const connection = new Connection(SYNDICA_RPC_URL, 'confirmed');
    
    // Test getting block height
    console.log('Fetching block height...');
    const blockHeight = await connection.getBlockHeight();
    console.log(`✅ Current block height: ${blockHeight}`);
    
    // Test getting slot
    console.log('\nFetching current slot...');
    const slot = await connection.getSlot();
    console.log(`✅ Current slot: ${slot}`);
    
    // Test getting SOL balance of a known account
    const testAddress = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK'; // Your wallet
    console.log(`\nFetching balance of ${testAddress}...`);
    const balance = await connection.getBalance(new PublicKey(testAddress));
    console.log(`✅ Balance: ${balance / 1_000_000_000} SOL`);
    
    // Test getting recent blockhash
    console.log('\nFetching recent blockhash...');
    const blockhash = await connection.getLatestBlockhash();
    console.log(`✅ Recent blockhash: ${blockhash.blockhash}`);
    
    console.log('\n====================================');
    console.log('✅ SYNDICA RPC CONNECTION SUCCESSFUL');
    console.log('====================================');
    console.log('This RPC endpoint is properly configured and ready for trading.');
    return true;
  } catch (error) {
    console.error('\n❌ Failed to connect to Syndica RPC:');
    console.error(error);
    
    console.log('\n====================================');
    console.log('❌ SYNDICA RPC CONNECTION FAILED');
    console.log('====================================');
    console.log('Falling back to Helius/Alchemy for trading operations.');
    return false;
  }
}

// Run the test
testSyndicaConnection()
  .then((success) => {
    if (!success) {
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });