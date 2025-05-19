/**
 * Test Syndica WebSocket Connection
 * 
 * This script tests the connection to the Syndica WebSocket endpoint.
 */

import { Connection } from '@solana/web3.js';
import * as dotenv from 'dotenv';
import * as WebSocket from 'ws';

// Load environment variables
dotenv.config({ path: './.env.trading' });

// Syndica WebSocket URL
const SYNDICA_WS_URL = process.env.SYNDICA_WS_URL || '';

// Test the WebSocket connection
async function testSyndicaConnection() {
  console.log('Testing Syndica WebSocket connection...');
  
  if (!SYNDICA_WS_URL) {
    console.error('Syndica WebSocket URL not found in environment variables');
    return false;
  }
  
  try {
    // Connect to Syndica WebSocket (direct test)
    console.log('Attempting direct WebSocket connection...');
    
    const ws = new WebSocket(SYNDICA_WS_URL);
    
    return new Promise<boolean>((resolve) => {
      ws.on('open', () => {
        console.log('✅ Successfully connected to Syndica WebSocket!');
        
        // Test subscription
        const subscribeMsg = JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'blockSubscribe',
          params: {
            commitment: 'confirmed',
            encoding: 'json'
          }
        });
        
        console.log('Subscribing to blocks...');
        ws.send(subscribeMsg);
        
        // Set a timeout to close connection after a few seconds
        setTimeout(() => {
          ws.close();
          console.log('Connection test completed.');
          resolve(true);
        }, 5000);
      });
      
      ws.on('message', (data: WebSocket.Data) => {
        try {
          const response = JSON.parse(data.toString());
          console.log('Received response:', JSON.stringify(response, null, 2));
        } catch (e) {
          console.log('Received raw data:', data);
        }
      });
      
      ws.on('error', (error: Error) => {
        console.error('WebSocket error:', error.message);
        resolve(false);
      });
      
      ws.on('close', (code: number, reason: Buffer) => {
        console.log(`WebSocket closed with code ${code}: ${reason.toString()}`);
      });
      
      // Set a timeout in case the connection never opens
      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.error('Connection timed out');
          ws.terminate();
          resolve(false);
        }
      }, 10000);
    });
    
  } catch (error) {
    console.error('Failed to connect to Syndica WebSocket:', error);
    return false;
  }
}

// Test connection via web3.js
async function testWeb3Connection() {
  console.log('\nTesting Connection via web3.js...');
  
  try {
    // Create Connection object
    const connection = new Connection(SYNDICA_WS_URL, 'confirmed');
    
    // Test getting recent block hash
    console.log('Fetching block height...');
    const blockHeight = await connection.getBlockHeight();
    console.log(`✅ Current block height: ${blockHeight}`);
    
    // Test getting slot
    console.log('Fetching current slot...');
    const slot = await connection.getSlot();
    console.log(`✅ Current slot: ${slot}`);
    
    // Test getting balance of a random account
    console.log('Fetching balance of a test account...');
    const balance = await connection.getBalance(new Connection('https://api.mainnet-beta.solana.com').getGenesisBlock());
    console.log(`✅ Test balance result received`);
    
    return true;
  } catch (error) {
    console.error('Web3.js connection test failed:', error);
    return false;
  }
}

// Main function
async function main() {
  console.log('====================================');
  console.log('SYNDICA CONNECTION TEST');
  console.log('====================================');
  
  const wsSuccess = await testSyndicaConnection();
  const web3Success = await testWeb3Connection();
  
  console.log('\n====================================');
  console.log('TEST RESULTS');
  console.log('====================================');
  console.log(`WebSocket Direct Test: ${wsSuccess ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Web3.js Integration Test: ${web3Success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log('====================================');
  
  if (wsSuccess && web3Success) {
    console.log('\n✅ Syndica WebSocket is READY for real-time trading!');
    console.log('This endpoint can be used for real-time data and transactions.');
    
    return 0;
  } else {
    console.log('\n⚠️ Some tests failed. Syndica WebSocket may have limited functionality.');
    console.log('The system will fall back to Helius for trading operations.');
    
    return 1;
  }
}

// Run main function
main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });