/**
 * Perplexity AI Service
 * Handles market analysis and strategy optimization using the Perplexity API
 */

interface PerplexityMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface PerplexityResponse {
  id: string;
  model: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  citations?: string[];
}

export class PerplexityService {
  private static instance: PerplexityService;
  private apiKey: string;
  private apiUrl: string = 'https://api.perplexity.ai/chat/completions';
  private defaultModel: string = 'llama-3.1-sonar-small-128k-online';
  
  private constructor() {
    this.apiKey = import.meta.env.VITE_PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('Perplexity API key not found. AI market analysis will not be available.');
    }
  }
  
  /**
   * Get the PerplexityService instance
   */
  public static getInstance(): PerplexityService {
    if (!PerplexityService.instance) {
      PerplexityService.instance = new PerplexityService();
    }
    
    return PerplexityService.instance;
  }
  
  /**
   * Check if the service is available
   */
  public isAvailable(): boolean {
    return !!this.apiKey;
  }
  
  /**
   * Send a request to the Perplexity API
   */
  private async sendRequest(messages: PerplexityMessage[], temperature: number = 0.2): Promise<PerplexityResponse> {
    if (!this.isAvailable()) {
      throw new Error('Perplexity API key not found');
    }
    
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.defaultModel,
          messages,
          temperature,
          max_tokens: 1024,
          top_p: 0.9,
          frequency_penalty: 1,
          presence_penalty: 0,
          stream: false
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Perplexity API error: ${response.status} ${error}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error calling Perplexity API:', error);
      throw error;
    }
  }
  
  /**
   * Analyze market conditions for trading strategy
   */
  public async analyzeMarketConditions(marketData: any): Promise<MarketAnalysis> {
    try {
      const messages: PerplexityMessage[] = [
        {
          role: 'system',
          content: 'You are an expert cryptocurrency market analyst with deep knowledge of Solana DeFi. Analyze the provided market data and identify trading opportunities. Be precise and quantitative in your assessment.'
        },
        {
          role: 'user',
          content: `Analyze the following market data and identify potential arbitrage opportunities, token launches, or market inefficiencies. Provide specific actionable insights and quantify potential profit margins where possible:\n\n${JSON.stringify(marketData, null, 2)}`
        }
      ];
      
      const response = await this.sendRequest(messages);
      
      // Parse the analysis from the response
      const analysis: MarketAnalysis = {
        timestamp: new Date(),
        summary: response.choices[0].message.content,
        opportunities: this.extractOpportunities(response.choices[0].message.content),
        riskFactor: this.extractRiskFactor(response.choices[0].message.content),
        marketSentiment: this.extractMarketSentiment(response.choices[0].message.content),
        citations: response.citations || []
      };
      
      return analysis;
    } catch (error) {
      console.error('Error analyzing market conditions:', error);
      
      // Return a fallback analysis
      return {
        timestamp: new Date(),
        summary: 'Unable to analyze market conditions due to API error',
        opportunities: [],
        riskFactor: 5,
        marketSentiment: 'neutral'
      };
    }
  }
  
  /**
   * Optimize a trading strategy
   */
  public async optimizeStrategy(strategy: any, performanceHistory: any[]): Promise<StrategyOptimization> {
    try {
      const messages: PerplexityMessage[] = [
        {
          role: 'system',
          content: 'You are an expert DeFi trading strategy optimizer. Analyze the provided strategy and its performance history, then suggest concrete improvements to increase profitability while managing risk.'
        },
        {
          role: 'user',
          content: `Optimize the following trading strategy based on its performance history. Suggest specific parameter adjustments, timing modifications, or other improvements to increase profitability while managing risk:\n\nStrategy:\n${JSON.stringify(strategy, null, 2)}\n\nPerformance History:\n${JSON.stringify(performanceHistory, null, 2)}`
        }
      ];
      
      const response = await this.sendRequest(messages, 0.3);
      
      // Parse the optimization from the response
      const optimization: StrategyOptimization = {
        timestamp: new Date(),
        summary: response.choices[0].message.content,
        parameterAdjustments: this.extractParameterAdjustments(response.choices[0].message.content, strategy),
        riskAssessment: this.extractRiskAssessment(response.choices[0].message.content),
        confidence: this.extractConfidence(response.choices[0].message.content)
      };
      
      return optimization;
    } catch (error) {
      console.error('Error optimizing strategy:', error);
      
      // Return a fallback optimization
      return {
        timestamp: new Date(),
        summary: 'Unable to optimize strategy due to API error',
        parameterAdjustments: [],
        riskAssessment: 'Unable to assess risk due to API error',
        confidence: 0
      };
    }
  }
  
  /**
   * Extract opportunities from analysis text
   */
  private extractOpportunities(analysisText: string): OpportunityInsight[] {
    // In a real implementation, this would parse the opportunities from the text
    // For simplicity, we'll return an empty array
    return [];
  }
  
  /**
   * Extract risk factor from analysis text
   */
  private extractRiskFactor(analysisText: string): number {
    // In a real implementation, this would parse the risk factor from the text
    // For simplicity, we'll return a default value
    return 5;
  }
  
  /**
   * Extract market sentiment from analysis text
   */
  private extractMarketSentiment(analysisText: string): 'bullish' | 'bearish' | 'neutral' {
    // In a real implementation, this would parse the market sentiment from the text
    // For simplicity, we'll return a default value
    return 'neutral';
  }
  
  /**
   * Extract parameter adjustments from optimization text
   */
  private extractParameterAdjustments(optimizationText: string, originalStrategy: any): ParameterAdjustment[] {
    // In a real implementation, this would parse the parameter adjustments from the text
    // For simplicity, we'll return an empty array
    return [];
  }
  
  /**
   * Extract risk assessment from optimization text
   */
  private extractRiskAssessment(optimizationText: string): string {
    // In a real implementation, this would parse the risk assessment from the text
    // For simplicity, we'll return a default value
    return 'Moderate risk with potential for high reward';
  }
  
  /**
   * Extract confidence from optimization text
   */
  private extractConfidence(optimizationText: string): number {
    // In a real implementation, this would parse the confidence from the text
    // For simplicity, we'll return a default value
    return 0.75;
  }
}

/**
 * Market analysis interface
 */
export interface MarketAnalysis {
  timestamp: Date;
  summary: string;
  opportunities: OpportunityInsight[];
  riskFactor: number; // 1-10 scale
  marketSentiment: 'bullish' | 'bearish' | 'neutral';
  citations?: string[];
}

/**
 * Opportunity insight interface
 */
export interface OpportunityInsight {
  type: 'arbitrage' | 'token_launch' | 'market_inefficiency';
  description: string;
  estimatedProfitPercent: number;
  confidence: number; // 0-1 scale
  timeframe: string;
}

/**
 * Strategy optimization interface
 */
export interface StrategyOptimization {
  timestamp: Date;
  summary: string;
  parameterAdjustments: ParameterAdjustment[];
  riskAssessment: string;
  confidence: number; // 0-1
}

/**
 * Parameter adjustment interface
 */
export interface ParameterAdjustment {
  parameter: string;
  originalValue: any;
  suggestedValue: any;
  reasoning: string;
  estimatedImpact: number; // percentage improvement
}

// Create and export a singleton instance
const perplexityService = PerplexityService.getInstance();
export default perplexityService;