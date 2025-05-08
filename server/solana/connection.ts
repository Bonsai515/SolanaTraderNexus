import { Connection } from '@solana/web3.js';

/**
 * Creates a connection to the Solana blockchain.
 * In a production environment, this would use a clustered approach with fallbacks.
 */
export function createSolanaConnection(): Connection {
  // Use environment variable for the RPC endpoint with a fallback
  const endpoint = process.env.SOLANA_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
  
  try {
    // Create connection with commitment level of 'confirmed' for faster confirmations
    const connection = new Connection(endpoint, 'confirmed');
    console.log(`Connected to Solana at ${endpoint}`);
    return connection;
  } catch (error) {
    console.error('Error connecting to Solana network:', error);
    throw new Error('Failed to establish Solana connection');
  }
}

/**
 * Monitor the health of the Solana connection.
 * This function can be used to periodically check connection status.
 */
export async function monitorConnectionHealth(connection: Connection): Promise<boolean> {
  try {
    // Fetch the recent block height as a simple health check
    const blockHeight = await connection.getBlockHeight();
    console.log(`Solana connection healthy, current block height: ${blockHeight}`);
    return true;
  } catch (error) {
    console.error('Solana connection health check failed:', error);
    return false;
  }
}
