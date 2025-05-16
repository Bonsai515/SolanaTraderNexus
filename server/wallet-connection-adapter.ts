/**
 * Wallet Connection Adapter
 * 
 * This module configures and links the Nexus Pro Engine with your main trading
 * wallet containing 1.5 SOL, integrating it with nuclear strategies for
 * real blockchain transactions.
 */

import * as logger from './logger';
import { Keypair, PublicKey } from '@solana/web3.js';
import { getManagedConnection } from './lib/rpcConnectionManager';
import { getNexusEngine } from './nexus-transaction-engine';
import * as fs from 'fs';
import * as path from 'path';

// Wallet addresses
const MAIN_WALLET_ADDRESS = "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb";
const PROPHET_WALLET_ADDRESS = "31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e";

/**
 * Initialize wallet connection for nuclear strategies
 */
export async function initializeWalletConnection(): Promise<boolean> {
  logger.info(`[WalletConnectionAdapter] Initializing wallet connection for nuclear strategies`);
  
  try {
    // Get Nexus engine instance
    const nexusEngine = getNexusEngine();
    if (!nexusEngine) {
      throw new Error("Nexus Pro Engine not available");
    }
    
    // Get connection
    const connection = getManagedConnection();
    
    // Verify wallet exists and has funds
    const mainPubkey = new PublicKey(MAIN_WALLET_ADDRESS);
    const balance = await connection.getBalance(mainPubkey);
    const solBalance = balance / 1000000000; // Convert lamports to SOL
    
    logger.info(`[WalletConnectionAdapter] Main wallet (${MAIN_WALLET_ADDRESS.substring(0, 6)}...${MAIN_WALLET_ADDRESS.slice(-4)}) balance: ${solBalance} SOL`);
    
    if (solBalance < 0.05) {
      logger.warn(`[WalletConnectionAdapter] Warning: Low SOL balance (${solBalance} SOL), some operations may fail`);
    }
    
    // Register wallets with Nexus engine
    registerWalletsWithNexusEngine(nexusEngine);
    
    // Configure profit distribution settings
    configureProfitDistribution(nexusEngine);
    
    // Verify RPC connection is working
    const blockHeight = await connection.getBlockHeight();
    logger.info(`[WalletConnectionAdapter] Connected to Solana blockchain at block height ${blockHeight}`);
    
    logger.info(`[WalletConnectionAdapter] Wallet connection initialized successfully for nuclear strategies`);
    return true;
  } catch (error) {
    logger.error(`[WalletConnectionAdapter] Error initializing wallet connection: ${error}`);
    return false;
  }
}

/**
 * Register wallets with Nexus engine
 */
function registerWalletsWithNexusEngine(nexusEngine: any): void {
  try {
    // Register main trading wallet
    nexusEngine.registerMainWallet(MAIN_WALLET_ADDRESS);
    logger.info(`[WalletConnectionAdapter] Registered main trading wallet with Nexus engine: ${MAIN_WALLET_ADDRESS.substring(0, 6)}...${MAIN_WALLET_ADDRESS.slice(-4)}`);
    
    // Register prophet wallet for profit collection
    nexusEngine.registerProfitWallet(PROPHET_WALLET_ADDRESS);
    logger.info(`[WalletConnectionAdapter] Registered prophet wallet with Nexus engine: ${PROPHET_WALLET_ADDRESS.substring(0, 6)}...${PROPHET_WALLET_ADDRESS.slice(-4)}`);
    
    // Set as active for transactions
    nexusEngine.activateWallet(MAIN_WALLET_ADDRESS);
    logger.info(`[WalletConnectionAdapter] Activated main wallet for nuclear transactions`);
  } catch (error) {
    logger.error(`[WalletConnectionAdapter] Error registering wallets with Nexus engine: ${error}`);
    throw error;
  }
}

/**
 * Configure profit distribution settings
 */
function configureProfitDistribution(nexusEngine: any): void {
  try {
    // Configure profit distribution with 95% reinvestment
    nexusEngine.configureProfitDistribution({
      reinvestmentRatio: 0.95,              // 95% reinvestment
      profitCollectionWallet: PROPHET_WALLET_ADDRESS,
      profitCollectionEnabled: true,
      profitCollectionThresholdUsd: 5       // $5 threshold for profit collection
    });
    
    logger.info(`[WalletConnectionAdapter] Configured profit distribution: 95% reinvestment, 5% collection to prophet wallet`);
  } catch (error) {
    logger.error(`[WalletConnectionAdapter] Error configuring profit distribution: ${error}`);
    throw error;
  }
}

/**
 * Get wallet balances
 */
export async function getWalletBalances(): Promise<{
  main: number; 
  prophet: number;
}> {
  try {
    const connection = getManagedConnection();
    
    // Get main wallet balance
    const mainBalance = await connection.getBalance(new PublicKey(MAIN_WALLET_ADDRESS));
    const mainSolBalance = mainBalance / 1000000000;
    
    // Get prophet wallet balance
    const prophetBalance = await connection.getBalance(new PublicKey(PROPHET_WALLET_ADDRESS));
    const prophetSolBalance = prophetBalance / 1000000000;
    
    return {
      main: mainSolBalance,
      prophet: prophetSolBalance
    };
  } catch (error) {
    logger.error(`[WalletConnectionAdapter] Error getting wallet balances: ${error}`);
    return { main: 0, prophet: 0 };
  }
}

/**
 * Initialize nuclear strategy connection
 */
export async function initializeNuclearStrategies(): Promise<boolean> {
  try {
    logger.info(`[WalletConnectionAdapter] Initializing nuclear strategies with main wallet`);
    
    // Get Nexus engine instance
    const nexusEngine = getNexusEngine();
    if (!nexusEngine) {
      throw new Error("Nexus Pro Engine not available");
    }
    
    // Set Nexus engine to use the main wallet for all nuclear strategies
    nexusEngine.setStrategyWallet(MAIN_WALLET_ADDRESS, [
      'quantum_hypertrading',
      'mev_singularity',
      'cross_chain_flash_reactor',
      'deep_liquidity_mining',
      'alpha_signal_momentum'
    ]);
    
    logger.info(`[WalletConnectionAdapter] Successfully configured main wallet for all nuclear strategies`);
    
    // Configure strategy risk levels - aggressive with safeguards
    nexusEngine.configureStrategyRiskLevels({
      quantum_hypertrading: {
        riskLevel: 'HIGH',
        maxPositionSizePercent: 30,
        stopLossPercent: 5
      },
      mev_singularity: {
        riskLevel: 'HIGH',
        maxPositionSizePercent: 25,
        stopLossPercent: 3
      },
      cross_chain_flash_reactor: {
        riskLevel: 'MEDIUM',
        maxPositionSizePercent: 20,
        stopLossPercent: 4
      },
      deep_liquidity_mining: {
        riskLevel: 'MEDIUM',
        maxPositionSizePercent: 15,
        stopLossPercent: 3
      },
      alpha_signal_momentum: {
        riskLevel: 'HIGH',
        maxPositionSizePercent: 25,
        stopLossPercent: 5
      }
    });
    
    logger.info(`[WalletConnectionAdapter] Configured aggressive risk levels for nuclear strategies with safeguards`);
    
    // Enable flash loans for strategies
    nexusEngine.enableFlashLoans([
      'quantum_hypertrading',
      'mev_singularity',
      'cross_chain_flash_reactor'
    ]);
    
    logger.info(`[WalletConnectionAdapter] Enabled flash loans for applicable nuclear strategies`);
    
    return true;
  } catch (error) {
    logger.error(`[WalletConnectionAdapter] Error initializing nuclear strategies: ${error}`);
    return false;
  }
}

/**
 * Force instant balance update for all wallets
 */
export async function forceBalanceUpdate(): Promise<void> {
  try {
    const balances = await getWalletBalances();
    
    logger.info(`[WalletConnectionAdapter] Current wallet balances:`);
    logger.info(`- Main wallet: ${balances.main.toFixed(6)} SOL`);
    logger.info(`- Prophet wallet: ${balances.prophet.toFixed(6)} SOL`);
  } catch (error) {
    logger.error(`[WalletConnectionAdapter] Error forcing balance update: ${error}`);
  }
}