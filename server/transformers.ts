// Wrapper for Rust transformer API
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { IStorage } from './storage';
import { z } from 'zod';
import { Strategy, SignalType, SignalStrength, TradingSignal } from '@shared/schema';
import { logger } from './logger';

// Interface for market data
export interface MarketData {
  pair: string;
  prices: Array<[string, number]>; // [timestamp, price]
  volumes: Array<[string, number]>; // [timestamp, volume]
  orderBooks: Array<[string, Array<[number, number]>, Array<[number, number]>]>; // [timestamp, bids, asks]
  indicators: Record<string, Array<[string, number]>>; // indicator name -> [timestamp, value]
  externalData: Record<string, Array<[string, number]>>; // external name -> [timestamp, value]
}

// Interface for prediction result
export interface PredictionResult {
  pair: string;
  price: number;
  confidence: number;
  windowSeconds: number;
  timestamp: string;
  priceChange: number;
  volatility: number;
  direction: number; // 1.0 = up, -1.0 = down, 0.0 = sideways
  metrics: Record<string, number>;
}

// Transformer API wrapper
export class TransformerAPI {
  private storage: IStorage;
  private rustBinary: string;
  private isInitialized: boolean = false;
  private transformerPath: string;
  private activePairs: string[] = [];

  constructor(storage: IStorage) {
    this.storage = storage;
    this.rustBinary = process.env.NODE_ENV === 'production' 
      ? path.join(process.cwd(), 'target/release/solana_quantum_trading')
      : path.join(process.cwd(), 'target/debug/solana_quantum_trading');
    
    this.transformerPath = path.join(process.cwd(), 'data/transformers');
  }

  /**
   * Initialize the transformer API
   */
  public async initialize(): Promise<void> {
    try {
      // Check if Rust binary exists
      await fs.access(this.rustBinary);
      
      // Create transformer directory if it doesn't exist
      await fs.mkdir(this.transformerPath, { recursive: true });
      
      // Get active strategies to determine which pairs to initialize
      const strategies = await this.storage.getStrategies();
      const activePairs = strategies
        .filter(s => s.status === 'ACTIVE')
        .map(s => s.token_pair);
      
      this.activePairs = [...new Set(activePairs)]; // Remove duplicates
      
      logger.info(`Initializing transformer API with pairs: ${this.activePairs.join(', ')}`);
      
      if (this.activePairs.length > 0) {
        // Initialize models for active pairs
        await this.executeRustCommand('init', { pairs: this.activePairs });
      }
      
      this.isInitialized = true;
      logger.info('Transformer API initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize transformer API:', error);
      throw new Error(`Transformer API initialization failed: ${error}`);
    }
  }

  /**
   * Make a prediction for a specific pair
   */
  public async predict(
    pair: string, 
    marketData: MarketData, 
    windowSeconds: number = 3600
  ): Promise<PredictionResult> {
    if (!this.isInitialized) {
      throw new Error('Transformer API not initialized');
    }
    
    logger.debug(`Making prediction for ${pair} with window ${windowSeconds}s`);
    
    try {
      // Prepare input data
      const input = {
        pair,
        marketData,
        windowSeconds
      };
      
      // Execute prediction
      const result = await this.executeRustCommand('predict', input);
      
      // Parse result
      const prediction = result as PredictionResult;
      
      // Generate signal from prediction
      await this.generateSignalFromPrediction(prediction);
      
      return prediction;
    } catch (error) {
      logger.error(`Prediction failed for ${pair}:`, error);
      throw new Error(`Prediction failed: ${error}`);
    }
  }

  /**
   * Update a model with new market data
   */
  public async updateModel(pair: string, marketData: MarketData): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Transformer API not initialized');
    }
    
    logger.debug(`Updating model for ${pair}`);
    
    try {
      // Prepare input data
      const input = {
        pair,
        marketData
      };
      
      // Execute update
      await this.executeRustCommand('update', input);
    } catch (error) {
      logger.error(`Model update failed for ${pair}:`, error);
      throw new Error(`Model update failed: ${error}`);
    }
  }

  /**
   * Train a model with historical market data
   */
  public async trainModel(
    pair: string, 
    marketData: MarketData[], 
    config: any = {}
  ): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Transformer API not initialized');
    }
    
    logger.info(`Training model for ${pair} with ${marketData.length} data points`);
    
    try {
      // Prepare input data
      const input = {
        pair,
        marketData,
        config: {
          epochs: config.epochs || 100,
          batchSize: config.batchSize || 32,
          learningRate: config.learningRate || 0.001,
          earlyStoppingPatience: config.earlyStoppingPatience || 10,
          ...config
        }
      };
      
      // Execute training
      const result = await this.executeRustCommand('train', input);
      
      return result;
    } catch (error) {
      logger.error(`Model training failed for ${pair}:`, error);
      throw new Error(`Model training failed: ${error}`);
    }
  }

  /**
   * Generate a trading signal from a prediction
   */
  private async generateSignalFromPrediction(prediction: PredictionResult): Promise<void> {
    try {
      // Find strategy for this pair
      const strategies = await this.storage.getStrategies();
      const strategy = strategies.find(s => 
        s.token_pair === prediction.pair && s.status === 'ACTIVE'
      );
      
      if (!strategy) {
        logger.debug(`No active strategy found for ${prediction.pair}, skipping signal generation`);
        return;
      }
      
      // Determine signal type based on direction and confidence
      const signalType = this.determineSignalType(prediction);
      
      // Determine signal strength based on confidence
      const signalStrength = this.determineSignalStrength(prediction);
      
      // Create signal
      const signal: Omit<TradingSignal, 'id' | 'created_at'> = {
        strategy_id: strategy.id,
        signal_type: signalType,
        strength: signalStrength,
        token_pair: prediction.pair,
        price: prediction.price,
        target_price: prediction.priceChange > 0 
          ? prediction.price * (1 + prediction.priceChange * 1.5) 
          : undefined,
        stop_loss_price: prediction.priceChange < 0 
          ? prediction.price * (1 + prediction.priceChange * 1.5) 
          : undefined,
        time_window_seconds: prediction.windowSeconds,
        confidence: prediction.confidence,
        metadata: {
          volatility: prediction.volatility,
          price_change: prediction.priceChange,
          direction: prediction.direction,
          ...prediction.metrics
        },
        source: 'transformer',
        executed: false,
        transaction_id: null,
        result: null,
        expires_at: new Date(
          new Date(prediction.timestamp).getTime() + prediction.windowSeconds * 1000
        ).toISOString(),
      };
      
      // Save signal
      await this.storage.createSignal(signal);
      
      logger.info(`Generated ${signalType} signal for ${prediction.pair} with ${prediction.confidence} confidence`);
    } catch (error) {
      logger.error('Failed to generate signal from prediction:', error);
    }
  }

  /**
   * Determine signal type based on prediction
   */
  private determineSignalType(prediction: PredictionResult): SignalType {
    // Strong upward movement
    if (prediction.direction > 0.5 && prediction.confidence > 0.7) {
      return 'BUY';
    }
    
    // Strong downward movement
    if (prediction.direction < -0.5 && prediction.confidence > 0.7) {
      return 'SELL';
    }
    
    // Sideways or uncertain
    return 'HOLD';
  }

  /**
   * Determine signal strength based on prediction confidence
   */
  private determineSignalStrength(prediction: PredictionResult): SignalStrength {
    if (prediction.confidence >= 0.8) {
      return 'STRONG';
    } else if (prediction.confidence >= 0.6) {
      return 'MODERATE';
    } else {
      return 'WEAK';
    }
  }

  /**
   * Execute a command in the Rust binary
   */
  private async executeRustCommand(command: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        // Create temporary input and output files
        const requestId = uuidv4();
        const inputFile = path.join(this.transformerPath, `${requestId}_input.json`);
        const outputFile = path.join(this.transformerPath, `${requestId}_output.json`);
        
        // Write input data to file
        fs.writeFile(inputFile, JSON.stringify(data))
          .then(() => {
            // Spawn Rust process
            const process = spawn(this.rustBinary, [command, inputFile, outputFile]);
            
            let stderr = '';
            
            process.stderr.on('data', (data) => {
              stderr += data.toString();
            });
            
            process.on('close', async (code) => {
              try {
                // Clean up input file
                await fs.unlink(inputFile);
                
                if (code !== 0) {
                  logger.error(`Rust process exited with code ${code}: ${stderr}`);
                  reject(new Error(`Rust process exited with code ${code}: ${stderr}`));
                  return;
                }
                
                // Read output file
                const output = await fs.readFile(outputFile, 'utf8');
                
                // Clean up output file
                await fs.unlink(outputFile);
                
                // Parse output
                resolve(JSON.parse(output));
              } catch (error) {
                reject(error);
              }
            });
          })
          .catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  }
}

// Export singleton instance
let transformerInstance: TransformerAPI | null = null;

export function getTransformerAPI(storage: IStorage): TransformerAPI {
  if (!transformerInstance) {
    transformerInstance = new TransformerAPI(storage);
  }
  return transformerInstance;
}