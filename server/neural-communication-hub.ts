/**
 * Neural Communication Hub
 * 
 * This module provides a central communication system for neural signals
 * between various components of the trading system.
 */

import * as logger from './logger';

// Signal type definitions
export enum SignalType {
  PRICE_MOVE = 'PRICE_MOVE',
  VOLUME_SPIKE = 'VOLUME_SPIKE',
  TREND_CHANGE = 'TREND_CHANGE',
  NEW_TOKEN = 'NEW_TOKEN',
  LIQUIDITY_ADDED = 'LIQUIDITY_ADDED',
  RISK_ALERT = 'RISK_ALERT',
  OPPORTUNITY = 'OPPORTUNITY',
  INFORMATION = 'INFORMATION'
}

export enum SignalStrength {
  VERY_WEAK = 'VERY_WEAK',
  WEAK = 'WEAK',
  MEDIUM = 'MEDIUM',
  STRONG = 'STRONG',
  VERY_STRONG = 'VERY_STRONG'
}

export enum SignalDirection {
  BULLISH = 'BULLISH',
  SLIGHTLY_BULLISH = 'SLIGHTLY_BULLISH',
  NEUTRAL = 'NEUTRAL',
  SLIGHTLY_BEARISH = 'SLIGHTLY_BEARISH',
  BEARISH = 'BEARISH'
}

export enum SignalPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

// Neural signal interface
export interface NeuralSignal {
  id: string;
  source: string;
  target: string;
  type: SignalType;
  strength: SignalStrength;
  direction: SignalDirection;
  priority: SignalPriority;
  timestamp: number;
  payload: any;
  processed: boolean;
  processingAttempts: number;
  lastProcessed?: number;
  error?: string;
}

// Signal frequency control interface
interface SignalFrequencyControl {
  tokenSymbol: string;
  lastSignalTimestamp: number;
  cooldownPeriodMs: number;
  signalCount: number;
}

// In-memory signal storage
const signals: NeuralSignal[] = [];
const frequencyControls: Record<string, SignalFrequencyControl> = {};
const MAX_SIGNALS = 1000;
const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// Module state
const moduleState = {
  isInitialized: false,
  signalProcessorTimer: null as NodeJS.Timeout | null,
  processingIntervalMs: 1000, // Process signals every second
  activeConnections: {} as Record<string, boolean>
};

/**
 * Generate a unique signal ID
 */
function generateSignalId(): string {
  return `sig-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Check if a token is in cooldown period
 */
function isTokenInCooldown(tokenSymbol: string): boolean {
  const control = frequencyControls[tokenSymbol];
  if (!control) return false;
  
  const timeSinceLastSignal = Date.now() - control.lastSignalTimestamp;
  return timeSinceLastSignal < control.cooldownPeriodMs;
}

/**
 * Update token frequency control
 */
function updateTokenFrequencyControl(tokenSymbol: string): void {
  if (!tokenSymbol) return;
  
  const control = frequencyControls[tokenSymbol] || {
    tokenSymbol,
    lastSignalTimestamp: 0,
    cooldownPeriodMs: DEFAULT_COOLDOWN_MS,
    signalCount: 0
  };
  
  control.lastSignalTimestamp = Date.now();
  control.signalCount++;
  
  // Adjust cooldown based on frequency of signals
  // More frequent signals = longer cooldown
  if (control.signalCount > 10) {
    control.cooldownPeriodMs = Math.min(30 * 60 * 1000, control.cooldownPeriodMs * 1.5); // Up to 30 minutes
  }
  
  frequencyControls[tokenSymbol] = control;
}

/**
 * Send a neural signal from one component to another
 */
export async function sendSignal(
  source: string,
  target: string,
  type: SignalType,
  strength: SignalStrength,
  direction: SignalDirection,
  priority: SignalPriority = SignalPriority.NORMAL,
  payload: any = {}
): Promise<boolean> {
  try {
    // Check if the source and target are connected
    const connectionKey = `${source}-to-${target}`;
    if (!moduleState.activeConnections[connectionKey]) {
      logger.warn(`[NeuralHub] Cannot send signal: No active connection from ${source} to ${target}`);
      return false;
    }
    
    // Prevent excessive signaling for the same token
    const tokenSymbol = payload?.tokenSymbol;
    if (tokenSymbol && isTokenInCooldown(tokenSymbol)) {
      logger.info(`[NeuralHub] Signal for ${tokenSymbol} skipped: Token in cooldown period`);
      return false;
    }
    
    // Create the signal
    const signal: NeuralSignal = {
      id: generateSignalId(),
      source,
      target,
      type,
      strength,
      direction,
      priority,
      timestamp: Date.now(),
      payload,
      processed: false,
      processingAttempts: 0
    };
    
    // Add the signal to the queue
    signals.push(signal);
    
    // Update token frequency control
    if (tokenSymbol) {
      updateTokenFrequencyControl(tokenSymbol);
    }
    
    // Trim the signal queue if it's getting too large
    if (signals.length > MAX_SIGNALS) {
      // Remove the oldest processed signals first
      const processedCount = signals.filter(s => s.processed).length;
      if (processedCount > 0) {
        // Remove 10% of processed signals
        const removeCount = Math.max(1, Math.floor(processedCount * 0.1));
        const oldestProcessed = signals
          .filter(s => s.processed)
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(0, removeCount);
        
        oldestProcessed.forEach(s => {
          const index = signals.findIndex(sig => sig.id === s.id);
          if (index !== -1) {
            signals.splice(index, 1);
          }
        });
      } else {
        // If no processed signals, remove the oldest signals
        signals.sort((a, b) => a.timestamp - b.timestamp);
        signals.splice(0, Math.max(1, Math.floor(signals.length * 0.1)));
      }
    }
    
    logger.info(`[NeuralHub] Signal sent from ${source} to ${target}: ${type} (${strength}, ${direction})`);
    return true;
  } catch (error) {
    logger.error(`[NeuralHub] Error sending signal: ${error.message}`);
    return false;
  }
}

/**
 * Process all pending neural signals
 */
async function processSignals(): Promise<void> {
  try {
    // Find unprocessed signals
    const pendingSignals = signals.filter(s => !s.processed);
    if (pendingSignals.length === 0) return;
    
    logger.debug(`[NeuralHub] Processing ${pendingSignals.length} pending signals`);
    
    // Sort by priority and timestamp
    pendingSignals.sort((a, b) => {
      // First by priority
      const priorityOrder = {
        [SignalPriority.URGENT]: 0,
        [SignalPriority.HIGH]: 1,
        [SignalPriority.NORMAL]: 2,
        [SignalPriority.LOW]: 3
      };
      
      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      // Then by timestamp (oldest first)
      return a.timestamp - b.timestamp;
    });
    
    // Process each signal
    for (const signal of pendingSignals) {
      try {
        // Find appropriate handler based on target
        const handlerFound = await dispatchSignalToHandler(signal);
        
        if (handlerFound) {
          // Mark as processed
          signal.processed = true;
          signal.lastProcessed = Date.now();
        } else {
          // Increment attempts
          signal.processingAttempts++;
          
          // If too many attempts, mark as processed with error
          if (signal.processingAttempts >= 3) {
            signal.processed = true;
            signal.error = 'No handler found after multiple attempts';
            logger.warn(`[NeuralHub] No handler found for signal ${signal.id} after ${signal.processingAttempts} attempts`);
          }
        }
      } catch (error) {
        logger.error(`[NeuralHub] Error processing signal ${signal.id}: ${error.message}`);
        signal.processingAttempts++;
        signal.error = error.message;
        
        // Mark as processed after too many attempts
        if (signal.processingAttempts >= 3) {
          signal.processed = true;
        }
      }
    }
  } catch (error) {
    logger.error(`[NeuralHub] Error in signal processing: ${error.message}`);
  }
}

/**
 * Dispatch a signal to its target handler
 */
async function dispatchSignalToHandler(signal: NeuralSignal): Promise<boolean> {
  try {
    const { target } = signal;
    
    // Find and call the appropriate handler
    switch (target) {
      case 'QuantumOmega':
        // For Quantum Omega signals (sniper)
        try {
          const { processNeuralSignal } = require('./strategies/quantumOmegaSniperController');
          await processNeuralSignal(signal);
          return true;
        } catch (error) {
          logger.error(`[NeuralHub] Error routing to QuantumOmega: ${error.message}`);
          return false;
        }
        
      case 'MomentumSurfing':
        // For Momentum Surfing signals
        try {
          const { processNeuralSignal } = require('./strategies/momentum-surfing-strategy');
          await processNeuralSignal(signal);
          return true;
        } catch (error) {
          logger.error(`[NeuralHub] Error routing to MomentumSurfing: ${error.message}`);
          return false;
        }
        
      case 'Hyperion':
        // For Hyperion transformer signals
        try {
          logger.info(`[NeuralHub] Routing signal to Hyperion: ${signal.type}`);
          // Placeholder for Hyperion integration
          return true;
        } catch (error) {
          logger.error(`[NeuralHub] Error routing to Hyperion: ${error.message}`);
          return false;
        }
        
      case 'NexusEngine':
        // For Nexus Engine signals (execution)
        try {
          logger.info(`[NeuralHub] Routing signal to NexusEngine: ${signal.type}`);
          // Placeholder for NexusEngine integration
          return true;
        } catch (error) {
          logger.error(`[NeuralHub] Error routing to NexusEngine: ${error.message}`);
          return false;
        }
        
      default:
        logger.warn(`[NeuralHub] No handler found for target: ${target}`);
        return false;
    }
  } catch (error) {
    logger.error(`[NeuralHub] Error dispatching signal: ${error.message}`);
    return false;
  }
}

/**
 * Start the signal processor
 */
function startSignalProcessor(): void {
  if (moduleState.signalProcessorTimer) {
    clearInterval(moduleState.signalProcessorTimer);
  }
  
  moduleState.signalProcessorTimer = setInterval(async () => {
    await processSignals();
  }, moduleState.processingIntervalMs);
  
  logger.info(`[NeuralHub] Started signal processor with interval of ${moduleState.processingIntervalMs}ms`);
}

/**
 * Stop the signal processor
 */
function stopSignalProcessor(): void {
  if (moduleState.signalProcessorTimer) {
    clearInterval(moduleState.signalProcessorTimer);
    moduleState.signalProcessorTimer = null;
    logger.info('[NeuralHub] Stopped signal processor');
  }
}

/**
 * Setup neural connections between components
 */
function setupConnections(): void {
  // Define active connections
  const connections = [
    // From MemeToken transformer to strategies
    'MemeTokenTransformer-to-QuantumOmega',
    'MemeTokenTransformer-to-MomentumSurfing',
    'MemeTokenTransformer-to-Hyperion',
    
    // From SocialAnalyzer to strategies
    'SocialAnalyzer-to-QuantumOmega',
    'SocialAnalyzer-to-MomentumSurfing',
    
    // From MemeCortex transformers to strategies
    'MemeCortex-to-QuantumOmega',
    'MemeCortex-to-MomentumSurfing',
    'MemeCortex-to-Hyperion',
    
    // From strategies to execution engine
    'QuantumOmega-to-NexusEngine',
    'MomentumSurfing-to-NexusEngine',
    'Hyperion-to-NexusEngine'
  ];
  
  // Enable all connections
  connections.forEach(connection => {
    moduleState.activeConnections[connection] = true;
  });
  
  logger.info(`[NeuralHub] Set up ${connections.length} neural connections`);
}

/**
 * Initialize the Neural Communication Hub
 */
export async function initialize(): Promise<boolean> {
  try {
    if (moduleState.isInitialized) {
      logger.info('[NeuralHub] Already initialized');
      return true;
    }
    
    logger.info('[NeuralHub] Initializing Neural Communication Hub...');
    
    // Setup connections
    setupConnections();
    
    // Start signal processor
    startSignalProcessor();
    
    moduleState.isInitialized = true;
    logger.info('[NeuralHub] Successfully initialized Neural Communication Hub');
    return true;
  } catch (error) {
    logger.error(`[NeuralHub] Failed to initialize: ${error.message}`);
    return false;
  }
}

/**
 * Shutdown the Neural Communication Hub
 */
export function shutdown(): void {
  stopSignalProcessor();
  
  // Clear signals and connections
  signals.length = 0;
  Object.keys(moduleState.activeConnections).forEach(key => {
    moduleState.activeConnections[key] = false;
  });
  
  moduleState.isInitialized = false;
  logger.info('[NeuralHub] Neural Communication Hub shutdown');
}

// Initialize on module load if running directly
if (require.main === module) {
  initialize().catch(error => {
    logger.error(`[NeuralHub] Error during initialization: ${error.message}`);
  });
}