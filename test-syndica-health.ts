/**
 * Test Syndica API Health
 * 
 * This script checks the health of the Syndica API using your key.
 */

import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './.env.trading' });

// Syndica API configuration
const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY || 'q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const SYNDICA_RPC_URL = process.env.SYNDICA_RPC_URL || `https://solana-mainnet.api.syndica.io/api-key/${SYNDICA_API_KEY}`;

// Function to test Syndica API health
async function testSyndicaHealth() {
  console.log('===========================================');
  console.log('   TESTING SYNDICA API HEALTH');
  console.log('===========================================');
  console.log(`Using URL: ${SYNDICA_RPC_URL}`);
  console.log('-------------------------------------------');

  try {
    // Create the request payload for getHealth method
    const payload = {
      jsonrpc: '2.0',
      id: '1',
      method: 'getHealth'
    };

    console.log('Sending health check request...');
    
    // Make the POST request to Syndica API
    const response = await axios.post('https://solana-mainnet.api.syndica.io/', payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Syndica-Api-Key': SYNDICA_API_KEY
      }
    });

    // Check the response
    console.log('\nResponse received:');
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data && response.data.result === 'ok') {
      console.log('\n===========================================');
      console.log('✅ SYNDICA API IS HEALTHY');
      console.log('===========================================');
      console.log('The Syndica RPC endpoint is working correctly!');
      return true;
    } else {
      console.log('\n===========================================');
      console.log('⚠️ SYNDICA API RESPONSE RECEIVED BUT HEALTH STATUS UNCLEAR');
      console.log('===========================================');
      console.log('Check the response above for details.');
      return false;
    }
  } catch (error) {
    console.error('\nError testing Syndica API health:');
    if (axios.isAxiosError(error)) {
      console.error(`Status: ${error.response?.status}`);
      console.error(`Message: ${error.message}`);
      if (error.response?.data) {
        console.error('Response data:', error.response.data);
      }
    } else {
      console.error(error);
    }
    
    console.log('\n===========================================');
    console.log('❌ SYNDICA API HEALTH CHECK FAILED');
    console.log('===========================================');
    console.log('The system will fall back to Helius for trading operations.');
    return false;
  }
}

// Run the test
testSyndicaHealth().catch(console.error);