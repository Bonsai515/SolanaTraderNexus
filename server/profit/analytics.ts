/**
 * Profit Analytics Module
 * 
 * This module analyzes profit collection data and calculates performance metrics.
 */

import * as fs from 'fs';
import * as path from 'path';

// Constants
const DATA_DIR = '../data';
const CONFIG_DIR = '../config';
const PROFIT_CONFIG_PATH = path.join(CONFIG_DIR, 'profit.json');
const PROFIT_LOG_PATH = path.join(DATA_DIR, 'profit-logs.json');

// Types
interface ProfitLogEntry {
  timestamp: string;
  amount: number;
  sourceWallet: string;
  destinationWallet: string;
  transactionSignature?: string;
  strategy?: string;
  reinvestmentAmount?: number;
  fees?: number;
}

interface ProfitLog {
  totalProfit: number;
  lastUpdated: string;
  profitHistory: ProfitLogEntry[];
}

interface PerformanceMetrics {
  totalProfit: number;
  totalReinvested: number;
  profitFactor: number;
  maxDrawdown: number;
  volatility: number;
  sharpeRatio: number;
  winRate: number;
  averageProfitPerCapture: number;
  profitByStrategy: { [key: string]: number };
  profitByTime: {
    hourly: number[];
    daily: number[];
    weekly: number[];
    monthly: number[];
  };
}

/**
 * Load profit logs
 */
function loadProfitLogs(): ProfitLog {
  try {
    if (fs.existsSync(PROFIT_LOG_PATH)) {
      return JSON.parse(fs.readFileSync(PROFIT_LOG_PATH, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading profit logs:', error);
  }
  
  return {
    totalProfit: 0,
    lastUpdated: new Date().toISOString(),
    profitHistory: []
  };
}

/**
 * Load profit configuration
 */
function loadProfitConfig(): any {
  try {
    if (fs.existsSync(PROFIT_CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(PROFIT_CONFIG_PATH, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading profit config:', error);
  }
  
  return {
    enabled: true,
    captureIntervalMinutes: 4,
    reinvestment: { rate: 95 }
  };
}

/**
 * Calculate performance metrics
 */
export function calculatePerformanceMetrics(): PerformanceMetrics {
  const profitLogs = loadProfitLogs();
  const profitConfig = loadProfitConfig();
  
  // Initialize metrics
  const metrics: PerformanceMetrics = {
    totalProfit: profitLogs.totalProfit,
    totalReinvested: 0,
    profitFactor: 0,
    maxDrawdown: 0,
    volatility: 0,
    sharpeRatio: 0,
    winRate: 0,
    averageProfitPerCapture: 0,
    profitByStrategy: {},
    profitByTime: {
      hourly: Array(24).fill(0),
      daily: Array(30).fill(0),
      weekly: Array(12).fill(0),
      monthly: Array(12).fill(0)
    }
  };
  
  // Return empty metrics if no history
  if (!profitLogs.profitHistory || profitLogs.profitHistory.length === 0) {
    return metrics;
  }
  
  // Calculate metrics
  const history = profitLogs.profitHistory;
  
  // Total reinvested
  metrics.totalReinvested = history
    .filter(entry => entry.reinvestmentAmount)
    .reduce((sum, entry) => sum + (entry.reinvestmentAmount || 0), 0);
  
  // Win rate (positive profit captures)
  const wins = history.filter(entry => entry.amount > 0).length;
  metrics.winRate = (wins / history.length) * 100;
  
  // Average profit per capture
  metrics.averageProfitPerCapture = metrics.totalProfit / history.length;
  
  // Profit by strategy
  history.forEach(entry => {
    if (entry.strategy) {
      if (!metrics.profitByStrategy[entry.strategy]) {
        metrics.profitByStrategy[entry.strategy] = 0;
      }
      metrics.profitByStrategy[entry.strategy] += entry.amount;
    }
  });
  
  // Calculate profit by time
  const now = new Date();
  
  history.forEach(entry => {
    const entryDate = new Date(entry.timestamp);
    const hourDiff = Math.floor((now.getTime() - entryDate.getTime()) / (1000 * 60 * 60));
    const dayDiff = Math.floor(hourDiff / 24);
    const weekDiff = Math.floor(dayDiff / 7);
    const monthDiff = Math.floor(dayDiff / 30);
    
    // Hourly (last 24 hours)
    if (hourDiff < 24) {
      metrics.profitByTime.hourly[hourDiff] += entry.amount;
    }
    
    // Daily (last 30 days)
    if (dayDiff < 30) {
      metrics.profitByTime.daily[dayDiff] += entry.amount;
    }
    
    // Weekly (last 12 weeks)
    if (weekDiff < 12) {
      metrics.profitByTime.weekly[weekDiff] += entry.amount;
    }
    
    // Monthly (last 12 months)
    if (monthDiff < 12) {
      metrics.profitByTime.monthly[monthDiff] += entry.amount;
    }
  });
  
  // Calculate rolling returns for volatility and max drawdown
  const dailyReturns: number[] = Array(30).fill(0);
  
  for (let i = 0; i < 30; i++) {
    if (i < metrics.profitByTime.daily.length) {
      dailyReturns[i] = metrics.profitByTime.daily[i];
    }
  }
  
  // Volatility (standard deviation of daily returns)
  const mean = dailyReturns.reduce((sum, val) => sum + val, 0) / dailyReturns.length;
  const squaredDiffs = dailyReturns.map(val => Math.pow(val - mean, 2));
  metrics.volatility = Math.sqrt(squaredDiffs.reduce((sum, val) => sum + val, 0) / squaredDiffs.length);
  
  // Max drawdown
  let peak = 0;
  let maxDrawdown = 0;
  let cumulativeReturn = 0;
  
  dailyReturns.forEach(dailyReturn => {
    cumulativeReturn += dailyReturn;
    
    if (cumulativeReturn > peak) {
      peak = cumulativeReturn;
    }
    
    const drawdown = (peak - cumulativeReturn) / (peak || 1);
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  });
  
  metrics.maxDrawdown = maxDrawdown * 100; // Convert to percentage
  
  // Sharpe ratio (assuming risk-free rate of 0%)
  const riskFreeRate = 0;
  const excessReturn = mean - riskFreeRate;
  metrics.sharpeRatio = metrics.volatility !== 0 ? excessReturn / metrics.volatility : 0;
  
  // Profit factor (sum of profits / sum of losses)
  const profits = history.filter(entry => entry.amount > 0).reduce((sum, entry) => sum + entry.amount, 0);
  const losses = Math.abs(history.filter(entry => entry.amount < 0).reduce((sum, entry) => sum + entry.amount, 0));
  metrics.profitFactor = losses !== 0 ? profits / losses : profits > 0 ? Infinity : 0;
  
  return metrics;
}

/**
 * Generate profit report
 */
export function generateProfitReport(): any {
  const metrics = calculatePerformanceMetrics();
  const profitConfig = loadProfitConfig();
  const profitLogs = loadProfitLogs();
  
  // Create report
  const report = {
    summary: {
      totalProfit: metrics.totalProfit,
      totalProfitUSD: metrics.totalProfit.toFixed(2),
      totalReinvested: metrics.totalReinvested,
      totalReinvestedUSD: metrics.totalReinvested.toFixed(2),
      reinvestmentRate: profitConfig.reinvestment.rate,
      captureIntervalMinutes: profitConfig.captureIntervalMinutes,
      totalCaptures: profitLogs.profitHistory.length,
      lastCaptureTime: profitLogs.profitHistory.length > 0 ? 
        profitLogs.profitHistory[profitLogs.profitHistory.length - 1].timestamp :
        null
    },
    performance: {
      winRate: metrics.winRate.toFixed(2) + '%',
      profitFactor: metrics.profitFactor.toFixed(2),
      maxDrawdown: metrics.maxDrawdown.toFixed(2) + '%',
      volatility: metrics.volatility.toFixed(4),
      sharpeRatio: metrics.sharpeRatio.toFixed(2),
      averageProfitPerCapture: metrics.averageProfitPerCapture.toFixed(4)
    },
    profitByStrategy: metrics.profitByStrategy,
    timeSeries: {
      hourly: metrics.profitByTime.hourly,
      daily: metrics.profitByTime.daily,
      weekly: metrics.profitByTime.weekly,
      monthly: metrics.profitByTime.monthly
    },
    recentCaptures: profitLogs.profitHistory.slice(-10).reverse(), // Last 10 captures
    reinvestmentStats: {
      effectiveCompoundRate: (metrics.totalReinvested / (metrics.totalProfit || 1) * 100).toFixed(2) + '%',
      estimatedAnnualYield: calculateAnnualYield(metrics, profitConfig),
      compoundingFrequency: profitConfig.reinvestment.compoundingFrequency
    }
  };
  
  return report;
}

/**
 * Calculate the estimated annual yield based on current performance
 */
function calculateAnnualYield(metrics: PerformanceMetrics, config: any): string {
  // Get daily profit average from the last 7 days (or as many as available)
  const dailyProfits = metrics.profitByTime.daily.slice(0, 7);
  const avgDailyProfit = dailyProfits.reduce((sum, val) => sum + val, 0) / dailyProfits.length;
  
  // Annualize based on compounding at the capture frequency
  const capturesPerDay = 24 * 60 / config.captureIntervalMinutes;
  const reinvestmentRate = config.reinvestment.rate / 100;
  
  // Simplistic compound interest calculation
  // (1 + r)^n where r is rate per period and n is number of periods
  const dailyRate = avgDailyProfit / 100; // Convert to decimal
  const annualYield = Math.pow(1 + (dailyRate * reinvestmentRate), 365) - 1;
  
  return (annualYield * 100).toFixed(2) + '%';
}

/**
 * Get latest profit capture
 */
export function getLatestProfitCapture(): ProfitLogEntry | null {
  const profitLogs = loadProfitLogs();
  
  if (profitLogs.profitHistory && profitLogs.profitHistory.length > 0) {
    return profitLogs.profitHistory[profitLogs.profitHistory.length - 1];
  }
  
  return null;
}

/**
 * Add profit capture entry
 */
export function addProfitCapture(entry: ProfitLogEntry): boolean {
  try {
    const profitLogs = loadProfitLogs();
    
    // Add new entry
    profitLogs.profitHistory.push(entry);
    
    // Update total profit
    profitLogs.totalProfit += entry.amount;
    
    // Update last updated timestamp
    profitLogs.lastUpdated = new Date().toISOString();
    
    // Create data directory if it doesn't exist
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    // Write updated profit logs
    fs.writeFileSync(PROFIT_LOG_PATH, JSON.stringify(profitLogs, null, 2));
    
    return true;
  } catch (error) {
    console.error('Error adding profit capture:', error);
    return false;
  }
}

/**
 * Get profit analytics for dashboard
 */
export function getProfitAnalyticsForDashboard(): any {
  const report = generateProfitReport();
  
  // Format data for dashboard
  return {
    summary: report.summary,
    performance: report.performance,
    charts: {
      profitByHour: report.timeSeries.hourly,
      profitByDay: report.timeSeries.daily,
      profitByStrategy: Object.entries(report.profitByStrategy).map(([strategy, profit]) => ({
        strategy,
        profit
      }))
    },
    recentCaptures: report.recentCaptures
  };
}