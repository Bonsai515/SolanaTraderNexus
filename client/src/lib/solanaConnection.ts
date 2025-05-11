import { Connection, clusterApiUrl, Commitment } from '@solana/web3.js';

/**
 * Creates and returns a connection to the Solana blockchain
 * Prioritizes Helius RPC, then Instant Nodes, then falls back to public endpoints
 */
export function getSolanaConnection(
  commitment: Commitment = 'confirmed'
): Connection {
  // Try Helius RPC first
  try {
    // Safely access environment variables
    const env = import.meta.env || {};
    const heliusApiKey = env.VITE_HELIUS_API_KEY || (typeof process !== 'undefined' && process.env ? process.env.HELIUS_API_KEY : '');
    
    if (heliusApiKey && heliusApiKey.length > 10) {
      const heliusRpcUrl = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;
      console.log('Using Helius RPC endpoint');
      return new Connection(heliusRpcUrl, {
        commitment,
        confirmTransactionInitialTimeout: 60000, // 60 seconds
      });
    }
  } catch (error) {
    console.warn('Failed to connect to Helius RPC. Falling back to InstantNodes.', error);
  }
  
  // Next try InstantNodes RPC
  try {
    const env = import.meta.env || {};
    const instantNodesRpcUrl = env.VITE_INSTANT_NODES_RPC_URL || 
      (typeof process !== 'undefined' && process.env ? process.env.INSTANT_NODES_RPC_URL : '');
    const instantNodesWsUrl = env.VITE_INSTANT_NODES_WS_URL || 
      (typeof process !== 'undefined' && process.env ? process.env.INSTANT_NODES_WS_URL : '');
    
    // Always use the hardcoded InstantNodes URL for 2-day trial
    const trialInstantNodesRpcUrl = 'https://solana-grpc-geyser.instantnodes.io:443';
    const trialInstantNodesWsUrl = 'wss://solana-api.instantnodes.io/token-NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9';
    console.log('Using InstantNodes trial RPC endpoint with WebSocket');
    return new Connection(trialInstantNodesRpcUrl, {
      commitment,
      wsEndpoint: trialInstantNodesWsUrl,
      confirmTransactionInitialTimeout: 60000, // 60 seconds
    });
  } catch (error) {
    console.warn('Failed to connect to InstantNodes RPC. Falling back to public endpoint.', error);
  }
  
  // Fallback to public endpoints
  console.warn('No custom RPC URL provided. Using public endpoint with rate limits.');
  return new Connection(clusterApiUrl('mainnet-beta'), { 
    commitment,
    confirmTransactionInitialTimeout: 60000, // 60 seconds
  });
}

/**
 * Get the appropriate WebSocket endpoint for real-time updates
 * Prioritizes InstantNodes, then falls back to public endpoints
 */
export function getSolanaWebSocketUrl(): string {
  try {
    const env = import.meta.env || {};
    const instantNodesWsUrl = env.VITE_INSTANT_NODES_WS_URL || 
      (typeof process !== 'undefined' && process.env ? process.env.INSTANT_NODES_WS_URL : '');
    
    if (instantNodesWsUrl && instantNodesWsUrl.length > 10) {
      return instantNodesWsUrl;
    }
  } catch (error) {
    console.warn('Error accessing WebSocket URL from environment variables', error);
  }
  
  // Fallback to public websocket endpoints
  console.warn('No custom WebSocket URL provided. Using public endpoint with rate limits.');
  return 'wss://api.mainnet-beta.solana.com';
}