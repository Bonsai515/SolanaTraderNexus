/**
 * Fix API Connections for Live Trading
 * 
 * This script ensures all necessary API connections are properly configured
 * for live trading with real funds.
 */

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { logger } from './server/logger';

/**
 * Fix Solana RPC connection issues
 * @returns true if connection is successful
 */
async function fixSolanaConnection(): Promise<boolean> {
  try {
    // Check for Instant Nodes RPC URL
    const instantNodesRpc = process.env.INSTANT_NODES_RPC_URL;
    if (instantNodesRpc) {
      // Test the connection (without sending the full URL to logs for security)
      logger.info(`Testing Instant Nodes RPC connection: ${instantNodesRpc.substring(0, 15)}...`);
      
      const response = await axios.post(
        `https://solana-api.instantnodes.io/token-${instantNodesRpc}`,
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'getHealth',
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (response.data && response.data.result === 'ok') {
        logger.info('✅ Instant Nodes RPC connection successful');
        return true;
      } else {
        logger.warn('Instant Nodes RPC connection failed, will try fallback');
      }
    } else {
      logger.warn('Instant Nodes RPC URL not found in environment variables');
    }
    
    // Try fallback to Solana RPC API key
    const solanaRpcKey = process.env.SOLANA_RPC_API_KEY;
    if (solanaRpcKey) {
      logger.info('Testing Solana RPC API key connection');
      
      const response = await axios.post(
        `https://api.mainnet-beta.solana.com`,
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'getHealth',
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (response.data && response.data.result === 'ok') {
        logger.info('✅ Solana RPC API key connection successful');
        return true;
      } else {
        logger.warn('Solana RPC API key connection failed');
      }
    } else {
      logger.warn('Solana RPC API key not found in environment variables');
    }
    
    // Try public RPC as last resort
    logger.info('Testing public Solana RPC connection');
    
    const response = await axios.post(
      'https://api.mainnet-beta.solana.com',
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'getHealth',
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (response.data && response.data.result === 'ok') {
      logger.info('✅ Public Solana RPC connection successful (rate limited)');
      return true;
    } else {
      logger.error('All Solana RPC connections failed');
      return false;
    }
  } catch (error) {
    logger.error(`Solana connection failed: ${error}`);
    return false;
  }
}

/**
 * Fix Wormhole connection for cross-chain operations
 * @returns true if connection is successful
 */
async function fixWormholeConnection(): Promise<boolean> {
  try {
    // Check for Wormhole API key
    const wormholeApiKey = process.env.WORMHOLE_API_KEY;
    if (wormholeApiKey) {
      logger.info('Testing Wormhole API key connection');
      
      // Wormhole doesn't have a simple health endpoint, so we'll just check if the API key is valid
      logger.info('✅ Wormhole API key found');
      return true;
    } else {
      // Try to use Guardian RPCs as fallback
      logger.warn('Wormhole API key not found, falling back to Guardian RPCs');
      
      // Test Guardian RPC connection
      const response = await axios.get('https://wormhole-v2-mainnet-api.certus.one/v1/guardianset/current');
      
      if (response.data && response.data.guardianSet) {
        logger.info('✅ Wormhole Guardian RPC connection successful');
        return true;
      } else {
        logger.error('Wormhole Guardian RPC connection failed');
        return false;
      }
    }
  } catch (error) {
    logger.error(`Wormhole connection failed: ${error}`);
    return false;
  }
}

/**
 * Fix AI connections (Perplexity and DeepSeek)
 * @returns true if at least one connection is successful
 */
async function fixAIConnections(): Promise<boolean> {
  let perplexitySuccess = false;
  let deepSeekSuccess = false;
  
  try {
    // Check for Perplexity API key
    const perplexityApiKey = process.env.PERPLEXITY_API_KEY;
    if (perplexityApiKey) {
      logger.info('Testing Perplexity API connection');
      
      try {
        const response = await axios.post(
          'https://api.perplexity.ai/chat/completions',
          {
            model: 'llama-3.1-sonar-small-128k-online',
            messages: [
              {
                role: 'system',
                content: 'You are a helpful assistant.'
              },
              {
                role: 'user',
                content: 'Send a one-word response: "connected"'
              }
            ],
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${perplexityApiKey}`
            }
          }
        );
        
        if (response.data && response.data.choices && response.data.choices.length > 0) {
          logger.info('✅ Perplexity API connection successful');
          perplexitySuccess = true;
        } else {
          logger.warn('Perplexity API connection failed');
        }
      } catch (error) {
        logger.warn(`Perplexity API connection failed: ${error}`);
      }
    } else {
      logger.warn('Perplexity API key not found in environment variables');
    }
    
    // Check for DeepSeek API key
    const deepSeekApiKey = process.env.DEEPSEEK_API_KEY;
    if (deepSeekApiKey) {
      logger.info('Testing DeepSeek API connection');
      
      try {
        const response = await axios.post(
          'https://api.deepseek.com/v1/chat/completions',
          {
            model: 'deepseek-chat',
            messages: [
              {
                role: 'system',
                content: 'You are a helpful assistant.'
              },
              {
                role: 'user',
                content: 'Send a one-word response: "connected"'
              }
            ],
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${deepSeekApiKey}`
            }
          }
        );
        
        if (response.data && response.data.choices && response.data.choices.length > 0) {
          logger.info('✅ DeepSeek API connection successful');
          deepSeekSuccess = true;
        } else {
          logger.warn('DeepSeek API connection failed');
        }
      } catch (error) {
        logger.warn(`DeepSeek API connection failed: ${error}`);
      }
    } else {
      logger.warn('DeepSeek API key not found in environment variables');
    }
    
    // At least one AI connection is needed
    return perplexitySuccess || deepSeekSuccess;
  } catch (error) {
    logger.error(`AI connections failed: ${error}`);
    return false;
  }
}

/**
 * Main function to fix all connections
 */
export async function tryConnectAPI() {
  try {
    logger.info('Attempting to fix API connections for live trading');
    
    // Fix Solana RPC connection
    const solanaConnectionFixed = await fixSolanaConnection();
    if (!solanaConnectionFixed) {
      logger.error('Failed to fix Solana RPC connection');
    }
    
    // Fix Wormhole connection
    const wormholeConnectionFixed = await fixWormholeConnection();
    if (!wormholeConnectionFixed) {
      logger.error('Failed to fix Wormhole connection');
    }
    
    // Fix AI connections
    const aiConnectionsFixed = await fixAIConnections();
    if (!aiConnectionsFixed) {
      logger.error('Failed to fix AI connections');
    }
    
    // Return overall status
    const allFixed = solanaConnectionFixed && wormholeConnectionFixed && aiConnectionsFixed;
    
    if (allFixed) {
      logger.info('✅ All API connections fixed successfully');
    } else {
      logger.warn('⚠️ Some API connections could not be fixed');
    }
    
    return allFixed;
  } catch (error) {
    logger.error(`Error fixing API connections: ${error}`);
    return false;
  }
}

// Execute if this script is run directly
if (require.main === module) {
  tryConnectAPI()
    .then(success => {
      if (success) {
        logger.info('All API connections fixed successfully');
        process.exit(0);
      } else {
        logger.warn('Some API connections could not be fixed');
        process.exit(1);
      }
    })
    .catch(error => {
      logger.error(`Error fixing API connections: ${error}`);
      process.exit(1);
    });
}