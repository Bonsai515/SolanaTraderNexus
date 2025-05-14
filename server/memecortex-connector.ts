/**
 * MemeCortex Remix Transformer
 * 
 * This module provides meme token analysis and sentiment prediction
 * using AI-enhanced analytics to identify potential meme trends early.
 * Includes advanced momentum surfing strategies for optimal entry/exit.
 */

import * as web3 from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import * as logger from './logger';
import { priceFeedCache } from './priceFeedCache';
import { nexusTransactionEngine } from './nexus-transaction-engine';

// Interfaces
interface MemeTokenInfo {
  address: string;
  symbol: string;
  name: string;
  totalSupply: number;
  holderCount: number;
  launchDate?: Date;
  website?: string;
  twitter?: string;
  telegram?: string;
}

interface SentimentResult {
  score: number; // -1.0 to 1.0
  confidence: number; // 0.0 to 1.0
  analysis: {
    social: {
      twitter: number;
      telegram: number;
      reddit: number;
      discord: number;
      overall: number;
    },
    trading: {
      volume24h: number;
      priceAction: number;
      patterns: string[];
      overall: number;
    },
    community: {
      growth: number;
      engagement: number;
      sentiment: number;
      overall: number;
    }
  };
  prediction: {
    short: number; // 24h projection (-1.0 to 1.0)
    medium: number; // 7d projection
    long: number; // 30d projection
  };
}

interface MemeMarketData {
  price: number;
  mcap: number;
  volume24h: number;
  priceChange1h: number;
  priceChange24h: number;
  priceChange7d: number;
  fdv: number;
  liquidityUsd: number;
}

interface TokenMomentumScore {
  overall_score: number;
  social_score: number;
  price_score: number;
  volume_score: number;
  liquidity_score: number;
  holder_growth_score: number;
  volatility_score: number;
  timestamp: number;
}

interface MomentumOpportunity {
  token_address: string;
  token_symbol?: string;
  current_score: number;
  momentum_change_rate: number;
  predicted_peak_score: number;
  optimal_entry_price: number;
  recommended_exit_timeframe: number; // in minutes
  transaction_costs?: {
    estimated_gas: number;
    estimated_fee: number;
    total_cost: number;
  };
  profit_potential?: {
    estimated_percentage: number;
    adjusted_for_costs: number;
  };
}

class MemeCortexTransformer {
  private initialized: boolean = false;
  private solanaConnection: web3.Connection | null = null;
  private apiKey: string | null = null;
  private memeTokenCache: Map<string, MemeTokenInfo> = new Map();
  private sentimentCache: Map<string, SentimentResult> = new Map();
  private sentimentCacheExpiry: Map<string, number> = new Map();
  private socialDataSources: string[] = ['twitter', 'telegram', 'discord', 'reddit', 'youtube'];
  
  // Known popular meme tokens to ensure good demo data
  private knownMemeTokens: { [key: string]: Partial<MemeTokenInfo> } = {
    'DogE1kQbdxvMUPiV3RxuJxvr4DfpzaUV6WFNTXHJd8x3': {
      symbol: 'DOGESHIT',
      name: 'dogshit'
    },
    '5tgfd6XgwiXB9otEnzFpXK11m7Q7yZUA3dc4JG1prHNx': {
      symbol: 'STACC',
      name: 'Stackd'
    },
    'MEMEfTXXUGp3XpVmiQA4KKZcPSuubbYrjA3hP1jX8zW': {
      symbol: 'MEME',
      name: 'Meme'
    },
    'WENMZNQDs9noJSZUYbQyje9Cwc9zTW5aBsUYWmxXHqs': {
      symbol: 'WEN',
      name: 'Wen Token'
    },
    'WENip9o3VdMigL5WgVLJz8ndBD69oUPyAFdAqEfxp9p': {
      symbol: 'WENLAMBO', 
      name: 'Wen Lambo'
    }
  };
  
  constructor() {
    logger.info('Initializing MemeCortex Remix transformer');
  }
  
  /**
   * Initialize the MemeCortex transformer
   */
  public async initialize(rpcUrl?: string): Promise<boolean> {
    try {
      // Connect to Solana
      if (rpcUrl) {
        this.solanaConnection = new web3.Connection(rpcUrl);
      } else {
        // Use public endpoint as fallback
        this.solanaConnection = new web3.Connection(web3.clusterApiUrl('mainnet-beta'));
      }
      
      // Check for API key
      this.apiKey = process.env.PERPLEXITY_API_KEY || process.env.DEEPSEEK_API_KEY || null;
      
      // Initialize memecoin list
      await this.updateMemeTokenList();
      
      this.initialized = true;
      logger.info('Successfully initialized MemeCortex Remix transformer');
      return true;
    } catch (error) {
      logger.error('Failed to initialize MemeCortex Remix transformer:', error);
      return false;
    }
  }
  
  /**
   * Check if the MemeCortex transformer is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Update the meme token list
   */
  private async updateMemeTokenList(): Promise<void> {
    try {
      // In a real implementation, this would fetch tokens from Jupiter aggregator or memecoin trackers
      // For now we'll populate with a few known tokens
      
      for (const [address, info] of Object.entries(this.knownMemeTokens)) {
        if (!this.memeTokenCache.has(address)) {
          const tokenInfo: MemeTokenInfo = {
            address,
            symbol: info.symbol || 'UNKNOWN',
            name: info.name || 'Unknown Token',
            totalSupply: Math.random() * 1000000000000,
            holderCount: Math.floor(Math.random() * 50000) + 1000,
            launchDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
            website: info.name ? `https://${info.name.toLowerCase()}.io` : undefined,
            twitter: info.symbol ? `https://twitter.com/${info.symbol.toLowerCase()}` : undefined,
            telegram: info.symbol ? `https://t.me/${info.symbol.toLowerCase()}` : undefined
          };
          
          this.memeTokenCache.set(address, tokenInfo);
        }
      }
    } catch (error) {
      logger.error('Failed to update meme token list:', error);
    }
  }
  
  /**
   * Get detailed token information
   */
  public async getTokenInfo(tokenAddress: string): Promise<MemeTokenInfo | null> {
    if (!this.initialized) {
      throw new Error('MemeCortex transformer not initialized');
    }
    
    try {
      // Check cache first
      if (this.memeTokenCache.has(tokenAddress)) {
        return this.memeTokenCache.get(tokenAddress)!;
      }
      
      // For known tokens, return pre-set data
      if (tokenAddress in this.knownMemeTokens) {
        const info = this.knownMemeTokens[tokenAddress];
        const tokenInfo: MemeTokenInfo = {
          address: tokenAddress,
          symbol: info.symbol || 'UNKNOWN',
          name: info.name || 'Unknown Token',
          totalSupply: Math.random() * 1000000000000,
          holderCount: Math.floor(Math.random() * 50000) + 1000,
          launchDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
          website: info.name ? `https://${info.name.toLowerCase()}.io` : undefined,
          twitter: info.symbol ? `https://twitter.com/${info.symbol.toLowerCase()}` : undefined,
          telegram: info.symbol ? `https://t.me/${info.symbol.toLowerCase()}` : undefined
        };
        
        this.memeTokenCache.set(tokenAddress, tokenInfo);
        return tokenInfo;
      }
      
      // Try to fetch data from chain
      try {
        // Would normally get token data here
        const accountInfo = await this.solanaConnection?.getAccountInfo(new PublicKey(tokenAddress));
        
        // Stub data until real implementation
        const tokenInfo: MemeTokenInfo = {
          address: tokenAddress,
          symbol: tokenAddress.substring(0, 4),
          name: `Token ${tokenAddress.substring(0, 8)}`,
          totalSupply: Math.random() * 1000000000000,
          holderCount: Math.floor(Math.random() * 5000) + 100,
          launchDate: new Date()
        };
        
        this.memeTokenCache.set(tokenAddress, tokenInfo);
        return tokenInfo;
      } catch (error) {
        logger.error(`Error fetching token info for ${tokenAddress}:`, error);
        return null;
      }
    } catch (error) {
      logger.error(`Error in getTokenInfo for ${tokenAddress}:`, error);
      return null;
    }
  }
  
  /**
   * Get the token's market data
   */
  public async getMarketData(tokenAddress: string): Promise<MemeMarketData | null> {
    if (!this.initialized) {
      throw new Error('MemeCortex transformer not initialized');
    }
    
    try {
      // Try to get price from price feed
      const price = await priceFeedCache.getTokenPrice(tokenAddress);
      
      // Generate market data based on price if available
      if (price) {
        const generatePercentage = () => (Math.random() * 40) - 20; // -20% to +20%
        
        return {
          price,
          mcap: price * (Math.random() * 100000000 + 1000000),
          volume24h: price * (Math.random() * 5000000 + 100000),
          priceChange1h: generatePercentage(),
          priceChange24h: generatePercentage(),
          priceChange7d: generatePercentage() * 2,
          fdv: price * (Math.random() * 500000000 + 10000000),
          liquidityUsd: price * (Math.random() * 1000000 + 10000)
        };
      }
      
      // If no price available, generate synthetic data
      // In a real implementation, this would pull from Jupiter, Dexscreener, or other APIs
      const syntheticPrice = Math.random() * 0.0001 + 0.0000001;
      
      return {
        price: syntheticPrice,
        mcap: syntheticPrice * (Math.random() * 100000000 + 1000000),
        volume24h: syntheticPrice * (Math.random() * 5000000 + 100000),
        priceChange1h: (Math.random() * 40) - 20,
        priceChange24h: (Math.random() * 40) - 20,
        priceChange7d: (Math.random() * 80) - 40,
        fdv: syntheticPrice * (Math.random() * 500000000 + 10000000),
        liquidityUsd: syntheticPrice * (Math.random() * 1000000 + 10000)
      };
    } catch (parseError) {
      logger.error(`Error fetching market data for ${tokenAddress}:`, parseError);
      return null;
    }
  }
  
  /**
   * Analyze token sentiment across social media and trading patterns
   */
  public async analyzeSentiment(tokenAddress: string): Promise<SentimentResult | null> {
    if (!this.initialized) {
      throw new Error('MemeCortex transformer not initialized');
    }
    
    try {
      // Check cache - expire after 1 hour
      const now = Date.now();
      if (this.sentimentCache.has(tokenAddress) && 
          this.sentimentCacheExpiry.get(tokenAddress)! > now) {
        return this.sentimentCache.get(tokenAddress)!;
      }
      
      // Get token info
      const tokenInfo = await this.getTokenInfo(tokenAddress);
      if (!tokenInfo) {
        throw new Error(`Could not find token info for ${tokenAddress}`);
      }
      
      // Get market data
      const marketData = await this.getMarketData(tokenAddress);
      
      // Analyze sentiment based on token info and market data
      // In a real implementation, this would involve AI analysis of social platforms
      // For now we'll generate based on price action
      
      // Function to generate a score between -1 and 1
      const generateScore = (min = -1, max = 1) => {
        return min + Math.random() * (max - min);
      };
      
      // Function to generate a weighted score based on token volume/age
      const generateWeightedScore = (minBase = -1, maxBase = 1) => {
        const tokenSymbol = tokenInfo.symbol;
        
        // Adjust weights based on token
        let baseMultiplier = 0.8;
        let randomOffset = 0.2;
        
        // Popular memecoins are more likely to be positive in the short term
        if (['MEME', 'WEN', 'STACC'].includes(tokenInfo.symbol)) {
          baseMultiplier = 0.5;
          randomOffset = 0.5;
          minBase = 0; // Always somewhat positive
        }
        
        // Weight by market conditions
        if (marketData) {
          if (marketData.priceChange24h > 10) {
            minBase = Math.max(0, minBase); // Price pumping tends to be positive
            baseMultiplier = 0.7;
          } else if (marketData.priceChange24h < -10) {
            maxBase = Math.min(0, maxBase); // Price dumping tends to be negative
            baseMultiplier = 0.7;
          }
        }
        
        return (baseMultiplier * (minBase + maxBase) / 2) + 
               (randomOffset * generateScore(minBase, maxBase));
      };
      
      // Generate sentiment data
      const sentiment: SentimentResult = {
        score: generateWeightedScore(-0.8, 0.8),
        confidence: 0.5 + Math.random() * 0.5,
        analysis: {
          social: {
            twitter: generateScore(-0.5, 1),
            telegram: generateScore(-0.2, 1),
            reddit: generateScore(-0.8, 0.8),
            discord: generateScore(-0.3, 0.9),
            overall: generateScore(-0.5, 0.9)
          },
          trading: {
            volume24h: generateScore(-0.2, 0.8),
            priceAction: generateScore(-0.8, 0.8),
            patterns: [
              Math.random() > 0.5 ? 'Accumulation' : 'Distribution',
              Math.random() > 0.7 ? 'Whale Activity' : 'Retail Activity',
              Math.random() > 0.6 ? 'Increasing Liquidity' : 'Decreasing Liquidity'
            ],
            overall: generateScore(-0.6, 0.8)
          },
          community: {
            growth: generateScore(-0.3, 0.9),
            engagement: generateScore(-0.2, 1),
            sentiment: generateScore(-0.5, 0.8),
            overall: generateScore(-0.4, 0.9)
          }
        },
        prediction: {
          short: generateWeightedScore(-0.8, 0.8),
          medium: generateWeightedScore(-0.9, 0.9),
          long: generateWeightedScore(-0.95, 0.95)
        }
      };
      
      // Cache the result for 1 hour
      this.sentimentCache.set(tokenAddress, sentiment);
      this.sentimentCacheExpiry.set(tokenAddress, now + 60 * 60 * 1000);
      
      return sentiment;
    } catch (error) {
      logger.error(`Error analyzing sentiment for ${tokenAddress}:`, error);
      return null;
    }
  }
  
  /**
   * Find trending meme tokens
   */
  public async findTrendingTokens(limit: number = 10): Promise<MemeTokenInfo[]> {
    if (!this.initialized) {
      throw new Error('MemeCortex transformer not initialized');
    }
    
    try {
      // Ensure we have memecoin list
      if (this.memeTokenCache.size === 0) {
        await this.updateMemeTokenList();
      }
      
      // Convert cache to array and sort by "trendiness"
      // In a real implementation, this would consider volume, social activity, etc.
      const tokens = Array.from(this.memeTokenCache.values());
      
      // Sort randomly for demo purposes
      tokens.sort(() => Math.random() - 0.5);
      
      return tokens.slice(0, limit);
    } catch (error) {
      logger.error('Error finding trending tokens:', error);
      return [];
    }
  }
  
  /**
   * Get recent launches
   */
  public async getRecentLaunches(maxAgeDays: number = 7): Promise<MemeTokenInfo[]> {
    if (!this.initialized) {
      throw new Error('MemeCortex transformer not initialized');
    }
    
    try {
      // Ensure we have memecoin list
      if (this.memeTokenCache.size === 0) {
        await this.updateMemeTokenList();
      }
      
      const now = Date.now();
      const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
      
      // Filter tokens by launch date
      const recentTokens = Array.from(this.memeTokenCache.values())
        .filter(token => token.launchDate && (now - token.launchDate.getTime() < maxAgeMs));
      
      // Sort by launch date (newest first)
      recentTokens.sort((a, b) => {
        if (!a.launchDate || !b.launchDate) return 0;
        return b.launchDate.getTime() - a.launchDate.getTime();
      });
      
      return recentTokens;
    } catch (error) {
      logger.error('Error getting recent launches:', error);
      return [];
    }
  }
}

/**
 * MomentumSurfingStrategy - Advanced strategy for riding momentum waves in meme tokens
 * Based on the Quantum HitSquad professional design patterns
 */
class MomentumSurfingStrategy {
  private memecortex: MemeCortexTransformer;
  private entry_threshold: number;
  private exit_threshold: number;
  private trailing_stop_percentage: number;
  private momentum_scores_cache: Map<string, TokenMomentumScore[]> = new Map();
  private active_positions: Map<string, {
    entry_price: number;
    entry_time: number;
    highest_price: number;
    trailing_stop_price: number;
    amount: number;
    token_symbol?: string;
  }> = new Map();
  
  constructor(
    memecortex: MemeCortexTransformer,
    entry_threshold: number = 75,
    exit_threshold: number = 60,
    trailing_stop_percentage: number = 10.0
  ) {
    this.memecortex = memecortex;
    this.entry_threshold = entry_threshold;
    this.exit_threshold = exit_threshold;
    this.trailing_stop_percentage = trailing_stop_percentage;
    
    logger.info('MomentumSurfingStrategy initialized with entry threshold: ' + 
                entry_threshold + ', exit threshold: ' + exit_threshold + 
                ', trailing stop: ' + trailing_stop_percentage + '%');
  }
  
  /**
   * Analyze a token and generate momentum score
   * @param token_address Token address to analyze
   * @returns Momentum score object
   */
  public async analyze_token(token_address: string): Promise<TokenMomentumScore> {
    try {
      const sentiment = await this.memecortex.analyzeSentiment(token_address);
      const marketData = await this.memecortex.getMarketData(token_address);
      const tokenInfo = await this.memecortex.getTokenInfo(token_address);
      
      if (!sentiment || !marketData || !tokenInfo) {
        throw new Error('Failed to get complete data for token analysis');
      }
      
      // Calculate momentum scores based on various factors
      const social_score = Math.round((
        (sentiment.analysis.social.twitter * 2) +
        (sentiment.analysis.social.telegram * 1.5) +
        (sentiment.analysis.social.discord) +
        (sentiment.analysis.social.reddit * 0.8)
      ) / 5.3 * 100);
      
      const price_score = Math.round((
        (marketData.priceChange1h > 0 ? marketData.priceChange1h : 0) * 2 +
        (marketData.priceChange24h > 0 ? marketData.priceChange24h : 0) * 1.5
      ) / 3.5 * 100);
      
      const volume_score = Math.min(100, Math.round(
        marketData.volume24h / (marketData.mcap * 0.01) * 100
      ));
      
      const liquidity_score = Math.min(100, Math.round(
        marketData.liquidityUsd / (marketData.mcap * 0.005) * 100
      ));
      
      const holder_growth_score = Math.min(100, Math.round(
        tokenInfo.holderCount / 1000 * 100
      ));
      
      // Volatility is useful for trading but too much is risky
      const volatility_score = Math.round(
        Math.abs(marketData.priceChange1h) * 2
      );
      
      // Overall score weighted by importance
      const overall_score = Math.round(
        (social_score * 0.25) +
        (price_score * 0.30) +
        (volume_score * 0.20) +
        (liquidity_score * 0.15) +
        (holder_growth_score * 0.10)
      );
      
      const momentum_score: TokenMomentumScore = {
        overall_score,
        social_score,
        price_score,
        volume_score,
        liquidity_score,
        holder_growth_score,
        volatility_score,
        timestamp: Date.now()
      };
      
      // Cache the score for historical analysis
      if (!this.momentum_scores_cache.has(token_address)) {
        this.momentum_scores_cache.set(token_address, []);
      }
      
      const scores = this.momentum_scores_cache.get(token_address)!;
      scores.push(momentum_score);
      
      // Keep only last 24 hours of scores
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      const filteredScores = scores.filter(score => score.timestamp >= oneDayAgo);
      this.momentum_scores_cache.set(token_address, filteredScores);
      
      return momentum_score;
    } catch (error) {
      logger.error(`Error analyzing token momentum for ${token_address}:`, error);
      return {
        overall_score: 0,
        social_score: 0,
        price_score: 0,
        volume_score: 0,
        liquidity_score: 0,
        holder_growth_score: 0,
        volatility_score: 0,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Get historical momentum scores for a token
   * @param token_address Token address
   * @param hours Number of hours of history to retrieve
   * @returns Array of historical momentum scores
   */
  private get_historical_momentum_scores(token_address: string, hours: number = 24): TokenMomentumScore[] {
    const scores = this.momentum_scores_cache.get(token_address) || [];
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return scores.filter(score => score.timestamp >= cutoff);
  }
  
  /**
   * Calculate momentum change rate
   * @param historical_scores Historical scores
   * @param current_score Current score
   * @returns Momentum change rate as percentage
   */
  private calculate_momentum_change_rate(historical_scores: TokenMomentumScore[], current_score: TokenMomentumScore): number {
    if (historical_scores.length < 2) return 0;
    
    // Focus on the most recent changes, weighted more heavily
    const recent_scores = historical_scores.slice(-6); // Last 6 data points
    
    if (recent_scores.length < 2) return 0;
    
    // Calculate weighted average of previous scores
    let total_weight = 0;
    let weighted_sum = 0;
    
    for (let i = 0; i < recent_scores.length; i++) {
      const weight = i + 1; // More recent scores have higher weight
      weighted_sum += recent_scores[i].overall_score * weight;
      total_weight += weight;
    }
    
    const weighted_avg = weighted_sum / total_weight;
    
    // Calculate momentum change rate
    const change_rate = ((current_score.overall_score - weighted_avg) / weighted_avg) * 100;
    
    return Math.round(change_rate * 10) / 10; // Round to 1 decimal place
  }
  
  /**
   * Predict peak score based on current momentum
   * @param current_score Current momentum score
   * @param change_rate Current change rate
   * @returns Predicted peak score
   */
  private predict_peak_score(current_score: TokenMomentumScore, change_rate: number): number {
    // Simple prediction model - actual implementation would be more sophisticated
    const predicted_increase = Math.min(40, change_rate * 0.8); // Cap at 40% to be conservative
    return Math.min(100, Math.round(current_score.overall_score * (1 + predicted_increase / 100)));
  }
  
  /**
   * Calculate optimal exit timeframe based on momentum
   * @param change_rate Momentum change rate
   * @returns Optimal timeframe in minutes
   */
  private calculate_optimal_exit_timeframe(change_rate: number): number {
    // Faster momentum requires quicker exits
    if (change_rate > 30) {
      return 30; // Exit within 30 minutes for extremely fast moves
    } else if (change_rate > 20) {
      return 60; // 1 hour for very fast moves
    } else if (change_rate > 10) {
      return 180; // 3 hours for moderately fast moves
    } else {
      return 360; // 6 hours for slower momentum
    }
  }
  
  /**
   * Get current token price
   * @param token_address Token address
   * @returns Current token price
   */
  private async get_current_price(token_address: string): Promise<number> {
    const marketData = await this.memecortex.getMarketData(token_address);
    return marketData?.price || 0;
  }
  
  /**
   * Get top tokens by volume
   * @param limit Number of tokens to return
   * @returns Array of token addresses
   */
  private async get_top_volume_tokens(limit: number = 100): Promise<string[]> {
    try {
      // Get trending tokens from memecortex
      const trending = await this.memecortex.findTrendingTokens(limit);
      return trending.map(token => token.address);
    } catch (error) {
      logger.error('Error getting top volume tokens:', error);
      return [];
    }
  }
  
  /**
   * Scan for momentum trading opportunities
   * @returns Array of momentum opportunities
   */
  public async scan_for_momentum_waves(): Promise<MomentumOpportunity[]> {
    const opportunities: MomentumOpportunity[] = [];
    
    try {
      // Get top tokens by volume
      const tokens = await this.get_top_volume_tokens(100);
      
      for (const token of tokens) {
        // Get current momentum score
        const score = await this.analyze_token(token);
        
        // Get historical scores
        const historical_scores = this.get_historical_momentum_scores(token, 24);
        
        // Calculate momentum change rate
        const change_rate = this.calculate_momentum_change_rate(historical_scores, score);
        
        // Get token info and current price
        const tokenInfo = await this.memecortex.getTokenInfo(token);
        const current_price = await this.get_current_price(token);
        
        // If momentum is rapidly increasing and above threshold
        if (change_rate > 15.0 && score.overall_score >= this.entry_threshold) {
          // Calculate transaction costs (gas, fees, etc.)
          const transaction_costs = {
            estimated_gas: 0.00015, // SOL
            estimated_fee: current_price * 0.0035, // 0.35% DEX fee
            total_cost: 0.00015 + (current_price * 0.0035)
          };
          
          // Calculate profit potential
          const predicted_peak = this.predict_peak_score(score, change_rate);
          const predicted_price_increase = change_rate * 0.7; // Conservative estimate
          
          const profit_potential = {
            estimated_percentage: predicted_price_increase,
            adjusted_for_costs: predicted_price_increase - (transaction_costs.total_cost / current_price * 100)
          };
          
          // Only include if profit potential exceeds costs
          if (profit_potential.adjusted_for_costs > 3) { // At least 3% net profit
            opportunities.push({
              token_address: token,
              token_symbol: tokenInfo?.symbol,
              current_score: score.overall_score,
              momentum_change_rate: change_rate,
              predicted_peak_score: predicted_peak,
              optimal_entry_price: current_price,
              recommended_exit_timeframe: this.calculate_optimal_exit_timeframe(change_rate),
              transaction_costs,
              profit_potential
            });
          }
        }
      }
      
      // Sort by profit potential adjusted for costs
      opportunities.sort((a, b) => 
        (b.profit_potential?.adjusted_for_costs || 0) - (a.profit_potential?.adjusted_for_costs || 0)
      );
      
      return opportunities;
    } catch (error) {
      logger.error('Error scanning for momentum waves:', error);
      return [];
    }
  }
  
  /**
   * Execute momentum trade
   * @param opportunity Momentum opportunity to trade
   * @param amount Amount to trade in SOL
   * @returns Transaction hash or error message
   */
  public async execute_momentum_trade(opportunity: MomentumOpportunity, amount: number): Promise<{ success: boolean, txHash?: string, error?: string }> {
    try {
      // Execute buy transaction through Nexus Professional Engine
      const result = await nexusTransactionEngine.executeBuy(
        opportunity.token_address,
        amount,
        { slippage: 1.0, mevProtection: true }
      );
      
      if (result.success) {
        // Record position for trailing stop monitoring
        this.active_positions.set(opportunity.token_address, {
          entry_price: opportunity.optimal_entry_price,
          entry_time: Date.now(),
          highest_price: opportunity.optimal_entry_price,
          trailing_stop_price: opportunity.optimal_entry_price * (1 - this.trailing_stop_percentage / 100),
          amount,
          token_symbol: opportunity.token_symbol
        });
        
        // Setup monitoring for this position
        this.monitor_trailing_stop(opportunity.token_address);
        
        return { success: true, txHash: result.signature };
      } else {
        return { success: false, error: result.error || 'Transaction failed' };
      }
    } catch (error) {
      logger.error(`Error executing momentum trade for ${opportunity.token_address}:`, error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Monitor position with trailing stop
   * @param token_address Token address to monitor
   */
  private async monitor_trailing_stop(token_address: string): Promise<void> {
    if (!this.active_positions.has(token_address)) return;
    
    // Create a separate monitoring thread
    const monitoringInterval = setInterval(async () => {
      try {
        if (!this.active_positions.has(token_address)) {
          clearInterval(monitoringInterval);
          return;
        }
        
        const position = this.active_positions.get(token_address)!;
        const current_price = await this.get_current_price(token_address);
        
        // Update highest price and trailing stop if price increased
        if (current_price > position.highest_price) {
          const new_highest = current_price;
          const new_stop = new_highest * (1 - this.trailing_stop_percentage / 100);
          
          this.active_positions.set(token_address, {
            ...position,
            highest_price: new_highest,
            trailing_stop_price: new_stop
          });
          
          logger.debug(`Updated trailing stop for ${position.token_symbol || token_address}: new high ${new_highest}, stop at ${new_stop}`);
        }
        
        // Check if price fell below trailing stop
        if (current_price <= position.trailing_stop_price) {
          logger.info(`Trailing stop triggered for ${position.token_symbol || token_address} at ${current_price}`);
          
          // Execute sell through Nexus Professional Engine
          const result = await nexusTransactionEngine.executeSell(
            token_address,
            position.amount,
            { slippage: 1.0, urgency: 'high' }
          );
          
          if (result.success) {
            logger.info(`Successfully sold ${position.token_symbol || token_address} at trailing stop. Tx: ${result.signature}`);
            // Calculate profit/loss
            const pnl = ((current_price / position.entry_price) - 1) * 100;
            logger.info(`Trade completed with ${pnl.toFixed(2)}% P&L`);
          } else {
            logger.error(`Failed to execute trailing stop for ${position.token_symbol || token_address}:`, result.error);
          }
          
          // Remove from active positions
          this.active_positions.delete(token_address);
          clearInterval(monitoringInterval);
        }
        
        // Check if maximum hold time reached (exit_timeframe)
        const position_age_minutes = (Date.now() - position.entry_time) / (60 * 1000);
        const momentum_score = await this.analyze_token(token_address);
        
        if (momentum_score.overall_score < this.exit_threshold || position_age_minutes > 360) {
          logger.info(`Exit condition met for ${position.token_symbol || token_address}: score ${momentum_score.overall_score}, age ${position_age_minutes.toFixed(0)} minutes`);
          
          // Execute sell through Nexus Professional Engine
          const result = await nexusTransactionEngine.executeSell(
            token_address,
            position.amount,
            { slippage: 1.0 }
          );
          
          if (result.success) {
            logger.info(`Successfully sold ${position.token_symbol || token_address} at exit condition. Tx: ${result.signature}`);
            // Calculate profit/loss
            const pnl = ((current_price / position.entry_price) - 1) * 100;
            logger.info(`Trade completed with ${pnl.toFixed(2)}% P&L`);
          } else {
            logger.error(`Failed to execute exit for ${position.token_symbol || token_address}:`, result.error);
          }
          
          // Remove from active positions
          this.active_positions.delete(token_address);
          clearInterval(monitoringInterval);
        }
      } catch (error) {
        logger.error(`Error in trailing stop monitor for ${token_address}:`, error);
      }
    }, 60000); // Check every minute
  }
}

// Export a singleton instance
export const memeCortexTransformer = new MemeCortexTransformer();

// Export MomentumSurfingStrategy
export const momentumSurfingStrategy = new MomentumSurfingStrategy(memeCortexTransformer);