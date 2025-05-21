/**
 * Momentum Surfing Strategy
 * 
 * This strategy rides the momentum of trending tokens based on
 * neural signals from social analysis and price action.
 * Unlike the sniper strategy which focuses on entry, this strategy
 * manages positions over time with smart entry/exit points.
 */

import * as logger from '../logger';
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { getConfig, loadMemecortexConfig } from '../config';
import { NeuralSignal, SignalType, SignalDirection } from '../neural-communication-hub';

// Strategy parameters
export interface MomentumParameters {
  token: {
    symbol: string;
    address: string;
  };
  initialPositionSizeSOL: number;
  maxPositionSizeSOL: number;
  entryType: 'full' | 'dca';
  takeProfitTargets: number[]; // percentage targets for taking profit
  stopLossPercentage: number;
  maxHoldingPeriodHours: number;
  incrementalBuyThresholds?: number[]; // for DCA strategy
}

// Position details
export interface Position {
  id: string;
  tokenSymbol: string;
  tokenAddress: string;
  entryPrice: number;
  currentPrice?: number;
  initialAmountSOL: number;
  currentAmountSOL: number;
  entryTimestamp: number;
  lastUpdateTimestamp: number;
  unrealizedProfitPercentage?: number;
  status: 'active' | 'closed';
  takeProfitTargets: number[];
  takeProfitHit: boolean[];
  stopLossPercentage: number;
  stopLossHit: boolean;
  exitTimestamp?: number;
  exitReason?: string;
  transactions: {
    type: 'entry' | 'exit' | 'partial_exit';
    amountSOL: number;
    price: number;
    timestamp: number;
    transactionId?: string;
  }[];
}

// Active positions
const activePositions: Record<string, Position> = {};

// Position history
const closedPositions: Position[] = [];

// Signals that triggered positions
const positionTriggers: Record<string, NeuralSignal[]> = {};

// Strategy statistics
const strategyStats = {
  totalPositions: 0,
  activePositions: 0,
  successfulPositions: 0,
  failedPositions: 0,
  totalSOLInvested: 0,
  totalSOLReturned: 0,
  totalProfitSOL: 0,
  largestGainPercentage: 0,
  largestLossPercentage: 0
};

/**
 * Process a neural signal for potential momentum trade
 */
export async function processNeuralSignal(signal: NeuralSignal): Promise<boolean> {
  try {
    // Skip if not a relevant signal type
    if (![SignalType.TREND_CHANGE, SignalType.PRICE_MOVE, SignalType.OPPORTUNITY].includes(signal.type)) {
      return false;
    }
    
    // Skip if not bullish or slightly bullish
    if (![SignalDirection.BULLISH, SignalDirection.SLIGHTLY_BULLISH].includes(signal.direction)) {
      return false;
    }
    
    const payload = signal.payload;
    if (!payload || !payload.tokenSymbol || !payload.tokenAddress) {
      logger.warn('[MomentumSurfing] Received signal without token information');
      return false;
    }
    
    // Get configuration settings
    const config = loadMemecortexConfig();
    const minConfidence = config.signal_thresholds?.activation_threshold || 80;
    
    // Check confidence threshold
    if (payload.confidence < minConfidence) {
      logger.info(`[MomentumSurfing] Signal for ${payload.tokenSymbol} skipped, confidence too low: ${payload.confidence}% (threshold: ${minConfidence}%)`);
      return false;
    }
    
    // Check if we already have an active position for this token
    const positionKey = `${payload.tokenSymbol}-${payload.tokenAddress}`;
    if (activePositions[positionKey]) {
      // Track this signal as additional validation for the position
      positionTriggers[positionKey] = positionTriggers[positionKey] || [];
      positionTriggers[positionKey].push(signal);
      
      logger.info(`[MomentumSurfing] Added supporting signal for existing position on ${payload.tokenSymbol}`);
      return true;
    }
    
    // This is a new position opportunity
    logger.info(`[MomentumSurfing] Evaluating new position for ${payload.tokenSymbol} based on ${signal.type} signal`);
    
    // Create momentum parameters based on signal type and strength
    const params = createMomentumParameters(payload, signal);
    
    // Open the position
    const success = await openMomentumPosition(params, signal);
    
    return success;
  } catch (error) {
    logger.error(`[MomentumSurfing] Error processing neural signal: ${error.message}`);
    return false;
  }
}

/**
 * Create momentum parameters based on token and signal
 */
function createMomentumParameters(payload: any, signal: NeuralSignal): MomentumParameters {
  // Base parameters
  const params: MomentumParameters = {
    token: {
      symbol: payload.tokenSymbol,
      address: payload.tokenAddress
    },
    initialPositionSizeSOL: 0.05, // Default starting size
    maxPositionSizeSOL: 0.25,    // Default maximum size
    entryType: 'full',           // Default to full entry
    takeProfitTargets: [10, 25, 50], // Default take profit targets (%)
    stopLossPercentage: 15,      // Default stop loss (%)
    maxHoldingPeriodHours: 48    // Default max holding period (hours)
  };
  
  // Adjust based on signal strength
  switch (signal.strength) {
    case 'VERY_STRONG':
      params.initialPositionSizeSOL = 0.1;
      params.maxPositionSizeSOL = 0.3;
      params.takeProfitTargets = [15, 30, 60];
      params.stopLossPercentage = 12;
      break;
    case 'STRONG':
      params.initialPositionSizeSOL = 0.075;
      params.maxPositionSizeSOL = 0.25;
      params.takeProfitTargets = [12, 25, 50];
      params.stopLossPercentage = 15;
      break;
    case 'MEDIUM':
      // Keep default parameters
      break;
    case 'WEAK':
      params.initialPositionSizeSOL = 0.025;
      params.maxPositionSizeSOL = 0.15;
      params.takeProfitTargets = [8, 20, 40];
      params.stopLossPercentage = 20;
      break;
    case 'VERY_WEAK':
      params.initialPositionSizeSOL = 0.015;
      params.maxPositionSizeSOL = 0.1;
      params.takeProfitTargets = [5, 15, 30];
      params.stopLossPercentage = 25;
      break;
  }
  
  // For trend change signals, use DCA strategy instead of full entry
  if (signal.type === SignalType.TREND_CHANGE) {
    params.entryType = 'dca';
    params.incrementalBuyThresholds = [-5, -10, -15]; // Buy more at these dips (%)
  }
  
  // For momentum signals, adjust targets based on sentiment
  if (payload.sentimentScore) {
    const sentiment = payload.sentimentScore;
    if (sentiment > 80) {
      // Very positive sentiment - be more aggressive
      params.takeProfitTargets = params.takeProfitTargets.map(target => target * 1.2);
      params.maxHoldingPeriodHours = 72; // Hold longer
    } else if (sentiment < -50) {
      // Negative sentiment - be more cautious
      params.takeProfitTargets = params.takeProfitTargets.map(target => target * 0.8);
      params.maxHoldingPeriodHours = 24; // Exit sooner
      params.stopLossPercentage = params.stopLossPercentage * 0.8; // Tighter stop loss
    }
  }
  
  return params;
}

/**
 * Open a new momentum position
 */
async function openMomentumPosition(params: MomentumParameters, signal: NeuralSignal): Promise<boolean> {
  try {
    const config = getConfig();
    const useRealFunds = config.useRealFunds === true;
    
    // Generate unique position ID
    const positionId = `pos-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const positionKey = `${params.token.symbol}-${params.token.address}`;
    
    // Get current price (in a real implementation, this would be from a price API)
    const currentPrice = await getTokenPrice(params.token.address);
    if (!currentPrice) {
      logger.error(`[MomentumSurfing] Failed to get current price for ${params.token.symbol}`);
      return false;
    }
    
    // Create position object
    const position: Position = {
      id: positionId,
      tokenSymbol: params.token.symbol,
      tokenAddress: params.token.address,
      entryPrice: currentPrice,
      currentPrice: currentPrice,
      initialAmountSOL: params.initialPositionSizeSOL,
      currentAmountSOL: params.initialPositionSizeSOL,
      entryTimestamp: Date.now(),
      lastUpdateTimestamp: Date.now(),
      unrealizedProfitPercentage: 0,
      status: 'active',
      takeProfitTargets: params.takeProfitTargets,
      takeProfitHit: params.takeProfitTargets.map(() => false),
      stopLossPercentage: params.stopLossPercentage,
      stopLossHit: false,
      transactions: [{
        type: 'entry',
        amountSOL: params.initialPositionSizeSOL,
        price: currentPrice,
        timestamp: Date.now()
      }]
    };
    
    if (useRealFunds) {
      // In real mode, execute the trade
      const executionResult = await executeTokenBuy(
        params.token.address,
        params.initialPositionSizeSOL
      );
      
      if (!executionResult.success) {
        logger.error(`[MomentumSurfing] Failed to execute buy for ${params.token.symbol}: ${executionResult.error}`);
        return false;
      }
      
      // Update position with transaction data
      position.transactions[0].transactionId = executionResult.signature;
      
      logger.info(`[MomentumSurfing] Successfully bought ${params.token.symbol} with ${params.initialPositionSizeSOL} SOL at ${currentPrice}`);
      logger.info(`[MomentumSurfing] Transaction signature: ${executionResult.signature}`);
    } else {
      // Simulation mode
      logger.info(`[MomentumSurfing] SIMULATION: Would buy ${params.token.symbol} with ${params.initialPositionSizeSOL} SOL at ${currentPrice}`);
    }
    
    // Store the position
    activePositions[positionKey] = position;
    
    // Store the trigger signal
    positionTriggers[positionKey] = [signal];
    
    // Update stats
    strategyStats.totalPositions++;
    strategyStats.activePositions++;
    strategyStats.totalSOLInvested += params.initialPositionSizeSOL;
    
    logger.info(`[MomentumSurfing] Opened new momentum position for ${params.token.symbol} (ID: ${positionId})`);
    logger.info(`[MomentumSurfing] Initial position size: ${params.initialPositionSizeSOL} SOL`);
    logger.info(`[MomentumSurfing] Take profit targets: ${params.takeProfitTargets.join('%, ')}%`);
    logger.info(`[MomentumSurfing] Stop loss: ${params.stopLossPercentage}%`);
    
    return true;
  } catch (error) {
    logger.error(`[MomentumSurfing] Error opening momentum position: ${error.message}`);
    return false;
  }
}

/**
 * Get the current price of a token
 */
async function getTokenPrice(tokenAddress: string): Promise<number | null> {
  try {
    // In a real implementation, this would call a price API
    // For demonstration, we'll simulate with random prices
    
    // Generate a price between 0.01 and 10 (for demo purposes)
    return parseFloat((0.01 + Math.random() * 9.99).toFixed(6));
  } catch (error) {
    logger.error(`[MomentumSurfing] Error getting token price: ${error.message}`);
    return null;
  }
}

/**
 * Execute a token buy
 */
async function executeTokenBuy(tokenAddress: string, amountSOL: number): Promise<{
  success: boolean;
  signature?: string;
  error?: string;
}> {
  try {
    // This would typically integrate with Jupiter or another DEX aggregator
    // For demonstration, we'll simulate the buy
    
    // In a real implementation, this would create, sign, and send a transaction
    // For simulation, just return a dummy signature
    
    // Simulate execution delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
    
    // 90% success rate in simulation
    const simulationSuccess = Math.random() > 0.1;
    
    if (simulationSuccess) {
      return {
        success: true,
        signature: 'SIM_BUY_' + Math.random().toString(36).substring(2, 15)
      };
    } else {
      return {
        success: false,
        error: 'Simulation random failure'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Execute a token sell
 */
async function executeTokenSell(tokenAddress: string, amountSOL: number): Promise<{
  success: boolean;
  signature?: string;
  error?: string;
}> {
  try {
    // This would typically integrate with Jupiter or another DEX aggregator
    // For demonstration, we'll simulate the sell
    
    // Simulate execution delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
    
    // 90% success rate in simulation
    const simulationSuccess = Math.random() > 0.1;
    
    if (simulationSuccess) {
      return {
        success: true,
        signature: 'SIM_SELL_' + Math.random().toString(36).substring(2, 15)
      };
    } else {
      return {
        success: false,
        error: 'Simulation random failure'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update all active positions
 */
export async function updatePositions(): Promise<void> {
  try {
    logger.info(`[MomentumSurfing] Updating ${Object.keys(activePositions).length} active positions`);
    
    for (const key in activePositions) {
      const position = activePositions[key];
      
      // Skip closed positions
      if (position.status === 'closed') continue;
      
      // Get current price
      const currentPrice = await getTokenPrice(position.tokenAddress);
      if (!currentPrice) {
        logger.warn(`[MomentumSurfing] Failed to get current price for ${position.tokenSymbol}, skipping update`);
        continue;
      }
      
      // Update position data
      position.currentPrice = currentPrice;
      position.lastUpdateTimestamp = Date.now();
      
      // Calculate profit/loss
      const priceChangePercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
      position.unrealizedProfitPercentage = priceChangePercent;
      
      logger.info(`[MomentumSurfing] ${position.tokenSymbol} position updated: ${priceChangePercent.toFixed(2)}% P&L`);
      
      // Check for take profit or stop loss
      await checkExitConditions(position);
    }
  } catch (error) {
    logger.error(`[MomentumSurfing] Error updating positions: ${error.message}`);
  }
}

/**
 * Check for exit conditions on a position
 */
async function checkExitConditions(position: Position): Promise<void> {
  try {
    const config = getConfig();
    const useRealFunds = config.useRealFunds === true;
    
    if (!position.unrealizedProfitPercentage) return;
    
    // Check for stop loss
    if (position.unrealizedProfitPercentage <= -position.stopLossPercentage && !position.stopLossHit) {
      position.stopLossHit = true;
      
      logger.info(`[MomentumSurfing] Stop loss triggered for ${position.tokenSymbol} at ${position.unrealizedProfitPercentage.toFixed(2)}%`);
      
      // Exit the entire position
      if (useRealFunds) {
        const sellResult = await executeTokenSell(position.tokenAddress, position.currentAmountSOL);
        
        if (sellResult.success) {
          logger.info(`[MomentumSurfing] Successfully sold ${position.tokenSymbol} at stop loss`);
          logger.info(`[MomentumSurfing] Transaction signature: ${sellResult.signature}`);
          
          // Record the transaction
          position.transactions.push({
            type: 'exit',
            amountSOL: position.currentAmountSOL,
            price: position.currentPrice!,
            timestamp: Date.now(),
            transactionId: sellResult.signature
          });
          
          // Close the position
          await closePosition(position, 'stop_loss');
        } else {
          logger.error(`[MomentumSurfing] Failed to execute stop loss for ${position.tokenSymbol}: ${sellResult.error}`);
        }
      } else {
        // Simulation mode
        logger.info(`[MomentumSurfing] SIMULATION: Would sell ${position.tokenSymbol} at stop loss (${position.unrealizedProfitPercentage.toFixed(2)}%)`);
        
        // Record the transaction
        position.transactions.push({
          type: 'exit',
          amountSOL: position.currentAmountSOL,
          price: position.currentPrice!,
          timestamp: Date.now()
        });
        
        // Close the position
        await closePosition(position, 'stop_loss');
      }
      
      return;
    }
    
    // Check for take profit targets
    for (let i = 0; i < position.takeProfitTargets.length; i++) {
      const target = position.takeProfitTargets[i];
      
      if (position.unrealizedProfitPercentage >= target && !position.takeProfitHit[i]) {
        position.takeProfitHit[i] = true;
        
        logger.info(`[MomentumSurfing] Take profit target ${i+1} (${target}%) triggered for ${position.tokenSymbol} at ${position.unrealizedProfitPercentage.toFixed(2)}%`);
        
        // Calculate how much to sell (more aggressive with each target hit)
        const positionPercentage = (i === 0) ? 0.3 : // 30% on first target
                                  (i === 1) ? 0.5 : // 50% on second target
                                  1.0;              // 100% on final target
        
        const sellAmountSOL = position.currentAmountSOL * positionPercentage;
        
        if (useRealFunds) {
          const sellResult = await executeTokenSell(position.tokenAddress, sellAmountSOL);
          
          if (sellResult.success) {
            logger.info(`[MomentumSurfing] Successfully sold ${sellAmountSOL} SOL of ${position.tokenSymbol} at take profit #${i+1}`);
            logger.info(`[MomentumSurfing] Transaction signature: ${sellResult.signature}`);
            
            // Record the transaction
            position.transactions.push({
              type: i === position.takeProfitTargets.length - 1 ? 'exit' : 'partial_exit',
              amountSOL: sellAmountSOL,
              price: position.currentPrice!,
              timestamp: Date.now(),
              transactionId: sellResult.signature
            });
            
            // Update position amount
            position.currentAmountSOL -= sellAmountSOL;
            
            // If we've sold everything, close the position
            if (position.currentAmountSOL <= 0.0001 || i === position.takeProfitTargets.length - 1) {
              await closePosition(position, 'take_profit');
            }
          } else {
            logger.error(`[MomentumSurfing] Failed to execute take profit for ${position.tokenSymbol}: ${sellResult.error}`);
          }
        } else {
          // Simulation mode
          logger.info(`[MomentumSurfing] SIMULATION: Would sell ${sellAmountSOL} SOL of ${position.tokenSymbol} at take profit #${i+1} (${position.unrealizedProfitPercentage.toFixed(2)}%)`);
          
          // Record the transaction
          position.transactions.push({
            type: i === position.takeProfitTargets.length - 1 ? 'exit' : 'partial_exit',
            amountSOL: sellAmountSOL,
            price: position.currentPrice!,
            timestamp: Date.now()
          });
          
          // Update position amount
          position.currentAmountSOL -= sellAmountSOL;
          
          // If we've sold everything, close the position
          if (position.currentAmountSOL <= 0.0001 || i === position.takeProfitTargets.length - 1) {
            await closePosition(position, 'take_profit');
          }
        }
        
        // Since we've hit one target, no need to check others in this iteration
        break;
      }
    }
    
    // Check for time-based exit (if position has been open for too long)
    const positionAgeHours = (Date.now() - position.entryTimestamp) / (1000 * 60 * 60);
    const maxHoldingPeriodHours = 48; // Default max holding period
    
    if (positionAgeHours > maxHoldingPeriodHours) {
      logger.info(`[MomentumSurfing] Time-based exit triggered for ${position.tokenSymbol} after ${positionAgeHours.toFixed(1)} hours`);
      
      // Exit the entire position
      if (useRealFunds) {
        const sellResult = await executeTokenSell(position.tokenAddress, position.currentAmountSOL);
        
        if (sellResult.success) {
          logger.info(`[MomentumSurfing] Successfully sold ${position.tokenSymbol} at time-based exit`);
          logger.info(`[MomentumSurfing] Transaction signature: ${sellResult.signature}`);
          
          // Record the transaction
          position.transactions.push({
            type: 'exit',
            amountSOL: position.currentAmountSOL,
            price: position.currentPrice!,
            timestamp: Date.now(),
            transactionId: sellResult.signature
          });
          
          // Close the position
          await closePosition(position, 'time_based');
        } else {
          logger.error(`[MomentumSurfing] Failed to execute time-based exit for ${position.tokenSymbol}: ${sellResult.error}`);
        }
      } else {
        // Simulation mode
        logger.info(`[MomentumSurfing] SIMULATION: Would sell ${position.tokenSymbol} at time-based exit (${position.unrealizedProfitPercentage.toFixed(2)}%)`);
        
        // Record the transaction
        position.transactions.push({
          type: 'exit',
          amountSOL: position.currentAmountSOL,
          price: position.currentPrice!,
          timestamp: Date.now()
        });
        
        // Close the position
        await closePosition(position, 'time_based');
      }
    }
  } catch (error) {
    logger.error(`[MomentumSurfing] Error checking exit conditions for ${position.tokenSymbol}: ${error.message}`);
  }
}

/**
 * Close a position and update stats
 */
async function closePosition(position: Position, exitReason: string): Promise<void> {
  try {
    // Update position state
    position.status = 'closed';
    position.exitTimestamp = Date.now();
    position.exitReason = exitReason;
    
    // Calculate final result
    const entryAmountSOL = position.initialAmountSOL;
    const exitAmountSOL = position.transactions
      .filter(tx => tx.type === 'exit' || tx.type === 'partial_exit')
      .reduce((sum, tx) => sum + (tx.amountSOL * tx.price / position.entryPrice), 0);
    
    const profitSOL = exitAmountSOL - entryAmountSOL;
    const profitPercentage = ((exitAmountSOL / entryAmountSOL) - 1) * 100;
    
    logger.info(`[MomentumSurfing] Closed position for ${position.tokenSymbol}`);
    logger.info(`[MomentumSurfing] Exit reason: ${exitReason}`);
    logger.info(`[MomentumSurfing] Profit/Loss: ${profitSOL.toFixed(4)} SOL (${profitPercentage.toFixed(2)}%)`);
    
    // Update strategy stats
    strategyStats.activePositions--;
    strategyStats.totalSOLReturned += exitAmountSOL;
    strategyStats.totalProfitSOL += profitSOL;
    
    if (profitPercentage > 0) {
      strategyStats.successfulPositions++;
      if (profitPercentage > strategyStats.largestGainPercentage) {
        strategyStats.largestGainPercentage = profitPercentage;
      }
    } else {
      strategyStats.failedPositions++;
      if (profitPercentage < -strategyStats.largestLossPercentage) {
        strategyStats.largestLossPercentage = -profitPercentage;
      }
    }
    
    // Move to closed positions
    const positionKey = `${position.tokenSymbol}-${position.tokenAddress}`;
    closedPositions.push(position);
    delete activePositions[positionKey];
    delete positionTriggers[positionKey];
  } catch (error) {
    logger.error(`[MomentumSurfing] Error closing position: ${error.message}`);
  }
}

/**
 * Get strategy statistics
 */
export function getStrategyStats() {
  return {
    ...strategyStats,
    totalROI: strategyStats.totalSOLInvested > 0 
      ? ((strategyStats.totalSOLReturned / strategyStats.totalSOLInvested) - 1) * 100 
      : 0,
    winRate: strategyStats.totalPositions > 0 
      ? (strategyStats.successfulPositions / strategyStats.totalPositions) * 100 
      : 0,
    activePositionsCount: Object.keys(activePositions).length,
    closedPositionsCount: closedPositions.length
  };
}

/**
 * Get all active positions
 */
export function getActivePositions(): Position[] {
  return Object.values(activePositions);
}

/**
 * Get all closed positions
 */
export function getClosedPositions(): Position[] {
  return [...closedPositions];
}

// Update positions every 2 minutes
let updateInterval: NodeJS.Timeout | null = null;

/**
 * Initialize the Momentum Surfing Strategy
 */
export async function initialize(): Promise<boolean> {
  try {
    logger.info('[MomentumSurfing] Initializing Momentum Surfing Strategy...');
    
    // Start the position update interval
    if (updateInterval) {
      clearInterval(updateInterval);
    }
    
    updateInterval = setInterval(async () => {
      await updatePositions();
    }, 2 * 60 * 1000); // Every 2 minutes
    
    logger.info('[MomentumSurfing] Successfully initialized Momentum Surfing Strategy');
    return true;
  } catch (error) {
    logger.error(`[MomentumSurfing] Failed to initialize: ${error.message}`);
    return false;
  }
}

/**
 * Shutdown the Momentum Surfing Strategy
 */
export function shutdown(): void {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
  
  logger.info('[MomentumSurfing] Momentum Surfing Strategy shutdown');
}