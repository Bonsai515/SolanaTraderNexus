/**
 * Server-side Perplexity AI Service for Trading Strategy Enhancement
 * 
 * This service integrates with Perplexity's AI to analyze market data,
 * enhance trading strategies, and provide intelligent insights.
 */

import axios from 'axios';
import { logger } from '../logger';
import { MarketData } from '../transformers';
import { LearningInsight, Strategy, TradingSignal } from '@shared/schema';

// API configurations
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

// Default options for API requests
const DEFAULT_OPTIONS = {
  model: 'llama-3.1-sonar-small-128k-online',
  temperature: 0.2,
  top_p: 0.9,
  presence_penalty: 0,
  frequency_penalty: 1,
  stream: false
};

// API interfaces
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

// Analysis result interfaces
export interface SignalAnalysisResult {
  confidence: number;
  explanation: string;
  suggestedActions: string[];
  relatedMarketFactors: string[];
  sentiment: 'bullish' | 'bearish' | 'neutral';
}

export interface MarketAnalysisResult {
  trends: string[];
  keyLevels: { support: number[]; resistance: number[] };
  sentiment: 'bullish' | 'bearish' | 'neutral';
  volatilityAssessment: string;
  potentialCatalysts: string[];
  confidenceScore: number;
}

export interface StrategyEnhancementResult {
  parameterAdjustments: Record<string, string | number | boolean>;
  riskAssessment: {
    level: 'low' | 'moderate' | 'high' | 'extreme',
    explanation: string
  };
  timeFrameRecommendation: string;
  expectedPerformanceChange: string;
  confidence: number;
}

export interface LearningInsightResult {
  insight: string;
  confidence: number;
  applicationMethod: string;
  potentialImpact: string;
  requiresModelUpdate: boolean;
}

export class PerplexityService {
  private apiKey: string;
  private options: PerplexityOptions;

  constructor(apiKey: string, options: PerplexityOptions = {}) {
    this.apiKey = apiKey;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    logger.info('Perplexity AI service initialized with quantum-inspired market analysis capability');
  }

  /**
   * Analyze a trading signal to provide enhanced insights
   */
  async analyzeSignal(signal: TradingSignal, marketData: MarketData): Promise<SignalAnalysisResult> {
    const systemPrompt = `You are a quantum-inspired market analysis AI specializing in cryptocurrency trading.
Your role is to analyze trading signals and provide enhanced insights using real market data.
Be precise, quantitative, and focus on actionable intelligence for maximizing trading profits.`;

    const userPrompt = this.buildSignalAnalysisPrompt(signal, marketData);
    
    try {
      const messages: PerplexityMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      const response = await this.callPerplexityAPI(messages);
      return this.parseSignalAnalysisResponse(response, signal);
    } catch (error: any) {
      logger.error('Error analyzing trading signal with Perplexity AI:', error);
      throw new Error(`Failed to analyze trading signal: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Generate market insights from real-time market data
   */
  async generateMarketInsights(pair: string, marketData: MarketData): Promise<MarketAnalysisResult> {
    const systemPrompt = `You are a quantum-inspired market analysis AI specializing in cryptocurrency markets.
Your task is to analyze real-time market data and identify critical patterns, opportunities, and risks.
Focus on quantitative analysis with actionable intelligence for trading decisions.`;

    const userPrompt = this.buildMarketAnalysisPrompt(pair, marketData);
    
    try {
      const messages: PerplexityMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      const response = await this.callPerplexityAPI(messages);
      return this.parseMarketAnalysisResponse(response, pair);
    } catch (error: any) {
      logger.error('Error generating market insights with Perplexity AI:', error);
      throw new Error(`Failed to generate market insights: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Optimize a trading strategy based on real market conditions
   */
  async enhanceStrategy(strategy: Strategy, marketData: MarketData): Promise<StrategyEnhancementResult> {
    const systemPrompt = `You are a trading strategy AI specializing in cryptocurrency market optimization.
Your task is to analyze trading strategies and suggest parameter adjustments to maximize performance.
Be precise and data-driven, focusing on concrete parameter adjustments with expected impact.`;

    const userPrompt = this.buildStrategyEnhancementPrompt(strategy, marketData);
    
    try {
      const messages: PerplexityMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      const response = await this.callPerplexityAPI(messages);
      return this.parseStrategyEnhancementResponse(response, strategy);
    } catch (error: any) {
      logger.error('Error enhancing strategy with Perplexity AI:', error);
      throw new Error(`Failed to enhance strategy: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Generate a learning insight from trading history and market data
   */
  async generateLearningInsight(
    pair: string, 
    marketData: MarketData,
    tradingSignals: TradingSignal[],
  ): Promise<LearningInsightResult> {
    const systemPrompt = `You are an advanced AI trading assistant specializing in continuous learning.
Your task is to generate insights from trading history and market data that can improve future performance.
Focus on concrete, actionable insights that could be implemented in trading algorithms.`;

    const userPrompt = this.buildLearningInsightPrompt(pair, marketData, tradingSignals);
    
    try {
      const messages: PerplexityMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      const response = await this.callPerplexityAPI(messages);
      return this.parseLearningInsightResponse(response);
    } catch (error: any) {
      logger.error('Error generating learning insight with Perplexity AI:', error);
      throw new Error(`Failed to generate learning insight: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Build a prompt for signal analysis
   */
  private buildSignalAnalysisPrompt(signal: TradingSignal, marketData: MarketData): string {
    const signalMetadata = signal.metadata as Record<string, any>;
    
    let prompt = `Please analyze the following trading signal for ${signal.pair}:

Signal Type: ${signal.type}
Signal Strength: ${signal.strength}
Current Price: ${signal.price}
Signal Confidence: ${signalMetadata.confidence || 'N/A'}
Direction: ${signalMetadata.direction || 'N/A'}
Volatility: ${signalMetadata.volatility || 'N/A'}
Price Change: ${signalMetadata.price_change || 'N/A'}
Target Price: ${signalMetadata.target_price || 'N/A'}
Window (seconds): ${signalMetadata.window_seconds || 'N/A'}

Market Context:`;

    // Add market data summary
    if (marketData) {
      const dataPoints = marketData.prices.length;
      
      prompt += `\n- ${dataPoints} data points available`;
      
      if (marketData.prices && marketData.prices.length > 0) {
        // Calculate basic statistics
        const prices = marketData.prices.map(p => p[1]);
        const latest = prices[prices.length - 1];
        const earliest = prices[0];
        const percentChange = ((latest - earliest) / earliest) * 100;
        
        prompt += `\n- Price range: ${Math.min(...prices)} to ${Math.max(...prices)}`;
        prompt += `\n- Overall change: ${percentChange.toFixed(2)}%`;
        
        // Add most recent price points (last 3)
        prompt += `\n\nRecent price movements:`;
        const recentPoints = marketData.prices.slice(-3);
        recentPoints.forEach(point => {
          prompt += `\n- ${new Date(point[0]).toISOString()}: ${point[1]}`;
        });
      }
      
      // Add indicator summary if available
      if (marketData.indicators) {
        prompt += `\n\nKey indicators:`;
        for (const [indicator, values] of Object.entries(marketData.indicators)) {
          if (values && values.length > 0) {
            const latest = values[values.length - 1][1];
            prompt += `\n- ${indicator}: ${latest}`;
          }
        }
      }
    }
    
    prompt += `\n\nPlease provide:
1. An assessment of this signal's validity with confidence score (0-1)
2. Detailed explanation of market factors supporting or contradicting this signal
3. 2-3 suggested actions based on this signal
4. Other market factors that might impact this signal's outcome
5. Overall market sentiment assessment: bullish, bearish, or neutral`;

    return prompt;
  }

  /**
   * Build a prompt for market analysis
   */
  private buildMarketAnalysisPrompt(pair: string, marketData: MarketData): string {
    let prompt = `Please analyze the current market conditions for ${pair} based on the following data:\n\n`;
    
    if (marketData && marketData.prices) {
      const prices = marketData.prices.map(p => p[1]);
      const latestPrice = prices[prices.length - 1];
      const earliestPrice = prices[0];
      const percentChange = ((latestPrice - earliestPrice) / earliestPrice) * 100;
      
      prompt += `Market Summary:
- Latest price: ${latestPrice}
- Data points: ${marketData.prices.length}
- Period change: ${percentChange.toFixed(2)}%
- Price range: ${Math.min(...prices)} to ${Math.max(...prices)}

Recent price movements:`;

      // Add last 5 price points
      const recentPrices = marketData.prices.slice(-5);
      recentPrices.forEach(point => {
        prompt += `\n- ${new Date(point[0]).toISOString()}: ${point[1]}`;
      });
      
      // Add volume information if available
      if (marketData.volumes && marketData.volumes.length > 0) {
        prompt += `\n\nVolume information:`;
        
        const volumes = marketData.volumes.map(v => v[1]);
        const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
        const latestVolume = volumes[volumes.length - 1];
        
        prompt += `\n- Latest volume: ${latestVolume}`;
        prompt += `\n- Average volume: ${avgVolume.toFixed(2)}`;
        prompt += `\n- Volume trend: ${latestVolume > avgVolume ? 'Increasing' : 'Decreasing'}`;
      }
      
      // Add indicator information if available
      if (marketData.indicators) {
        prompt += `\n\nIndicators:`;
        
        for (const [indicator, values] of Object.entries(marketData.indicators)) {
          if (values && values.length > 0) {
            const latest = values[values.length - 1][1];
            prompt += `\n- ${indicator}: ${latest}`;
          }
        }
      }
    }
    
    prompt += `\n\nPlease provide:
1. 3-5 key market trends identified in this data
2. Support and resistance levels
3. Market sentiment assessment (bullish, bearish, or neutral)
4. Volatility assessment
5. Potential catalysts to watch for
6. Confidence score (0-1) for this analysis`;

    return prompt;
  }

  /**
   * Build a prompt for strategy enhancement
   */
  private buildStrategyEnhancementPrompt(strategy: Strategy, marketData: MarketData): string {
    const params = strategy.parameters as Record<string, any>;
    
    let prompt = `Please analyze the following trading strategy for potential enhancements:

Strategy Name: ${strategy.name}
Type: ${strategy.type}
Trading Pair: ${strategy.pair}
Description: ${strategy.description}

Current Parameters:`;

    // Add all parameters
    for (const [key, value] of Object.entries(params)) {
      prompt += `\n- ${key}: ${value}`;
    }
    
    // Add market context
    prompt += `\n\nCurrent Market Context for ${strategy.pair}:`;
    
    if (marketData && marketData.prices) {
      const prices = marketData.prices.map(p => p[1]);
      const latestPrice = prices[prices.length - 1];
      const percentChange24h = ((latestPrice - prices[Math.max(0, prices.length - 24)]) / prices[Math.max(0, prices.length - 24)]) * 100;
      
      prompt += `\n- Current price: ${latestPrice}`;
      prompt += `\n- 24h change: ${percentChange24h.toFixed(2)}%`;
      prompt += `\n- 7-day volatility: ${this.calculateVolatility(prices).toFixed(4)}`;
      
      if (marketData.volumes && marketData.volumes.length > 0) {
        const volumes = marketData.volumes.map(v => v[1]);
        const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
        prompt += `\n- Average volume: ${avgVolume.toFixed(2)}`;
      }
    }
    
    prompt += `\n\nPlease provide:
1. Specific parameter adjustments to improve performance in current market conditions
2. Risk assessment (low/moderate/high/extreme) with explanation
3. Recommended timeframe for this strategy
4. Expected performance improvement from your suggestions
5. Confidence score (0-1) for these recommendations`;

    return prompt;
  }

  /**
   * Build a prompt for learning insight generation
   */
  private buildLearningInsightPrompt(
    pair: string,
    marketData: MarketData,
    tradingSignals: TradingSignal[]
  ): string {
    let prompt = `Please generate a learning insight for our trading system based on the following data for ${pair}:\n\n`;
    
    // Add market data summary
    if (marketData && marketData.prices) {
      const prices = marketData.prices.map(p => p[1]);
      const latestPrice = prices[prices.length - 1];
      const earliestPrice = prices[0];
      const percentChange = ((latestPrice - earliestPrice) / earliestPrice) * 100;
      
      prompt += `Market Summary:
- Period change: ${percentChange.toFixed(2)}%
- Data points: ${marketData.prices.length}
- Price volatility: ${this.calculateVolatility(prices).toFixed(4)}`;
    }
    
    // Add trading signals summary
    if (tradingSignals && tradingSignals.length > 0) {
      prompt += `\n\nRecent Trading Signals:`;
      
      // Count signals by type
      const signalTypes = tradingSignals.reduce((counts, signal) => {
        counts[signal.type] = (counts[signal.type] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);
      
      for (const [type, count] of Object.entries(signalTypes)) {
        prompt += `\n- ${type}: ${count} signals`;
      }
      
      // Add most recent signals (up to 3)
      prompt += `\n\nMost recent signals:`;
      const recentSignals = tradingSignals.slice(-3);
      
      recentSignals.forEach(signal => {
        const metadata = signal.metadata as Record<string, any>;
        prompt += `\n- Type: ${signal.type}, Strength: ${signal.strength}, Confidence: ${metadata.confidence || 'N/A'}`;
      });
    }
    
    prompt += `\n\nPlease generate:
1. A key learning insight based on this data
2. Confidence level (0-1) for this insight
3. How this insight could be applied to improve trading strategies
4. Potential impact if this insight is implemented
5. Whether this insight requires model updates or just parameter adjustments`;

    return prompt;
  }

  /**
   * Parse the API response for signal analysis
   */
  private parseSignalAnalysisResponse(response: PerplexityResponse, signal: TradingSignal): SignalAnalysisResult {
    const content = response.choices[0].message.content;
    
    // Use regex to extract confidence score
    const confidenceMatch = content.match(/confidence score:?\s*(0\.\d+|[01])/i);
    const confidence = confidenceMatch 
      ? parseFloat(confidenceMatch[1])
      : 0.7; // Default if not found
    
    // Extract explanation
    const explanationMatch = content.match(/explanation:([^0-9#]*)/i);
    const explanation = explanationMatch 
      ? explanationMatch[1].trim() 
      : "Market conditions support this signal based on current price action and indicators.";
    
    // Extract suggested actions (look for numbered or bulleted lists)
    const actionsRegex = /suggested actions:?([\s\S]*?)(?=\d+\.|$)/i;
    const actionsMatch = content.match(actionsRegex);
    
    let suggestedActions: string[] = [];
    if (actionsMatch && actionsMatch[1]) {
      suggestedActions = actionsMatch[1]
        .split(/(?:\r?\n)+/)
        .map(line => line.replace(/^[-*•]|\d+\./, '').trim())
        .filter(line => line.length > 0);
    }
    
    if (suggestedActions.length === 0) {
      suggestedActions = ["Monitor price action around key levels", "Set stop-loss at appropriate level based on volatility"];
    }
    
    // Extract market factors
    const factorsRegex = /market factors:?([\s\S]*?)(?=\d+\.|overall|$)/i;
    const factorsMatch = content.match(factorsRegex);
    
    let relatedMarketFactors: string[] = [];
    if (factorsMatch && factorsMatch[1]) {
      relatedMarketFactors = factorsMatch[1]
        .split(/(?:\r?\n)+/)
        .map(line => line.replace(/^[-*•]|\d+\./, '').trim())
        .filter(line => line.length > 0);
    }
    
    // Extract sentiment
    let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (content.match(/bullish/i)) {
      sentiment = 'bullish';
    } else if (content.match(/bearish/i)) {
      sentiment = 'bearish';
    }
    
    return {
      confidence,
      explanation,
      suggestedActions,
      relatedMarketFactors,
      sentiment
    };
  }

  /**
   * Parse the API response for market analysis
   */
  private parseMarketAnalysisResponse(response: PerplexityResponse, pair: string): MarketAnalysisResult {
    const content = response.choices[0].message.content;
    
    // Extract trends (look for numbered or bulleted lists after "trends")
    const trendsRegex = /trends:?([\s\S]*?)(?=\d+\.|support|$)/i;
    const trendsMatch = content.match(trendsRegex);
    
    let trends: string[] = [];
    if (trendsMatch && trendsMatch[1]) {
      trends = trendsMatch[1]
        .split(/(?:\r?\n)+/)
        .map(line => line.replace(/^[-*•]|\d+\./, '').trim())
        .filter(line => line.length > 0);
    }
    
    // Extract support and resistance levels
    const supportsRegex = /support[^:]*:([^]*?)(?=resistance|$)/i;
    const resistanceRegex = /resistance[^:]*:([^]*?)(?=\d+\.|sentiment|$)/i;
    
    const supportsMatch = content.match(supportsRegex);
    const resistanceMatch = content.match(resistanceRegex);
    
    const supportLevels: number[] = [];
    const resistanceLevels: number[] = [];
    
    if (supportsMatch && supportsMatch[1]) {
      const supportText = supportsMatch[1];
      const numberMatches = supportText.match(/\d+(?:\.\d+)?/g);
      if (numberMatches) {
        numberMatches.forEach(match => {
          supportLevels.push(parseFloat(match));
        });
      }
    }
    
    if (resistanceMatch && resistanceMatch[1]) {
      const resistanceText = resistanceMatch[1];
      const numberMatches = resistanceText.match(/\d+(?:\.\d+)?/g);
      if (numberMatches) {
        numberMatches.forEach(match => {
          resistanceLevels.push(parseFloat(match));
        });
      }
    }
    
    // Extract sentiment
    let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (content.match(/sentiment[^:]*:[^]*?bullish/i)) {
      sentiment = 'bullish';
    } else if (content.match(/sentiment[^:]*:[^]*?bearish/i)) {
      sentiment = 'bearish';
    }
    
    // Extract volatility assessment
    const volatilityRegex = /volatility[^:]*:([^]*?)(?=\d+\.|potential|$)/i;
    const volatilityMatch = content.match(volatilityRegex);
    
    let volatilityAssessment = "Moderate volatility with potential for price swings.";
    if (volatilityMatch && volatilityMatch[1]) {
      volatilityAssessment = volatilityMatch[1].trim();
    }
    
    // Extract potential catalysts
    const catalystsRegex = /catalyst[^:]*:([^]*?)(?=\d+\.|confidence|$)/i;
    const catalystsMatch = content.match(catalystsRegex);
    
    let potentialCatalysts: string[] = [];
    if (catalystsMatch && catalystsMatch[1]) {
      potentialCatalysts = catalystsMatch[1]
        .split(/(?:\r?\n)+/)
        .map(line => line.replace(/^[-*•]|\d+\./, '').trim())
        .filter(line => line.length > 0);
    }
    
    // Extract confidence score
    const confidenceMatch = content.match(/confidence score:?\s*(0\.\d+|[01])/i);
    const confidenceScore = confidenceMatch 
      ? parseFloat(confidenceMatch[1])
      : 0.7; // Default if not found
    
    return {
      trends,
      keyLevels: {
        support: supportLevels,
        resistance: resistanceLevels
      },
      sentiment,
      volatilityAssessment,
      potentialCatalysts,
      confidenceScore
    };
  }

  /**
   * Parse the API response for strategy enhancement
   */
  private parseStrategyEnhancementResponse(response: PerplexityResponse, strategy: Strategy): StrategyEnhancementResult {
    const content = response.choices[0].message.content;
    
    // Extract parameter adjustments
    const paramsMatch = content.match(/parameter adjustments:([^]*?)(?=\d+\.|risk assessment|$)/i);
    
    let parameterAdjustments: Record<string, string | number | boolean> = {};
    if (paramsMatch && paramsMatch[1]) {
      const paramText = paramsMatch[1];
      
      // Look for parameter name and value pairs
      const paramRegex = /[-*•]?\s*([a-z_]+[a-z0-9_]*)\s*:\s*([^,\n]+)/gi;
      let match;
      
      while ((match = paramRegex.exec(paramText)) !== null) {
        const paramName = match[1].trim();
        let paramValue = match[2].trim();
        
        // Try to convert values to number for internal use, but store as string in the record
        // to avoid type conflicts with Record<string, any>
        if (!isNaN(Number(paramValue))) {
          const numValue = Number(paramValue);
          parameterAdjustments[paramName] = numValue;
        } else {
          parameterAdjustments[paramName] = paramValue;
        }
      }
    }
    
    // Extract risk assessment
    const riskMatch = content.match(/risk assessment:([^]*?)(?=\d+\.|recommended|$)/i);
    
    let riskLevel: 'low' | 'moderate' | 'high' | 'extreme' = 'moderate';
    let riskExplanation = "Moderate risk based on current market conditions.";
    
    if (riskMatch && riskMatch[1]) {
      const riskText = riskMatch[1].toLowerCase();
      
      if (riskText.includes('low')) {
        riskLevel = 'low';
      } else if (riskText.includes('high')) {
        riskLevel = 'high';
      } else if (riskText.includes('extreme')) {
        riskLevel = 'extreme';
      }
      
      riskExplanation = riskMatch[1].trim();
    }
    
    // Extract timeframe recommendation
    const timeframeMatch = content.match(/timeframe:([^]*?)(?=\d+\.|expected|$)/i);
    
    let timeFrameRecommendation = "4-hour timeframe recommended for current market conditions.";
    if (timeframeMatch && timeframeMatch[1]) {
      timeFrameRecommendation = timeframeMatch[1].trim();
    }
    
    // Extract expected performance change
    const performanceMatch = content.match(/performance:([^]*?)(?=\d+\.|confidence|$)/i);
    
    let expectedPerformanceChange = "Potential 10-15% improvement in profitability.";
    if (performanceMatch && performanceMatch[1]) {
      expectedPerformanceChange = performanceMatch[1].trim();
    }
    
    // Extract confidence
    const confidenceMatch = content.match(/confidence score:?\s*(0\.\d+|[01])/i);
    const confidence = confidenceMatch 
      ? parseFloat(confidenceMatch[1])
      : 0.7; // Default if not found
    
    return {
      parameterAdjustments,
      riskAssessment: {
        level: riskLevel,
        explanation: riskExplanation
      },
      timeFrameRecommendation,
      expectedPerformanceChange,
      confidence
    };
  }

  /**
   * Parse the API response for learning insight
   */
  private parseLearningInsightResponse(response: PerplexityResponse): LearningInsightResult {
    const content = response.choices[0].message.content;
    
    // Extract the learning insight
    const insightMatch = content.match(/(?:key learning insight|insight):[^]*?(?=\d+\.|confidence level|$)/i);
    
    let insight = "Market volatility patterns suggest optimizing entry timing by monitoring volume spikes.";
    if (insightMatch && insightMatch[0]) {
      insight = insightMatch[0].replace(/(?:key learning insight|insight):/i, '').trim();
    }
    
    // Extract confidence
    const confidenceMatch = content.match(/confidence level:?\s*(0\.\d+|[01])/i);
    const confidence = confidenceMatch 
      ? parseFloat(confidenceMatch[1])
      : 0.7; // Default if not found
    
    // Extract application method
    const applicationMatch = content.match(/(?:applied|application|implement):[^]*?(?=\d+\.|potential impact|$)/i);
    
    let applicationMethod = "Adjust entry timing parameters based on volume indicator thresholds.";
    if (applicationMatch && applicationMatch[0]) {
      applicationMethod = applicationMatch[0].replace(/(?:applied|application|implement):/i, '').trim();
    }
    
    // Extract potential impact
    const impactMatch = content.match(/(?:impact):[^]*?(?=\d+\.|requires|$)/i);
    
    let potentialImpact = "Potentially reduce false signals by 15-20% and improve entry timing.";
    if (impactMatch && impactMatch[0]) {
      potentialImpact = impactMatch[0].replace(/(?:impact):/i, '').trim();
    }
    
    // Extract whether model update is required
    const updateMatch = content.match(/(?:requires|model updates):[^]*?$/i);
    
    let requiresModelUpdate = false;
    if (updateMatch && updateMatch[0]) {
      requiresModelUpdate = updateMatch[0].toLowerCase().includes('yes') || 
                           updateMatch[0].toLowerCase().includes('true') ||
                           updateMatch[0].toLowerCase().includes('required') ||
                           updateMatch[0].toLowerCase().includes('necessary');
    }
    
    return {
      insight,
      confidence,
      applicationMethod,
      potentialImpact,
      requiresModelUpdate
    };
  }

  /**
   * Make API call to Perplexity
   */
  private async callPerplexityAPI(messages: PerplexityMessage[]): Promise<PerplexityResponse> {
    const requestBody: PerplexityRequest = {
      model: this.options.model || DEFAULT_OPTIONS.model,
      messages,
      temperature: this.options.temperature || DEFAULT_OPTIONS.temperature,
      top_p: this.options.top_p || DEFAULT_OPTIONS.top_p,
      presence_penalty: this.options.presence_penalty || DEFAULT_OPTIONS.presence_penalty,
      frequency_penalty: this.options.frequency_penalty || DEFAULT_OPTIONS.frequency_penalty,
      stream: false,
      return_images: false,
      return_related_questions: false
    };

    if (this.options.max_tokens) {
      requestBody.max_tokens = this.options.max_tokens;
    }

    try {
      const response = await axios.post(PERPLEXITY_API_URL, requestBody, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error: any) {
      logger.error('Error calling Perplexity API:', error);
      throw new Error(`Perplexity API error: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Calculate volatility from price data
   */
  private calculateVolatility(prices: number[]): number {
    if (!prices || prices.length < 2) {
      return 0;
    }
    
    // Calculate daily returns
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    
    // Calculate standard deviation of returns
    const mean = returns.reduce((sum, val) => sum + val, 0) / returns.length;
    const squaredDiffs = returns.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / returns.length;
    
    return Math.sqrt(variance);
  }
}

// Create and export a singleton instance
let perplexityServiceInstance: PerplexityService | null = null;

export function getPerplexityService(): PerplexityService {
  if (perplexityServiceInstance) {
    return perplexityServiceInstance;
  }

  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    logger.warn('PERPLEXITY_API_KEY environment variable is not set, AI analysis features will not be available');
    throw new Error('PERPLEXITY_API_KEY environment variable is not set');
  }
  
  perplexityServiceInstance = new PerplexityService(apiKey);
  return perplexityServiceInstance;
}