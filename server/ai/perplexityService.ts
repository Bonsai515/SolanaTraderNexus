/**
 * Perplexity AI Service
 * 
 * This service provides advanced AI capabilities for the trading platform using
 * Perplexity's state-of-the-art language models. It enables analysis of market trends,
 * strategy evaluation, and insights generation based on real-time and historical data.
 */

import axios from 'axios';
import { logger } from '../logger';
import { Strategy, Transaction, TradingSignal } from '@shared/schema';

// Perplexity API URL
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

// Ensure API key is available
if (!process.env.PERPLEXITY_API_KEY) {
  logger.warn('PERPLEXITY_API_KEY environment variable is not set. AI features will be limited.');
}

// Type definitions for market data
export interface MarketData {
  pair: string;
  priceData: Array<[string, number]>; // [timestamp, price]
  volumeData: Array<[string, number]>; // [timestamp, volume]
  indicators: {
    rsi: Array<[string, number]>;
    macd: Array<[string, number]>;
    ema: Array<[string, number]>;
    supertrend: Array<[string, number]>;
    quantum: Array<[string, number]>;
  };
  orderBook?: Array<[string, Array<[number, number]>, Array<[number, number]>]>; // [timestamp, bids, asks]
  recentTrades?: Array<[string, number, number, string]>; // [timestamp, price, quantity, side]
  liquidityAnalysis?: {
    depthMap: Record<string, number>;
    slippage: Record<string, number>;
    concentration: number;
  };
}

// Types for Perplexity API
interface PerplexityMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface PerplexityRequest {
  model: string;
  messages: PerplexityMessage[];
  max_tokens?: number;
  temperature: number;
  top_p?: number;
  search_domain_filter?: string[];
  return_images?: boolean;
  return_related_questions?: boolean;
  search_recency_filter?: string;
  top_k?: number;
  stream?: boolean;
  presence_penalty?: number;
  frequency_penalty?: number;
}

interface PerplexityResponse {
  id: string;
  model: string;
  object: string;
  created: number;
  citations: string[];
  choices: {
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
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface MarketInsight {
  pair: string;
  timestamp: string;
  trend: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  summary: string;
  keyFactors: string[];
  technicalAnalysis: {
    support: number[];
    resistance: number[];
    indicators: Record<string, {
      value: number;
      interpretation: string;
    }>;
    outlook: string;
  };
  recommendations: string[];
  sources?: string[];
}

export interface StrategyEnhancement {
  original: {
    id: string;
    name: string;
    description: string;
  };
  improvements: {
    parameters: Record<string, any>;
    logicEnhancements: string[];
    riskManagement: string[];
    expectedImpact: string;
  };
  reasoning: string;
  confidence: number;
}

export class PerplexityService {
  private static instance: PerplexityService;
  private apiKey: string;
  private defaultModel: string = 'llama-3.1-sonar-small-128k-online';
  
  private constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY || '';
  }
  
  public static getInstance(): PerplexityService {
    if (!PerplexityService.instance) {
      PerplexityService.instance = new PerplexityService();
    }
    return PerplexityService.instance;
  }
  
  /**
   * Check if the Perplexity API service is available and configured
   * @returns Whether the service is available
   */
  public isAvailable(): boolean {
    return !!this.apiKey;
  }
  
  /**
   * Get the current model being used
   * @returns The model name
   */
  public getModel(): string {
    return this.defaultModel;
  }
  
  /**
   * Set the model to use for queries
   * @param model The model name
   */
  public setModel(model: string): void {
    if (['llama-3.1-sonar-small-128k-online', 'llama-3.1-sonar-large-128k-online', 'llama-3.1-sonar-huge-128k-online'].includes(model)) {
      this.defaultModel = model;
    } else {
      logger.warn(`Invalid Perplexity model: ${model}. Using default: ${this.defaultModel}`);
    }
  }
  
  /**
   * Make a request to the Perplexity API
   * @param messages Array of messages to send to the model
   * @param temperature Temperature setting (0-1)
   * @param maxTokens Maximum tokens to generate
   * @returns The API response
   */
  private async makeRequest(
    messages: PerplexityMessage[],
    temperature: number = 0.2,
    maxTokens?: number
  ): Promise<PerplexityResponse> {
    if (!this.isAvailable()) {
      throw new Error('Perplexity API key not configured');
    }
    
    const payload: PerplexityRequest = {
      model: this.defaultModel,
      messages,
      temperature,
      top_p: 0.9,
      search_domain_filter: [],
      return_images: false,
      return_related_questions: false,
      search_recency_filter: 'month',
      top_k: 0,
      stream: false,
      presence_penalty: 0,
      frequency_penalty: 1
    };
    
    if (maxTokens) {
      payload.max_tokens = maxTokens;
    }
    
    try {
      const response = await axios.post<PerplexityResponse>(
        PERPLEXITY_API_URL,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error: any) {
      logger.error('Error calling Perplexity API:', error.message);
      
      if (error.response) {
        logger.error('API response:', error.response.status, error.response.data);
      }
      
      throw new Error(`Perplexity API error: ${error.message}`);
    }
  }
  
  /**
   * Generate market insights based on provided market data
   * @param marketData The market data to analyze
   * @returns Insights about the market
   */
  public async generateMarketInsights(marketData: MarketData): Promise<MarketInsight> {
    // Format the market data for the prompt
    const latestPrice = marketData.priceData[marketData.priceData.length - 1][1];
    const latestVolume = marketData.volumeData[marketData.volumeData.length - 1][1];
    
    // Create recent price changes
    const recentPrices = marketData.priceData.slice(-25).map(p => p[1]);
    const priceChanges = recentPrices.map((price, i, arr) => {
      if (i === 0) return 0;
      return ((price - arr[i - 1]) / arr[i - 1]) * 100;
    }).slice(1);
    
    // Calculate average price change percentage
    const avgPriceChange = priceChanges.reduce((sum, change) => sum + change, 0) / priceChanges.length;
    
    // Get most recent indicator values
    const rsiValue = marketData.indicators.rsi.length > 0 ? 
      marketData.indicators.rsi[marketData.indicators.rsi.length - 1][1] : 'N/A';
    const macdValue = marketData.indicators.macd.length > 0 ? 
      marketData.indicators.macd[marketData.indicators.macd.length - 1][1] : 'N/A';
    const emaValue = marketData.indicators.ema.length > 0 ? 
      marketData.indicators.ema[marketData.indicators.ema.length - 1][1] : 'N/A';
    const quantumValue = marketData.indicators.quantum.length > 0 ? 
      marketData.indicators.quantum[marketData.indicators.quantum.length - 1][1] : 'N/A';
    
    // Create a summary of the market data
    const marketSummary = `
    Trading Pair: ${marketData.pair}
    Current Price: ${latestPrice}
    24h Volume: ${latestVolume}
    Average Recent Price Change: ${avgPriceChange.toFixed(2)}%
    
    Technical Indicators:
    - RSI: ${rsiValue}
    - MACD: ${macdValue}
    - EMA: ${emaValue}
    - Quantum: ${quantumValue}
    
    Recent Price Action:
    ${recentPrices.slice(-10).join(', ')}
    
    Order Book Depth: ${marketData.orderBook ? 'Available' : 'Not Available'}
    Recent Trades: ${marketData.recentTrades ? 'Available' : 'Not Available'}
    Liquidity Analysis: ${marketData.liquidityAnalysis ? 'Available' : 'Not Available'}
    `;
    
    // Define the messages for the API
    const messages: PerplexityMessage[] = [
      {
        role: 'system',
        content: `You are an expert cryptocurrency market analyst with deep knowledge of blockchain technology, trading patterns, and technical analysis for Solana tokens. Analyze the provided market data and generate comprehensive insights about the market conditions, trends, and trading opportunities. Your analysis should be data-driven, objective, and include technical factors that would be relevant to algorithmic trading systems. Structure your response as valid JSON matching the MarketInsight interface with properties for: pair, timestamp, trend, confidence, summary, keyFactors, technicalAnalysis (including support, resistance, indicators, outlook), and recommendations.`
      },
      {
        role: 'user',
        content: `Please analyze the following market data and provide insights:\n${marketSummary}`
      }
    ];
    
    // Make the request to Perplexity
    const response = await this.makeRequest(messages, 0.3);
    
    // Parse the response
    try {
      let content = response.choices[0].message.content;
      
      // If the response contains markdown code blocks, extract JSON
      if (content.includes('```json')) {
        const match = content.match(/```json\n([\s\S]*?)\n```/);
        if (match && match[1]) {
          content = match[1];
        }
      }
      
      // Sometimes the model wraps the JSON in explanation text, try to extract just the JSON
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      
      if (jsonStart >= 0 && jsonEnd >= 0) {
        content = content.substring(jsonStart, jsonEnd + 1);
      }
      
      const insight = JSON.parse(content) as MarketInsight;
      
      // Ensure timestamp is present
      if (!insight.timestamp) {
        insight.timestamp = new Date().toISOString();
      }
      
      // Add sources if available
      if (response.citations && response.citations.length > 0) {
        insight.sources = response.citations;
      }
      
      return insight;
    } catch (error) {
      logger.error('Error parsing Perplexity API response:', error);
      logger.debug('Raw response content:', response.choices[0].message.content);
      
      // Return a basic insight derived from the response text
      const content = response.choices[0].message.content;
      
      // Determine trend from content
      let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
      if (content.toLowerCase().includes('bullish') || content.toLowerCase().includes('positive')) {
        trend = 'bullish';
      } else if (content.toLowerCase().includes('bearish') || content.toLowerCase().includes('negative')) {
        trend = 'bearish';
      }
      
      return {
        pair: marketData.pair,
        timestamp: new Date().toISOString(),
        trend,
        confidence: 0.6,
        summary: content.substring(0, 300) + '...',
        keyFactors: ['Data extracted from analysis due to parsing error'],
        technicalAnalysis: {
          support: [latestPrice * 0.95, latestPrice * 0.9],
          resistance: [latestPrice * 1.05, latestPrice * 1.1],
          indicators: {
            rsi: { value: typeof rsiValue === 'number' ? rsiValue : 50, interpretation: 'Neutral' },
            macd: { value: typeof macdValue === 'number' ? macdValue : 0, interpretation: 'Neutral' }
          },
          outlook: 'See summary for detailed outlook'
        },
        recommendations: ['Manual review recommended due to parsing error']
      };
    }
  }
  
  /**
   * Enhance a trading strategy using AI analysis
   * @param strategy The strategy to enhance
   * @param marketData Recent market data for the strategy's pair
   * @returns Enhancement recommendations
   */
  public async enhanceStrategy(strategy: Strategy, marketData: MarketData): Promise<StrategyEnhancement> {
    // Extract and format strategy details
    const strategyDetails = `
    Strategy ID: ${strategy.id}
    Name: ${strategy.name}
    Description: ${strategy.description || 'N/A'}
    Trading Pair: ${strategy.pair}
    Type: ${strategy.type}
    Status: ${strategy.active ? 'Active' : 'Inactive'}
    
    Parameters:
    ${JSON.stringify(strategy.parameters, null, 2)}
    
    Entry Conditions:
    ${strategy.entry_conditions?.join('\n') || 'N/A'}
    
    Exit Conditions:
    ${strategy.exit_conditions?.join('\n') || 'N/A'}
    
    Risk Management:
    - Stop Loss: ${strategy.stop_loss || 'N/A'}
    - Take Profit: ${strategy.take_profit || 'N/A'}
    - Position Size: ${strategy.position_size || 'N/A'}
    
    Performance:
    - Win Rate: ${strategy.metrics?.win_rate || 'N/A'}
    - Profit Factor: ${strategy.metrics?.profit_factor || 'N/A'}
    - Avg Profit: ${strategy.metrics?.avg_profit || 'N/A'}
    - Avg Loss: ${strategy.metrics?.avg_loss || 'N/A'}
    - Max Drawdown: ${strategy.metrics?.max_drawdown || 'N/A'}
    `;
    
    // Format market data summary
    const marketSummary = `
    Current Market Conditions for ${marketData.pair}:
    Latest Price: ${marketData.priceData[marketData.priceData.length - 1][1]}
    24h Price Change: ${((marketData.priceData[marketData.priceData.length - 1][1] / marketData.priceData[0][1] - 1) * 100).toFixed(2)}%
    24h Volume: ${marketData.volumeData[marketData.volumeData.length - 1][1]}
    
    Technical Indicators:
    - RSI: ${marketData.indicators.rsi[marketData.indicators.rsi.length - 1][1]}
    - MACD: ${marketData.indicators.macd[marketData.indicators.macd.length - 1][1]}
    - EMA: ${marketData.indicators.ema[marketData.indicators.ema.length - 1][1]}
    - Quantum: ${marketData.indicators.quantum[marketData.indicators.quantum.length - 1][1]}
    `;
    
    // Define the messages for the API
    const messages: PerplexityMessage[] = [
      {
        role: 'system',
        content: `You are an expert algorithmic trading strategy developer with deep knowledge of cryptocurrency markets and Solana trading. Analyze the provided strategy and current market conditions, then suggest detailed enhancements to improve its performance. Focus on specific parameter adjustments, logic improvements, and risk management enhancements. Your response should be structured as a JSON object matching the StrategyEnhancement interface including original strategy details, specific improvements with parameter values, logic enhancements, risk management changes, expected impact explanation, detailed reasoning, and confidence level (0-1).`
      },
      {
        role: 'user',
        content: `Please analyze this trading strategy and provide enhancement recommendations based on current market conditions:\n\n${strategyDetails}\n\n${marketSummary}`
      }
    ];
    
    // Make the request to Perplexity
    const response = await this.makeRequest(messages, 0.3);
    
    // Parse the response
    try {
      let content = response.choices[0].message.content;
      
      // If the response contains markdown code blocks, extract JSON
      if (content.includes('```json')) {
        const match = content.match(/```json\n([\s\S]*?)\n```/);
        if (match && match[1]) {
          content = match[1];
        }
      }
      
      // Sometimes the model wraps the JSON in explanation text, try to extract just the JSON
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      
      if (jsonStart >= 0 && jsonEnd >= 0) {
        content = content.substring(jsonStart, jsonEnd + 1);
      }
      
      const enhancement = JSON.parse(content) as StrategyEnhancement;
      
      return enhancement;
    } catch (error) {
      logger.error('Error parsing Perplexity API response for strategy enhancement:', error);
      logger.debug('Raw response content:', response.choices[0].message.content);
      
      // Return a basic enhancement with the raw text
      const content = response.choices[0].message.content;
      
      return {
        original: {
          id: strategy.id,
          name: strategy.name,
          description: strategy.description || ''
        },
        improvements: {
          parameters: {},
          logicEnhancements: ['See reasoning for detailed enhancement suggestions'],
          riskManagement: ['See reasoning for risk management suggestions']
        },
        reasoning: content,
        confidence: 0.7
      };
    }
  }
  
  /**
   * Evaluate a signal to determine if it's valid and actionable
   * @param signal The trading signal to evaluate
   * @param marketData Current market data
   * @returns Evaluation of the signal with confidence score
   */
  public async evaluateSignal(signal: TradingSignal, marketData: MarketData): Promise<{
    valid: boolean;
    confidence: number;
    reasoning: string;
    recommendations: string[];
  }> {
    // Format signal details
    const signalDetails = `
    Signal ID: ${signal.id}
    Type: ${signal.type}
    Pair: ${signal.pair}
    Direction: ${signal.direction}
    Strength: ${signal.strength}
    Price: ${signal.price}
    Timestamp: ${signal.timestamp}
    Source: ${signal.source}
    Strategy ID: ${signal.strategy_id}
    
    Indicators:
    ${JSON.stringify(signal.indicators, null, 2)}
    
    Additional Data:
    ${JSON.stringify(signal.data, null, 2)}
    `;
    
    // Format market data summary
    const marketSummary = `
    Current Market Conditions for ${marketData.pair}:
    Latest Price: ${marketData.priceData[marketData.priceData.length - 1][1]}
    24h Price Change: ${((marketData.priceData[marketData.priceData.length - 1][1] / marketData.priceData[0][1] - 1) * 100).toFixed(2)}%
    24h Volume: ${marketData.volumeData[marketData.volumeData.length - 1][1]}
    
    Technical Indicators:
    - RSI: ${marketData.indicators.rsi[marketData.indicators.rsi.length - 1][1]}
    - MACD: ${marketData.indicators.macd[marketData.indicators.macd.length - 1][1]}
    - EMA: ${marketData.indicators.ema[marketData.indicators.ema.length - 1][1]}
    - Quantum: ${marketData.indicators.quantum[marketData.indicators.quantum.length - 1][1]}
    `;
    
    // Define the messages for the API
    const messages: PerplexityMessage[] = [
      {
        role: 'system',
        content: `You are an expert cryptocurrency trading signal validator. Analyze the provided trading signal against current market conditions to determine if it's valid and actionable. Consider technical indicators, price action, liquidity, and overall market sentiment. Your response should be a JSON object with properties: valid (boolean), confidence (0-1), reasoning (string), and recommendations (array of strings).`
      },
      {
        role: 'user',
        content: `Please evaluate the following trading signal against current market conditions and determine if it's valid and actionable:\n\n${signalDetails}\n\n${marketSummary}`
      }
    ];
    
    // Make the request to Perplexity
    const response = await this.makeRequest(messages, 0.2);
    
    // Parse the response
    try {
      let content = response.choices[0].message.content;
      
      // If the response contains markdown code blocks, extract JSON
      if (content.includes('```json')) {
        const match = content.match(/```json\n([\s\S]*?)\n```/);
        if (match && match[1]) {
          content = match[1];
        }
      }
      
      // Sometimes the model wraps the JSON in explanation text, try to extract just the JSON
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      
      if (jsonStart >= 0 && jsonEnd >= 0) {
        content = content.substring(jsonStart, jsonEnd + 1);
      }
      
      return JSON.parse(content);
    } catch (error) {
      logger.error('Error parsing Perplexity API response for signal evaluation:', error);
      logger.debug('Raw response content:', response.choices[0].message.content);
      
      // Return a basic evaluation based on the content
      const content = response.choices[0].message.content.toLowerCase();
      const valid = !content.includes('invalid') && !content.includes('not recommended') && 
                    !content.includes('not actionable');
      
      return {
        valid,
        confidence: 0.5,
        reasoning: response.choices[0].message.content,
        recommendations: ['Manual review recommended due to parsing error']
      };
    }
  }
  
  /**
   * Analyze multiple recent transactions to identify patterns and risks
   * @param transactions Recent transactions to analyze
   * @returns Analysis of transaction patterns and recommendations
   */
  public async analyzeTransactionPatterns(transactions: Transaction[]): Promise<{
    patterns: string[];
    risks: string[];
    efficiency: number;
    recommendations: string[];
  }> {
    // Format transaction data
    const transactionData = transactions.map(tx => {
      return `
      Transaction ID: ${tx.id}
      Strategy ID: ${tx.strategy_id}
      Type: ${tx.type}
      Status: ${tx.status}
      Pair: ${tx.pair}
      Side: ${tx.side}
      Amount: ${tx.amount}
      Price: ${tx.price}
      Fee: ${tx.fee}
      Profit: ${tx.profit}
      Timestamp: ${tx.timestamp}
      `;
    }).join('\n---\n');
    
    // Calculate summary statistics
    const totalTx = transactions.length;
    const successfulTx = transactions.filter(tx => tx.status === 'completed').length;
    const totalProfit = transactions.reduce((sum, tx) => sum + (tx.profit || 0), 0);
    const totalFees = transactions.reduce((sum, tx) => sum + (tx.fee || 0), 0);
    const netProfit = totalProfit - totalFees;
    
    const summaryStats = `
    Total Transactions: ${totalTx}
    Successful Transactions: ${successfulTx}
    Success Rate: ${((successfulTx / totalTx) * 100).toFixed(2)}%
    Total Profit: ${totalProfit}
    Total Fees: ${totalFees}
    Net Profit: ${netProfit}
    `;
    
    // Define the messages for the API
    const messages: PerplexityMessage[] = [
      {
        role: 'system',
        content: `You are an expert cryptocurrency trading analyst with a focus on transaction execution efficiency. Analyze the provided transaction data to identify patterns, risks, and opportunities for improvement. Look for time patterns, slippage indicators, fee optimization opportunities, and execution efficiency. Your response should be a JSON object with properties: patterns (array of strings), risks (array of strings), efficiency (0-1 score), and recommendations (array of strings).`
      },
      {
        role: 'user',
        content: `Please analyze the following transaction data to identify patterns, risks, and provide recommendations for improving execution efficiency:\n\nSummary Statistics:\n${summaryStats}\n\nTransaction Details:\n${transactionData}`
      }
    ];
    
    // Make the request to Perplexity
    const response = await this.makeRequest(messages, 0.3);
    
    // Parse the response
    try {
      let content = response.choices[0].message.content;
      
      // If the response contains markdown code blocks, extract JSON
      if (content.includes('```json')) {
        const match = content.match(/```json\n([\s\S]*?)\n```/);
        if (match && match[1]) {
          content = match[1];
        }
      }
      
      // Sometimes the model wraps the JSON in explanation text, try to extract just the JSON
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      
      if (jsonStart >= 0 && jsonEnd >= 0) {
        content = content.substring(jsonStart, jsonEnd + 1);
      }
      
      return JSON.parse(content);
    } catch (error) {
      logger.error('Error parsing Perplexity API response for transaction pattern analysis:', error);
      logger.debug('Raw response content:', response.choices[0].message.content);
      
      // Extract potential patterns and recommendations from the text
      const content = response.choices[0].message.content;
      
      // Basic extraction of patterns and recommendations
      const patterns: string[] = [];
      const risks: string[] = [];
      const recommendations: string[] = [];
      
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed.match(/pattern|trend|consistent/i)) {
          patterns.push(trimmed);
        }
        if (trimmed.match(/risk|danger|warning|concern|issue/i)) {
          risks.push(trimmed);
        }
        if (trimmed.match(/recommend|suggest|improve|optimize|consider/i)) {
          recommendations.push(trimmed);
        }
      });
      
      return {
        patterns: patterns.slice(0, 5),
        risks: risks.slice(0, 5),
        efficiency: successfulTx / totalTx,
        recommendations: recommendations.slice(0, 5)
      };
    }
  }
}

// Export the singleton instance
export const perplexityService = PerplexityService.getInstance();