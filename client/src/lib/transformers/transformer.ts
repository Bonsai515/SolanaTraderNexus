/**
 * Transformer API Client
 * 
 * Provides interface to the Rust-based transformers for market signal analysis.
 * This component handles communication with the MicroQHC (quantum-inspired pattern recognition)
 * and MEME Cortex (meme token analysis with social sentiment correlation).
 */

import { apiRequestJson } from "../queryClient";
import { createWebSocket, WebSocket } from "../wsClient";

// Signal types
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

/**
 * Transformer Client for communicating with the transformer API
 */
export class TransformerClient {
  private wsClient: WebSocket | null = null;
  private signalCallbacks: ((signal: Signal) => void)[] = [];
  private resultCallbacks: ((result: TransformerResult) => void)[] = [];
  
  /**
   * Initialize the transformer client
   */
  async initialize(): Promise<boolean> {
    try {
      // Set up WebSocket connection
      this.setupWebSocket();
      
      return true;
    } catch (error) {
      console.error('Failed to initialize transformer client:', error);
      return false;
    }
  }
  
  /**
   * Set up WebSocket connection for real-time signals
   */
  private setupWebSocket(): void {
    this.wsClient = createWebSocket('/transformers');
    
    this.wsClient.onMessage((data) => {
      if (data.type === 'signal') {
        const signal = data.signal as Signal;
        // Convert timestamp string to Date object if needed
        if (typeof signal.timestamp === 'string') {
          signal.timestamp = new Date(signal.timestamp);
        }
        
        // Notify all signal callbacks
        this.signalCallbacks.forEach(callback => callback(signal));
      } else if (data.type === 'result') {
        const result = data.result as TransformerResult;
        // Convert timestamp strings to Date objects if needed
        if (typeof result.analysisTimestamp === 'string') {
          result.analysisTimestamp = new Date(result.analysisTimestamp);
        }
        if (result.signals && Array.isArray(result.signals)) {
          result.signals.forEach(signal => {
            if (typeof signal.timestamp === 'string') {
              signal.timestamp = new Date(signal.timestamp);
            }
          });
        }
        
        // Notify all result callbacks
        this.resultCallbacks.forEach(callback => callback(result));
      }
    });
  }
  
  /**
   * Request an analysis from the MicroQHC transformer
   */
  async requestMicroQHCAnalysis(input: TransformerInput): Promise<TransformerResult> {
    try {
      return await apiRequestJson<TransformerResult>(
        'POST',
        '/api/transformers/micro-qhc/analyze',
        input
      );
    } catch (error) {
      console.error('Failed to request MicroQHC analysis:', error);
      throw error;
    }
  }
  
  /**
   * Request an analysis from the MEME Cortex transformer
   */
  async requestMEMECortexAnalysis(input: TransformerInput): Promise<TransformerResult> {
    try {
      return await apiRequestJson<TransformerResult>(
        'POST',
        '/api/transformers/meme-cortex/analyze',
        input
      );
    } catch (error) {
      console.error('Failed to request MEME Cortex analysis:', error);
      throw error;
    }
  }
  
  /**
   * Submit a custom signal to the transformer network
   */
  async submitSignal(signal: Omit<Signal, 'id' | 'timestamp'>): Promise<Signal> {
    try {
      return await apiRequestJson<Signal>(
        'POST',
        '/api/transformers/signals',
        signal
      );
    } catch (error) {
      console.error('Failed to submit signal:', error);
      throw error;
    }
  }
  
  /**
   * Get recent signals for a specific pair
   */
  async getRecentSignals(pair: string, limit: number = 10): Promise<Signal[]> {
    try {
      return await apiRequestJson<Signal[]>(
        'GET',
        `/api/transformers/signals?pair=${pair}&limit=${limit}`
      );
    } catch (error) {
      console.error('Failed to get recent signals:', error);
      return [];
    }
  }
  
  /**
   * Subscribe to real-time signals
   */
  onSignal(callback: (signal: Signal) => void): void {
    this.signalCallbacks.push(callback);
  }
  
  /**
   * Unsubscribe from real-time signals
   */
  offSignal(callback: (signal: Signal) => void): void {
    const index = this.signalCallbacks.indexOf(callback);
    if (index !== -1) {
      this.signalCallbacks.splice(index, 1);
    }
  }
  
  /**
   * Subscribe to transformer results
   */
  onResult(callback: (result: TransformerResult) => void): void {
    this.resultCallbacks.push(callback);
  }
  
  /**
   * Unsubscribe from transformer results
   */
  offResult(callback: (result: TransformerResult) => void): void {
    const index = this.resultCallbacks.indexOf(callback);
    if (index !== -1) {
      this.resultCallbacks.splice(index, 1);
    }
  }
  
  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
    }
    this.signalCallbacks = [];
    this.resultCallbacks = [];
  }
}

// Export singleton instance
export const transformerClient = new TransformerClient();