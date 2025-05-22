/**
 * On-Chain Program Integration Helper
 * 
 * This module integrates native Solana programs with the
 * Nexus trading engine for maximum performance.
 */

import { onchainUtils } from './onchain_utils';
import { jupiterIntegration } from './jupiter_integration';
import { jitoMEVProtection } from './jito_mev_protection';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const CONFIG_DIR = '../config';
const LOG_PATH = './program_integration.log';

// Log function
function log(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_PATH, logMessage + '\n');
}

// Initialize logs
if (!fs.existsSync(LOG_PATH)) {
  fs.writeFileSync(LOG_PATH, '--- PROGRAM INTEGRATION LOG ---\n');
}

/**
 * Initialize all on-chain program integrations
 */
export function initializeOnChainPrograms(): void {
  log('Initializing on-chain program integrations...');
  
  try {
    // Initialize onchain utilities
    onchainUtils.initOnchainUtils();
    log('✅ Initialized on-chain utilities');
    
    // Initialize Jupiter integration
    jupiterIntegration.initJupiterIntegration();
    log('✅ Initialized Jupiter integration');
    
    // Initialize Jito MEV protection
    jitoMEVProtection.initJitoMEVProtection();
    log('✅ Initialized Jito MEV protection');
    
    // Load program configuration
    const configPath = path.join(CONFIG_DIR, 'onchain_programs.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      // Log enabled programs
      const enabledPrograms = Object.entries(config.enabledPrograms)
        .filter(([_, enabled]) => enabled)
        .map(([name]) => name);
      
      log(`Enabled programs: ${enabledPrograms.join(', ')}`);
      
      // Log program integration settings
      if (config.programIntegration) {
        log(`Direct execution: ${config.programIntegration.directExecution}`);
        log(`Batched transactions: ${config.programIntegration.batchedTransactions}`);
        log(`Priority fees: ${config.programIntegration.priorityFees}`);
        log(`Lookup tables: ${config.programIntegration.lookupTables}`);
        log(`Versioned transactions: ${config.programIntegration.versionedTransactions}`);
      }
    } else {
      log('⚠️ On-chain program configuration not found');
    }
    
    log('All on-chain program integrations initialized successfully!');
  } catch (error) {
    log(`Error initializing on-chain programs: ${(error as Error).message}`);
  }
}

/**
 * Expose the program utilities
 */
export const programUtils = {
  onchainUtils,
  jupiterIntegration,
  jitoMEVProtection,
  initialize: initializeOnChainPrograms
};
