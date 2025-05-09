import perplexityService, { MarketAnalysis, StrategyOptimization } from './perplexityService';
import deepseekService, { PatternAnalysis, GeneratedStrategy } from './deepseekService';

/**
 * Hybrid Intelligence System
 * Fuses Perplexity and DeepSeek AI capabilities to provide enhanced trading insights,
 * strategy optimization, and pattern recognition for the Solana Trading Platform
 */
export class HybridIntelligence {
  private static instance: HybridIntelligence;
  
  private constructor() {
    console.log('Initializing Hybrid Intelligence System');
    this.checkSystemAvailability();
  }
  
  /**
   * Get the HybridIntelligence instance (singleton)
   */
  public static getInstance(): HybridIntelligence {
    if (!HybridIntelligence.instance) {
      HybridIntelligence.instance = new HybridIntelligence();
    }
    
    return HybridIntelligence.instance;
  }
  
  /**
   * Check if the AI systems are available
   */
  public checkSystemAvailability(): AISystemStatus {
    const perplexityAvailable = perplexityService.isAvailable();
    const deepseekAvailable = deepseekService.isAvailable();
    
    return {
      perplexityAvailable,
      deepseekAvailable,
      hybridAvailable: perplexityAvailable && deepseekAvailable,
      timestamp: new Date()
    };
  }
  
  /**
   * Make a trading decision based on market conditions
   * Combines analyses from both AI systems
   */
  public async makeDecision(marketData: any): Promise<TradingDecision> {
    try {
      // Check if the AI systems are available
      const status = this.checkSystemAvailability();
      
      if (!status.perplexityAvailable && !status.deepseekAvailable) {
        throw new Error('AI systems not available. Please check API keys.');
      }
      
      // Get analyses from both systems if available
      let perplexityAnalysis: MarketAnalysis | null = null;
      let deepseekAnalysis: PatternAnalysis | null = null;
      
      if (status.perplexityAvailable) {
        perplexityAnalysis = await perplexityService.analyzeMarketConditions(marketData);
      }
      
      if (status.deepseekAvailable) {
        // Convert market data to historical format
        const historicalData = this.convertToHistoricalFormat(marketData);
        deepseekAnalysis = await deepseekService.detectPatterns(historicalData);
      }
      
      // Generate trading decision based on available analyses
      const decision = this.resolveDecision(perplexityAnalysis, deepseekAnalysis, marketData);
      
      return decision;
    } catch (error) {
      console.error('Error making trading decision:', error);
      
      return {
        action: 'hold',
        confidence: 0,
        reasoning: 'Error occurred while making decision',
        timestamp: new Date(),
        recommendations: [],
        source: 'error'
      };
    }
  }
  
  /**
   * Create a new trading strategy based on market analysis
   */
  public async createStrategy(parameters: StrategyCreationParams): Promise<CreatedStrategy> {
    try {
      // Check if the AI systems are available
      const status = this.checkSystemAvailability();
      
      if (!status.hybridAvailable) {
        throw new Error('Both AI systems are required for strategy creation. Please check API keys.');
      }
      
      // Get market analysis from Perplexity
      const marketAnalysis = await perplexityService.analyzeMarketConditions(parameters.marketData);
      
      // Detect patterns using DeepSeek
      const historicalData = this.convertToHistoricalFormat(parameters.marketData);
      const patternAnalysis = await deepseekService.detectPatterns(historicalData);
      
      // Generate strategy using DeepSeek
      const generatedStrategy = await deepseekService.generateStrategy(patternAnalysis, {
        maxRiskPerTrade: parameters.maxRiskPerTrade || 2,
        minWinRate: parameters.minWinRate || 0.6,
        targetTimeframe: parameters.targetTimeframe || '5m',
        maxDrawdown: parameters.maxDrawdown || 15,
        preferredAssets: parameters.preferredAssets || ['SOL', 'USDC'],
        tradingCapital: parameters.tradingCapital || 1000
      });
      
      // Optimize strategy using Perplexity
      const optimizedStrategy = await perplexityService.optimizeStrategy(
        this.convertToPerplexityFormat(generatedStrategy),
        parameters.performanceHistory || []
      );
      
      // Combine the generated and optimized strategies
      const finalStrategy: CreatedStrategy = {
        name: generatedStrategy.name,
        description: generatedStrategy.description,
        parameters: {
          ...generatedStrategy.parameters,
          ...this.extractParameters(optimizedStrategy.parameterAdjustments)
        },
        entryConditions: generatedStrategy.entryConditions,
        exitConditions: generatedStrategy.exitConditions,
        riskManagement: {
          stopLoss: generatedStrategy.riskManagement.stopLoss,
          takeProfit: generatedStrategy.riskManagement.takeProfit,
          positionSizing: generatedStrategy.riskManagement.positionSizing
        },
        timeframe: parameters.targetTimeframe || '5m',
        confidence: this.calculateConfidence(patternAnalysis, optimizedStrategy),
        expectedPerformance: generatedStrategy.expectedPerformance,
        source: 'hybrid',
        timestamp: new Date()
      };
      
      return finalStrategy;
    } catch (error) {
      console.error('Error creating strategy:', error);
      
      return {
        name: 'Error Strategy',
        description: 'Error occurred while creating strategy',
        parameters: {},
        entryConditions: [],
        exitConditions: [],
        riskManagement: {
          stopLoss: 5,
          takeProfit: 15,
          positionSizing: '2% of portfolio'
        },
        timeframe: '5m',
        confidence: 0,
        expectedPerformance: {
          winRate: 0,
          profitFactor: 0,
          drawdown: 0
        },
        source: 'error',
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Convert market data to historical format for pattern analysis
   */
  private convertToHistoricalFormat(marketData: any): any[] {
    // In a real implementation, this would convert the market data
    // to a format suitable for historical analysis
    return Array.isArray(marketData) ? marketData : [marketData];
  }
  
  /**
   * Convert DeepSeek strategy to Perplexity format for optimization
   */
  private convertToPerplexityFormat(strategy: GeneratedStrategy): any {
    // In a real implementation, this would convert the DeepSeek strategy
    // to a format suitable for Perplexity optimization
    return {
      name: strategy.name,
      description: strategy.description,
      parameters: strategy.parameters,
      entryConditions: strategy.entryConditions,
      exitConditions: strategy.exitConditions,
      riskManagement: strategy.riskManagement
    };
  }
  
  /**
   * Resolve a trading decision based on available analyses
   */
  private resolveDecision(
    perplexityAnalysis: MarketAnalysis | null,
    deepseekAnalysis: PatternAnalysis | null,
    marketData: any
  ): TradingDecision {
    // If both analyses are available, perform a consensus decision
    if (perplexityAnalysis && deepseekAnalysis) {
      return this.consensusDecision(perplexityAnalysis, deepseekAnalysis, marketData);
    }
    
    // If only Perplexity analysis is available
    if (perplexityAnalysis) {
      return this.perplexityDecision(perplexityAnalysis);
    }
    
    // If only DeepSeek analysis is available
    if (deepseekAnalysis) {
      return this.deepseekDecision(deepseekAnalysis);
    }
    
    // If no analyses are available
    return {
      action: 'hold',
      confidence: 0,
      reasoning: 'No AI analyses available',
      timestamp: new Date(),
      recommendations: [],
      source: 'fallback'
    };
  }
  
  /**
   * Generate a consensus decision based on both analyses
   */
  private consensusDecision(
    perplexityAnalysis: MarketAnalysis,
    deepseekAnalysis: PatternAnalysis,
    marketData: any
  ): TradingDecision {
    // In a real implementation, this would analyze both AI outputs
    // and generate a consensus decision using a weighted approach
    
    // For simplicity, we'll use basic logic
    const perplexitySentiment = perplexityAnalysis.marketSentiment;
    const deepseekPredictions = deepseekAnalysis.predictedMovements;
    
    let action: 'buy' | 'sell' | 'hold' = 'hold';
    let confidence = 0;
    let reasoning = '';
    
    // Determine action based on both analyses
    if (perplexitySentiment === 'bullish' && deepseekPredictions.some(p => p.direction === 'up')) {
      action = 'buy';
      confidence = 0.8;
      reasoning = 'Both analyses indicate bullish sentiment and upward movement';
    } else if (perplexitySentiment === 'bearish' && deepseekPredictions.some(p => p.direction === 'down')) {
      action = 'sell';
      confidence = 0.8;
      reasoning = 'Both analyses indicate bearish sentiment and downward movement';
    } else if (perplexitySentiment === 'bullish') {
      action = 'buy';
      confidence = 0.6;
      reasoning = 'Market analysis indicates bullish sentiment, but pattern analysis is inconclusive';
    } else if (perplexitySentiment === 'bearish') {
      action = 'sell';
      confidence = 0.6;
      reasoning = 'Market analysis indicates bearish sentiment, but pattern analysis is inconclusive';
    } else if (deepseekPredictions.some(p => p.direction === 'up')) {
      action = 'buy';
      confidence = 0.6;
      reasoning = 'Pattern analysis indicates upward movement, but market analysis is neutral';
    } else if (deepseekPredictions.some(p => p.direction === 'down')) {
      action = 'sell';
      confidence = 0.6;
      reasoning = 'Pattern analysis indicates downward movement, but market analysis is neutral';
    } else {
      action = 'hold';
      confidence = 0.7;
      reasoning = 'Both analyses indicate sideways movement or neutral sentiment';
    }
    
    // Generate recommendations based on both analyses
    const recommendations = [
      ...this.extractRecommendations(perplexityAnalysis),
      ...this.extractRecommendations(deepseekAnalysis)
    ];
    
    return {
      action,
      confidence,
      reasoning,
      timestamp: new Date(),
      recommendations,
      source: 'hybrid',
      perplexityInsights: perplexityAnalysis.summary,
      deepseekInsights: deepseekAnalysis.summary
    };
  }
  
  /**
   * Generate a decision based on Perplexity analysis only
   */
  private perplexityDecision(analysis: MarketAnalysis): TradingDecision {
    // Convert market sentiment to action
    let action: 'buy' | 'sell' | 'hold';
    let confidence: number;
    
    switch (analysis.marketSentiment) {
      case 'bullish':
        action = 'buy';
        confidence = 0.7;
        break;
      case 'bearish':
        action = 'sell';
        confidence = 0.7;
        break;
      default:
        action = 'hold';
        confidence = 0.6;
    }
    
    return {
      action,
      confidence,
      reasoning: analysis.summary,
      timestamp: new Date(),
      recommendations: this.extractRecommendations(analysis),
      source: 'perplexity',
      perplexityInsights: analysis.summary
    };
  }
  
  /**
   * Generate a decision based on DeepSeek analysis only
   */
  private deepseekDecision(analysis: PatternAnalysis): TradingDecision {
    // Determine action based on predicted movements
    let action: 'buy' | 'sell' | 'hold' = 'hold';
    let confidence = 0;
    let reasoning = analysis.summary;
    
    const upMovements = analysis.predictedMovements.filter(m => m.direction === 'up');
    const downMovements = analysis.predictedMovements.filter(m => m.direction === 'down');
    
    if (upMovements.length > downMovements.length) {
      action = 'buy';
      confidence = upMovements.reduce((acc, m) => acc + m.confidence, 0) / upMovements.length;
    } else if (downMovements.length > upMovements.length) {
      action = 'sell';
      confidence = downMovements.reduce((acc, m) => acc + m.confidence, 0) / downMovements.length;
    } else {
      action = 'hold';
      confidence = 0.5;
    }
    
    return {
      action,
      confidence,
      reasoning,
      timestamp: new Date(),
      recommendations: this.extractRecommendations(analysis),
      source: 'deepseek',
      deepseekInsights: analysis.summary
    };
  }
  
  /**
   * Extract recommendations from Perplexity analysis
   */
  private extractRecommendations(analysis: MarketAnalysis | PatternAnalysis): string[] {
    // In a real implementation, this would extract recommendations from the analysis
    if ('opportunities' in analysis) {
      return analysis.opportunities.map(o => o.description);
    } else if ('patterns' in analysis) {
      return analysis.patterns.map(p => p.description);
    }
    
    return [];
  }
  
  /**
   * Extract parameters from parameter adjustments
   */
  private extractParameters(adjustments: any[]): Record<string, any> {
    const parameters: Record<string, any> = {};
    
    for (const adjustment of adjustments) {
      parameters[adjustment.parameter] = adjustment.suggestedValue;
    }
    
    return parameters;
  }
  
  /**
   * Calculate confidence score for created strategy
   */
  private calculateConfidence(
    patternAnalysis: PatternAnalysis,
    optimizedStrategy: StrategyOptimization
  ): number {
    // In a real implementation, this would calculate a confidence score
    // based on pattern reliability and optimization confidence
    const patternReliability = patternAnalysis.reliability;
    const optimizationConfidence = optimizedStrategy.confidence;
    
    // Average the two confidence scores
    return (patternReliability + optimizationConfidence) / 2;
  }
}

/**
 * AI system status interface
 */
export interface AISystemStatus {
  perplexityAvailable: boolean;
  deepseekAvailable: boolean;
  hybridAvailable: boolean;
  timestamp: Date;
}

/**
 * Trading decision interface
 */
export interface TradingDecision {
  action: 'buy' | 'sell' | 'hold';
  confidence: number; // 0-1 scale
  reasoning: string;
  timestamp: Date;
  recommendations: string[];
  source: 'perplexity' | 'deepseek' | 'hybrid' | 'fallback' | 'error';
  perplexityInsights?: string;
  deepseekInsights?: string;
}

/**
 * Strategy creation parameters interface
 */
export interface StrategyCreationParams {
  marketData: any;
  performanceHistory?: any[];
  maxRiskPerTrade?: number;
  minWinRate?: number;
  targetTimeframe?: string;
  maxDrawdown?: number;
  preferredAssets?: string[];
  tradingCapital?: number;
}

/**
 * Created strategy interface
 */
export interface CreatedStrategy {
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
  timeframe: string;
  confidence: number;
  expectedPerformance: {
    winRate: number;
    profitFactor: number;
    drawdown: number;
  };
  source: 'hybrid' | 'error';
  timestamp: Date;
}

// Create and export a singleton instance
const hybridIntelligence = HybridIntelligence.getInstance();
export default hybridIntelligence;