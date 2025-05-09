/**
 * DeepSeek AI Service
 * Handles pattern recognition and predictive analysis for trading strategies
 */

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    logprobs: any | null;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class DeepSeekService {
  private static instance: DeepSeekService;
  private apiKey: string;
  private apiUrl: string = 'https://api.deepseek.com/v1/chat/completions';
  private defaultModel: string = 'deepseek-coder-v2';
  
  private constructor() {
    this.apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('DeepSeek API key not found. AI pattern recognition will not be available.');
    }
  }
  
  /**
   * Get the DeepSeekService instance
   */
  public static getInstance(): DeepSeekService {
    if (!DeepSeekService.instance) {
      DeepSeekService.instance = new DeepSeekService();
    }
    
    return DeepSeekService.instance;
  }
  
  /**
   * Check if the service is available
   */
  public isAvailable(): boolean {
    return !!this.apiKey;
  }
  
  /**
   * Send a request to the DeepSeek API
   */
  private async sendRequest(messages: DeepSeekMessage[], temperature: number = 0.3): Promise<DeepSeekResponse> {
    if (!this.isAvailable()) {
      throw new Error('DeepSeek API key not found');
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
          top_p: 0.9
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`DeepSeek API error: ${response.status} ${error}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error calling DeepSeek API:', error);
      throw error;
    }
  }
  
  /**
   * Detect trading patterns in historical data
   */
  public async detectPatterns(historicalData: any[]): Promise<PatternAnalysis> {
    try {
      const messages: DeepSeekMessage[] = [
        {
          role: 'system',
          content: 'You are an expert in pattern recognition for cryptocurrency markets, with specific expertise in Solana DeFi. Analyze historical data to identify repeating patterns, correlations, and potential future price movements. Be precise and quantitative in your analysis.'
        },
        {
          role: 'user',
          content: `Analyze the following historical trading data to identify patterns and predictive indicators. Identify specific recurring patterns, potential signals for future price movements, and quantify the reliability of these patterns:\n\n${JSON.stringify(historicalData, null, 2)}`
        }
      ];
      
      const response = await this.sendRequest(messages);
      
      // Parse the analysis from the response
      const analysis: PatternAnalysis = {
        timestamp: new Date(),
        summary: response.choices[0].message.content,
        patterns: this.extractPatterns(response.choices[0].message.content),
        indicators: this.extractIndicators(response.choices[0].message.content),
        reliability: this.extractReliability(response.choices[0].message.content),
        predictedMovements: this.extractPredictedMovements(response.choices[0].message.content)
      };
      
      return analysis;
    } catch (error) {
      console.error('Error detecting patterns:', error);
      
      // Return a fallback analysis
      return {
        timestamp: new Date(),
        summary: 'Unable to detect patterns due to API error',
        patterns: [],
        indicators: [],
        reliability: 0,
        predictedMovements: []
      };
    }
  }
  
  /**
   * Generate trading strategy based on pattern analysis
   */
  public async generateStrategy(patternAnalysis: PatternAnalysis, constraints: StrategyConstraints): Promise<GeneratedStrategy> {
    try {
      const messages: DeepSeekMessage[] = [
        {
          role: 'system',
          content: 'You are an expert in cryptocurrency trading strategy development with deep knowledge of Solana DeFi. Create optimized trading strategies based on pattern analysis and user constraints. Your strategies should be detailed, actionable, and include specific parameters and logic.'
        },
        {
          role: 'user',
          content: `Generate a trading strategy based on the following pattern analysis and constraints. The strategy should be detailed, include specific entry and exit conditions, risk management rules, and parameter values.\n\nPattern Analysis:\n${JSON.stringify(patternAnalysis, null, 2)}\n\nConstraints:\n${JSON.stringify(constraints, null, 2)}`
        }
      ];
      
      const response = await this.sendRequest(messages, 0.4);
      
      // Parse the strategy from the response
      const strategy: GeneratedStrategy = {
        timestamp: new Date(),
        name: this.extractStrategyName(response.choices[0].message.content),
        description: this.extractStrategyDescription(response.choices[0].message.content),
        entryConditions: this.extractEntryConditions(response.choices[0].message.content),
        exitConditions: this.extractExitConditions(response.choices[0].message.content),
        parameters: this.extractParameters(response.choices[0].message.content),
        riskManagement: this.extractRiskManagement(response.choices[0].message.content),
        expectedPerformance: this.extractExpectedPerformance(response.choices[0].message.content),
        fullStrategyText: response.choices[0].message.content
      };
      
      return strategy;
    } catch (error) {
      console.error('Error generating strategy:', error);
      
      // Return a fallback strategy
      return {
        timestamp: new Date(),
        name: 'Error Strategy',
        description: 'Unable to generate strategy due to API error',
        entryConditions: [],
        exitConditions: [],
        parameters: {},
        riskManagement: {
          stopLoss: 0,
          takeProfit: 0,
          positionSizing: 'Unable to determine position sizing'
        },
        expectedPerformance: {
          winRate: 0,
          profitFactor: 0,
          drawdown: 0
        },
        fullStrategyText: 'Unable to generate strategy due to API error'
      };
    }
  }
  
  /**
   * Extract patterns from the analysis text
   */
  private extractPatterns(analysisText: string): Pattern[] {
    // In a real implementation, this would parse the patterns from the text
    // For simplicity, we'll return an empty array
    return [];
  }
  
  /**
   * Extract indicators from the analysis text
   */
  private extractIndicators(analysisText: string): Indicator[] {
    // In a real implementation, this would parse the indicators from the text
    // For simplicity, we'll return an empty array
    return [];
  }
  
  /**
   * Extract reliability from the analysis text
   */
  private extractReliability(analysisText: string): number {
    // In a real implementation, this would parse the reliability from the text
    // For simplicity, we'll return a default value
    return 0.7;
  }
  
  /**
   * Extract predicted movements from the analysis text
   */
  private extractPredictedMovements(analysisText: string): PredictedMovement[] {
    // In a real implementation, this would parse the predicted movements from the text
    // For simplicity, we'll return an empty array
    return [];
  }
  
  /**
   * Extract strategy name from the strategy text
   */
  private extractStrategyName(strategyText: string): string {
    // In a real implementation, this would parse the strategy name from the text
    // For simplicity, we'll return a default value
    return 'AI-Generated Strategy';
  }
  
  /**
   * Extract strategy description from the strategy text
   */
  private extractStrategyDescription(strategyText: string): string {
    // In a real implementation, this would parse the strategy description from the text
    // For simplicity, we'll return a default value
    return 'Strategy generated based on pattern analysis';
  }
  
  /**
   * Extract entry conditions from the strategy text
   */
  private extractEntryConditions(strategyText: string): string[] {
    // In a real implementation, this would parse the entry conditions from the text
    // For simplicity, we'll return an empty array
    return [];
  }
  
  /**
   * Extract exit conditions from the strategy text
   */
  private extractExitConditions(strategyText: string): string[] {
    // In a real implementation, this would parse the exit conditions from the text
    // For simplicity, we'll return an empty array
    return [];
  }
  
  /**
   * Extract parameters from the strategy text
   */
  private extractParameters(strategyText: string): Record<string, any> {
    // In a real implementation, this would parse the parameters from the text
    // For simplicity, we'll return an empty object
    return {};
  }
  
  /**
   * Extract risk management from the strategy text
   */
  private extractRiskManagement(strategyText: string): RiskManagement {
    // In a real implementation, this would parse the risk management from the text
    // For simplicity, we'll return default values
    return {
      stopLoss: 5,
      takeProfit: 15,
      positionSizing: '2% of portfolio per trade'
    };
  }
  
  /**
   * Extract expected performance from the strategy text
   */
  private extractExpectedPerformance(strategyText: string): ExpectedPerformance {
    // In a real implementation, this would parse the expected performance from the text
    // For simplicity, we'll return default values
    return {
      winRate: 0.6,
      profitFactor: 1.8,
      drawdown: 15
    };
  }
}

/**
 * Pattern analysis interface
 */
export interface PatternAnalysis {
  timestamp: Date;
  summary: string;
  patterns: Pattern[];
  indicators: Indicator[];
  reliability: number; // 0-1 scale
  predictedMovements: PredictedMovement[];
}

/**
 * Pattern interface
 */
export interface Pattern {
  name: string;
  description: string;
  frequency: number; // Occurrences in the data
  reliability: number; // 0-1 scale
  significance: number; // 0-1 scale
  timeframe: string;
}

/**
 * Indicator interface
 */
export interface Indicator {
  name: string;
  description: string;
  value: number;
  signal: 'buy' | 'sell' | 'neutral';
  confidence: number; // 0-1 scale
  timeframe: string;
}

/**
 * Predicted movement interface
 */
export interface PredictedMovement {
  direction: 'up' | 'down' | 'sideways';
  magnitude: number; // Percentage
  confidence: number; // 0-1 scale
  timeframe: string;
  conditions: string[];
}

/**
 * Strategy constraints interface
 */
export interface StrategyConstraints {
  maxRiskPerTrade: number; // Percentage
  minWinRate: number; // 0-1 scale
  targetTimeframe: string;
  maxDrawdown: number; // Percentage
  preferredAssets: string[];
  tradingCapital: number;
}

/**
 * Generated strategy interface
 */
export interface GeneratedStrategy {
  timestamp: Date;
  name: string;
  description: string;
  entryConditions: string[];
  exitConditions: string[];
  parameters: Record<string, any>;
  riskManagement: RiskManagement;
  expectedPerformance: ExpectedPerformance;
  fullStrategyText: string;
}

/**
 * Risk management interface
 */
export interface RiskManagement {
  stopLoss: number; // Percentage
  takeProfit: number; // Percentage
  positionSizing: string;
}

/**
 * Expected performance interface
 */
export interface ExpectedPerformance {
  winRate: number; // 0-1 scale
  profitFactor: number;
  drawdown: number; // Percentage
}

// Create and export a singleton instance
const deepseekService = DeepSeekService.getInstance();
export default deepseekService;