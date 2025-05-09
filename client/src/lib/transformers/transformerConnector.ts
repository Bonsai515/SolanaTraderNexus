/**
 * Transformer Connector
 * Bridges the frontend and backend transformer systems, enabling communication between
 * AI modules, trading agents, and market data sources
 */

import { WebSocket } from 'ws';
import { getSolanaWebSocketUrl } from '../solanaConnection';
import hybridIntelligence from '../ai/hybridIntelligence';
import rateLimiter from '../rpc/rateLimiter';

export class TransformerConnector {
  private static instance: TransformerConnector;
  
  // WebSocket connection to transformer system
  private ws: WebSocket | null = null;
  
  // Message queue
  private messageQueue: any[] = [];
  
  // Connection status
  private isConnected: boolean = false;
  
  // Pending requests
  private pendingRequests: Map<string, { 
    resolve: (value: any) => void, 
    reject: (reason: any) => void,
    timestamp: number
  }> = new Map();
  
  // Request timeout (10 seconds)
  private requestTimeout: number = 10000;
  
  // Callback registrations
  private eventCallbacks: Map<string, Set<(data: any) => void>> = new Map();
  
  private constructor() {
    console.log('Initializing Transformer Connector');
    
    // Start periodic cleanup of timed-out requests
    setInterval(() => this.cleanupTimedOutRequests(), 5000);
    
    // Try to connect
    this.connect();
  }
  
  /**
   * Get the TransformerConnector instance (singleton)
   */
  public static getInstance(): TransformerConnector {
    if (!TransformerConnector.instance) {
      TransformerConnector.instance = new TransformerConnector();
    }
    
    return TransformerConnector.instance;
  }
  
  /**
   * Connect to the transformer system
   */
  private connect(): void {
    try {
      // Get WebSocket URL (could be a separate transformer URL in production)
      const wsUrl = getSolanaWebSocketUrl();
      
      // Connect to WebSocket
      this.ws = new WebSocket(wsUrl);
      
      // Set up event handlers
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      
      console.log('Connecting to transformer system...');
    } catch (error) {
      console.error('Error connecting to transformer system:', error);
      
      // Try to reconnect after 5 seconds
      setTimeout(() => this.connect(), 5000);
    }
  }
  
  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    console.log('Connected to transformer system');
    
    this.isConnected = true;
    
    // Process any queued messages
    this.processQueue();
    
    // Trigger connected event
    this.triggerEvent('connected', {
      timestamp: new Date()
    });
  }
  
  /**
   * Handle WebSocket message event
   */
  private handleMessage(event: any): void {
    try {
      // Parse message
      const message = JSON.parse(event.data);
      
      // Handle different message types
      if (message.type === 'response' && message.requestId) {
        // Handle response to a request
        this.handleResponse(message);
      } else if (message.type === 'event') {
        // Handle event notification
        this.handleEvent(message);
      } else {
        // Handle unknown message type
        console.warn('Unknown message type from transformer system:', message);
      }
    } catch (error) {
      console.error('Error handling message from transformer system:', error);
    }
  }
  
  /**
   * Handle WebSocket error event
   */
  private handleError(error: any): void {
    console.error('WebSocket error:', error);
    this.isConnected = false;
    
    // Trigger disconnected event
    this.triggerEvent('disconnected', {
      error,
      timestamp: new Date()
    });
  }
  
  /**
   * Handle WebSocket close event
   */
  private handleClose(): void {
    console.log('Disconnected from transformer system');
    this.isConnected = false;
    
    // Trigger disconnected event
    this.triggerEvent('disconnected', {
      timestamp: new Date()
    });
    
    // Try to reconnect after 5 seconds
    setTimeout(() => this.connect(), 5000);
  }
  
  /**
   * Process message queue
   */
  private processQueue(): void {
    if (!this.isConnected || !this.ws) {
      return;
    }
    
    // Process all queued messages
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending message to transformer system:', error);
        
        // If there was an error, re-queue the message
        this.messageQueue.unshift(message);
        
        // And stop processing for now
        break;
      }
    }
  }
  
  /**
   * Send a message to the transformer system
   */
  private sendMessage(message: any): void {
    if (!this.isConnected || !this.ws) {
      // Queue the message for later
      this.messageQueue.push(message);
      return;
    }
    
    try {
      // Send the message
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending message to transformer system:', error);
      
      // Queue the message for later
      this.messageQueue.push(message);
    }
  }
  
  /**
   * Send a request to the transformer system and wait for a response
   */
  public async sendRequest(type: string, data: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        // Generate a request ID
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Register the pending request
        this.pendingRequests.set(requestId, {
          resolve,
          reject,
          timestamp: Date.now()
        });
        
        // Send the request
        this.sendMessage({
          type,
          requestId,
          data,
          timestamp: new Date()
        });
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Handle a response from the transformer system
   */
  private handleResponse(message: any): void {
    // Get the request ID
    const { requestId, data, error } = message;
    
    // Find the pending request
    const pendingRequest = this.pendingRequests.get(requestId);
    
    if (pendingRequest) {
      // Remove the pending request
      this.pendingRequests.delete(requestId);
      
      // Handle success or error
      if (error) {
        pendingRequest.reject(error);
      } else {
        pendingRequest.resolve(data);
      }
    }
  }
  
  /**
   * Handle an event from the transformer system
   */
  private handleEvent(message: any): void {
    // Get the event type and data
    const { event, data } = message;
    
    // Trigger the event
    this.triggerEvent(event, data);
  }
  
  /**
   * Clean up timed-out requests
   */
  private cleanupTimedOutRequests(): void {
    const now = Date.now();
    
    for (const [requestId, request] of this.pendingRequests.entries()) {
      if (now - request.timestamp > this.requestTimeout) {
        // Remove the pending request
        this.pendingRequests.delete(requestId);
        
        // Reject the request with a timeout error
        request.reject(new Error('Request timed out'));
      }
    }
  }
  
  /**
   * Register a callback for an event
   */
  public on(event: string, callback: (data: any) => void): void {
    // Get or create the callback set
    let callbacks = this.eventCallbacks.get(event);
    
    if (!callbacks) {
      callbacks = new Set();
      this.eventCallbacks.set(event, callbacks);
    }
    
    // Add the callback
    callbacks.add(callback);
  }
  
  /**
   * Unregister a callback for an event
   */
  public off(event: string, callback: (data: any) => void): void {
    // Get the callback set
    const callbacks = this.eventCallbacks.get(event);
    
    if (callbacks) {
      // Remove the callback
      callbacks.delete(callback);
      
      // If there are no more callbacks, remove the set
      if (callbacks.size === 0) {
        this.eventCallbacks.delete(event);
      }
    }
  }
  
  /**
   * Trigger an event
   */
  private triggerEvent(event: string, data: any): void {
    // Get the callback set
    const callbacks = this.eventCallbacks.get(event);
    
    if (callbacks) {
      // Call all the callbacks
      for (const callback of callbacks) {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event callback for ${event}:`, error);
        }
      }
    }
    
    // Also trigger the 'all' event
    const allCallbacks = this.eventCallbacks.get('all');
    
    if (allCallbacks) {
      // Call all the callbacks
      for (const callback of allCallbacks) {
        try {
          callback({ event, data });
        } catch (error) {
          console.error(`Error in 'all' event callback for ${event}:`, error);
        }
      }
    }
  }
  
  /**
   * Check if connected to the transformer system
   */
  public isConnectedToTransformer(): boolean {
    return this.isConnected;
  }
  
  /**
   * Get connection status
   */
  public getConnectionStatus(): {
    connected: boolean;
    queuedMessages: number;
    pendingRequests: number;
  } {
    return {
      connected: this.isConnected,
      queuedMessages: this.messageQueue.length,
      pendingRequests: this.pendingRequests.size
    };
  }
  
  /**
   * Make a prediction using the transformer system
   */
  public async makePrediction(
    pair: string,
    timeframe: string,
    lookaheadMinutes: number
  ): Promise<PredictionResult> {
    try {
      // First, get market data for the pair
      const marketData = await this.getMarketData(pair, timeframe);
      
      // Use AI system for prediction with rate limiting
      return await rateLimiter.queueHighPriority(async () => {
        // Send request to transformer system
        const transformerPrediction = await this.sendRequest('predict', {
          pair,
          timeframe,
          lookaheadMinutes,
          marketData
        });
        
        // Get AI prediction from hybrid intelligence
        const aiDecision = await hybridIntelligence.makeDecision(marketData);
        
        // Create a consensus prediction
        return this.createConsensusPrediction(transformerPrediction, aiDecision, pair);
      });
    } catch (error) {
      console.error('Error making prediction:', error);
      
      // Return a fallback prediction
      return {
        pair,
        timestamp: new Date(),
        price: 0,
        predictedPrice: 0,
        confidence: 0,
        priceChange: 0,
        direction: 0,
        timeframe,
        source: 'error',
        reasoning: `Error: ${error.message}`
      };
    }
  }
  
  /**
   * Get market data for a pair
   */
  private async getMarketData(pair: string, timeframe: string): Promise<any> {
    try {
      // Queue this as a high-priority request
      return await rateLimiter.queueHighPriority(async () => {
        // Send request to transformer system
        return await this.sendRequest('marketData', {
          pair,
          timeframe
        });
      });
    } catch (error) {
      console.error('Error getting market data:', error);
      throw error;
    }
  }
  
  /**
   * Create a consensus prediction from transformer and AI predictions
   */
  private createConsensusPrediction(
    transformerPrediction: any,
    aiDecision: any,
    pair: string
  ): PredictionResult {
    // Extract direction from AI decision
    let aiDirection = 0;
    
    switch (aiDecision.action) {
      case 'buy':
        aiDirection = 1;
        break;
      case 'sell':
        aiDirection = -1;
        break;
      default:
        aiDirection = 0;
    }
    
    // If we have both predictions, create a weighted average
    const hasTransformer = transformerPrediction && typeof transformerPrediction.confidence === 'number';
    const hasAi = aiDecision && typeof aiDecision.confidence === 'number';
    
    if (hasTransformer && hasAi) {
      // Weight the predictions (60% transformer, 40% AI)
      const transformerWeight = 0.6;
      const aiWeight = 0.4;
      
      // Calculate weighted direction
      const direction = (transformerPrediction.direction * transformerWeight) + 
                        (aiDirection * aiWeight);
      
      // Calculate weighted confidence
      const confidence = (transformerPrediction.confidence * transformerWeight) + 
                         (aiDecision.confidence * aiWeight);
      
      // Calculate predicted price
      const currentPrice = transformerPrediction.price || 0;
      const priceChange = transformerPrediction.priceChange || 0;
      const predictedPrice = currentPrice * (1 + (priceChange * direction));
      
      // Create consensus prediction
      return {
        pair,
        timestamp: new Date(),
        price: currentPrice,
        predictedPrice,
        confidence,
        priceChange: Math.abs(priceChange),
        direction: Math.sign(direction),
        timeframe: transformerPrediction.windowSeconds ? `${transformerPrediction.windowSeconds}s` : '5m',
        source: 'consensus',
        reasoning: `Transformer: ${transformerPrediction.metrics?.reason || 'N/A'}, AI: ${aiDecision.reasoning || 'N/A'}`
      };
    } else if (hasTransformer) {
      // Use transformer prediction only
      const currentPrice = transformerPrediction.price || 0;
      const priceChange = transformerPrediction.priceChange || 0;
      const predictedPrice = currentPrice * (1 + priceChange);
      
      return {
        pair,
        timestamp: new Date(),
        price: currentPrice,
        predictedPrice,
        confidence: transformerPrediction.confidence,
        priceChange: Math.abs(priceChange),
        direction: Math.sign(transformerPrediction.direction),
        timeframe: transformerPrediction.windowSeconds ? `${transformerPrediction.windowSeconds}s` : '5m',
        source: 'transformer',
        reasoning: transformerPrediction.metrics?.reason || 'No reasoning provided'
      };
    } else if (hasAi) {
      // Use AI decision only (with some default values)
      return {
        pair,
        timestamp: new Date(),
        price: 0, // We don't have the current price
        predictedPrice: 0, // We don't have a predicted price
        confidence: aiDecision.confidence,
        priceChange: 0, // We don't have a price change
        direction: aiDirection,
        timeframe: '5m', // Default timeframe
        source: 'ai',
        reasoning: aiDecision.reasoning || 'No reasoning provided'
      };
    } else {
      // Neither prediction is available
      return {
        pair,
        timestamp: new Date(),
        price: 0,
        predictedPrice: 0,
        confidence: 0,
        priceChange: 0,
        direction: 0,
        timeframe: '5m',
        source: 'none',
        reasoning: 'No predictions available'
      };
    }
  }
  
  /**
   * Train a transformer model with new data
   */
  public async trainModel(
    pair: string,
    timeframe: string,
    historicalData: any[]
  ): Promise<boolean> {
    try {
      // Queue this as a low-priority request
      return await rateLimiter.queueLowPriority(async () => {
        // Send request to transformer system
        const result = await this.sendRequest('trainModel', {
          pair,
          timeframe,
          historicalData
        });
        
        return result.success || false;
      });
    } catch (error) {
      console.error('Error training model:', error);
      return false;
    }
  }
  
  /**
   * Update a transformer model with new market data
   */
  public async updateModel(
    pair: string,
    marketData: any
  ): Promise<boolean> {
    try {
      // Queue this as a medium-priority request
      return await rateLimiter.queueLowPriority(async () => {
        // Send request to transformer system
        const result = await this.sendRequest('updateModel', {
          pair,
          marketData
        });
        
        return result.success || false;
      });
    } catch (error) {
      console.error('Error updating model:', error);
      return false;
    }
  }
}

/**
 * Prediction result interface
 */
export interface PredictionResult {
  pair: string;
  timestamp: Date;
  price: number;
  predictedPrice: number;
  confidence: number; // 0-1 scale
  priceChange: number; // Absolute value
  direction: number; // -1, 0, or 1
  timeframe: string;
  source: 'transformer' | 'ai' | 'consensus' | 'none' | 'error';
  reasoning: string;
}

// Create and export a singleton instance
const transformerConnector = TransformerConnector.getInstance();
export default transformerConnector;