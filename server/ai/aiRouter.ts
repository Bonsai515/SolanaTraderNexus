/**
 * AI Router
 * 
 * This module provides API routes for accessing the Neural Hybrid System's
 * AI capabilities, including market insights, strategy enhancement, and code generation.
 */

import express from 'express';
import { logger } from '../logger';
import { Strategy, TradingSignal, Transaction } from '@shared/schema';
import { priceFeedCache } from '../priceFeedCache';
import { storage } from '../storage';
import { 
  neuralHybridSystem, 
  AIProvider, 
  TaskType, 
  AIModelCapability 
} from './neuralHybridSystem';

export const aiRouter = express.Router();

// Get available AI models and their capabilities
aiRouter.get('/models', (req, res) => {
  try {
    const models = neuralHybridSystem.getModelCapabilities();
    
    res.json({
      status: 'success',
      models
    });
  } catch (error: any) {
    logger.error('Error getting AI model capabilities:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error retrieving AI model capabilities',
      error: error.message
    });
  }
});

// Generate market insights
aiRouter.post('/market-insights', async (req, res) => {
  try {
    const { pair, provider } = req.body;
    
    if (!pair) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required parameter: pair'
      });
    }
    
    // Get market data from cache
    const marketData = priceFeedCache.getMarketData(pair);
    if (!marketData) {
      return res.status(404).json({
        status: 'error',
        message: `No market data available for: ${pair}`
      });
    }
    
    // Use the specified provider or default
    const aiProvider = provider ? AIProvider[provider as keyof typeof AIProvider] : undefined;
    
    // Generate insights
    const result = await neuralHybridSystem.generateMarketInsights(marketData, aiProvider);
    
    res.json({
      status: 'success',
      insights: result.result,
      provider: result.provider,
      model: result.model,
      confidence: result.confidence,
      processingTime: result.processingTime,
      tokenUsage: result.tokenUsage
    });
  } catch (error: any) {
    logger.error('Error generating market insights with Neural Hybrid System:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error generating market insights with AI',
      error: error.message
    });
  }
});

// Enhance trading strategy
aiRouter.post('/enhance-strategy', async (req, res) => {
  try {
    const { strategyId, provider } = req.body;
    
    if (!strategyId) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required parameter: strategyId'
      });
    }
    
    // Get the strategy
    const strategy = await storage.getStrategy(strategyId);
    if (!strategy) {
      return res.status(404).json({
        status: 'error',
        message: `Strategy not found: ${strategyId}`
      });
    }
    
    // Get market data from cache
    const marketData = priceFeedCache.getMarketData(strategy.pair);
    if (!marketData) {
      return res.status(404).json({
        status: 'error',
        message: `No market data available for: ${strategy.pair}`
      });
    }
    
    // Use the specified provider or default
    const aiProvider = provider ? AIProvider[provider as keyof typeof AIProvider] : undefined;
    
    // Generate enhancements
    const result = await neuralHybridSystem.enhanceStrategy(strategy, marketData, aiProvider);
    
    res.json({
      status: 'success',
      strategy_id: strategyId,
      pair: strategy.pair,
      enhancement: result.result,
      provider: result.provider,
      model: result.model,
      confidence: result.confidence,
      processingTime: result.processingTime,
      tokenUsage: result.tokenUsage
    });
  } catch (error: any) {
    logger.error('Error enhancing strategy with Neural Hybrid System:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error enhancing strategy with AI',
      error: error.message
    });
  }
});

// Generate implementation code for a strategy
aiRouter.post('/generate-implementation', async (req, res) => {
  try {
    const { strategyId, provider } = req.body;
    
    if (!strategyId) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required parameter: strategyId'
      });
    }
    
    // Get the strategy
    const strategy = await storage.getStrategy(strategyId);
    if (!strategy) {
      return res.status(404).json({
        status: 'error',
        message: `Strategy not found: ${strategyId}`
      });
    }
    
    // Use the specified provider or default
    const aiProvider = provider ? AIProvider[provider as keyof typeof AIProvider] : undefined;
    
    // Generate implementation
    const result = await neuralHybridSystem.generateStrategyImplementation(strategy, aiProvider);
    
    res.json({
      status: 'success',
      strategy_id: strategyId,
      implementation: result.result,
      provider: result.provider,
      model: result.model,
      confidence: result.confidence,
      processingTime: result.processingTime,
      tokenUsage: result.tokenUsage
    });
  } catch (error: any) {
    logger.error('Error generating implementation with Neural Hybrid System:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error generating implementation with AI',
      error: error.message
    });
  }
});

// Evaluate a trading signal
aiRouter.post('/evaluate-signal', async (req, res) => {
  try {
    const { signalId, provider } = req.body;
    
    if (!signalId) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required parameter: signalId'
      });
    }
    
    // Get the signal
    const signal = await storage.getSignal(signalId);
    if (!signal) {
      return res.status(404).json({
        status: 'error',
        message: `Signal not found: ${signalId}`
      });
    }
    
    // Get market data from cache
    const marketData = priceFeedCache.getMarketData(signal.pair);
    if (!marketData) {
      return res.status(404).json({
        status: 'error',
        message: `No market data available for: ${signal.pair}`
      });
    }
    
    // Use the specified provider or default
    const aiProvider = provider ? AIProvider[provider as keyof typeof AIProvider] : undefined;
    
    // Evaluate signal
    const result = await neuralHybridSystem.evaluateSignal(signal, marketData, aiProvider);
    
    res.json({
      status: 'success',
      signal_id: signalId,
      evaluation: result.result,
      provider: result.provider,
      model: result.model,
      confidence: result.confidence,
      processingTime: result.processingTime,
      tokenUsage: result.tokenUsage
    });
  } catch (error: any) {
    logger.error('Error evaluating signal with Neural Hybrid System:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error evaluating signal with AI',
      error: error.message
    });
  }
});

// Analyze transaction patterns
aiRouter.post('/analyze-transactions', async (req, res) => {
  try {
    const { limit, provider } = req.body;
    
    // Get recent transactions
    const transactions = await storage.getTransactions();
    
    // Limit the number of transactions if specified
    const limitedTransactions = limit && limit > 0 ? 
      transactions.slice(0, limit) : transactions;
    
    if (limitedTransactions.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No transactions found for analysis'
      });
    }
    
    // Use the specified provider or default
    const aiProvider = provider ? AIProvider[provider as keyof typeof AIProvider] : undefined;
    
    // Analyze transactions
    const result = await neuralHybridSystem.analyzeTransactionPatterns(limitedTransactions, aiProvider);
    
    res.json({
      status: 'success',
      transaction_count: limitedTransactions.length,
      analysis: result.result,
      provider: result.provider,
      model: result.model,
      confidence: result.confidence,
      processingTime: result.processingTime,
      tokenUsage: result.tokenUsage
    });
  } catch (error: any) {
    logger.error('Error analyzing transactions with Neural Hybrid System:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error analyzing transactions with AI',
      error: error.message
    });
  }
});

// Optimize code
aiRouter.post('/optimize-code', async (req, res) => {
  try {
    const { code, requirements, context, provider } = req.body;
    
    if (!code) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required parameter: code'
      });
    }
    
    // Use the specified provider or default
    const aiProvider = provider ? AIProvider[provider as keyof typeof AIProvider] : undefined;
    
    // Optimize code
    const result = await neuralHybridSystem.optimizeCode(
      code,
      requirements || 'Optimize for performance and reliability',
      context || 'Solana trading platform running on Node.js in production environment',
      aiProvider
    );
    
    res.json({
      status: 'success',
      optimization: result.result,
      provider: result.provider,
      model: result.model,
      confidence: result.confidence,
      processingTime: result.processingTime,
      tokenUsage: result.tokenUsage
    });
  } catch (error: any) {
    logger.error('Error optimizing code with Neural Hybrid System:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error optimizing code with AI',
      error: error.message
    });
  }
});

// Generate diagnostic code
aiRouter.post('/generate-diagnostic', async (req, res) => {
  try {
    const { issue, code, context, provider } = req.body;
    
    if (!issue || !code) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required parameters: issue and code'
      });
    }
    
    // Use the specified provider or default
    const aiProvider = provider ? AIProvider[provider as keyof typeof AIProvider] : undefined;
    
    // Generate diagnostic code
    const result = await neuralHybridSystem.generateDiagnosticCode(
      issue,
      code,
      context || 'Solana trading platform running on Node.js in production environment',
      aiProvider
    );
    
    res.json({
      status: 'success',
      diagnostic: result.result,
      provider: result.provider,
      model: result.model,
      confidence: result.confidence,
      processingTime: result.processingTime,
      tokenUsage: result.tokenUsage
    });
  } catch (error: any) {
    logger.error('Error generating diagnostic code with Neural Hybrid System:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error generating diagnostic code with AI',
      error: error.message
    });
  }
});

// Debug AI models and capabilities
aiRouter.get('/debug', (req, res) => {
  try {
    const capabilities = neuralHybridSystem.getModelCapabilities();
    const supportedTasks = Object.values(TaskType).map(task => ({
      task,
      supported: neuralHybridSystem.isTaskSupported(task),
      bestProvider: neuralHybridSystem.getBestProviderForTask(task)
    }));
    
    res.json({
      status: 'success',
      capabilities,
      supportedTasks,
      perplexityAvailable: !!process.env.PERPLEXITY_API_KEY,
      deepseekAvailable: !!process.env.DEEPSEEK_API_KEY
    });
  } catch (error: any) {
    logger.error('Error in AI debug endpoint:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error in AI debug endpoint',
      error: error.message
    });
  }
});