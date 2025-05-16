/**
 * Risk Management Dashboard
 * 
 * Provides real-time risk monitoring and reporting for the trading system.
 */

import { logger } from '../logger';
import {
  isSystemPaused,
  getDailyProfitLoss,
  DRAWDOWN_PROTECTION,
  POSITION_SIZING
} from './riskManager';

// Position tracking
interface Position {
  token: string;
  entryPrice: number;
  size: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  entryTime: number;
  strategy: string;
}

// Active positions
const activePositions: Position[] = [];

/**
 * Add a new position to tracking
 * @param position Position to add
 */
export function addPosition(position: Position): void {
  activePositions.push(position);
  logger.info(`[RiskDashboard] Added new position: ${position.size} ${position.token} at ${position.entryPrice}`);
}

/**
 * Remove a position from tracking
 * @param token Token to remove
 * @param entryTime Entry time of the position to remove
 */
export function removePosition(token: string, entryTime: number): void {
  const index = activePositions.findIndex(p => p.token === token && p.entryTime === entryTime);
  
  if (index !== -1) {
    const position = activePositions[index];
    activePositions.splice(index, 1);
    logger.info(`[RiskDashboard] Removed position: ${position.size} ${position.token}`);
  }
}

/**
 * Update position with current price
 * @param token Token to update
 * @param entryTime Entry time of the position to update
 * @param currentPrice Current price
 */
export function updatePosition(token: string, entryTime: number, currentPrice: number): void {
  const position = activePositions.find(p => p.token === token && p.entryTime === entryTime);
  
  if (position) {
    position.currentPrice = currentPrice;
    position.pnl = (currentPrice - position.entryPrice) * position.size;
    position.pnlPercent = ((currentPrice / position.entryPrice) - 1) * 100;
    
    // Check for stop-loss or take-profit hit
    if (currentPrice <= position.stopLossPrice) {
      logger.warn(`[RiskDashboard] Stop-loss hit for ${position.token} position at ${currentPrice}`);
    }
    
    if (currentPrice >= position.takeProfitPrice) {
      logger.info(`[RiskDashboard] Take-profit hit for ${position.token} position at ${currentPrice}`);
    }
  }
}

/**
 * Get a summary of the current trading system risk
 * @returns Risk summary
 */
export function getRiskSummary(): string {
  const dailyPnL = getDailyProfitLoss();
  
  let summary = '=== RISK MANAGEMENT DASHBOARD ===\n';
  
  // System status
  summary += `System Status: ${isSystemPaused() ? 'PAUSED' : 'ACTIVE'}\n`;
  
  // Daily P&L
  summary += `Daily P&L: ${dailyPnL.totalProfit > 0 ? '+' : ''}${dailyPnL.totalProfit.toFixed(2)} USD\n`;
  summary += `Win Rate: ${dailyPnL.winRate.toFixed(1)}% (${dailyPnL.winCount}W / ${dailyPnL.lossCount}L)\n`;
  
  // Active positions
  summary += `Active Positions: ${activePositions.length}\n`;
  
  // Risk limits
  summary += `Max Trade Risk: ${POSITION_SIZING.MAX_ACCOUNT_RISK_PERCENT}%\n`;
  summary += `Max Drawdown: ${DRAWDOWN_PROTECTION.MAX_SYSTEM_DRAWDOWN_PERCENT}%\n`;
  
  // Position details
  if (activePositions.length > 0) {
    summary += '\nActive Positions:\n';
    
    activePositions.forEach(pos => {
      summary += `- ${pos.token}: ${pos.size} @ ${pos.entryPrice} | Current: ${pos.currentPrice} | P&L: ${pos.pnl.toFixed(2)} USD (${pos.pnlPercent > 0 ? '+' : ''}${pos.pnlPercent.toFixed(2)}%)\n`;
    });
  }
  
  return summary;
}

/**
 * Display the risk dashboard in the console
 */
export function displayRiskDashboard(): void {
  logger.info(getRiskSummary());
}

/**
 * Start periodic risk dashboard updates
 * @param intervalMs Interval in milliseconds
 */
export function startRiskDashboardUpdates(intervalMs: number = 3600000): void {
  // Display initial dashboard
  displayRiskDashboard();
  
  // Schedule periodic updates
  setInterval(displayRiskDashboard, intervalMs);
  
  logger.info(`[RiskDashboard] Risk dashboard updates scheduled every ${intervalMs / 60000} minutes`);
}