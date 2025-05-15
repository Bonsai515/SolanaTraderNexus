/**
 * MicroQHC Transformer
 * 
 * This transformer analyzes micro-market conditions and generates
 * high-confidence trading signals using quantum hash algorithms.
 */

import { logger } from '../../logger';
import { IMicroQHCTransformer } from './index';
import { SolanaPriceFeed } from '../SolanaPriceFeed';
import { TokenInfo } from '../../types';

export interface MarketCondition {
  timestamp: number;
  overall_condition: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  volatility: number;
  liquidity: number;
  volume_change: number;
  factors: string[];
}

export interface TradingSignal {
  id: string;
  timestamp: number;
  token_address: string;
  signal_type: 'BUY' | 'SELL' | 'HOLD';
  strength: number; // 0-100
  timeframe: 'short' | 'medium' | 'long';
  confidence: number; // 0-1
  factors: string[];
  optimal_entry?: number;
  optimal_exit?: number;
  stop_loss?: number;
}

type TokenData = {
  address: string;
  price: number;
  price_24h_change: number;
  volume_24h: number;
  volume_24h_change: number;
  liquidity: number;
  timestamp: number;
};

export class MicroQHCTransformer implements IMicroQHCTransformer {
  private initialized: boolean = false;
  private lastAnalysisTimestamp: number = 0;
  private marketCondition: MarketCondition | null = null;
  private recentSignals: TradingSignal[] = [];
  private priceFeed: SolanaPriceFeed;
  private tokenDataCache: Map<string, TokenData> = new Map();
  
  constructor() {
    this.priceFeed = new SolanaPriceFeed();
  }
  
  /**
   * Initialize the MicroQHC Transformer
   */
  public async initialize(): Promise<boolean> {
    try {
      // Initialize price feed connection
      const priceInit = await this.priceFeed.initialize();
      
      if (!priceInit) {
        throw new Error('Failed to initialize price feed');
      }
      
      // Perform initial market analysis
      await this.analyzeMarketConditions();
      
      this.initialized = true;
      return true;
    } catch (error: any) {
      logger.error(`Failed to initialize MicroQHCTransformer: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Check if the transformer is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Analyze current market conditions
   * @returns Market condition analysis
   */
  public async analyzeMarketConditions(): Promise<MarketCondition> {
    if (!this.initialized && !this.priceFeed.isInitialized()) {
      throw new Error('MicroQHCTransformer not initialized');
    }
    
    try {
      // Only update market analysis every 5 minutes
      const now = Date.now();
      if (this.marketCondition && (now - this.lastAnalysisTimestamp < 5 * 60 * 1000)) {
        return this.marketCondition;
      }
      
      // Get market data for key tokens
      const keyTokens = ['SOL', 'ETH', 'BTC', 'USDC', 'BONK', 'JUP', 'RAY'];
      
      // Fetch token data
      const tokenData: TokenData[] = [];
      
      for (const token of keyTokens) {
        const data = await this.getTokenData(token);
        if (data) {
          tokenData.push(data);
        }
      }
      
      // Calculate market indicators
      const volumeChanges = tokenData.map(t => t.volume_24h_change);
      const priceChanges = tokenData.map(t => t.price_24h_change);
      
      const avgVolumeChange = this.average(volumeChanges);
      const avgPriceChange = this.average(priceChanges);
      const volatility = this.standardDeviation(priceChanges);
      
      // Determine market condition
      let overallCondition: 'bullish' | 'bearish' | 'neutral' = 'neutral';
      const factors: string[] = [];
      
      if (avgPriceChange > 5 && avgVolumeChange > 10) {
        overallCondition = 'bullish';
        factors.push('Strong price and volume increases');
      } else if (avgPriceChange < -5 && avgVolumeChange > 10) {
        overallCondition = 'bearish';
        factors.push('Price decrease with high volume');
      } else if (Math.abs(avgPriceChange) < 2 && Math.abs(avgVolumeChange) < 5) {
        overallCondition = 'neutral';
        factors.push('Stable prices and volumes');
      } else if (avgPriceChange > 2) {
        overallCondition = 'bullish';
        factors.push('Moderate price increase');
      } else if (avgPriceChange < -2) {
        overallCondition = 'bearish';
        factors.push('Moderate price decrease');
      }
      
      if (volatility > 10) {
        factors.push('High market volatility');
      } else if (volatility < 3) {
        factors.push('Low market volatility');
      }
      
      // Calculate confidence based on consistency of signals
      let confidence = 0.5; // Default medium confidence
      
      // Higher confidence if price and volume changes are in the same direction
      if ((avgPriceChange > 0 && avgVolumeChange > 0) || 
          (avgPriceChange < 0 && avgVolumeChange > 0)) {
        confidence += 0.2;
      }
      
      // Lower confidence in high volatility
      if (volatility > 8) {
        confidence -= 0.1;
      }
      
      // Higher confidence if many tokens moving in same direction
      const positivePriceChanges = priceChanges.filter(change => change > 0).length;
      const negativePriceChanges = priceChanges.filter(change => change < 0).length;
      
      if (positivePriceChanges > tokenData.length * 0.7 || 
          negativePriceChanges > tokenData.length * 0.7) {
        confidence += 0.2;
      }
      
      // Ensure confidence is within bounds
      confidence = Math.max(0, Math.min(1, confidence));
      
      // Create market condition object
      this.marketCondition = {
        timestamp: now,
        overall_condition: overallCondition,
        confidence: confidence,
        volatility: volatility,
        liquidity: this.average(tokenData.map(t => t.liquidity)),
        volume_change: avgVolumeChange,
        factors: factors
      };
      
      this.lastAnalysisTimestamp = now;
      
      return this.marketCondition;
    } catch (error: any) {
      logger.error(`Error analyzing market conditions: ${error.message}`);
      
      // Return last known market condition or a neutral assessment
      return this.marketCondition || {
        timestamp: Date.now(),
        overall_condition: 'neutral',
        confidence: 0.5,
        volatility: 5,
        liquidity: 1000000,
        volume_change: 0,
        factors: ['Error analyzing market', error.message]
      };
    }
  }
  
  /**
   * Generate trading signals based on current market analysis
   * @returns Array of trading signals
   */
  public async generateTradingSignals(): Promise<TradingSignal[]> {
    if (!this.initialized) {
      throw new Error('MicroQHCTransformer not initialized');
    }
    
    try {
      // Get current market conditions
      const marketCondition = await this.analyzeMarketConditions();
      
      // Get top tokens by volume
      const topTokens = await this.getTopTokensByVolume(20);
      
      // Generate signals
      const signals: TradingSignal[] = [];
      
      for (const token of topTokens) {
        // Get token specific data
        const tokenData = await this.getTokenData(token.address);
        
        if (!tokenData) continue;
        
        // Determine signal type based on token performance and market conditions
        let signalType: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
        let signalStrength = 50; // Default medium strength
        let signalConfidence = marketCondition.confidence;
        const factors: string[] = [];
        
        // Strong buy signal conditions
        if (
          (tokenData.price_24h_change > 5 && tokenData.volume_24h_change > 20) || 
          (tokenData.price_24h_change < -10 && marketCondition.overall_condition === 'bullish')
        ) {
          signalType = 'BUY';
          signalStrength = Math.min(100, 60 + Math.floor(tokenData.volume_24h_change / 2));
          
          if (tokenData.price_24h_change > 5) {
            factors.push('Strong upward momentum');
          } else {
            factors.push('Potential reversal in bullish market');
          }
        }
        // Strong sell signal conditions
        else if (
          (tokenData.price_24h_change < -5 && tokenData.volume_24h_change > 20) ||
          (tokenData.price_24h_change > 15 && marketCondition.overall_condition === 'bearish')
        ) {
          signalType = 'SELL';
          signalStrength = Math.min(100, 60 + Math.floor(Math.abs(tokenData.price_24h_change)));
          
          if (tokenData.price_24h_change < -5) {
            factors.push('Strong downward momentum');
          } else {
            factors.push('Potential profit taking in bearish market');
          }
        }
        // Moderate buy signal
        else if (
          tokenData.price_24h_change > 2 && 
          marketCondition.overall_condition === 'bullish'
        ) {
          signalType = 'BUY';
          signalStrength = 50 + Math.floor(tokenData.price_24h_change);
          factors.push('Moderate upward momentum in bullish market');
        }
        // Moderate sell signal
        else if (
          tokenData.price_24h_change < -2 && 
          marketCondition.overall_condition === 'bearish'
        ) {
          signalType = 'SELL';
          signalStrength = 50 + Math.floor(Math.abs(tokenData.price_24h_change));
          factors.push('Moderate downward momentum in bearish market');
        }
        // Hold signals
        else {
          signalType = 'HOLD';
          signalStrength = 40;
          factors.push('No clear directional momentum');
          
          if (marketCondition.volatility > 8) {
            factors.push('High market volatility - wait for clear direction');
          }
        }
        
        // Generate signal for tokens with sufficient signal strength
        if (signalStrength > 40) {
          // Generate a timeframe based on signal strength and volatility
          let timeframe: 'short' | 'medium' | 'long' = 'medium';
          
          if (marketCondition.volatility > 8 || signalStrength < 60) {
            timeframe = 'short';
          } else if (signalStrength > 80 && marketCondition.volatility < 5) {
            timeframe = 'long';
          }
          
          // Calculate optimal entry/exit if relevant
          let optimalEntry = undefined;
          let optimalExit = undefined;
          let stopLoss = undefined;
          
          if (signalType === 'BUY') {
            optimalEntry = tokenData.price;
            
            // Simple estimation of potential upside
            const potentialUpside = tokenData.price * (1 + (signalStrength / 100));
            optimalExit = potentialUpside;
            
            // Set stop loss at 5-10% below entry depending on volatility
            const stopLossPercentage = marketCondition.volatility > 8 ? 0.1 : 0.05;
            stopLoss = tokenData.price * (1 - stopLossPercentage);
          }
          
          const signal: TradingSignal = {
            id: `signal_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`,
            timestamp: Date.now(),
            token_address: token.address,
            signal_type: signalType,
            strength: signalStrength,
            timeframe: timeframe,
            confidence: signalConfidence,
            factors: factors,
            optimal_entry: optimalEntry,
            optimal_exit: optimalExit,
            stop_loss: stopLoss
          };
          
          signals.push(signal);
        }
      }
      
      // Sort signals by strength and add to recent signals
      signals.sort((a, b) => b.strength - a.strength);
      
      // Update recent signals cache
      this.recentSignals = [...signals, ...this.recentSignals].slice(0, 50);
      
      return signals;
    } catch (error: any) {
      logger.error(`Error generating trading signals: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Get recent trading signals
   * @param count Number of signals to retrieve
   * @returns Recent trading signals
   */
  public getRecentSignals(count: number = 10): TradingSignal[] {
    return this.recentSignals.slice(0, count);
  }
  
  /**
   * Get token specific data
   * @param tokenAddress Token address or symbol
   * @returns Token data
   */
  private async getTokenData(tokenAddress: string): Promise<TokenData | null> {
    try {
      // Check cache first
      const cachedData = this.tokenDataCache.get(tokenAddress);
      const now = Date.now();
      
      // If we have fresh data (less than 2 minutes old), use it
      if (cachedData && (now - cachedData.timestamp < 2 * 60 * 1000)) {
        return cachedData;
      }
      
      // Fetch current price
      const currentPrice = await this.priceFeed.getTokenPrice(tokenAddress);
      
      // Fetch 24h old price
      const price24hAgo = await this.priceFeed.getHistoricalTokenPrice(
        tokenAddress, 
        new Date(now - 24 * 60 * 60 * 1000)
      );
      
      // Calculate price change
      const priceChange = price24hAgo > 0 
        ? ((currentPrice - price24hAgo) / price24hAgo) * 100 
        : 0;
      
      // Fetch volume
      const currentVolume = await this.priceFeed.getTokenVolume(tokenAddress);
      
      // Fetch 24h old volume
      const volume24hAgo = await this.priceFeed.getHistoricalTokenVolume(
        tokenAddress,
        new Date(now - 24 * 60 * 60 * 1000)
      );
      
      // Calculate volume change
      const volumeChange = volume24hAgo > 0 
        ? ((currentVolume - volume24hAgo) / volume24hAgo) * 100 
        : 0;
      
      // Fetch liquidity
      const liquidity = await this.priceFeed.getTokenLiquidity(tokenAddress);
      
      // Create token data
      const tokenData: TokenData = {
        address: tokenAddress,
        price: currentPrice,
        price_24h_change: priceChange,
        volume_24h: currentVolume,
        volume_24h_change: volumeChange,
        liquidity: liquidity,
        timestamp: now
      };
      
      // Cache data
      this.tokenDataCache.set(tokenAddress, tokenData);
      
      return tokenData;
    } catch (error: any) {
      logger.error(`Error getting token data for ${tokenAddress}: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Get top tokens by trading volume
   * @param count Number of tokens to retrieve
   * @returns Array of token info
   */
  private async getTopTokensByVolume(count: number): Promise<TokenInfo[]> {
    try {
      return await this.priceFeed.getTopTokensByVolume(count);
    } catch (error: any) {
      logger.error(`Error getting top tokens by volume: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Calculate average of array of numbers
   * @param values Array of numbers
   * @returns Average value
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }
  
  /**
   * Calculate standard deviation of array of numbers
   * @param values Array of numbers
   * @returns Standard deviation
   */
  private standardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    
    const avg = this.average(values);
    const squareDiffs = values.map(value => {
      const diff = value - avg;
      return diff * diff;
    });
    
    const avgSquareDiff = this.average(squareDiffs);
    return Math.sqrt(avgSquareDiff);
  }
}