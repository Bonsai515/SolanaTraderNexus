/**
 * Nexus Integration Module
 * 
 * This module integrates all system components together to enable real blockchain
 * trading with nuclear strategies, AI agents, transformers, and Solend protocols.
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as logger from './logger';
import { getManagedConnection } from './lib/rpcConnectionManager';
import * as rpcLoadBalancer from './lib/rpcLoadBalancer';
import * as nexusEngine from './nexus-transaction-engine';
import { SolendCore } from './lending/solend-core';
import { SolendLiquidator } from './lending/solend-liquidator';
import * as fs from 'fs';
import * as path from 'path';

// Configuration paths
const SYSTEM_MEMORY_PATH = path.join('./data', 'system-memory.json');
const STRATEGIES_CONFIG_PATH = path.join('./server/config', 'nuclear-strategies.json');

// Trading wallet address
const MAIN_TRADING_WALLET = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
const PROPHET_WALLET = '31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e';

// Profit collection configuration
interface ProfitCollectionConfig {
  enabled: boolean;
  collectionIntervalMinutes: number;
  reinvestmentRate: number; // 0.0 to 1.0
  targetWallet: string;
}

// Strategy configuration
interface StrategyConfig {
  id: string;
  name: string;
  type: string;
  description: string;
  enabled: boolean;
  allocation: number; // 0.0 to 1.0
  riskLevel: string;
  transformers: string[];
  config: any;
}

// System memory interface
interface SystemMemory {
  useRealFunds: boolean;
  activeStrategies: StrategyConfig[];
  profitCollection: ProfitCollectionConfig;
  lastActivation: string;
  wallets: {
    [key: string]: {
      address: string;
      type: string;
      balance?: number;
      lastUpdated?: string;
    }
  };
  features: {
    flashLoans: boolean;
    crossChain: boolean;
    jitoBundles: boolean;
    solendLiquidator: boolean;
  };
}

/**
 * Load system memory
 */
function loadSystemMemory(): SystemMemory {
  try {
    if (fs.existsSync(SYSTEM_MEMORY_PATH)) {
      const data = fs.readFileSync(SYSTEM_MEMORY_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    logger.error('[Nexus Integration] Error loading system memory:', error);
  }
  
  // Default system memory
  return {
    useRealFunds: true,
    activeStrategies: [],
    profitCollection: {
      enabled: true,
      collectionIntervalMinutes: 4,
      reinvestmentRate: 0.95,
      targetWallet: PROPHET_WALLET
    },
    lastActivation: new Date().toISOString(),
    wallets: {
      trading: {
        address: MAIN_TRADING_WALLET,
        type: 'trading'
      },
      prophet: {
        address: PROPHET_WALLET,
        type: 'profit'
      }
    },
    features: {
      flashLoans: true,
      crossChain: true,
      jitoBundles: true,
      solendLiquidator: true
    }
  };
}

/**
 * Save system memory
 */
function saveSystemMemory(memory: SystemMemory): void {
  try {
    const dir = path.dirname(SYSTEM_MEMORY_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(SYSTEM_MEMORY_PATH, JSON.stringify(memory, null, 2));
    logger.info('[Nexus Integration] System memory saved');
  } catch (error) {
    logger.error('[Nexus Integration] Error saving system memory:', error);
  }
}

/**
 * Initialize the Nexus transaction engine with optimized RPC connections
 */
export async function initializeTransactionEngine(): Promise<boolean> {
  try {
    // Get system memory
    const systemMemory = loadSystemMemory();
    
    // Force real funds for trading
    systemMemory.useRealFunds = true;
    saveSystemMemory(systemMemory);
    
    // Get an optimized connection with load balancing
    const connection = getManagedConnection({
      commitment: 'confirmed'
    });
    
    // Initialize the engine
    await nexusEngine.initialize({
      connection,
      useRealFunds: true,
      priorityFee: 50000, // 0.00005 SOL
      mainWalletAddress: MAIN_TRADING_WALLET
    });
    
    logger.info('[Nexus Integration] Transaction engine initialized with real funds');
    return true;
  } catch (error) {
    logger.error('[Nexus Integration] Error initializing transaction engine:', error);
    return false;
  }
}

/**
 * Initialize Solend liquidator with optimized connections
 */
export async function initializeSolendLiquidator(): Promise<boolean> {
  try {
    // Get system memory
    const systemMemory = loadSystemMemory();
    
    // Skip if not enabled
    if (!systemMemory.features.solendLiquidator) {
      logger.info('[Nexus Integration] Solend liquidator disabled in configuration');
      return false;
    }
    
    // Create liquidator
    const liquidator = new SolendLiquidator();
    
    // Try to get wallet from nexus engine
    const walletKeyPair = await nexusEngine.getWalletKeypair();
    
    if (walletKeyPair) {
      // Initialize with wallet
      liquidator.initialize(walletKeyPair);
      
      // Start monitoring
      liquidator.startMonitoring();
      
      logger.info('[Nexus Integration] Solend liquidator initialized and monitoring started');
      return true;
    } else {
      logger.warn('[Nexus Integration] Could not get wallet for Solend liquidator');
      return false;
    }
  } catch (error) {
    logger.error('[Nexus Integration] Error initializing Solend liquidator:', error);
    return false;
  }
}

/**
 * Load and activate nuclear strategies
 */
export async function activateNuclearStrategies(): Promise<boolean> {
  try {
    // Get system memory
    const systemMemory = loadSystemMemory();
    
    // Load strategy configurations
    const strategies: StrategyConfig[] = [];
    
    if (fs.existsSync(STRATEGIES_CONFIG_PATH)) {
      const data = fs.readFileSync(STRATEGIES_CONFIG_PATH, 'utf8');
      const loaded = JSON.parse(data);
      
      if (Array.isArray(loaded)) {
        strategies.push(...loaded);
      }
    }
    
    // If no strategies loaded, use defaults
    if (strategies.length === 0) {
      strategies.push(
        {
          id: 'nuclear-hyperion-flash',
          name: 'Hyperion Flash Arbitrage',
          type: 'FLASH_ARBITRAGE',
          description: 'High-speed flash loan arbitrage across multiple DEXes',
          enabled: true,
          allocation: 0.3,
          riskLevel: 'MEDIUM',
          transformers: ['MicroQHC', 'MEME'],
          config: {
            maxSlippageBps: 30,
            priorityFee: 100000,
            flashLoanProvider: 'SOLEND'
          }
        },
        {
          id: 'nuclear-quantum-omega',
          name: 'Quantum Omega Token Sniper',
          type: 'TOKEN_SNIPER',
          description: 'Ultra-fast token launch detection and position taking',
          enabled: true,
          allocation: 0.2,
          riskLevel: 'HIGH',
          transformers: ['MemeCortexRemix', 'Security'],
          config: {
            maxPositionSize: 200,
            maxHoldTimeMinutes: 20,
            takeProfit: 0.2,
            stopLoss: 0.05
          }
        },
        {
          id: 'nuclear-singularity',
          name: 'Singularity Cross-Chain',
          type: 'CROSS_CHAIN',
          description: 'Cross-chain arbitrage via Wormhole',
          enabled: true,
          allocation: 0.25,
          riskLevel: 'MEDIUM',
          transformers: ['CrossChain', 'Security'],
          config: {
            chains: ['SOLANA', 'ETHEREUM', 'ARBITRUM'],
            bridges: ['WORMHOLE', 'PORTAL'],
            minProfitThreshold: 0.02
          }
        }
      );
    }
    
    // Update system memory
    systemMemory.activeStrategies = strategies.filter(s => s.enabled);
    systemMemory.lastActivation = new Date().toISOString();
    saveSystemMemory(systemMemory);
    
    // Register strategies with the nexus engine
    for (const strategy of strategies) {
      if (strategy.enabled) {
        await nexusEngine.registerStrategy(strategy.id, {
          name: strategy.name,
          allocation: strategy.allocation,
          config: strategy.config
        });
        
        logger.info(`[Nexus Integration] Registered strategy: ${strategy.name}`);
      }
    }
    
    logger.info(`[Nexus Integration] Activated ${systemMemory.activeStrategies.length} nuclear strategies`);
    return true;
  } catch (error) {
    logger.error('[Nexus Integration] Error activating nuclear strategies:', error);
    return false;
  }
}

/**
 * Initialize profit collection
 */
export async function initializeProfitCollection(): Promise<boolean> {
  try {
    // Get system memory
    const systemMemory = loadSystemMemory();
    
    // Register profit collection with nexus engine
    await nexusEngine.registerProfitCollection({
      enabled: systemMemory.profitCollection.enabled,
      interval: systemMemory.profitCollection.collectionIntervalMinutes * 60 * 1000,
      reinvestmentRate: systemMemory.profitCollection.reinvestmentRate,
      targetWallet: systemMemory.profitCollection.targetWallet
    });
    
    logger.info(`[Nexus Integration] Profit collection initialized (interval: ${systemMemory.profitCollection.collectionIntervalMinutes} minutes, reinvestment: ${systemMemory.profitCollection.reinvestmentRate * 100}%)`);
    return true;
  } catch (error) {
    logger.error('[Nexus Integration] Error initializing profit collection:', error);
    return false;
  }
}

/**
 * Initialize Jito bundles for optimized transaction execution
 */
export async function initializeJitoBundles(): Promise<boolean> {
  try {
    // Get system memory
    const systemMemory = loadSystemMemory();
    
    // Skip if not enabled
    if (!systemMemory.features.jitoBundles) {
      logger.info('[Nexus Integration] Jito bundles disabled in configuration');
      return false;
    }
    
    // Enable Jito bundles in nexus engine
    await nexusEngine.enableJitoBundles({
      enabled: true,
      tipLamports: 100000 // 0.0001 SOL
    });
    
    logger.info('[Nexus Integration] Jito bundles initialized for optimized execution');
    return true;
  } catch (error) {
    logger.error('[Nexus Integration] Error initializing Jito bundles:', error);
    return false;
  }
}

/**
 * Main integration function to activate the entire system
 */
export async function activateFullSystem(): Promise<boolean> {
  try {
    logger.info('[Nexus Integration] Activating full system with nuclear strategies and real funds');
    
    // Step 1: Initialize Nexus transaction engine
    const engineInitialized = await initializeTransactionEngine();
    if (!engineInitialized) {
      throw new Error('Failed to initialize transaction engine');
    }
    
    // Step 2: Initialize Solend liquidator
    await initializeSolendLiquidator();
    
    // Step 3: Activate nuclear strategies
    const strategiesActivated = await activateNuclearStrategies();
    if (!strategiesActivated) {
      throw new Error('Failed to activate nuclear strategies');
    }
    
    // Step 4: Initialize profit collection
    const profitInitialized = await initializeProfitCollection();
    if (!profitInitialized) {
      throw new Error('Failed to initialize profit collection');
    }
    
    // Step 5: Initialize Jito bundles
    await initializeJitoBundles();
    
    logger.info('[Nexus Integration] Full system activated successfully');
    
    // Get system memory for final status
    const systemMemory = loadSystemMemory();
    logger.info(`[Nexus Integration] System Status:
      - Real Funds: ${systemMemory.useRealFunds}
      - Active Strategies: ${systemMemory.activeStrategies.length}
      - Profit Collection: ${systemMemory.profitCollection.enabled ? 'Enabled' : 'Disabled'} (${systemMemory.profitCollection.collectionIntervalMinutes} minutes)
      - Flash Loans: ${systemMemory.features.flashLoans ? 'Enabled' : 'Disabled'}
      - Cross Chain: ${systemMemory.features.crossChain ? 'Enabled' : 'Disabled'}
      - Jito Bundles: ${systemMemory.features.jitoBundles ? 'Enabled' : 'Disabled'}
      - Solend Liquidator: ${systemMemory.features.solendLiquidator ? 'Enabled' : 'Disabled'}`);
    
    return true;
  } catch (error) {
    logger.error('[Nexus Integration] Error activating full system:', error);
    return false;
  }
}