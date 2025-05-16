/**
 * Neural Hybrid System
 * 
 * This module integrates multiple AI services (Perplexity and DeepSeek) into a hybrid system
 * that leverages the strengths of each model for different trading-related tasks. It provides
 * a unified interface for strategy generation, market analysis, and system optimization.
 */

import { logger } from '../logger';
import { Strategy, Transaction, TradingSignal } from '@shared/schema';
import { perplexityService, MarketData, MarketInsight, StrategyEnhancement } from './perplexityService';
import { 
  deepseekService, 
  QuantitativeParameters, 
  OptimizationResult, 
  TradingLogicImplementation 
} from './deepseekService';

export enum AIProvider {
  PERPLEXITY = 'perplexity',
  DEEPSEEK = 'deepseek',
  HYBRID = 'hybrid'
}

export enum TaskType {
  MARKET_ANALYSIS = 'market_analysis',
  STRATEGY_ENHANCEMENT = 'strategy_enhancement',
  SIGNAL_EVALUATION = 'signal_evaluation',
  TRANSACTION_ANALYSIS = 'transaction_analysis',
  CODE_GENERATION = 'code_generation',
  CODE_OPTIMIZATION = 'code_optimization',
  PARAMETER_OPTIMIZATION = 'parameter_optimization'
}

export interface AIModelCapability {
  provider: AIProvider;
  model: string;
  taskTypes: TaskType[];
  latency: number; // Estimated response time in ms
  tokensPerMinute: number; // Rate limit
  costPer1kTokens: number; // Cost in USD
  strengths: string[];
  weaknesses: string[];
}

export interface HybridResult<T> {
  result: T;
  provider: AIProvider;
  model: string;
  confidence: number;
  processingTime: number;
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export class NeuralHybridSystem {
  private static instance: NeuralHybridSystem;
  private capabilityMap: Map<TaskType, AIProvider[]>;
  private primaryProviders: Map<TaskType, AIProvider>;
  private modelCapabilities: AIModelCapability[];
  
  private constructor() {
    // Initialize capabilities
    this.modelCapabilities = [
      {
        provider: AIProvider.PERPLEXITY,
        model: 'llama-3.1-sonar-small-128k-online',
        taskTypes: [
          TaskType.MARKET_ANALYSIS,
          TaskType.STRATEGY_ENHANCEMENT,
          TaskType.SIGNAL_EVALUATION,
          TaskType.TRANSACTION_ANALYSIS
        ],
        latency: 2500,
        tokensPerMinute: 6000,
        costPer1kTokens: 0.0002,
        strengths: [
          'Real-time information retrieval',
          'Market sentiment analysis',
          'Integrated knowledge of current crypto trends',
          'Comprehensive analysis with citations'
        ],
        weaknesses: [
          'Limited code generation capabilities',
          'Higher latency for complex analyses',
          'Less focused on technical implementation details'
        ]
      },
      {
        provider: AIProvider.DEEPSEEK,
        model: 'deepseek-coder',
        taskTypes: [
          TaskType.CODE_GENERATION,
          TaskType.CODE_OPTIMIZATION,
          TaskType.PARAMETER_OPTIMIZATION
        ],
        latency: 3500,
        tokensPerMinute: 4000,
        costPer1kTokens: 0.0004,
        strengths: [
          'Superior code generation',
          'Algorithm optimization',
          'Technical implementation expertise',
          'Parameter tuning capabilities'
        ],
        weaknesses: [
          'Limited real-time market knowledge',
          'Higher cost per token',
          'Lower throughput'
        ]
      }
    ];
    
    // Build capability map
    this.capabilityMap = new Map();
    this.primaryProviders = new Map();
    
    // Initialize capability map
    for (const capability of this.modelCapabilities) {
      for (const taskType of capability.taskTypes) {
        if (!this.capabilityMap.has(taskType)) {
          this.capabilityMap.set(taskType, []);
        }
        
        this.capabilityMap.get(taskType)!.push(capability.provider);
        
        // Set as primary if not already set or if this is Perplexity (preferred for most tasks)
        if (!this.primaryProviders.has(taskType) || capability.provider === AIProvider.PERPLEXITY) {
          this.primaryProviders.set(taskType, capability.provider);
        }
      }
    }
    
    // Override primary providers for specific tasks
    this.primaryProviders.set(TaskType.CODE_GENERATION, AIProvider.DEEPSEEK);
    this.primaryProviders.set(TaskType.CODE_OPTIMIZATION, AIProvider.DEEPSEEK);
    this.primaryProviders.set(TaskType.PARAMETER_OPTIMIZATION, AIProvider.DEEPSEEK);
    
    logger.info('Neural Hybrid System initialized');
  }
  
  public static getInstance(): NeuralHybridSystem {
    if (!NeuralHybridSystem.instance) {
      NeuralHybridSystem.instance = new NeuralHybridSystem();
    }
    return NeuralHybridSystem.instance;
  }
  
  /**
   * Get the capabilities of available AI models
   * @returns List of AI model capabilities
   */
  public getModelCapabilities(): AIModelCapability[] {
    return this.modelCapabilities;
  }
  
  /**
   * Check if a task is supported by the system
   * @param taskType The type of task
   * @returns Whether the task is supported
   */
  public isTaskSupported(taskType: TaskType): boolean {
    return this.capabilityMap.has(taskType) && this.capabilityMap.get(taskType)!.length > 0;
  }
  
  /**
   * Get the best provider for a specific task
   * @param taskType The type of task
   * @returns The best provider or undefined if not supported
   */
  public getBestProviderForTask(taskType: TaskType): AIProvider | undefined {
    return this.primaryProviders.get(taskType);
  }
  
  /**
   * Generate market insights with the best-suited AI model
   * @param marketData Market data to analyze
   * @param provider Optional specific provider to use
   * @returns Market insights with provider information
   */
  public async generateMarketInsights(
    marketData: MarketData,
    provider: AIProvider = AIProvider.PERPLEXITY
  ): Promise<HybridResult<MarketInsight>> {
    const startTime = Date.now();
    
    if (provider === AIProvider.DEEPSEEK) {
      logger.warn('DeepSeek is not optimized for market insights. Falling back to Perplexity.');
      provider = AIProvider.PERPLEXITY;
    }
    
    // Use Perplexity for market insights
    const insight = await perplexityService.generateMarketInsights(marketData);
    
    const processingTime = Date.now() - startTime;
    
    return {
      result: insight,
      provider: AIProvider.PERPLEXITY,
      model: perplexityService.getModel(),
      confidence: insight.confidence,
      processingTime,
      tokenUsage: {
        prompt: 500, // Estimated
        completion: 1000, // Estimated
        total: 1500 // Estimated
      }
    };
  }
  
  /**
   * Enhance a strategy with the best-suited AI model
   * @param strategy The strategy to enhance
   * @param marketData Current market data
   * @param provider Optional specific provider to use
   * @returns Strategy enhancement with provider information
   */
  public async enhanceStrategy(
    strategy: Strategy,
    marketData: MarketData,
    provider: AIProvider = AIProvider.HYBRID
  ): Promise<HybridResult<StrategyEnhancement>> {
    const startTime = Date.now();
    
    // For hybrid approach, we'll use both models and combine results
    if (provider === AIProvider.HYBRID) {
      // Use Perplexity for strategy enhancement suggestions
      const enhancement = await perplexityService.enhanceStrategy(strategy, marketData);
      
      // If DeepSeek is available, use it for parameter optimization
      if (deepseekService.isAvailable() && strategy.parameters) {
        try {
          // Extract quantitative parameters for optimization
          const quantParams: QuantitativeParameters = {
            timeframe: strategy.timeframe || '15m',
            lookbackPeriod: strategy.parameters.lookbackPeriod || 14,
            entryThreshold: strategy.parameters.entryThreshold || 0.5,
            exitThreshold: strategy.parameters.exitThreshold || 0.5,
            stopLossPercentage: strategy.stop_loss || 5,
            takeProfitPercentage: strategy.take_profit || 10,
            positionSize: strategy.position_size || 0.1,
            maxOpenPositions: strategy.parameters.maxOpenPositions || 1,
            indicators: []
          };
          
          // Add indicators if available
          if (strategy.parameters.indicators) {
            for (const [name, params] of Object.entries(strategy.parameters.indicators)) {
              if (typeof params === 'object') {
                quantParams.indicators.push({
                  name,
                  parameters: params as Record<string, number>,
                  weight: (params as any).weight || 1
                });
              }
            }
          }
          
          // Use DeepSeek to optimize parameters
          const perfMetrics = {
            winRate: strategy.metrics?.win_rate || 0.5,
            profitFactor: strategy.metrics?.profit_factor || 1.2,
            maxDrawdown: strategy.metrics?.max_drawdown || 15,
            averageProfit: strategy.metrics?.avg_profit || 2,
            averageLoss: strategy.metrics?.avg_loss || 1.5,
            sharpeRatio: strategy.metrics?.sharpe_ratio || 0.8
          };
          
          const optimizationResult = await deepseekService.optimizeParameters(
            strategy.type,
            quantParams,
            perfMetrics,
            'risk_adjusted_return'
          );
          
          // Merge the optimized parameters into the enhancement
          enhancement.improvements.parameters = {
            ...enhancement.improvements.parameters,
            ...optimizationResult.optimizedParameters
          };
          
          // Update reasoning with parameter optimization details
          enhancement.reasoning += '\n\nParameter Optimization Details:\n' + optimizationResult.explanation;
          
          // Confidence is the average of both models
          enhancement.confidence = (enhancement.confidence + 0.8) / 2;
        } catch (error) {
          logger.error('Error in DeepSeek parameter optimization:', error);
          // Continue with just the Perplexity results
        }
      }
      
      const processingTime = Date.now() - startTime;
      
      return {
        result: enhancement,
        provider: AIProvider.HYBRID,
        model: 'perplexity+deepseek',
        confidence: enhancement.confidence,
        processingTime,
        tokenUsage: {
          prompt: 800, // Estimated
          completion: 1200, // Estimated
          total: 2000 // Estimated
        }
      };
    } else if (provider === AIProvider.PERPLEXITY) {
      // Use only Perplexity
      const enhancement = await perplexityService.enhanceStrategy(strategy, marketData);
      
      const processingTime = Date.now() - startTime;
      
      return {
        result: enhancement,
        provider: AIProvider.PERPLEXITY,
        model: perplexityService.getModel(),
        confidence: enhancement.confidence,
        processingTime,
        tokenUsage: {
          prompt: 600, // Estimated
          completion: 1000, // Estimated
          total: 1600 // Estimated
        }
      };
    } else {
      // DeepSeek isn't ideal for full strategy enhancement, but could do parameter optimization
      logger.warn('DeepSeek is not optimized for full strategy enhancement. Using parameter optimization only.');
      
      // Extract current parameters
      const quantParams: QuantitativeParameters = {
        timeframe: strategy.timeframe || '15m',
        lookbackPeriod: strategy.parameters?.lookbackPeriod || 14,
        entryThreshold: strategy.parameters?.entryThreshold || 0.5,
        exitThreshold: strategy.parameters?.exitThreshold || 0.5,
        stopLossPercentage: strategy.stop_loss || 5,
        takeProfitPercentage: strategy.take_profit || 10,
        positionSize: strategy.position_size || 0.1,
        maxOpenPositions: strategy.parameters?.maxOpenPositions || 1,
        indicators: []
      };
      
      // Add indicators if available
      if (strategy.parameters?.indicators) {
        for (const [name, params] of Object.entries(strategy.parameters.indicators)) {
          if (typeof params === 'object') {
            quantParams.indicators.push({
              name,
              parameters: params as Record<string, number>,
              weight: (params as any).weight || 1
            });
          }
        }
      }
      
      // Use DeepSeek to optimize parameters
      const perfMetrics = {
        winRate: strategy.metrics?.win_rate || 0.5,
        profitFactor: strategy.metrics?.profit_factor || 1.2,
        maxDrawdown: strategy.metrics?.max_drawdown || 15,
        averageProfit: strategy.metrics?.avg_profit || 2,
        averageLoss: strategy.metrics?.avg_loss || 1.5,
        sharpeRatio: strategy.metrics?.sharpe_ratio || 0.8
      };
      
      const optimizationResult = await deepseekService.optimizeParameters(
        strategy.type,
        quantParams,
        perfMetrics,
        'risk_adjusted_return'
      );
      
      // Convert to strategy enhancement format
      const enhancement: StrategyEnhancement = {
        original: {
          id: strategy.id,
          name: strategy.name,
          description: strategy.description || ''
        },
        improvements: {
          parameters: optimizationResult.optimizedParameters,
          logicEnhancements: ['Parameter optimization only, no logic changes suggested'],
          riskManagement: [
            `Adjusted stop loss to ${optimizationResult.optimizedParameters.stopLossPercentage}%`,
            `Adjusted take profit to ${optimizationResult.optimizedParameters.takeProfitPercentage}%`
          ],
          expectedImpact: `${optimizationResult.expectedImprovements.winRate} win rate, ${optimizationResult.expectedImprovements.profitFactor} profit factor`
        },
        reasoning: optimizationResult.explanation,
        confidence: 0.7
      };
      
      const processingTime = Date.now() - startTime;
      
      return {
        result: enhancement,
        provider: AIProvider.DEEPSEEK,
        model: deepseekService.getModel(),
        confidence: 0.7,
        processingTime,
        tokenUsage: {
          prompt: 700, // Estimated
          completion: 1100, // Estimated
          total: 1800 // Estimated
        }
      };
    }
  }
  
  /**
   * Evaluate a signal using the best-suited AI model
   * @param signal The signal to evaluate
   * @param marketData Current market data
   * @param provider Optional specific provider to use
   * @returns Signal evaluation with provider information
   */
  public async evaluateSignal(
    signal: TradingSignal,
    marketData: MarketData,
    provider: AIProvider = AIProvider.PERPLEXITY
  ): Promise<HybridResult<{
    valid: boolean;
    confidence: number;
    reasoning: string;
    recommendations: string[];
  }>> {
    const startTime = Date.now();
    
    if (provider !== AIProvider.PERPLEXITY) {
      logger.warn('Only Perplexity is supported for signal evaluation. Using Perplexity.');
    }
    
    // Use Perplexity for signal evaluation
    const evaluation = await perplexityService.evaluateSignal(signal, marketData);
    
    const processingTime = Date.now() - startTime;
    
    return {
      result: evaluation,
      provider: AIProvider.PERPLEXITY,
      model: perplexityService.getModel(),
      confidence: evaluation.confidence,
      processingTime,
      tokenUsage: {
        prompt: 400, // Estimated
        completion: 600, // Estimated
        total: 1000 // Estimated
      }
    };
  }
  
  /**
   * Generate implementation code for a strategy
   * @param strategy The strategy to implement
   * @param provider Optional specific provider to use
   * @returns Strategy implementation with provider information
   */
  public async generateStrategyImplementation(
    strategy: Strategy,
    provider: AIProvider = AIProvider.DEEPSEEK
  ): Promise<HybridResult<TradingLogicImplementation>> {
    const startTime = Date.now();
    
    if (provider !== AIProvider.DEEPSEEK) {
      logger.warn('DeepSeek is best for code generation. Switching to DeepSeek.');
      provider = AIProvider.DEEPSEEK;
    }
    
    // Use DeepSeek for code generation
    const implementation = await deepseekService.generateStrategyImplementation(strategy);
    
    const processingTime = Date.now() - startTime;
    
    return {
      result: implementation,
      provider: AIProvider.DEEPSEEK,
      model: deepseekService.getModel(),
      confidence: 0.9, // DeepSeek has high confidence for code generation
      processingTime,
      tokenUsage: {
        prompt: 600, // Estimated
        completion: 1500, // Estimated
        total: 2100 // Estimated
      }
    };
  }
  
  /**
   * Analyze transaction patterns for insights
   * @param transactions Recent transactions to analyze
   * @param provider Optional specific provider to use
   * @returns Transaction pattern analysis with provider information
   */
  public async analyzeTransactionPatterns(
    transactions: Transaction[],
    provider: AIProvider = AIProvider.PERPLEXITY
  ): Promise<HybridResult<{
    patterns: string[];
    risks: string[];
    efficiency: number;
    recommendations: string[];
  }>> {
    const startTime = Date.now();
    
    if (provider !== AIProvider.PERPLEXITY) {
      logger.warn('Only Perplexity is supported for transaction analysis. Using Perplexity.');
    }
    
    // Use Perplexity for transaction analysis
    const analysis = await perplexityService.analyzeTransactionPatterns(transactions);
    
    const processingTime = Date.now() - startTime;
    
    return {
      result: analysis,
      provider: AIProvider.PERPLEXITY,
      model: perplexityService.getModel(),
      confidence: 0.8,
      processingTime,
      tokenUsage: {
        prompt: 800, // Estimated
        completion: 1000, // Estimated
        total: 1800 // Estimated
      }
    };
  }
  
  /**
   * Optimize code for performance
   * @param code Code to optimize
   * @param requirements Performance requirements
   * @param context System context
   * @param provider Optional specific provider to use
   * @returns Optimized code with provider information
   */
  public async optimizeCode(
    code: string,
    requirements: string,
    context: string,
    provider: AIProvider = AIProvider.DEEPSEEK
  ): Promise<HybridResult<{
    optimizedCode: string;
    optimizationExplanation: string;
    benchmarkResults: string;
    memoryUsageImprovements: string;
  }>> {
    const startTime = Date.now();
    
    if (provider !== AIProvider.DEEPSEEK) {
      logger.warn('DeepSeek is best for code optimization. Switching to DeepSeek.');
      provider = AIProvider.DEEPSEEK;
    }
    
    // Use DeepSeek for code optimization
    const optimization = await deepseekService.optimizeCode(code, requirements, context);
    
    const processingTime = Date.now() - startTime;
    
    return {
      result: optimization,
      provider: AIProvider.DEEPSEEK,
      model: deepseekService.getModel(),
      confidence: 0.85,
      processingTime,
      tokenUsage: {
        prompt: 1000, // Estimated
        completion: 1500, // Estimated
        total: 2500 // Estimated
      }
    };
  }
  
  /**
   * Generate diagnostic code for troubleshooting
   * @param issue Issue description
   * @param code Related code
   * @param context System context
   * @param provider Optional specific provider to use
   * @returns Diagnostic code with provider information
   */
  public async generateDiagnosticCode(
    issue: string,
    code: string,
    context: string,
    provider: AIProvider = AIProvider.DEEPSEEK
  ): Promise<HybridResult<{
    diagnosticCode: string;
    explanation: string;
    fixCode: string;
    testCode: string;
  }>> {
    const startTime = Date.now();
    
    if (provider !== AIProvider.DEEPSEEK) {
      logger.warn('DeepSeek is best for diagnostic code. Switching to DeepSeek.');
      provider = AIProvider.DEEPSEEK;
    }
    
    // Use DeepSeek for diagnostic code
    const diagnostic = await deepseekService.generateDiagnosticCode(issue, code, context);
    
    const processingTime = Date.now() - startTime;
    
    return {
      result: diagnostic,
      provider: AIProvider.DEEPSEEK,
      model: deepseekService.getModel(),
      confidence: 0.8,
      processingTime,
      tokenUsage: {
        prompt: 800, // Estimated
        completion: 1200, // Estimated
        total: 2000 // Estimated
      }
    };
  }
}

// Export the singleton instance
export const neuralHybridSystem = NeuralHybridSystem.getInstance();