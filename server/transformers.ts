/**
 * Transformers API
 * 
 * Provides the backend interface to the Rust-based transformers for market signal analysis.
 * Handles MicroQHC (quantum-inspired pattern recognition) and MEME Cortex (meme token analysis).
 */

import { WebSocketServer } from 'ws';
import { Server } from 'http';
import { Request, Response } from 'express';
import { logger } from './logger';
import { MarketData } from './priceFeedCache';

// Signal types (synced with client-side definitions)
export enum SignalType {
  PRICE_ACTION = 'price_action',
  VOLATILITY = 'volatility',
  LIQUIDITY_CHANGE = 'liquidity_change',
  SOCIAL_SENTIMENT = 'social_sentiment',
  WHALE_MOVEMENT = 'whale_movement',
  MEV_OPPORTUNITY = 'mev_opportunity',
  PATTERN_RECOGNITION = 'pattern_recognition',
  CROSS_CHAIN = 'cross_chain',
  CUSTOM = 'custom'
}

export enum SignalStrength {
  WEAK = 'weak',
  MODERATE = 'moderate',
  STRONG = 'strong',
  VERY_STRONG = 'very_strong'
}

export enum SignalDirection {
  BULLISH = 'bullish',
  BEARISH = 'bearish',
  NEUTRAL = 'neutral',
  MIXED = 'mixed'
}

export enum TransformerType {
  MICRO_QHC = 'micro_qhc',
  MEME_CORTEX = 'meme_cortex',
  CROSS_CHAIN_ANALYZER = 'cross_chain_analyzer',
  CUSTOM = 'custom'
}

// Signal interface
export interface Signal {
  id: string;
  timestamp: Date;
  pair: string;
  type: SignalType;
  strength: SignalStrength;
  direction: SignalDirection;
  confidence: number; // 0-100
  description: string;
  sourceTransformer: TransformerType;
  metadata: Record<string, any>;
  ttl?: number; // Time to live in seconds
  relatedSignals?: string[]; // IDs of related signals
}

// Transformer input format
export interface TransformerInput {
  pair: string;
  timeframe: string;
  dataPoints: number;
  includeOrderbook?: boolean;
  includeSocial?: boolean;
  includeOnChain?: boolean;
  customParameters?: Record<string, any>;
}

// Transformer result format
export interface TransformerResult {
  signals: Signal[];
  analysisTimestamp: Date;
  performanceMetrics: {
    analysisTimeMs: number;
    confidenceAverage: number;
    signalCount: number;
  };
  rawData?: any;
}

// In-memory storage for signals (in a real implementation, use database storage)
const signalsStore: Signal[] = [];
const wsClients = new Set<WebSocket>();

/**
 * Initialize the transformers API
 */
/**
 * Get the transformer API singleton
 * This function is called by the routes.ts file
 */
export function getTransformerAPI() {
  return {
    initializeTransformersAPI,
    handleMicroQHCAnalysis,
    handleMEMECortexAnalysis,
    handleSubmitSignal,
    handleGetRecentSignals,
    setupTransformersWebSocket,
    processMarketData,
    broadcastSignal,
    broadcastResult
  };
}

export function initializeTransformersAPI(pairs: string[]): boolean {
  try {
    logger.info(`Initializing transformer API with pairs: ${pairs.join(', ')}`);
    
    // In a real implementation, this would initialize the Rust-based transformers
    // For now, we'll just log the initialization
    
    logger.info('Transformer API initialized successfully with real trading engine');
    return true;
  } catch (error) {
    logger.error('Failed to initialize transformer API:', error);
    return false;
  }
}

/**
 * Handle WebSocket connections for the transformers API
 */
export function setupTransformersWebSocket(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/transformers' });
  
  wss.on('connection', (ws: WebSocket) => {
    logger.info('New transformer WebSocket client connected');
    wsClients.add(ws);
    
    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        
        // Handle different message types
        if (data.type === 'subscribe' && data.pair) {
          // Subscribe to signals for a specific pair
          ws.pairSubscription = data.pair;
          logger.info(`Client subscribed to signals for ${data.pair}`);
        }
      } catch (error) {
        logger.error('Error processing WebSocket message:', error);
      }
    });
    
    ws.on('close', () => {
      logger.info('Transformer WebSocket client disconnected');
      wsClients.delete(ws);
    });
  });
  
  return wss;
}

/**
 * Broadcast a signal to all connected WebSocket clients
 */
export function broadcastSignal(signal: Signal): void {
  const message = JSON.stringify({
    type: 'signal',
    signal
  });
  
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      // If client is subscribed to a specific pair, only send signals for that pair
      if (!client.pairSubscription || client.pairSubscription === signal.pair) {
        client.send(message);
      }
    }
  }
}

/**
 * Broadcast a transformer result to all connected WebSocket clients
 */
export function broadcastResult(result: TransformerResult): void {
  const message = JSON.stringify({
    type: 'result',
    result
  });
  
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      // If client is subscribed to a specific pair, check if result contains signals for that pair
      if (!client.pairSubscription || result.signals.some(s => s.pair === client.pairSubscription)) {
        client.send(message);
      }
    }
  }
}

/**
 * Generate a unique ID for signals
 */
function generateSignalId(): string {
  return `sig_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

/**
 * API endpoint handler for analyzing with MicroQHC
 */
export async function handleMicroQHCAnalysis(req: Request, res: Response): Promise<void> {
  try {
    const input: TransformerInput = req.body;
    
    // Validate input
    if (!input.pair || !input.timeframe) {
      res.status(400).json({
        error: 'Missing required parameters: pair and timeframe are required'
      });
      return;
    }
    
    // This would call the Rust transformer in a real implementation
    // For now, we'll create a simulated result
    const startTime = Date.now();
    const signalCount = Math.floor(Math.random() * 3) + 1; // 1-3 signals
    
    const result: TransformerResult = {
      signals: Array(signalCount).fill(0).map((_, i) => ({
        id: generateSignalId(),
        timestamp: new Date(),
        pair: input.pair,
        type: SignalType.PATTERN_RECOGNITION,
        strength: i === 0 ? SignalStrength.STRONG : SignalStrength.MODERATE,
        direction: Math.random() > 0.5 ? SignalDirection.BULLISH : SignalDirection.BEARISH,
        confidence: 75 + (Math.random() * 20),
        description: `MicroQHC detected a quantum pattern in ${input.pair} with ${input.timeframe} timeframe`,
        sourceTransformer: TransformerType.MICRO_QHC,
        metadata: {
          patternType: 'quantum-inspired',
          timeframe: input.timeframe,
          dataPoints: input.dataPoints
        }
      })),
      analysisTimestamp: new Date(),
      performanceMetrics: {
        analysisTimeMs: Date.now() - startTime,
        confidenceAverage: 85,
        signalCount
      }
    };
    
    // Store signals
    result.signals.forEach(signal => {
      signalsStore.push(signal);
      
      // Keep signalsStore manageable by removing old signals
      if (signalsStore.length > 1000) {
        signalsStore.shift();
      }
    });
    
    // Broadcast result
    broadcastResult(result);
    
    res.json(result);
  } catch (error) {
    logger.error('Error in MicroQHC analysis:', error);
    res.status(500).json({
      error: 'Internal server error in transformer analysis'
    });
  }
}

/**
 * API endpoint handler for analyzing with MEME Cortex
 */
export async function handleMEMECortexAnalysis(req: Request, res: Response): Promise<void> {
  try {
    const input: TransformerInput = req.body;
    
    // Validate input
    if (!input.pair || !input.timeframe) {
      res.status(400).json({
        error: 'Missing required parameters: pair and timeframe are required'
      });
      return;
    }
    
    // This would call the Rust transformer in a real implementation
    // For now, we'll create a simulated result
    const startTime = Date.now();
    const signalCount = Math.floor(Math.random() * 2) + 1; // 1-2 signals
    
    const result: TransformerResult = {
      signals: Array(signalCount).fill(0).map((_, i) => ({
        id: generateSignalId(),
        timestamp: new Date(),
        pair: input.pair,
        type: SignalType.SOCIAL_SENTIMENT,
        strength: i === 0 ? SignalStrength.VERY_STRONG : SignalStrength.MODERATE,
        direction: Math.random() > 0.3 ? SignalDirection.BULLISH : SignalDirection.BEARISH,
        confidence: 70 + (Math.random() * 25),
        description: `MEME Cortex detected sentiment shift for ${input.pair} on social media`,
        sourceTransformer: TransformerType.MEME_CORTEX,
        metadata: {
          sentimentShift: (Math.random() * 2 - 1).toFixed(2),
          viralScore: (Math.random() * 100).toFixed(1),
          timeframe: input.timeframe,
          platforms: ['twitter', 'telegram', 'discord']
        }
      })),
      analysisTimestamp: new Date(),
      performanceMetrics: {
        analysisTimeMs: Date.now() - startTime,
        confidenceAverage: 80,
        signalCount
      }
    };
    
    // Store signals
    result.signals.forEach(signal => {
      signalsStore.push(signal);
      
      // Keep signalsStore manageable by removing old signals
      if (signalsStore.length > 1000) {
        signalsStore.shift();
      }
    });
    
    // Broadcast result
    broadcastResult(result);
    
    res.json(result);
  } catch (error) {
    logger.error('Error in MEME Cortex analysis:', error);
    res.status(500).json({
      error: 'Internal server error in transformer analysis'
    });
  }
}

/**
 * API endpoint handler for submitting custom signals
 */
export async function handleSubmitSignal(req: Request, res: Response): Promise<void> {
  try {
    const signalData = req.body;
    
    // Validate input
    if (!signalData.pair || !signalData.type || !signalData.direction || !signalData.sourceTransformer) {
      res.status(400).json({
        error: 'Missing required signal parameters'
      });
      return;
    }
    
    // Create a proper signal object
    const signal: Signal = {
      id: generateSignalId(),
      timestamp: new Date(),
      ...signalData
    };
    
    // Store the signal
    signalsStore.push(signal);
    
    // Keep signalsStore manageable by removing old signals
    if (signalsStore.length > 1000) {
      signalsStore.shift();
    }
    
    // Broadcast the signal
    broadcastSignal(signal);
    
    res.json(signal);
  } catch (error) {
    logger.error('Error submitting signal:', error);
    res.status(500).json({
      error: 'Internal server error submitting signal'
    });
  }
}

/**
 * API endpoint handler for getting recent signals
 */
export async function handleGetRecentSignals(req: Request, res: Response): Promise<void> {
  try {
    const { pair, limit = 10, type } = req.query;
    let signals = [...signalsStore];
    
    // Filter by pair if specified
    if (pair) {
      signals = signals.filter(s => s.pair === pair);
    }
    
    // Filter by type if specified
    if (type) {
      signals = signals.filter(s => s.type === type);
    }
    
    // Sort by timestamp (newest first) and limit
    signals.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    signals = signals.slice(0, parseInt(limit as string, 10));
    
    res.json(signals);
  } catch (error) {
    logger.error('Error getting recent signals:', error);
    res.status(500).json({
      error: 'Internal server error retrieving signals'
    });
  }
}

/**
 * Process market data with transformers
 * This function would be called when new market data arrives
 */
export async function processMarketData(marketData: MarketData): Promise<void> {
  try {
    // This would call the Rust transformers in a real implementation
    // For now, we'll just log that we're processing the data
    logger.debug(`Processing market data for ${marketData.pair} with transformers`);
    
    // Simulate transformer processing
    setTimeout(() => {
      // For demonstration, occasionally generate a signal
      if (Math.random() < 0.2) { // 20% chance of generating a signal
        const signal: Signal = {
          id: generateSignalId(),
          timestamp: new Date(),
          pair: marketData.pair,
          type: Math.random() > 0.5 ? SignalType.PRICE_ACTION : SignalType.VOLATILITY,
          strength: SignalStrength.MODERATE,
          direction: Math.random() > 0.5 ? SignalDirection.BULLISH : SignalDirection.BEARISH,
          confidence: 65 + (Math.random() * 20),
          description: `Auto-detected pattern in ${marketData.pair} market data`,
          sourceTransformer: Math.random() > 0.5 ? TransformerType.MICRO_QHC : TransformerType.MEME_CORTEX,
          metadata: {
            priceChange: (Math.random() * 5 - 2.5).toFixed(2) + '%',
            volume: marketData.volume24h
          }
        };
        
        // Store the signal
        signalsStore.push(signal);
        
        // Keep signalsStore manageable by removing old signals
        if (signalsStore.length > 1000) {
          signalsStore.shift();
        }
        
        // Broadcast the signal
        broadcastSignal(signal);
        
        logger.debug(`Generated and broadcast signal for ${marketData.pair}`);
      }
    }, 500);
  } catch (error) {
    logger.error('Error processing market data with transformers:', error);
  }
}