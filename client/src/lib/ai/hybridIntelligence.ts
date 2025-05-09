/**
 * Hybrid Intelligence System
 * 
 * Neural architecture combining Perplexity and DeepSeek AI capabilities
 * for advanced market analysis and strategy development.
 */

import { apiRequest } from "../queryClient";

// Core types for market analysis
export interface MarketState {
  pair: string;
  currentPrice: number;
  historicalPrices: PricePoint[];
  volume24h: number;
  marketCap?: number;
  liquidityDepth?: number;
  orderBook?: OrderBook;
  socialMetrics?: SocialMetrics;
  technicalIndicators?: TechnicalIndicators;
  onChainMetrics?: OnChainMetrics;
}

export interface PricePoint {
  timestamp: Date;
  price: number;
  volume?: number;
}

export interface OrderBook {
  asks: [number, number][]; // [price, amount]
  bids: [number, number][]; // [price, amount]
  lastUpdated: Date;
}

export interface SocialMetrics {
  sentiment: number; // -1 to 1 scale
  sentimentChange24h: number;
  mentionsCount: number;
  viralScore: number; // 0 to 100 scale
  sources: { name: string, count: number }[];
}

export interface TechnicalIndicators {
  rsi: number;
  macd: {
    line: number;
    signal: number;
    histogram: number;
  };
  ema: {
    ema9: number;
    ema21: number;
    ema50: number;
    ema200: number;
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  };
}

export interface OnChainMetrics {
  uniqueHolders: number;
  topHolderConcentration: number; // Percentage held by top 10 wallets
  recentTransactions: number;
  whaleMovements: boolean;
}

// AI Analysis results
export interface AIAnalysis {
  timestamp: Date;
  pair: string;
  prediction: {
    direction: 'bullish' | 'bearish' | 'neutral';
    confidence: number; // 0 to 1 scale
    priceTarget?: number;
    timeframe: string;
  };
  insights: string[];
  riskScore: number; // 0 to 100 scale
  opportunities: TradeOpportunity[];
  warnings: string[];
  technicalSummary: string;
  sentimentSummary: string;
  sources: string[];
}

export interface TradeOpportunity {
  type: 'long' | 'short' | 'arbitrage' | 'liquidity';
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  potentialReturn: number; // Percentage
  strategy: string;
}

export interface StrategyParameters {
  name: string;
  description: string;
  marketConditions: string[];
  riskLevel: 'low' | 'medium' | 'high';
  targetedAssets: string[];
  timeframe: string;
  indicators: string[];
  entryConditions: string[];
  exitConditions: string[];
}

/**
 * Hybrid Intelligence System Client
 * 
 * Provides access to the Perplexity and DeepSeek AI integration
 * for advanced market analysis and strategy development.
 */
export class HybridIntelligenceClient {
  /**
   * Analyze market state using combined AI intelligence.
   */
  async analyzeMarket(marketState: MarketState): Promise<AIAnalysis> {
    try {
      const response = await apiRequest('POST', '/api/ai/analyze-market', {
        marketState
      });
      
      return await response.json();
    } catch (error) {
      console.error('Failed to analyze market:', error);
      throw error;
    }
  }

  /**
   * Create a trading strategy based on market conditions.
   */
  async createStrategy(parameters: StrategyParameters): Promise<string> {
    try {
      const response = await apiRequest('POST', '/api/ai/create-strategy', {
        parameters
      });
      
      const result = await response.json();
      return result.strategy;
    } catch (error) {
      console.error('Failed to create strategy:', error);
      throw error;
    }
  }

  /**
   * Identify patterns in historical market data.
   */
  async identifyPatterns(pair: string, timeframe: string = '1d', lookback: number = 30): Promise<Array<{
    pattern: string;
    confidence: number;
    description: string;
    tradingImplication: string;
  }>> {
    try {
      const response = await apiRequest('GET', `/api/ai/identify-patterns?pair=${pair}&timeframe=${timeframe}&lookback=${lookback}`);
      
      return await response.json();
    } catch (error) {
      console.error('Failed to identify patterns:', error);
      return [];
    }
  }

  /**
   * Get sentiment analysis for a specific asset.
   */
  async getSentimentAnalysis(asset: string): Promise<{
    overall: number;
    timeframeAnalysis: Array<{ timeframe: string, sentiment: number }>;
    sources: Array<{ name: string, sentiment: number, impact: number }>;
    keyPhrases: string[];
  }> {
    try {
      const response = await apiRequest('GET', `/api/ai/sentiment-analysis?asset=${asset}`);
      
      return await response.json();
    } catch (error) {
      console.error('Failed to get sentiment analysis:', error);
      throw error;
    }
  }

  /**
   * Generate an AI-powered trading insight.
   */
  async generateInsight(pair: string): Promise<{
    summary: string;
    technicalAnalysis: string;
    sentimentAnalysis: string;
    recommendation: string;
    confidenceScore: number;
    supportingData: {
      chart?: string; // Base64 encoded chart image
      keyMetrics: Record<string, number>;
      timeGenerated: Date;
    };
  }> {
    try {
      const response = await apiRequest('GET', `/api/ai/generate-insight?pair=${pair}`);
      
      return await response.json();
    } catch (error) {
      console.error('Failed to generate insight:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const hybridIntelligence = new HybridIntelligenceClient();