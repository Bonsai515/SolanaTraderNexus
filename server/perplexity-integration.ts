/**
 * Perplexity AI Integration for Financial Market Analysis
 * 
 * This module provides integration with Perplexity API for advanced market analysis,
 * strategy recommendations, and token research. It enables AI-driven trading decisions
 * based on real-time market conditions.
 */

import axios from 'axios';
import { logger } from './logger';

interface PerplexityRequestMessage {
  role: string;
  content: string;
}

interface PerplexityRequest {
  model: string;
  messages: PerplexityRequestMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  search_domain_filter?: string[];
  return_images?: boolean;
  return_related_questions?: boolean;
  search_recency_filter?: string;
  top_k?: number;
  stream?: boolean;
  presence_penalty?: number;
  frequency_penalty?: number;
}

interface PerplexityResponse {
  id: string;
  model: string;
  object: string;
  created: number;
  citations: string[];
  choices: {
    index: number;
    finish_reason: string;
    message: {
      role: string;
      content: string;
    };
    delta: {
      role: string;
      content: string;
    };
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

class PerplexityAIIntegration {
  private apiKey: string | undefined;
  private apiEndpoint = 'https://api.perplexity.ai/chat/completions';
  private initialized = false;
  
  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY;
    this.initialized = !!this.apiKey;
    
    if (!this.initialized) {
      logger.warn('Perplexity API key not found. Market analysis features will be limited.');
    } else {
      logger.info('Perplexity AI integration initialized successfully.');
    }
  }
  
  /**
   * Check if the Perplexity integration is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Analyze a token for trading opportunities
   * @param tokenSymbol The token symbol to analyze
   * @returns Analysis of the token
   */
  public async analyzeToken(tokenSymbol: string): Promise<string> {
    if (!this.initialized) {
      logger.warn(`Perplexity API not initialized, using local market analysis for ${tokenSymbol}`);
      const { localMarketAnalysis } = require('./lib/localMarketAnalysis');
      return localMarketAnalysis.analyzeToken(tokenSymbol);
    }
    
    try {
      const messages: PerplexityRequestMessage[] = [
        {
          role: 'system',
          content: 'You are a cryptocurrency market analysis expert. Provide detailed analysis focused on specific facts, current price trends, market sentiment, and trading opportunities. Be precise and concise.'
        },
        {
          role: 'user',
          content: `Analyze the current market situation for ${tokenSymbol} token. What are the recent price movements, key support/resistance levels, and short-term trading opportunities?`
        }
      ];
      
      const response = await this.queryPerplexity(messages);
      return response;
    } catch (error) {
      logger.warn(`Error using Perplexity API for ${tokenSymbol}, falling back to local analysis:`, error);
      const { localMarketAnalysis } = require('./lib/localMarketAnalysis');
      return localMarketAnalysis.analyzeToken(tokenSymbol);
    }
  }
  
  /**
   * Get market sentiment for a specific token
   * @param tokenSymbol The token symbol to analyze
   * @returns Market sentiment analysis
   */
  public async getMarketSentiment(tokenSymbol: string): Promise<string> {
    if (!this.initialized) {
      logger.warn(`Perplexity API not initialized, using local market analysis for ${tokenSymbol} sentiment`);
      const { localMarketAnalysis } = require('./lib/localMarketAnalysis');
      return localMarketAnalysis.getMarketSentiment(tokenSymbol);
    }
    
    try {
      const messages: PerplexityRequestMessage[] = [
        {
          role: 'system',
          content: 'You are a cryptocurrency market sentiment analyst. Analyze current social media, news, and market data to provide a sentiment score and outlook. Be precise and factual.'
        },
        {
          role: 'user',
          content: `What is the current market sentiment for ${tokenSymbol}? Analyze recent news, social media trends, and on-chain metrics. Provide a sentiment score from 1-10 and justify it with specific recent events or metrics.`
        }
      ];
      
      const response = await this.queryPerplexity(messages);
      return response;
    } catch (error) {
      logger.warn(`Error using Perplexity API for ${tokenSymbol} sentiment, falling back to local analysis:`, error);
      const { localMarketAnalysis } = require('./lib/localMarketAnalysis');
      return localMarketAnalysis.getMarketSentiment(tokenSymbol);
    }
  }
  
  /**
   * Identify arbitrage opportunities across multiple markets
   * @returns Arbitrage opportunities
   */
  public async findArbitrageOpportunities(): Promise<string> {
    if (!this.initialized) {
      return 'Perplexity API not initialized. Please provide a valid API key.';
    }
    
    try {
      const messages: PerplexityRequestMessage[] = [
        {
          role: 'system',
          content: 'You are a cryptocurrency arbitrage expert. Identify specific arbitrage opportunities across exchanges with exact price differences. Only include real, current opportunities with significant spreads.'
        },
        {
          role: 'user',
          content: 'Identify the current top 3 most profitable arbitrage opportunities across major cryptocurrency exchanges for SOL, BONK, or JUP tokens. Include the exact current prices on each exchange, the percentage difference, and any key considerations like withdrawal fees or transfer times.'
        }
      ];
      
      const response = await this.queryPerplexity(messages);
      return response;
    } catch (error) {
      logger.error('Error finding arbitrage opportunities:', error);
      return 'Error finding arbitrage opportunities. Please try again later.';
    }
  }
  
  /**
   * Recommend trading strategies based on current market conditions
   * @returns Trading strategy recommendations
   */
  public async recommendTradingStrategies(): Promise<string> {
    if (!this.initialized) {
      return 'Perplexity API not initialized. Please provide a valid API key.';
    }
    
    try {
      const messages: PerplexityRequestMessage[] = [
        {
          role: 'system',
          content: 'You are a cryptocurrency trading strategy expert. Recommend specific, actionable trading strategies based on current market conditions with clear entry/exit points and risk management rules.'
        },
        {
          role: 'user',
          content: 'Based on the current market conditions, what are the most promising trading strategies for Solana-based tokens in the next 24-48 hours? Include specific tokens, entry and exit points, and risk management approaches.'
        }
      ];
      
      const response = await this.queryPerplexity(messages);
      return response;
    } catch (error) {
      logger.error('Error recommending trading strategies:', error);
      return 'Error recommending trading strategies. Please try again later.';
    }
  }
  
  /**
   * Query the Perplexity API with the given messages
   * @param messages The messages to send to Perplexity
   * @returns The response from Perplexity
   */
  private async queryPerplexity(messages: PerplexityRequestMessage[]): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Perplexity API key not found.');
    }
    
    // If the API key has changed since initialization, update the initialization state
    if (!this.initialized && this.apiKey) {
      this.initialized = true;
      logger.info('Perplexity API key now available, enabling advanced market analysis');
    }
    
    const request: PerplexityRequest = {
      model: 'llama-3.1-sonar-small-128k-online',
      messages,
      temperature: 0.2,
      top_p: 0.9,
      search_domain_filter: ['perplexity.ai'],
      return_images: false,
      return_related_questions: false,
      search_recency_filter: 'month',
      top_k: 0,
      stream: false,
      presence_penalty: 0,
      frequency_penalty: 1
    };
    
    try {
      // Add timeout and retry logic
      const maxRetries = 2;
      let retries = 0;
      let lastError = null;
      
      while (retries <= maxRetries) {
        try {
          const response = await axios.post<PerplexityResponse>(
            this.apiEndpoint,
            request,
            {
              headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
              },
              timeout: 15000 // 15 second timeout
            }
          );
          
          if (response.status === 200 && response.data?.choices?.[0]?.message?.content) {
            return response.data.choices[0].message.content;
          } else {
            throw new Error(`Unexpected response: ${response.status} ${JSON.stringify(response.data)}`);
          }
        } catch (error: any) {
          lastError = error;
          
          // Handle specific error cases
          if (error.response?.status === 401) {
            logger.error('Perplexity API authentication failed - invalid API key');
            // No need to retry on auth failures
            throw new Error('Invalid Perplexity API key. Please check your credentials.');
          } else if (error.response?.status === 429) {
            logger.warn('Perplexity API rate limit exceeded, retrying after delay');
            // Wait longer before retrying on rate limit errors
            await new Promise(resolve => setTimeout(resolve, (retries + 1) * 2000));
          } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            logger.warn(`Perplexity API request timed out (attempt ${retries + 1}/${maxRetries + 1})`);
            // For timeouts, retry with exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.min(retries * 1000, 5000)));
          } else {
            // For other errors, shorter retry
            await new Promise(resolve => setTimeout(resolve, 1000));
            logger.error(`Perplexity API error (attempt ${retries + 1}/${maxRetries + 1}):`, error.message);
          }
          
          retries++;
          
          // If this was the last retry, throw the error
          if (retries > maxRetries) {
            logger.error(`Failed to query Perplexity API after ${maxRetries + 1} attempts`);
            throw lastError;
          }
        }
      }
      
      // Should never reach here due to the throw in the last retry
      throw lastError || new Error('Unknown error querying Perplexity API');
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message || 'Unknown error';
      logger.error(`Error querying Perplexity API: ${errorMessage}`);
      throw error;
    }
  }
  
  /**
   * Update the API key
   * @param newApiKey The new API key to use
   * @returns True if the API key was successfully updated
   */
  public updateApiKey(newApiKey: string): boolean {
    if (!newApiKey || !newApiKey.startsWith('pplx-')) {
      logger.error('Invalid Perplexity API key format');
      return false;
    }
    
    try {
      this.apiKey = newApiKey;
      this.initialized = true;
      logger.info('Perplexity API key updated successfully');
      return true;
    } catch (error: any) {
      logger.error(`Failed to update Perplexity API key: ${error.message}`);
      return false;
    }
  }
}

// Export singleton instance
export const perplexityAI = new PerplexityAIIntegration();