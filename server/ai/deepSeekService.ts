/**
 * DeepSeek AI Service
 * Provides advanced pattern recognition and market analysis for trading
 */

import axios from 'axios';
import { logger } from '../logger';
import { MarketData } from '../../shared/signalTypes';

export interface PatternRecognitionResult {
  patternType: string;
  confidence: number;
  predictedMovement: 'up' | 'down' | 'sideways';
  description: string;
  timeframe: string;
  keyLevels: {
    support: number[];
    resistance: number[];
  };
  actionRecommendation: string;
}

interface DeepSeekResponse {
  id: string;
  object: 'chat.completion';
  model: string;
  created: number;
  choices: {
    index: number;
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
  // DeepSeek-specific fields
  meta?: any;
}

export class DeepSeekService {
  private static instance: DeepSeekService | null = null;
  private apiKey: string;
  private baseUrl: string = 'https://api.deepseek.com/v1/chat/completions';
  private model: string = 'deepseek-coder';

  private constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY || '';
    
    if (!this.apiKey) {
      logger.warn('DeepSeek API key not set. Pattern recognition capabilities will be limited.');
    } else {
      logger.info('DeepSeek AI service initialized successfully');
    }
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): DeepSeekService {
    if (!this.instance) {
      this.instance = new DeepSeekService();
    }
    return this.instance;
  }

  /**
   * Check if the service is available
   */
  public isAvailable(): boolean {
    // If we've detected an insufficient balance, return false
    if (this._insufficientBalance) {
      return false;
    }
    return !!this.apiKey;
  }
  
  // Track if we've detected an insufficient balance
  private _insufficientBalance: boolean = false;

  /**
   * Generate a completion using DeepSeek AI
   */
  private async generateCompletion(
    systemPrompt: string,
    userPrompt: string
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('DeepSeek API key not set. Cannot generate completion.');
    }

    try {
      logger.info(`Sending request to DeepSeek API...`);
      
      // Set a timeout for the API request
      const timeout = 30000; // 30 seconds
      
      const response = await axios.post<DeepSeekResponse>(
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
          temperature: 0.1, // Lower temperature for more deterministic responses
          max_tokens: 2048
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: timeout
        }
      );

      logger.info(`Received response from DeepSeek API`);
      
      if (!response.data || !response.data.choices || response.data.choices.length === 0) {
        throw new Error('Invalid response from DeepSeek API: No completion choices returned');
      }
      
      return response.data.choices[0].message.content;
    } catch (error) {
      if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
        logger.error('Timeout error connecting to DeepSeek API:', error);
        throw new Error('Connection to DeepSeek API timed out. Please try again later.');
      } else if (axios.isAxiosError(error) && error.response) {
        // API responded with an error
        logger.error(`DeepSeek API error (${error.response.status}):`, error.response.data);
        
        // Check if this is an insufficient balance error
        if (error.response.status === 402 || 
            (error.response.data && 
             typeof error.response.data === 'object' && 
             error.response.data.error && 
             error.response.data.error.message === 'Insufficient Balance')) {
          logger.warn('DeepSeek API insufficient balance detected. Disabling service.');
          this._insufficientBalance = true;
        }
        
        throw new Error(`DeepSeek API error (${error.response.status}): ${JSON.stringify(error.response.data)}`);
      } else {
        // Network error or other issue
        logger.error('Error generating DeepSeek AI completion:', error);
        throw new Error(`Failed to generate AI completion: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Recognize patterns in market data using DeepSeek AI
   */
  public async recognizePatterns(
    pair: string,
    marketData: MarketData
  ): Promise<PatternRecognitionResult[]> {
    if (!this.isAvailable()) {
      throw new Error('DeepSeek AI service not available');
    }

    try {
      const systemPrompt = `You are an expert in quantitative analysis and pattern recognition for cryptocurrency trading. 
Your task is to analyze market data and identify technical patterns with high precision. 
Respond with JSON only containing an array of pattern recognition results with the following structure:
[
  {
    "patternType": "pattern name (e.g., Double Top, Head and Shoulders, etc.)",
    "confidence": number (0-100),
    "predictedMovement": "up/down/sideways",
    "description": "brief description of the pattern and its implications",
    "timeframe": "short-term/medium-term/long-term",
    "keyLevels": {
      "support": [list of key support price levels],
      "resistance": [list of key resistance price levels]
    },
    "actionRecommendation": "specific trading action recommendation"
  },
  ...
]
Identify only the most significant patterns with at least 70% confidence.`;

      // Prepare market data
      const priceDataFormatted = marketData.prices.map(p => `[${p[0]}, ${p[1]}]`).join(', ');
      
      const userPrompt = `Analyze the following market data for ${pair} and identify technical patterns:
- Current price: ${marketData.prices[marketData.prices.length - 1][1]}
- Historical price data: [${priceDataFormatted}]
- Source: ${marketData.source || 'market data provider'}
- Last updated: ${marketData.prices[marketData.prices.length - 1][0]}

Provide JSON-formatted analysis identifying specific technical patterns.`;

      const completion = await this.generateCompletion(systemPrompt, userPrompt);
      
      try {
        return JSON.parse(completion) as PatternRecognitionResult[];
      } catch (parseError) {
        logger.error('Error parsing DeepSeek AI response:', parseError);
        throw new Error('Failed to parse AI response to pattern recognition format');
      }
    } catch (error) {
      logger.error('Error recognizing patterns:', error);
      throw new Error(`Failed to recognize patterns: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a quantum-inspired trading strategy
   */
  public async generateQuantumStrategy(
    pair: string,
    marketData: MarketData,
    riskTolerance: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<any> {
    if (!this.isAvailable()) {
      throw new Error('DeepSeek AI service not available');
    }

    try {
      const systemPrompt = `You are an expert in quantum-inspired trading algorithms and mathematical finance. 
Your task is to generate a sophisticated trading strategy based on market data analysis.
Respond with JSON only containing the following structure:
{
  "strategy_name": "name of the quantum-inspired strategy",
  "strategy_description": "detailed description of how the strategy works",
  "mathematical_foundation": "explanation of the mathematical principles",
  "entry_conditions": {
    "technical_indicators": [list of specific indicator conditions],
    "price_patterns": [list of price patterns to look for],
    "quantum_signals": [list of quantum-inspired signals]
  },
  "exit_conditions": {
    "take_profit": [list of take profit conditions],
    "stop_loss": [list of stop loss conditions],
    "time_based": [any time-based exit conditions]
  },
  "position_sizing": {
    "initial_position": "recommendation for initial position size",
    "scaling": "approach to position scaling",
    "max_allocation": "maximum allocation recommendation"
  },
  "risk_management": {
    "max_drawdown": "maximum acceptable drawdown",
    "risk_per_trade": "risk percentage per trade",
    "correlation_hedging": "hedging approach recommendations"
  },
  "backtest_results": {
    "expected_win_rate": number (0-100),
    "expected_profit_factor": number,
    "max_consecutive_losses": number,
    "expected_annual_return": number
  },
  "implementation_code": "pseudo-code for strategy implementation"
}`;

      // Convert market data into a detailed prompt
      const pricesJson = JSON.stringify(marketData.prices);
      const volumesJson = marketData.volumes ? JSON.stringify(marketData.volumes) : '[]';
      
      // Include indicators if available
      let indicatorsDescription = '';
      if (marketData.indicators) {
        indicatorsDescription = 'Technical indicators:\n';
        for (const [indicator, values] of Object.entries(marketData.indicators)) {
          indicatorsDescription += `- ${indicator}: ${JSON.stringify(values)}\n`;
        }
      }
      
      const userPrompt = `Generate a quantum-inspired trading strategy for ${pair} with ${riskTolerance} risk tolerance.

Market Data:
- Prices: ${pricesJson}
- Volumes: ${volumesJson}
${indicatorsDescription}

Current Market Conditions:
- Volatility: ${this.calculateVolatility(marketData.prices)}%
- Recent Trend: ${this.identifyTrend(marketData.prices)}
- Source: ${marketData.source || 'market data provider'}

Provide a JSON-formatted quantum-inspired trading strategy using the structure specified.`;

      const completion = await this.generateCompletion(systemPrompt, userPrompt);
      
      try {
        return JSON.parse(completion);
      } catch (parseError) {
        logger.error('Error parsing DeepSeek AI response:', parseError);
        return {
          error: "Failed to parse AI response",
          raw_response: completion
        };
      }
    } catch (error) {
      logger.error('Error generating quantum strategy:', error);
      throw new Error(`Failed to generate quantum strategy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform anomaly detection on market data
   */
  public async detectAnomalies(
    pair: string,
    marketData: MarketData
  ): Promise<any> {
    if (!this.isAvailable()) {
      throw new Error('DeepSeek AI service not available');
    }

    try {
      const systemPrompt = `You are an expert in market anomaly detection and statistical analysis.
Your task is to analyze market data and identify unusual patterns or anomalies that could indicate trading opportunities.
Respond with JSON only containing the following structure:
{
  "anomalies_detected": [
    {
      "type": "anomaly type (e.g., price spike, volume anomaly, etc.)",
      "timestamp": "timestamp of the anomaly",
      "description": "description of the anomaly",
      "significance": number (0-100),
      "trading_implication": "what this might mean for trading"
    }
  ],
  "statistical_summary": {
    "z_score_analysis": "z-score analysis results",
    "volatility_assessment": "volatility assessment",
    "distribution_analysis": "analysis of price distribution"
  },
  "market_manipulation_indicators": {
    "likelihood": number (0-100),
    "evidence": [list of evidence for potential manipulation],
    "patterns_observed": [list of suspicious patterns]
  },
  "recommended_actions": [
    {
      "description": "recommended action based on anomaly",
      "urgency": "high/medium/low",
      "risk_assessment": "risk assessment for this action"
    }
  ]
}`;

      // Prepare market data for analysis
      const pricesJson = JSON.stringify(marketData.prices);
      const volumesJson = marketData.volumes ? JSON.stringify(marketData.volumes) : '[]';
      
      const userPrompt = `Analyze the following market data for ${pair} and identify any anomalies:
- Prices: ${pricesJson}
- Volumes: ${volumesJson}
- Source: ${marketData.source || 'market data provider'}
- Last updated: ${marketData.prices[marketData.prices.length - 1][0]}

Provide JSON-formatted analysis of market anomalies using the structure specified.`;

      const completion = await this.generateCompletion(systemPrompt, userPrompt);
      
      try {
        return JSON.parse(completion);
      } catch (parseError) {
        logger.error('Error parsing DeepSeek AI response:', parseError);
        return {
          error: "Failed to parse AI response",
          raw_response: completion
        };
      }
    } catch (error) {
      logger.error('Error detecting anomalies:', error);
      throw new Error(`Failed to detect anomalies: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Utility function to calculate price volatility from market data
   * @param prices Price data as [timestamp, price] pairs
   * @returns Volatility as percentage
   */
  private calculateVolatility(prices: [string, number][]): number {
    if (!prices || prices.length < 2) {
      return 0;
    }
    
    // Extract just the price values
    const priceValues = prices.map(p => p[1]);
    
    // Calculate returns
    const returns = [];
    for (let i = 1; i < priceValues.length; i++) {
      returns.push((priceValues[i] - priceValues[i-1]) / priceValues[i-1]);
    }
    
    // Calculate standard deviation
    const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
    const squaredDifferences = returns.map(value => Math.pow(value - mean, 2));
    const variance = squaredDifferences.reduce((sum, value) => sum + value, 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    // Annualized volatility (assuming daily data)
    const annualizedVolatility = stdDev * Math.sqrt(365) * 100;
    
    return parseFloat(annualizedVolatility.toFixed(2));
  }

  /**
   * Utility function to identify the recent trend from price data
   * @param prices Price data as [timestamp, price] pairs
   * @returns Trend description
   */
  private identifyTrend(prices: [string, number][]): string {
    if (!prices || prices.length < 10) {
      return 'Insufficient data';
    }
    
    // Extract recent prices (last 10 data points)
    const recentPrices = prices.slice(-10).map(p => p[1]);
    
    // Simple linear regression
    const xValues = Array.from({ length: recentPrices.length }, (_, i) => i);
    const xMean = xValues.reduce((sum, value) => sum + value, 0) / xValues.length;
    const yMean = recentPrices.reduce((sum, value) => sum + value, 0) / recentPrices.length;
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < xValues.length; i++) {
      numerator += (xValues[i] - xMean) * (recentPrices[i] - yMean);
      denominator += Math.pow(xValues[i] - xMean, 2);
    }
    
    const slope = numerator / denominator;
    
    // Calculate percent change
    const firstPrice = recentPrices[0];
    const lastPrice = recentPrices[recentPrices.length - 1];
    const percentChange = ((lastPrice - firstPrice) / firstPrice) * 100;
    
    // Determine trend description
    if (slope > 0) {
      if (percentChange > 5) return 'Strong uptrend';
      if (percentChange > 1) return 'Moderate uptrend';
      return 'Slight uptrend';
    } else if (slope < 0) {
      if (percentChange < -5) return 'Strong downtrend';
      if (percentChange < -1) return 'Moderate downtrend';
      return 'Slight downtrend';
    } else {
      return 'Sideways/Consolidation';
    }
  }
}

// Export singleton getter
export const getDeepSeekService = (): DeepSeekService => {
  return DeepSeekService.getInstance();
};