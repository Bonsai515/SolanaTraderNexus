/**
 * Trading Profit Dashboard
 * 
 * This script creates a detailed profit dashboard for all strategies
 * and visualizes the trading activity with detailed analytics.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

// Load environment variables
config();

// Trading wallet address
const TRADING_WALLET = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';

// Strategy types and their target profit percentages
const STRATEGIES = {
  'Ultimate Nuclear': 4.75,
  'Quantum Flash': 3.45,
  'MEV Protection': 3.25,
  'Zero Capital': 2.95,
  'Multi-Flash': 3.75,
  'Temporal Block': 5.15
};

// Initialize dashboard data
interface StrategyPerformance {
  name: string;
  targetProfitPercent: number;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  totalProfit: number;
  totalProfitUSD: number;
  bestProfit: number;
  bestProfitUSD: number;
  bestTimestamp: number;
  bestTokenRoute: string[];
  avgProfitPercent: number;
  routeFrequency: Record<string, number>;
  hourlyDistribution: number[];
  lastTradeTimestamp: number;
}

interface DashboardData {
  walletAddress: string;
  initialBalance: number;
  currentBalance: number;
  firstTradeTimestamp: number;
  lastTradeTimestamp: number;
  totalProfit: number;
  totalProfitUSD: number;
  profitPercentage: number;
  totalTrades: number;
  successRate: number;
  strategies: Record<string, StrategyPerformance>;
  dailyProfits: Record<string, number>;
  projections: {
    daily: number;
    weekly: number;
    monthly: number;
    monthly_compounded: number;
  };
  tokenPerformance: Record<string, {
    appearances: number;
    profitContribution: number;
  }>;
}

/**
 * Get a connection to Solana
 */
async function getConnection(): Promise<Connection> {
  // Use Helius API if available
  if (process.env.HELIUS_API_KEY) {
    const heliusUrl = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
    return new Connection(heliusUrl);
  }
  
  // Fallback to public RPC
  return new Connection('https://api.mainnet-beta.solana.com');
}

/**
 * Load saved data from file if available
 */
function loadSavedData(): DashboardData | null {
  const dataPath = path.join('data', 'profit-dashboard-data.json');
  
  if (fs.existsSync(dataPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
      return data as DashboardData;
    } catch (error) {
      console.warn('Error loading saved data:', error);
      return null;
    }
  }
  
  return null;
}

/**
 * Save dashboard data to file
 */
function saveDashboardData(data: DashboardData): void {
  if (!fs.existsSync('data')) {
    fs.mkdirSync('data');
  }
  
  const dataPath = path.join('data', 'profit-dashboard-data.json');
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  
  console.log(`Saved dashboard data to ${dataPath}`);
}

/**
 * Load transaction data from JSON file
 */
function loadTransactionData(): any[] {
  const dataPath = path.join('data', 'recent-trades.json');
  
  if (fs.existsSync(dataPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
      return data;
    } catch (error) {
      console.warn('Error loading transaction data:', error);
      return [];
    }
  }
  
  return [];
}

/**
 * Calculate daily profit distribution
 */
function calculateDailyProfits(transactions: any[]): Record<string, number> {
  const dailyProfits: Record<string, number> = {};
  
  for (const tx of transactions) {
    const date = new Date(tx.timestamp).toISOString().split('T')[0];
    
    if (!dailyProfits[date]) {
      dailyProfits[date] = 0;
    }
    
    dailyProfits[date] += tx.profitSOL;
  }
  
  return dailyProfits;
}

/**
 * Calculate token performance
 */
function calculateTokenPerformance(transactions: any[]): Record<string, {appearances: number, profitContribution: number}> {
  const tokenPerformance: Record<string, {appearances: number, profitContribution: number}> = {};
  
  for (const tx of transactions) {
    const route = tx.route || [];
    
    for (const token of route) {
      if (!tokenPerformance[token]) {
        tokenPerformance[token] = {
          appearances: 0,
          profitContribution: 0
        };
      }
      
      tokenPerformance[token].appearances += 1;
      tokenPerformance[token].profitContribution += tx.profitSOL / route.length; // Distribute profit equally
    }
  }
  
  return tokenPerformance;
}

/**
 * Calculate strategy performance
 */
function calculateStrategyPerformance(transactions: any[]): Record<string, StrategyPerformance> {
  const strategyPerformance: Record<string, StrategyPerformance> = {};
  
  // Initialize strategy data
  for (const [name, targetProfit] of Object.entries(STRATEGIES)) {
    strategyPerformance[name] = {
      name,
      targetProfitPercent: targetProfit,
      totalTrades: 0,
      successfulTrades: 0,
      failedTrades: 0,
      totalProfit: 0,
      totalProfitUSD: 0,
      bestProfit: 0,
      bestProfitUSD: 0,
      bestTimestamp: 0,
      bestTokenRoute: [],
      avgProfitPercent: 0,
      routeFrequency: {},
      hourlyDistribution: Array(24).fill(0),
      lastTradeTimestamp: 0
    };
  }
  
  // Process transactions
  for (const tx of transactions) {
    const strategyName = tx.strategy;
    
    // Skip unknown strategies
    if (!strategyPerformance[strategyName]) {
      strategyPerformance[strategyName] = {
        name: strategyName,
        targetProfitPercent: 3.0, // Default
        totalTrades: 0,
        successfulTrades: 0,
        failedTrades: 0,
        totalProfit: 0,
        totalProfitUSD: 0,
        bestProfit: 0,
        bestProfitUSD: 0,
        bestTimestamp: 0,
        bestTokenRoute: [],
        avgProfitPercent: 0,
        routeFrequency: {},
        hourlyDistribution: Array(24).fill(0),
        lastTradeTimestamp: 0
      };
    }
    
    const strategy = strategyPerformance[strategyName];
    
    // Update trade count
    strategy.totalTrades += 1;
    
    if (tx.success) {
      strategy.successfulTrades += 1;
      strategy.totalProfit += tx.profitSOL;
      strategy.totalProfitUSD += tx.profitUSD;
      
      // Update best profit
      if (tx.profitSOL > strategy.bestProfit) {
        strategy.bestProfit = tx.profitSOL;
        strategy.bestProfitUSD = tx.profitUSD;
        strategy.bestTimestamp = tx.timestamp;
        strategy.bestTokenRoute = tx.route || [];
      }
      
      // Update last trade timestamp
      if (tx.timestamp > strategy.lastTradeTimestamp) {
        strategy.lastTradeTimestamp = tx.timestamp;
      }
      
      // Update route frequency
      const routeKey = (tx.route || []).join(' → ');
      if (routeKey) {
        strategy.routeFrequency[routeKey] = (strategy.routeFrequency[routeKey] || 0) + 1;
      }
      
      // Update hourly distribution
      const hour = new Date(tx.timestamp).getHours();
      strategy.hourlyDistribution[hour] += 1;
    } else {
      strategy.failedTrades += 1;
    }
  }
  
  // Calculate average profit percentage
  for (const strategy of Object.values(strategyPerformance)) {
    if (strategy.successfulTrades > 0) {
      // Estimate based on current wallet balance of ~0.55 SOL
      const estimatedBalanceSOL = 0.55;
      strategy.avgProfitPercent = (strategy.totalProfit / strategy.successfulTrades) / estimatedBalanceSOL * 100;
    }
  }
  
  return strategyPerformance;
}

/**
 * Format date for display
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Create ASCII chart for profit distribution
 */
function createAsciiChart(data: number[], maxWidth: number = 50): string[] {
  const max = Math.max(...data);
  const chart: string[] = [];
  
  for (let i = 0; i < data.length; i++) {
    const value = data[i];
    const barLength = max > 0 ? Math.round((value / max) * maxWidth) : 0;
    const bar = '█'.repeat(barLength);
    chart.push(`${i.toString().padStart(2, '0')}h: ${bar} ${value.toFixed(2)}`);
  }
  
  return chart;
}

/**
 * Generate profit report
 */
function generateProfitReport(data: DashboardData): void {
  console.log('\n===============================================');
  console.log('💰 TRADING PROFIT DASHBOARD');
  console.log('===============================================');
  console.log(`Wallet: ${data.walletAddress}`);
  console.log(`Initial Balance: ${data.initialBalance.toFixed(6)} SOL`);
  console.log(`Current Balance: ${data.currentBalance.toFixed(6)} SOL`);
  console.log(`First Trade: ${formatDate(data.firstTradeTimestamp)}`);
  console.log(`Last Trade: ${formatDate(data.lastTradeTimestamp)}`);
  console.log('-----------------------------------------------');
  console.log(`Total Profit: ${data.totalProfit.toFixed(6)} SOL ($${data.totalProfitUSD.toFixed(2)})`);
  console.log(`Profit Percentage: ${data.profitPercentage.toFixed(2)}%`);
  console.log(`Total Trades: ${data.totalTrades} (${data.successRate.toFixed(2)}% success rate)`);
  console.log('-----------------------------------------------');
  console.log('\nSTRATEGY PERFORMANCE:');
  
  // Sort strategies by total profit (highest first)
  const sortedStrategies = Object.values(data.strategies).sort((a, b) => b.totalProfit - a.totalProfit);
  
  for (const strategy of sortedStrategies) {
    if (strategy.totalTrades === 0) continue;
    
    console.log(`\n${strategy.name.toUpperCase()}:`);
    console.log(`  Target Profit: ${strategy.targetProfitPercent.toFixed(2)}%`);
    console.log(`  Actual Avg Profit: ${strategy.avgProfitPercent.toFixed(2)}%`);
    console.log(`  Total Profit: ${strategy.totalProfit.toFixed(6)} SOL ($${strategy.totalProfitUSD.toFixed(2)})`);
    console.log(`  Trades: ${strategy.totalTrades} (${strategy.successfulTrades} successful)`);
    
    if (strategy.bestProfit > 0) {
      console.log(`  Best Trade: ${strategy.bestProfit.toFixed(6)} SOL on ${formatDate(strategy.bestTimestamp)}`);
      console.log(`  Best Route: ${strategy.bestTokenRoute.join(' → ')}`);
    }
    
    // Display most frequent routes
    const routes = Object.entries(strategy.routeFrequency).sort((a, b) => b[1] - a[1]);
    if (routes.length > 0) {
      console.log('  Top Routes:');
      for (let i = 0; i < Math.min(3, routes.length); i++) {
        console.log(`    - ${routes[i][0]}: ${routes[i][1]} trades`);
      }
    }
  }
  
  // Token performance
  console.log('\nTOKEN PERFORMANCE:');
  const sortedTokens = Object.entries(data.tokenPerformance).sort((a, b) => b[1].profitContribution - a[1].profitContribution);
  
  for (const [token, performance] of sortedTokens) {
    console.log(`  ${token}: ${performance.appearances} appearances, ${performance.profitContribution.toFixed(6)} SOL contribution`);
  }
  
  // Profit projections
  console.log('\nPROFIT PROJECTIONS:');
  console.log(`  Daily: ${data.projections.daily.toFixed(6)} SOL ($${(data.projections.daily * 150).toFixed(2)})`);
  console.log(`  Weekly: ${data.projections.weekly.toFixed(6)} SOL ($${(data.projections.weekly * 150).toFixed(2)})`);
  console.log(`  Monthly: ${data.projections.monthly.toFixed(6)} SOL ($${(data.projections.monthly * 150).toFixed(2)})`);
  console.log(`  Monthly (Compounded): ${data.projections.monthly_compounded.toFixed(6)} SOL ($${(data.projections.monthly_compounded * 150).toFixed(2)})`);
  
  // Daily profit chart
  console.log('\nDAILY PROFIT DISTRIBUTION:');
  const sortedDailyProfits = Object.entries(data.dailyProfits).sort((a, b) => a[0].localeCompare(b[0]));
  
  for (const [date, profit] of sortedDailyProfits) {
    const barLength = Math.round(profit * 100);
    const bar = '█'.repeat(Math.min(barLength, 50));
    console.log(`  ${date}: ${bar} ${profit.toFixed(6)} SOL`);
  }
  
  // Hourly distribution for all strategies combined
  console.log('\nHOURLY TRADING DISTRIBUTION:');
  const hourlyData = Array(24).fill(0);
  
  for (const strategy of Object.values(data.strategies)) {
    for (let i = 0; i < 24; i++) {
      hourlyData[i] += strategy.hourlyDistribution[i];
    }
  }
  
  const hourlyChart = createAsciiChart(hourlyData);
  for (const line of hourlyChart) {
    console.log(`  ${line}`);
  }
  
  console.log('\n===============================================');
}

/**
 * Calculate projections
 */
function calculateProjections(data: DashboardData): void {
  // Calculate time range of trades in days
  const timeRangeMs = data.lastTradeTimestamp - data.firstTradeTimestamp;
  const timeRangeDays = timeRangeMs / (1000 * 60 * 60 * 24);
  
  // If we have at least one day of data
  if (timeRangeDays >= 1) {
    // Calculate daily profit rate
    const dailyProfit = data.totalProfit / timeRangeDays;
    
    // Calculate weekly and monthly projections
    const weeklyProfit = dailyProfit * 7;
    const monthlyProfit = dailyProfit * 30;
    
    // Calculate compounded monthly profit (assuming reinvestment)
    let compoundedBalance = data.currentBalance;
    for (let i = 0; i < 30; i++) {
      compoundedBalance += (compoundedBalance * 0.035); // Assuming 3.5% daily profit
    }
    const monthlyCompounded = compoundedBalance - data.currentBalance;
    
    // Update projections
    data.projections = {
      daily: dailyProfit,
      weekly: weeklyProfit,
      monthly: monthlyProfit,
      monthly_compounded: monthlyCompounded
    };
  } else {
    // Default projections based on strategy targets
    const avgTargetProfit = Object.values(STRATEGIES).reduce((sum, value) => sum + value, 0) / Object.values(STRATEGIES).length;
    
    data.projections = {
      daily: data.currentBalance * (avgTargetProfit / 100) * 8, // Assuming 8 trades per day
      weekly: data.currentBalance * (avgTargetProfit / 100) * 8 * 7,
      monthly: data.currentBalance * (avgTargetProfit / 100) * 8 * 30,
      monthly_compounded: data.currentBalance * Math.pow(1 + (avgTargetProfit / 100), 8 * 30) - data.currentBalance
    };
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  try {
    // Get transactions data
    let transactions = loadTransactionData();
    
    if (transactions.length === 0) {
      console.log('No transaction data found. Please run fetch-onchain-trades.ts first.');
      return;
    }
    
    console.log(`Loaded ${transactions.length} transactions from saved data`);
    
    // Sort transactions by timestamp (oldest first)
    transactions = transactions.sort((a, b) => a.timestamp - b.timestamp);
    
    // Initialize dashboard data
    const dashboardData: DashboardData = {
      walletAddress: TRADING_WALLET,
      initialBalance: 0.540916, // Initial SOL balance
      currentBalance: 0.547866, // Current SOL balance
      firstTradeTimestamp: transactions[0].timestamp,
      lastTradeTimestamp: transactions[transactions.length - 1].timestamp,
      totalProfit: transactions.reduce((sum, tx) => sum + tx.profitSOL, 0),
      totalProfitUSD: transactions.reduce((sum, tx) => sum + tx.profitUSD, 0),
      profitPercentage: 0, // Will calculate
      totalTrades: transactions.length,
      successRate: (transactions.filter(tx => tx.success).length / transactions.length) * 100,
      strategies: {},
      dailyProfits: {},
      projections: {
        daily: 0,
        weekly: 0,
        monthly: 0,
        monthly_compounded: 0
      },
      tokenPerformance: {}
    };
    
    // Calculate profit percentage
    dashboardData.profitPercentage = (dashboardData.totalProfit / dashboardData.initialBalance) * 100;
    
    // Calculate daily profits
    dashboardData.dailyProfits = calculateDailyProfits(transactions);
    
    // Calculate token performance
    dashboardData.tokenPerformance = calculateTokenPerformance(transactions);
    
    // Calculate strategy performance
    dashboardData.strategies = calculateStrategyPerformance(transactions);
    
    // Calculate projections
    calculateProjections(dashboardData);
    
    // Save dashboard data
    saveDashboardData(dashboardData);
    
    // Generate profit report
    generateProfitReport(dashboardData);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the main function
main();