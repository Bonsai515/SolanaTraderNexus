import { Connection, clusterApiUrl, Commitment } from '@solana/web3.js';

/**
 * Creates and returns a connection to the Solana blockchain
 * Prioritizes Helius RPC, then Instant Nodes, then falls back to public endpoints
 */
export function getSolanaConnection(
  commitment: Commitment = 'confirmed'
): Connection {
  // Try Helius RPC first
  const heliusApiKey = import.meta.env.VITE_HELIUS_API_KEY || process.env.HELIUS_API_KEY;
  if (heliusApiKey) {
    try {
      const heliusRpcUrl = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;
      console.log('Using Helius RPC endpoint');
      return new Connection(heliusRpcUrl, {
        commitment,
        confirmTransactionInitialTimeout: 60000, // 60 seconds
      });
    } catch (error) {
      console.warn('Failed to connect to Helius RPC. Falling back to InstantNodes.', error);
    }
  }
  
  // Next try InstantNodes RPC
  const instantNodesRpcUrl = import.meta.env.VITE_INSTANT_NODES_RPC_URL || process.env.INSTANT_NODES_RPC_URL;
  const instantNodesWsUrl = import.meta.env.VITE_INSTANT_NODES_WS_URL || process.env.INSTANT_NODES_WS_URL;
  
  if (instantNodesRpcUrl) {
    console.log('Using InstantNodes RPC endpoint');
    return new Connection(instantNodesRpcUrl, {
      commitment,
      wsEndpoint: instantNodesWsUrl,
      confirmTransactionInitialTimeout: 60000, // 60 seconds
    });
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
  const instantNodesWsUrl = import.meta.env.VITE_INSTANT_NODES_WS_URL || process.env.INSTANT_NODES_WS_URL;
  
  if (instantNodesWsUrl) {
    return instantNodesWsUrl;
  }
  
  // Fallback to public websocket endpoints
  console.warn('No custom WebSocket URL provided. Using public endpoint with rate limits.');
  return 'wss://api.mainnet-beta.solana.com';
}