/**
 * Perplexity API Service
 * Provides advanced market analysis and strategy optimization through Perplexity AI
 */

import rateLimiter from '../rpc/rateLimiter';

export class PerplexityService {
  private static instance: PerplexityService;
  private apiKey: string;
  private baseUrl: string = 'https://api.perplexity.ai';
  private model: string = 'llama-3.1-sonar-small-128k-online';
  
  private constructor() {
    this.apiKey = import.meta.env.VITE_PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('Perplexity API key not found. Market analysis capabilities will not be available.');
    } else {
      console.log('Perplexity API service initialized');
    }
  }
  
  /**
   * Get the PerplexityService instance (singleton)
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
   * Analyze market conditions using Perplexity AI
   */
  public async analyzeMarketConditions(marketData: any): Promise<MarketAnalysis> {
    if (!this.isAvailable()) {
      throw new Error('Perplexity service not available');
    }
    
    try {
      // Extract relevant data for the prompt
      const marketDataSummary = this.extractMarketDataSummary(marketData);
      
      // Create the prompt for the analysis
      const prompt = this.createMarketAnalysisPrompt(marketDataSummary);
      
      // Make the API call with rate limiting
      const response = await rateLimiter.queueHighPriority(async () => {
        return await this.callPerplexityAPI(prompt);
      });
      
      // Process the response into a structured analysis
      const analysis = this.processMarketAnalysisResponse(response);
      
      return analysis;
    } catch (error) {
      console.error('Error analyzing market conditions:', error);
      
      // Return a fallback analysis in case of error
      return {
        marketSentiment: 'neutral',
        confidence: 0,
        opportunities: [],
        risks: [],
        summary: 'Error occurred while analyzing market conditions',
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Optimize a trading strategy using Perplexity AI
   */
  public async optimizeStrategy(strategy: any, performanceHistory: any[] = []): Promise<StrategyOptimization> {
    if (!this.isAvailable()) {
      throw new Error('Perplexity service not available');
    }
    
    try {
      // Create the prompt for strategy optimization
      const prompt = this.createStrategyOptimizationPrompt(strategy, performanceHistory);
      
      // Make the API call with rate limiting
      const response = await rateLimiter.queueHighPriority(async () => {
        return await this.callPerplexityAPI(prompt);
      });
      
      // Process the response into a structured optimization
      const optimization = this.processStrategyOptimizationResponse(response);
      
      return optimization;
    } catch (error) {
      console.error('Error optimizing strategy:', error);
      
      // Return a fallback optimization in case of error
      return {
        parameterAdjustments: [],
        reasoning: 'Error occurred while optimizing strategy',
        confidence: 0,
        expectedImprovements: {
          winRate: 0,
          profitFactor: 0,
          drawdown: 0
        },
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Make an API call to Perplexity
   */
  private async callPerplexityAPI(prompt: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are a sophisticated crypto trading AI specialized in Solana market analysis. Respond with accurate and precise trading insights. Include quantitative metrics when possible. Format responses in clear, concise sections focusing on actionable insights.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.2,
          top_p: 0.9,
          frequency_penalty: 1,
          stream: false
        })
      });
      
      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.status} ${await response.text()}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error calling Perplexity API:', error);
      throw error;
    }
  }
  
  /**
   * Extract a summary of market data for the prompt
   */
  private extractMarketDataSummary(marketData: any): string {
    // In a real implementation, this would extract relevant data points
    // and format them into a concise summary for the prompt
    
    let summary = '';
    
    if (Array.isArray(marketData)) {
      // If it's an array of data points (e.g., historical data)
      const recentData = marketData.slice(-10); // Last 10 data points
      
      summary = `Recent market data (last 10 points):\n`;
      
      for (const dataPoint of recentData) {
        if (dataPoint.price && dataPoint.timestamp) {
          summary += `${new Date(dataPoint.timestamp).toISOString()}: $${dataPoint.price}\n`;
        }
      }
    } else if (typeof marketData === 'object') {
      // If it's a single object with various properties
      summary = `Current market data:\n`;
      
      if (marketData.pair) summary += `Pair: ${marketData.pair}\n`;
      if (marketData.price) summary += `Price: $${marketData.price}\n`;
      if (marketData.volume24h) summary += `24h Volume: $${marketData.volume24h}\n`;
      if (marketData.change24h) summary += `24h Change: ${marketData.change24h}%\n`;
      if (marketData.liquidityUSD) summary += `Liquidity: $${marketData.liquidityUSD}\n`;
      
      // Include any technical indicators if available
      if (marketData.indicators) {
        summary += `\nTechnical Indicators:\n`;
        
        for (const [key, value] of Object.entries(marketData.indicators)) {
          summary += `${key}: ${value}\n`;
        }
      }
    }
    
    return summary;
  }
  
  /**
   * Create a prompt for market analysis
   */
  private createMarketAnalysisPrompt(marketDataSummary: string): string {
    return `
Analyze the following Solana market data and provide insights:

${marketDataSummary}

Please provide a structured analysis including:
1. Overall market sentiment (bullish, bearish, or neutral)
2. Key trading opportunities with specific entry and exit points
3. Major risks and warning signs
4. A confidence score for your assessment (0-1)
5. A concise summary of your analysis

Format your response as JSON with the following structure:
{
  "sentiment": "bullish/bearish/neutral",
  "confidence": 0.8,
  "opportunities": [
    {
      "type": "entry/exit",
      "price": 123.45,
      "timeframe": "immediate/short-term/long-term",
      "reasoning": "Brief explanation"
    }
  ],
  "risks": [
    {
      "type": "price/liquidity/volatility",
      "severity": "low/medium/high",
      "description": "Brief explanation"
    }
  ],
  "summary": "Concise overall analysis"
}
`;
  }
  
  /**
   * Create a prompt for strategy optimization
   */
  private createStrategyOptimizationPrompt(strategy: any, performanceHistory: any[]): string {
    // Format the strategy details
    let strategyDetails = `
Strategy Name: ${strategy.name || 'Unnamed Strategy'}
Description: ${strategy.description || 'No description provided'}

Parameters:
`;
    
    if (strategy.parameters) {
      for (const [key, value] of Object.entries(strategy.parameters)) {
        strategyDetails += `- ${key}: ${value}\n`;
      }
    }
    
    strategyDetails += `\nEntry Conditions:\n`;
    
    if (Array.isArray(strategy.entryConditions)) {
      for (const condition of strategy.entryConditions) {
        strategyDetails += `- ${condition}\n`;
      }
    }
    
    strategyDetails += `\nExit Conditions:\n`;
    
    if (Array.isArray(strategy.exitConditions)) {
      for (const condition of strategy.exitConditions) {
        strategyDetails += `- ${condition}\n`;
      }
    }
    
    strategyDetails += `\nRisk Management:\n`;
    
    if (strategy.riskManagement) {
      for (const [key, value] of Object.entries(strategy.riskManagement)) {
        strategyDetails += `- ${key}: ${value}\n`;
      }
    }
    
    // Format performance history if available
    let performanceDetails = '';
    
    if (performanceHistory && performanceHistory.length > 0) {
      performanceDetails = `\nPerformance History:\n`;
      
      for (const performance of performanceHistory.slice(-10)) { // Last 10 performances
        performanceDetails += `- Date: ${new Date(performance.timestamp).toISOString()}\n`;
        performanceDetails += `  Profit/Loss: ${performance.profitLoss}\n`;
        performanceDetails += `  Win/Loss: ${performance.success ? 'Win' : 'Loss'}\n`;
        if (performance.notes) performanceDetails += `  Notes: ${performance.notes}\n`;
        performanceDetails += '\n';
      }
    }
    
    return `
Optimize the following trading strategy based on its performance history:

${strategyDetails}
${performanceDetails}

Please provide specific parameter adjustments to improve the strategy's performance.
Focus on improving win rate, profit factor, and reducing drawdown.

Format your response as JSON with the following structure:
{
  "adjustments": [
    {
      "parameter": "Parameter name",
      "currentValue": "Current value",
      "suggestedValue": "Suggested value",
      "reasoning": "Brief explanation"
    }
  ],
  "expectedImprovements": {
    "winRate": "+5%",
    "profitFactor": "+0.3",
    "drawdown": "-2%"
  },
  "confidence": 0.8,
  "reasoning": "Overall explanation of optimizations"
}
`;
  }
  
  /**
   * Process the response from market analysis
   */
  private processMarketAnalysisResponse(response: any): MarketAnalysis {
    try {
      // Extract the content from the response
      const content = response.choices[0].message.content;
      
      // Try to parse the JSON from the content
      let parsedContent;
      
      try {
        // Look for JSON in the content
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          parsedContent = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        console.warn('Error parsing JSON from Perplexity response:', parseError);
        
        // Extract information using regex as a fallback
        const sentimentMatch = content.match(/sentiment[\"']?\s*:\s*[\"']([^\"']+)[\"']/i);
        const confidenceMatch = content.match(/confidence[\"']?\s*:\s*([0-9.]+)/i);
        const summaryMatch = content.match(/summary[\"']?\s*:\s*[\"']([^\"']+)[\"']/i);
        
        parsedContent = {
          sentiment: sentimentMatch ? sentimentMatch[1].toLowerCase() : 'neutral',
          confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5,
          opportunities: [],
          risks: [],
          summary: summaryMatch ? summaryMatch[1] : 'No summary available'
        };
      }
      
      // Map the parsed content to our MarketAnalysis interface
      return {
        marketSentiment: parsedContent.sentiment || 'neutral',
        confidence: parsedContent.confidence || 0.5,
        opportunities: (parsedContent.opportunities || []).map((opp: any) => ({
          type: opp.type || 'unknown',
          price: opp.price || 0,
          timeframe: opp.timeframe || 'unknown',
          description: opp.reasoning || 'No description available'
        })),
        risks: (parsedContent.risks || []).map((risk: any) => ({
          type: risk.type || 'unknown',
          severity: risk.severity || 'medium',
          description: risk.description || 'No description available'
        })),
        summary: parsedContent.summary || 'No summary available',
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error processing market analysis response:', error);
      
      // Return a fallback analysis in case of error
      return {
        marketSentiment: 'neutral',
        confidence: 0,
        opportunities: [],
        risks: [],
        summary: 'Error processing market analysis response',
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Process the response from strategy optimization
   */
  private processStrategyOptimizationResponse(response: any): StrategyOptimization {
    try {
      // Extract the content from the response
      const content = response.choices[0].message.content;
      
      // Try to parse the JSON from the content
      let parsedContent;
      
      try {
        // Look for JSON in the content
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          parsedContent = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        console.warn('Error parsing JSON from Perplexity response:', parseError);
        
        // Extract information using regex as a fallback
        const confidenceMatch = content.match(/confidence[\"']?\s*:\s*([0-9.]+)/i);
        const reasoningMatch = content.match(/reasoning[\"']?\s*:\s*[\"']([^\"']+)[\"']/i);
        
        parsedContent = {
          adjustments: [],
          expectedImprovements: {
            winRate: '+0%',
            profitFactor: '+0',
            drawdown: '+0%'
          },
          confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5,
          reasoning: reasoningMatch ? reasoningMatch[1] : 'No reasoning available'
        };
      }
      
      // Map the parsed content to our StrategyOptimization interface
      return {
        parameterAdjustments: (parsedContent.adjustments || []).map((adj: any) => ({
          parameter: adj.parameter || 'unknown',
          currentValue: adj.currentValue || 'unknown',
          suggestedValue: adj.suggestedValue || 'unknown',
          reasoning: adj.reasoning || 'No reasoning available'
        })),
        reasoning: parsedContent.reasoning || 'No reasoning available',
        confidence: parsedContent.confidence || 0.5,
        expectedImprovements: {
          winRate: this.parsePercentageChange(parsedContent.expectedImprovements?.winRate || '+0%'),
          profitFactor: this.parseNumberChange(parsedContent.expectedImprovements?.profitFactor || '+0'),
          drawdown: this.parsePercentageChange(parsedContent.expectedImprovements?.drawdown || '+0%')
        },
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error processing strategy optimization response:', error);
      
      // Return a fallback optimization in case of error
      return {
        parameterAdjustments: [],
        reasoning: 'Error processing strategy optimization response',
        confidence: 0,
        expectedImprovements: {
          winRate: 0,
          profitFactor: 0,
          drawdown: 0
        },
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Parse a percentage change string into a number
   */
  private parsePercentageChange(percentageChange: string): number {
    try {
      const match = percentageChange.match(/([\+\-])?(\d+(?:\.\d+)?)%/);
      
      if (match) {
        const sign = match[1] === '-' ? -1 : 1;
        const value = parseFloat(match[2]);
        
        return sign * value / 100;
      }
      
      return 0;
    } catch (error) {
      return 0;
    }
  }
  
  /**
   * Parse a number change string into a number
   */
  private parseNumberChange(numberChange: string): number {
    try {
      const match = numberChange.match(/([\+\-])?(\d+(?:\.\d+)?)/);
      
      if (match) {
        const sign = match[1] === '-' ? -1 : 1;
        const value = parseFloat(match[2]);
        
        return sign * value;
      }
      
      return 0;
    } catch (error) {
      return 0;
    }
  }
}

/**
 * Market analysis interface
 */
export interface MarketAnalysis {
  marketSentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: number; // 0-1 scale
  opportunities: {
    type: string;
    price: number;
    timeframe: string;
    description: string;
  }[];
  risks: {
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }[];
  summary: string;
  timestamp: Date;
}

/**
 * Strategy optimization interface
 */
export interface StrategyOptimization {
  parameterAdjustments: {
    parameter: string;
    currentValue: string | number;
    suggestedValue: string | number;
    reasoning: string;
  }[];
  reasoning: string;
  confidence: number; // 0-1 scale
  expectedImprovements: {
    winRate: number;
    profitFactor: number;
    drawdown: number;
  };
  timestamp: Date;
}

// Create and export a singleton instance
const perplexityService = PerplexityService.getInstance();
export default perplexityService;