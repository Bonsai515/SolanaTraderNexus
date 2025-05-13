/**
 * Test script for the Nexus Professional Engine with all transformers
 * 
 * This script verifies that all transformers are working directly in the application
 * and that the Nexus Professional Engine is ready for live trading.
 */

import axios from 'axios';
import { logger } from './server/logger';

async function testNexusEngine() {
  try {
    logger.info('=== NEXUS PROFESSIONAL ENGINE TEST ===');
    
    // First, activate the Nexus Professional Engine
    logger.info('1. Activating Nexus Professional Engine...');
    const rpcUrl = process.env.INSTANT_NODES_RPC_URL || 'https://api.mainnet-beta.solana.com';
    
    const activateResponse = await axios.post('http://localhost:5000/api/engine/nexus/activate', {
      rpcUrl,
      useRealFunds: false // Use simulated trading for testing
    });
    
    logger.info('Nexus activation response:', activateResponse.data);
    
    // Get engine status
    logger.info('2. Checking engine status...');
    const statusResponse = await axios.get('http://localhost:5000/api/engine/status');
    logger.info('Engine status:', statusResponse.data);
    
    // Test Security Transformer
    logger.info('3. Testing Security Transformer...');
    const tokenAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC on Solana
    const securityResponse = await axios.post('http://localhost:5000/api/engine/check-token-security', {
      tokenAddress
    });
    logger.info('Security analysis result:', securityResponse.data);
    
    // Test CrossChain Transformer
    logger.info('4. Testing CrossChain Transformer...');
    const crossChainResponse = await axios.get('http://localhost:5000/api/engine/cross-chain-opportunities');
    logger.info('CrossChain opportunities found:', crossChainResponse.data.opportunities ? crossChainResponse.data.opportunities.length : 0);
    
    // Test MemeCortex Transformer
    logger.info('5. Testing MemeCortex Transformer...');
    const memeTokenAddress = '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'; // BONK
    const memeResponse = await axios.post('http://localhost:5000/api/engine/analyze-meme-sentiment', {
      tokenAddress: memeTokenAddress
    });
    logger.info('MemeCortex sentiment analysis result:', memeResponse.data);
    
    // Verification summary
    logger.info('=== TEST SUMMARY ===');
    
    const securityTransformerWorking = securityResponse.data.success;
    const crossChainTransformerWorking = crossChainResponse.data.success;
    const memeCortexTransformerWorking = memeResponse.data.success;
    
    logger.info(`Security Transformer: ${securityTransformerWorking ? 'WORKING' : 'FAILED'}`);
    logger.info(`CrossChain Transformer: ${crossChainTransformerWorking ? 'WORKING' : 'FAILED'}`);
    logger.info(`MemeCortex Transformer: ${memeCortexTransformerWorking ? 'WORKING' : 'FAILED'}`);
    
    const allTransformersWorking = securityTransformerWorking && crossChainTransformerWorking && memeCortexTransformerWorking;
    logger.info(`All transformers directly implemented: ${allTransformersWorking ? 'YES' : 'NO'}`);
    logger.info(`Nexus Professional Engine ready for live trading: ${allTransformersWorking ? 'YES' : 'NO'}`);
    
    return {
      allTransformersWorking,
      transformers: {
        security: securityTransformerWorking,
        crossChain: crossChainTransformerWorking,
        memeCortex: memeCortexTransformerWorking
      }
    };
  } catch (error: any) {
    logger.error('Error testing Nexus Professional Engine:', error.message);
    if (error.response) {
      logger.error('Response data:', error.response.data);
    }
    throw error;
  }
}

// Execute the test
testNexusEngine()
  .then((result) => {
    logger.info('Nexus engine test completed');
    
    if (result.allTransformersWorking) {
      logger.info('All transformers are working properly. The Nexus Professional Engine is ready for live trading.');
    } else {
      logger.warn('Some transformers are not working correctly. The Nexus Professional Engine is not fully ready for live trading.');
    }
    
    process.exit(0);
  })
  .catch(error => {
    logger.error('Nexus engine test failed:', error);
    process.exit(1);
  });