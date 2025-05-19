/**
 * Syndica Connection Factory
 * 
 * This module provides a factory for creating properly configured Syndica connections
 * using the correct URL format and authentication method.
 */

import { Connection, ConnectionConfig, Commitment } from '@solana/web3.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.trading' });

// Constants
const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY || 'q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const SYNDICA_URL = `https://solana-mainnet.api.syndica.io/api-key/${SYNDICA_API_KEY}`;

/**
 * Create a Solana connection with Syndica using the correct URL format
 */
export function createSyndicaConnection(commitment: Commitment = 'confirmed'): Connection {
  const config: ConnectionConfig = {
    commitment,
    confirmTransactionInitialTimeout: 60000
  };
  
  return new Connection(SYNDICA_URL, config);
}

/**
 * Get optimal connection based on environment settings
 */
export function getOptimalConnection(commitment: Commitment = 'confirmed'): Connection {
  // If Syndica is the primary provider, use it
  if (process.env.PRIMARY_RPC_PROVIDER === 'syndica') {
    return createSyndicaConnection(commitment);
  }
  
  // Otherwise use Helius
  const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
  const HELIUS_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
  
  return new Connection(HELIUS_URL, {
    commitment,
    confirmTransactionInitialTimeout: 60000
  });
}