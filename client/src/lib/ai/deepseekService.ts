/**
 * DeepSeek API Service
 * Provides pattern detection and strategy generation through DeepSeek AI
 */

import rateLimiter from '../rpc/rateLimiter';

export class DeepSeekService {
  private static instance: DeepSeekService;
  private apiKey: string;
  private baseUrl: string = 'https://api.deepseek.com/v1';
  private model: string = 'deepseek-coder-v2';
  
  private constructor() {
    this.apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('DeepSeek API key not found. Pattern detection capabilities will not be available.');
    } else {
      console.log('DeepSeek API service initialized');
    }
  }
  
  /**
   * Get the DeepSeekService instance (singleton)
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
   * Detect patterns in market data using DeepSeek AI
   */
  public async detectPatterns(historicalData: any[]): Promise<PatternAnalysis> {
    if (!this.isAvailable()) {
      throw new Error('DeepSeek service not available');
    }
    
    try {
      // Create the prompt for pattern detection
      const prompt = this.createPatternDetectionPrompt(historicalData);
      
      // Make the API call with rate limiting
      const response = await rateLimiter.queueHighPriority(async () => {
        return await this.callDeepSeekAPI(prompt);
      });
      
      // Process the response into a structured analysis
      const analysis = this.processPatternAnalysisResponse(response);
      
      return analysis;
    } catch (error) {
      console.error('Error detecting patterns:', error);
      
      // Return a fallback analysis in case of error
      return {
        patterns: [],
        predictedMovements: [],
        correlations: [],
        reliability: 0,
        summary: 'Error occurred while detecting patterns',
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Generate a trading strategy based on detected patterns
   */
  public async generateStrategy(
    patternAnalysis: PatternAnalysis,
    parameters: StrategyGenerationParams
  ): Promise<GeneratedStrategy> {
    if (!this.isAvailable()) {
      throw new Error('DeepSeek service not available');
    }
    
    try {
      // Create the prompt for strategy generation
      const prompt = this.createStrategyGenerationPrompt(patternAnalysis, parameters);
      
      // Make the API call with rate limiting
      const response = await rateLimiter.queueHighPriority(async () => {
        return await this.callDeepSeekAPI(prompt);
      });
      
      // Process the response into a structured strategy
      const strategy = this.processStrategyGenerationResponse(response, parameters);
      
      return strategy;
    } catch (error) {
      console.error('Error generating strategy:', error);
      
      // Return a fallback strategy in case of error
      return {
        name: 'Error Strategy',
        description: 'Error occurred while generating strategy',
        parameters: {},
        entryConditions: [],
        exitConditions: [],
        riskManagement: {
          stopLoss: parameters.maxRiskPerTrade || 5,
          takeProfit: parameters.maxRiskPerTrade ? parameters.maxRiskPerTrade * 3 : 15,
          positionSizing: `${parameters.maxRiskPerTrade || 2}% of portfolio`
        },
        expectedPerformance: {
          winRate: 0,
          profitFactor: 0,
          drawdown: 0
        }
      };
    }
  }
  
  /**
   * Call the DeepSeek API
   */
  private async callDeepSeekAPI(prompt: string): Promise<any> {
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
              content: 'You are a sophisticated pattern recognition AI specializing in financial market analysis. Respond with accurate and precise detection of patterns in trading data. Format responses as structured JSON focusing on actionable insights.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1,
          top_p: 0.9,
          max_tokens: 2048
        })
      });
      
      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status} ${await response.text()}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error calling DeepSeek API:', error);
      throw error;
    }
  }
  
  /**
   * Create a prompt for pattern detection
   */
  private createPatternDetectionPrompt(historicalData: any[]): string {
    // Format the historical data
    let dataStr = '';
    
    if (historicalData.length > 0) {
      // Take the last 50 data points to avoid too large prompts
      const limitedData = historicalData.slice(-50);
      
      // Check if the data has a specific format
      if ('price' in limitedData[0] && 'timestamp' in limitedData[0]) {
        // Format as price-timestamp data
        dataStr = limitedData.map(d => 
          `${new Date(d.timestamp).toISOString()}: $${d.price.toFixed(4)}`
        ).join('\n');
      } else if ('open' in limitedData[0] && 'high' in limitedData[0] && 'low' in limitedData[0] && 'close' in limitedData[0]) {
        // Format as OHLC data
        dataStr = limitedData.map(d => 
          `${new Date(d.timestamp || d.time).toISOString()}: O=${d.open.toFixed(4)}, H=${d.high.toFixed(4)}, L=${d.low.toFixed(4)}, C=${d.close.toFixed(4)}, V=${d.volume || 0}`
        ).join('\n');
      } else {
        // Generic format
        dataStr = JSON.stringify(limitedData, null, 2);
      }
    }
    
    return `
Analyze the following historical market data and identify patterns and trends:

${dataStr}

Please identify:
1. Technical patterns (e.g., head and shoulders, triangle, etc.)
2. Support and resistance levels
3. Trend direction and strength
4. Potential reversal points
5. Correlations with other market factors
6. Predicted price movements in the short and medium term

Format your response as JSON with the following structure:
{
  "patterns": [
    {
      "type": "pattern type",
      "location": "timestamp or range",
      "significance": "low/medium/high",
      "description": "Brief explanation"
    }
  ],
  "support_resistance": [
    {
      "type": "support/resistance",
      "level": 123.45,
      "strength": "weak/moderate/strong"
    }
  ],
  "trend": {
    "direction": "up/down/sideways",
    "strength": "weak/moderate/strong",
    "duration": "short/medium/long-term"
  },
  "predictions": [
    {
      "timeframe": "short/medium-term",
      "direction": "up/down/sideways",
      "target": 123.45,
      "confidence": 0.8
    }
  ],
  "correlations": [
    {
      "factor": "factor name",
      "relationship": "positive/negative",
      "strength": 0.8
    }
  ],
  "reliability": 0.8,
  "summary": "Brief overall analysis"
}
`;
  }
  
  /**
   * Create a prompt for strategy generation
   */
  private createStrategyGenerationPrompt(
    patternAnalysis: PatternAnalysis,
    parameters: StrategyGenerationParams
  ): string {
    // Format the pattern analysis
    const patternsSummary = patternAnalysis.patterns.map(p => 
      `- ${p.type} (${p.significance}): ${p.description}`
    ).join('\n');
    
    const predictionsSummary = patternAnalysis.predictedMovements.map(p => 
      `- ${p.timeframe}: ${p.direction} with ${(p.confidence * 100).toFixed(0)}% confidence, target: ${p.targetPrice}`
    ).join('\n');
    
    const correlationsSummary = patternAnalysis.correlations.map(c => 
      `- ${c.factor}: ${c.relationship} correlation (${c.strength.toFixed(2)})`
    ).join('\n');
    
    // Format the parameters
    const paramStr = `
Max Risk Per Trade: ${parameters.maxRiskPerTrade || 2}%
Minimum Win Rate: ${parameters.minWinRate || 0.6}
Target Timeframe: ${parameters.targetTimeframe || '5m'}
Maximum Drawdown: ${parameters.maxDrawdown || 15}%
Preferred Assets: ${parameters.preferredAssets?.join(', ') || 'Any'}
Trading Capital: $${parameters.tradingCapital || 1000}
`;
    
    return `
Based on the following pattern analysis, generate a trading strategy:

Pattern Analysis:
${patternsSummary}

Predicted Movements:
${predictionsSummary}

Correlations:
${correlationsSummary}

Summary: ${patternAnalysis.summary}
Reliability: ${(patternAnalysis.reliability * 100).toFixed(0)}%

Strategy Parameters:
${paramStr}

Please create a complete trading strategy with:
1. A descriptive name and overview
2. Specific entry and exit conditions
3. Risk management rules (stop-loss, take-profit, position sizing)
4. Expected performance metrics
5. Timeframe recommendation

Format your response as JSON with the following structure:
{
  "name": "Strategy name",
  "description": "Brief overview",
  "parameters": {
    "param1": "value1",
    "param2": "value2"
  },
  "entry_conditions": [
    "Condition 1",
    "Condition 2"
  ],
  "exit_conditions": [
    "Condition 1",
    "Condition 2"
  ],
  "risk_management": {
    "stop_loss": "5%",
    "take_profit": "15%",
    "position_sizing": "2% of portfolio"
  },
  "expected_performance": {
    "win_rate": 0.65,
    "profit_factor": 1.8,
    "drawdown": 10
  }
}
`;
  }
  
  /**
   * Process the response from pattern analysis
   */
  private processPatternAnalysisResponse(response: any): PatternAnalysis {
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
        console.warn('Error parsing JSON from DeepSeek response:', parseError);
        
        // Extract information using regex as a fallback
        const summaryMatch = content.match(/summary[\"']?\s*:\s*[\"']([^\"']+)[\"']/i);
        const reliabilityMatch = content.match(/reliability[\"']?\s*:\s*([0-9.]+)/i);
        
        parsedContent = {
          patterns: [],
          support_resistance: [],
          trend: { direction: 'sideways', strength: 'weak', duration: 'short-term' },
          predictions: [],
          correlations: [],
          reliability: reliabilityMatch ? parseFloat(reliabilityMatch[1]) : 0.5,
          summary: summaryMatch ? summaryMatch[1] : 'No summary available'
        };
      }
      
      // Map the parsed content to our PatternAnalysis interface
      return {
        patterns: (parsedContent.patterns || []).map((p: any) => ({
          type: p.type || 'unknown',
          location: p.location || '',
          significance: p.significance || 'medium',
          description: p.description || 'No description available'
        })),
        predictedMovements: (parsedContent.predictions || []).map((p: any) => ({
          timeframe: p.timeframe || 'short-term',
          direction: p.direction || 'sideways',
          targetPrice: p.target || 0,
          confidence: p.confidence || 0.5
        })),
        correlations: (parsedContent.correlations || []).map((c: any) => ({
          factor: c.factor || 'unknown',
          relationship: c.relationship || 'neutral',
          strength: c.strength || 0.5
        })),
        reliability: parsedContent.reliability || 0.5,
        summary: parsedContent.summary || 'No summary available',
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error processing pattern analysis response:', error);
      
      // Return a fallback analysis in case of error
      return {
        patterns: [],
        predictedMovements: [],
        correlations: [],
        reliability: 0,
        summary: 'Error processing pattern analysis response',
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Process the response from strategy generation
   */
  private processStrategyGenerationResponse(
    response: any,
    parameters: StrategyGenerationParams
  ): GeneratedStrategy {
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
        console.warn('Error parsing JSON from DeepSeek response:', parseError);
        
        // Extract information using regex as a fallback
        const nameMatch = content.match(/name[\"']?\s*:\s*[\"']([^\"']+)[\"']/i);
        const descriptionMatch = content.match(/description[\"']?\s*:\s*[\"']([^\"']+)[\"']/i);
        
        parsedContent = {
          name: nameMatch ? nameMatch[1] : 'Unnamed Strategy',
          description: descriptionMatch ? descriptionMatch[1] : 'No description available',
          parameters: {},
          entry_conditions: [],
          exit_conditions: [],
          risk_management: {
            stop_loss: parameters.maxRiskPerTrade || 5,
            take_profit: (parameters.maxRiskPerTrade || 5) * 3,
            position_sizing: `${parameters.maxRiskPerTrade || 2}% of portfolio`
          },
          expected_performance: {
            win_rate: parameters.minWinRate || 0.6,
            profit_factor: 1.5,
            drawdown: parameters.maxDrawdown || 15
          }
        };
      }
      
      // Convert any string parameters to numbers where appropriate
      const stopLoss = this.parsePercentage(parsedContent.risk_management?.stop_loss);
      const takeProfit = this.parsePercentage(parsedContent.risk_management?.take_profit);
      
      // Map the parsed content to our GeneratedStrategy interface
      return {
        name: parsedContent.name || 'Unnamed Strategy',
        description: parsedContent.description || 'No description available',
        parameters: parsedContent.parameters || {},
        entryConditions: parsedContent.entry_conditions || [],
        exitConditions: parsedContent.exit_conditions || [],
        riskManagement: {
          stopLoss: stopLoss !== null ? stopLoss : (parameters.maxRiskPerTrade || 5),
          takeProfit: takeProfit !== null ? takeProfit : (parameters.maxRiskPerTrade || 5) * 3,
          positionSizing: parsedContent.risk_management?.position_sizing || `${parameters.maxRiskPerTrade || 2}% of portfolio`
        },
        expectedPerformance: {
          winRate: parsedContent.expected_performance?.win_rate || parameters.minWinRate || 0.6,
          profitFactor: parsedContent.expected_performance?.profit_factor || 1.5,
          drawdown: parsedContent.expected_performance?.drawdown || parameters.maxDrawdown || 15
        }
      };
    } catch (error) {
      console.error('Error processing strategy generation response:', error);
      
      // Return a fallback strategy in case of error
      return {
        name: 'Error Strategy',
        description: 'Error occurred while generating strategy',
        parameters: {},
        entryConditions: [],
        exitConditions: [],
        riskManagement: {
          stopLoss: parameters.maxRiskPerTrade || 5,
          takeProfit: (parameters.maxRiskPerTrade || 5) * 3,
          positionSizing: `${parameters.maxRiskPerTrade || 2}% of portfolio`
        },
        expectedPerformance: {
          winRate: parameters.minWinRate || 0.6,
          profitFactor: 1.5,
          drawdown: parameters.maxDrawdown || 15
        }
      };
    }
  }
  
  /**
   * Parse a percentage value from a string or number
   */
  private parsePercentage(value: any): number | null {
    if (typeof value === 'number') {
      return value;
    }
    
    if (typeof value === 'string') {
      const match = value.match(/(\d+(?:\.\d+)?)/);
      
      if (match) {
        return parseFloat(match[1]);
      }
    }
    
    return null;
  }
}

/**
 * Pattern analysis interface
 */
export interface PatternAnalysis {
  patterns: {
    type: string;
    location: string;
    significance: 'low' | 'medium' | 'high';
    description: string;
  }[];
  predictedMovements: {
    timeframe: string;
    direction: 'up' | 'down' | 'sideways';
    targetPrice: number;
    confidence: number;
  }[];
  correlations: {
    factor: string;
    relationship: 'positive' | 'negative' | 'neutral';
    strength: number;
  }[];
  reliability: number; // 0-1 scale
  summary: string;
  timestamp: Date;
}

/**
 * Strategy generation parameters interface
 */
export interface StrategyGenerationParams {
  maxRiskPerTrade?: number;
  minWinRate?: number;
  targetTimeframe?: string;
  maxDrawdown?: number;
  preferredAssets?: string[];
  tradingCapital?: number;
}

/**
 * Generated strategy interface
 */
export interface GeneratedStrategy {
  name: string;
  description: string;
  parameters: Record<string, any>;
  entryConditions: string[];
  exitConditions: string[];
  riskManagement: {
    stopLoss: number;
    takeProfit: number;
    positionSizing: string;
  };
  expectedPerformance: {
    winRate: number;
    profitFactor: number;
    drawdown: number;
  };
}

// Create and export a singleton instance
const deepseekService = DeepSeekService.getInstance();
export default deepseekService;