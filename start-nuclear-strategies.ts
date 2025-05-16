/**
 * Start Nuclear Strategies
 * 
 * Direct script to start nuclear strategies through the Nexus Professional Engine.
 * This script can be run independently to activate all nuclear strategies
 * for aggressive trading with real funds.
 */

console.log('🚀 Starting nuclear strategies activation process...');

// Import the logger to show more detailed output
import * as logger from './server/logger';
logger.info('Initializing nuclear strategies activation sequence');

// Import required modules for blockchain connectivity
import { initializeRpcConnection } from './server/lib/ensureRpcConnection';
logger.info('Establishing connection to Solana blockchain...');

// Step 1: Initialize blockchain connection
async function initAndStart() {
  try {
    // Initialize RPC connection
    logger.info('Connecting to Solana blockchain...');
    const connection = await initializeRpcConnection();
    logger.info('✅ Connected to Solana blockchain successfully');
    
    // Step 2: Import Nexus engine
    logger.info('Initializing Nexus Professional Engine...');
    const { getNexusEngine } = await import('./server/nexus-transaction-engine');
    const engine = getNexusEngine();
    if (!engine) {
      logger.error('❌ Nexus engine not available. Starting it now...');
      const { initializeNexusEngine } = await import('./server/nexus-transaction-engine');
      
      // Initialize with default config
      const defaultConfig = {
        useRealFunds: true,
        rpcUrl: process.env.ALCHEMY_RPC_URL || process.env.INSTANT_NODES_RPC_URL || 'https://api.mainnet-beta.solana.com',
        websocketUrl: process.env.ALCHEMY_WS_URL || process.env.INSTANT_NODES_WS_URL,
        defaultExecutionMode: 'LIVE',
        defaultPriority: 'HIGH',
        defaultConfirmations: 2,
        maxConcurrentTransactions: 5,
        defaultTimeoutMs: 60000,
        defaultMaxRetries: 3,
        maxSlippageBps: 50
      };
      
      await initializeNexusEngine(defaultConfig);
      logger.info('✅ Nexus Professional Engine initialized successfully');
    } else {
      logger.info('✅ Nexus Professional Engine already initialized');
    }
    
    // Step 3: Activate nuclear strategies
    logger.info('Activating nuclear strategies...');
    await import('./activate-nuclear-nexus');
    logger.info('✅ Nuclear strategies activation complete');
    
    logger.info('🚀 Nuclear strategies now running through Nexus Professional Engine');
    logger.info('💰 Starting to generate profits with trading wallet HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb');
    
  } catch (error) {
    logger.error('❌ Error during nuclear strategies activation:', 
      error instanceof Error ? error.message : String(error));
  }
}

// Execute the async function
initAndStart().catch(err => {
  logger.error('❌ Fatal error during nuclear strategies activation:', 
    err instanceof Error ? err.message : String(err));
});