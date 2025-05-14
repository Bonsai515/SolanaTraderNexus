/**
 * Test Real Market Trading on Solana Blockchain
 * 
 * This script tests the real market trading functionality of the Nexus Professional Engine.
 * It initializes the engine and executes a real SOL transfer on the Solana blockchain.
 * 
 * IMPORTANT: This script uses real funds. Make sure you understand the implications.
 */

import axios from 'axios';
import { logger } from './server/logger';

// Configuration for the test
const config = {
  // API base URL (localhost for testing)
  apiBaseUrl: 'http://localhost:3000',
  
  // Solana RPC URL (use environment variable if available)
  rpcUrl: process.env.INSTANT_NODES_RPC_URL || 'https://api.mainnet-beta.solana.com',
  
  // Path to the wallet keypair (replace with your actual wallet file)
  walletPath: './wallet-keypair.json',
  
  // Destination wallet address for test transfer
  destinationWallet: 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb', // System wallet for profit collection
  
  // Amount to transfer in SOL (small value for testing)
  amountSol: 0.001
};

// Make a request to the API
async function callAPI(method: string, endpoint: string, data: any = null): Promise<any> {
  try {
    const url = `${config.apiBaseUrl}${endpoint}`;
    const response = await axios({
      method,
      url,
      data
    });
    
    return response.data;
  } catch (error: any) {
    if (error.response) {
      throw new Error(`API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else {
      throw error;
    }
  }
}

// Initialize the transaction engine
async function initializeEngine(): Promise<boolean> {
  try {
    logger.info('Initializing Nexus Professional Engine for real market trading');
    
    const response = await callAPI('POST', '/api/engine/nexus/activate', {
      rpcUrl: config.rpcUrl,
      useRealFunds: true // We want to use real funds for this test
    });
    
    if (response.success) {
      logger.info('Nexus Professional Engine initialized successfully');
      return true;
    } else {
      logger.error('Failed to initialize Nexus Professional Engine:', response.message);
      return false;
    }
  } catch (error: any) {
    logger.error('Error initializing engine:', error.message);
    return false;
  }
}

// Execute a test transfer transaction
async function executeTestTransfer(): Promise<any> {
  try {
    logger.info(`Executing test transfer of ${config.amountSol} SOL to ${config.destinationWallet}`);
    
    const response = await callAPI('POST', '/api/solana/execute-transaction', {
      type: 'transfer',
      fromWalletPath: config.walletPath,
      toWallet: config.destinationWallet,
      amountSol: config.amountSol
    });
    
    if (response.success) {
      logger.info(`Transfer executed successfully with signature: ${response.signature}`);
      logger.info(`Verifying transaction: ${response.verified ? 'VERIFIED' : 'NOT VERIFIED'}`);
      logger.info(`Timestamp: ${response.timestamp}`);
      return response;
    } else {
      logger.error('Failed to execute transfer:', response.message);
      return response;
    }
  } catch (error: any) {
    logger.error('Error executing transfer:', error.message);
    throw error;
  }
}

// Main function to run the test
async function runTest(): Promise<void> {
  try {
    logger.info('--------------------------------------------------');
    logger.info('STARTING REAL MARKET TRADING TEST');
    logger.info('--------------------------------------------------');
    
    // Initialize the engine
    const initialized = await initializeEngine();
    
    if (!initialized) {
      logger.error('Cannot proceed with test, engine initialization failed');
      return;
    }
    
    // Get the engine status
    const status = await callAPI('GET', '/api/engine/status');
    logger.info('Engine status:', status);
    
    // Execute a test transfer
    const result = await executeTestTransfer();
    
    logger.info('--------------------------------------------------');
    logger.info('TEST COMPLETED');
    logger.info('--------------------------------------------------');
    
    if (result.success) {
      logger.info('RESULT: SUCCESS');
      logger.info(`Signature: ${result.signature}`);
      logger.info(`Verified: ${result.verified}`);
    } else {
      logger.info('RESULT: FAILURE');
      logger.info(`Error: ${result.error || result.message}`);
    }
    
    logger.info('--------------------------------------------------');
  } catch (error: any) {
    logger.error('Test failed with error:', error.message);
  }
}

// Run the test
runTest().catch(error => {
  logger.error('Unhandled error during test:', error);
});