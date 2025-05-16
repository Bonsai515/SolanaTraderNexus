/**
 * Initialize Nexus Transaction Engine
 * 
 * This module ensures the transaction engine is properly initialized
 * early in the application lifecycle to handle real blockchain transactions.
 */

import { getManagedConnection } from './lib/rpcConnectionManager';
import { getNexusEngine } from './nexus-transaction-engine';
import * as nexusIntegration from './nexus-integration';
import * as logger from './logger';

// Track initialization status
let isInitialized = false;

/**
 * Initialize the Nexus transaction engine
 */
export async function initializeEngine(): Promise<boolean> {
  if (isInitialized) {
    logger.info('[InitEngine] Transaction engine already initialized');
    return true;
  }
  
  try {
    logger.info('[InitEngine] Initializing Nexus transaction engine for real blockchain trading');
    
    // Get an optimized connection
    const connection = getManagedConnection({
      commitment: 'confirmed'
    });
    
    // Initialize transaction engine through nexus-integration
    const success = await nexusIntegration.initializeTransactionEngine();
    
    if (!success) {
      throw new Error('Failed to initialize Nexus transaction engine');
    }
    
    // Check if engine is properly initialized
    const engine = getNexusEngine();
    
    if (!engine) {
      throw new Error('Nexus engine instance not created');
    }
    
    logger.info('[InitEngine] Nexus transaction engine successfully initialized for real trading');
    
    isInitialized = true;
    return true;
  } catch (error) {
    logger.error('[InitEngine] Error initializing Nexus transaction engine:', error);
    return false;
  }
}

/**
 * Check if the engine is initialized
 */
export function isEngineInitialized(): boolean {
  return isInitialized;
}

/**
 * Reset the engine initialization status
 */
export function resetInitializationStatus(): void {
  isInitialized = false;
  logger.info('[InitEngine] Reset initialization status');
}

// Initialize immediately if this module is imported
initializeEngine().catch(error => {
  logger.error('[InitEngine] Failed to initialize engine on import:', error);
});