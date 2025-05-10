/**
 * AI Router - Handles AI-related API routes
 */

import express from 'express';
import { logger } from '../logger';
import { getPerplexityService } from './perplexityService';
import { getDeepSeekService } from './deepSeekService';
import { getNeuralHybridService } from './neuralHybridService';
import { priceFeedCache } from '../priceFeedCache';

const router = express.Router();

// Check AI services status
router.get('/status', (req, res) => {
  const perplexityService = getPerplexityService();
  const deepSeekService = getDeepSeekService();
  const neuralHybridService = getNeuralHybridService();
  
  res.json({
    status: 'operational',
    services: {
      perplexity: {
        available: perplexityService.isAvailable(),
        status: perplexityService.isAvailable() ? 'operational' : 'unavailable'
      },
      deepseek: {
        available: deepSeekService.isAvailable(),
        status: deepSeekService.isAvailable() ? 'operational' : 'unavailable'
      },
      neural_hybrid: {
        available: neuralHybridService.isAvailable(),
        status: neuralHybridService.isAvailable() ? 'operational' : 'unavailable'
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Generate market insights using Perplexity
router.post('/market-insights', async (req, res) => {
  try {
    const { pair } = req.body;
    
    if (!pair) {
      res.status(400).json({
        status: 'error',
        message: 'Missing required parameter: pair'
      });
      return;
    }
    
    const perplexityService = getPerplexityService();
    
    if (!perplexityService.isAvailable()) {
      res.status(503).json({
        status: 'error',
        message: 'Perplexity AI service is not available'
      });
      return;
    }
    
    // Get market data from cache
    const marketData = priceFeedCache.getMarketData(pair);
    
    if (!marketData) {
      res.status(404).json({
        status: 'error',
        message: `No market data found for pair: ${pair}`
      });
      return;
    }
    
    // Ensure we have current price and 24h stats
    const latestPrice = marketData.prices[marketData.prices.length - 1][1];
    
    // Prepare market data with required fields
    const enhancedMarketData = {
      ...marketData,
      currentPrice: latestPrice,
      volume24h: marketData.volumes && marketData.volumes.length > 0 
        ? marketData.volumes[marketData.volumes.length - 1][1] : 0,
      priceChange24h: 0, // Calculate if time series has enough data
      priceChangePct24h: 0,
      highPrice24h: latestPrice * 1.05, // Estimate if not available
      lowPrice24h: latestPrice * 0.95, // Estimate if not available
      source: marketData.source || 'price-feed-cache',
      lastUpdated: marketData.prices[marketData.prices.length - 1][0]
    };
    
    // Calculate price change if we have enough data
    if (marketData.prices.length > 24) {
      const prevDayPrice = marketData.prices[marketData.prices.length - 25][1];
      enhancedMarketData.priceChange24h = latestPrice - prevDayPrice;
      enhancedMarketData.priceChangePct24h = (enhancedMarketData.priceChange24h / prevDayPrice) * 100;
    }
    
    // Get insights from Perplexity
    logger.info(`Generating market insights for ${pair}...`);
    const insights = await perplexityService.generateMarketInsights(pair, enhancedMarketData);
    
    res.json({
      status: 'success',
      pair,
      insights,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error generating market insights:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error generating market insights',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Pattern recognition using DeepSeek
router.post('/pattern-recognition', async (req, res) => {
  try {
    const { pair } = req.body;
    
    if (!pair) {
      res.status(400).json({
        status: 'error',
        message: 'Missing required parameter: pair'
      });
      return;
    }
    
    const deepSeekService = getDeepSeekService();
    
    if (!deepSeekService.isAvailable()) {
      res.status(503).json({
        status: 'error',
        message: 'DeepSeek AI service is not available'
      });
      return;
    }
    
    // Get market data from cache
    const marketData = priceFeedCache.getMarketData(pair);
    
    if (!marketData) {
      res.status(404).json({
        status: 'error',
        message: `No market data found for pair: ${pair}`
      });
      return;
    }
    
    // Get pattern recognition from DeepSeek
    logger.info(`Recognizing patterns for ${pair}...`);
    const patterns = await deepSeekService.recognizePatterns(pair, marketData);
    
    res.json({
      status: 'success',
      pair,
      patterns,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error recognizing patterns:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error recognizing patterns',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Generate trading decision using neural hybrid engine
router.post('/trading-decision', async (req, res) => {
  try {
    const { pair } = req.body;
    
    if (!pair) {
      res.status(400).json({
        status: 'error',
        message: 'Missing required parameter: pair'
      });
      return;
    }
    
    const neuralHybridService = getNeuralHybridService();
    
    if (!neuralHybridService.isAvailable()) {
      res.status(503).json({
        status: 'error',
        message: 'Neural Hybrid service is not available'
      });
      return;
    }
    
    // Get market data from cache
    const marketData = priceFeedCache.getMarketData(pair);
    
    if (!marketData) {
      res.status(404).json({
        status: 'error',
        message: `No market data found for pair: ${pair}`
      });
      return;
    }
    
    // Generate trading decision
    logger.info(`Generating trading decision for ${pair}...`);
    const decision = await neuralHybridService.makeDecision(pair, marketData);
    
    res.json({
      status: 'success',
      pair,
      decision,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error generating trading decision:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error generating trading decision',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Generate trading strategy
router.post('/generate-strategy', async (req, res) => {
  try {
    const { parameters } = req.body;
    
    if (!parameters) {
      res.status(400).json({
        status: 'error',
        message: 'Missing required parameter: parameters'
      });
      return;
    }
    
    const neuralHybridService = getNeuralHybridService();
    
    if (!neuralHybridService.isAvailable()) {
      res.status(503).json({
        status: 'error',
        message: 'Neural Hybrid service is not available'
      });
      return;
    }
    
    // Generate trading strategy
    logger.info(`Generating trading strategy with parameters: ${JSON.stringify(parameters)}`);
    const strategy = await neuralHybridService.createStrategy(parameters);
    
    res.json({
      status: 'success',
      strategy,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error generating trading strategy:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error generating trading strategy',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Analyze token fundamentals
router.post('/token-analysis', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      res.status(400).json({
        status: 'error',
        message: 'Missing required parameter: token'
      });
      return;
    }
    
    const perplexityService = getPerplexityService();
    
    if (!perplexityService.isAvailable()) {
      res.status(503).json({
        status: 'error',
        message: 'Perplexity AI service is not available'
      });
      return;
    }
    
    // Analyze token fundamentals
    logger.info(`Analyzing token fundamentals for ${token}...`);
    const analysis = await perplexityService.analyzeTokenFundamentals(token);
    
    res.json({
      status: 'success',
      token,
      analysis,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error analyzing token fundamentals:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error analyzing token fundamentals',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Detect market anomalies
router.post('/anomaly-detection', async (req, res) => {
  try {
    const { pair } = req.body;
    
    if (!pair) {
      res.status(400).json({
        status: 'error',
        message: 'Missing required parameter: pair'
      });
      return;
    }
    
    const deepSeekService = getDeepSeekService();
    
    if (!deepSeekService.isAvailable()) {
      res.status(503).json({
        status: 'error',
        message: 'DeepSeek AI service is not available'
      });
      return;
    }
    
    // Get market data from cache
    const marketData = priceFeedCache.getMarketData(pair);
    
    if (!marketData) {
      res.status(404).json({
        status: 'error',
        message: `No market data found for pair: ${pair}`
      });
      return;
    }
    
    // Detect anomalies
    logger.info(`Detecting anomalies for ${pair}...`);
    const anomalies = await deepSeekService.detectAnomalies(pair, marketData);
    
    res.json({
      status: 'success',
      pair,
      anomalies,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error detecting anomalies:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error detecting anomalies',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Generate quantum strategy
router.post('/quantum-strategy', async (req, res) => {
  try {
    const { pair, riskTolerance } = req.body;
    
    if (!pair) {
      res.status(400).json({
        status: 'error',
        message: 'Missing required parameter: pair'
      });
      return;
    }
    
    const deepSeekService = getDeepSeekService();
    
    if (!deepSeekService.isAvailable()) {
      res.status(503).json({
        status: 'error',
        message: 'DeepSeek AI service is not available'
      });
      return;
    }
    
    // Get market data from cache
    const marketData = priceFeedCache.getMarketData(pair);
    
    if (!marketData) {
      res.status(404).json({
        status: 'error',
        message: `No market data found for pair: ${pair}`
      });
      return;
    }
    
    // Generate quantum strategy
    logger.info(`Generating quantum strategy for ${pair}...`);
    const strategy = await deepSeekService.generateQuantumStrategy(pair, marketData, riskTolerance as any);
    
    res.json({
      status: 'success',
      pair,
      strategy,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error generating quantum strategy:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error generating quantum strategy',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;