/**
 * DeepSeek AI Service
 * 
 * This service provides specialized AI capabilities using DeepSeek's advanced models.
 * It focuses on automated code generation, algorithmic optimization, and quantitative
 * analysis applications that benefit from DeepSeek's specialized strengths.
 */

import axios from 'axios';
import { logger } from '../logger';
import { Strategy } from '@shared/schema';

// DeepSeek API URL
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// Ensure API key is available
if (!process.env.DEEPSEEK_API_KEY) {
  logger.warn('DEEPSEEK_API_KEY environment variable is not set. Advanced AI features will be limited.');
}

// Types for DeepSeek API
interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekRequest {
  model: string;
  messages: DeepSeekMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
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
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Types for strategy optimization
export interface QuantitativeParameters {
  timeframe: string;
  lookbackPeriod: number;
  entryThreshold: number;
  exitThreshold: number;
  stopLossPercentage: number;
  takeProfitPercentage: number;
  positionSize: number;
  maxOpenPositions: number;
  indicators: {
    name: string;
    parameters: Record<string, number>;
    weight: number;
  }[];
}

export interface OptimizationResult {
  originalParameters: QuantitativeParameters;
  optimizedParameters: QuantitativeParameters;
  expectedImprovements: {
    winRate: string;
    profitFactor: string;
    maxDrawdown: string;
    sharpeRatio: string;
  };
  explanation: string;
  implementationCode: string;
}

export interface TradingLogicImplementation {
  strategyId: string;
  strategyName: string;
  strategyType: string;
  entryLogicCode: string;
  exitLogicCode: string;
  riskManagementCode: string;
  fullImplementation: string;
  explanation: string;
  testCases: string[];
}

export class DeepSeekService {
  private static instance: DeepSeekService;
  private apiKey: string;
  private defaultModel: string = 'deepseek-coder';
  
  private constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY || '';
  }
  
  public static getInstance(): DeepSeekService {
    if (!DeepSeekService.instance) {
      DeepSeekService.instance = new DeepSeekService();
    }
    return DeepSeekService.instance;
  }
  
  /**
   * Check if the DeepSeek API service is available and configured
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
    this.defaultModel = model;
    logger.info(`DeepSeek model set to: ${model}`);
  }
  
  /**
   * Make a request to the DeepSeek API
   * @param messages Array of messages to send to the model
   * @param temperature Temperature setting (0-1)
   * @param maxTokens Maximum tokens to generate
   * @returns The API response
   */
  private async makeRequest(
    messages: DeepSeekMessage[],
    temperature: number = 0.2,
    maxTokens: number = 2048
  ): Promise<DeepSeekResponse> {
    if (!this.isAvailable()) {
      throw new Error('DeepSeek API key not configured');
    }
    
    const payload: DeepSeekRequest = {
      model: this.defaultModel,
      messages,
      max_tokens: maxTokens,
      temperature,
      top_p: 0.95,
      stream: false
    };
    
    try {
      const response = await axios.post<DeepSeekResponse>(
        DEEPSEEK_API_URL,
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
      logger.error('Error calling DeepSeek API:', error.message);
      
      if (error.response) {
        logger.error('API response:', error.response.status, error.response.data);
      }
      
      throw new Error(`DeepSeek API error: ${error.message}`);
    }
  }
  
  /**
   * Optimize quantitative parameters for a trading strategy
   * @param strategyType Type of strategy to optimize (e.g., 'mean_reversion', 'trend_following')
   * @param currentParameters Current parameters to optimize from
   * @param performanceMetrics Current performance metrics of the strategy
   * @param optimizationGoal What to optimize for (e.g., 'profit', 'risk_adjusted_return', 'stability')
   * @returns Optimized parameters and expected improvements
   */
  public async optimizeParameters(
    strategyType: string,
    currentParameters: QuantitativeParameters,
    performanceMetrics: {
      winRate: number;
      profitFactor: number;
      maxDrawdown: number;
      averageProfit: number;
      averageLoss: number;
      sharpeRatio: number;
    },
    optimizationGoal: 'profit' | 'risk_adjusted_return' | 'stability'
  ): Promise<OptimizationResult> {
    // Format the current parameters for the prompt
    const parametersJson = JSON.stringify(currentParameters, null, 2);
    const metricsJson = JSON.stringify(performanceMetrics, null, 2);
    
    // Define system instructions
    const systemPrompt = `You are an expert quantitative trading strategist specializing in parameter optimization for cryptocurrency trading algorithms. Your task is to optimize the parameters of a ${strategyType} strategy to maximize ${optimizationGoal === 'profit' ? 'absolute profits' : optimizationGoal === 'risk_adjusted_return' ? 'risk-adjusted returns' : 'stability and consistency of returns'}. Provide a detailed explanation of your optimization process and reasoning. Your response should be a valid JSON object matching the OptimizationResult interface.`;
    
    // Define the user prompt
    const userPrompt = `I need to optimize the following ${strategyType} strategy parameters for a Solana trading system.

Current Parameters:
\`\`\`json
${parametersJson}
\`\`\`

Current Performance Metrics:
\`\`\`json
${metricsJson}
\`\`\`

Optimization Goal: ${optimizationGoal === 'profit' ? 'Maximize absolute profit, even if it increases volatility' : optimizationGoal === 'risk_adjusted_return' ? 'Maximize risk-adjusted returns (Sharpe ratio)' : 'Maximize stability and consistency of returns, minimizing drawdowns'}

Please provide optimized parameters and expected performance improvements. Include implementation code for the core logic implementing these optimized parameters in TypeScript. Return a JSON object matching the OptimizationResult interface.`;
    
    // Make the request to DeepSeek
    const messages: DeepSeekMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];
    
    const response = await this.makeRequest(messages, 0.3, 4096);
    
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
      
      return JSON.parse(content) as OptimizationResult;
    } catch (error) {
      logger.error('Error parsing DeepSeek API response:', error);
      logger.debug('Raw response content:', response.choices[0].message.content);
      
      // Extract code blocks for implementation if available
      const content = response.choices[0].message.content;
      let implementationCode = '';
      
      const codeMatch = content.match(/```(typescript|ts|javascript|js)\n([\s\S]*?)\n```/);
      if (codeMatch && codeMatch[2]) {
        implementationCode = codeMatch[2];
      }
      
      // Return a basic result derived from the response text
      return {
        originalParameters: currentParameters,
        optimizedParameters: currentParameters, // Unchanged as fallback
        expectedImprovements: {
          winRate: 'Unable to parse specific improvements from response',
          profitFactor: 'Unable to parse specific improvements from response',
          maxDrawdown: 'Unable to parse specific improvements from response',
          sharpeRatio: 'Unable to parse specific improvements from response'
        },
        explanation: content.substring(0, 500) + '...',
        implementationCode: implementationCode || 'Unable to parse implementation code from response'
      };
    }
  }
  
  /**
   * Generate code implementation for a trading strategy based on its description
   * @param strategy The strategy with description and parameters
   * @returns Trading logic implementation code
   */
  public async generateStrategyImplementation(strategy: Strategy): Promise<TradingLogicImplementation> {
    // Format the strategy details for the prompt
    const strategyJson = JSON.stringify({
      id: strategy.id,
      name: strategy.name,
      description: strategy.description,
      type: strategy.type,
      pair: strategy.pair,
      parameters: strategy.parameters,
      entry_conditions: strategy.entry_conditions,
      exit_conditions: strategy.exit_conditions,
      stop_loss: strategy.stop_loss,
      take_profit: strategy.take_profit,
      position_size: strategy.position_size,
      timeframe: strategy.timeframe
    }, null, 2);
    
    // Define system instructions
    const systemPrompt = `You are an expert cryptocurrency trading algorithm developer specializing in TypeScript implementations for algorithmic trading systems. Your task is to generate production-ready, efficient, and robust code for the described trading strategy. Your code should follow best practices for financial algorithm implementation, include proper error handling, and be well-documented. Your response should be a valid JSON object matching the TradingLogicImplementation interface with code implementations for entry logic, exit logic, risk management, and full integration.`;
    
    // Define the user prompt
    const userPrompt = `I need TypeScript implementation code for the following trading strategy to be used in our Solana trading platform:

\`\`\`json
${strategyJson}
\`\`\`

Please generate:
1. Entry logic code
2. Exit logic code
3. Risk management code
4. Full implementation combining all components
5. Explanation of implementation decisions
6. Test cases to verify functionality

Return a JSON object matching the TradingLogicImplementation interface.`;
    
    // Make the request to DeepSeek
    const messages: DeepSeekMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];
    
    const response = await this.makeRequest(messages, 0.2, 4096);
    
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
      
      return JSON.parse(content) as TradingLogicImplementation;
    } catch (error) {
      logger.error('Error parsing DeepSeek API response:', error);
      logger.debug('Raw response content:', response.choices[0].message.content);
      
      // Extract code blocks if available
      const content = response.choices[0].message.content;
      const codeBlocks: string[] = [];
      
      let codeBlockRegex = /```(?:typescript|ts|javascript|js)\n([\s\S]*?)\n```/g;
      let match;
      
      while ((match = codeBlockRegex.exec(content)) !== null) {
        if (match[1]) {
          codeBlocks.push(match[1]);
        }
      }
      
      // Try to identify entry, exit, and risk management code
      let entryLogicCode = codeBlocks.find(block => 
        block.toLowerCase().includes('entry') || block.toLowerCase().includes('buy') || block.toLowerCase().includes('long')
      ) || '';
      
      let exitLogicCode = codeBlocks.find(block => 
        block.toLowerCase().includes('exit') || block.toLowerCase().includes('sell') || block.toLowerCase().includes('close')
      ) || '';
      
      let riskManagementCode = codeBlocks.find(block => 
        block.toLowerCase().includes('risk') || block.toLowerCase().includes('stop loss') || block.toLowerCase().includes('take profit')
      ) || '';
      
      let fullImplementation = codeBlocks.find(block => 
        block.includes('class') && block.includes('function') && block.length > 100
      ) || codeBlocks.join('\n\n');
      
      return {
        strategyId: strategy.id,
        strategyName: strategy.name,
        strategyType: strategy.type,
        entryLogicCode,
        exitLogicCode,
        riskManagementCode,
        fullImplementation,
        explanation: content.substring(0, 500) + '...',
        testCases: ['Unable to parse test cases from response']
      };
    }
  }
  
  /**
   * Generate diagnostic and troubleshooting code for a trading issue
   * @param issueDescription Description of the issue
   * @param relatedCode Related code snippet that may contain the issue
   * @param systemContext Context about the trading system
   * @returns Diagnostic code, explanation, and fix
   */
  public async generateDiagnosticCode(
    issueDescription: string,
    relatedCode: string,
    systemContext: string
  ): Promise<{
    diagnosticCode: string;
    explanation: string;
    fixCode: string;
    testCode: string;
  }> {
    // Define system instructions
    const systemPrompt = `You are an expert algorithmic trading systems engineer specializing in diagnosing and fixing issues in cryptocurrency trading algorithms. Your task is to analyze the described issue, create diagnostic code to identify the root cause, provide an explanation of the issue, and implement a fix. Your code should be production-ready, efficient, and follow best practices for financial software. Include test code to verify the fix works properly.`;
    
    // Define the user prompt
    const userPrompt = `I'm experiencing the following issue in our Solana trading platform:

Issue Description:
${issueDescription}

Relevant Code:
\`\`\`typescript
${relatedCode}
\`\`\`

System Context:
${systemContext}

Please provide:
1. Diagnostic code to identify the root cause
2. Explanation of the issue
3. Fixed code implementation
4. Test code to verify the fix works

Be thorough in your analysis and provide well-documented code.`;
    
    // Make the request to DeepSeek
    const messages: DeepSeekMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];
    
    const response = await this.makeRequest(messages, 0.1, 4096);
    
    // Parse the response
    try {
      const content = response.choices[0].message.content;
      
      // Extract code blocks
      const diagnosticCodeMatch = content.match(/```(?:typescript|ts|javascript|js).*?(?:Diagnostic|diagnostic|DIAGNOSTIC).*?\n([\s\S]*?)\n```/);
      const fixCodeMatch = content.match(/```(?:typescript|ts|javascript|js).*?(?:Fix|fix|FIXED|Fixed).*?\n([\s\S]*?)\n```/);
      const testCodeMatch = content.match(/```(?:typescript|ts|javascript|js).*?(?:Test|test|TEST|testing|Testing).*?\n([\s\S]*?)\n```/);
      
      // Extract explanation (text between code blocks or at beginning)
      let explanation = content;
      
      // Remove code blocks for explanation extraction
      explanation = explanation.replace(/```[\s\S]*?```/g, '');
      
      // Get the most relevant paragraph
      const explanationParagraphs = explanation.split('\n\n');
      const relevantExplanation = explanationParagraphs.find(p => 
        p.toLowerCase().includes('issue') || 
        p.toLowerCase().includes('problem') || 
        p.toLowerCase().includes('cause') || 
        p.toLowerCase().includes('reason')
      ) || explanation.substring(0, 500);
      
      return {
        diagnosticCode: diagnosticCodeMatch ? diagnosticCodeMatch[1] : 'No specific diagnostic code found in response',
        explanation: relevantExplanation,
        fixCode: fixCodeMatch ? fixCodeMatch[1] : 'No specific fix code found in response',
        testCode: testCodeMatch ? testCodeMatch[1] : 'No specific test code found in response'
      };
    } catch (error) {
      logger.error('Error processing DeepSeek API response for diagnostic code:', error);
      logger.debug('Raw response content:', response.choices[0].message.content);
      
      return {
        diagnosticCode: 'Error parsing response from DeepSeek API',
        explanation: response.choices[0].message.content.substring(0, 500) + '...',
        fixCode: 'Error parsing response from DeepSeek API',
        testCode: 'Error parsing response from DeepSeek API'
      };
    }
  }
  
  /**
   * Generate performance optimization code for a trading algorithm
   * @param codeToOptimize Code to optimize
   * @param performanceRequirements Performance requirements and constraints
   * @param systemContext Context about the trading system
   * @returns Optimized code and explanation
   */
  public async optimizeCode(
    codeToOptimize: string,
    performanceRequirements: string,
    systemContext: string
  ): Promise<{
    optimizedCode: string;
    optimizationExplanation: string;
    benchmarkResults: string;
    memoryUsageImprovements: string;
  }> {
    // Define system instructions
    const systemPrompt = `You are an expert algorithmic trading systems engineer specializing in optimizing high-performance trading algorithms. Your task is to analyze the provided code and optimize it for performance based on the specified requirements. Focus on reducing latency, minimizing memory usage, and improving computational efficiency without compromising accuracy or reliability. Your optimized code should be production-ready and well-documented.`;
    
    // Define the user prompt
    const userPrompt = `I need to optimize the following trading algorithm code for our Solana trading platform:

Original Code:
\`\`\`typescript
${codeToOptimize}
\`\`\`

Performance Requirements:
${performanceRequirements}

System Context:
${systemContext}

Please provide:
1. Optimized code implementation
2. Detailed explanation of optimizations made
3. Expected performance improvements (estimated)
4. Memory usage improvements (estimated)

Be thorough in your optimization approach and provide well-documented code.`;
    
    // Make the request to DeepSeek
    const messages: DeepSeekMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];
    
    const response = await this.makeRequest(messages, 0.1, 4096);
    
    // Parse the response
    try {
      const content = response.choices[0].message.content;
      
      // Extract optimized code
      const optimizedCodeMatch = content.match(/```(?:typescript|ts|javascript|js)(?:.*?)\n([\s\S]*?)\n```/);
      const optimizedCode = optimizedCodeMatch ? optimizedCodeMatch[1] : 'No optimized code found in response';
      
      // Extract performance explanation
      const lines = content.split('\n');
      let optimizationExplanation = '';
      let benchmarkResults = '';
      let memoryUsageImprovements = '';
      
      // Look for optimization explanation
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase();
        if (line.includes('optimization') || line.includes('explanation') || line.includes('improvements')) {
          let j = i + 1;
          while (j < lines.length && !lines[j].includes('```') && !lines[j].toLowerCase().includes('benchmark') && !lines[j].toLowerCase().includes('memory')) {
            optimizationExplanation += lines[j] + '\n';
            j++;
          }
          break;
        }
      }
      
      // Look for benchmark results
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase();
        if (line.includes('benchmark') || line.includes('performance')) {
          let j = i + 1;
          while (j < lines.length && !lines[j].includes('```') && !lines[j].toLowerCase().includes('memory')) {
            benchmarkResults += lines[j] + '\n';
            j++;
          }
          break;
        }
      }
      
      // Look for memory usage improvements
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase();
        if (line.includes('memory') || line.includes('usage')) {
          let j = i + 1;
          while (j < lines.length && !lines[j].includes('```')) {
            memoryUsageImprovements += lines[j] + '\n';
            j++;
          }
          break;
        }
      }
      
      return {
        optimizedCode,
        optimizationExplanation: optimizationExplanation || 'No specific optimization explanation found in response',
        benchmarkResults: benchmarkResults || 'No specific benchmark results found in response',
        memoryUsageImprovements: memoryUsageImprovements || 'No specific memory usage improvements found in response'
      };
    } catch (error) {
      logger.error('Error processing DeepSeek API response for code optimization:', error);
      logger.debug('Raw response content:', response.choices[0].message.content);
      
      return {
        optimizedCode: 'Error parsing response from DeepSeek API',
        optimizationExplanation: response.choices[0].message.content.substring(0, 500) + '...',
        benchmarkResults: 'Error parsing response from DeepSeek API',
        memoryUsageImprovements: 'Error parsing response from DeepSeek API'
      };
    }
  }
}

// Export the singleton instance
export const deepseekService = DeepSeekService.getInstance();