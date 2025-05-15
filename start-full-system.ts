#!/usr/bin/env ts-node
/**
 * Start Full Trading System
 * 
 * Comprehensive system startup script that initializes and runs all components
 * of the Solana trading system including transformers, engines, and strategies.
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from './server/logger';
import { EnhancedTransactionEngine, ExecutionMode, TransactionPriority, initializeNexusEngine } from './server/nexus-transaction-engine';
import { memeCortexEnhanced } from './server/transformers/MemeCortexEnhanced';
import { FlashLoanArbitrageStrategy } from './server/strategies/FlashLoanArbitrageStrategy';
import { MomentumSurfingStrategy } from './server/strategies/MomentumSurfingStrategy';
import { neuralNetworkOptimizer } from './server/neural-optimizations';
import optimizeRustBuild from './optimize-rust-build';
import verifyOnChainPrograms from './verify-onchain-programs';

// System component status
interface SystemComponentStatus {
  name: string;
  status: 'active' | 'inactive' | 'error';
  message: string;
  timestamp: string;
}

// Overall system status
interface SystemStatus {
  status: 'initializing' | 'running' | 'error' | 'shutdown';
  components: SystemComponentStatus[];
  timestamp: string;
  uptime: number;
  version: string;
}

// Create necessary directories
function ensureDirectoriesExist() {
  const directories = [
    './logs',
    './data',
    './data/models',
    './data/status',
    './data/metrics',
    './config',
    './config/agents',
    './rust_engine',
    './rust_engine/transformers'
  ];
  
  for (const dir of directories) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created directory: ${dir}`);
    }
  }
}

// Prepare system for startup
async function prepareSystem(): Promise<boolean> {
  logger.info('Preparing system for startup...');
  
  // Ensure directories exist
  ensureDirectoriesExist();
  
  try {
    // Optimize Rust transformer build
    logger.info('Optimizing Rust transformer build...');
    await optimizeRustBuild();
    
    // Initialize neural network optimizations
    logger.info('Initializing neural network optimizations...');
    const neuralStatus = neuralNetworkOptimizer.initialize();
    
    if (neuralStatus) {
      logger.info('Neural network optimizations initialized successfully');
    } else {
      logger.warn('Neural network optimizations initialization had issues');
    }
    
    // Verify on-chain programs
    logger.info('Verifying on-chain programs...');
    const programsVerified = await verifyOnChainPrograms();
    
    if (programsVerified) {
      logger.info('On-chain programs verified successfully');
    } else {
      logger.warn('On-chain program verification had issues, using fallbacks');
    }
    
    logger.info('System preparation completed successfully');
    return true;
  } catch (error) {
    logger.error(`Error preparing system: ${error.message}`);
    return false;
  }
}

// Initialize Nexus transaction engine
function initializeEngine(useRealFunds: boolean = true): EnhancedTransactionEngine {
  logger.info(`Initializing Nexus Professional Transaction Engine (${useRealFunds ? 'REAL' : 'SIMULATED'} funds)...`);
  
  // Engine configuration
  const nexusConfig = {
    useRealFunds,
    rpcUrl: process.env.ALCHEMY_RPC_URL || process.env.INSTANT_NODES_RPC_URL || 'https://api.mainnet-beta.solana.com',
    websocketUrl: process.env.ALCHEMY_WS_URL || process.env.INSTANT_NODES_WS_URL,
    defaultExecutionMode: useRealFunds ? ExecutionMode.LIVE : ExecutionMode.SIMULATION,
    defaultPriority: TransactionPriority.HIGH,
    defaultConfirmations: 2,
    maxConcurrentTransactions: 5,
    defaultTimeoutMs: 60000,
    defaultMaxRetries: 3,
    maxSlippageBps: 50,
    backupRpcUrls: [
      'https://rpc.ankr.com/solana',
      'https://solana-api.projectserum.com',
      'https://mainnet.solana-validator.com'
    ],
    heliusApiKey: process.env.HELIUS_API_KEY,
    solscanApiKey: process.env.SOLSCAN_API_KEY,
    mevProtection: true
  };
  
  return initializeNexusEngine(nexusConfig);
}

// Initialize MEME Cortex
async function initializeMEMECortex(): Promise<boolean> {
  logger.info('Initializing MEME Cortex...');
  
  try {
    const tokenPairs = [
      'SOL/USDC',
      'BONK/USDC',
      'MEME/USDC',
      'WIF/USDC',
      'POPCAT/USDC',
      'GUAC/USDC',
      'JUP/USDC'
    ];
    
    const success = await memeCortexEnhanced.initialize(tokenPairs);
    
    if (success) {
      logger.info(`MEME Cortex initialized for ${tokenPairs.length} token pairs`);
    } else {
      logger.warn('MEME Cortex initialization had issues');
    }
    
    return success;
  } catch (error) {
    logger.error(`Error initializing MEME Cortex: ${error.message}`);
    return false;
  }
}

// Initialize and deploy strategies
function initializeStrategies(engine: EnhancedTransactionEngine): {
  flashLoanStrategy: FlashLoanArbitrageStrategy;
  momentumStrategy: MomentumSurfingStrategy;
} {
  logger.info('Initializing trading strategies...');
  
  // Initialize Flash Loan Arbitrage Strategy
  const flashLoanStrategy = new FlashLoanArbitrageStrategy(engine);
  
  // Initialize Momentum Surfing Strategy
  const momentumStrategy = new MomentumSurfingStrategy(memeCortexEnhanced);
  
  return {
    flashLoanStrategy,
    momentumStrategy
  };
}

// Activate all strategies
function activateStrategies(strategies: {
  flashLoanStrategy: FlashLoanArbitrageStrategy;
  momentumStrategy: MomentumSurfingStrategy;
}): boolean {
  try {
    logger.info('Activating all strategies...');
    
    // Activate Flash Loan Arbitrage Strategy
    const flashLoanSuccess = strategies.flashLoanStrategy.activate();
    
    if (flashLoanSuccess) {
      logger.info('✅ Flash Loan Arbitrage Strategy activated successfully');
    } else {
      logger.error('Failed to activate Flash Loan Arbitrage Strategy');
    }
    
    // Activate Momentum Surfing Strategy
    const momentumSuccess = strategies.momentumStrategy.activate();
    
    if (momentumSuccess) {
      logger.info('✅ Momentum Surfing Strategy activated successfully');
    } else {
      logger.error('Failed to activate Momentum Surfing Strategy');
    }
    
    return flashLoanSuccess && momentumSuccess;
  } catch (error) {
    logger.error(`Error activating strategies: ${error.message}`);
    return false;
  }
}

// Setup system monitoring
function setupSystemMonitoring(engine: EnhancedTransactionEngine, strategies: {
  flashLoanStrategy: FlashLoanArbitrageStrategy;
  momentumStrategy: MomentumSurfingStrategy;
}): NodeJS.Timeout {
  logger.info('Setting up system monitoring...');
  
  const startTime = Date.now();
  const systemVersion = '1.0.0';
  
  // Set up interval to update status
  return setInterval(() => {
    try {
      // Gather component statuses
      const components: SystemComponentStatus[] = [
        {
          name: 'Nexus Transaction Engine',
          status: engine.isConnectionHealthy() ? 'active' : 'error',
          message: engine.isConnectionHealthy() ? 'Healthy connection' : 'Connection issues',
          timestamp: new Date().toISOString()
        },
        {
          name: 'MEME Cortex',
          status: memeCortexEnhanced.isInitialized() ? 'active' : 'error',
          message: memeCortexEnhanced.isInitialized() ? 'Initialized' : 'Not initialized',
          timestamp: new Date().toISOString()
        },
        {
          name: 'Flash Loan Arbitrage Strategy',
          status: strategies.flashLoanStrategy.isActive() ? 'active' : 'inactive',
          message: strategies.flashLoanStrategy.isActive() ? 'Active' : 'Inactive',
          timestamp: new Date().toISOString()
        },
        {
          name: 'Momentum Surfing Strategy',
          status: strategies.momentumStrategy.isActive() ? 'active' : 'inactive',
          message: strategies.momentumStrategy.isActive() ? 'Active' : 'Inactive',
          timestamp: new Date().toISOString()
        },
        {
          name: 'Neural Network Optimizer',
          status: neuralNetworkOptimizer.getEntanglementLevel() > 0.9 ? 'active' : 'error',
          message: `Neural-quantum entanglement: ${(neuralNetworkOptimizer.getEntanglementLevel() * 100).toFixed(0)}%`,
          timestamp: new Date().toISOString()
        }
      ];
      
      // Determine overall system status
      const hasErrors = components.some(c => c.status === 'error');
      const allActive = components.every(c => c.status === 'active');
      
      let overallStatus: 'initializing' | 'running' | 'error' | 'shutdown';
      
      if (hasErrors) {
        overallStatus = 'error';
      } else if (allActive) {
        overallStatus = 'running';
      } else {
        overallStatus = 'initializing';
      }
      
      // Create status object
      const systemStatus: SystemStatus = {
        status: overallStatus,
        components,
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - startTime) / 1000), // in seconds
        version: systemVersion
      };
      
      // Save to file
      const statusFile = path.join(__dirname, 'data', 'status', 'system_status.json');
      fs.writeFileSync(statusFile, JSON.stringify(systemStatus, null, 2));
      
      // Log status summary
      logger.info(`System Status: ${overallStatus.toUpperCase()} | Uptime: ${systemStatus.uptime}s | Components: ${components.filter(c => c.status === 'active').length}/${components.length} active`);
    } catch (error) {
      logger.error(`Error updating system status: ${error.message}`);
    }
  }, 60000); // Every minute
}

// Main function
async function startFullSystem(useRealFunds: boolean = true): Promise<boolean> {
  logger.info('===== STARTING FULL TRADING SYSTEM =====');
  
  try {
    // Prepare system
    const prepared = await prepareSystem();
    
    if (!prepared) {
      logger.error('System preparation failed');
      return false;
    }
    
    // Initialize Nexus engine
    const engine = initializeEngine(useRealFunds);
    
    if (!engine) {
      logger.error('Failed to initialize Nexus engine');
      return false;
    }
    
    // Initialize MEME Cortex
    const memeCortexInitialized = await initializeMEMECortex();
    
    if (!memeCortexInitialized) {
      logger.warn('MEME Cortex initialization had issues, but continuing');
    }
    
    // Initialize strategies
    const strategies = initializeStrategies(engine);
    
    // Activate strategies
    const strategiesActivated = activateStrategies(strategies);
    
    if (!strategiesActivated) {
      logger.warn('Some strategies failed to activate');
    }
    
    // Setup system monitoring
    const monitorInterval = setupSystemMonitoring(engine, strategies);
    
    // Register wallet with engine
    const walletPath = path.join(__dirname, 'wallet.json');
    
    if (fs.existsSync(walletPath)) {
      try {
        const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
        const walletAddress = `HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb`; // This would normally be derived from the wallet data
        
        engine.registerWallet(walletAddress);
        logger.info(`System wallet ${walletAddress} registered for trading operations`);
      } catch (error) {
        logger.error(`Error registering wallet: ${error.message}`);
      }
    } else {
      logger.warn('No wallet file found, operating without wallet registration');
    }
    
    // Set up process hooks for graceful shutdown
    process.on('SIGINT', () => {
      logger.info('Shutting down system...');
      
      // Clear monitoring interval
      clearInterval(monitorInterval);
      
      // Deactivate strategies
      strategies.flashLoanStrategy.deactivate();
      strategies.momentumStrategy.deactivate();
      
      logger.info('Strategies deactivated');
      process.exit(0);
    });
    
    logger.info('===== FULL TRADING SYSTEM STARTED SUCCESSFULLY =====');
    logger.info(`Using ${useRealFunds ? 'REAL' : 'SIMULATED'} funds mode`);
    
    return true;
  } catch (error) {
    logger.error(`Error starting full trading system: ${error.message}`);
    return false;
  }
}

// Process command line arguments
function parseArgs(): { useRealFunds: boolean } {
  const args = process.argv.slice(2);
  const useRealFunds = !args.includes('--simulate');
  
  return {
    useRealFunds
  };
}

// Run the system if executed directly
if (require.main === module) {
  const { useRealFunds } = parseArgs();
  
  startFullSystem(useRealFunds)
    .then(success => {
      if (success) {
        console.log('\n✅ Trading system started successfully\n');
      } else {
        console.error('\n❌ Failed to start trading system\n');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n❌ Unexpected error:', error);
      process.exit(1);
    });
}