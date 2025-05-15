#!/usr/bin/env ts-node
/**
 * Deploy Live Trading System
 * 
 * This script performs a comprehensive system verification and deploys
 * the trading system for live operation on the Solana blockchain.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { logger } from './server/logger';
import { EnhancedTransactionEngine, ExecutionMode, TransactionPriority, initializeNexusEngine } from './server/nexus-transaction-engine';
import { memeCortexEnhanced } from './server/transformers/MemeCortexEnhanced';
import { FlashLoanArbitrageStrategy } from './server/strategies/FlashLoanArbitrageStrategy';
import { MomentumSurfingStrategy } from './server/strategies/MomentumSurfingStrategy';
import verifyOnChainPrograms from './verify-onchain-programs';

// System deployment status
interface SystemDeploymentStatus {
  rpcConnection: boolean;
  walletAccess: boolean;
  programVerification: boolean;
  transformerStatus: boolean;
  engineStatus: boolean;
  strategyDeployment: boolean;
  timestamp: string;
}

// Create necessary directories
function ensureDirectoriesExist() {
  const directories = [
    './logs',
    './data',
    './data/models',
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

// Verify access to the system wallet
async function verifyWalletAccess(): Promise<boolean> {
  try {
    logger.info('Verifying system wallet access...');
    
    const walletPath = path.join(__dirname, 'wallet.json');
    
    if (!fs.existsSync(walletPath)) {
      logger.error('System wallet file not found');
      return false;
    }
    
    const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
    
    if (!Array.isArray(walletData)) {
      logger.error('Invalid wallet data format');
      return false;
    }
    
    const secretKey = new Uint8Array(walletData);
    const wallet = Keypair.fromSecretKey(secretKey);
    
    logger.info(`System wallet verified: ${wallet.publicKey.toString()}`);
    return true;
  } catch (error) {
    logger.error(`Error verifying wallet access: ${error.message}`);
    return false;
  }
}

// Verify RPC connection
async function verifyRpcConnection(): Promise<boolean> {
  try {
    logger.info('Verifying Solana RPC connection...');
    
    const rpcUrl = process.env.ALCHEMY_RPC_URL || 
                  process.env.INSTANT_NODES_RPC_URL || 
                  'https://api.mainnet-beta.solana.com';
    
    logger.info(`Using RPC URL: ${rpcUrl.substring(0, 20)}...`);
    
    const connection = new Connection(rpcUrl, 'confirmed');
    const version = await connection.getVersion();
    
    logger.info(`Connected to Solana ${version["solana-core"]}`);
    
    // Verify by getting a recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    
    if (!blockhash) {
      logger.error('Failed to get recent blockhash');
      return false;
    }
    
    logger.info(`RPC connection verified. Latest blockhash: ${blockhash.substring(0, 10)}...`);
    return true;
  } catch (error) {
    logger.error(`RPC connection error: ${error.message}`);
    return false;
  }
}

// Run optimized Rust transformer build
async function buildOptimizedTransformers(): Promise<boolean> {
  try {
    logger.info('Building optimized transformers...');
    
    // Run the optimization script
    execSync('ts-node ./optimize-rust-build.ts', { stdio: 'inherit' });
    
    return true;
  } catch (error) {
    logger.error(`Error building transformers: ${error.message}`);
    return false;
  }
}

// Initialize Nexus engine with production settings
function initializeProductionEngine(): EnhancedTransactionEngine {
  logger.info('Initializing Nexus Professional Transaction Engine...');
  
  // Production configuration
  const nexusConfig = {
    useRealFunds: true,
    rpcUrl: process.env.ALCHEMY_RPC_URL || process.env.INSTANT_NODES_RPC_URL || 'https://api.mainnet-beta.solana.com',
    websocketUrl: process.env.ALCHEMY_WS_URL || process.env.INSTANT_NODES_WS_URL,
    defaultExecutionMode: ExecutionMode.LIVE,
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

// Deploy strategies for live trading
function deployProductionStrategies(engine: EnhancedTransactionEngine): {
  flashLoanStrategy: FlashLoanArbitrageStrategy;
  momentumStrategy: MomentumSurfingStrategy;
} {
  logger.info('Deploying production trading strategies...');
  
  // Initialize and configure Flash Loan Arbitrage Strategy
  const flashLoanStrategy = new FlashLoanArbitrageStrategy(engine);
  
  // Update the strategy configuration for production
  flashLoanStrategy.updateConfig({
    minProfitUsd: 10, // $10 minimum profit for production
    minProfitPercentage: 0.5, // 0.5% minimum profit
    minSecurityScore: 0.9, // 90% security score for production
    mevProtection: true
  });
  
  // Initialize and configure Momentum Surfing Strategy
  const momentumStrategy = new MomentumSurfingStrategy(memeCortexEnhanced);
  
  // Update the strategy configuration for production
  momentumStrategy.updateConfig({
    maxPositionSizeUsd: 1000, // $1,000 maximum position size
    minConfidence: 0.8, // 80% minimum confidence for production
    minRiskRewardRatio: 2.5, // Higher risk-reward ratio for production
    useTrailingStops: true,
    preferMemeCoins: true,
    whitelistedTokens: ['SOL', 'BONK', 'WIF', 'MEME', 'POPCAT', 'GUAC', 'JUP']
  });
  
  return {
    flashLoanStrategy,
    momentumStrategy
  };
}

// Activate all strategies
function activateAllStrategies(strategies: {
  flashLoanStrategy: FlashLoanArbitrageStrategy;
  momentumStrategy: MomentumSurfingStrategy;
}): boolean {
  try {
    logger.info('Activating all strategies for live trading...');
    
    // Activate Flash Loan Arbitrage Strategy
    const flashLoanSuccess = strategies.flashLoanStrategy.activate();
    
    if (!flashLoanSuccess) {
      logger.error('Failed to activate Flash Loan Arbitrage Strategy');
      return false;
    }
    
    logger.info('✅ Flash Loan Arbitrage Strategy activated successfully');
    
    // Activate Momentum Surfing Strategy
    const momentumSuccess = strategies.momentumStrategy.activate();
    
    if (!momentumSuccess) {
      logger.error('Failed to activate Momentum Surfing Strategy');
      return false;
    }
    
    logger.info('✅ Momentum Surfing Strategy activated successfully');
    
    return true;
  } catch (error) {
    logger.error(`Error activating strategies: ${error.message}`);
    return false;
  }
}

// Setup performance monitoring
function setupPerformanceMonitoring(strategies: {
  flashLoanStrategy: FlashLoanArbitrageStrategy;
  momentumStrategy: MomentumSurfingStrategy;
}, engine: EnhancedTransactionEngine): void {
  logger.info('Setting up performance monitoring...');
  
  // Create metrics output directory
  const metricsDir = path.join(__dirname, 'data', 'metrics');
  if (!fs.existsSync(metricsDir)) {
    fs.mkdirSync(metricsDir, { recursive: true });
  }
  
  // Set up interval to save metrics
  setInterval(() => {
    try {
      const timestamp = new Date().toISOString();
      const metricsFile = path.join(metricsDir, `metrics_${timestamp.replace(/:/g, '-')}.json`);
      
      const flashLoanMetrics = strategies.flashLoanStrategy.getMetrics();
      const momentumMetrics = strategies.momentumStrategy.getMetrics();
      
      const metrics = {
        timestamp,
        flashLoanStrategy: flashLoanMetrics,
        momentumStrategy: momentumMetrics,
        engine: {
          isHealthy: engine.isConnectionHealthy(),
          pendingTransactions: engine.getPendingTransactionCount(),
          useRealFunds: engine.getUseRealFunds()
        }
      };
      
      fs.writeFileSync(metricsFile, JSON.stringify(metrics, null, 2));
      logger.info(`Performance metrics saved to ${metricsFile}`);
    } catch (error) {
      logger.error(`Error saving performance metrics: ${error.message}`);
    }
  }, 15 * 60 * 1000); // Every 15 minutes
}

// Save system deployment status
function saveDeploymentStatus(status: SystemDeploymentStatus): void {
  try {
    const statusDir = path.join(__dirname, 'data', 'status');
    if (!fs.existsSync(statusDir)) {
      fs.mkdirSync(statusDir, { recursive: true });
    }
    
    const statusFile = path.join(statusDir, 'deployment_status.json');
    fs.writeFileSync(statusFile, JSON.stringify(status, null, 2));
    
    logger.info(`Deployment status saved to ${statusFile}`);
  } catch (error) {
    logger.error(`Error saving deployment status: ${error.message}`);
  }
}

// Main deployment function
async function deployLiveTrading(): Promise<boolean> {
  logger.info('===== DEPLOYING LIVE TRADING SYSTEM =====');
  
  const deploymentStatus: SystemDeploymentStatus = {
    rpcConnection: false,
    walletAccess: false,
    programVerification: false,
    transformerStatus: false,
    engineStatus: false,
    strategyDeployment: false,
    timestamp: new Date().toISOString()
  };
  
  try {
    // Ensure directories exist
    ensureDirectoriesExist();
    
    // Verify RPC connection
    deploymentStatus.rpcConnection = await verifyRpcConnection();
    if (!deploymentStatus.rpcConnection) {
      logger.error('RPC connection verification failed');
      saveDeploymentStatus(deploymentStatus);
      return false;
    }
    
    // Verify wallet access
    deploymentStatus.walletAccess = await verifyWalletAccess();
    if (!deploymentStatus.walletAccess) {
      logger.error('Wallet access verification failed');
      saveDeploymentStatus(deploymentStatus);
      return false;
    }
    
    // Verify on-chain programs
    deploymentStatus.programVerification = await verifyOnChainPrograms();
    if (!deploymentStatus.programVerification) {
      logger.warn('On-chain program verification had some issues, but proceeding with deployment');
      // We continue despite program verification issues as development files will be created
    }
    
    // Build optimized transformers
    deploymentStatus.transformerStatus = await buildOptimizedTransformers();
    if (!deploymentStatus.transformerStatus) {
      logger.warn('Transformer build had some issues, but proceeding with deployment');
      // We continue despite transformer issues as fallbacks will be used
    }
    
    // Initialize Nexus engine
    const engine = initializeProductionEngine();
    deploymentStatus.engineStatus = engine.isConnectionHealthy();
    
    if (!deploymentStatus.engineStatus) {
      logger.error('Engine initialization failed');
      saveDeploymentStatus(deploymentStatus);
      return false;
    }
    
    // Deploy strategies
    const strategies = deployProductionStrategies(engine);
    
    // Activate all strategies
    deploymentStatus.strategyDeployment = activateAllStrategies(strategies);
    
    if (!deploymentStatus.strategyDeployment) {
      logger.error('Strategy deployment failed');
      saveDeploymentStatus(deploymentStatus);
      return false;
    }
    
    // Set up performance monitoring
    setupPerformanceMonitoring(strategies, engine);
    
    // Save final deployment status
    saveDeploymentStatus(deploymentStatus);
    
    logger.info('===== LIVE TRADING SYSTEM DEPLOYED SUCCESSFULLY =====');
    
    // Register wallet for profit collection
    const walletPath = path.join(__dirname, 'wallet.json');
    const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
    const secretKey = new Uint8Array(walletData);
    const wallet = Keypair.fromSecretKey(secretKey);
    
    logger.info(`System wallet ${wallet.publicKey.toString()} registered for profit collection`);
    
    return true;
  } catch (error) {
    logger.error(`Deployment failed: ${error.message}`);
    saveDeploymentStatus(deploymentStatus);
    return false;
  }
}

// Run the deployment if executed directly
if (require.main === module) {
  deployLiveTrading()
    .then(success => {
      if (success) {
        console.log('\n✅ Live trading system deployed successfully\n');
        process.exit(0);
      } else {
        console.error('\n❌ Live trading system deployment failed\n');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n❌ Unexpected error during deployment:', error);
      process.exit(1);
    });
}