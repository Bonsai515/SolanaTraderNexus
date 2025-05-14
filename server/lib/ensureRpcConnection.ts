/**
 * RPC Connection Initialization with Robust Fallback
 * 
 * This module ensures the Solana RPC connection is established
 * and remains active, with automatic fallback capabilities.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import * as logger from '../logger';
import axios from 'axios';
const SOLSCAN_API_BASE = 'https://api.solscan.io';

// Initialize the Solana connection with fallback capabilities
export async function initializeRpcConnection(): Promise<Connection> {
  logger.info('Initializing Solana RPC connection with auto-fallback...');
  
  // Try different RPC endpoints in order of preference
  const endpoints = [
    {
      name: 'Helius',
      url: process.env.HELIUS_API_KEY ? 
        `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}` : '',
      priority: 1
    },
    {
      name: 'Alchemy', 
      url: process.env.ALCHEMY_RPC_URL || '',
      priority: 2
    },
    {
      name: 'Instant Nodes',
      url: process.env.INSTANT_NODES_RPC_URL || '',
      priority: 3
    },
    {
      name: 'Solana Public RPC',
      url: 'https://api.mainnet-beta.solana.com',
      priority: 4
    }
  ].filter(endpoint => endpoint.url); // Filter out empty URLs
  
  // Sort by priority
  endpoints.sort((a, b) => a.priority - b.priority);
  
  let connection: Connection | null = null;
  let connectionError: Error | null = null;
  
  // Try each endpoint
  for (const endpoint of endpoints) {
    try {
      logger.info(`Attempting to connect to ${endpoint.name} RPC endpoint...`);
      connection = new Connection(endpoint.url, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000
      });
      
      // Test the connection
      const version = await connection.getVersion();
      logger.info(`✅ Connected to ${endpoint.name} RPC endpoint (Solana version ${version['solana-core']}))`);
      
      // Connection successful
      break;
    } catch (error: any) {
      logger.error(`Failed to connect to ${endpoint.name} RPC endpoint: ${error.message || String(error)}`);
      connectionError = error;
      connection = null;
    }
  }
  
  // If all endpoints failed, throw error
  if (!connection) {
    const errorMessage = 'Failed to connect to any Solana RPC endpoint';
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }
  
  // Return the successful connection
  return connection;
}

// Verify a wallet exists and has SOL balance
export async function verifyWalletConnection(walletAddress: string): Promise<boolean> {
  try {
    logger.info(`Verifying wallet ${walletAddress}...`);
    
    // First verify via Solscan (external source)
    try {
      const response = await axios.get(`${SOLSCAN_API_BASE}/account`, {
        params: { address: walletAddress },
        timeout: 5000
      });
      
      if (response.status === 200 && response.data) {
        const solBalance = response.data.lamports ? response.data.lamports / 1e9 : 0;
        logger.info(`Wallet verified via Solscan with ${solBalance} SOL balance`);
        return true;
      }
    } catch (error: any) {
      logger.warn(`Solscan verification failed: ${error.message || String(error)}`);
      // Continue to RPC verification
    }
    
    // Fallback to direct RPC verification
    try {
      const connection = await initializeRpcConnection();
      const publicKey = new PublicKey(walletAddress);
      const balance = await connection.getBalance(publicKey);
      
      const solBalance = balance / 1e9;
      logger.info(`Wallet verified via RPC with ${solBalance} SOL balance`);
      
      return solBalance > 0;
    } catch (error: any) {
      logger.error(`RPC wallet verification failed: ${error.message || String(error)}`);
      return false;
    }
  } catch (error: any) {
    logger.error(`Wallet verification failed: ${error.message || String(error)}`);
    return false;
  }
}

// Verify wallet balance
export async function verifyWalletBalance(walletAddress: string, connection: Connection): Promise<number> {
  try {
    const publicKey = new PublicKey(walletAddress);
    const balance = await connection.getBalance(publicKey);
    return balance / 1e9; // Convert lamports to SOL
  } catch (error: any) {
    logger.error(`Error checking wallet balance: ${error.message || String(error)}`);
    throw error;
  }
}