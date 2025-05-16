/**
 * Transaction Engine Adapter
 * 
 * This module provides an adapter for interfacing with the Nexus transaction engine
 * from various system components, particularly the SignalHub.
 */

import * as logger from './logger';
import { getNexusEngine } from './nexus-transaction-engine';
import { initializeEngine } from './init-transaction-engine';

let isInitialized = false;

/**
 * Initialize the engine adapter 
 */
export async function initializeAdapter(): Promise<boolean> {
  try {
    logger.info('[TransactionAdapter] Initializing transaction engine adapter');
    
    // Initialize the main engine
    const engineInitialized = await initializeEngine();
    
    if (!engineInitialized) {
      logger.error('[TransactionAdapter] Failed to initialize engine');
      return false;
    }
    
    isInitialized = true;
    logger.info('[TransactionAdapter] Transaction engine adapter initialized successfully');
    return true;
  } catch (error) {
    logger.error('[TransactionAdapter] Error initializing adapter:', error);
    return false;
  }
}

/**
 * Get the transaction engine instance
 */
export function getEngine() {
  try {
    // Check if engine is initialized
    if (!isInitialized) {
      // Try to initialize it if not
      logger.info('[TransactionAdapter] Engine not initialized, attempting initialization...');
      
      // Set initialization flag to prevent infinite recursion
      isInitialized = true;
      
      // Initialize in the background
      initializeEngine().catch(error => {
        logger.error('[TransactionAdapter] Background initialization failed:', error);
        isInitialized = false;
      });
    }
    
    // Get the engine instance
    const engine = getNexusEngine();
    
    if (!engine) {
      logger.error('[TransactionAdapter] Failed to get Nexus engine instance');
      return null;
    }
    
    return engine;
  } catch (error) {
    logger.error('[TransactionAdapter] Error getting engine:', error);
    return null;
  }
}

/**
 * Execute a swap transaction
 */
export async function executeSwap(params: {
  source: string;
  target: string;
  amount: number;
  slippageBps?: number;
}): Promise<{ success: boolean; signature?: string; error?: string }> {
  try {
    const engine = getEngine();
    
    if (!engine) {
      return { success: false, error: 'Transaction engine not available' };
    }
    
    logger.info(`[TransactionAdapter] Executing LIVE swap: ${params.amount} ${params.source} → ${params.target}`);
    
    return await engine.executeSwap(params);
  } catch (error) {
    logger.error('[TransactionAdapter] Error executing swap:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Check if the engine is initialized and ready
 */
export function isEngineReady(): boolean {
  // We'll consider the engine ready if we have an instance and the isInitialized flag is true
  return isInitialized && !!getEngine();
}

// Initialize the adapter on import
(async () => {
  try {
    await initializeAdapter();
  } catch (error) {
    logger.error('[TransactionAdapter] Error during auto-initialization:', error);
  }
})();