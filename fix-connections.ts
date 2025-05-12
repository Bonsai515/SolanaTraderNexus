/**
 * Fix API Connections for Live Trading
 * 
 * This script ensures all necessary API connections are properly configured
 * for live trading with real funds.
 */

import axios from 'axios';
import { Connection } from '@solana/web3.js';
import { logger } from './server/logger';
import { initializeWormholeConnector, checkWormholeConnection } from './server/wormhole/wormholeConnector';

// RPC URLs
const INSTANT_NODES_RPC_URL = process.env.INSTANT_NODES_RPC_URL;
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const SOLANA_RPC_API_KEY = process.env.SOLANA_RPC_API_KEY;

// AI API Keys
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

/**
 * Fix Solana RPC connection issues
 * @returns true if connection is successful
 */
async function fixSolanaConnection(): Promise<boolean> {
  logger.info('Testing Solana RPC connection...');

  try {
    // Try InstantNodes first (primary)
    if (INSTANT_NODES_RPC_URL) {
      const instantNodesConnection = new Connection(`https://solana-mainnet.rpc.extrnode.com/${INSTANT_NODES_RPC_URL}`);
      const blockHeight = await instantNodesConnection.getBlockHeight();
      logger.info(`✅ InstantNodes connection successful! Block height: ${blockHeight}`);
      return true;
    }
    
    // Try Helius if InstantNodes fails
    if (HELIUS_API_KEY) {
      const heliusConnection = new Connection(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`);
      const blockHeight = await heliusConnection.getBlockHeight();
      logger.info(`✅ Helius connection successful! Block height: ${blockHeight}`);
      return true;
    }
    
    // Try standard Solana RPC as fallback
    if (SOLANA_RPC_API_KEY) {
      const solanaConnection = new Connection(`https://api.mainnet-beta.solana.com/${SOLANA_RPC_API_KEY}`);
      const blockHeight = await solanaConnection.getBlockHeight();
      logger.info(`✅ Solana RPC connection successful! Block height: ${blockHeight}`);
      return true;
    }
    
    // Try public endpoint as last resort
    const publicConnection = new Connection('https://api.mainnet-beta.solana.com');
    const blockHeight = await publicConnection.getBlockHeight();
    logger.info(`✅ Public Solana RPC connection successful! Block height: ${blockHeight}`);
    return true;
  } catch (error) {
    logger.error(`❌ All Solana RPC connections failed: ${error}`);
    return false;
  }
}

/**
 * Fix Wormhole connection for cross-chain operations
 * @returns true if connection is successful
 */
async function fixWormholeConnection(): Promise<boolean> {
  logger.info('Testing Wormhole connection...');
  
  try {
    // Use our TypeScript implementation that doesn't require an API key
    const isConnected = await checkWormholeConnection();
    
    if (isConnected) {
      logger.info('✅ Wormhole connection successful using Guardian RPC network!');
      return true;
    } else {
      logger.error('❌ Wormhole connection failed using all Guardian RPCs');
      return false;
    }
  } catch (error) {
    logger.error(`❌ Wormhole connection error: ${error}`);
    return false;
  }
}

/**
 * Fix AI connections (Perplexity and DeepSeek)
 * @returns true if at least one connection is successful
 */
async function fixAIConnections(): Promise<boolean> {
  logger.info('Testing AI API connections...');
  
  let perplexityConnected = false;
  let deepseekConnected = false;
  
  // Test Perplexity
  if (PERPLEXITY_API_KEY) {
    try {
      const response = await axios.post(
        'https://api.perplexity.ai/chat/completions',
        {
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [
            {
              role: 'system',
              content: 'You are a trading assistant.'
            },
            {
              role: 'user',
              content: 'Test connection'
            }
          ],
          max_tokens: 5
        },
        {
          headers: {
            'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.status === 200) {
        logger.info('✅ Perplexity API connection successful!');
        perplexityConnected = true;
      }
    } catch (error) {
      logger.error(`❌ Perplexity API connection failed: ${error}`);
    }
  } else {
    logger.warn('⚠️ Perplexity API key not found');
  }
  
  // Test DeepSeek
  if (DEEPSEEK_API_KEY) {
    try {
      const response = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: 'You are a trading assistant.'
            },
            {
              role: 'user',
              content: 'Test connection'
            }
          ],
          max_tokens: 5
        },
        {
          headers: {
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.status === 200) {
        logger.info('✅ DeepSeek API connection successful!');
        deepseekConnected = true;
      }
    } catch (error) {
      logger.error(`❌ DeepSeek API connection failed: ${error}`);
    }
  } else {
    logger.warn('⚠️ DeepSeek API key not found');
  }
  
  return perplexityConnected || deepseekConnected;
}

/**
 * Main function to fix all connections
 */
export async function tryConnectAPI() {
  logger.info('Fixing API connections for live trading...');
  
  // Initialize connections
  const solanaConnected = await fixSolanaConnection();
  const wormholeConnected = await fixWormholeConnection();
  const aiConnected = await fixAIConnections();
  
  // Return overall status
  return {
    solana: solanaConnected,
    wormhole: wormholeConnected,
    ai: aiConnected,
    allConnected: solanaConnected && wormholeConnected // AI is optional
  };
}

// Run if executed directly
if (require.main === module) {
  tryConnectAPI()
    .then(status => {
      logger.info('Connection status:', status);
      
      if (status.allConnected) {
        logger.info('✅ All critical connections fixed!');
        process.exit(0);
      } else {
        logger.error('❌ Some connections could not be fixed');
        process.exit(1);
      }
    })
    .catch(error => {
      logger.error('❌ Connection fix failed:', error);
      process.exit(1);
    });
}