/**
 * Ensure RPC Connection to Solana
 *
 * This module ensures a stable and reliable connection to Solana RPC nodes,
 * with advanced rate limiting and fallback capabilities.
 * 
 * IMPORTANT: This file now uses the rpcConnectionManager, which has improved
 * rate limiting with exponential backoff and intelligent connection rotation.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { logger } from '../logger';
import * as rpcConnectionManager from './rpcConnectionManager';

/**
 * Initialize and verify Solana RPC connection
 */
export async function initializeRpcConnection(): Promise<Connection> {
  logger.info('Initializing Solana RPC connection with advanced rate limiting...');
  
  try {
    // Initialize RPC connections through the manager
    await rpcConnectionManager.getRpcConnection();
    logger.info('Successfully connected to Solana RPC node with intelligent rate limiting.');
    return await rpcConnectionManager.getRpcConnection();
  } catch (error) {
    logger.error('Failed to initialize any Solana RPC connection:', error);
    throw error;
  }
}

/**
 * Get current Solana connection with rate limiting
 */
export function getSolanaConnection(): Connection {
  try {
    return rpcConnectionManager.getRpcConnection();
  } catch (error) {
    logger.error('Error getting Solana connection:', error);
    throw error;
  }
}

/**
 * Check if wallet exists and has SOL
 */
export async function verifyWalletConnection(walletAddress: string): Promise<boolean> {
  try {
    const pubkey = new PublicKey(walletAddress);
    
    // Use the rate-limited connection manager to get wallet info
    const balance = await rpcConnectionManager.getBalance(pubkey);
    const exists = balance > 0;
    
    logger.info(`Wallet ${walletAddress} exists: ${exists}, balance: ${balance / 1e9} SOL`);
    
    return exists;
  } catch (error) {
    logger.error(`Failed to verify wallet ${walletAddress}:`, error);
    return false;
  }
}

// Initialize on module load
initializeRpcConnection().catch(err => {
  logger.error('Failed to initialize any Solana RPC connection:', err);
});