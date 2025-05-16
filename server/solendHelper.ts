/**
 * Solend Helper
 * 
 * This module provides a simplified interface to interact with
 * the Solend liquidator system.
 */

import { Connection, Keypair } from '@solana/web3.js';
import { SolendLiquidator } from './lending/liquidator';
import * as logger from './logger';

// Singleton instance
let solendLiquidator: SolendLiquidator | null = null;

/**
 * Initialize Solend liquidator
 */
export function initializeSolendLiquidator(connection: Connection, wallet: Keypair): SolendLiquidator {
  if (!solendLiquidator) {
    solendLiquidator = new SolendLiquidator(connection);
    solendLiquidator.initialize(wallet);
    logger.info('[SolendHelper] Solend liquidator initialized');
  }
  
  return solendLiquidator;
}

/**
 * Get the Solend liquidator
 */
export function getSolendLiquidator(): SolendLiquidator | null {
  return solendLiquidator;
}

/**
 * Start monitoring for liquidation opportunities
 */
export function startLiquidationMonitoring(): void {
  if (!solendLiquidator) {
    throw new Error('Solend liquidator not initialized');
  }
  
  solendLiquidator.startMonitoring();
}

/**
 * Stop monitoring for liquidation opportunities
 */
export function stopLiquidationMonitoring(): void {
  if (!solendLiquidator) {
    throw new Error('Solend liquidator not initialized');
  }
  
  solendLiquidator.stopMonitoring();
}

/**
 * Get liquidation opportunities
 */
export function getLiquidationOpportunities(): any[] {
  if (!solendLiquidator) {
    throw new Error('Solend liquidator not initialized');
  }
  
  return solendLiquidator.getLiquidationOpportunities();
}

/**
 * Get liquidator status
 */
export function getLiquidatorStatus(): any {
  if (!solendLiquidator) {
    return { initialized: false };
  }
  
  return solendLiquidator.getStatus();
}