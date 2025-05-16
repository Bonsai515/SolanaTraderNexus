/**
 * Perplexity AI Service
 * Provides AI-powered analysis and insights for trading strategies
 */

import axios from 'axios';
import { logger } from '../logger';
import { MarketData } from '../../shared/signalTypes';

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

export class PerplexityService {
  private static instance: PerplexityService | null = null;
  private apiKey: string;
  private baseUrl: string = 'https://api.perplexity.ai/chat/completions';
  private model: string = 'llama-3.1-sonar-small-128k-online';

  private constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY || '';
    
    if (!this.apiKey) {
      logger.warn('Perplexity API key not set. AI-powered analytics will be limited.');
    } else {
      logger.info('Perplexity AI service initialized successfully');
    }
  }
  
  /**
   * Parse a potentially markdown-formatted JSON response
   * @param completion The raw text completion from Perplexity
   * @returns Parsed JSON object or error object
   */
  private parseJsonResponse(completion: string): any {
    try {
      // Check if the response starts with a markdown code block
      const jsonMatch = completion.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch && jsonMatch[1]) {
        // Extract JSON from markdown code block
        return JSON.parse(jsonMatch[1].trim());
      } else {
        // Try to parse directly
        return JSON.parse(completion);
      }
    } catch (parseError) {
      logger.error('Error parsing Perplexity AI response:', parseError);
      
      // Try again with a more aggressive approach
      try {
        // Remove all backticks, "json" words, and try to find a valid JSON substring
        const sanitized = completion.replace(/```json|```/g, '').trim();
        // Find the first '{' and the last '}'
        const firstBrace = sanitized.indexOf('{');
        const lastBrace = sanitized.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          const jsonSubstring = sanitized.substring(firstBrace, lastBrace + 1);
          return JSON.parse(jsonSubstring);
        }
      } catch (secondError) {
        // If all parsing attempts fail, return error
      }
      
      return {
        error: "Failed to parse AI response",
        raw_response: completion
      };
    }
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): PerplexityService {
    if (!this.instance) {
      this.instance = new PerplexityService();
    }
    return this.instance;
  }

  /**
   * Check if the service is available
   */
  public isAvailable(): boolean {
    return !!this.apiKey;
  }

  /**
   * Generate a chat completion
   */
  private async generateCompletion(
    systemPrompt: string,
    userPrompt: string
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Perplexity API key not set. Cannot generate completion.');
    }

    try {
      logger.info(`Sending request to Perplexity API...`);
      
      // Set a timeout for the API request
      const timeout = 30000; // 30 seconds
      
      const response = await axios.post<PerplexityResponse>(
        this.baseUrl,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: userPrompt
            }
          ],
          temperature: 0.2,
          top_p: 0.9,
          max_tokens: 1024
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: timeout
        }
      );

      logger.info(`Received response from Perplexity API`);
      
      if (!response.data || !response.data.choices || response.data.choices.length === 0) {
        throw new Error('Invalid response from Perplexity API: No completion choices returned');
      }
      
      return response.data.choices[0].message.content;
    } catch (error) {
      if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
        logger.error('Timeout error connecting to Perplexity API:', error);
        throw new Error('Connection to Perplexity API timed out. Please try again later.');
      } else if (axios.isAxiosError(error) && error.response) {
        // API responded with an error
        logger.error(`Perplexity API error (${error.response.status}):`, error.response.data);
        throw new Error(`Perplexity API error (${error.response.status}): ${JSON.stringify(error.response.data)}`);
      } else {
        // Network error or other issue
        logger.error('Error generating Perplexity AI completion:', error);
        throw new Error(`Failed to generate AI completion: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Generate trading insights for a specific pair
   * @param pair The trading pair
   * @param marketData Market data for the pair
   */
  public async generateMarketInsights(
    pair: string,
    marketData: MarketData
  ): Promise<any> {
    if (!this.isAvailable()) {
      throw new Error('Perplexity AI service not available');
    }

    try {
      const systemPrompt = `You are an expert cryptocurrency trading analyst specializing in Solana tokens and DeFi. 
Your task is to analyze trading data and provide advanced market insights and accurate predictions.
Respond with JSON only containing the following structure:
{
  "price_analysis": {
    "trend": "bullish/bearish/neutral",
    "key_levels": {
      "support": [list of key support levels],
      "resistance": [list of key resistance levels]
    },
    "momentum": "increasing/decreasing/stable"
  },
  "volume_analysis": {
    "trend": "increasing/decreasing/stable",
    "unusual_activity": true/false,
    "analysis": "brief analysis of volume patterns"
  },
  "pattern_recognition": {
    "identified_patterns": [list of technical patterns identified],
    "significance": "explanation of pattern significance"
  },
  "predicted_movements": {
    "short_term": {
      "direction": "up/down/sideways",
      "target_price": number,
      "confidence": number (0-100),
      "timeframe": "hours/days"
    },
    "medium_term": {
      "direction": "up/down/sideways",
      "target_price": number,
      "confidence": number (0-100),
      "timeframe": "days/weeks"
    }
  },
  "trading_recommendation": {
    "action": "buy/sell/hold",
    "strength": "strong/moderate/weak",
    "entry_points": [suggested entry prices],
    "stop_loss": number,
    "take_profit": [suggested take profit levels],
    "risk_reward_ratio": number
  },
  "overall_sentiment": {
    "score": number (0-100),
    "description": "brief explanation"
  }
}
`;

      // Prepare market data
      const priceDataFormatted = marketData.prices.map(p => `[${p[0]}, ${p[1]}]`).join(', ');
      const volumeDataFormatted = marketData.volumes.map(v => `[${v[0]}, ${v[1]}]`).join(', ');
      
      const userPrompt = `Analyze the following market data for ${pair}:
- Current price: ${marketData.currentPrice}
- 24hr volume: ${marketData.volume24h}
- 24hr price change: ${marketData.priceChange24h} (${marketData.priceChangePct24h}%)
- 24hr high: ${marketData.highPrice24h}
- 24hr low: ${marketData.lowPrice24h}
- Historical price data: [${priceDataFormatted}]
- Historical volume data: [${volumeDataFormatted}]
- Source: ${marketData.source}
- Last updated: ${marketData.lastUpdated}

Provide JSON-formatted analysis using the structure specified.`;

      const completion = await this.generateCompletion(systemPrompt, userPrompt);
      
      try {
        return JSON.parse(completion);
      } catch (parseError) {
        logger.error('Error parsing Perplexity AI response:', parseError);
        return {
          error: "Failed to parse AI response",
          raw_response: completion
        };
      }
    } catch (error) {
      logger.error('Error generating market insights:', error);
      throw new Error(`Failed to generate market insights: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate strategy recommendations based on signals
   * @param signals Array of trading signals
   */
  public async generateStrategyRecommendations(signals: any[]): Promise<any> {
    if (!this.isAvailable()) {
      throw new Error('Perplexity AI service not available');
    }

    try {
      const systemPrompt = `You are an expert cryptocurrency trading strategist with deep knowledge of algorithmic trading on Solana. 
Your task is to analyze trading signals and recommend optimal strategies.
Respond with JSON only containing the following structure:
{
  "strategy_recommendations": [
    {
      "name": "strategy name",
      "description": "brief strategy description",
      "signal_correlation": number (0-100),
      "recommended_pairs": [trading pairs],
      "execution_parameters": {
        "entry_conditions": "description",
        "exit_conditions": "description",
        "position_sizing": "description",
        "risk_management": "description"
      },
      "expected_performance": {
        "win_rate": number (0-100),
        "risk_reward": number,
        "expected_return": number
      },
      "confidence": number (0-100)
    }
  ],
  "market_conditions": {
    "assessment": "description of current market conditions",
    "volatility": "high/medium/low",
    "liquidity": "high/medium/low"
  },
  "risk_assessment": {
    "overall_risk": "high/medium/low",
    "specific_risks": [list of specific risks]
  }
}
`;

      const userPrompt = `Analyze the following trading signals:
${JSON.stringify(signals, null, 2)}

Generate JSON-formatted strategy recommendations using the structure specified.`;

      const completion = await this.generateCompletion(systemPrompt, userPrompt);
      
      try {
        return JSON.parse(completion);
      } catch (parseError) {
        logger.error('Error parsing Perplexity AI response:', parseError);
        return {
          error: "Failed to parse AI response",
          raw_response: completion
        };
      }
    } catch (error) {
      logger.error('Error generating strategy recommendations:', error);
      throw new Error(`Failed to generate strategy recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze token fundamentals (tokenomics, community sentiment, etc.)
   * @param token The token symbol or name
   */
  public async analyzeTokenFundamentals(token: string): Promise<any> {
    if (!this.isAvailable()) {
      throw new Error('Perplexity AI service not available');
    }

    try {
      const systemPrompt = `You are an expert cryptocurrency analyst with deep knowledge of Solana ecosystem tokens.
Your task is to provide a comprehensive analysis of token fundamentals.
Respond with JSON only containing the following structure:
{
  "token_info": {
    "name": "full token name",
    "symbol": "token symbol",
    "category": "token category (meme, defi, gaming, etc.)",
    "blockchain": "primary blockchain",
    "contract_security": "assessment of contract security",
    "age": "time since launch"
  },
  "tokenomics": {
    "total_supply": "token supply information",
    "circulating_supply": "current circulating supply",
    "distribution": {
      "team": "percentage",
      "investors": "percentage",
      "community": "percentage",
      "other": "percentage"
    },
    "inflation_rate": "annual inflation rate",
    "burn_mechanisms": "description of any burn mechanisms"
  },
  "market_position": {
    "market_cap": "approximate market cap",
    "rank": "market cap rank",
    "liquidity": "assessment of token liquidity",
    "trading_volume_trend": "increasing/decreasing/stable"
  },
  "community_and_social": {
    "community_strength": "assessment of community strength",
    "social_sentiment": "positive/negative/neutral",
    "social_volume": "high/medium/low",
    "developer_activity": "high/medium/low"
  },
  "use_case_and_utility": {
    "primary_use_case": "description of primary use case",
    "real_world_applications": "description of applications",
    "adoption_metrics": "assessment of adoption"
  },
  "risk_assessment": {
    "overall_risk": "high/medium/low",
    "specific_risks": [list of specific risks],
    "regulatory_concerns": "description of any regulatory concerns"
  },
  "investment_outlook": {
    "short_term": "positive/negative/neutral",
    "long_term": "positive/negative/neutral",
    "key_catalysts": [list of potential catalysts],
    "key_risks": [list of potential risks]
  }
}
`;

      const userPrompt = `Provide a comprehensive analysis of the ${token} token on Solana.
Generate JSON-formatted token fundamental analysis using the structure specified.`;

      const completion = await this.generateCompletion(systemPrompt, userPrompt);
      
      try {
        return JSON.parse(completion);
      } catch (parseError) {
        logger.error('Error parsing Perplexity AI response:', parseError);
        return {
          error: "Failed to parse AI response",
          raw_response: completion
        };
      }
    } catch (error) {
      logger.error('Error analyzing token fundamentals:', error);
      throw new Error(`Failed to analyze token fundamentals: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton getter
export const getPerplexityService = (): PerplexityService => {
  return PerplexityService.getInstance();
};