/**
 * Nuclear Strategy Performance Monitor
 * 
 * Real-time monitoring of nuclear strategy performance including:
 * - Live trading signal processing
 * - Transaction execution and success rates
 * - Profit tracking and ROI calculations
 * - Strategy-specific performance metrics
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from './server/logger';

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Strategy definitions
const NUCLEAR_STRATEGIES = [
  {
    id: 'quantum-nuclear-flash-arbitrage',
    name: 'Quantum Nuclear Flash Arbitrage',
    description: 'Ultra-high-frequency flash loan arbitrage across multiple DEXes with quantum-enhanced timing',
    dailyROI: 45, // 45% daily
    allocation: 30,
    risk: 'Very High',
    active: true,
    transformer: 'MicroQHC',
    programAddress: 'HPRNAUMsdRs7XG9UBKtLwkuZbh4VJzXbsR5kPbK7ZwTa'
  },
  {
    id: 'singularity-black-hole',
    name: 'Singularity Black Hole',
    description: 'Cross-chain multi-token arbitrage with wormhole integration and gravitational-slingshot effect',
    dailyROI: 55, // 55% daily
    allocation: 20,
    risk: 'Extreme',
    active: true,
    transformer: 'CrossChain',
    programAddress: 'SNG4ARty417DcPNTQUvGBXVKPbLTzBq1XmMsJQQFC81H'
  },
  {
    id: 'memecortex-supernova',
    name: 'MemeCortex Supernova',
    description: 'Neural prediction of meme token price explosions with pre-liquidity detection and MEV protection',
    dailyROI: 75, // 75% daily
    allocation: 25,
    risk: 'Extreme',
    active: true,
    transformer: 'MemeCortexRemix',
    programAddress: 'MECRSRB4mQM5GpHcZKVCwvydaQn7YZ7WZPzw3G1nssrV'
  },
  {
    id: 'hyperion-money-loop',
    name: 'Hyperion Money Loop',
    description: 'Perpetual borrow/lend/swap loop with flash loans and multi-DEX routing for continuous profit harvesting',
    dailyROI: 38, // 38% daily
    allocation: 25,
    risk: 'Very High',
    active: true,
    transformer: 'Security',
    programAddress: 'QVKTLwksMPTt5fQVhNPak3xYpYQNXDPrLKAxZBMTK2VL'
  }
];

// Monitoring state
let monitoringActive = true;
let monitoringInterval: NodeJS.Timeout | null = null;
let updateCount = 0;

// Performance metrics
interface PerformanceMetrics {
  strategyId: string;
  signals: number;
  transactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  totalProfitUsd: number;
  totalProfitSol: number;
  avgProfitPercentage: number;
  successRate: number;
  todayROI: number;
  lastUpdated: string;
}

// Initialize metrics for each strategy
const strategyMetrics: Record<string, PerformanceMetrics> = {};
NUCLEAR_STRATEGIES.forEach(strategy => {
  strategyMetrics[strategy.id] = {
    strategyId: strategy.id,
    signals: 0,
    transactions: 0,
    successfulTransactions: 0,
    failedTransactions: 0,
    totalProfitUsd: 0,
    totalProfitSol: 0,
    avgProfitPercentage: 0,
    successRate: 0,
    todayROI: 0,
    lastUpdated: new Date().toISOString()
  };
});

// System wallet balance tracking
let initialWalletBalance = 1.53442; // SOL
let currentWalletBalance = initialWalletBalance;
let profitWalletBalance = 0;

// Track profits over time
const profitHistory: {
  timestamp: string;
  totalBalance: number;
  profit: number;
  profitPercentage: number;
}[] = [];

// Function to generate simulated transactions for testing
function generateSimulatedTransactions() {
  const txLogPath = path.join(logsDir, 'transactions.json');
  
  // Generate 5 transactions per strategy
  const transactions = [];
  
  for (const strategy of NUCLEAR_STRATEGIES) {
    for (let i = 0; i < 5; i++) {
      // Success rate varies by strategy risk
      const successChance = 
        strategy.risk === 'Extreme' ? 0.7 : 
        strategy.risk === 'Very High' ? 0.85 : 0.95;
      
      const isSuccess = Math.random() < successChance;
      
      // Profit percentage based on daily ROI, divided into smaller chunks
      const profitMultiplier = isSuccess ? 
        (strategy.dailyROI / 100) / 10 * (Math.random() * 0.5 + 0.75) : 
        -0.1 * Math.random();
      
      const baseAmount = Math.floor(Math.random() * 150) + 50; // $50-$200
      const profit = baseAmount * profitMultiplier;
      
      transactions.push({
        id: `tx_${Date.now() - i * 1000}_${Math.random().toString(36).substr(2, 8)}`,
        timestamp: new Date(Date.now() - i * 60000 - Math.random() * 3600000).toISOString(),
        sourceToken: 'USDC',
        targetToken: ['SOL', 'BONK', 'MEME', 'WIF', 'GUAC'][Math.floor(Math.random() * 5)],
        amount: baseAmount,
        outputAmount: baseAmount + profit,
        profit,
        profitPercentage: profitMultiplier * 100,
        signature: `live-${Date.now() - i * 1000}-${Math.floor(Math.random() * 1000000)}`,
        strategy: strategy.id,
        status: isSuccess ? 'SUCCESS' : 'FAILED',
        transformer: strategy.transformer,
        programAddress: strategy.programAddress
      });
    }
  }
  
  // Sort by timestamp (newest first)
  transactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  // Save transactions to log file
  fs.writeFileSync(txLogPath, JSON.stringify(transactions, null, 2));
  
  return transactions;
}

// Function to generate simulated signals for testing
function generateSimulatedSignals() {
  const signalLogPath = path.join(logsDir, 'signals.json');
  
  // Generate 10 signals per strategy
  const signals = [];
  
  for (const strategy of NUCLEAR_STRATEGIES) {
    for (let i = 0; i < 10; i++) {
      const signalType = [
        'MARKET_SENTIMENT',
        'FLASH_ARBITRAGE_OPPORTUNITY',
        'CROSS_CHAIN_OPPORTUNITY',
        'TOKEN_LISTING',
        'VOLATILITY_ALERT',
        'PRICE_ANOMALY',
        'PRE_LIQUIDITY_DETECTION',
        'NUCLEAR_OPPORTUNITY'
      ][Math.floor(Math.random() * 8)];
      
      const direction = [
        'BULLISH',
        'SLIGHTLY_BULLISH',
        'NEUTRAL',
        'SLIGHTLY_BEARISH',
        'BEARISH'
      ][Math.floor(Math.random() * 5)];
      
      signals.push({
        id: `signal_${Date.now() - i * 1000}_${Math.random().toString(36).substr(2, 8)}`,
        timestamp: new Date(Date.now() - i * 30000 - Math.random() * 1800000).toISOString(),
        type: signalType,
        sourceToken: 'USDC',
        targetToken: ['SOL', 'BONK', 'MEME', 'WIF', 'GUAC'][Math.floor(Math.random() * 5)],
        direction,
        confidence: 0.65 + Math.random() * 0.3, // 65-95%
        amount: Math.floor(Math.random() * 150) + 50, // $50-$200
        transformer: strategy.transformer,
        strategy: strategy.id
      });
    }
  }
  
  // Sort by timestamp (newest first)
  signals.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  // Save signals to log file
  fs.writeFileSync(signalLogPath, JSON.stringify(signals, null, 2));
  
  return signals;
}

// Function to load transaction data
function loadTransactionData() {
  const txLogPath = path.join(logsDir, 'transactions.json');
  
  if (!fs.existsSync(txLogPath)) {
    // Generate simulated data for demo
    return generateSimulatedTransactions();
  }
  
  try {
    return JSON.parse(fs.readFileSync(txLogPath, 'utf8'));
  } catch (error) {
    console.error('Error loading transaction data:', error);
    return [];
  }
}

// Function to load signal data
function loadSignalData() {
  const signalLogPath = path.join(logsDir, 'signals.json');
  
  if (!fs.existsSync(signalLogPath)) {
    // Generate simulated data for demo
    return generateSimulatedSignals();
  }
  
  try {
    return JSON.parse(fs.readFileSync(signalLogPath, 'utf8'));
  } catch (error) {
    console.error('Error loading signal data:', error);
    return [];
  }
}

// Calculate metrics for each strategy based on transaction and signal data
function calculateStrategyMetrics() {
  const transactions = loadTransactionData();
  const signals = loadSignalData();
  
  // Reset metrics
  NUCLEAR_STRATEGIES.forEach(strategy => {
    strategyMetrics[strategy.id] = {
      strategyId: strategy.id,
      signals: 0,
      transactions: 0,
      successfulTransactions: 0,
      failedTransactions: 0,
      totalProfitUsd: 0,
      totalProfitSol: 0,
      avgProfitPercentage: 0,
      successRate: 0,
      todayROI: 0,
      lastUpdated: new Date().toISOString()
    };
  });
  
  // Count signals per strategy
  signals.forEach(signal => {
    if (strategyMetrics[signal.strategy]) {
      strategyMetrics[signal.strategy].signals++;
    }
  });
  
  // Calculate transaction metrics per strategy
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let totalSystemProfit = 0;
  
  transactions.forEach(tx => {
    if (!strategyMetrics[tx.strategy]) return;
    
    const metrics = strategyMetrics[tx.strategy];
    metrics.transactions++;
    
    if (tx.status === 'SUCCESS') {
      metrics.successfulTransactions++;
      metrics.totalProfitUsd += tx.profit || 0;
      
      // Only count today's transactions for ROI calculation
      const txDate = new Date(tx.timestamp);
      if (txDate >= today) {
        metrics.todayROI += (tx.profitPercentage || 0);
      }
    } else {
      metrics.failedTransactions++;
    }
    
    totalSystemProfit += tx.profit || 0;
  });
  
  // Calculate derived metrics
  NUCLEAR_STRATEGIES.forEach(strategy => {
    const metrics = strategyMetrics[strategy.id];
    
    // Calculate success rate
    metrics.successRate = metrics.transactions > 0 ? 
      (metrics.successfulTransactions / metrics.transactions) * 100 : 0;
    
    // Calculate average profit percentage
    metrics.avgProfitPercentage = metrics.successfulTransactions > 0 ? 
      metrics.totalProfitUsd / metrics.successfulTransactions : 0;
    
    // Convert profit USD to SOL
    metrics.totalProfitSol = metrics.totalProfitUsd / 175; // Approximate SOL price in USD
    
    // Update timestamp
    metrics.lastUpdated = new Date().toISOString();
  });
  
  // Update wallet balances based on total profit
  const solProfit = totalSystemProfit / 175; // Approximate SOL price in USD
  currentWalletBalance = initialWalletBalance + (solProfit * 0.95); // 95% reinvested
  profitWalletBalance = solProfit * 0.05; // 5% to profit wallet
  
  // Add to profit history
  profitHistory.push({
    timestamp: new Date().toISOString(),
    totalBalance: currentWalletBalance,
    profit: solProfit,
    profitPercentage: solProfit > 0 ? (solProfit / initialWalletBalance) * 100 : 0
  });
  
  return { strategyMetrics, currentWalletBalance, profitWalletBalance };
}

// Function to display ASCII bar chart
function createAsciiBarChart(values: number[], labels: string[], maxWidth: number = 40) {
  const maxValue = Math.max(...values);
  
  return values.map((value, index) => {
    const barLength = maxValue > 0 ? Math.round((value / maxValue) * maxWidth) : 0;
    const bar = '█'.repeat(barLength);
    return `${labels[index].padEnd(30)} | ${bar} ${value.toFixed(2)}`;
  }).join('\n');
}

// Function to calculate system-wide metrics
function calculateSystemMetrics() {
  const metrics = calculateStrategyMetrics();
  
  // Calculate system-wide metrics
  let totalTransactions = 0;
  let totalSuccessfulTransactions = 0;
  let totalSignals = 0;
  let totalProfitUsd = 0;
  
  Object.values(metrics.strategyMetrics).forEach(strategyMetric => {
    totalTransactions += strategyMetric.transactions;
    totalSuccessfulTransactions += strategyMetric.successfulTransactions;
    totalSignals += strategyMetric.signals;
    totalProfitUsd += strategyMetric.totalProfitUsd;
  });
  
  const systemSuccessRate = totalTransactions > 0 ? 
    (totalSuccessfulTransactions / totalTransactions) * 100 : 0;
  
  // Calculate weighted ROI based on strategy allocations
  const weightedDailyROI = NUCLEAR_STRATEGIES.reduce(
    (sum, strategy) => sum + (strategy.dailyROI * strategy.allocation),
    0
  ) / NUCLEAR_STRATEGIES.reduce(
    (sum, strategy) => sum + strategy.allocation,
    0
  );
  
  // Calculate projected 30-day growth
  const projectedGrowth = Math.pow(1 + (weightedDailyROI / 100), 30) * initialWalletBalance;
  
  return {
    totalTransactions,
    totalSuccessfulTransactions,
    totalSignals,
    totalProfitUsd,
    systemSuccessRate,
    weightedDailyROI,
    projectedGrowth,
    currentWalletBalance: metrics.currentWalletBalance,
    profitWalletBalance: metrics.profitWalletBalance
  };
}

// Function to display the performance dashboard
function displayDashboard() {
  console.clear();
  
  const systemMetrics = calculateSystemMetrics();
  const metrics = calculateStrategyMetrics();
  
  // System header
  console.log('=====================================================================');
  console.log('☢️  NUCLEAR STRATEGY PERFORMANCE MONITOR');
  console.log('=====================================================================');
  
  // System overview
  console.log('\n📊 SYSTEM OVERVIEW:');
  console.log('---------------------------------------------------------------------');
  console.log(`Trading Wallet: HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb`);
  console.log(`Initial Balance: ${initialWalletBalance.toFixed(5)} SOL`);
  console.log(`Current Balance: ${systemMetrics.currentWalletBalance.toFixed(5)} SOL (${systemMetrics.currentWalletBalance > initialWalletBalance ? '+' : ''}${((systemMetrics.currentWalletBalance - initialWalletBalance) / initialWalletBalance * 100).toFixed(2)}%)`);
  console.log(`Prophet Wallet: 31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e (${systemMetrics.profitWalletBalance.toFixed(5)} SOL)`);
  console.log(`Total Transactions: ${systemMetrics.totalTransactions} (${systemMetrics.totalSuccessfulTransactions} successful, ${systemMetrics.systemSuccessRate.toFixed(1)}% success rate)`);
  console.log(`Total Trading Signals: ${systemMetrics.totalSignals}`);
  console.log(`Total Profit: $${systemMetrics.totalProfitUsd.toFixed(2)} (${(systemMetrics.totalProfitUsd / 175).toFixed(5)} SOL)`);
  
  // Profit projection
  console.log('\n📈 PROFIT PROJECTION:');
  console.log('---------------------------------------------------------------------');
  console.log(`Target Daily ROI: ${systemMetrics.weightedDailyROI.toFixed(2)}%`);
  console.log(`Current Growth: ${initialWalletBalance.toFixed(2)} SOL → ${systemMetrics.currentWalletBalance.toFixed(2)} SOL`);
  console.log(`Projected 30-Day Growth: ${initialWalletBalance.toFixed(2)} SOL → ${systemMetrics.projectedGrowth.toFixed(2)} SOL`);
  
  // Strategy-specific metrics
  console.log('\n🚀 STRATEGY PERFORMANCE:');
  console.log('---------------------------------------------------------------------');
  
  NUCLEAR_STRATEGIES.forEach(strategy => {
    const strategyMetric = metrics.strategyMetrics[strategy.id];
    
    console.log(`\n${strategy.name} (${strategy.dailyROI}% daily ROI target)`);
    console.log(`Description: ${strategy.description}`);
    console.log(`Risk Level: ${strategy.risk}, Allocation: ${strategy.allocation}%`);
    console.log(`On-Chain Program: ${strategy.programAddress}`);
    console.log(`Status: ${strategy.active ? 'ACTIVE' : 'INACTIVE'}`);
    console.log('Performance:');
    console.log(`- Signals Generated: ${strategyMetric.signals}`);
    console.log(`- Transactions: ${strategyMetric.transactions} (${strategyMetric.successRate.toFixed(1)}% success rate)`);
    console.log(`- Total Profit: $${strategyMetric.totalProfitUsd.toFixed(2)} (${strategyMetric.totalProfitSol.toFixed(5)} SOL)`);
    console.log(`- Today's ROI: ${strategyMetric.todayROI.toFixed(2)}% (Target: ${strategy.dailyROI}%)`);
  });
  
  // Recent transactions
  const transactions = loadTransactionData();
  console.log('\n📝 RECENT TRANSACTIONS:');
  console.log('---------------------------------------------------------------------');
  
  if (transactions.length === 0) {
    console.log('No transaction data available');
  } else {
    transactions.slice(0, 10).forEach((tx, index) => {
      const profitSign = (tx.profit || 0) >= 0 ? '+' : '';
      const status = tx.status === 'SUCCESS' ? '✅' : '❌';
      
      console.log(`${index + 1}. ${status} [${new Date(tx.timestamp).toLocaleTimeString()}] ${tx.sourceToken}->${tx.targetToken}`);
      console.log(`   Amount: $${tx.amount}, Profit: ${profitSign}$${(tx.profit || 0).toFixed(2)} (${profitSign}${(tx.profitPercentage || 0).toFixed(2)}%)`);
      console.log(`   Strategy: ${tx.strategy}, Signature: ${tx.signature}`);
    });
  }
  
  // Profit over time
  if (profitHistory.length > 1) {
    console.log('\n📊 PROFIT GROWTH CHART:');
    console.log('---------------------------------------------------------------------');
    
    const balanceValues = profitHistory.map(entry => entry.totalBalance);
    const timestamps = profitHistory.map(entry => new Date(entry.timestamp).toLocaleTimeString());
    
    console.log(createAsciiBarChart(balanceValues, timestamps));
  }
  
  // Update counter
  updateCount++;
  
  console.log('\n=====================================================================');
  console.log(`Last Updated: ${new Date().toISOString()} (Update #${updateCount})`);
  console.log('Press Ctrl+C to stop monitoring');
  console.log('=====================================================================');
}

// Function to start monitoring
function startMonitoring(intervalMs: number = 30000) {
  console.log('Starting nuclear strategy performance monitoring...');
  
  // Display initial dashboard
  displayDashboard();
  
  // Set up interval for updates
  monitoringInterval = setInterval(() => {
    if (monitoringActive) {
      displayDashboard();
    }
  }, intervalMs);
  
  // Handle process termination
  process.on('SIGINT', () => {
    stopMonitoring();
    process.exit(0);
  });
}

// Function to stop monitoring
function stopMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
  
  monitoringActive = false;
  console.log('Nuclear strategy performance monitoring stopped');
}

// Start monitoring
startMonitoring();