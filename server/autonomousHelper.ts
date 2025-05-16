/**
 * Autonomous Trading Helper
 * 
 * This module provides a simplified interface to interact with
 * the autonomous trading system and manage trade execution.
 */

import * as fs from 'fs';
import * as path from 'path';
import { autonomousTrading } from './lib/autonomousTrading';
import { priceFeedCache } from './lib/priceFeedCache';

// Load configuration
const CONFIG_DIR = './server/config';
const AUTONOMOUS_CONFIG_PATH = path.join(CONFIG_DIR, 'autonomous.json');
const SAFETY_CONFIG_PATH = path.join(CONFIG_DIR, 'safety.json');

// Configuration caches
let autonomousConfig: any = {};
let safetyConfig: any = {};

// Load configurations
try {
  if (fs.existsSync(AUTONOMOUS_CONFIG_PATH)) {
    autonomousConfig = JSON.parse(fs.readFileSync(AUTONOMOUS_CONFIG_PATH, 'utf8'));
  }
  
  if (fs.existsSync(SAFETY_CONFIG_PATH)) {
    safetyConfig = JSON.parse(fs.readFileSync(SAFETY_CONFIG_PATH, 'utf8'));
  }
} catch (error) {
  console.error('Error loading configuration:', error);
}

/**
 * Initialize the autonomous trading helper
 */
export function initializeAutonomousTrading(connection: any, walletAddress: string): void {
  if (!autonomousTrading) {
    console.error('Autonomous trading module not available');
    return;
  }
  
  // Initialize autonomous trading with connection and wallet
  autonomousTrading.setConnection(connection);
  autonomousTrading.setWalletPublicKey(walletAddress);
  
  // Enable autonomous trading
  autonomousTrading.setEnabled(true);
  
  console.log(`Autonomous trading initialized with wallet: ${walletAddress}`);
  
  // Set up event listeners
  autonomousTrading.on('tradeExecuted', (signature, decision) => {
    console.log(`[Autonomous] Trade executed: ${signature} for ${decision.baseToken}`);
    // You can add custom logic here for trade notifications
  });
  
  autonomousTrading.on('statusChanged', (enabled) => {
    console.log(`[Autonomous] Status changed: ${enabled ? 'ENABLED' : 'DISABLED'}`);
  });
}

/**
 * Start autonomous trading mode
 */
export function startAutonomousTrading(): boolean {
  if (!autonomousTrading) {
    console.error('Autonomous trading module not available');
    return false;
  }
  
  autonomousTrading.setEnabled(true);
  console.log('[Autonomous] Trading mode STARTED');
  return true;
}

/**
 * Stop autonomous trading mode
 */
export function stopAutonomousTrading(): boolean {
  if (!autonomousTrading) {
    console.error('Autonomous trading module not available');
    return false;
  }
  
  autonomousTrading.setEnabled(false);
  console.log('[Autonomous] Trading mode STOPPED');
  return false;
}

/**
 * Get autonomous trading stats
 */
export function getAutonomousStats(): any {
  if (!autonomousTrading) {
    return { enabled: false, decisions: [], executions: [] };
  }
  
  return {
    enabled: autonomousTrading.isAutonomousEnabled(),
    decisions: autonomousTrading.getDecisions(),
    executions: autonomousTrading.getExecutions()
  };
}

/**
 * Check if a token is tradable based on safety config
 */
export function isTokenTradable(token: string): boolean {
  if (!safetyConfig?.tokenSafety?.whitelistedTokens) {
    return true; // Default to true if no whitelist
  }
  
  // Check if token is in whitelist
  const whitelist = safetyConfig.tokenSafety.whitelistedTokens;
  return whitelist.includes(token);
}

/**
 * Get current token price from cache
 */
export function getTokenPrice(token: string): number | null {
  if (!priceFeedCache) {
    return null;
  }
  
  return priceFeedCache.getPrice(token);
}