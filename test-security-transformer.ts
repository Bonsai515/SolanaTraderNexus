/**
 * Test script for the Security transformer
 */

import axios from 'axios';
import { logger } from './server/logger';

async function testSecurityTransformer() {
  try {
    // First, activate the Nexus Professional Engine
    logger.info('Activating Nexus Professional Engine...');
    const rpcUrl = process.env.INSTANT_NODES_RPC_URL || 'https://api.mainnet-beta.solana.com';
    
    const activateResponse = await axios.post('http://localhost:5000/api/engine/nexus/activate', {
      rpcUrl,
      useRealFunds: false // Use simulated trading for testing
    });
    
    logger.info('Nexus activation response:', activateResponse.data);
    
    // Test token security analysis on a real Solana token (Raydium)
    const tokenAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC on Solana
    
    logger.info(`Testing security analysis for token: ${tokenAddress}`);
    
    const securityResponse = await axios.post('http://localhost:5000/api/engine/check-token-security', {
      tokenAddress
    });
    
    logger.info('Security analysis result:');
    console.log(JSON.stringify(securityResponse.data, null, 2));
    
    return securityResponse.data;
  } catch (error: any) {
    logger.error('Error testing Security transformer:', error.message);
    if (error.response) {
      logger.error('Response data:', error.response.data);
    }
    throw error;
  }
}

// Execute the test
testSecurityTransformer()
  .then(() => {
    logger.info('Security transformer test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    logger.error('Security transformer test failed:', error);
    process.exit(1);
  });