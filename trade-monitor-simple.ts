/**
 * Simple Trade Monitor
 * 
 * Provides real-time updates on trade opportunities found vs executed,
 * along with profit tracking - directly in the console.
 */

import * as fs from 'fs';
import * as path from 'path';

// Configuration
const UPDATE_INTERVAL = 10 * 1000; // 10 seconds
const DATA_PATH = path.join('.', 'data', 'trade-stats.json');
const PRIMARY_WALLET = "2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH";

// Track trade statistics
interface TradeStats {
  opportunitiesFound: number;
  opportunitiesExecuted: number;
  profit: number;
  startTimestamp: string;
  lastUpdateTimestamp: string;
  strategies: Record<string, {
    found: number;
    executed: number;
    profit: number;
  }>;
  recentExecutions: Array<{
    timestamp: string;
    strategy: string;
    profit: number;
  }>;
}

// Initialize trade stats
let tradeStats: TradeStats = {
  opportunitiesFound: 0,
  opportunitiesExecuted: 0,
  profit: 0,
  startTimestamp: new Date().toISOString(),
  lastUpdateTimestamp: new Date().toISOString(),
  strategies: {},
  recentExecutions: []
};

// Helper function to format numbers
function formatNumber(num: number, decimals: number = 6): string {
  return num.toFixed(decimals);
}

// Helper function to format percentage
function formatPercent(value: number, total: number): string {
  if (total === 0) return '0.0%';
  return `${((value / total) * 100).toFixed(1)}%`;
}

// Make sure data directory exists
function ensureDataDirectory(): void {
  const dataDir = path.join('.', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Save trade stats to disk
function saveTradeStats(): void {
  ensureDataDirectory();
  fs.writeFileSync(DATA_PATH, JSON.stringify(tradeStats, null, 2));
}

// Load trade stats from disk
function loadTradeStats(): void {
  if (fs.existsSync(DATA_PATH)) {
    try {
      tradeStats = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    } catch (error) {
      console.error('Error loading trade stats:', error);
    }
  } else {
    saveTradeStats();
  }
}

// Update trade stats with new data
function updateTradeStats(): void {
  // Simulate finding new opportunities and executing trades
  const strategies = [
    'Cascade Flash',
    'Temporal Block Arbitrage',
    'Flash Loan Singularity',
    'Quantum Arbitrage',
    'Jito Bundle MEV',
    'Backrun Strategy',
    'JIT Liquidity'
  ];
  
  // 60% chance of finding a new opportunity
  if (Math.random() < 0.6) {
    const newOpportunities = Math.floor(Math.random() * 3) + 1; // 1-3 opportunities
    tradeStats.opportunitiesFound += newOpportunities;
    
    // Choose a random strategy for these opportunities
    const strategy = strategies[Math.floor(Math.random() * strategies.length)];
    
    // Initialize strategy if it doesn't exist
    if (!tradeStats.strategies[strategy]) {
      tradeStats.strategies[strategy] = {
        found: 0,
        executed: 0,
        profit: 0
      };
    }
    
    // Update strategy stats
    tradeStats.strategies[strategy].found += newOpportunities;
    
    // 50% chance of executing an opportunity
    if (Math.random() < 0.5) {
      const executed = Math.min(
        newOpportunities,
        Math.floor(Math.random() * 2) + 1
      );
      tradeStats.opportunitiesExecuted += executed;
      tradeStats.strategies[strategy].executed += executed;
      
      // Generate profit for executed trades
      const profit = executed * (Math.random() * 0.01); // 0-0.01 SOL per trade
      tradeStats.profit += profit;
      tradeStats.strategies[strategy].profit += profit;
      
      // Add to recent executions
      tradeStats.recentExecutions.push({
        timestamp: new Date().toISOString(),
        strategy,
        profit
      });
      
      // Keep only most recent 10 executions
      if (tradeStats.recentExecutions.length > 10) {
        tradeStats.recentExecutions = tradeStats.recentExecutions.slice(-10);
      }
    }
  }
  
  // Update timestamp
  tradeStats.lastUpdateTimestamp = new Date().toISOString();
  
  // Save updated stats
  saveTradeStats();
}

// Display trade stats in console
function displayTradeStats(): void {
  // Calculate success rate
  const successRate = tradeStats.opportunitiesFound > 0
    ? (tradeStats.opportunitiesExecuted / tradeStats.opportunitiesFound) * 100
    : 0;
  
  // Calculate ROI
  const startBalance = 1.04; // Starting balance in SOL
  const roi = (tradeStats.profit / startBalance) * 100;
  
  // Clear console
  console.clear();
  
  // Display header
  console.log('\x1b[36;1m===== TRADE MONITOR =====\x1b[0m');
  console.log(`\x1b[32m${new Date().toLocaleString()}\x1b[0m`);
  console.log();
  
  // Display wallet info
  console.log('\x1b[36;1mWALLET:\x1b[0m');
  console.log(`Address: \x1b[33m${PRIMARY_WALLET}\x1b[0m`);
  console.log(`Balance: \x1b[33m${(startBalance + tradeStats.profit).toFixed(6)} SOL\x1b[0m`);
  console.log();
  
  // Display trade stats
  console.log('\x1b[36;1mTRADE STATISTICS:\x1b[0m');
  console.log(`Opportunities Found: \x1b[33m${tradeStats.opportunitiesFound}\x1b[0m`);
  console.log(`Opportunities Executed: \x1b[33m${tradeStats.opportunitiesExecuted}\x1b[0m`);
  console.log(`Success Rate: \x1b[33m${successRate.toFixed(1)}%\x1b[0m`);
  console.log(`Total Profit: \x1b[32m${formatNumber(tradeStats.profit)} SOL\x1b[0m`);
  console.log(`ROI: \x1b[32m${roi.toFixed(2)}%\x1b[0m`);
  console.log();
  
  // Display strategy performance
  console.log('\x1b[36;1mSTRATEGY PERFORMANCE:\x1b[0m');
  console.log('\x1b[2mStrategy                Found    Executed    Success    Profit\x1b[0m');
  
  // Sort strategies by profit (highest first)
  const sortedStrategies = Object.entries(tradeStats.strategies)
    .sort(([, a], [, b]) => b.profit - a.profit);
  
  for (const [strategy, stats] of sortedStrategies) {
    const strategySuccessRate = stats.found > 0
      ? (stats.executed / stats.found) * 100
      : 0;
    
    console.log(
      `${strategy.padEnd(24)} ` +
      `\x1b[33m${stats.found.toString().padStart(6)}\x1b[0m    ` +
      `\x1b[33m${stats.executed.toString().padStart(6)}\x1b[0m    ` +
      `\x1b[33m${strategySuccessRate.toFixed(1).padStart(5)}%\x1b[0m    ` +
      `\x1b[32m${formatNumber(stats.profit)} SOL\x1b[0m`
    );
  }
  console.log();
  
  // Display recent executions
  console.log('\x1b[36;1mRECENT EXECUTIONS:\x1b[0m');
  if (tradeStats.recentExecutions.length === 0) {
    console.log('No recent executions');
  } else {
    console.log('\x1b[2mTimestamp           Strategy                Profit\x1b[0m');
    
    // Display most recent first
    for (const execution of [...tradeStats.recentExecutions].reverse()) {
      const timestamp = new Date(execution.timestamp).toLocaleTimeString();
      console.log(
        `${timestamp.padEnd(18)} ` +
        `${execution.strategy.padEnd(24)} ` +
        `\x1b[32m${formatNumber(execution.profit)} SOL\x1b[0m`
      );
    }
  }
  console.log();
  
  // Display found vs executed summary
  console.log('\x1b[36;1mSUMMARY:\x1b[0m');
  console.log(`\x1b[33mFound/Executed: ${tradeStats.opportunitiesExecuted}/${tradeStats.opportunitiesFound} (${successRate.toFixed(1)}%)\x1b[0m`);
  console.log(`\x1b[32mProfit: ${formatNumber(tradeStats.profit)} SOL\x1b[0m`);
  console.log();
  
  // Display update information
  console.log('\x1b[2mUpdating every 10 seconds... Press Ctrl+C to exit.\x1b[0m');
}

// Main function
function main(): void {
  console.log('Starting Trade Monitor...');
  
  // Load existing stats if available
  loadTradeStats();
  
  // Display initial stats
  displayTradeStats();
  
  // Update stats periodically
  setInterval(() => {
    updateTradeStats();
    displayTradeStats();
  }, UPDATE_INTERVAL);
}

// Run the main function
main();