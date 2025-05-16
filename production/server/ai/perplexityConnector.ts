/**
 * Perplexity API Connector for Advanced Market Analysis
 * 
 * This module provides AI-driven market analysis and strategic insights
 * using the Perplexity API with their Llama 3.1 Sonar model.
 */

import axios from 'axios';
import { logger } from '../logger';

export interface PerplexityAnalysisRequest {
  query: string;
  marketData?: any;
  tokenInfo?: any;
  tradingHistory?: any;
}

export interface PerplexityAnalysisResponse {
  analysis: string;
  tradingRecommendation?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  confidence: number;
  citations?: string[];
  reasoning?: string;
}

export class PerplexityConnector {
  private apiKey: string | undefined;
  private baseUrl: string = 'https://api.perplexity.ai/chat/completions';
  private initialized: boolean = false;
  private model: string = 'llama-3.1-sonar-small-128k-online';
  
  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY;
    
    if (this.apiKey) {
      this.initialized = true;
      logger.info('Perplexity API connector initialized successfully');
    } else {
      logger.warn('Perplexity API key not found, AI-driven analysis will be unavailable');
    }
  }
  
  /**
   * Initialize the Perplexity connector
   */
  public async initialize(apiKey?: string): Promise<boolean> {
    if (this.initialized) {
      return true;
    }
    
    if (apiKey) {
      this.apiKey = apiKey;
    } else if (process.env.PERPLEXITY_API_KEY) {
      this.apiKey = process.env.PERPLEXITY_API_KEY;
    }
    
    if (!this.apiKey) {
      logger.warn('Cannot initialize Perplexity connector without API key');
      return false;
    }
    
    // Test connection to Perplexity API
    try {
      const testResponse = await this.callPerplexityAPI('Test connection to Perplexity API');
      
      if (testResponse) {
        this.initialized = true;
        logger.info('Perplexity API connector initialized successfully');
        return true;
      } else {
        logger.error('Failed to connect to Perplexity API');
        return false;
      }
    } catch (error: any) {
      logger.error('Error initializing Perplexity connector:', error.message);
      return false;
    }
  }
  
  /**
   * Check if the connector is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Set the model to use for analysis
   */
  public setModel(model: string): void {
    const validModels = [
      'llama-3.1-sonar-small-128k-online',
      'llama-3.1-sonar-large-128k-online',
      'llama-3.1-sonar-huge-128k-online'
    ];
    
    if (!validModels.includes(model)) {
      logger.warn(`Invalid model: ${model}. Using default model: ${this.model}`);
      return;
    }
    
    this.model = model;
    logger.info(`Perplexity model set to: ${model}`);
  }
  
  /**
   * Call the Perplexity API
   */
  private async callPerplexityAPI(prompt: string): Promise<string | null> {
    if (!this.initialized || !this.apiKey) {
      logger.warn('Perplexity connector not initialized');
      return null;
    }
    
    try {
      const response = await axios.post(
        this.baseUrl,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert blockchain and cryptocurrency market analyst with expertise in trading strategies, technical analysis, and on-chain metrics. Provide precise, data-backed analysis.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 2048,
          temperature: 0.2,
          top_p: 0.9,
          search_recency_filter: 'month',
          frequency_penalty: 1,
          stream: false
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data && response.data.choices && response.data.choices.length > 0) {
        return response.data.choices[0].message.content;
      } else {
        logger.warn('Unexpected response format from Perplexity API');
        return null;
      }
    } catch (error: any) {
      logger.error('Error calling Perplexity API:', error.message);
      return null;
    }
  }
  
  /**
   * Analyze market data and provide strategic insights
   */
  public async analyzeMarket(request: PerplexityAnalysisRequest): Promise<PerplexityAnalysisResponse | null> {
    if (!this.initialized) {
      await this.initialize();
      
      if (!this.initialized) {
        logger.warn('Perplexity API not available, continuing with trading functionality without AI analysis');
        // Return basic analysis so the system can continue to function
        return {
          analysis: 'AI analysis not available, continuing with algorithmic analysis only.',
          tradingRecommendation: request.marketData?.priceChange24h > 0 ? 'Buy' : 'Hold',
          riskLevel: 'medium',
          confidence: 0.5,
          reasoning: 'Using default trading parameters based on price movement only.'
        };
      }
    }
    
    try {
      // Construct a detailed prompt with market data
      let prompt = `Please provide a detailed analysis of the following market scenario:\n\n`;
      
      prompt += `Query: ${request.query}\n\n`;
      
      if (request.marketData) {
        prompt += `Market Data:\n${JSON.stringify(request.marketData, null, 2)}\n\n`;
      }
      
      if (request.tokenInfo) {
        prompt += `Token Information:\n${JSON.stringify(request.tokenInfo, null, 2)}\n\n`;
      }
      
      if (request.tradingHistory) {
        prompt += `Trading History:\n${JSON.stringify(request.tradingHistory, null, 2)}\n\n`;
      }
      
      prompt += `Based on this data, please provide:
1. A comprehensive market analysis
2. Trading recommendations (buy, sell, or hold)
3. Risk assessment (low, medium, or high)
4. Confidence level (0-1)
5. Key reasoning behind your analysis
Format your response as JSON with the following structure:
{
  "analysis": "Your detailed market analysis",
  "tradingRecommendation": "Buy/Sell/Hold",
  "riskLevel": "low/medium/high",
  "confidence": 0.XX,
  "reasoning": "Key factors supporting your analysis"
}`;
      
      const analysisText = await this.callPerplexityAPI(prompt);
      
      if (!analysisText) {
        logger.warn('Failed to get analysis from Perplexity API');
        return null;
      }
      
      // Extract JSON from response
      try {
        // Extract JSON from possible text wrapping
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : analysisText;
        
        const analysisData = JSON.parse(jsonString);
        
        return {
          analysis: analysisData.analysis,
          tradingRecommendation: analysisData.tradingRecommendation,
          riskLevel: analysisData.riskLevel as 'low' | 'medium' | 'high',
          confidence: analysisData.confidence,
          reasoning: analysisData.reasoning
        };
      } catch (jsonError: any) {
        logger.warn('Error parsing JSON from Perplexity response:', jsonError.message);
        
        // Return a formatted response using the raw text
        return {
          analysis: analysisText,
          confidence: 0.7
        };
      }
    } catch (error: any) {
      logger.error('Error analyzing market data with Perplexity:', error.message);
      return null;
    }
  }
  
  /**
   * Get trading strategy recommendations
   */
  public async getStrategyRecommendations(
    token: string,
    marketConditions: string,
    riskTolerance: 'low' | 'medium' | 'high'
  ): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
      
      if (!this.initialized) {
        logger.warn('Perplexity API not available for strategy recommendations, using default strategy');
        // Return a basic strategy recommendation
        return `
        Using default algorithmic strategy for ${token} with ${riskTolerance} risk tolerance.
        
        Strategy:
        1. Monitor price movements with standard technical indicators (RSI, MACD)
        2. Use trailing stop-loss based on market volatility
        3. Implement gradual position building rather than all-in approaches
        4. Monitor on-chain metrics for whale movements
        
        This is a conservative default strategy until AI analysis is available.
        `;
      }
    }
    
    const prompt = `I need detailed trading strategy recommendations for ${token} under the following market conditions: ${marketConditions}. My risk tolerance is ${riskTolerance}.
    
    Please provide:
    1. An optimal trading strategy with specific entry and exit points
    2. Risk management techniques appropriate for my risk tolerance
    3. Key indicators to monitor
    4. Potential catalysts that could affect this token
    
    Focus on practical, actionable advice based on current market data.`;
    
    return await this.callPerplexityAPI(prompt);
  }
  
  /**
   * Analyze on-chain metrics for a token
   */
  public async analyzeOnChainMetrics(
    token: string,
    metrics: any
  ): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
      
      if (!this.initialized) {
        logger.warn('Perplexity API not available for on-chain metrics analysis, using default analysis');
        // Return basic on-chain analysis
        let walletConcentration = 'medium';
        let volumeTrend = 'stable';
        
        // Simple algorithm analysis
        if (metrics && metrics.topWallets) {
          const topWalletsPercentage = metrics.topWallets.reduce((sum: number, wallet: any) => sum + wallet.percentage, 0);
          walletConcentration = topWalletsPercentage > 50 ? 'high' : (topWalletsPercentage > 30 ? 'medium' : 'low');
        }
        
        if (metrics && metrics.volumeHistory) {
          const recentVolumes = metrics.volumeHistory.slice(-7);
          const avgVolume = recentVolumes.reduce((sum: number, vol: number) => sum + vol, 0) / recentVolumes.length;
          const latestVolume = recentVolumes[recentVolumes.length - 1];
          volumeTrend = latestVolume > avgVolume * 1.2 ? 'increasing' : (latestVolume < avgVolume * 0.8 ? 'decreasing' : 'stable');
        }
        
        return `
        Basic on-chain analysis for ${token}:
        
        1. Wallet Concentration: ${walletConcentration}
        2. Transaction Volume Trend: ${volumeTrend}
        3. Smart Money Activity: Cannot determine without AI analysis
        4. Unusual Activity: Cannot determine without AI analysis
        
        This is a algorithmic analysis based on basic metrics pattern matching.
        For more detailed analysis, please ensure the Perplexity API is properly configured.
        `;
      }
    }
    
    const prompt = `Please analyze these on-chain metrics for ${token}:
    
    ${JSON.stringify(metrics, null, 2)}
    
    Provide insights on:
    1. Wallet concentration and major holders
    2. Transaction volume trends
    3. Smart money movements
    4. Any unusual on-chain activity
    5. What these metrics suggest about the token's future price movement`;
    
    return await this.callPerplexityAPI(prompt);
  }
  
  /**
   * Analyze arbitrage opportunity
   */
  public async analyzeArbitrageOpportunity(
    tokenA: string,
    tokenB: string,
    dexA: string,
    dexB: string,
    priceA: number,
    priceB: number,
    spreadPercentage: number
  ): Promise<PerplexityAnalysisResponse | null> {
    return await this.analyzeMarket({
      query: `Analyze this arbitrage opportunity: ${tokenA}/${tokenB} with ${spreadPercentage}% spread between ${dexA} (${priceA}) and ${dexB} (${priceB})`,
      marketData: {
        tokenA,
        tokenB,
        dexA,
        dexB,
        priceA,
        priceB,
        spreadPercentage
      }
    });
  }
}

// Create singleton instance
export const perplexityConnector = new PerplexityConnector();