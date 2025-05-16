/**
 * Neural Hybrid Intelligence Service
 * Combines Perplexity and DeepSeek AI services for enhanced trading analysis
 * Implements the Shared Neural Architecture from the system design
 */

import { logger } from '../logger';
import { getPerplexityService } from './perplexityService';
import { getDeepSeekService, PatternRecognitionResult } from './deepSeekService';
import { MarketData } from '../../shared/signalTypes';

export interface NeuralDecision {
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  rationale: string;
  timeframe: string;
  price_targets: {
    entry: number;
    stop_loss: number;
    take_profit: number[];
  };
  risk_assessment: {
    risk_level: 'low' | 'medium' | 'high';
    potential_downside: number;
    potential_upside: number;
    risk_reward_ratio: number;
  };
  secondary_factors: {
    market_conditions: string;
    momentum_indicators: string;
    volume_analysis: string;
    external_factors: string[];
  };
}

export interface NeuralStrategyCode {
  language: 'rust' | 'typescript' | 'anchor';
  code: string;
  description: string;
  parameters: {
    name: string;
    type: string;
    description: string;
    default_value: any;
  }[];
  dependencies: string[];
  test_cases: {
    input: any;
    expected_output: any;
    description: string;
  }[];
}

export class NeuralHybridService {
  private static instance: NeuralHybridService | null = null;
  private perplexityService = getPerplexityService();
  private deepSeekService = getDeepSeekService();
  private memoryCache: Map<string, any> = new Map();

  private constructor() {
    logger.info('Neural Hybrid Intelligence service initializing...');
    
    const perplexityAvailable = this.perplexityService.isAvailable();
    const deepSeekAvailable = this.deepSeekService.isAvailable();
    
    if (!perplexityAvailable && !deepSeekAvailable) {
      logger.error('Neither Perplexity nor DeepSeek services are available. Neural Hybrid Intelligence will be severely limited.');
    } else if (!perplexityAvailable) {
      logger.warn('Perplexity service not available. Neural Hybrid Intelligence will use DeepSeek only.');
    } else if (!deepSeekAvailable) {
      logger.warn('DeepSeek service not available. Neural Hybrid Intelligence will use Perplexity only.');
    } else {
      logger.info('Neural Hybrid Intelligence service initialized successfully with both AI services');
    }
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): NeuralHybridService {
    if (!this.instance) {
      this.instance = new NeuralHybridService();
    }
    return this.instance;
  }

  /**
   * Check if at least one AI service is available
   */
  public isAvailable(): boolean {
    return this.perplexityService.isAvailable() || this.deepSeekService.isAvailable();
  }

  /**
   * Store data in the memory cache
   */
  private memorize(key: string, data: any, ttlMinutes: number = 60): void {
    this.memoryCache.set(key, {
      data,
      expiry: Date.now() + ttlMinutes * 60 * 1000
    });
    
    // Clean expired cache items
    for (const [cacheKey, cacheValue] of this.memoryCache.entries()) {
      if (cacheValue.expiry < Date.now()) {
        this.memoryCache.delete(cacheKey);
      }
    }
  }

  /**
   * Retrieve data from memory cache
   */
  private recall(key: string): any | null {
    const cacheItem = this.memoryCache.get(key);
    if (cacheItem && cacheItem.expiry > Date.now()) {
      return cacheItem.data;
    }
    return null;
  }

  /**
   * Make a trading decision using both AI services
   * This implements the HybridIntelligence.make_decision() method from the architecture
   */
  public async makeDecision(
    pair: string,
    marketData: MarketData
  ): Promise<NeuralDecision> {
    logger.info(`Neural Hybrid Intelligence making decision for ${pair}`);
    
    // Check cache first for recent decisions
    const cacheKey = `decision:${pair}:${marketData.prices[marketData.prices.length - 1][0]}`;
    const cachedDecision = this.recall(cacheKey);
    if (cachedDecision) {
      logger.info(`Using cached decision for ${pair}`);
      return cachedDecision;
    }
    
    try {
      // Get analysis from both services in parallel
      const analysisPromises = [];
      
      if (this.perplexityService.isAvailable()) {
        analysisPromises.push(this.perplexityService.generateMarketInsights(pair, marketData));
      } else {
        analysisPromises.push(Promise.resolve(null));
      }
      
      if (this.deepSeekService.isAvailable()) {
        analysisPromises.push(this.deepSeekService.recognizePatterns(pair, marketData));
      } else {
        analysisPromises.push(Promise.resolve(null));
      }
      
      const [perplexityAnalysis, deepSeekAnalysis] = await Promise.all(analysisPromises);
      
      // Implement neural consensus mechanism
      const decision = this.resolveConsensus(pair, marketData, perplexityAnalysis, deepSeekAnalysis);
      
      // Cache the decision
      this.memorize(cacheKey, decision, 15); // Cache for 15 minutes
      
      return decision;
    } catch (error) {
      logger.error('Error making neural decision:', error);
      
      // Try to use at least one service if available
      if (this.perplexityService.isAvailable()) {
        try {
          const fallbackAnalysis = await this.perplexityService.generateMarketInsights(pair, marketData);
          return this.createDecisionFromPerplexity(fallbackAnalysis);
        } catch (fallbackError) {
          logger.error('Fallback to Perplexity failed:', fallbackError);
        }
      } else if (this.deepSeekService.isAvailable()) {
        try {
          const fallbackPatterns = await this.deepSeekService.recognizePatterns(pair, marketData);
          return this.createDecisionFromDeepSeek(fallbackPatterns);
        } catch (fallbackError) {
          logger.error('Fallback to DeepSeek failed:', fallbackError);
        }
      }
      
      throw new Error(`Failed to make trading decision: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Resolve consensus between the two AI services
   * This implements the NeuralConsensusEngine.resolve() method from the architecture
   */
  private resolveConsensus(
    pair: string,
    marketData: MarketData,
    perplexityAnalysis: any,
    deepSeekAnalysis: PatternRecognitionResult[]
  ): NeuralDecision {
    logger.info(`Resolving consensus for ${pair}`);
    
    // Extract key insights from Perplexity
    let perplexityAction = 'hold';
    let perplexityConfidence = 50;
    
    if (perplexityAnalysis && perplexityAnalysis.trading_recommendation) {
      perplexityAction = perplexityAnalysis.trading_recommendation.action.toLowerCase();
      
      // Convert strength to confidence number
      const strengthMap: {[key: string]: number} = {
        'strong': 85,
        'moderate': 65,
        'weak': 45
      };
      
      perplexityConfidence = strengthMap[perplexityAnalysis.trading_recommendation.strength] || 50;
    }
    
    // Extract key insights from DeepSeek
    let deepSeekAction = 'hold';
    let deepSeekConfidence = 50;
    let mostSignificantPattern: PatternRecognitionResult | null = null;
    
    if (deepSeekAnalysis && deepSeekAnalysis.length > 0) {
      // Find most significant pattern by confidence
      mostSignificantPattern = deepSeekAnalysis.reduce((prev, current) => {
        return (prev.confidence > current.confidence) ? prev : current;
      });
      
      // Extract action recommendation
      if (mostSignificantPattern.predictedMovement === 'up') {
        deepSeekAction = 'buy';
      } else if (mostSignificantPattern.predictedMovement === 'down') {
        deepSeekAction = 'sell';
      } else {
        deepSeekAction = 'hold';
      }
      
      deepSeekConfidence = mostSignificantPattern.confidence;
    }
    
    // Resolve action based on weighted consensus
    let finalAction: 'buy' | 'sell' | 'hold';
    let finalConfidence: number;
    
    if (!perplexityAnalysis && !deepSeekAnalysis) {
      // If no analyses, default to hold with low confidence
      finalAction = 'hold';
      finalConfidence = 30;
    } else if (!perplexityAnalysis) {
      // If only DeepSeek available
      finalAction = deepSeekAction as 'buy' | 'sell' | 'hold';
      finalConfidence = deepSeekConfidence;
    } else if (!deepSeekAnalysis || deepSeekAnalysis.length === 0) {
      // If only Perplexity available
      finalAction = perplexityAction as 'buy' | 'sell' | 'hold';
      finalConfidence = perplexityConfidence;
    } else {
      // Both services available - use weighted consensus
      
      // If both agree, high confidence
      if (perplexityAction === deepSeekAction) {
        finalAction = perplexityAction as 'buy' | 'sell' | 'hold';
        finalConfidence = Math.max(perplexityConfidence, deepSeekConfidence) + 10; // Bonus for agreement
        finalConfidence = Math.min(finalConfidence, 95); // Cap at 95%
      } else {
        // If disagreement, use weighted decision
        // Perplexity is better at fundamental analysis, DeepSeek at technical patterns
        // Apply 60/40 weight for technical vs fundamental in crypto
        const deepSeekWeight = 0.6;
        const perplexityWeight = 0.4;
        
        // Convert actions to scores (-1 = sell, 0 = hold, 1 = buy)
        const actionScores: {[key: string]: number} = {
          'buy': 1,
          'hold': 0,
          'sell': -1
        };
        
        const perplexityScore = actionScores[perplexityAction] * (perplexityConfidence / 100) * perplexityWeight;
        const deepSeekScore = actionScores[deepSeekAction] * (deepSeekConfidence / 100) * deepSeekWeight;
        const combinedScore = perplexityScore + deepSeekScore;
        
        // Convert score back to action
        if (combinedScore > 0.2) {
          finalAction = 'buy';
        } else if (combinedScore < -0.2) {
          finalAction = 'sell';
        } else {
          finalAction = 'hold';
        }
        
        // Calculate confidence based on agreement strength
        finalConfidence = Math.abs(combinedScore) * 100;
        finalConfidence = Math.max(40, Math.min(finalConfidence, 85)); // Between 40% and 85%
      }
    }
    
    // Calculate current price and risk parameters
    const currentPrice = marketData.prices[marketData.prices.length - 1][1];
    let stopLoss = currentPrice * 0.95; // Default 5% stop loss
    let takeProfitLevels = [currentPrice * 1.05, currentPrice * 1.1]; // Default take profit levels
    let riskLevel: 'low' | 'medium' | 'high' = 'medium';
    
    // Override with Perplexity data if available
    if (perplexityAnalysis && perplexityAnalysis.trading_recommendation) {
      if (perplexityAnalysis.trading_recommendation.stop_loss) {
        stopLoss = perplexityAnalysis.trading_recommendation.stop_loss;
      }
      
      if (perplexityAnalysis.trading_recommendation.take_profit) {
        takeProfitLevels = perplexityAnalysis.trading_recommendation.take_profit;
      }
    }
    
    // Set risk level based on market volatility and confidence
    const priceVolatility = this.calculateVolatility(marketData.prices);
    if (priceVolatility > 5 || finalConfidence < 50) {
      riskLevel = 'high';
    } else if (priceVolatility < 2 && finalConfidence > 75) {
      riskLevel = 'low';
    }
    
    // Calculate risk-reward ratio
    const potentialDownside = (currentPrice - stopLoss) / currentPrice;
    const potentialUpside = (takeProfitLevels[takeProfitLevels.length - 1] - currentPrice) / currentPrice;
    const riskRewardRatio = potentialUpside / (potentialDownside || 0.01);
    
    // Determine timeframe
    let timeframe = 'medium-term';
    if (mostSignificantPattern && mostSignificantPattern.timeframe) {
      timeframe = mostSignificantPattern.timeframe;
    } else if (perplexityAnalysis && perplexityAnalysis.predicted_movements) {
      if (perplexityAnalysis.predicted_movements.short_term.confidence > 
          perplexityAnalysis.predicted_movements.medium_term.confidence) {
        timeframe = 'short-term';
      } else {
        timeframe = 'medium-term';
      }
    }
    
    // Build the consensus rationale
    let rationale = '';
    if (perplexityAnalysis && deepSeekAnalysis && deepSeekAnalysis.length > 0) {
      rationale = `Combined analysis suggests ${finalAction} with ${finalConfidence.toFixed(0)}% confidence. `;
      
      if (finalAction === 'buy') {
        rationale += `Technical pattern (${mostSignificantPattern?.patternType}) indicates an upward movement `;
      } else if (finalAction === 'sell') {
        rationale += `Technical pattern (${mostSignificantPattern?.patternType}) indicates a downward movement `;
      }
      
      if (perplexityAnalysis.overall_sentiment) {
        rationale += `with overall market sentiment score of ${perplexityAnalysis.overall_sentiment.score}/100.`;
      }
    } else if (perplexityAnalysis) {
      rationale = `Fundamental analysis suggests ${finalAction} based on market conditions.`;
      if (perplexityAnalysis.overall_sentiment) {
        rationale += ` Market sentiment score: ${perplexityAnalysis.overall_sentiment.score}/100.`;
      }
    } else if (deepSeekAnalysis && deepSeekAnalysis.length > 0) {
      rationale = `Technical analysis identified ${mostSignificantPattern?.patternType} pattern suggesting ${finalAction}.`;
      if (mostSignificantPattern) {
        rationale += ` ${mostSignificantPattern.description}`;
      }
    }
    
    // Build secondary factors
    const secondaryFactors = {
      market_conditions: 'neutral',
      momentum_indicators: 'neutral',
      volume_analysis: 'normal volume',
      external_factors: [] as string[]
    };
    
    if (perplexityAnalysis) {
      if (perplexityAnalysis.price_analysis) {
        secondaryFactors.market_conditions = perplexityAnalysis.price_analysis.trend;
        secondaryFactors.momentum_indicators = perplexityAnalysis.price_analysis.momentum;
      }
      
      if (perplexityAnalysis.volume_analysis) {
        secondaryFactors.volume_analysis = 
          `${perplexityAnalysis.volume_analysis.trend} volume${perplexityAnalysis.volume_analysis.unusual_activity ? ' (unusual activity)' : ''}`;
      }
    }
    
    // Construct final decision object
    const decision: NeuralDecision = {
      action: finalAction,
      confidence: finalConfidence,
      rationale,
      timeframe,
      price_targets: {
        entry: currentPrice,
        stop_loss: stopLoss,
        take_profit: takeProfitLevels
      },
      risk_assessment: {
        risk_level: riskLevel,
        potential_downside: potentialDownside * 100,
        potential_upside: potentialUpside * 100,
        risk_reward_ratio: parseFloat(riskRewardRatio.toFixed(2))
      },
      secondary_factors: secondaryFactors
    };
    
    return decision;
  }

  /**
   * Create a strategy based on specified parameters
   * This implements the HybridIntelligence.create_strategy() method from the architecture
   */
  public async createStrategy(parameters: any): Promise<NeuralStrategyCode> {
    logger.info(`Creating neural strategy with parameters: ${JSON.stringify(parameters)}`);
    
    // Default to using DeepSeek for strategy code generation
    // as it's better at code generation tasks
    if (!this.deepSeekService.isAvailable()) {
      throw new Error('DeepSeek service is required for strategy code generation');
    }
    
    try {
      const systemPrompt = `You are an expert in quantitative trading strategy development.
Your task is to create a complete trading strategy in code based on the provided parameters.
Respond with JSON only containing the following structure:
{
  "language": "rust/typescript/anchor",
  "code": "complete code implementation of the strategy",
  "description": "detailed explanation of how the strategy works",
  "parameters": [
    {
      "name": "parameter name",
      "type": "parameter type",
      "description": "parameter description",
      "default_value": default value
    }
  ],
  "dependencies": ["list of required dependencies"],
  "test_cases": [
    {
      "input": "test input",
      "expected_output": "expected output",
      "description": "test case description"
    }
  ]
}`;

      const userPrompt = `Create a complete trading strategy with the following parameters:
${JSON.stringify(parameters, null, 2)}

Generate the strategy with proper error handling, optimization, and documentation.
The strategy should be production-ready and use best practices for the specified language.
Include sufficient comments to explain the logic and implementation details.

Provide JSON-formatted response with the strategy implementation.`;

      const completion = await this.deepSeekService['generateCompletion'](systemPrompt, userPrompt);
      
      try {
        const strategyCode = JSON.parse(completion) as NeuralStrategyCode;
        return strategyCode;
      } catch (parseError) {
        logger.error('Error parsing strategy code generation response:', parseError);
        throw new Error('Failed to parse strategy generation response');
      }
    } catch (error) {
      logger.error('Error creating neural strategy:', error);
      throw new Error(`Failed to create neural strategy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a decision object using only Perplexity analysis (fallback)
   */
  private createDecisionFromPerplexity(perplexityAnalysis: any): NeuralDecision {
    if (!perplexityAnalysis || !perplexityAnalysis.trading_recommendation) {
      throw new Error('Invalid Perplexity analysis data');
    }
    
    const tradingRecommendation = perplexityAnalysis.trading_recommendation;
    
    // Convert strength to confidence
    const strengthMap: {[key: string]: number} = {
      'strong': 85,
      'moderate': 65,
      'weak': 45
    };
    
    const confidence = strengthMap[tradingRecommendation.strength] || 50;
    
    return {
      action: tradingRecommendation.action.toLowerCase() as 'buy' | 'sell' | 'hold',
      confidence,
      rationale: perplexityAnalysis.overall_sentiment?.description || 'Based on fundamental analysis',
      timeframe: perplexityAnalysis.predicted_movements?.short_term.confidence > 
        perplexityAnalysis.predicted_movements?.medium_term.confidence ? 'short-term' : 'medium-term',
      price_targets: {
        entry: tradingRecommendation.entry_points?.[0] || 0,
        stop_loss: tradingRecommendation.stop_loss || 0,
        take_profit: tradingRecommendation.take_profit || []
      },
      risk_assessment: {
        risk_level: confidence > 70 ? 'low' : confidence > 50 ? 'medium' : 'high',
        potential_downside: 5, // Default 5% downside
        potential_upside: 10, // Default 10% upside
        risk_reward_ratio: tradingRecommendation.risk_reward_ratio || 2.0
      },
      secondary_factors: {
        market_conditions: perplexityAnalysis.price_analysis?.trend || 'neutral',
        momentum_indicators: perplexityAnalysis.price_analysis?.momentum || 'neutral',
        volume_analysis: perplexityAnalysis.volume_analysis?.trend || 'normal volume',
        external_factors: []
      }
    };
  }

  /**
   * Create a decision object using only DeepSeek pattern recognition (fallback)
   */
  private createDecisionFromDeepSeek(patterns: PatternRecognitionResult[]): NeuralDecision {
    if (!patterns || patterns.length === 0) {
      throw new Error('No valid pattern recognition results');
    }
    
    // Find most significant pattern by confidence
    const mostSignificantPattern = patterns.reduce((prev, current) => {
      return (prev.confidence > current.confidence) ? prev : current;
    });
    
    // Determine action based on predicted movement
    let action: 'buy' | 'sell' | 'hold';
    if (mostSignificantPattern.predictedMovement === 'up') {
      action = 'buy';
    } else if (mostSignificantPattern.predictedMovement === 'down') {
      action = 'sell';
    } else {
      action = 'hold';
    }
    
    // Create default price targets
    const keyLevels = mostSignificantPattern.keyLevels || { support: [], resistance: [] };
    
    // Get current price from support/resistance average if available
    let currentPrice = 0;
    if (keyLevels.support.length > 0 && keyLevels.resistance.length > 0) {
      const avgSupport = keyLevels.support.reduce((sum, val) => sum + val, 0) / keyLevels.support.length;
      const avgResistance = keyLevels.resistance.reduce((sum, val) => sum + val, 0) / keyLevels.resistance.length;
      currentPrice = (avgSupport + avgResistance) / 2;
    } else if (keyLevels.support.length > 0) {
      currentPrice = keyLevels.support[0] * 1.05; // Estimate 5% above support
    } else if (keyLevels.resistance.length > 0) {
      currentPrice = keyLevels.resistance[0] * 0.95; // Estimate 5% below resistance
    } else {
      currentPrice = 100; // Arbitrary default
    }
    
    return {
      action,
      confidence: mostSignificantPattern.confidence,
      rationale: `${mostSignificantPattern.patternType} pattern detected: ${mostSignificantPattern.description}`,
      timeframe: mostSignificantPattern.timeframe || 'medium-term',
      price_targets: {
        entry: currentPrice,
        stop_loss: keyLevels.support[0] || currentPrice * 0.95,
        take_profit: keyLevels.resistance.length > 0 ? keyLevels.resistance : [currentPrice * 1.05, currentPrice * 1.1]
      },
      risk_assessment: {
        risk_level: mostSignificantPattern.confidence > 80 ? 'low' : mostSignificantPattern.confidence > 60 ? 'medium' : 'high',
        potential_downside: 5, // Default 5%
        potential_upside: 10, // Default 10%
        risk_reward_ratio: 2.0 // Default 2:1 ratio
      },
      secondary_factors: {
        market_conditions: mostSignificantPattern.predictedMovement === 'up' ? 'bullish' : 
                           mostSignificantPattern.predictedMovement === 'down' ? 'bearish' : 'neutral',
        momentum_indicators: 'neutral', // Default
        volume_analysis: 'normal volume', // Default
        external_factors: []
      }
    };
  }

  /**
   * Utility function to calculate price volatility
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
    
    // Return daily volatility as percentage
    return stdDev * 100;
  }
}

// Export singleton getter
export const getNeuralHybridService = (): NeuralHybridService => {
  return NeuralHybridService.getInstance();
};