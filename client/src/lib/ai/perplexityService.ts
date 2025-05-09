/**
 * Perplexity AI Service for Strategy Analysis
 * 
 * This service integrates with Perplexity's AI to analyze market data,
 * enhance trading strategies, and provide intelligent insights.
 */

export interface PerplexityOptions {
  model?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  presence_penalty?: number; 
  frequency_penalty?: number;
}

export interface PerplexityMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface PerplexityRequest {
  model: string;
  messages: PerplexityMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  presence_penalty?: number;
  frequency_penalty?: number;
  return_images?: boolean;
  return_related_questions?: boolean;
}

export interface PerplexityCitation {
  url: string;
}

export interface PerplexityResponse {
  id: string;
  model: string;
  object: string;
  created: number;
  citations: PerplexityCitation[];
  choices: Array<{
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
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface MarketDataPoint {
  timestamp: string;
  price: number;
  volume: number;
  volatility?: number;
  rsi?: number;
  macd?: number;
  sentiment?: number;
}

export interface StrategyAnalysisResult {
  recommendation: string;
  confidence: number;
  reasoning: string;
  insights: string[];
  suggested_parameters?: Record<string, any>;
  risk_assessment: {
    level: 'low' | 'moderate' | 'high' | 'extreme';
    description: string;
  };
  citations?: string[];
}

const DEFAULT_OPTIONS: PerplexityOptions = {
  model: 'llama-3.1-sonar-small-128k-online',
  temperature: 0.2,
  top_p: 0.9,
  presence_penalty: 0,
  frequency_penalty: 1,
  stream: false
};

export class PerplexityService {
  private apiKey: string;
  private defaultOptions: PerplexityOptions;
  private baseUrl = 'https://api.perplexity.ai/chat/completions';

  constructor(apiKey: string, options: PerplexityOptions = {}) {
    this.apiKey = apiKey;
    this.defaultOptions = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Analyze trading strategy with market data
   * Uses Perplexity's advanced AI to evaluate performance and suggest improvements
   */
  async analyzeStrategy(
    strategyName: string, 
    strategyType: string,
    pair: string,
    marketData: MarketDataPoint[],
    currentParameters: Record<string, any>,
    pastPerformance?: {
      profit: number;
      win_rate: number;
      transaction_count: number;
      time_period: string;
    }
  ): Promise<StrategyAnalysisResult> {
    const systemPrompt = `You are a quantum-inspired AI financial analyst specializing in cryptocurrency markets on Solana blockchain.
Analyze the provided trading strategy and market data to give insights with the following priorities:
1. Identify clear patterns and anomalies in the market data
2. Assess if the current strategy parameters are optimal
3. Make specific recommendations for parameter adjustments
4. Provide risk assessment based on volatility and market conditions
Be precise, quantitative, and focus on actionable insights.`;

    const marketDataSummary = this.summarizeMarketData(marketData);

    let userPrompt = `Please analyze the following trading strategy for ${pair}:
Strategy Name: ${strategyName}
Strategy Type: ${strategyType}
Current Parameters: ${JSON.stringify(currentParameters, null, 2)}

Market Data Summary:
${marketDataSummary}`;

    if (pastPerformance) {
      userPrompt += `\nPast Performance:
- Profit: ${pastPerformance.profit.toFixed(2)}%
- Win Rate: ${pastPerformance.win_rate.toFixed(2)}%
- Transactions: ${pastPerformance.transaction_count}
- Time Period: ${pastPerformance.time_period}`;
    }

    userPrompt += `\n\nPlease provide:
1. Overall assessment of this strategy given recent market conditions
2. Specific parameter adjustments that could improve performance
3. Risk level assessment (low/moderate/high/extreme) with explanation
4. Any critical insights about market patterns that this strategy could leverage`;

    try {
      const messages: PerplexityMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      const response = await this.callPerplexityAPI(messages);
      return this.parseAnalysisResponse(response);
    } catch (error) {
      console.error('Error analyzing strategy with Perplexity AI:', error);
      throw new Error(`Failed to analyze strategy: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Generate insights from recent market activity
   * Creates intelligent observations about market trends, anomalies, and opportunities
   */
  async generateMarketInsights(
    pair: string,
    timeframe: string,
    marketData: MarketDataPoint[]
  ): Promise<string[]> {
    const systemPrompt = `You are a quantum-inspired AI market analyst specializing in cryptocurrency analysis.
Focus on identifying clear patterns, anomalies, support/resistance levels, and trading opportunities in the provided data.
Be precise, quantitative, and highlight only the most significant insights that could lead to profitable trading opportunities.`;

    const marketDataSummary = this.summarizeMarketData(marketData);

    const userPrompt = `Please analyze the following market data for ${pair} on a ${timeframe} timeframe:

${marketDataSummary}

Identify the most important insights, patterns, and trading opportunities from this data. Focus on:
1. Price action patterns
2. Volume anomalies
3. Technical indicator signals
4. Support and resistance levels
5. Breakout or breakdown potential
6. Volatility patterns

Provide each insight as a separate point, ranked by importance for trading decisions.`;

    try {
      const messages: PerplexityMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      const response = await this.callPerplexityAPI(messages);
      const content = response.choices[0].message.content;
      
      // Extract insights as separate points
      const insights = content
        .split(/\d+\./)
        .filter(line => line.trim().length > 0)
        .map(line => line.trim());
      
      return insights;
    } catch (error) {
      console.error('Error generating market insights with Perplexity AI:', error);
      throw new Error(`Failed to generate market insights: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Convert market data to a summarized format for the AI
   */
  private summarizeMarketData(marketData: MarketDataPoint[]): string {
    if (!marketData || marketData.length === 0) {
      return 'No market data available';
    }

    // Get first and last points for timeframe
    const startTime = new Date(marketData[0].timestamp);
    const endTime = new Date(marketData[marketData.length - 1].timestamp);
    
    // Calculate key metrics
    const currentPrice = marketData[marketData.length - 1].price;
    const startPrice = marketData[0].price;
    const percentChange = ((currentPrice - startPrice) / startPrice) * 100;
    
    // Calculate average volume
    const averageVolume = marketData.reduce((sum, point) => sum + point.volume, 0) / marketData.length;
    
    // Find min/max values
    const prices = marketData.map(point => point.price);
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    
    // Calculate volatility if not provided
    let avgVolatility = 'N/A';
    if (marketData[0].volatility !== undefined) {
      avgVolatility = (marketData.reduce((sum, point) => sum + (point.volatility || 0), 0) / marketData.length).toFixed(2);
    }
    
    // Create summary
    let summary = `Timeframe: ${startTime.toISOString()} to ${endTime.toISOString()}
Data Points: ${marketData.length}
Price Range: ${minPrice.toFixed(2)} to ${maxPrice.toFixed(2)}
Current Price: ${currentPrice.toFixed(2)}
Price Change: ${percentChange.toFixed(2)}%
Average Volume: ${Math.round(averageVolume).toLocaleString()}
Average Volatility: ${avgVolatility}

Recent Price Action:`;

    // Add most recent price points (last 5)
    const recentPoints = marketData.slice(-5);
    recentPoints.forEach(point => {
      const date = new Date(point.timestamp);
      summary += `\n${date.toISOString()}: $${point.price.toFixed(2)}, Vol: ${Math.round(point.volume).toLocaleString()}`;
    });
    
    return summary;
  }

  /**
   * Make the actual API call to Perplexity
   */
  private async callPerplexityAPI(messages: PerplexityMessage[]): Promise<PerplexityResponse> {
    if (!this.apiKey) {
      throw new Error('Perplexity API key is not set');
    }

    const requestBody: PerplexityRequest = {
      model: this.defaultOptions.model || DEFAULT_OPTIONS.model,
      messages,
      temperature: this.defaultOptions.temperature,
      top_p: this.defaultOptions.top_p,
      presence_penalty: this.defaultOptions.presence_penalty,
      frequency_penalty: this.defaultOptions.frequency_penalty,
      stream: false,
      return_images: false,
      return_related_questions: false,
    };

    if (this.defaultOptions.max_tokens) {
      requestBody.max_tokens = this.defaultOptions.max_tokens;
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity API error (${response.status}): ${errorText}`);
    }

    return await response.json() as PerplexityResponse;
  }

  /**
   * Parse the AI response into a structured analysis result
   */
  private parseAnalysisResponse(response: PerplexityResponse): StrategyAnalysisResult {
    const content = response.choices[0].message.content;
    
    // Extract the main sections using a simple heuristic approach
    // In a real implementation, this would use more robust parsing
    const confidenceMatch = content.match(/confidence[:\s]+(\d+(?:\.\d+)?%?)/i);
    const confidence = confidenceMatch 
      ? parseFloat(confidenceMatch[1].replace('%', '')) / 100
      : 0.7; // default if not found
    
    // Extract risk level
    let riskLevel: 'low' | 'moderate' | 'high' | 'extreme' = 'moderate';
    if (content.match(/risk[:\s]+high/i) || content.match(/high risk/i)) {
      riskLevel = 'high';
    } else if (content.match(/risk[:\s]+low/i) || content.match(/low risk/i)) {
      riskLevel = 'low';
    } else if (content.match(/risk[:\s]+extreme/i) || content.match(/extreme risk/i)) {
      riskLevel = 'extreme';
    }
    
    // Extract risk description - find sentence containing risk assessment
    const riskMatch = content.match(/risk[^.!?]*[.!?]/i);
    const riskDescription = riskMatch ? riskMatch[0].trim() : 'Moderate risk based on current market conditions.';
    
    // Extract insights by looking for numbered points or bullet points
    const insightsRegex = /(?:\d+\.\s*|\*\s*|\-\s*)([^.!?]*(?:[.!?][^.!?]*)*[.!?])/g;
    const insights: string[] = [];
    let insightMatch;
    while ((insightMatch = insightsRegex.exec(content)) !== null) {
      insights.push(insightMatch[1].trim());
    }
    
    // Fallback if no insights found
    if (insights.length === 0) {
      // Split content by sentences and take a few as insights
      const sentences = content.match(/[^.!?]*[.!?]/g) || [];
      for (let i = 0; i < Math.min(3, sentences.length); i++) {
        if (sentences[i].trim().length > 10) { // Avoid very short sentences
          insights.push(sentences[i].trim());
        }
      }
    }
    
    // Create the final result
    const result: StrategyAnalysisResult = {
      recommendation: content.substring(0, 200) + '...', // First part of the content as recommendation
      confidence,
      reasoning: content,
      insights: insights.slice(0, 5), // Take up to 5 insights
      risk_assessment: {
        level: riskLevel,
        description: riskDescription
      },
      citations: response.citations ? response.citations.map(c => c.url) : undefined
    };
    
    return result;
  }
}

// Create and export a singleton instance
export default function getPerplexityService(): PerplexityService {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY environment variable is not set');
  }
  
  return new PerplexityService(apiKey);
}