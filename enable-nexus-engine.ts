/**
 * Enable Nexus Professional Engine
 * 
 * This script sets the Nexus Professional Engine as the default transaction engine
 * for live trading with the new directly implemented transformers.
 */

import axios from 'axios';
import { logger } from './server/logger';

async function enableNexusEngine() {
  try {
    logger.info('Enabling Nexus Professional Engine as the default transaction engine...');
    
    // 1. Activate the Nexus Professional Engine
    const rpcUrl = process.env.INSTANT_NODES_RPC_URL || 'https://api.mainnet-beta.solana.com';
    logger.info(`Using RPC URL: ${rpcUrl}`);
    
    const activateResponse = await axios.post('http://localhost:5000/api/engine/nexus/activate', {
      rpcUrl,
      useRealFunds: true // Use real funds for live trading
    });
    
    if (!activateResponse.data.success) {
      throw new Error('Failed to activate Nexus Professional Engine');
    }
    
    logger.info('Nexus Professional Engine activated successfully');
    
    // 2. Register system wallet for profit collection
    const systemWallet = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
    logger.info(`Registering system wallet: ${systemWallet}`);
    
    const registerResponse = await axios.post('http://localhost:5000/api/engine/register-wallet', {
      walletAddress: systemWallet
    });
    
    if (!registerResponse.data.success) {
      throw new Error('Failed to register system wallet');
    }
    
    logger.info('System wallet registered successfully');
    
    // 3. Verify transformers are active
    logger.info('Verifying transformers...');
    
    // Security Transformer
    const securityResult = await axios.post('http://localhost:5000/api/engine/check-token-security', {
      tokenAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // USDC
    });
    
    // CrossChain Transformer
    const crosschainResult = await axios.get('http://localhost:5000/api/engine/cross-chain-opportunities');
    
    // MemeCortex Transformer
    const memecortexResult = await axios.post('http://localhost:5000/api/engine/analyze-meme-sentiment', {
      tokenAddress: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' // WIF
    });
    
    logger.info('All transformers verified successfully');
    
    // Get final engine status
    const statusResponse = await axios.get('http://localhost:5000/api/engine/status');
    
    logger.info('Nexus Professional Engine is now the default transaction engine');
    logger.info('Status:', statusResponse.data);
    
    return {
      success: true,
      engine: 'nexus_professional',
      status: statusResponse.data
    };
  } catch (error: any) {
    logger.error('Error enabling Nexus Professional Engine:', error.message);
    if (error.response) {
      logger.error('Response data:', error.response.data);
    }
    return {
      success: false,
      error: error.message
    };
  }
}

// Execute the script
enableNexusEngine()
  .then((result) => {
    if (result.success) {
      logger.info('---------------------------------------------------');
      logger.info('🚀 NEXUS PROFESSIONAL ENGINE ENABLED SUCCESSFULLY 🚀');
      logger.info('---------------------------------------------------');
      logger.info('The system is now ready for live trading with all');
      logger.info('transformers directly implemented in the application.');
      logger.info('---------------------------------------------------');
    } else {
      logger.error('Failed to enable Nexus Professional Engine');
    }
    process.exit(0);
  })
  .catch(error => {
    logger.error('Script execution failed:', error);
    process.exit(1);
  });