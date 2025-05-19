/**
 * Custom Syndica RPC Connection
 * 
 * This module provides a custom connection to Syndica RPC that uses header-based authentication.
 */

import { Connection, ConnectionConfig } from '@solana/web3.js';
import fetch from 'node-fetch';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './.env.trading' });

// Get Syndica configuration
const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY || '';
const SYNDICA_RPC_URL = process.env.SYNDICA_RPC_URL || 'https://solana-mainnet.api.syndica.io/';
const USE_HEADER_AUTH = process.env.SYNDICA_USE_HEADER_AUTH === 'true';

/**
 * Create a Solana Connection to Syndica RPC with proper authentication
 */
export function getSyndicaConnection(commitmentOrConfig?: string | ConnectionConfig): Connection {
  // If using header authentication, we need to use a custom fetch function
  if (USE_HEADER_AUTH && SYNDICA_API_KEY) {
    const fetchWithAuth = async (url: string, init?: RequestInit): Promise<Response> => {
      // Add the Syndica API key to the headers
      const headers = {
        ...init?.headers,
        'X-Syndica-Api-Key': SYNDICA_API_KEY,
      };
      
      // Make the request with the updated headers
      return fetch(url, {
        ...init,
        headers,
      });
    };
    
    // Create a connection with the custom fetch function
    return new Connection(SYNDICA_RPC_URL, {
      commitment: typeof commitmentOrConfig === 'string' ? commitmentOrConfig : commitmentOrConfig?.commitment || 'confirmed',
      fetch: fetchWithAuth as any,
    });
  }
  
  // If not using header authentication, create a regular connection
  return new Connection(SYNDICA_RPC_URL, commitmentOrConfig || 'confirmed');
}

/**
 * Test the Syndica connection to verify it's working
 */
export async function testSyndicaConnection(): Promise<boolean> {
  try {
    console.log('Testing Syndica RPC connection...');
    const connection = getSyndicaConnection();
    
    // Try to get the block height
    const blockHeight = await connection.getSlot();
    console.log(`✅ Syndica connection successful! Current block height: ${blockHeight}`);
    
    // Try to get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    console.log(`✅ Got recent blockhash: ${blockhash}`);
    
    return true;
  } catch (error) {
    console.error('❌ Syndica connection test failed:', error);
    return false;
  }
}

// If this module is run directly, test the connection
if (require.main === module) {
  testSyndicaConnection()
    .then((success) => {
      if (!success) {
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}