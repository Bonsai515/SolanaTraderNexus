/**
 * Wormhole Integration for Cross-Chain Operations
 * 
 * This module provides a TypeScript implementation for interacting with Wormhole
 * without requiring a dedicated API key, using default Guardian RPCs instead.
 */

import axios from 'axios';
import { logger } from '../logger';
// Define chain IDs directly
const CHAIN_ID_SOLANA = 1;
const CHAIN_ID_ETH = 2;
const CHAIN_ID_BSC = 4;

// Default Guardian RPC endpoints
const GUARDIAN_RPC_HOSTS = [
  'https://wormhole-v2-mainnet-api.certus.one',
  'https://wormhole.inotel.ro',
  'https://wormhole-v2-mainnet-api.mcf.rocks',
  'https://wormhole-v2-mainnet-api.chainlayer.network'
];

// Mapping of chain IDs to chain names
const CHAIN_NAMES: Record<number, string> = {
  1: 'Solana',
  2: 'Ethereum',
  4: 'BSC',
  5: 'Polygon',
  10: 'Avalanche',
  23: 'Arbitrum'
};

// Base URL for Guardian network
let currentRpcIndex = 0;
let baseUrl = GUARDIAN_RPC_HOSTS[currentRpcIndex];

/**
 * Switch to the next Guardian RPC if the current one is unavailable
 */
function switchGuardianRpc() {
  currentRpcIndex = (currentRpcIndex + 1) % GUARDIAN_RPC_HOSTS.length;
  baseUrl = GUARDIAN_RPC_HOSTS[currentRpcIndex];
  logger.info(`Switched to Guardian RPC: ${baseUrl}`);
}

/**
 * Check if Wormhole Guardian network is available
 * @returns True if Guardian network is available
 */
export async function checkWormholeConnection(): Promise<boolean> {
  try {
    // Try to get the current guardian set
    const response = await axios.get(`${baseUrl}/v1/guardianset/current`);
    
    if (response.data && response.data.guardianSet) {
      logger.info('✅ Wormhole Guardian network is available');
      return true;
    } else {
      logger.warn('Wormhole Guardian network check failed, trying another RPC...');
      switchGuardianRpc();
      return await checkWormholeConnection(); // Retry with new RPC
    }
  } catch (error) {
    logger.error(`Failed to connect to Wormhole Guardian network: ${error}`);
    switchGuardianRpc(); // Try another RPC
    
    // If we've gone through all RPCs, give up
    if (currentRpcIndex === 0) {
      logger.error('All Wormhole Guardian RPCs failed');
      return false;
    }
    
    return await checkWormholeConnection(); // Retry with new RPC
  }
}

/**
 * Get the VAA (Verified Action Approval) for a transaction
 * @param emitterChain The chain ID of the emitter
 * @param emitterAddress The address of the emitter
 * @param sequence The sequence number of the transaction
 * @returns The VAA as a base64 string
 */
export async function getVAA(emitterChain: number, emitterAddress: string, sequence: string): Promise<string | null> {
  try {
    const response = await axios.get(
      `${baseUrl}/v1/signed_vaa/${emitterChain}/${emitterAddress}/${sequence}`
    );
    
    if (response.data && response.data.vaaBytes) {
      return response.data.vaaBytes;
    } else {
      logger.error('Failed to get VAA: empty response');
      return null;
    }
  } catch (error) {
    logger.error(`Failed to get VAA: ${error}`);
    switchGuardianRpc();
    return null;
  }
}

/**
 * Track a cross-chain transaction by signature
 * @param sourceChain The chain ID of the source chain
 * @param signature The transaction signature
 * @returns The transaction status
 */
export async function trackTransaction(sourceChain: number, signature: string): Promise<any> {
  try {
    // Convert chain ID to name for logging
    const chainName = CHAIN_NAMES[sourceChain] || `Chain ${sourceChain}`;
    logger.info(`Tracking ${chainName} transaction: ${signature}`);
    
    // Different chains have different tracking logic
    if (sourceChain === CHAIN_ID_SOLANA) {
      return await trackSolanaTransaction(signature);
    } else if (sourceChain === CHAIN_ID_ETH || sourceChain === CHAIN_ID_BSC) {
      return await trackEVMTransaction(sourceChain, signature);
    } else {
      logger.error(`Unsupported chain ID: ${sourceChain}`);
      return { status: 'error', message: 'Unsupported chain' };
    }
  } catch (error) {
    logger.error(`Failed to track transaction: ${error}`);
    return { status: 'error', message: String(error) };
  }
}

/**
 * Track a Solana transaction
 * @param signature The transaction signature
 * @returns The transaction status
 */
async function trackSolanaTransaction(signature: string): Promise<any> {
  try {
    // This would normally query Solana RPC, but we're just returning a placeholder
    logger.info(`Tracking Solana transaction: ${signature}`);
    
    // Placeholder for Solana transaction tracking
    return { 
      status: 'success', 
      chain: 'solana',
      signature, 
      timestamp: new Date().toISOString(),
      confirmations: 32
    };
  } catch (error) {
    logger.error(`Failed to track Solana transaction: ${error}`);
    return { status: 'error', message: String(error) };
  }
}

/**
 * Track an EVM transaction (Ethereum, BSC, etc.)
 * @param chainId The chain ID
 * @param txHash The transaction hash
 * @returns The transaction status
 */
async function trackEVMTransaction(chainId: number, txHash: string): Promise<any> {
  try {
    // This would normally query EVM RPC, but we're just returning a placeholder
    const chainName = CHAIN_NAMES[chainId] || `Chain ${chainId}`;
    logger.info(`Tracking ${chainName} transaction: ${txHash}`);
    
    // Placeholder for EVM transaction tracking
    return { 
      status: 'success', 
      chain: chainName.toLowerCase(),
      txHash, 
      timestamp: new Date().toISOString(),
      confirmations: 15
    };
  } catch (error) {
    logger.error(`Failed to track EVM transaction: ${error}`);
    return { status: 'error', message: String(error) };
  }
}

/**
 * Initialize the Wormhole connector
 * @returns True if initialization was successful
 */
export async function initializeWormholeConnector(): Promise<boolean> {
  try {
    // Check if API key is available
    if (process.env.WORMHOLE_API_KEY) {
      logger.info('Initializing Wormhole connector with API key');
      // Use API key for better rate limits and reliability
      baseUrl = 'https://api.wormholescan.io';
      return true;
    } else {
      logger.info('Initializing Wormhole connector with Guardian RPC network (fallback mode)');
      return await checkWormholeConnection();
    }
  } catch (error) {
    logger.error(`Failed to initialize Wormhole connector: ${error}`);
    return false;
  }
}

// Initialize when this module is loaded
initializeWormholeConnector().catch(error => {
  logger.error(`Wormhole connector initialization failed: ${error}`);
});