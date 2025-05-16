import { logger } from '../logger';

interface WormholeConfig {
  apiUrl: string;
  guardianRpcUrl: string;
  network: 'mainnet' | 'testnet';
  useDirectConnection: boolean;
}

// Get Wormhole configuration for cross-chain operations
export function getWormholeConfig(): WormholeConfig {
  const apiKey = process.env.WORMHOLE_API_KEY;
  const useApi = !!apiKey;
  
  if (!apiKey) {
    logger.warn('No Wormhole API key found, falling back to public Guardian RPCs');
  } else {
    logger.info('Using Wormhole API for cross-chain operations');
  }
  
  return {
    apiUrl: useApi 
      ? `https://api.wormholescan.io/v1?api_key=${apiKey}` 
      : 'https://api.wormholescan.io/v1',
    guardianRpcUrl: useApi 
      ? `https://api.wormhole.com/v1/guardians?api_key=${apiKey}` 
      : 'https://wormhole-v2-mainnet-api.certus.one',
    network: 'mainnet',
    useDirectConnection: !useApi
  };
}

// Connect to Wormhole network
export async function connectToWormhole(): Promise<boolean> {
  try {
    const config = getWormholeConfig();
    logger.info(`Connecting to Wormhole ${config.network}`);
    
    // If we have an API key, use it to test the connection
    if (config.apiUrl.includes('api_key')) {
      const testResponse = await fetch(`${config.apiUrl.split('?')[0]}/stats?api_key=${process.env.WORMHOLE_API_KEY}`);
      const success = testResponse.ok;
      
      if (success) {
        logger.info('✅ Connected to Wormhole API successfully');
      } else {
        logger.warn('⚠️ Failed to connect to Wormhole API, falling back to public endpoints');
      }
      
      return success;
    }
    
    // If using public endpoint, assume success but warn about rate limits
    logger.warn('Using public Wormhole endpoints with rate limits');
    return true;
  } catch (error: any) {
    logger.error('❌ Failed to connect to Wormhole:', error.message);
    return false;
  }
}