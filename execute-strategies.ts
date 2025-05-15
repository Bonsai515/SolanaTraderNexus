#!/usr/bin/env ts-node
/**
 * Execute Trading Strategies
 * 
 * This script executes all trading strategies in the system, including:
 * 1. Flash Loan Arbitrage
 * 2. Momentum Surfing
 * 3. Cross-Chain Opportunities
 */

import { logger } from './server/logger';
import { memeCortexEnhanced } from './server/transformers/MemeCortexEnhanced';
import { EnhancedTransactionEngine, ExecutionMode, TransactionPriority, initializeNexusEngine } from './server/nexus-transaction-engine';
import { FlashLoanArbitrageStrategy } from './server/strategies/FlashLoanArbitrageStrategy';
import { MomentumSurfingStrategy } from './server/strategies/MomentumSurfingStrategy';
import * as fs from 'fs';
import * as path from 'path';

// Create directories if they don't exist
function ensureDirectoriesExist() {
  const directories = [
    './logs',
    './data',
    './config'
  ];
  
  for (const dir of directories) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  }
}

// Initialize Nexus transaction engine
function initializeEngine(): EnhancedTransactionEngine {
  console.log('Initializing Nexus Professional Transaction Engine...');
  
  // Default configuration
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
    mevProtection: true
  };
  
  return initializeNexusEngine(nexusConfig);
}

// Initialize strategies
function initializeStrategies(engine: EnhancedTransactionEngine): {
  flashLoanStrategy: FlashLoanArbitrageStrategy;
  momentumStrategy: MomentumSurfingStrategy;
} {
  console.log('Initializing trading strategies...');
  
  // Initialize Flash Loan Arbitrage Strategy
  const flashLoanStrategy = new FlashLoanArbitrageStrategy(engine);
  flashLoanStrategy.activate();
  
  // Initialize Momentum Surfing Strategy
  const momentumStrategy = new MomentumSurfingStrategy(memeCortexEnhanced);
  momentumStrategy.activate();
  
  return {
    flashLoanStrategy,
    momentumStrategy
  };
}

// Monitor strategy performance
function monitorStrategies(
  flashLoanStrategy: FlashLoanArbitrageStrategy,
  momentumStrategy: MomentumSurfingStrategy
): NodeJS.Timeout {
  console.log('Setting up strategy performance monitoring...');
  
  return setInterval(() => {
    // Get Flash Loan strategy metrics
    const flashLoanMetrics = flashLoanStrategy.getMetrics();
    logger.info('=== FLASH LOAN ARBITRAGE METRICS ===');
    logger.info(`Total Executions: ${flashLoanMetrics.executionCount}`);
    logger.info(`Success Rate: ${(flashLoanMetrics.successRate * 100).toFixed(2)}%`);
    logger.info(`Total Profit: $${flashLoanMetrics.totalProfitUsd.toFixed(2)}`);
    logger.info(`Average Profit: $${flashLoanMetrics.averageProfitUsd.toFixed(2)}`);
    logger.info(`Active: ${flashLoanMetrics.active ? 'Yes' : 'No'}`);
    
    // Get Momentum strategy metrics
    const momentumMetrics = momentumStrategy.getMetrics();
    logger.info('=== MOMENTUM SURFING STRATEGY METRICS ===');
    logger.info(`Total Trades: ${momentumMetrics.totalTrades}`);
    logger.info(`Win Rate: ${(momentumMetrics.winRate * 100).toFixed(2)}%`);
    logger.info(`Total Profit: $${momentumMetrics.totalProfitUsd.toFixed(2)}`);
    logger.info(`Active Positions: ${momentumMetrics.activePositions}`);
    logger.info(`Active: ${momentumMetrics.active ? 'Yes' : 'No'}`);
    
    // Get active trade setups
    const activeSetups = momentumStrategy.getCurrentTradeSetups();
    logger.info(`Current Trade Setups: ${activeSetups.length}`);
    
    // Get active trade executions
    const activeExecutions = momentumStrategy.getActiveTradeExecutions();
    logger.info(`Active Trade Executions: ${activeExecutions.length}`);
    
  }, 60000); // Every minute
}

// Main function
async function main() {
  console.log('===== STRATEGY EXECUTION SYSTEM STARTING =====');
  
  try {
    // Ensure directories exist
    ensureDirectoriesExist();
    
    // Initialize transaction engine
    const engine = initializeEngine();
    
    // Initialize strategies
    const { flashLoanStrategy, momentumStrategy } = initializeStrategies(engine);
    
    // Start monitoring
    const monitorInterval = monitorStrategies(flashLoanStrategy, momentumStrategy);
    
    console.log('===== STRATEGY EXECUTION SYSTEM RUNNING =====');
    console.log('Press Ctrl+C to stop');
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('Shutting down...');
      clearInterval(monitorInterval);
      
      // Deactivate strategies
      flashLoanStrategy.deactivate();
      momentumStrategy.deactivate();
      
      console.log('Strategies deactivated');
      process.exit(0);
    });
  } catch (error) {
    console.error('Error starting strategy execution system:', error);
    process.exit(1);
  }
}

// Run the main function
if (require.main === module) {
  main().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}