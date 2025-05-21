/**
 * Neural Communication Hub
 * 
 * This module handles communication between neural components in the system,
 * allowing various transformers and processors to send and receive signals
 * for coordinated execution.
 */

import * as logger from './logger';
import { v4 as uuidv4 } from 'uuid';

// Signal priorities
export enum SignalPriority {
  LOW = 'LOW',              // Background processing, no urgency
  NORMAL = 'NORMAL',        // Standard priority
  HIGH = 'HIGH',            // Higher priority, process soon
  IMMEDIATE = 'IMMEDIATE'   // Highest priority, process ASAP
}

// Signal types
export enum SignalType {
  INFORMATION = 'INFORMATION', // Just informational
  PRICE_MOVE = 'PRICE_MOVE',   // Price movement detected
  VOLUME_SPIKE = 'VOLUME_SPIKE', // Volume spike detected
  LIQUIDITY_CHANGE = 'LIQUIDITY_CHANGE', // Liquidity change detected
  TREND_CHANGE = 'TREND_CHANGE', // Trend reversal or shift detected
  OPPORTUNITY = 'OPPORTUNITY', // Trading opportunity detected
  EXECUTION = 'EXECUTION',   // Signal to execute a trade
  RISK_ALERT = 'RISK_ALERT'  // Risk management alert
}

// Signal directions
export enum SignalDirection {
  BULLISH = 'BULLISH',       // Positive direction
  SLIGHTLY_BULLISH = 'SLIGHTLY_BULLISH', // Slightly positive
  NEUTRAL = 'NEUTRAL',       // No clear direction
  SLIGHTLY_BEARISH = 'SLIGHTLY_BEARISH', // Slightly negative
  BEARISH = 'BEARISH'        // Negative direction
}

// Signal strengths
export enum SignalStrength {
  VERY_WEAK = 'VERY_WEAK',   // Very low confidence
  WEAK = 'WEAK',             // Low confidence
  MEDIUM = 'MEDIUM',         // Medium confidence
  STRONG = 'STRONG',         // High confidence
  VERY_STRONG = 'VERY_STRONG' // Very high confidence
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
  payload: any;
  timestamp: number;
  processed: boolean;
  processingAttempts: number;
  lastProcessedTimestamp?: number;
}

// Signal subscriber function type
type SignalSubscriber = (signal: NeuralSignal) => Promise<void>;

// Storage for signals and subscriptions
const signalStore: Record<string, NeuralSignal> = {};
const subscriptions: Record<string, Record<string, SignalSubscriber[]>> = {};

// Maximum age for signals before cleanup (20 minutes)
const MAX_SIGNAL_AGE_MS = 20 * 60 * 1000;

// Signal staleness threshold (5 minutes)
const STALLED_SIGNAL_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Generate a unique signal ID
 */
function generateSignalId(): string {
  return `signal-${Date.now()}-${uuidv4().slice(0, 8)}`;
}

/**
 * Send a neural signal from a source to a target
 */
export async function sendSignal(
  source: string,
  target: string,
  type: SignalType,
  strength: SignalStrength,
  direction: SignalDirection,
  priority: SignalPriority,
  payload: any
): Promise<string> {
  const signalId = generateSignalId();
  
  const signal: NeuralSignal = {
    id: signalId,
    source,
    target,
    type,
    strength,
    direction,
    priority,
    payload,
    timestamp: Date.now(),
    processed: false,
    processingAttempts: 0
  };
  
  // Store the signal
  signalStore[signalId] = signal;
  
  // Process the signal asynchronously
  setTimeout(() => processSignal(signal), 0);
  
  return signalId;
}

/**
 * Process a neural signal and deliver to subscribers
 */
async function processSignal(signal: NeuralSignal): Promise<void> {
  try {
    if (signal.processed) {
      return;
    }
    
    signal.processingAttempts += 1;
    
    // Check if there are subscribers for this source-target pair
    const sourceSubscribers = subscriptions[signal.source] || {};
    const subscribers = sourceSubscribers[signal.target] || [];
    
    if (subscribers.length === 0) {
      // No subscribers, mark as processed
      signal.processed = true;
      signal.lastProcessedTimestamp = Date.now();
      return;
    }
    
    // Deliver the signal to each subscriber
    for (const subscriber of subscribers) {
      try {
        await subscriber(signal);
      } catch (error) {
        logger.error(`[NeuralComms] Error in subscriber (${signal.source} -> ${signal.target}): ${error.message}`);
      }
    }
    
    // Mark the signal as processed
    signal.processed = true;
    signal.lastProcessedTimestamp = Date.now();
  } catch (error) {
    logger.error(`[NeuralComms] Error processing signal ${signal.id}: ${error.message}`);
  }
}

/**
 * Subscribe to neural signals from a source to a target
 */
export function subscribeToSignals(
  source: string,
  target: string,
  handler: SignalSubscriber
): void {
  // Initialize source and target if needed
  subscriptions[source] = subscriptions[source] || {};
  subscriptions[source][target] = subscriptions[source][target] || [];
  
  // Add the subscriber
  subscriptions[source][target].push(handler);
  
  logger.info(`[NeuralComms] Added subscriber from ${source} to ${target}`);
}

/**
 * Unsubscribe from neural signals
 */
export function unsubscribeFromSignals(
  source: string,
  target: string,
  handler: SignalSubscriber
): boolean {
  // Check if source and target exist
  if (!subscriptions[source] || !subscriptions[source][target]) {
    return false;
  }
  
  // Find and remove the handler
  const handlers = subscriptions[source][target];
  const index = handlers.indexOf(handler);
  
  if (index !== -1) {
    handlers.splice(index, 1);
    logger.info(`[NeuralComms] Removed subscriber from ${source} to ${target}`);
    return true;
  }
  
  return false;
}

/**
 * Get a signal by ID
 */
export function getSignal(signalId: string): NeuralSignal | null {
  return signalStore[signalId] || null;
}

/**
 * Get all signals for a specific source
 */
export function getSignalsBySource(source: string): NeuralSignal[] {
  return Object.values(signalStore).filter(signal => signal.source === source);
}

/**
 * Get all signals for a specific target
 */
export function getSignalsByTarget(target: string): NeuralSignal[] {
  return Object.values(signalStore).filter(signal => signal.target === target);
}

/**
 * Clean up old signals
 */
function cleanupOldSignals(): void {
  const now = Date.now();
  let cleanedCount = 0;
  
  // Check for stalled signals first (signals being processed for too long)
  for (const signalId in signalStore) {
    const signal = signalStore[signalId];
    
    if (!signal.processed && (now - signal.timestamp) > STALLED_SIGNAL_THRESHOLD_MS) {
      logger.warn(`[NeuralComms] Detected stalled signal: ${signalId}, age: ${((now - signal.timestamp) / 1000).toFixed(3)}s`);
    }
  }
  
  // Clean up old signals
  for (const signalId in signalStore) {
    const signal = signalStore[signalId];
    
    if ((now - signal.timestamp) > MAX_SIGNAL_AGE_MS) {
      delete signalStore[signalId];
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    logger.info(`[NeuralComms] Cleaned up ${cleanedCount} old signals`);
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupOldSignals, 5 * 60 * 1000);

/**
 * Initialize the Neural Communication Hub
 */
export async function initializeNeuralCommunicationHub(): Promise<boolean> {
  try {
    logger.info('[NeuralComms] Initializing Neural Communication Hub...');
    
    // Run initial cleanup
    cleanupOldSignals();
    
    logger.info('[NeuralComms] Neural Communication Hub initialized successfully');
    return true;
  } catch (error) {
    logger.error(`[NeuralComms] Failed to initialize: ${error.message}`);
    return false;
  }
}

// Initialize when loaded directly
if (require.main === module) {
  initializeNeuralCommunicationHub().catch(error => {
    logger.error(`[NeuralComms] Error during initialization: ${error.message}`);
  });
}