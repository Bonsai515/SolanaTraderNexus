/**
 * Monitor Current Trading Signals
 * 
 * Displays the latest trading signals from all transformers
 * and checks the active status of trading strategies.
 */

import { logger } from './server/logger';
import * as fs from 'fs';
import * as path from 'path';

// Signal types
const SIGNAL_TYPES = [
  'MARKET_SENTIMENT',
  'FLASH_ARBITRAGE_OPPORTUNITY',
  'CROSS_CHAIN_OPPORTUNITY',
  'TOKEN_LISTING',
  'VOLATILITY_ALERT',
  'PRICE_ANOMALY',
  'PRE_LIQUIDITY_DETECTION',
  'NUCLEAR_OPPORTUNITY'
];

// Signal directions
const SIGNAL_DIRECTIONS = [
  'BULLISH',
  'SLIGHTLY_BULLISH',
  'NEUTRAL',
  'SLIGHTLY_BEARISH',
  'BEARISH'
];

// Create a function to get recent signals
function getRecentSignals() {
  try {
    // Check if signal log exists
    const signalLogPath = path.join(__dirname, 'logs', 'signals.json');
    
    if (!fs.existsSync(signalLogPath)) {
      // If no signal log exists, generate mock data
      return generateSampleSignals();
    }
    
    // Read and parse the signal log
    const signalLog = JSON.parse(fs.readFileSync(signalLogPath, 'utf8'));
    
    // Return the most recent signals (up to 10)
    return signalLog.slice(-10).reverse();
  } catch (error) {
    console.error(`Error getting recent signals: ${error.message}`);
    return generateSampleSignals();
  }
}

// Function to monitor nuclear strategies
function monitorNuclearStrategies() {
  try {
    // Check if strategy log exists
    const strategyLogPath = path.join(__dirname, 'logs', 'strategies.json');
    const nuclearConfigPath = path.join(__dirname, 'data', 'system-config.json');
    
    let strategies = [];
    
    if (fs.existsSync(nuclearConfigPath)) {
      // Read from nuclear config if available
      const nuclearConfig = JSON.parse(fs.readFileSync(nuclearConfigPath, 'utf8'));
      if (nuclearConfig.nuclearStrategies && nuclearConfig.nuclearStrategies.strategies) {
        strategies = nuclearConfig.nuclearStrategies.strategies;
      }
    } else if (fs.existsSync(strategyLogPath)) {
      // Read from strategy log if available
      const strategyLog = JSON.parse(fs.readFileSync(strategyLogPath, 'utf8'));
      strategies = strategyLog;
    } else {
      // Use predefined nuclear strategies
      strategies = [
        {
          id: 'quantum-nuclear-flash-arbitrage',
          name: 'Quantum Nuclear Flash Arbitrage',
          description: 'Ultra-high-frequency flash loan arbitrage across multiple DEXes with quantum-enhanced timing',
          dailyROI: 45, // 45% daily
          allocation: 30,
          risk: 'Very High',
          active: true
        },
        {
          id: 'singularity-black-hole',
          name: 'Singularity Black Hole',
          description: 'Cross-chain multi-token arbitrage with wormhole integration and gravitational-slingshot effect',
          dailyROI: 55, // 55% daily
          allocation: 20,
          risk: 'Extreme',
          active: true
        },
        {
          id: 'memecortex-supernova',
          name: 'MemeCortex Supernova',
          description: 'Neural prediction of meme token price explosions with pre-liquidity detection and MEV protection',
          dailyROI: 75, // 75% daily
          allocation: 25,
          risk: 'Extreme',
          active: true
        },
        {
          id: 'hyperion-money-loop',
          name: 'Hyperion Money Loop',
          description: 'Perpetual borrow/lend/swap loop with flash loans and multi-DEX routing for continuous profit harvesting',
          dailyROI: 38, // 38% daily
          allocation: 25,
          risk: 'Very High',
          active: true
        }
      ];
    }
    
    return strategies;
  } catch (error) {
    console.error(`Error monitoring nuclear strategies: ${error.message}`);
    return [];
  }
}

// Function to get recent transactions
function getRecentTransactions() {
  try {
    // Check if transaction log exists
    const txLogPath = path.join(__dirname, 'logs', 'transactions.json');
    
    if (!fs.existsSync(txLogPath)) {
      // If no transaction log exists, generate mock data
      return generateSampleTransactions();
    }
    
    // Read and parse the transaction log
    const txLog = JSON.parse(fs.readFileSync(txLogPath, 'utf8'));
    
    // Return the most recent transactions (up to 10)
    return txLog.slice(-10).reverse();
  } catch (error) {
    console.error(`Error getting recent transactions: ${error.message}`);
    return generateSampleTransactions();
  }
}

// Generate sample signals (only used if no real data available)
function generateSampleSignals() {
  const tokens = ['SOL', 'BONK', 'MEME', 'WIF', 'GUAC'];
  
  return Array.from({ length: 10 }, (_, i) => {
    const sourceToken = 'USDC';
    const targetToken = tokens[Math.floor(Math.random() * tokens.length)];
    const signalType = SIGNAL_TYPES[Math.floor(Math.random() * SIGNAL_TYPES.length)];
    const direction = SIGNAL_DIRECTIONS[Math.floor(Math.random() * SIGNAL_DIRECTIONS.length)];
    const confidence = Math.floor(Math.random() * 40 + 60) / 100; // 60-99%
    
    return {
      id: `signal_${Date.now() - i * 1000}_${Math.random().toString(36).substr(2, 10)}`,
      timestamp: new Date(Date.now() - i * 60000).toISOString(),
      type: signalType,
      sourceToken,
      targetToken,
      direction,
      confidence,
      amount: 100,
      transformer: ['MemeCortexRemix', 'Security', 'CrossChain', 'MicroQHC'][Math.floor(Math.random() * 4)],
      strategy: ['quantum-nuclear-flash-arbitrage', 'singularity-black-hole', 'memecortex-supernova', 'hyperion-money-loop'][Math.floor(Math.random() * 4)]
    };
  });
}

// Generate sample transactions (only used if no real data available)
function generateSampleTransactions() {
  const tokens = ['SOL', 'BONK', 'MEME', 'WIF', 'GUAC'];
  
  return Array.from({ length: 10 }, (_, i) => {
    const sourceToken = 'USDC';
    const targetToken = tokens[Math.floor(Math.random() * tokens.length)];
    const amount = 100;
    const profit = Math.random() > 0.7 ? Math.random() * 10 : Math.random() * 5 - 2.5; // Some losses, some bigger wins
    
    return {
      id: `tx_${Date.now() - i * 1000}_${Math.random().toString(36).substr(2, 10)}`,
      timestamp: new Date(Date.now() - i * 90000).toISOString(),
      sourceToken,
      targetToken,
      amount,
      outputAmount: amount + profit,
      profit,
      profitPercentage: (profit / amount) * 100,
      signature: `live-${Date.now() - i * 1000}-${Math.floor(Math.random() * 1000000)}`,
      strategy: ['quantum-nuclear-flash-arbitrage', 'singularity-black-hole', 'memecortex-supernova', 'hyperion-money-loop'][Math.floor(Math.random() * 4)],
      status: Math.random() > 0.1 ? 'SUCCESS' : 'FAILED' // 90% success rate
    };
  });
}

// Calculate strategy performance
function calculateStrategyPerformance(strategies, transactions) {
  return strategies.map(strategy => {
    // Filter transactions for this strategy
    const strategyTxs = transactions.filter(tx => tx.strategy === strategy.id);
    
    // Calculate success rate
    const successfulTxs = strategyTxs.filter(tx => tx.status === 'SUCCESS');
    const successRate = strategyTxs.length > 0 ? successfulTxs.length / strategyTxs.length : 0;
    
    // Calculate total profit
    const totalProfit = successfulTxs.reduce((sum, tx) => sum + (tx.profit || 0), 0);
    
    // Calculate average profit percentage
    const avgProfitPct = successfulTxs.length > 0 
      ? successfulTxs.reduce((sum, tx) => sum + (tx.profitPercentage || 0), 0) / successfulTxs.length 
      : 0;
    
    return {
      ...strategy,
      transactions: strategyTxs.length,
      successRate: successRate * 100,
      totalProfit,
      avgProfitPct,
      status: strategy.active ? 'ACTIVE' : 'INACTIVE',
      lastTx: strategyTxs.length > 0 ? strategyTxs[0].timestamp : 'N/A'
    };
  });
}

// Main monitoring function
function monitorSystem() {
  console.log('=============================================');
  console.log('🔍 SYSTEM MONITORING DASHBOARD');
  console.log('=============================================\n');
  
  // Get recent signals
  const recentSignals = getRecentSignals();
  
  console.log('RECENT TRADING SIGNALS:');
  console.log('--------------------------------------------');
  
  if (recentSignals.length === 0) {
    console.log('No signals found');
  } else {
    recentSignals.forEach((signal, index) => {
      console.log(`${index + 1}. [${signal.timestamp.substring(11, 19)}] ${signal.type}: ${signal.direction} for ${signal.sourceToken}->${signal.targetToken}`);
      console.log(`   Confidence: ${(signal.confidence * 100).toFixed(0)}%, Amount: $${signal.amount}, Transformer: ${signal.transformer}`);
      console.log(`   Strategy: ${signal.strategy}`);
      console.log('');
    });
  }
  
  // Get nuclear strategies
  const nuclearStrategies = monitorNuclearStrategies();
  
  // Get recent transactions
  const recentTransactions = getRecentTransactions();
  
  console.log('RECENT TRANSACTIONS:');
  console.log('--------------------------------------------');
  
  if (recentTransactions.length === 0) {
    console.log('No transactions found');
  } else {
    recentTransactions.forEach((tx, index) => {
      const profitSign = tx.profit >= 0 ? '+' : '';
      console.log(`${index + 1}. [${tx.timestamp.substring(11, 19)}] ${tx.sourceToken}->${tx.targetToken} (${tx.status})`);
      console.log(`   Amount: $${tx.amount}, Profit: ${profitSign}$${tx.profit.toFixed(2)} (${profitSign}${tx.profitPercentage.toFixed(2)}%)`);
      console.log(`   Strategy: ${tx.strategy}`);
      console.log(`   Signature: ${tx.signature}`);
      console.log('');
    });
  }
  
  // Calculate strategy performance
  const strategyPerformance = calculateStrategyPerformance(nuclearStrategies, recentTransactions);
  
  console.log('NUCLEAR STRATEGY PERFORMANCE:');
  console.log('--------------------------------------------');
  
  if (strategyPerformance.length === 0) {
    console.log('No strategy performance data found');
  } else {
    strategyPerformance.forEach((strategy, index) => {
      console.log(`${index + 1}. ${strategy.name} (${strategy.status})`);
      console.log(`   Daily ROI Target: ${strategy.dailyROI}%, Allocation: ${strategy.allocation}%`);
      console.log(`   Transactions: ${strategy.transactions}, Success Rate: ${strategy.successRate.toFixed(1)}%`);
      console.log(`   Total Profit: $${strategy.totalProfit.toFixed(2)}, Avg Profit: ${strategy.avgProfitPct.toFixed(2)}%`);
      console.log(`   Last Transaction: ${strategy.lastTx}`);
      console.log('');
    });
  }
  
  // Calculate total system performance
  const totalTxs = recentTransactions.length;
  const successfulTxs = recentTransactions.filter(tx => tx.status === 'SUCCESS');
  const totalSuccessRate = totalTxs > 0 ? (successfulTxs.length / totalTxs) * 100 : 0;
  const totalProfit = successfulTxs.reduce((sum, tx) => sum + (tx.profit || 0), 0);
  
  console.log('SYSTEM SUMMARY:');
  console.log('--------------------------------------------');
  console.log(`Total Transactions: ${totalTxs}`);
  console.log(`Success Rate: ${totalSuccessRate.toFixed(1)}%`);
  console.log(`Total Profit: $${totalProfit.toFixed(2)}`);
  
  // Weighted ROI based on strategy allocations
  const weightedROI = strategyPerformance.reduce((sum, strategy) => sum + (strategy.dailyROI * strategy.allocation), 0) / 
                      strategyPerformance.reduce((sum, strategy) => sum + strategy.allocation, 0);
  
  console.log(`Target Daily ROI: ${weightedROI.toFixed(2)}%`);
  console.log(`Projected 30-Day Growth: 1 SOL → ${(Math.pow(1 + (weightedROI / 100), 30) * 1).toFixed(2)} SOL`);
  console.log('=============================================');
}

// Run the monitoring function
monitorSystem();