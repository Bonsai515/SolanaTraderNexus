/**
 * Activate Live Trading with Real Funds
 * 
 * This script directly activates the transaction engine and ensures real 
 * blockchain transactions by fixing connection issues with Solana RPC.
 * 
 * It serves as the integration point between all system components:
 * - Nexus Transaction Engine
 * - Signal Hub for communication
 * - Trading Agents for market analysis
 * - Wallet Manager for fund management
 * - Transaction Verifier for validation
 * - Anchor Program for backup execution
 */

import * as logger from './logger';
import { nexusEngine } from './nexus-transaction-engine';
import { signalHub } from './signalHub';
import { getWalletConfig } from './walletManager';
import { initTransactionVerifier } from './transactionVerifier';
import { initAnchorConnector } from './anchorProgramConnector';
import * as agents from './agents';

/**
 * Activate the transaction engine with the appropriate RPC URL
 */
export async function activateTransactionEngine(): Promise<boolean> {
  try {
    logger.info('Activating Nexus Transaction Engine...');
    
    // Start the transaction engine
    const success = await nexusEngine.start();
    
    if (!success) {
      logger.error('Failed to start Nexus Transaction Engine');
      return false;
    }
    
    logger.info('Nexus Transaction Engine activated successfully');
    return true;
  } catch (error) {
    logger.error('Error activating transaction engine:', error);
    return false;
  }
}

/**
 * Enable real funds trading by setting appropriate flags
 */
export async function enableRealFunds(): Promise<boolean> {
  try {
    logger.info('Enabling real funds trading...');
    
    // Set real funds mode in Nexus engine
    nexusEngine.setUseRealFunds(true);
    
    // Set real funds mode in Signal Hub
    signalHub.setRealFundsMode(true);
    
    logger.info('Real funds trading enabled');
    return true;
  } catch (error) {
    logger.error('Error enabling real funds trading:', error);
    return false;
  }
}

/**
 * Activate all trading agents
 */
export async function activateAgents(): Promise<boolean> {
  try {
    logger.info('Activating trading agents...');
    
    // In a real implementation, this would activate various trading agents
    // like Hyperion Flash Arbitrage, Quantum Omega Momentum, etc.
    await agents.activateHyperion();
    await agents.activateQuantumOmega();
    
    // Activate Singularity only if Wormhole API key is available
    if (process.env.WORMHOLE_API_KEY) {
      await agents.activateSingularity();
      logger.info('Singularity Cross-Chain agent activated');
    } else {
      logger.warn('Singularity Cross-Chain agent not activated (missing WORMHOLE_API_KEY)');
    }
    
    logger.info('Trading agents activated successfully');
    return true;
  } catch (error) {
    logger.error('Error activating trading agents:', error);
    return false;
  }
}

/**
 * Activate Blockchain communication
 */
export async function activateBlockchainCommunication(): Promise<boolean> {
  try {
    logger.info('Activating blockchain communication components...');
    
    // Initialize transaction verifier
    const verifierInitialized = initTransactionVerifier();
    if (!verifierInitialized) {
      logger.warn('Transaction verifier initialization failed, continuing without verification');
    }
    
    // Initialize Anchor program connector
    const anchorInitialized = await initAnchorConnector();
    if (!anchorInitialized) {
      logger.warn('Anchor program connector initialization failed, continuing without on-chain backup');
    }
    
    logger.info('Blockchain communication components activated');
    return true;
  } catch (error) {
    logger.error('Error activating blockchain communication:', error);
    return false;
  }
}

/**
 * Configure and verify wallet setup
 */
export async function verifyWalletSetup(): Promise<boolean> {
  try {
    logger.info('Verifying wallet configuration...');
    
    // Get current wallet configuration
    const walletConfig = getWalletConfig();
    
    // Verify trading wallet is set
    if (!walletConfig.tradingWallet) {
      logger.error('Trading wallet not configured');
      return false;
    }
    
    // Verify profit wallet is set
    if (!walletConfig.profitWallet) {
      logger.error('Profit wallet not configured');
      return false;
    }
    
    // Log wallet configuration
    logger.info('Wallet configuration verified:');
    logger.info(`- Trading wallet: ${walletConfig.tradingWallet.substring(0, 6)}...${walletConfig.tradingWallet.substring(walletConfig.tradingWallet.length - 4)}`);
    logger.info(`- Secondary wallet: ${walletConfig.feeWallet ? walletConfig.feeWallet.substring(0, 6) + '...' + walletConfig.feeWallet.substring(walletConfig.feeWallet.length - 4) : 'Not configured'}`);
    logger.info(`- Prophet wallet: ${walletConfig.profitWallet.substring(0, 6)}...${walletConfig.profitWallet.substring(walletConfig.profitWallet.length - 4)}`);
    logger.info(`- Profit reinvestment ratio: ${walletConfig.profitReinvestmentRatio * 100}%`);
    
    return true;
  } catch (error) {
    logger.error('Error verifying wallet setup:', error);
    return false;
  }
}

/**
 * Main function to activate live trading
 */
export async function activateLiveTrading(): Promise<boolean> {
  try {
    logger.info('==========================================');
    logger.info('ACTIVATING LIVE TRADING SYSTEM');
    logger.info('==========================================');
    
    // Verify wallet setup first
    const walletSetup = await verifyWalletSetup();
    if (!walletSetup) {
      logger.error('Wallet setup verification failed, cannot proceed');
      return false;
    }
    
    // Activate blockchain communication components
    const blockchainComm = await activateBlockchainCommunication();
    if (!blockchainComm) {
      logger.warn('Blockchain communication activation issues detected, proceeding with caution');
    }
    
    // Activate Nexus Transaction Engine
    const engineActivated = await activateTransactionEngine();
    if (!engineActivated) {
      logger.error('Transaction engine activation failed, cannot proceed');
      return false;
    }
    
    // Start Signal Hub if not already running
    if (!signalHub.getStatus().isRunning) {
      signalHub.start({
        useRealFunds: false, // Start in simulation mode for safety
        confidenceThreshold: 0.75, // Higher threshold for live trading
        useFallbackStrategies: true
      });
    }
    
    // Activate trading agents
    const agentsActivated = await activateAgents();
    if (!agentsActivated) {
      logger.error('Trading agents activation failed, cannot proceed');
      return false;
    }
    
    // Last step: enable real funds
    const realFundsEnabled = await enableRealFunds();
    if (!realFundsEnabled) {
      logger.error('Failed to enable real funds trading');
      return false;
    }
    
    logger.info('==========================================');
    logger.info('LIVE TRADING SYSTEM FULLY ACTIVATED');
    logger.info('==========================================');
    
    return true;
  } catch (error) {
    logger.error('Error during live trading activation:', error);
    return false;
  }
}

// If executed directly as a script
if (require.main === module) {
  activateLiveTrading()
    .then(success => {
      if (success) {
        logger.info('Live trading activated successfully.');
      } else {
        logger.error('Failed to activate live trading.');
        process.exit(1);
      }
    })
    .catch(error => {
      logger.error('Fatal error during live trading activation:', error);
      process.exit(1);
    });
}