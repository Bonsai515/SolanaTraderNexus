#!/usr/bin/env node
/**
 * Simple CLI Trading System Monitor
 * 
 * This script provides a minimalist command-line dashboard
 * for monitoring your trading system performance.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const SYSTEM_STATE_PATH = path.join('./data', 'system-state-memory.json');
const WALLET_PATH = path.join('./data', 'wallet.json');
const MEV_STRATEGY_PATH = path.join('./data', 'mev-strategies.json');
const STRATEGY_PERFORMANCE_PATH = path.join('./data', 'strategy-performance.json');

// Sample SOL price (would normally be fetched from an API)
const SOL_PRICE_USD = 121.75;

// ANSI color codes for formatting
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

// Load system state
function loadSystemState() {
  try {
    if (fs.existsSync(SYSTEM_STATE_PATH)) {
      return JSON.parse(fs.readFileSync(SYSTEM_STATE_PATH, 'utf8'));
    }
  } catch (err) {
    console.log('Error loading system state:', err.message);
  }
  
  return {
    activeStrategies: [],
    strategyWeights: {},
    tradingMode: 'ultra_aggressive'
  };
}

// Load wallet info
function loadWalletInfo() {
  try {
    if (fs.existsSync(WALLET_PATH)) {
      return JSON.parse(fs.readFileSync(WALLET_PATH, 'utf8'));
    }
  } catch (err) {
    console.log('Error loading wallet info:', err.message);
  }
  
  return {
    address: "HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK",
    balance: 1.04
  };
}

// Load MEV strategies
function loadMEVStrategies() {
  try {
    if (fs.existsSync(MEV_STRATEGY_PATH)) {
      return JSON.parse(fs.readFileSync(MEV_STRATEGY_PATH, 'utf8'));
    }
  } catch (err) {
    console.log('Error loading MEV strategies:', err.message);
  }
  
  return { enabled: true };
}

// Load strategy performance data
function loadStrategyPerformance() {
  try {
    if (fs.existsSync(STRATEGY_PERFORMANCE_PATH)) {
      return JSON.parse(fs.readFileSync(STRATEGY_PERFORMANCE_PATH, 'utf8'));
    }
  } catch (err) {
    console.log('Error loading strategy performance:', err.message);
  }
  
  return { strategies: {} };
}

// Format SOL value
function formatSOL(sol, decimals = 6) {
  return `${sol.toFixed(decimals)} SOL`;
}

// Format USD value
function formatUSD(usd, decimals = 2) {
  return `$${usd.toFixed(decimals)}`;
}

// Format percentage
function formatPercent(percent, decimals = 2) {
  return `${percent.toFixed(decimals)}%`;
}

// Get time difference
function getTimeDiff(timestamp) {
  if (!timestamp) return 'unknown';
  
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;
  
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

// Display current system state
function displaySystemState() {
  const systemState = loadSystemState();
  const walletInfo = loadWalletInfo();
  const mevStrategies = loadMEVStrategies();
  
  // Header
  console.log(colors.bright + colors.cyan + '=== TRADING SYSTEM STATUS ===' + colors.reset);
  console.log(colors.dim + `[${new Date().toISOString()}]` + colors.reset);
  console.log('');
  
  // Wallet info
  console.log(colors.bright + colors.yellow + 'WALLET STATUS:' + colors.reset);
  console.log(`Address: ${colors.green}${walletInfo.address}${colors.reset}`);
  console.log(`Balance: ${colors.green}${formatSOL(walletInfo.balance)}${colors.reset} (${formatUSD(walletInfo.balance * SOL_PRICE_USD)})`);
  console.log('');
  
  // Strategy allocation
  console.log(colors.bright + colors.yellow + 'STRATEGY ALLOCATION:' + colors.reset);
  
  const strategyWeights = systemState.strategyWeights || {};
  Object.entries(strategyWeights)
    .sort(([, a], [, b]) => b - a)
    .forEach(([strategy, weight]) => {
      const colorCode = weight >= 25 ? colors.green : (weight >= 15 ? colors.yellow : colors.dim);
      console.log(`${colorCode}${strategy}: ${weight}%${colors.reset}`);
    });
  console.log('');
  
  // Active strategies count
  console.log(colors.bright + colors.yellow + 'ACTIVE STRATEGIES:' + colors.reset);
  console.log(`Total active: ${systemState.activeStrategies?.length || 0} strategies`);
  console.log(`MEV strategies: ${mevStrategies.enabled ? colors.green + 'Enabled' : colors.red + 'Disabled'}${colors.reset}`);
  console.log(`Trading mode: ${colors.green}${systemState.tradingMode || 'ultra_aggressive'}${colors.reset}`);
  console.log('');
  
  // System details
  console.log(colors.bright + colors.yellow + 'SYSTEM DETAILS:' + colors.reset);
  console.log(`Dynamic allocation: ${systemState.dynamicAllocationEnabled ? colors.green + 'Enabled' : colors.red + 'Disabled'}${colors.reset}`);
  console.log(`Last updated: ${getTimeDiff(systemState.lastModified)}`);
  console.log('');
}

// Display strategy performance
function displayPerformance() {
  // Sample data (would be loaded from actual performance files)
  const strategies = [
    { name: "Cascade Flash", dailyProfit: 0.0312, successRate: 82, opportunities: 8 },
    { name: "Temporal Block Arbitrage", dailyProfit: 0.0215, successRate: 79, opportunities: 5 },
    { name: "Flash Loan Singularity", dailyProfit: 0.0189, successRate: 86, opportunities: 6 },
    { name: "Quantum Arbitrage", dailyProfit: 0.0097, successRate: 95, opportunities: 3 },
    { name: "Jito Bundle MEV", dailyProfit: 0.0076, successRate: 91, opportunities: 12 },
    { name: "Backrun Strategy", dailyProfit: 0.0053, successRate: 92, opportunities: 8 },
    { name: "JIT Liquidity", dailyProfit: 0.0062, successRate: 87, opportunities: 7 }
  ];
  
  // Header
  console.log(colors.bright + colors.yellow + 'STRATEGY PERFORMANCE:' + colors.reset);
  
  // Display strategy performance data
  console.log(colors.dim + 'Strategy              Daily Profit    Success Rate    Opportunities' + colors.reset);
  
  strategies.forEach(strategy => {
    const profitColor = strategy.dailyProfit > 0 ? colors.green : colors.red;
    const rateColor = strategy.successRate >= 90 ? colors.green : 
                    (strategy.successRate >= 75 ? colors.yellow : colors.red);
    
    console.log(
      `${strategy.name.padEnd(22)} ` +
      `${profitColor}${formatSOL(strategy.dailyProfit, 4).padStart(10)}${colors.reset} ` +
      `${rateColor}${formatPercent(strategy.successRate).padStart(10)}${colors.reset} ` +
      `${strategy.opportunities.toString().padStart(13)}`
    );
  });
  
  // Total daily profit
  const totalDailyProfit = strategies.reduce((sum, strategy) => sum + strategy.dailyProfit, 0);
  console.log('');
  console.log(`Total Daily Profit: ${colors.green}${formatSOL(totalDailyProfit)}${colors.reset} (${formatUSD(totalDailyProfit * SOL_PRICE_USD)})`);
  console.log('');
}

// Display profit projections
function displayProfitProjections() {
  // Calculate projections based on daily profit
  const dailyProfit = 0.1004; // From strategy performance
  const weeklyProfit = dailyProfit * 7;
  const monthlyProfit = dailyProfit * 30;
  
  // Header
  console.log(colors.bright + colors.yellow + 'PROFIT PROJECTIONS:' + colors.reset);
  
  // Display projections
  console.log(`Daily:   ${colors.green}${formatSOL(dailyProfit)}${colors.reset} (${formatUSD(dailyProfit * SOL_PRICE_USD)})`);
  console.log(`Weekly:  ${colors.green}${formatSOL(weeklyProfit)}${colors.reset} (${formatUSD(weeklyProfit * SOL_PRICE_USD)})`);
  console.log(`Monthly: ${colors.green}${formatSOL(monthlyProfit)}${colors.reset} (${formatUSD(monthlyProfit * SOL_PRICE_USD)})`);
  console.log('');
  
  // Return projections
  const walletInfo = loadWalletInfo();
  const dailyReturn = (dailyProfit / walletInfo.balance) * 100;
  const weeklyReturn = (weeklyProfit / walletInfo.balance) * 100;
  const monthlyReturn = (monthlyProfit / walletInfo.balance) * 100;
  
  console.log(`Daily ROI:   ${colors.green}${formatPercent(dailyReturn)}${colors.reset}`);
  console.log(`Weekly ROI:  ${colors.green}${formatPercent(weeklyReturn)}${colors.reset}`);
  console.log(`Monthly ROI: ${colors.green}${formatPercent(monthlyReturn)}${colors.reset}`);
  console.log('');
}

// Check for active trades
function checkForActiveTrades() {
  // Sample active trades (would be fetched from actual trade data)
  const activeTrades = [
    { strategy: "Cascade Flash", token: "SOL/USDC", entryTime: "2025-05-22T02:30:15.123Z", profit: 0.0031 },
    { strategy: "Jito Bundle MEV", token: "WIF/USDC", entryTime: "2025-05-22T02:29:47.456Z", profit: 0.0012 }
  ];
  
  // Header
  console.log(colors.bright + colors.yellow + 'ACTIVE TRADES:' + colors.reset);
  
  if (activeTrades.length === 0) {
    console.log(colors.dim + 'No active trades at the moment' + colors.reset);
  } else {
    console.log(colors.dim + 'Strategy              Token      Entry Time    Current Profit' + colors.reset);
    
    activeTrades.forEach(trade => {
      const profitColor = trade.profit >= 0 ? colors.green : colors.red;
      const timeDiff = getTimeDiff(trade.entryTime);
      
      console.log(
        `${trade.strategy.padEnd(22)} ` +
        `${trade.token.padEnd(10)} ` +
        `${timeDiff.padStart(10)} ` +
        `${profitColor}${formatSOL(trade.profit, 4).padStart(12)}${colors.reset}`
      );
    });
  }
  console.log('');
}

// Display MEV statistics
function displayMEVStats() {
  // Sample MEV statistics (would be fetched from actual MEV data)
  const mevStats = {
    totalBundles: 24,
    successfulBundles: 19,
    totalMEVProfit: 0.0191,
    lastBundle: "2025-05-22T02:27:34.789Z",
    bestStrategy: "Jito Bundle MEV"
  };
  
  // Header
  console.log(colors.bright + colors.yellow + 'MEV STATISTICS:' + colors.reset);
  
  // Display MEV statistics
  console.log(`Total bundles: ${mevStats.totalBundles}`);
  console.log(`Success rate: ${colors.green}${formatPercent(mevStats.successfulBundles / mevStats.totalBundles * 100)}${colors.reset}`);
  console.log(`Total MEV profit: ${colors.green}${formatSOL(mevStats.totalMEVProfit)}${colors.reset} (${formatUSD(mevStats.totalMEVProfit * SOL_PRICE_USD)})`);
  console.log(`Last bundle: ${getTimeDiff(mevStats.lastBundle)}`);
  console.log(`Best MEV strategy: ${colors.green}${mevStats.bestStrategy}${colors.reset}`);
  console.log('');
}

// Main function to display everything
function displayDashboard() {
  console.clear();
  displaySystemState();
  displayPerformance();
  displayProfitProjections();
  checkForActiveTrades();
  displayMEVStats();
  
  console.log(colors.dim + 'Press Ctrl+C to exit. Dashboard updates every 15 seconds.' + colors.reset);
}

// Run the dashboard
displayDashboard();

// Update every 15 seconds
setInterval(displayDashboard, 15000);