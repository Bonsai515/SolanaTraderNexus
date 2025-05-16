/**
 * MemeCortex Remix Transformer
 * 
 * Advanced meme coin analysis and trading strategy generator with neural embeddings
 * for identifying emerging trends and market sentiment in the meme coin ecosystem.
 */

import * as logger from './logger';
import axios from 'axios';
import { Connection, PublicKey } from '@solana/web3.js';
import { initializeRpcConnection } from './lib/ensureRpcConnection';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { nexusEngine } from './nexus-transaction-engine';

// Supported meme coins
const SUPPORTED_MEME_COINS = [
  'BONK', 'WIF', 'MEME', 'POPCAT', 'GUAC', 'BOOK', 'PNUT', 'SLERF'
];

// Signal strength
enum SignalStrength {
  VERY_STRONG = 'VERY_STRONG',
  STRONG = 'STRONG', 
  MODERATE = 'MODERATE', 
  WEAK = 'WEAK', 
  VERY_WEAK = 'VERY_WEAK'
}

// Signal direction
enum SignalDirection {
  BULLISH = 'BULLISH',
  BEARISH = 'BEARISH',
  NEUTRAL = 'NEUTRAL'
}

// Market trend
enum MarketTrend {
  UPTREND = 'UPTREND',
  DOWNTREND = 'DOWNTREND',
  SIDEWAYS = 'SIDEWAYS',
  CHOPPY = 'CHOPPY',
  VOLATILE = 'VOLATILE'
}

// Trend timeframe
enum TrendTimeframe {
  VERY_SHORT = 'VERY_SHORT', // minutes
  SHORT = 'SHORT',           // hours
  MEDIUM = 'MEDIUM',         // days
  LONG = 'LONG',             // weeks
  VERY_LONG = 'VERY_LONG'    // months
}

// Sentiment analysis result
interface SentimentAnalysis {
  symbol: string;
  direction: SignalDirection;
  strength: SignalStrength;
  trend: MarketTrend;
  timeframe: TrendTimeframe;
  confidence: number; // 0-100
  timestamp: number;
  sources: string[];
  keywords: string[];
  volumeChange24h?: number;
  priceChange24h?: number;
  socialScore?: number;
}

// Trading signal
interface TradingSignal {
  id: string;
  symbol: string;
  direction: SignalDirection;
  strength: SignalStrength;
  entry: number; // price
  target: number; // price
  stopLoss: number; // price
  timestamp: number;
  expiryTime: number;
  confidence: number; // 0-100
  reasoning: string;
  sourceAnalysis: SentimentAnalysis;
}

// Market scan result
interface MarketScanResult {
  timestamp: number;
  topBullish: string[];
  topBearish: string[];
  neutralCoins: string[];
  volatilityRanking: { symbol: string, volatility: number }[];
  overallMarketSentiment: SignalDirection;
  trendingKeywords: string[];
}

// MemeCortex configuration
interface MemeCortexConfig {
  analysisInterval: number; // in ms
  signalThreshold: number; // 0-100
  volatilityThreshold: number; // 0-100
  enabledCoins: string[];
  apiKeys: {
    twitter?: string;
    telegram?: string;
    discord?: string;
    reddit?: string;
  };
}

// Neural embeddings for a token
interface TokenEmbedding {
  symbol: string;
  vector: number[];
  keywords: string[];
  lastUpdated: number;
}

// Market cycle state
enum MarketCycleState {
  ACCUMULATION = 'ACCUMULATION',
  MARKUP = 'MARKUP',
  DISTRIBUTION = 'DISTRIBUTION',
  MARKDOWN = 'MARKDOWN',
  CAPITULATION = 'CAPITULATION',
  DESPAIR = 'DESPAIR',
  RETURN_TO_MEAN = 'RETURN_TO_MEAN'
}

// MemeCortex Remix class
export class MemeCortexRemix extends EventEmitter {
  private connection: Connection | null = null;
  private isInitialized: boolean = false;
  private analysisInterval: NodeJS.Timeout | null = null;
  private sentimentCache: Map<string, SentimentAnalysis> = new Map();
  private signalHistory: TradingSignal[] = [];
  private neuralEmbeddings: Map<string, TokenEmbedding> = new Map();
  private config: MemeCortexConfig = {
    analysisInterval: 5 * 60 * 1000, // 5 minutes
    signalThreshold: 70, // Generate signals for coins with confidence > 70%
    volatilityThreshold: 80, // Alert on high volatility > 80%
    enabledCoins: SUPPORTED_MEME_COINS,
    apiKeys: {}
  };
  
  /**
   * Constructor
   */
  constructor() {
    super();
    this.initialize();
  }
  
  /**
   * Initialize MemeCortex Remix
   */
  private async initialize(): Promise<void> {
    try {
      // Initialize Solana connection
      this.connection = await initializeRpcConnection();
      
      // Load neural embeddings
      await this.loadNeuralEmbeddings();
      
      // Start analysis interval
      this.startAnalysisInterval();
      
      this.isInitialized = true;
      logger.info('MemeCortex Remix transformer initialized');
    } catch (error: any) {
      logger.error(`Failed to initialize MemeCortex Remix: ${error.message || String(error)}`);
    }
  }
  
  /**
   * Load neural embeddings for tokens
   */
  private async loadNeuralEmbeddings(): Promise<void> {
    try {
      // Load embeddings from cache file or generate new ones
      const embeddingsDir = path.join(process.cwd(), 'data', 'embeddings');
      const embeddingsFile = path.join(embeddingsDir, 'meme_embeddings.json');
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(embeddingsDir)) {
        fs.mkdirSync(embeddingsDir, { recursive: true });
      }
      
      // Load from file if it exists
      if (fs.existsSync(embeddingsFile)) {
        const data = JSON.parse(fs.readFileSync(embeddingsFile, 'utf8'));
        
        for (const symbol in data) {
          this.neuralEmbeddings.set(symbol, data[symbol]);
        }
        
        logger.info(`Loaded neural embeddings for ${this.neuralEmbeddings.size} tokens`);
      } else {
        // Generate new embeddings
        await this.generateNeuralEmbeddings();
        
        // Save to file
        this.saveNeuralEmbeddings();
      }
    } catch (error: any) {
      logger.error(`Failed to load neural embeddings: ${error.message || String(error)}`);
    }
  }
  
  /**
   * Generate neural embeddings for tokens
   */
  private async generateNeuralEmbeddings(): Promise<void> {
    logger.info('Generating neural embeddings for meme tokens');
    
    // For demonstration, generate random embeddings with keywords
    for (const symbol of this.config.enabledCoins) {
      // Generate random vector (would be replaced with actual embeddings)
      const vector = Array.from({ length: 128 }, () => Math.random() * 2 - 1);
      
      // Generate keywords based on token
      let keywords: string[] = [];
      
      switch (symbol) {
        case 'BONK':
          keywords = ['doge', 'meme', 'shiba', 'community', 'solana'];
          break;
        case 'WIF':
          keywords = ['dog', 'hat', 'meme', 'viral', 'cute'];
          break;
        case 'MEME':
          keywords = ['viral', 'internet', 'culture', 'trending', 'original'];
          break;
        case 'GUAC':
          keywords = ['food', 'avocado', 'mexican', 'fresh', 'green'];
          break;
        default:
          keywords = ['crypto', 'token', 'meme', 'solana', 'trend'];
      }
      
      this.neuralEmbeddings.set(symbol, {
        symbol,
        vector,
        keywords,
        lastUpdated: Date.now()
      });
    }
    
    logger.info(`Generated neural embeddings for ${this.neuralEmbeddings.size} tokens`);
  }
  
  /**
   * Save neural embeddings to file
   */
  private saveNeuralEmbeddings(): void {
    try {
      const embeddingsDir = path.join(process.cwd(), 'data', 'embeddings');
      const embeddingsFile = path.join(embeddingsDir, 'meme_embeddings.json');
      
      // Convert Map to object
      const data: Record<string, TokenEmbedding> = {};
      
      this.neuralEmbeddings.forEach((embedding, symbol) => {
        data[symbol] = embedding;
      });
      
      // Write to file
      fs.writeFileSync(embeddingsFile, JSON.stringify(data, null, 2));
      
      logger.info(`Saved neural embeddings for ${this.neuralEmbeddings.size} tokens`);
    } catch (error: any) {
      logger.error(`Failed to save neural embeddings: ${error.message || String(error)}`);
    }
  }
  
  /**
   * Start analysis interval
   */
  private startAnalysisInterval(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }
    
    this.analysisInterval = setInterval(() => {
      this.analyzeMemeMarket().catch(err => {
        logger.error(`Error in meme market analysis: ${err.message || String(err)}`);
      });
    }, this.config.analysisInterval);
    
    // Run initial analysis
    this.analyzeMemeMarket().catch(err => {
      logger.error(`Error in initial meme market analysis: ${err.message || String(err)}`);
    });
  }
  
  /**
   * Analyze meme coin market
   */
  private async analyzeMemeMarket(): Promise<void> {
    try {
      logger.info('Analyzing meme coin market...');
      
      // Analyze each enabled coin
      for (const symbol of this.config.enabledCoins) {
        await this.analyzeToken(symbol);
      }
      
      // Generate market scan result
      const scanResult = this.generateMarketScanResult();
      
      // Emit market scan result
      this.emit('marketScan', scanResult);
      
      logger.info(`Meme coin market analysis completed with ${scanResult.topBullish.length} bullish tokens`);
    } catch (error: any) {
      logger.error(`Meme market analysis failed: ${error.message || String(error)}`);
    }
  }
  
  /**
   * Analyze a specific token
   * @param symbol Token symbol
   */
  private async analyzeToken(symbol: string): Promise<void> {
    try {
      logger.info(`Analyzing meme token: ${symbol}`);
      
      // Generate sentiment analysis (placeholder implementation)
      const sentiment = this.generateSentimentAnalysis(symbol);
      
      // Cache sentiment
      this.sentimentCache.set(symbol, sentiment);
      
      // Check if signal threshold is met
      if (sentiment.confidence >= this.config.signalThreshold) {
        // Generate trading signal
        const signal = this.generateTradingSignal(sentiment);
        
        // Add to signal history
        this.signalHistory.push(signal);
        
        // Emit signal
        this.emit('tradingSignal', signal);
        
        logger.info(`Generated ${sentiment.direction} signal for ${symbol} with ${sentiment.confidence}% confidence`);
      }
      
      // Check for high volatility
      if (sentiment.volumeChange24h && Math.abs(sentiment.volumeChange24h) >= this.config.volatilityThreshold) {
        // Emit volatility alert
        this.emit('volatilityAlert', {
          symbol,
          volumeChange24h: sentiment.volumeChange24h,
          priceChange24h: sentiment.priceChange24h,
          timestamp: Date.now()
        });
        
        logger.info(`High volatility detected for ${symbol}: ${sentiment.volumeChange24h}% volume change`);
      }
    } catch (error: any) {
      logger.error(`Failed to analyze token ${symbol}: ${error.message || String(error)}`);
    }
  }
  
  /**
   * Generate sentiment analysis for a token
   * @param symbol Token symbol
   * @returns Sentiment analysis
   */
  private generateSentimentAnalysis(symbol: string): SentimentAnalysis {
    // Random sentiment direction
    const directionRandom = Math.random();
    let direction: SignalDirection;
    
    if (directionRandom < 0.4) {
      direction = SignalDirection.BULLISH;
    } else if (directionRandom < 0.7) {
      direction = SignalDirection.BEARISH;
    } else {
      direction = SignalDirection.NEUTRAL;
    }
    
    // Random strength
    const strengthRandom = Math.random();
    let strength: SignalStrength;
    
    if (strengthRandom < 0.2) {
      strength = SignalStrength.VERY_STRONG;
    } else if (strengthRandom < 0.4) {
      strength = SignalStrength.STRONG;
    } else if (strengthRandom < 0.6) {
      strength = SignalStrength.MODERATE;
    } else if (strengthRandom < 0.8) {
      strength = SignalStrength.WEAK;
    } else {
      strength = SignalStrength.VERY_WEAK;
    }
    
    // Random trend
    const trendRandom = Math.random();
    let trend: MarketTrend;
    
    if (trendRandom < 0.3) {
      trend = MarketTrend.UPTREND;
    } else if (trendRandom < 0.5) {
      trend = MarketTrend.DOWNTREND;
    } else if (trendRandom < 0.7) {
      trend = MarketTrend.SIDEWAYS;
    } else if (trendRandom < 0.9) {
      trend = MarketTrend.CHOPPY;
    } else {
      trend = MarketTrend.VOLATILE;
    }
    
    // Random timeframe
    const timeframeRandom = Math.random();
    let timeframe: TrendTimeframe;
    
    if (timeframeRandom < 0.2) {
      timeframe = TrendTimeframe.VERY_SHORT;
    } else if (timeframeRandom < 0.4) {
      timeframe = TrendTimeframe.SHORT;
    } else if (timeframeRandom < 0.6) {
      timeframe = TrendTimeframe.MEDIUM;
    } else if (timeframeRandom < 0.8) {
      timeframe = TrendTimeframe.LONG;
    } else {
      timeframe = TrendTimeframe.VERY_LONG;
    }
    
    // Get keywords from embeddings
    const embedding = this.neuralEmbeddings.get(symbol);
    const keywords = embedding ? embedding.keywords : ['meme', 'crypto', 'solana'];
    
    // Random changes
    const volumeChange24h = (Math.random() * 60) - 20; // -20% to +40%
    const priceChange24h = (Math.random() * 40) - 15;  // -15% to +25%
    const socialScore = Math.random() * 100;
    
    // Random confidence
    const confidence = Math.floor(Math.random() * 100);
    
    return {
      symbol,
      direction,
      strength,
      trend,
      timeframe,
      confidence,
      timestamp: Date.now(),
      sources: ['twitter', 'reddit', 'discord', 'telegram'],
      keywords,
      volumeChange24h,
      priceChange24h,
      socialScore
    };
  }
  
  /**
   * Generate trading signal from sentiment analysis
   * @param sentiment Sentiment analysis
   * @returns Trading signal
   */
  private generateTradingSignal(sentiment: SentimentAnalysis): TradingSignal {
    // Generate random prices
    const basePrice = 1.0;
    const entry = basePrice * (1 + (Math.random() * 0.05 - 0.025)); // ±2.5%
    
    // Target and stop loss based on direction
    let target: number;
    let stopLoss: number;
    
    if (sentiment.direction === SignalDirection.BULLISH) {
      // Bullish: target higher, stop loss lower
      target = entry * (1 + (Math.random() * 0.2 + 0.05)); // +5% to +25%
      stopLoss = entry * (1 - (Math.random() * 0.1 + 0.02)); // -2% to -12%
    } else if (sentiment.direction === SignalDirection.BEARISH) {
      // Bearish: target lower, stop loss higher
      target = entry * (1 - (Math.random() * 0.2 + 0.05)); // -5% to -25%
      stopLoss = entry * (1 + (Math.random() * 0.1 + 0.02)); // +2% to +12%
    } else {
      // Neutral: tight range
      target = entry * (1 + (Math.random() * 0.08 - 0.04)); // ±4%
      stopLoss = entry * (1 - (Math.random() * 0.08 - 0.04)); // ±4%
    }
    
    // Signal expiry (proportional to timeframe)
    let expiryMs = 60 * 60 * 1000; // Default: 1 hour
    
    switch (sentiment.timeframe) {
      case TrendTimeframe.VERY_SHORT:
        expiryMs = 15 * 60 * 1000; // 15 minutes
        break;
      case TrendTimeframe.SHORT:
        expiryMs = 4 * 60 * 60 * 1000; // 4 hours
        break;
      case TrendTimeframe.MEDIUM:
        expiryMs = 24 * 60 * 60 * 1000; // 1 day
        break;
      case TrendTimeframe.LONG:
        expiryMs = 7 * 24 * 60 * 60 * 1000; // 1 week
        break;
      case TrendTimeframe.VERY_LONG:
        expiryMs = 30 * 24 * 60 * 60 * 1000; // 1 month
        break;
    }
    
    // Signal ID
    const id = `meme_signal_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
    
    // Generate reasoning
    const reasoning = this.generateSignalReasoning(sentiment);
    
    return {
      id,
      symbol: sentiment.symbol,
      direction: sentiment.direction,
      strength: sentiment.strength,
      entry,
      target,
      stopLoss,
      timestamp: Date.now(),
      expiryTime: Date.now() + expiryMs,
      confidence: sentiment.confidence,
      reasoning,
      sourceAnalysis: sentiment
    };
  }
  
  /**
   * Generate reasoning for a trading signal
   * @param sentiment Sentiment analysis
   * @returns Signal reasoning
   */
  private generateSignalReasoning(sentiment: SentimentAnalysis): string {
    const { symbol, direction, strength, trend, timeframe, keywords } = sentiment;
    
    // Direction phrase
    let directionPhrase = 'neutral outlook';
    if (direction === SignalDirection.BULLISH) {
      directionPhrase = 'bullish movement';
    } else if (direction === SignalDirection.BEARISH) {
      directionPhrase = 'bearish pressure';
    }
    
    // Strength phrase
    let strengthPhrase = 'moderate';
    if (strength === SignalStrength.VERY_STRONG) {
      strengthPhrase = 'extremely strong';
    } else if (strength === SignalStrength.STRONG) {
      strengthPhrase = 'strong';
    } else if (strength === SignalStrength.WEAK) {
      strengthPhrase = 'weak';
    } else if (strength === SignalStrength.VERY_WEAK) {
      strengthPhrase = 'very weak';
    }
    
    // Trend phrase
    let trendPhrase = 'market conditions';
    if (trend === MarketTrend.UPTREND) {
      trendPhrase = 'uptrend';
    } else if (trend === MarketTrend.DOWNTREND) {
      trendPhrase = 'downtrend';
    } else if (trend === MarketTrend.SIDEWAYS) {
      trendPhrase = 'sideways movement';
    } else if (trend === MarketTrend.CHOPPY) {
      trendPhrase = 'choppy market';
    } else if (trend === MarketTrend.VOLATILE) {
      trendPhrase = 'volatile conditions';
    }
    
    // Timeframe phrase
    let timeframePhrase = 'mid-term';
    if (timeframe === TrendTimeframe.VERY_SHORT) {
      timeframePhrase = 'extremely short-term';
    } else if (timeframe === TrendTimeframe.SHORT) {
      timeframePhrase = 'short-term';
    } else if (timeframe === TrendTimeframe.LONG) {
      timeframePhrase = 'long-term';
    } else if (timeframe === TrendTimeframe.VERY_LONG) {
      timeframePhrase = 'very long-term';
    }
    
    // Keywords phrase
    const keywordsPhrase = keywords.slice(0, 3).join(', ');
    
    return `${symbol} shows ${strengthPhrase} ${directionPhrase} in a ${timeframePhrase} ${trendPhrase}. Social sentiment analysis indicates growing interest in ${keywordsPhrase}.`;
  }
  
  /**
   * Generate market scan result
   * @returns Market scan result
   */
  private generateMarketScanResult(): MarketScanResult {
    // Sort tokens by sentiment
    const bullish: string[] = [];
    const bearish: string[] = [];
    const neutral: string[] = [];
    const volatilityRanking: { symbol: string, volatility: number }[] = [];
    
    // Process sentiment cache
    this.sentimentCache.forEach((sentiment, symbol) => {
      // Categorize by direction
      if (sentiment.direction === SignalDirection.BULLISH) {
        bullish.push(symbol);
      } else if (sentiment.direction === SignalDirection.BEARISH) {
        bearish.push(symbol);
      } else {
        neutral.push(symbol);
      }
      
      // Add to volatility ranking if volumeChange24h exists
      if (sentiment.volumeChange24h !== undefined) {
        volatilityRanking.push({
          symbol,
          volatility: Math.abs(sentiment.volumeChange24h)
        });
      }
    });
    
    // Sort volatility ranking
    volatilityRanking.sort((a, b) => b.volatility - a.volatility);
    
    // Determine overall market sentiment
    let overallMarketSentiment: SignalDirection;
    if (bullish.length > bearish.length) {
      overallMarketSentiment = SignalDirection.BULLISH;
    } else if (bearish.length > bullish.length) {
      overallMarketSentiment = SignalDirection.BEARISH;
    } else {
      overallMarketSentiment = SignalDirection.NEUTRAL;
    }
    
    // Collect trending keywords
    const keywordCount = new Map<string, number>();
    
    this.sentimentCache.forEach(sentiment => {
      sentiment.keywords.forEach(keyword => {
        const count = keywordCount.get(keyword) || 0;
        keywordCount.set(keyword, count + 1);
      });
    });
    
    // Sort keywords by frequency
    const trendingKeywords = Array.from(keywordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([keyword]) => keyword);
    
    return {
      timestamp: Date.now(),
      topBullish: bullish.slice(0, 3),
      topBearish: bearish.slice(0, 3),
      neutralCoins: neutral,
      volatilityRanking: volatilityRanking.slice(0, 5),
      overallMarketSentiment,
      trendingKeywords
    };
  }
  
  /**
   * Get sentiment analysis for a token
   * @param symbol Token symbol
   * @returns Sentiment analysis or null if not found
   */
  public getSentiment(symbol: string): SentimentAnalysis | null {
    return this.sentimentCache.get(symbol) || null;
  }
  
  /**
   * Get the latest trading signals
   * @param limit Maximum number of signals to return
   * @returns Trading signals
   */
  public getLatestSignals(limit: number = 10): TradingSignal[] {
    return this.signalHistory
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
  
  /**
   * Get trading signals for a specific token
   * @param symbol Token symbol
   * @param limit Maximum number of signals to return
   * @returns Trading signals
   */
  public getSignalsForToken(symbol: string, limit: number = 10): TradingSignal[] {
    return this.signalHistory
      .filter(signal => signal.symbol === symbol)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
  
  /**
   * Execute a trading signal
   * @param signal Trading signal or signal ID
   * @param amount Amount to trade
   * @param walletAddress Wallet address
   * @param privateKey Wallet private key (optional)
   * @returns Transaction signature
   */
  public async executeSignal(
    signal: TradingSignal | string,
    amount: number,
    walletAddress: string,
    privateKey?: string
  ): Promise<string> {
    try {
      // Get signal by ID if string is provided
      let tradingSignal: TradingSignal;
      
      if (typeof signal === 'string') {
        const foundSignal = this.signalHistory.find(s => s.id === signal);
        
        if (!foundSignal) {
          throw new Error(`Signal not found: ${signal}`);
        }
        
        tradingSignal = foundSignal;
      } else {
        tradingSignal = signal;
      }
      
      logger.info(`Executing meme trading signal: ${tradingSignal.id} (${tradingSignal.symbol})`);
      
      // Determine source and target tokens based on direction
      let sourceToken: string;
      let targetToken: string;
      
      if (tradingSignal.direction === SignalDirection.BULLISH) {
        // Buy the token (USDC -> token)
        sourceToken = 'USDC';
        targetToken = tradingSignal.symbol;
      } else if (tradingSignal.direction === SignalDirection.BEARISH) {
        // Sell the token (token -> USDC)
        sourceToken = tradingSignal.symbol;
        targetToken = 'USDC';
      } else {
        // Neutral - could implement a straddle or other neutral strategy
        // For now, just return a dummy signature
        return `simulation_${Date.now()}`;
      }
      
      // Execute the trade using Nexus Transaction Engine
      const result = await nexusEngine.executeSwap({
        fromToken: sourceToken,
        toToken: targetToken,
        amount,
        walletAddress,
        privateKey,
        simulation: privateKey ? false : true
      });
      
      return result.signature || 'no_signature';
    } catch (error: any) {
      logger.error(`Failed to execute trading signal: ${error.message || String(error)}`);
      throw error;
    }
  }
  
  /**
   * Get the market cycle state for a token
   * @param symbol Token symbol
   * @returns Market cycle state
   */
  public getMarketCycleState(symbol: string): MarketCycleState {
    const sentiment = this.sentimentCache.get(symbol);
    
    if (!sentiment) {
      return MarketCycleState.RETURN_TO_MEAN;
    }
    
    // Determine market cycle state based on sentiment
    if (sentiment.direction === SignalDirection.BULLISH) {
      if (sentiment.strength === SignalStrength.VERY_STRONG) {
        return MarketCycleState.MARKUP;
      } else if (sentiment.strength === SignalStrength.STRONG) {
        return MarketCycleState.ACCUMULATION;
      } else {
        return MarketCycleState.RETURN_TO_MEAN;
      }
    } else if (sentiment.direction === SignalDirection.BEARISH) {
      if (sentiment.strength === SignalStrength.VERY_STRONG) {
        return MarketCycleState.MARKDOWN;
      } else if (sentiment.strength === SignalStrength.STRONG) {
        return MarketCycleState.DISTRIBUTION;
      } else if (sentiment.strength === SignalStrength.VERY_WEAK) {
        return MarketCycleState.CAPITULATION;
      } else {
        return MarketCycleState.DESPAIR;
      }
    } else {
      return MarketCycleState.RETURN_TO_MEAN;
    }
  }
  
  /**
   * Update configuration
   * @param config New configuration
   */
  public updateConfig(config: Partial<MemeCortexConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Restart analysis interval if interval changed
    if (config.analysisInterval !== undefined) {
      this.startAnalysisInterval();
    }
    
    logger.info(`MemeCortex configuration updated`);
  }
  
  /**
   * Immediately analyze the market (outside of regular interval)
   */
  public async forceAnalysis(): Promise<void> {
    await this.analyzeMemeMarket();
  }
  
  /**
   * Get configuration
   * @returns Current configuration
   */
  public getConfig(): MemeCortexConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const memeCortexRemix = new MemeCortexRemix();
export default memeCortexRemix;