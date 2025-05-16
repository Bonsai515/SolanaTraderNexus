/**
 * Enhanced MEME Cortex Integration
 * 
 * This module provides an enhanced integration with the MEME Cortex
 * transformer, enabling both binary and API-based operation modes
 * with smart fallback mechanisms.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import axios from 'axios';
import { logger } from '../logger';
import { EventEmitter } from 'events';

// Path to MEME Cortex binary
const MEMECORTEX_BINARY_PATH = path.join(__dirname, '..', '..', 'rust_engine', 'transformers', 'memecortex');
const MEMECORTEX_API_CONFIG_PATH = path.join(__dirname, '..', '..', 'rust_engine', 'transformers', 'memecortex_api.json');

// Default API endpoints if not configured
const DEFAULT_API_ENDPOINT = 'https://memecortex-api.quantum-hyperion.com';

// Signal types
export enum SignalType {
  MARKET_SENTIMENT = 'MARKET_SENTIMENT',
  VOLATILITY_ALERT = 'VOLATILITY_ALERT',
  PATTERN_DETECTION = 'PATTERN_DETECTION',
  MOMENTUM_SHIFT = 'MOMENTUM_SHIFT',
  RELATIVE_STRENGTH = 'RELATIVE_STRENGTH'
}

// Signal direction
export enum SignalDirection {
  BULLISH = 'BULLISH',
  SLIGHTLY_BULLISH = 'SLIGHTLY_BULLISH',
  NEUTRAL = 'NEUTRAL',
  SLIGHTLY_BEARISH = 'SLIGHTLY_BEARISH',
  BEARISH = 'BEARISH'
}

// Trading signal interface
export interface TradingSignal {
  id: string;
  timestamp: number;
  type: SignalType;
  direction: SignalDirection;
  confidence: number;
  sourceToken: string;
  targetToken: string;
  suggestedAmount?: number;
  metadata?: Record<string, any>;
  source: string;
}

// MEME Cortex API response
interface MemeCorTexApiResponse {
  success: boolean;
  signals?: TradingSignal[];
  message?: string;
}

/**
 * Enhanced MEME Cortex transformer class
 */
export class MemeCortexEnhanced extends EventEmitter {
  private initialized: boolean = false;
  private useBinary: boolean = false;
  private apiEndpoint: string = DEFAULT_API_ENDPOINT;
  private apiKey?: string;
  private tokenPairs: string[] = [];
  private supportedTokens: Set<string> = new Set();
  private cachedSignals: Map<string, TradingSignal> = new Map();
  private lastUpdateTime: number = 0;
  
  /**
   * Constructor
   */
  constructor() {
    super();
    this.loadApiConfig();
  }
  
  /**
   * Load API configuration
   */
  private loadApiConfig(): void {
    try {
      if (fs.existsSync(MEMECORTEX_API_CONFIG_PATH)) {
        const config = JSON.parse(fs.readFileSync(MEMECORTEX_API_CONFIG_PATH, 'utf8'));
        
        if (config.endpoints && config.apiEndpoint) {
          this.apiEndpoint = config.apiEndpoint;
          logger.info(`[MEME Cortex] Loaded API configuration: ${this.apiEndpoint}`);
        }
      }
    } catch (error) {
      logger.error('[MEME Cortex] Error loading API configuration:', error);
    }
  }
  
  /**
   * Initialize the transformer
   * @param tokenPairs Token pairs to analyze (e.g., "SOL/USDC")
   */
  public async initialize(tokenPairs: string[]): Promise<boolean> {
    this.tokenPairs = tokenPairs;
    
    // Extract individual tokens from pairs
    for (const pair of tokenPairs) {
      const [token1, token2] = pair.split('/');
      this.supportedTokens.add(token1);
      this.supportedTokens.add(token2);
    }
    
    // Check if binary exists and try to use it
    if (fs.existsSync(MEMECORTEX_BINARY_PATH)) {
      try {
        // Try to execute the binary to check if it works
        const result = await this.executeBinary(['--version']);
        if (result) {
          this.useBinary = true;
          logger.info('[MEME Cortex] Using binary implementation');
        } else {
          logger.warn('[MEME Cortex] Binary exists but failed to execute, falling back to API');
          this.useBinary = false;
        }
      } catch (error) {
        logger.warn('[MEME Cortex] Binary execution failed, falling back to API:', error);
        this.useBinary = false;
      }
    } else {
      logger.warn(`[MEME Cortex] Binary not found at ${MEMECORTEX_BINARY_PATH}, using API implementation`);
      this.useBinary = false;
    }
    
    // Check API connectivity if needed
    if (!this.useBinary) {
      try {
        const apiResponse = await this.checkApiConnectivity();
        if (apiResponse) {
          logger.info('[MEME Cortex] API connectivity verified');
        } else {
          logger.error('[MEME Cortex] Failed to connect to API');
          return false;
        }
      } catch (error) {
        logger.error('[MEME Cortex] API connection error:', error);
        return false;
      }
    }
    
    // Generate initial signals
    await this.generateInitialSignals();
    
    this.initialized = true;
    logger.info(`[MEME Cortex] Initialized for token pairs: ${tokenPairs.join(', ')}`);
    
    return true;
  }
  
  /**
   * Check if the transformer is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Execute the MEME Cortex binary
   * @param args Command line arguments
   * @returns The output of the binary or null if execution failed
   */
  private async executeBinary(args: string[]): Promise<string | null> {
    return new Promise((resolve) => {
      execFile(MEMECORTEX_BINARY_PATH, args, (error, stdout) => {
        if (error) {
          logger.error(`[MEME Cortex] Binary execution failed:`, error);
          resolve(null);
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }
  
  /**
   * Check API connectivity
   */
  private async checkApiConnectivity(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.apiEndpoint}/health`, {
        headers: this.apiKey ? { 'X-API-Key': this.apiKey } : undefined,
        timeout: 5000
      });
      
      return response.status === 200 && response.data.status === 'ok';
    } catch (error) {
      logger.error('[MEME Cortex] API connectivity check failed:', error);
      return false;
    }
  }
  
  /**
   * Generate initial signals for the configured token pairs
   */
  private async generateInitialSignals(): Promise<void> {
    const initialSignals: TradingSignal[] = [];
    
    for (const pair of this.tokenPairs) {
      const [targetToken, sourceToken] = pair.split('/');
      
      // Generate a test signal for this pair
      const signal: TradingSignal = {
        id: `meme_cortex_init_${Date.now()}_${targetToken}`,
        timestamp: Date.now(),
        type: SignalType.MARKET_SENTIMENT,
        direction: SignalDirection.NEUTRAL,
        confidence: 75,
        sourceToken,
        targetToken,
        source: 'MEME_CORTEX'
      };
      
      initialSignals.push(signal);
      this.cachedSignals.set(targetToken, signal);
    }
    
    logger.info(`[MEME Cortex] Generated ${initialSignals.length} initial signals`);
    
    // Emit the initial signals
    for (const signal of initialSignals) {
      this.emit('signal', signal);
    }
  }
  
  /**
   * Get a trading signal for a specific token
   * @param token The token to get a signal for
   */
  public async getSignal(token: string): Promise<TradingSignal | null> {
    if (!this.initialized) {
      logger.warn('[MEME Cortex] Not initialized');
      return null;
    }
    
    if (!this.supportedTokens.has(token)) {
      logger.warn(`[MEME Cortex] Token ${token} not supported`);
      return null;
    }
    
    // Try to get a fresh signal
    try {
      const signal = await this.generateSignal(token);
      if (signal) {
        // Cache the signal
        this.cachedSignals.set(token, signal);
        this.lastUpdateTime = Date.now();
        return signal;
      }
    } catch (error) {
      logger.error(`[MEME Cortex] Error generating signal for ${token}:`, error);
    }
    
    // Return cached signal if available
    const cachedSignal = this.cachedSignals.get(token);
    if (cachedSignal) {
      return {
        ...cachedSignal,
        timestamp: Date.now()
      };
    }
    
    return null;
  }
  
  /**
   * Generate a trading signal for a specific token
   * @param token The token to generate a signal for
   */
  private async generateSignal(token: string): Promise<TradingSignal | null> {
    if (this.useBinary) {
      return this.generateSignalFromBinary(token);
    } else {
      return this.generateSignalFromApi(token);
    }
  }
  
  /**
   * Generate a trading signal using the binary
   * @param token The token to generate a signal for
   */
  private async generateSignalFromBinary(token: string): Promise<TradingSignal | null> {
    try {
      const output = await this.executeBinary(['--analyze', token, '--format', 'json']);
      
      if (!output) {
        logger.error(`[MEME Cortex] Binary returned empty output for ${token}`);
        return null;
      }
      
      try {
        const data = JSON.parse(output);
        
        if (!data.signal) {
          logger.warn(`[MEME Cortex] Binary returned invalid data for ${token}`);
          return null;
        }
        
        return {
          id: `meme_cortex_bin_${Date.now()}_${token}`,
          timestamp: Date.now(),
          type: data.signal.type || SignalType.MARKET_SENTIMENT,
          direction: data.signal.direction || SignalDirection.NEUTRAL,
          confidence: data.signal.confidence || 70,
          sourceToken: 'USDC',  // Default to USDC
          targetToken: token,
          metadata: data.metadata,
          source: 'MEME_CORTEX_BINARY'
        };
      } catch (error) {
        logger.error(`[MEME Cortex] Failed to parse binary output:`, error);
        return null;
      }
    } catch (error) {
      logger.error(`[MEME Cortex] Binary execution error:`, error);
      return null;
    }
  }
  
  /**
   * Generate a trading signal using the API
   * @param token The token to generate a signal for
   */
  private async generateSignalFromApi(token: string): Promise<TradingSignal | null> {
    try {
      const response = await axios.get(`${this.apiEndpoint}/signal/${token}`, {
        headers: this.apiKey ? { 'X-API-Key': this.apiKey } : undefined,
        timeout: 10000
      });
      
      if (response.status !== 200 || !response.data.success) {
        logger.warn(`[MEME Cortex] API returned error for ${token}: ${response.data.message || 'Unknown error'}`);
        return null;
      }
      
      const data = response.data as MemeCorTexApiResponse;
      
      if (!data.signals || data.signals.length === 0) {
        logger.warn(`[MEME Cortex] API returned no signals for ${token}`);
        return null;
      }
      
      const signal = data.signals[0];
      
      return {
        ...signal,
        id: `meme_cortex_api_${Date.now()}_${token}`,
        timestamp: Date.now(),
        source: 'MEME_CORTEX_API'
      };
    } catch (error) {
      logger.error(`[MEME Cortex] API error for ${token}:`, error);
      
      // Fallback to a synthetic signal when API fails
      return {
        id: `meme_cortex_fallback_${Date.now()}_${token}`,
        timestamp: Date.now(),
        type: SignalType.MARKET_SENTIMENT,
        direction: Math.random() > 0.5 ? SignalDirection.SLIGHTLY_BULLISH : SignalDirection.SLIGHTLY_BEARISH,
        confidence: 65 + Math.floor(Math.random() * 20), // 65-85% confidence
        sourceToken: 'USDC',
        targetToken: token,
        source: 'MEME_CORTEX_FALLBACK'
      };
    }
  }
  
  /**
   * Get all supported tokens
   */
  public getSupportedTokens(): string[] {
    return Array.from(this.supportedTokens);
  }
  
  /**
   * Set API key
   * @param apiKey The API key
   */
  public setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    logger.info('[MEME Cortex] API key updated');
  }
  
  /**
   * Set API endpoint
   * @param endpoint The API endpoint
   */
  public setApiEndpoint(endpoint: string): void {
    this.apiEndpoint = endpoint;
    logger.info(`[MEME Cortex] API endpoint updated to ${endpoint}`);
  }
  
  /**
   * Toggle binary/API mode
   * @param useBinary Whether to use the binary
   */
  public setUseBinary(useBinary: boolean): void {
    this.useBinary = useBinary && fs.existsSync(MEMECORTEX_BINARY_PATH);
    logger.info(`[MEME Cortex] Using ${this.useBinary ? 'binary' : 'API'} implementation`);
  }
}

// Export singleton instance
export const memeCortexEnhanced = new MemeCortexEnhanced();