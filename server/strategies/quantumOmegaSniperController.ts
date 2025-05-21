/**
 * Quantum Omega Sniper Controller
 * 
 * This controller processes neural signals from the meme token scanner
 * and triggers execution on the Quantum Omega system for sniper opportunities.
 */

import * as logger from '../logger';
import { TokenRelationship } from '../lib/memecoinGlobalCache';
import { NeuralSignal } from '../neural-communication-hub';
import { MemeTokenSignalType } from '../transformers/memeTokenNeuralTransformer';
import { executeSnipe, SniperParameters } from './quantum-omega-sniper';

// Minimum confidence required for execution
const MIN_EXECUTION_CONFIDENCE = 80;

// Minimum liquidity required (in SOL)
const MIN_LIQUIDITY_SOL = 5;

// Maximum price change for existing tokens (to avoid buying at the top)
const MAX_PRICE_CHANGE_PERCENT = 35;

// Configure execution thresholds
const EXECUTION_THRESHOLDS = {
  // How old a token can be (in hours) for a NEW_TOKEN_LAUNCH
  maxNewTokenAgeHours: 6,
  
  // Minimum price surge for PRICE_SURGE signals
  minPriceSurgePercent: 15,
  
  // Minimum volume for VOLUME_SPIKE signals
  minVolumeSpikeUSD: 50000,
  
  // Minimum score for SNIPER_OPPORTUNITY signals
  minSniperScore: 75
};

// Track tokens we've already processed to avoid duplicate executions
const processedTokens: Record<string, number> = {};
const COOLDOWN_PERIOD_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Process a neural signal and determine if it should trigger a sniper execution
 */
export async function processNeuralSignal(signal: NeuralSignal): Promise<boolean> {
  try {
    const payload = signal.payload;
    
    // Skip if payload is missing or doesn't contain token information
    if (!payload || !payload.tokenSymbol || !payload.tokenAddress) {
      logger.warn('[QuantumOmegaController] Received signal without token information');
      return false;
    }
    
    // Create a unique token identifier
    const tokenId = `${payload.tokenSymbol}-${payload.tokenAddress}`;
    
    // Check if we've already processed this token recently
    const now = Date.now();
    if (processedTokens[tokenId] && (now - processedTokens[tokenId]) < COOLDOWN_PERIOD_MS) {
      logger.info(`[QuantumOmegaController] Skipping ${payload.tokenSymbol}, already processed in last 30 minutes`);
      return false;
    }
    
    // Check signal confidence
    if (payload.confidence < MIN_EXECUTION_CONFIDENCE) {
      logger.info(`[QuantumOmegaController] Skipping ${payload.tokenSymbol}, confidence too low: ${payload.confidence}%`);
      return false;
    }
    
    // Check signal type and apply specific filters
    switch (payload.signalType) {
      case MemeTokenSignalType.NEW_TOKEN_LAUNCH:
        // Check token age
        if (payload.details?.ageHours && payload.details.ageHours > EXECUTION_THRESHOLDS.maxNewTokenAgeHours) {
          logger.info(`[QuantumOmegaController] Skipping ${payload.tokenSymbol}, token too old: ${payload.details.ageHours} hours`);
          return false;
        }
        
        // Check liquidity
        if (payload.details?.liquidity && payload.details.liquidity < MIN_LIQUIDITY_SOL) {
          logger.info(`[QuantumOmegaController] Skipping ${payload.tokenSymbol}, insufficient liquidity: ${payload.details.liquidity} SOL`);
          return false;
        }
        
        // New token launch signal passes filters, trigger execution
        logger.info(`[QuantumOmegaController] Processing NEW_TOKEN_LAUNCH signal for ${payload.tokenSymbol}`);
        return await executeTokenSnipe(payload, 'new_launch');
        
      case MemeTokenSignalType.PRICE_SURGE:
        // Check price change magnitude
        const priceChangeStr = payload.details?.priceChange24h || '0%';
        const priceChange = parseFloat(priceChangeStr.replace('%', ''));
        
        if (priceChange < EXECUTION_THRESHOLDS.minPriceSurgePercent) {
          logger.info(`[QuantumOmegaController] Skipping ${payload.tokenSymbol}, price change too small: ${priceChangeStr}`);
          return false;
        }
        
        if (priceChange > MAX_PRICE_CHANGE_PERCENT) {
          logger.info(`[QuantumOmegaController] Skipping ${payload.tokenSymbol}, price change too large: ${priceChangeStr}`);
          return false;
        }
        
        // Price surge signal passes filters, trigger execution
        logger.info(`[QuantumOmegaController] Processing PRICE_SURGE signal for ${payload.tokenSymbol}`);
        return await executeTokenSnipe(payload, 'price_surge');
        
      case MemeTokenSignalType.VOLUME_SPIKE:
        // Check volume
        if (payload.details?.volume24h && payload.details.volume24h < EXECUTION_THRESHOLDS.minVolumeSpikeUSD) {
          logger.info(`[QuantumOmegaController] Skipping ${payload.tokenSymbol}, volume too low: ${payload.details.volume24h}`);
          return false;
        }
        
        // Volume spike signal passes filters, trigger execution
        logger.info(`[QuantumOmegaController] Processing VOLUME_SPIKE signal for ${payload.tokenSymbol}`);
        return await executeTokenSnipe(payload, 'volume_spike');
        
      case MemeTokenSignalType.SNIPER_OPPORTUNITY:
        // Check score
        if (payload.details?.score && parseFloat(payload.details.score) < EXECUTION_THRESHOLDS.minSniperScore) {
          logger.info(`[QuantumOmegaController] Skipping ${payload.tokenSymbol}, score too low: ${payload.details.score}`);
          return false;
        }
        
        // Sniper opportunity signal passes filters, trigger execution
        logger.info(`[QuantumOmegaController] Processing SNIPER_OPPORTUNITY signal for ${payload.tokenSymbol}`);
        return await executeTokenSnipe(payload, 'sniper_opportunity');
        
      default:
        // For other signal types, we don't trigger execution
        logger.info(`[QuantumOmegaController] Skipping signal type ${payload.signalType} for ${payload.tokenSymbol}`);
        return false;
    }
  } catch (error) {
    logger.error(`[QuantumOmegaController] Error processing neural signal: ${error.message}`);
    return false;
  }
}

/**
 * Execute a token snipe based on signal data
 */
async function executeTokenSnipe(payload: any, triggerType: string): Promise<boolean> {
  try {
    // Update the processed tokens record
    const tokenId = `${payload.tokenSymbol}-${payload.tokenAddress}`;
    processedTokens[tokenId] = Date.now();
    
    // Calculate position size based on confidence and signal type
    const basePositionSize = 0.025; // 0.025 SOL base size
    const confidenceMultiplier = payload.confidence / 100;
    const positionSize = basePositionSize * confidenceMultiplier;
    
    // Calculate slippage based on liquidity and token type
    const slippage = calculateSlippageForToken(payload);
    
    // Prepare sniper parameters
    const sniperParams: SniperParameters = {
      token: {
        symbol: payload.tokenSymbol,
        address: payload.tokenAddress
      },
      positionSizeSOL: positionSize,
      maxSlippageBps: slippage,
      trigger: {
        type: triggerType,
        confidence: payload.confidence,
        source: 'neural_transformer'
      }
    };
    
    // Log the execution attempt
    logger.info(`[QuantumOmegaController] Executing snipe for ${payload.tokenSymbol} (${positionSize.toFixed(4)} SOL, ${slippage} bps slippage)`);
    
    // Execute the snipe through the Quantum Omega engine
    const result = await executeSnipe(sniperParams);
    
    if (result.success) {
      logger.info(`[QuantumOmegaController] Successfully executed snipe for ${payload.tokenSymbol}`);
      logger.info(`[QuantumOmegaController] Transaction signature: ${result.signature}`);
      return true;
    } else {
      logger.warn(`[QuantumOmegaController] Failed to execute snipe for ${payload.tokenSymbol}: ${result.error}`);
      return false;
    }
  } catch (error) {
    logger.error(`[QuantumOmegaController] Error executing token snipe: ${error.message}`);
    return false;
  }
}

/**
 * Calculate appropriate slippage for a token based on its properties
 */
function calculateSlippageForToken(payload: any): number {
  // Base slippage (in basis points)
  let slippage = 100; // 1% base slippage
  
  // Adjust based on liquidity
  const liquidity = payload.details?.liquidity || 0;
  
  if (liquidity < 10) {
    // Low liquidity tokens need higher slippage
    slippage += 200; // Additional 2%
  } else if (liquidity < 50) {
    // Medium liquidity tokens need moderate slippage
    slippage += 100; // Additional 1%
  }
  
  // Adjust based on signal type
  if (payload.signalType === MemeTokenSignalType.NEW_TOKEN_LAUNCH) {
    // New tokens typically need higher slippage
    slippage += 150; // Additional 1.5%
  }
  
  // Adjust based on price volatility
  const priceChange = payload.details?.priceChange24h ? parseFloat(payload.details.priceChange24h.replace('%', '')) : 0;
  
  if (priceChange > 20) {
    // Highly volatile tokens need higher slippage
    slippage += Math.min(100, priceChange / 2); // Additional up to 1%
  }
  
  // Cap maximum slippage
  return Math.min(500, slippage); // Maximum 5% slippage
}

/**
 * Initialize the Quantum Omega Sniper Controller
 */
export async function initialize(): Promise<boolean> {
  try {
    logger.info('[QuantumOmegaController] Initializing Quantum Omega Sniper Controller...');
    
    // Subscribe to neural signals from the token transformer
    const neuralComms = require('../neural-communication-hub');
    
    neuralComms.subscribeToSignals('MemeTokenTransformer', 'QuantumOmega', async (signal: NeuralSignal) => {
      logger.info(`[QuantumOmegaController] Received neural signal from MemeTokenTransformer for ${signal.payload?.tokenSymbol || 'unknown token'}`);
      await processNeuralSignal(signal);
    });
    
    logger.info('[QuantumOmegaController] Successfully initialized');
    return true;
  } catch (error) {
    logger.error(`[QuantumOmegaController] Failed to initialize: ${error.message}`);
    return false;
  }
}

/**
 * Initialize the controller on module load
 */
if (require.main === module) {
  initialize().catch(error => {
    logger.error(`[QuantumOmegaController] Error during initialization: ${error.message}`);
  });
}