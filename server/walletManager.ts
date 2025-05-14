/**
 * Wallet Manager Module
 * 
 * This module handles wallet configuration, registration, and profit routing
 * for the trading system. It ensures proper wallet setup for trading, fee payments,
 * and profit collection.
 */

import * as logger from './logger';
import { nexusEngine } from './nexus-transaction-engine';
import { PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// Define wallet configuration type
export interface WalletConfig {
  tradingWallet: string;
  profitWallet: string;
  feeWallet?: string;
  profitReinvestmentRatio: number; // 0-1, e.g., 0.95 for 95%
  profitCollectionThreshold: number; // In USD
}

// Get wallet information directly from Nexus engine
function getNexusMainWallet(): string | null {
  try {
    const mainWallet = nexusEngine.getMainWalletAddress();
    logger.info(`Retrieved main trading wallet from Nexus engine: ${mainWallet.substring(0, 6)}...${mainWallet.substring(mainWallet.length - 4)}`);
    return mainWallet;
  } catch (error) {
    logger.error('Failed to get main wallet address from Nexus engine:', error);
    return null;
  }
}

function getNexusSecondaryWallet(): string | null {
  try {
    const secondaryWallet = nexusEngine.getSecondaryWalletAddress();
    logger.info(`Retrieved secondary wallet from Nexus engine: ${secondaryWallet.substring(0, 6)}...${secondaryWallet.substring(secondaryWallet.length - 4)}`);
    return secondaryWallet;
  } catch (error) {
    logger.error('Failed to get secondary wallet address from Nexus engine:', error);
    return null;
  }
}

function getNexusProphetWallet(): string | null {
  try {
    const prophetWallet = nexusEngine.getProphetWalletAddress();
    logger.info(`Retrieved prophet wallet from Nexus engine: ${prophetWallet.substring(0, 6)}...${prophetWallet.substring(prophetWallet.length - 4)}`);
    return prophetWallet;
  } catch (error) {
    logger.error('Failed to get prophet wallet address from Nexus engine:', error);
    return null;
  }
}

// Default wallet configuration with Nexus engine integration
const defaultWalletConfig: WalletConfig = {
  tradingWallet: getNexusMainWallet() || '', // Get from Nexus engine
  feeWallet: getNexusSecondaryWallet() || '', // Optional secondary wallet for fee payments
  profitWallet: getNexusProphetWallet() || '', // Prophet wallet for profit collection
  profitReinvestmentRatio: 0.95, // 95% profit reinvestment by default
  profitCollectionThreshold: 100 // $100 USD
};

// Current wallet configuration
let currentWalletConfig: WalletConfig = { ...defaultWalletConfig };

/**
 * Configure wallets for the trading system
 * @param config Wallet configuration
 * @returns Success status and configuration
 */
export async function configureWallets(config: Partial<WalletConfig>): Promise<{ success: boolean; config: WalletConfig }> {
  try {
    logger.info('Configuring wallets for trading system');

    // Merge with current config
    currentWalletConfig = {
      ...currentWalletConfig,
      ...config
    };

    // Validate trading wallet
    if (!currentWalletConfig.tradingWallet) {
      throw new Error('Trading wallet address is required');
    }

    // Validate profit wallet
    if (!currentWalletConfig.profitWallet) {
      throw new Error('Profit wallet address is required');
    }

    // Validate wallet addresses
    validateSolanaAddress(currentWalletConfig.tradingWallet);
    validateSolanaAddress(currentWalletConfig.profitWallet);
    
    if (currentWalletConfig.feeWallet) {
      validateSolanaAddress(currentWalletConfig.feeWallet);
    }

    // Register the trading wallet with the Nexus engine
    const registrationResult = await nexusEngine.registerWallet(currentWalletConfig.tradingWallet);
    
    if (!registrationResult) {
      throw new Error('Failed to register trading wallet with Nexus engine');
    }

    // Configure profit distribution settings
    const profitConfigResult = await nexusEngine.configureProfitDistribution({
      reinvestmentRatio: currentWalletConfig.profitReinvestmentRatio,
      profitCollectionWallet: currentWalletConfig.profitWallet,
      profitCollectionEnabled: true,
      profitCollectionThresholdUsd: currentWalletConfig.profitCollectionThreshold
    });

    if (!profitConfigResult) {
      throw new Error('Failed to configure profit distribution settings');
    }
    
    // Save configuration to disk for persistence
    saveWalletConfig(currentWalletConfig);

    logger.info(`Wallets configured successfully. Trading: ${currentWalletConfig.tradingWallet.substring(0, 6)}...${currentWalletConfig.tradingWallet.substring(currentWalletConfig.tradingWallet.length - 4)}`);
    logger.info(`Profit collection: ${currentWalletConfig.profitWallet.substring(0, 6)}...${currentWalletConfig.profitWallet.substring(currentWalletConfig.profitWallet.length - 4)}`);
    logger.info(`Profit split: ${currentWalletConfig.profitReinvestmentRatio * 100}% reinvestment, ${(1 - currentWalletConfig.profitReinvestmentRatio) * 100}% collection`);

    return {
      success: true,
      config: currentWalletConfig
    };
  } catch (error) {
    logger.error('Error configuring wallets:', error);
    return {
      success: false,
      config: currentWalletConfig
    };
  }
}

/**
 * Get current wallet configuration
 * @returns Current wallet configuration
 */
export function getWalletConfig(): WalletConfig {
  return { ...currentWalletConfig };
}

/**
 * Load wallet configuration from disk if available
 * @returns Loaded wallet configuration
 */
export function loadWalletConfig(): WalletConfig {
  try {
    const configPath = path.join(process.cwd(), 'data', 'wallet_config.json');
    
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf-8');
      const loadedConfig = JSON.parse(configData);
      
      // Update current config
      currentWalletConfig = {
        ...defaultWalletConfig,
        ...loadedConfig
      };
      
      logger.info('Loaded wallet configuration from disk');
      
      // Register with engine
      if (currentWalletConfig.tradingWallet) {
        nexusEngine.registerWallet(currentWalletConfig.tradingWallet);
      }
      
      // Configure profit distribution
      if (currentWalletConfig.profitWallet) {
        nexusEngine.configureProfitDistribution({
          reinvestmentRatio: currentWalletConfig.profitReinvestmentRatio,
          profitCollectionWallet: currentWalletConfig.profitWallet,
          profitCollectionEnabled: true,
          profitCollectionThresholdUsd: currentWalletConfig.profitCollectionThreshold
        });
      }
    }
  } catch (error) {
    logger.error('Error loading wallet configuration:', error);
  }
  
  return { ...currentWalletConfig };
}

/**
 * Save wallet configuration to disk
 * @param config Wallet configuration to save
 */
function saveWalletConfig(config: WalletConfig): void {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    
    // Create data directory if it doesn't exist
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const configPath = path.join(dataDir, 'wallet_config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    
    logger.info('Saved wallet configuration to disk');
  } catch (error) {
    logger.error('Error saving wallet configuration:', error);
  }
}

/**
 * Validate a Solana address
 * @param address Solana address to validate
 */
function validateSolanaAddress(address: string): void {
  try {
    new PublicKey(address);
  } catch (error) {
    throw new Error(`Invalid Solana address: ${address}`);
  }
}

/**
 * Export wallet private keys in a format compatible with Phantom wallet
 * @returns Object with wallet keys
 */
export function exportWalletPrivateKeys(): { 
  tradingWallet: { publicKey: string, privateKey: string }, 
  profitWallet: { publicKey: string, privateKey: string }
} {
  try {
    logger.info('Exporting wallet private keys for external use');
    
    // Get private keys from Nexus engine
    const tradingWalletKey = nexusEngine.exportWalletPrivateKey(currentWalletConfig.tradingWallet);
    const profitWalletKey = nexusEngine.exportWalletPrivateKey(currentWalletConfig.profitWallet);
    
    logger.info('Successfully exported wallet private keys');
    
    return {
      tradingWallet: {
        publicKey: currentWalletConfig.tradingWallet,
        privateKey: tradingWalletKey
      },
      profitWallet: {
        publicKey: currentWalletConfig.profitWallet,
        privateKey: profitWalletKey
      }
    };
  } catch (error) {
    logger.error('Error exporting wallet private keys:', error);
    throw new Error('Failed to export wallet private keys');
  }
}

/**
 * Get all wallet addresses and balances
 * @returns Object with wallets and their balances
 */
export async function getAllWalletBalances(): Promise<any> {
  try {
    logger.info('Retrieving all wallet balances');
    
    const balances = await nexusEngine.getWalletBalances([
      currentWalletConfig.tradingWallet,
      currentWalletConfig.profitWallet,
      ...(currentWalletConfig.feeWallet ? [currentWalletConfig.feeWallet] : [])
    ]);
    
    logger.info('Successfully retrieved wallet balances');
    
    return balances;
  } catch (error) {
    logger.error('Error retrieving wallet balances:', error);
    throw new Error('Failed to retrieve wallet balances');
  }
}

// Initialize by trying to load existing configuration
loadWalletConfig();