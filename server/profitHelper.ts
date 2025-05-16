/**
 * Profit Collection Helper
 * 
 * This module provides a simplified interface to interact with
 * the profit collection system.
 */

import { Connection } from '@solana/web3.js';
import { ProfitCollection } from './profit/collection';
import { getProfitAnalyticsForDashboard } from './profit/analytics';

// Singleton instance
let profitCollection: ProfitCollection | null = null;

/**
 * Initialize profit collection
 */
export function initializeProfitCollection(connection: Connection, walletAddress: string): ProfitCollection {
  if (!profitCollection) {
    profitCollection = new ProfitCollection(connection);
    profitCollection.initialize(walletAddress);
    console.log('[ProfitHelper] Profit collection initialized');
  }
  
  return profitCollection;
}

/**
 * Get profit collection
 */
export function getProfitCollection(): ProfitCollection | null {
  return profitCollection;
}

/**
 * Trigger a profit capture manually
 */
export async function triggerProfitCapture(): Promise<boolean> {
  if (!profitCollection) {
    console.error('[ProfitHelper] Profit collection not initialized');
    return false;
  }
  
  return profitCollection.captureProfit();
}

/**
 * Get profit collection status
 */
export function getProfitCollectionStatus(): any {
  if (!profitCollection) {
    return { initialized: false };
  }
  
  return profitCollection.getStatus();
}

/**
 * Get profit analytics for dashboard
 */
export function getProfitAnalytics(): any {
  return getProfitAnalyticsForDashboard();
}

/**
 * Reload profit collection configuration
 */
export function reloadProfitConfig(): void {
  if (!profitCollection) {
    console.error('[ProfitHelper] Profit collection not initialized');
    return;
  }
  
  profitCollection.reloadConfig();
}