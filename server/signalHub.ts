/**
 * Signal Hub - Centralized Communication System
 * 
 * This module serves as the central nervous system for all signal communication,
 * allowing different components of the system to receive and process signals from transformers.
 * It coordinates signal flow between transformers, agents, and other system components.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { Server } from 'http';
import { logger } from './logger';
import { MarketData } from './priceFeedCache';
import { v4 as uuidv4 } from 'uuid';
import { 
  SignalType, 
  SignalStrength, 
  SignalDirection, 
  SignalPriority, 
  SignalSource, 
  BaseSignal 
} from '../shared/signalTypes';

// Re-export the signal enums for backwards compatibility
export { 
  SignalType, 
  SignalStrength, 
  SignalDirection, 
  SignalSource,
  SignalPriority 
};

// Basic signal structure using the shared BaseSignal
export interface Signal extends BaseSignal {
  // Server-specific extensions can be added here
}

// Signal processor interface - components can implement this to process signals
export interface SignalProcessor {
  id: string;
  name: string;
  supportedSignalTypes: SignalType[];
  priority: number; // Higher priority processors get signals first
  process(signal: Signal): Promise<void>;
}

// Signal Hub class - singleton instance
class SignalHub extends EventEmitter {
  private static instance: SignalHub;
  private signalStore: Map<string, Signal> = new Map();
  private processors: SignalProcessor[] = [];
  private wsServer: WebSocketServer | null = null;
  private wsClients: Set<WebSocket> = new Set();
  private initialized: boolean = false;
  
  private constructor() {
    super();
    
    // Set maximum number of listeners to avoid memory leaks
    this.setMaxListeners(100);
  }
  
  /**
   * Get the SignalHub singleton instance
   */
  public static getInstance(): SignalHub {
    if (!SignalHub.instance) {
      SignalHub.instance = new SignalHub();
    }
    return SignalHub.instance;
  }
  
  /**
   * Initialize the signal hub
   */
  public async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }
    
    try {
      logger.info('Initializing Signal Hub communication system');
      this.initialized = true;
      return true;
    } catch (error) {
      logger.error('Failed to initialize Signal Hub:', error);
      return false;
    }
  }
  
  /**
   * Setup WebSocket server for signal communication
   * @param httpServer HTTP server instance
   */
  public setupWebSocketServer(httpServer: Server): WebSocketServer {
    this.wsServer = new WebSocketServer({ server: httpServer, path: '/signals' });
    
    this.wsServer.on('connection', (ws: WebSocket) => {
      logger.info('New signal WebSocket client connected');
      this.wsClients.add(ws);
      
      // Store client information
      const clientInfo = {
        subscribedPairs: new Set<string>(),
        subscribedTypes: new Set<string>(),
        subscribedSources: new Set<string>()
      };
      
      // Attach client info to the websocket connection
      (ws as any).clientInfo = clientInfo;
      
      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message);
          
          // Handle subscription requests
          if (data.type === 'subscribe') {
            if (data.pairs && Array.isArray(data.pairs)) {
              data.pairs.forEach((pair: string) => clientInfo.subscribedPairs.add(pair));
            }
            if (data.signalTypes && Array.isArray(data.signalTypes)) {
              data.signalTypes.forEach((type: string) => clientInfo.subscribedTypes.add(type));
            }
            if (data.sources && Array.isArray(data.sources)) {
              data.sources.forEach((source: string) => clientInfo.subscribedSources.add(source));
            }
            
            ws.send(JSON.stringify({
              type: 'subscription_confirmed',
              pairs: Array.from(clientInfo.subscribedPairs),
              signalTypes: Array.from(clientInfo.subscribedTypes),
              sources: Array.from(clientInfo.subscribedSources),
              timestamp: new Date().toISOString()
            }));
          }
        } catch (error) {
          logger.error('Error processing signal WebSocket message:', error);
        }
      });
      
      ws.on('close', () => {
        logger.info('Signal WebSocket client disconnected');
        this.wsClients.delete(ws);
      });
    });
    
    return this.wsServer;
  }
  
  /**
   * Register a signal processor
   * @param processor SignalProcessor implementation
   */
  public registerProcessor(processor: SignalProcessor): void {
    this.processors.push(processor);
    // Sort processors by priority (higher first)
    this.processors.sort((a, b) => b.priority - a.priority);
    logger.info(`Registered signal processor: ${processor.name}`);
  }
  
  /**
   * Process a signal through the hub
   * @param signal Signal to process
   */
  public async processSignal(signal: Signal): Promise<void> {
    const startTime = Date.now();
    let validationTime = 0;
    let broadcastTime = 0;
    let processingTime = 0;
    
    try {
      // Import here to avoid circular dependency
      const { signalValidator } = require('./signalValidator');
      const { signalMonitoring } = require('./signalMonitoring');
      
      // Generate ID if not provided
      if (!signal.id) {
        signal.id = this.generateSignalId();
      }
      
      // Set timestamp if not provided
      if (!signal.timestamp) {
        signal.timestamp = new Date();
      }
      
      // Start validation time tracking
      const validationStartTime = Date.now();
      
      // Validate the signal
      const validationResult = signalValidator.validate(signal);
      
      // End validation time tracking
      validationTime = Date.now() - validationStartTime;
      signalMonitoring.trackLatency(signal.id, 'validation', validationTime);
      
      // Only process valid signals
      if (!validationResult.valid) {
        logger.warn(`Signal validation failed for signal ${signal.id}: ${validationResult.errors.map(e => e.message).join(', ')}`);
        
        // Still store invalid signals but mark them
        signal.metadata = {
          ...signal.metadata,
          validationFailed: true,
          validationErrors: validationResult.errors.filter(e => e.severity === 'error').map(e => e.message)
        };
        
        // Store the invalid signal but don't process it further
        this.signalStore.set(signal.id, signal);
        
        // Track invalid signal
        signalMonitoring.trackSignal(signal, validationResult, Date.now() - startTime);
        return;
      }
      
      // Add validation warnings if any
      if (validationResult.errors.length > 0) {
        signal.metadata = {
          ...signal.metadata,
          validationWarnings: validationResult.errors.filter(e => e.severity === 'warning').map(e => e.message)
        };
      }
      
      // Add performance metrics tracking
      signal.metadata = {
        ...signal.metadata,
        performance: {
          generatedAt: signal.timestamp.getTime(),
          processedAt: Date.now(),
          validationTimeMs: validationTime
        }
      };
      
      // Add to signal store
      this.signalStore.set(signal.id, signal);
      
      // Manage signal store size
      if (this.signalStore.size > 5000) {
        // Remove oldest signals when store gets too large
        const keys = Array.from(this.signalStore.keys());
        const oldestKeys = keys.slice(0, 1000); // Remove 1000 oldest signals
        for (const key of oldestKeys) {
          this.signalStore.delete(key);
        }
      }
      
      // Emit signal event for any listeners
      this.emit('signal', signal);
      this.emit(`signal:${signal.type}`, signal);
      this.emit(`signal:${signal.source}`, signal);
      this.emit(`signal:${signal.pair}`, signal);
      
      // Broadcast to WebSocket clients
      const broadcastStartTime = Date.now();
      this.broadcastSignal(signal);
      broadcastTime = Date.now() - broadcastStartTime;
      
      // Track broadcast latency
      signalMonitoring.trackLatency(signal.id, 'delivery', broadcastTime);
      
      // Process through registered processors
      const processingStartTime = Date.now();
      let processingSuccess = true;
      
      for (const processor of this.processors) {
        if (processor.supportedSignalTypes.includes(signal.type) || 
            processor.supportedSignalTypes.includes(SignalType.CUSTOM)) {
          try {
            const componentStartTime = Date.now();
            await processor.process(signal);
            const componentProcessingTime = Date.now() - componentStartTime;
            
            // Track component health
            signalMonitoring.trackComponentHealth(
              processor.name,
              true,
              componentProcessingTime
            );
          } catch (processorError) {
            processingSuccess = false;
            logger.error(`Error in signal processor ${processor.name}:`, processorError);
            
            // Track component error
            signalMonitoring.trackComponentHealth(
              processor.name,
              false,
              0
            );
          }
        }
      }
      
      processingTime = Date.now() - processingStartTime;
      
      // Track processing latency
      signalMonitoring.trackLatency(signal.id, 'processing', processingTime);
      
      // Calculate generation time (time between signal timestamp and when it was received)
      const generationTime = signal.timestamp.getTime() < startTime ? 
        startTime - signal.timestamp.getTime() : 0;
      
      // Track generation latency
      signalMonitoring.trackLatency(signal.id, 'generation', generationTime);
      
      // Update signal with performance data
      signal.metadata.performance = {
        ...signal.metadata.performance,
        totalTimeMs: Date.now() - startTime,
        broadcastTimeMs: broadcastTime,
        processingTimeMs: processingTime,
        generationTimeMs: generationTime
      };
      
      // Update signal store with final performance data
      this.signalStore.set(signal.id, signal);
      
      // Track entire signal processing
      signalMonitoring.trackSignal(signal, validationResult, Date.now() - startTime);
      
      logger.debug(`Processed signal ${signal.id} of type ${signal.type} from ${signal.source} in ${Date.now() - startTime}ms`);
    } catch (error) {
      logger.error('Error processing signal:', error);
    }
  }
  
  /**
   * Submit a signal to the hub
   * @param signal Signal to submit
   */
  public async submitSignal(signal: Signal): Promise<string> {
    // Generate ID if not provided
    if (!signal.id) {
      signal.id = this.generateSignalId();
    }
    
    // Process the signal
    await this.processSignal(signal);
    
    return signal.id;
  }
  
  /**
   * Generate a unique signal ID
   */
  private generateSignalId(): string {
    return `sig_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  }
  
  /**
   * Get a signal by ID
   * @param id Signal ID
   */
  public getSignal(id: string): Signal | undefined {
    return this.signalStore.get(id);
  }
  
  /**
   * Get all signals matching specific criteria
   * @param criteria Signal search criteria
   */
  public getSignals(criteria: { 
    types?: SignalType[],
    sources?: SignalSource[],
    pairs?: string[],
    since?: Date,
    limit?: number
  } = {}): Signal[] {
    let signals = Array.from(this.signalStore.values());
    
    // Apply filters
    if (criteria.types && criteria.types.length > 0) {
      signals = signals.filter(s => criteria.types?.includes(s.type));
    }
    
    if (criteria.sources && criteria.sources.length > 0) {
      signals = signals.filter(s => criteria.sources?.includes(s.source));
    }
    
    if (criteria.pairs && criteria.pairs.length > 0) {
      signals = signals.filter(s => criteria.pairs?.includes(s.pair));
    }
    
    if (criteria.since) {
      signals = signals.filter(s => s.timestamp >= criteria.since);
    }
    
    // Sort by timestamp (newest first)
    signals.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    // Apply limit
    if (criteria.limit) {
      signals = signals.slice(0, criteria.limit);
    }
    
    return signals;
  }
  
  /**
   * Find related signals for a given signal
   * @param signalId Signal ID
   */
  public findRelatedSignals(signalId: string): Signal[] {
    const signal = this.getSignal(signalId);
    if (!signal || !signal.relatedSignals || signal.relatedSignals.length === 0) {
      return [];
    }
    
    return signal.relatedSignals
      .map(id => this.getSignal(id))
      .filter(s => s !== undefined) as Signal[];
  }
  
  /**
   * Broadcast a signal to all WebSocket clients
   * @param signal Signal to broadcast
   */
  private broadcastSignal(signal: Signal): void {
    if (!this.wsClients.size) {
      return; // No clients connected
    }
    
    const message = JSON.stringify({
      type: 'signal',
      signal
    });
    
    for (const client of this.wsClients) {
      if (client.readyState !== WebSocket.OPEN) {
        continue;
      }
      
      const clientInfo = (client as any).clientInfo;
      if (!clientInfo) {
        continue;
      }
      
      // Check if client is subscribed to this signal
      const subscribedToPair = clientInfo.subscribedPairs.size === 0 || 
                               clientInfo.subscribedPairs.has(signal.pair);
      
      const subscribedToType = clientInfo.subscribedTypes.size === 0 || 
                               clientInfo.subscribedTypes.has(signal.type);
      
      const subscribedToSource = clientInfo.subscribedSources.size === 0 || 
                                 clientInfo.subscribedSources.has(signal.source);
      
      // Send if subscribed
      if (subscribedToPair && subscribedToType && subscribedToSource) {
        client.send(message);
      }
    }
  }
  
  /**
   * Process market data through transformers and generate signals
   * @param marketData Market data to process
   */
  public async processMarketData(marketData: MarketData): Promise<void> {
    try {
      // This would call the Rust transformers in a real implementation
      // For now, we'll simulate transformer signals for demonstration
      
      // Simulate MicroQHC transformer signal
      if (Math.random() < 0.15) { // 15% chance
        const signal: Signal = {
          id: this.generateSignalId(),
          timestamp: new Date(),
          pair: marketData.pair,
          type: SignalType.PATTERN_RECOGNITION,
          source: SignalSource.MICRO_QHC,
          strength: SignalStrength.STRONG,
          direction: marketData.price_change_24h > 0 ? 
            SignalDirection.BULLISH : SignalDirection.BEARISH,
          priority: SignalPriority.HIGH,
          confidence: 75 + (Math.random() * 20),
          description: `MicroQHC detected quantum pattern in ${marketData.pair}`,
          metadata: {
            pattern: 'quantum-oscillation',
            indicators: {
              rsi: marketData.indicators?.rsi || 50,
              macd: marketData.indicators?.macd || { line: 0, signal: 0, histogram: 0 }
            },
            priceChange: marketData.price_change_24h,
            volume: marketData.volume24h
          },
          actionable: true,
          token_address: marketData.token_address || '',
          analysis: {
            volatility: marketData.volatility || 0,
            liquidity: marketData.liquidity || 0,
            momentum: Math.random() * 100, // Sample momentum value
            support: marketData.price * 0.9,
            resistance: marketData.price * 1.1
          },
          metrics: {
            volumeToMcapRatio: marketData.volume24h / (marketData.market_cap || 1),
            priceDeviation: Math.abs(marketData.price_change_24h || 0),
            trendStrength: Math.random() * 100
          },
          targetComponents: ['HyperionAgent', 'QuantumOmegaAgent']
        };
        
        await this.processSignal(signal);
      }
      
      // Simulate MEME Cortex transformer signal for meme coins
      if ((marketData.pair.includes('BONK') || marketData.pair.includes('PEPE')) && 
          Math.random() < 0.25) { // 25% chance for meme coins
        const signal: Signal = {
          id: this.generateSignalId(),
          timestamp: new Date(),
          pair: marketData.pair,
          type: SignalType.SOCIAL_SENTIMENT,
          source: SignalSource.MEME_CORTEX,
          strength: SignalStrength.VERY_STRONG,
          direction: Math.random() > 0.3 ? 
            SignalDirection.BULLISH : SignalDirection.BEARISH,
          priority: SignalPriority.NORMAL,
          confidence: 70 + (Math.random() * 25),
          description: `MEME Cortex detected viral sentiment shift for ${marketData.pair}`,
          metadata: {
            sentimentShift: (Math.random() * 2 - 1).toFixed(2),
            viralScore: (Math.random() * 100).toFixed(1),
            socialVolume: (marketData.volume24h * (Math.random() * 0.1)).toFixed(0),
            platforms: ['twitter', 'telegram', 'discord']
          },
          actionable: Math.random() > 0.5,
          token_address: marketData.token_address || '',
          analysis: {
            socialMomentum: Math.random() * 100,
            viralCoefficient: Math.random() * 5,
            memePotential: Math.random() * 100,
            communityStrength: Math.random() * 100,
            influencerActivity: Math.random() * 100
          },
          metrics: {
            socialVolume24h: parseInt((marketData.volume24h * (Math.random() * 0.2)).toFixed(0)),
            mentionsCount: Math.floor(Math.random() * 10000),
            sentimentScore: Math.random() * 100,
            viralityIndex: Math.random() * 10
          },
          targetComponents: ['QuantumOmegaAgent', 'AIInsightsEngine']
        };
        
        await this.processSignal(signal);
      }
      
      // Occasionally generate MEV opportunity signals
      if (Math.random() < 0.1) { // 10% chance
        const profitEstimate = marketData.price * 0.005 * Math.random();
        const signal: Signal = {
          id: this.generateSignalId(),
          timestamp: new Date(),
          pair: marketData.pair,
          type: SignalType.MEV_OPPORTUNITY,
          source: SignalSource.HYPERION_AGENT,
          strength: SignalStrength.MODERATE,
          direction: SignalDirection.NEUTRAL,
          priority: SignalPriority.CRITICAL,
          confidence: 85 + (Math.random() * 10),
          description: `Hyperion detected MEV opportunity in ${marketData.pair}`,
          metadata: {
            opportunityType: 'cross-dex-arb',
            estimatedProfit: profitEstimate.toFixed(4),
            expiresIn: Math.floor(Math.random() * 10) + 1 + 's',
            route: ['jupiter', 'raydium', 'openbook']
          },
          actionable: true,
          ttl: 10, // Short time to live
          targetComponents: ['HyperionAgent', 'TransactionEngine'],
          token_address: marketData.token_address || '',
          analysis: {
            arbitrageSize: profitEstimate,
            executionComplexity: Math.random() * 10,
            gasEstimate: Math.random() * 0.01,
            competitionLevel: Math.random() * 100,
            flashLoanRequired: false
          },
          metrics: {
            profitPotential: profitEstimate,
            successProbability: Math.random() * 0.9 + 0.1,
            timeWindow: Math.floor(Math.random() * 10) + 1,
            gasEfficiency: Math.random() * 100
          }
        };
        
        await this.processSignal(signal);
      }
      
    } catch (error) {
      logger.error('Error processing market data through SignalHub:', error);
    }
  }
  
  /**
   * Subscribe to signals by type
   * @param type Signal type
   * @param callback Callback function
   */
  public onSignalType(type: SignalType, callback: (signal: Signal) => void): void {
    this.on(`signal:${type}`, callback);
  }
  
  /**
   * Subscribe to signals by source
   * @param source Signal source
   * @param callback Callback function
   */
  public onSignalSource(source: SignalSource, callback: (signal: Signal) => void): void {
    this.on(`signal:${source}`, callback);
  }
  
  /**
   * Subscribe to signals for a specific pair
   * @param pair Trading pair
   * @param callback Callback function
   */
  public onSignalPair(pair: string, callback: (signal: Signal) => void): void {
    this.on(`signal:${pair}`, callback);
  }
  
  /**
   * Subscribe to all signals
   * @param callback Callback function
   */
  public onAnySignal(callback: (signal: Signal) => void): void {
    this.on('signal', callback);
  }
  
  /**
   * Unsubscribe from signals
   * @param event Event name
   * @param callback Callback function
   */
  public offSignal(event: string, callback: (signal: Signal) => void): void {
    this.off(event, callback);
  }

  /**
   * Get signals targeted for a specific component
   * @param componentName The name of the component to filter by
   * @param limit Maximum number of signals to return
   * @returns Array of signals targeted for the component
   */
  public getSignalsForComponent(componentName: string, limit: number = 50): Signal[] {
    let signals = Array.from(this.signalStore.values());
    
    // Filter signals targeted for this component or with no targeting
    signals = signals.filter(signal => 
      !signal.targetComponents || 
      signal.targetComponents.length === 0 ||
      signal.targetComponents.includes(componentName)
    );
    
    // Sort by timestamp (newest first) and priority (highest first)
    signals.sort((a, b) => {
      // First sort by priority (descending)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      // Then sort by timestamp (newest first)
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
    
    // Apply limit
    if (limit) {
      signals = signals.slice(0, limit);
    }
    
    return signals;
  }

  /**
   * Subscribe to signals targeted for a specific component
   * @param componentName The name of the component 
   * @param callback Callback function
   */
  public onSignalsForComponent(componentName: string, callback: (signal: Signal) => void): void {
    // Listen for all signals
    this.on('signal', (signal: Signal) => {
      // Pass only signals targeted for this component or with no targeting
      if (!signal.targetComponents || 
          signal.targetComponents.length === 0 ||
          signal.targetComponents.includes(componentName)) {
        callback(signal);
      }
    });
  }
}

// Export the singleton instance
export const signalHub = SignalHub.getInstance();