/**
 * Risk Management System
 * 
 * Provides comprehensive risk management for trading operations, including:
 * - Position sizing based on volatility
 * - Stop-loss and take-profit management
 * - Trade risk evaluation
 * - Drawdown protection
 */

import { logger } from '../logger';

// Position sizing constants
export const POSITION_SIZING = {
  MAX_ACCOUNT_RISK_PERCENT: 2.0,    // Maximum % of account to risk per trade
  MAX_DAILY_RISK_PERCENT: 5.0,      // Maximum % of account to risk per day
  VOLATILITY_ADJUSTMENT: true,      // Adjust position size based on volatility
  DEFAULT_POSITION_SIZE_USD: 100,   // Default position size in USD
  MAX_POSITION_SIZE_USD: 1000       // Maximum position size in USD
};

// Stop-loss and take-profit constants
export const STOP_LOSS_TAKE_PROFIT = {
  DEFAULT_STOP_LOSS_PERCENT: 5.0,   // Default stop-loss percentage
  DEFAULT_TAKE_PROFIT_PERCENT: 10.0, // Default take-profit percentage
  TRAILING_STOP_ACTIVATED: true,    // Whether trailing stops are activated
  TRAILING_STOP_ACTIVATION_PERCENT: 5.0, // % profit to activate trailing stop
  TRAILING_STOP_DISTANCE_PERCENT: 2.0    // Trailing stop distance %
};

// Profit Management
export const PROFIT_MANAGEMENT = {
  PROFIT_CAPTURE_ENABLED: true,     // Whether to capture partial profits
  INITIAL_PROFIT_CAPTURE_PERCENT: 25.0, // % of position to sell at first target
  PROFIT_CAPTURE_THRESHOLD: 15.0    // % profit to trigger first profit capture
};

// Drawdown Protection
export const DRAWDOWN_PROTECTION = {
  MAX_SYSTEM_DRAWDOWN_PERCENT: 10.0, // Max system drawdown before trading pause
  INDIVIDUAL_STRATEGY_MAX_DRAWDOWN: 15.0, // Max strategy drawdown before adjustment
  COOLDOWN_PERIOD_MINUTES: 60      // Cooldown period after hitting drawdown limit
};

// Trade Risk Thresholds
export const RISK_THRESHOLDS = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  EXTREME: 'EXTREME'
};

// Token volatility ratings (annualized volatility %)
export const TOKEN_VOLATILITY = {
  'SOL': 85,  // Solana: 85% annualized volatility
  'BONK': 150, // BONK: 150% annualized volatility
  'WIF': 200,  // WIF: 200% annualized volatility
  'MEME': 180, // MEME: 180% annualized volatility
  'JUP': 120,  // Jupiter: 120% annualized volatility
  'USDC': 1,   // USDC: 1% annualized volatility (stablecoin)
  'ETH': 70    // Ethereum: 70% annualized volatility
};

// Trade history for drawdown calculations
const tradeHistory: {
  timestamp: number;
  profit: number;
  token: string;
  strategy: string;
}[] = [];

// System state
let systemPaused = false;
let pauseEndTime = 0;
let currentDrawdown = 0;
let peakBalance = 0;
let currentBalance = 0;

/**
 * Calculate position size based on account balance and risk parameters
 * @param token Token to trade
 * @param accountBalance Account balance in USD
 * @param riskLevel Risk level for the trade
 * @returns Recommended position size in USD
 */
export function calculatePositionSize(
  token: string,
  accountBalance: number,
  riskLevel: keyof typeof RISK_THRESHOLDS = 'MEDIUM'
): number {
  // Base position size based on account risk
  let accountRiskPercent = POSITION_SIZING.MAX_ACCOUNT_RISK_PERCENT;
  
  // Adjust risk based on level
  switch (riskLevel) {
    case 'LOW':
      accountRiskPercent *= 0.5;
      break;
    case 'HIGH':
      accountRiskPercent *= 1.5;
      break;
    case 'EXTREME':
      accountRiskPercent *= 2.0;
      break;
    case 'MEDIUM':
    default:
      // No adjustment for medium risk
      break;
  }
  
  // Calculate base position size
  let positionSize = (accountBalance * (accountRiskPercent / 100));
  
  // Apply volatility adjustment if enabled
  if (POSITION_SIZING.VOLATILITY_ADJUSTMENT) {
    const tokenVolatility = TOKEN_VOLATILITY[token] || 100; // Default to 100% if unknown
    const volatilityFactor = 100 / tokenVolatility;
    
    positionSize = positionSize * volatilityFactor;
    
    logger.info(`[RiskManager] Applied volatility adjustment factor ${volatilityFactor.toFixed(2)} for ${token} (volatility: ${tokenVolatility}%)`);
  }
  
  // Apply min/max limits
  positionSize = Math.max(
    POSITION_SIZING.DEFAULT_POSITION_SIZE_USD,
    Math.min(POSITION_SIZING.MAX_POSITION_SIZE_USD, positionSize)
  );
  
  logger.info(`[RiskManager] Calculated position size: ${positionSize.toFixed(2)} USD for ${token} (risk level: ${riskLevel})`);
  
  return positionSize;
}

/**
 * Calculate stop-loss and take-profit levels
 * @param entryPrice Entry price
 * @param token Token being traded
 * @param isLong Whether the position is long (true) or short (false)
 * @returns Stop-loss and take-profit prices
 */
export function calculateStopLossTakeProfit(
  entryPrice: number,
  token: string,
  isLong: boolean = true
): {
  stopLossPrice: number;
  takeProfitPrice: number;
  trailingStopActivationPrice: number;
} {
  // Get token volatility or use default
  const tokenVolatility = TOKEN_VOLATILITY[token] || 100;
  
  // Adjust stop-loss based on volatility
  let stopLossPercent = STOP_LOSS_TAKE_PROFIT.DEFAULT_STOP_LOSS_PERCENT;
  let takeProfitPercent = STOP_LOSS_TAKE_PROFIT.DEFAULT_TAKE_PROFIT_PERCENT;
  
  // More volatile tokens need wider stops
  if (tokenVolatility > 150) {
    stopLossPercent = stopLossPercent * 1.5; // 50% wider for very volatile tokens
    takeProfitPercent = takeProfitPercent * 1.2; // 20% wider target
  } else if (tokenVolatility > 100) {
    stopLossPercent = stopLossPercent * 1.2; // 20% wider for moderately volatile tokens
  }
  
  // Calculate prices based on direction
  let stopLossPrice: number;
  let takeProfitPrice: number;
  
  if (isLong) {
    stopLossPrice = entryPrice * (1 - (stopLossPercent / 100));
    takeProfitPrice = entryPrice * (1 + (takeProfitPercent / 100));
  } else {
    stopLossPrice = entryPrice * (1 + (stopLossPercent / 100));
    takeProfitPrice = entryPrice * (1 - (takeProfitPercent / 100));
  }
  
  // Calculate trailing stop activation price
  const trailingStopActivationPrice = isLong
    ? entryPrice * (1 + (STOP_LOSS_TAKE_PROFIT.TRAILING_STOP_ACTIVATION_PERCENT / 100))
    : entryPrice * (1 - (STOP_LOSS_TAKE_PROFIT.TRAILING_STOP_ACTIVATION_PERCENT / 100));
  
  logger.info(`[RiskManager] Stop-loss set at ${stopLossPrice.toFixed(6)} (${stopLossPercent.toFixed(1)}%)`);
  logger.info(`[RiskManager] Take-profit set at ${takeProfitPrice.toFixed(6)} (${takeProfitPercent.toFixed(1)}%)`);
  
  return {
    stopLossPrice,
    takeProfitPrice,
    trailingStopActivationPrice
  };
}

/**
 * Record trade result for risk management
 * @param profit Profit/loss amount in USD (positive for profit, negative for loss)
 * @param token Token that was traded
 * @param strategy Strategy that was used
 */
export function recordTradeResult(
  profit: number,
  token: string,
  strategy: string
): void {
  // Add to trade history
  tradeHistory.push({
    timestamp: Date.now(),
    profit,
    token,
    strategy
  });
  
  // Maintain only last 100 trades
  if (tradeHistory.length > 100) {
    tradeHistory.shift();
  }
  
  // Update current balance
  currentBalance += profit;
  
  // Update peak balance if needed
  if (currentBalance > peakBalance) {
    peakBalance = currentBalance;
  }
  
  // Calculate current drawdown
  if (peakBalance > 0) {
    currentDrawdown = (peakBalance - currentBalance) / peakBalance * 100;
  }
  
  // Check if we need to pause trading
  if (currentDrawdown > DRAWDOWN_PROTECTION.MAX_SYSTEM_DRAWDOWN_PERCENT) {
    systemPaused = true;
    pauseEndTime = Date.now() + (DRAWDOWN_PROTECTION.COOLDOWN_PERIOD_MINUTES * 60 * 1000);
    
    logger.warn(`[RiskManager] System trading paused due to exceeding maximum drawdown threshold: ${currentDrawdown.toFixed(2)}%`);
    logger.warn(`[RiskManager] Trading will resume in ${DRAWDOWN_PROTECTION.COOLDOWN_PERIOD_MINUTES} minutes`);
  }
  
  // Log trade result
  logger.info(`[RiskManager] Recorded trade result: ${profit > 0 ? '+' : ''}${profit.toFixed(2)} USD for ${token} using ${strategy}`);
  logger.info(`[RiskManager] Current drawdown: ${currentDrawdown.toFixed(2)}%`);
}

/**
 * Check if system is currently paused due to risk management
 * @returns Whether the system is paused
 */
export function isSystemPaused(): boolean {
  // Check if pause period has ended
  if (systemPaused && Date.now() > pauseEndTime) {
    systemPaused = false;
    logger.info('[RiskManager] Trading resumed after cooldown period');
  }
  
  return systemPaused;
}

/**
 * Calculate daily profit and loss
 * @returns Daily P&L statistics
 */
export function getDailyProfitLoss(): {
  totalProfit: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  largestWin: number;
  largestLoss: number;
} {
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
  const dailyTrades = tradeHistory.filter(trade => trade.timestamp > oneDayAgo);
  
  const totalProfit = dailyTrades.reduce((sum, trade) => sum + trade.profit, 0);
  const winCount = dailyTrades.filter(trade => trade.profit > 0).length;
  const lossCount = dailyTrades.filter(trade => trade.profit < 0).length;
  const winRate = dailyTrades.length > 0 ? (winCount / dailyTrades.length) * 100 : 0;
  
  const largestWin = dailyTrades.length > 0
    ? Math.max(...dailyTrades.map(trade => trade.profit))
    : 0;
    
  const largestLoss = dailyTrades.length > 0
    ? Math.min(...dailyTrades.map(trade => trade.profit))
    : 0;
  
  return {
    totalProfit,
    winCount,
    lossCount,
    winRate,
    largestWin,
    largestLoss
  };
}

/**
 * Initialize the risk management system with account balance
 * @param balance Initial account balance in USD
 */
export function initializeRiskManagement(balance: number): void {
  currentBalance = balance;
  peakBalance = balance;
  currentDrawdown = 0;
  systemPaused = false;
  
  logger.info(`[RiskManager] Risk management system initialized with account balance: ${balance.toFixed(2)} USD`);
  logger.info(`[RiskManager] Max account risk per trade: ${POSITION_SIZING.MAX_ACCOUNT_RISK_PERCENT}%`);
  logger.info(`[RiskManager] Max daily risk: ${POSITION_SIZING.MAX_DAILY_RISK_PERCENT}%`);
}