/**
 * Solend Helper Module
 * 
 * This module provides utilities for integrating the Solend liquidator
 * with the main trading system.
 */

import { Connection, Keypair } from '@solana/web3.js';
import { SolendCore, LiquidationOpportunity } from './lending/solend-core';
import { nexusEngine } from './nexus-transaction-engine';
import * as logger from './logger';
import { withRateLimiting } from './lib/rpcRateLimiter';

// Global instances
let solendCore: SolendCore | null = null;
let liquidatorWallet: Keypair | null = null;
let monitoringInterval: NodeJS.Timeout | null = null;
const POLLING_INTERVAL_MS = 10000; // 10 seconds
const HEALTH_FACTOR_THRESHOLD = 1.05;

/**
 * Initialize the Solend liquidator with the given connection and wallet
 */
export function initializeSolendLiquidator(connection: Connection, wallet: Keypair): SolendCore {
  logger.info('[Solend] Initializing Solend liquidator with connection and wallet');
  
  if (solendCore) {
    logger.info('[Solend] Liquidator already initialized, returning existing instance');
    return solendCore;
  }
  
  // Create a new instance
  solendCore = new SolendCore(connection);
  liquidatorWallet = wallet;
  
  logger.info('[Solend] Solend liquidator initialized successfully');
  return solendCore;
}

/**
 * Start monitoring for liquidation opportunities
 */
export function startLiquidationMonitoring(intervalMs: number = POLLING_INTERVAL_MS): void {
  if (monitoringInterval) {
    logger.info('[Solend] Liquidation monitoring already started');
    return;
  }
  
  if (!solendCore) {
    logger.error('[Solend] Cannot start monitoring: Solend core not initialized');
    throw new Error('Solend core not initialized');
  }
  
  logger.info(`[Solend] Starting liquidation monitoring with ${intervalMs}ms interval`);
  
  // Start the monitoring loop
  monitoringInterval = setInterval(async () => {
    try {
      await monitorLiquidationOpportunities();
    } catch (error) {
      logger.error('[Solend] Error in liquidation monitoring:', error instanceof Error ? error.message : 'Unknown error');
    }
  }, intervalMs);
  
  logger.info('[Solend] Liquidation monitoring started successfully');
}

/**
 * Stop monitoring for liquidation opportunities
 */
export function stopLiquidationMonitoring(): void {
  if (!monitoringInterval) {
    logger.info('[Solend] Liquidation monitoring not started');
    return;
  }
  
  clearInterval(monitoringInterval);
  monitoringInterval = null;
  
  logger.info('[Solend] Liquidation monitoring stopped');
}

/**
 * Monitor for liquidation opportunities
 */
async function monitorLiquidationOpportunities(): Promise<void> {
  if (!solendCore || !liquidatorWallet) {
    logger.error('[Solend] Cannot monitor: Solend core or wallet not initialized');
    return;
  }
  
  // Use rate limiting to prevent 429 errors
  await withRateLimiting(async () => {
    logger.info('[Solend] Checking for unhealthy obligations...');
    
    // Get unhealthy obligations
    const unhealthyObligations = await solendCore.getUnhealthyObligations(HEALTH_FACTOR_THRESHOLD);
    
    if (unhealthyObligations.length === 0) {
      logger.info('[Solend] No unhealthy obligations found');
      return;
    }
    
    logger.info(`[Solend] Found ${unhealthyObligations.length} unhealthy obligations`);
    
    // Calculate liquidation opportunities
    const opportunities = solendCore.calculateLiquidationOpportunities(
      unhealthyObligations,
      HEALTH_FACTOR_THRESHOLD
    );
    
    if (opportunities.length === 0) {
      logger.info('[Solend] No profitable liquidation opportunities found');
      return;
    }
    
    logger.info(`[Solend] Found ${opportunities.length} liquidation opportunities`);
    
    // Sort by profit
    opportunities.sort((a, b) => b.profit - a.profit);
    
    // Execute top liquidations through Nexus engine
    await executeTopLiquidations(opportunities.slice(0, 3)); // Top 3 opportunities
  });
}

/**
 * Execute top liquidation opportunities
 */
async function executeTopLiquidations(opportunities: LiquidationOpportunity[]): Promise<void> {
  if (!solendCore || !liquidatorWallet) {
    logger.error('[Solend] Cannot execute: Solend core or wallet not initialized');
    return;
  }
  
  for (const opportunity of opportunities) {
    try {
      logger.info(`[Solend] Executing liquidation for obligation ${opportunity.obligation.id.toString()}`);
      logger.info(`[Solend] Opportunity details: repay ${opportunity.repayValue} ${opportunity.repaySymbol}, withdraw ${opportunity.withdrawValue} ${opportunity.withdrawSymbol}, profit: ${opportunity.profit} (${opportunity.profitPercent.toFixed(2)}%)`);
      
      // In a real implementation, this would execute the liquidation through the Nexus engine
      // For now, we'll simulate success
      
      // Get real signature from the Solend core
      const signature = await solendCore.executeLiquidation(liquidatorWallet, opportunity);
      
      if (signature) {
        logger.info(`[Solend] Liquidation successful: ${signature}`);
      } else {
        logger.warn(`[Solend] Liquidation failed, no signature returned`);
      }
    } catch (error) {
      logger.error('[Solend] Error executing liquidation:', error instanceof Error ? error.message : 'Unknown error');
    }
  }
}