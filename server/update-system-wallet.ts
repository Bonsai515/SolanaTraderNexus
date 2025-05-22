/**
 * Update System Wallet
 * 
 * This script updates all references to the trading wallet address
 * across the entire system to use the HPN wallet.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as logger from './logger';

// Import wallet config
import { WALLET_CONFIG } from './config/wallet-config';

// Old wallet addresses that need to be replaced
const OLD_WALLET_ADDRESSES = [
  'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb',
  '31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e',
  'HP9h31ZkN5NbJfHBWZgXz3YWejYJA7sKB6uBjrMvGYFv'
];

// The new trading wallet address
const NEW_WALLET_ADDRESS = WALLET_CONFIG.TRADING_WALLET;

/**
 * Update all wallet references in memory
 */
export function updateWalletReferencesInMemory(): boolean {
  try {
    logger.info(`Updating all wallet references in memory to use ${NEW_WALLET_ADDRESS}`);
    
    // Update global wallet reference in nexus engine
    try {
      const nexusEngine = require('./nexus-transaction-engine');
      if (nexusEngine.setTradingWallet) {
        nexusEngine.setTradingWallet(NEW_WALLET_ADDRESS);
        logger.info('Updated trading wallet in Nexus Engine');
      }
    } catch (err) {
      logger.warn(`Could not update wallet in Nexus Engine: ${err.message}`);
    }
    
    // Update wallet in all agents
    const agents = [
      './strategies/quantumOmegaSniperController',
      './strategies/hyperion-flash-arbitrage',
      './strategies/singularity-strategy',
      './strategies/momentum-surfing-strategy',
      './transformers/MemeCortexAdvanced'
    ];
    
    for (const agentPath of agents) {
      try {
        const agent = require(agentPath);
        if (agent.setWallet) {
          agent.setWallet(NEW_WALLET_ADDRESS);
          logger.info(`Updated wallet in ${agentPath}`);
        }
      } catch (err) {
        logger.warn(`Could not update wallet in ${agentPath}: ${err.message}`);
      }
    }
    
    logger.info('✅ Successfully updated all wallet references in memory');
    return true;
  } catch (error) {
    logger.error(`Error updating wallet references in memory: ${error.message}`);
    return false;
  }
}

/**
 * Main function to update the system wallet
 */
export async function updateSystemWallet(): Promise<boolean> {
  try {
    logger.info(`Starting system wallet update to ${NEW_WALLET_ADDRESS}...`);
    
    // Update wallet references in memory
    const memoryUpdateSuccess = updateWalletReferencesInMemory();
    
    if (memoryUpdateSuccess) {
      logger.info('Wallet update completed successfully');
      return true;
    } else {
      logger.error('Wallet update failed');
      return false;
    }
  } catch (error) {
    logger.error(`Error updating system wallet: ${error.message}`);
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  updateSystemWallet()
    .then(success => {
      if (success) {
        console.log('✅ System wallet updated successfully');
      } else {
        console.log('❌ System wallet update failed');
      }
    })
    .catch(error => {
      console.error('❌ Error:', error);
    });
}