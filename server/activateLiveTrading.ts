/**
 * Activate Live Trading with Real Funds
 * 
 * This script activates real trading by connecting signals to the Nexus Professional Engine
 * and enables the trading agents to execute real transactions on the Solana blockchain.
 */

import { SignalHub } from './signalHub';
import { nexusEngine } from './nexus-transaction-engine';
import * as logger from './logger';
import { Signal } from '../shared/signalTypes';

// We need to ensure the global signalHub is instantiated
const signalHub = global.signalHub || new SignalHub();

/**
 * Connect signal processing to the Nexus Transaction Engine
 */
export async function connectSignalsToNexusEngine(): Promise<boolean> {
  try {
    logger.info('Connecting Signal Hub to Nexus Professional Engine for live trading');
    
    // Register signal handlers with the transaction engine
    signalHub.on('signal', async (signal: Signal) => {
      logger.info(`Processing signal ${signal.id} for trading execution`);
      
      // Process signal based on its type
      if (signal.type === 'MARKET_SENTIMENT' || signal.type === 'VOLATILITY_ALERT') {
        if (signal.confidence >= 0.7 && signal.direction === 'BUY') {
          // Execute buy transaction
          const txResult = await nexusEngine.executeTransaction({
            type: 'BUY',
            token: signal.token,
            amount: calculatePositionSize(signal), // Calculate position size based on confidence
            maxSlippageBps: 50, // 0.5% max slippage
            signalId: signal.id
          });
          
          logger.info(`Executed BUY for ${signal.token} based on signal ${signal.id}, transaction result: ${JSON.stringify(txResult)}`);
        } else if (signal.confidence >= 0.7 && signal.direction === 'SELL') {
          // Execute sell transaction
          const txResult = await nexusEngine.executeTransaction({
            type: 'SELL',
            token: signal.token,
            amount: calculatePositionSize(signal),
            maxSlippageBps: 50,
            signalId: signal.id
          });
          
          logger.info(`Executed SELL for ${signal.token} based on signal ${signal.id}, transaction result: ${JSON.stringify(txResult)}`);
        } else {
          logger.info(`Signal ${signal.id} did not meet execution criteria, confidence: ${signal.confidence}`);
        }
      } else if (signal.type === 'ARBITRAGE_OPPORTUNITY') {
        // Execute arbitrage opportunity
        const txResult = await nexusEngine.executeArbitrage({
          fromToken: signal.token,
          toToken: signal.targetToken || 'USDC', // Default to USDC
          viaToken: signal.intermediateToken, // May be undefined
          expectedProfitBps: signal.expectedProfitBps || 0,
          maxSlippageBps: 30, // 0.3% max slippage
          signalId: signal.id
        });
        
        logger.info(`Executed arbitrage for ${signal.token} based on signal ${signal.id}, transaction result: ${JSON.stringify(txResult)}`);
      } else if (signal.type === 'FLASH_LOAN_OPPORTUNITY') {
        // Execute flash loan opportunity
        const txResult = await nexusEngine.executeFlashLoan({
          token: signal.token,
          amount: signal.amount || calculateOptimalFlashLoanAmount(signal),
          targetDex: signal.targetDex,
          expectedProfitBps: signal.expectedProfitBps || 0,
          signalId: signal.id
        });
        
        logger.info(`Executed flash loan for ${signal.token} based on signal ${signal.id}, transaction result: ${JSON.stringify(txResult)}`);
      }
    });
    
    // Register error handlers
    signalHub.on('error', (error: Error) => {
      logger.error(`Signal processing error: ${error.message}`);
    });
    
    logger.info('Signal Hub successfully connected to Nexus Professional Engine');
    return true;
  } catch (error) {
    logger.error('Failed to connect signals to Nexus engine:', error);
    return false;
  }
}

/**
 * Activate trading agents for live trading
 */
export async function activateAgents(): Promise<boolean> {
  try {
    logger.info('Activating trading agents for live trading');
    
    // Import wallet manager to get configuration
    const { getWalletConfig } = require('./walletManager');
    const walletConfig = getWalletConfig();
    
    // Verify wallet configuration
    if (!walletConfig.tradingWallet || !walletConfig.profitWallet) {
      logger.error('Wallet configuration is incomplete. Cannot activate trading agents.');
      return false;
    }
    
    // Activate Hyperion flash arbitrage agent
    const hyperionResult = await nexusEngine.activateAgent('hyperion', {
      mode: 'LIVE',
      strategyConfig: {
        flashLoanEnabled: true,
        maxTransactionSize: 5000, // In USD
        profitThresholdBps: 15, // 0.15% minimum profit
        reinvestmentRatio: walletConfig.profitReinvestmentRatio, // Use configured profit split ratio
        profitCollectionWallet: walletConfig.profitWallet, // Use configured prophet wallet
        tradingWallet: walletConfig.tradingWallet // Use configured trading wallet
      }
    });
    
    logger.info(`Activated Hyperion agent, result: ${JSON.stringify(hyperionResult)}`);
    
    // Activate Quantum Omega momentum surfing agent
    const quantumOmegaResult = await nexusEngine.activateAgent('quantum_omega', {
      mode: 'LIVE',
      strategyConfig: {
        momentumThreshold: 0.05, // 5% momentum threshold
        maxPositionSizeUsd: 2500, // Max $2500 per position
        stopLossPct: 0.02, // 2% stop loss
        takeProfitPct: 0.08, // 8% take profit
        reinvestmentRatio: walletConfig.profitReinvestmentRatio, // Use configured profit split ratio
        profitCollectionWallet: walletConfig.profitWallet, // Use configured prophet wallet
        tradingWallet: walletConfig.tradingWallet // Use configured trading wallet
      }
    });
    
    logger.info(`Activated Quantum Omega agent, result: ${JSON.stringify(quantumOmegaResult)}`);
    
    // Activate Singularity cross-chain agent if Wormhole is available
    if (process.env.WORMHOLE_API_KEY) {
      const singularityResult = await nexusEngine.activateAgent('singularity', {
        mode: 'LIVE',
        strategyConfig: {
          crossChainEnabled: true,
          targetChains: ['ethereum', 'polygon', 'avalanche'],
          maxTransactionSizeUsd: 3000,
          minProfitThresholdBps: 25, // 0.25% minimum profit
          reinvestmentRatio: walletConfig.profitReinvestmentRatio, // Use configured profit split ratio
          profitCollectionWallet: walletConfig.profitWallet, // Use configured prophet wallet
          tradingWallet: walletConfig.tradingWallet // Use configured trading wallet
        }
      });
      
      logger.info(`Activated Singularity agent, result: ${JSON.stringify(singularityResult)}`);
    } else {
      logger.warn('Skipping Singularity agent activation as Wormhole API key is not available');
    }
    
    // Log summary of agent activation with wallet details
    logger.info('All trading agents activated successfully and configured with:');
    logger.info(`- Trading wallet: ${walletConfig.tradingWallet.substring(0, 6)}...${walletConfig.tradingWallet.substring(walletConfig.tradingWallet.length - 4)}`);
    logger.info(`- Prophet wallet: ${walletConfig.profitWallet.substring(0, 6)}...${walletConfig.profitWallet.substring(walletConfig.profitWallet.length - 4)}`);
    logger.info(`- Profit split: ${(walletConfig.profitReinvestmentRatio * 100).toFixed(0)}/${((1 - walletConfig.profitReinvestmentRatio) * 100).toFixed(0)}`);
    
    return true;
  } catch (error) {
    logger.error('Failed to activate trading agents:', error);
    return false;
  }
}

/**
 * Enable real fund trading by setting appropriate flags
 */
export async function enableRealFunding(): Promise<boolean> {
  try {
    logger.info('Enabling real fund trading');
    
    // Set the system to use real funds
    nexusEngine.setUseRealFunds(true);
    
    // Import wallet manager to get configuration
    const { getWalletConfig } = require('./walletManager');
    const walletConfig = getWalletConfig();
    
    // Verify wallet configuration
    if (!walletConfig.tradingWallet || !walletConfig.profitWallet) {
      logger.error('Wallet configuration is incomplete. Cannot enable real fund trading.');
      return false;
    }
    
    // Configure profit distribution with the configured wallets
    nexusEngine.configureProfitDistribution({
      reinvestmentRatio: walletConfig.profitReinvestmentRatio, // 95% reinvestment by default
      profitCollectionWallet: walletConfig.profitWallet, // Prophet wallet for profit collection
      profitCollectionEnabled: true,
      profitCollectionThresholdUsd: walletConfig.profitCollectionThreshold || 100 // Collect profits when threshold reached
    });
    
    // Register the trading wallet as the primary wallet
    nexusEngine.registerWallet(walletConfig.tradingWallet);
    
    // Enable transaction verification with Solscan
    nexusEngine.enableTransactionVerification(true);
    
    logger.info('Real fund trading enabled successfully');
    logger.info(`Using ${walletConfig.tradingWallet.substring(0, 6)}...${walletConfig.tradingWallet.substring(walletConfig.tradingWallet.length - 4)} for trading operations`);
    logger.info(`Profits will be sent to ${walletConfig.profitWallet.substring(0, 6)}...${walletConfig.profitWallet.substring(walletConfig.profitWallet.length - 4)}`);
    logger.info(`Profit split: ${(walletConfig.profitReinvestmentRatio * 100).toFixed(0)}% reinvestment, ${((1 - walletConfig.profitReinvestmentRatio) * 100).toFixed(0)}% profit collection`);
    
    return true;
  } catch (error) {
    logger.error('Failed to enable real fund trading:', error);
    return false;
  }
}

/**
 * Initialize security checks for trading
 */
export async function initializeSecurityChecks(): Promise<boolean> {
  try {
    logger.info('Initializing security checks for trading');
    
    // Neurally entangle with security transformer
    await nexusEngine.connectSecurityTransformer({
      entanglementLevel: 0.92, // 92% quantum entanglement
      maxRiskLevel: 'LOW',
      autoBlacklist: true,
      verificationEnabled: true
    });
    
    // Set maximum transaction size for safety
    nexusEngine.setMaxTransactionSize(5000); // $5000 max per transaction
    
    // Set maximum exposure per token
    nexusEngine.setMaxExposure({
      SOL: 10000, // $10,000 max exposure for SOL
      USDC: 50000, // $50,000 max exposure for USDC
      'DEFAULT': 5000 // $5,000 max for other tokens
    });
    
    // Set up emergency fund preservation mechanism
    nexusEngine.configureEmergencyPreservation({
      enabled: true,
      preservationThresholdPct: 0.15, // Preserve 15% of funds in emergency
      emergencyShutdownEnabled: true
    });
    
    logger.info('Security checks initialized successfully');
    return true;
  } catch (error) {
    logger.error('Failed to initialize security checks:', error);
    return false;
  }
}

/**
 * Main function to activate live trading
 */
export async function activateLiveTrading(): Promise<boolean> {
  try {
    logger.info('------------------------------------------------------------');
    logger.info('🚀 ACTIVATING LIVE TRADING WITH REAL FUNDS');
    logger.info('------------------------------------------------------------');
    
    // Step 1: Initialize security checks
    const securityResult = await initializeSecurityChecks();
    if (!securityResult) {
      logger.error('Failed to initialize security checks, aborting live trading activation');
      return false;
    }
    
    // Step 2: Connect signals to transaction engine
    const connectionResult = await connectSignalsToNexusEngine();
    if (!connectionResult) {
      logger.error('Failed to connect signals to transaction engine, aborting live trading activation');
      return false;
    }
    
    // Step 3: Activate trading agents
    const agentsResult = await activateAgents();
    if (!agentsResult) {
      logger.error('Failed to activate trading agents, aborting live trading activation');
      return false;
    }
    
    // Step 4: Enable real fund trading
    const fundingResult = await enableRealFunding();
    if (!fundingResult) {
      logger.error('Failed to enable real fund trading, aborting live trading activation');
      return false;
    }
    
    logger.info('------------------------------------------------------------');
    logger.info('✅ LIVE TRADING ACTIVATED SUCCESSFULLY');
    logger.info('✅ System is now trading with real funds');
    logger.info('✅ Profits are being collected to Prophet wallet');
    logger.info('✅ Nexus Professional Engine is actively executing transactions');
    logger.info('------------------------------------------------------------');
    
    return true;
  } catch (error) {
    logger.error('Fatal error activating live trading:', error);
    return false;
  }
}

/**
 * Helper function to calculate position size based on signal confidence
 */
function calculatePositionSize(signal: Signal): number {
  // Base position size in USD
  const basePositionSize = 1000; // $1000 base position
  
  // Scale by confidence level (0.5-1.0)
  const scaleFactor = Math.max(0, (signal.confidence - 0.5) * 2);
  
  // Calculate position size
  return basePositionSize * scaleFactor;
}

/**
 * Helper function to calculate optimal flash loan amount
 */
function calculateOptimalFlashLoanAmount(signal: Signal): number {
  // Base flash loan amount in USD
  const baseAmount = 10000; // $10,000 base flash loan
  
  // Scale by expected profit
  const expectedProfitBps = signal.expectedProfitBps || 0;
  const profitScaleFactor = Math.min(10, Math.max(1, expectedProfitBps / 5));
  
  // Calculate optimal amount
  return baseAmount * profitScaleFactor;
}