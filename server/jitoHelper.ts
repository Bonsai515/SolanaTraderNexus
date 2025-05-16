/**
 * Jito Bundle Helper
 * 
 * This module provides a simplified interface to use Jito bundles
 * for MEV protection and optimized transaction execution.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { initializeJitoBundle, isJitoBundleAvailable, createProtectedTransaction, executeAsBundle } from './jito';
import * as fs from 'fs';
import * as path from 'path';

// Constants
const CONFIG_DIR = './config';
const JITO_CONFIG_PATH = path.join(CONFIG_DIR, 'jito.json');

/**
 * Initialize Jito bundle support
 */
export function initializeJitoBundles(connection: Connection): boolean {
  try {
    console.log('[JitoHelper] Initializing Jito bundle support...');
    
    // Initialize the Jito bundle service
    initializeJitoBundle(connection);
    
    // Check if Jito is available
    const available = isJitoBundleAvailable();
    
    if (available) {
      console.log('[JitoHelper] Jito bundle support initialized successfully');
    } else {
      console.warn('[JitoHelper] Jito bundle service not available');
    }
    
    return available;
  } catch (error) {
    console.error('[JitoHelper] Error initializing Jito bundle support:', error);
    return false;
  }
}

/**
 * Execute a transaction with MEV protection
 */
export async function executeProtectedTransaction(
  instructions: any[],
  feePayer: string,
  signers: any[],
  priorityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' | 'MAXIMUM' = 'MEDIUM'
): Promise<string | null> {
  try {
    console.log(`[JitoHelper] Executing protected transaction with ${priorityLevel} priority`);
    
    // Check if Jito is available
    if (!isJitoBundleAvailable()) {
      console.warn('[JitoHelper] Jito bundle service not available, using regular execution');
      // In a real implementation, this would call your regular execution method
      return null;
    }
    
    // Create protected transaction
    const transaction = await createProtectedTransaction(
      instructions,
      new PublicKey(feePayer),
      priorityLevel
    );
    
    // Execute as a bundle
    const signature = await executeAsBundle(transaction, signers);
    
    console.log(`[JitoHelper] Protected transaction executed: ${signature}`);
    
    return signature;
  } catch (error) {
    console.error('[JitoHelper] Error executing protected transaction:', error);
    return null;
  }
}

/**
 * Check if Jito bundle support is available
 */
export function isJitoAvailable(): boolean {
  return isJitoBundleAvailable();
}