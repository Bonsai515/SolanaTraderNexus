import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import storage from './storage';
import { WebSocketServer } from 'ws';
import { Server } from 'http';
import * as solanaWeb3 from '@solana/web3.js';
import { getTransformerAPI, MarketData } from './transformers';
import { logger } from './logger';
import agentRouter, * as AgentManager from './agents';
import { signalHub, SignalSource, SignalType, SignalStrength, SignalDirection, SignalPriority } from './signalHub';
import { externalSignalService } from './externalSignal';
import { priceFeedCache } from './priceFeedCache';
import { getPerplexityService } from './ai/perplexityService';
import { crossChainRouter } from './wormhole/crossChainRouter';
import { 
  getAllDexes, 
  getDexInfo, 
  getDexesByCategory, 
  getAllAnalyticsPlatforms, 
  getAllLendingProtocols, 
  getLiquidityPools, 
  getAllSupportedPairs,
  DexType,
  DexCategory,
  AnalyticsPlatformType,
  LendingProtocolType
} from './dexInfo';

// Global state for transformer API initialization
let transformerApiInitialized = false;
import {
  walletSchema, 
  insertWalletSchema,
  strategySchema,
  insertStrategySchema,
  tradingSignalSchema,
  insertTradingSignalSchema,
  transactionSchema,
  insertTransactionSchema,
  StrategyType,
  SignalType,
  SignalStrength,
  TransactionType,
  TransactionStatus,
  InsightType
} from '../shared/schema';

const router = express.Router();

// API Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test endpoints for debugging access
router.get('/test', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Test endpoint is accessible',
    timestamp: new Date().toISOString(),
    initialized: transformerApiInitialized
  });
});

// Test endpoint to populate price feed with test data
router.post('/test/populate-price-feed', (req, res) => {
  try {
    // Generate test data for SOL/USDC
    const currentTime = new Date();
    const solPrice = 150.75 + (Math.random() * 5 - 2.5); // Random price around $150.75
    const bonkPrice = 0.00001275 + (Math.random() * 0.0000005); // Random price around $0.00001275
    const jupPrice = 1.25 + (Math.random() * 0.1 - 0.05); // Random price around $1.25
    
    // Generate price history (last 24 hours)
    const generatePriceHistory = (basePrice: number, volatility: number) => {
      const prices = [];
      const volumes = [];
      for (let i = 0; i < 24; i++) {
        const timestamp = new Date(currentTime.getTime() - (23 - i) * 3600 * 1000).toISOString();
        const price = basePrice * (1 + Math.sin(i / 4) * volatility * 0.5 + (Math.random() * volatility - volatility/2));
        prices.push([timestamp, price]);
        
        // Generate random volume
        const volume = Math.round(1000000 + Math.random() * 500000);
        volumes.push([timestamp, volume]);
      }
      return { prices, volumes };
    };
    
    // SOL/USDC Market Data
    const solData = generatePriceHistory(solPrice, 0.05);
    const solMarketData: MarketData = {
      pair: 'SOL/USDC',
      prices: solData.prices,
      volumes: solData.volumes,
      orderBooks: [],
      indicators: {
        'rsi': [[currentTime.toISOString(), 58.5]],
        'macd': [[currentTime.toISOString(), 0.85]]
      },
      externalData: {}
    };
    
    // BONK/USDC Market Data
    const bonkData = generatePriceHistory(bonkPrice, 0.1);
    const bonkMarketData: MarketData = {
      pair: 'BONK/USDC',
      prices: bonkData.prices,
      volumes: bonkData.volumes,
      orderBooks: [],
      indicators: {
        'rsi': [[currentTime.toISOString(), 72.3]],
        'macd': [[currentTime.toISOString(), 1.21]]
      },
      externalData: {}
    };
    
    // JUP/USDC Market Data
    const jupData = generatePriceHistory(jupPrice, 0.07);
    const jupMarketData: MarketData = {
      pair: 'JUP/USDC',
      prices: jupData.prices,
      volumes: jupData.volumes,
      orderBooks: [],
      indicators: {
        'rsi': [[currentTime.toISOString(), 63.8]],
        'macd': [[currentTime.toISOString(), 0.53]]
      },
      externalData: {}
    };
    
    // Update market data in price feed cache
    priceFeedCache.updateMarketData('SOL/USDC', solMarketData);
    priceFeedCache.updateMarketData('BONK/USDC', bonkMarketData);
    priceFeedCache.updateMarketData('JUP/USDC', jupMarketData);
    
    // Update latest price points
    priceFeedCache.updatePriceData({
      pair: 'SOL/USDC',
      price: solPrice,
      volume: solData.volumes[solData.volumes.length - 1][1],
      timestamp: new Date(solData.prices[solData.prices.length - 1][0]),
      source: 'test_data'
    });
    
    priceFeedCache.updatePriceData({
      pair: 'BONK/USDC',
      price: bonkPrice,
      volume: bonkData.volumes[bonkData.volumes.length - 1][1],
      timestamp: new Date(bonkData.prices[bonkData.prices.length - 1][0]),
      source: 'test_data'
    });
    
    priceFeedCache.updatePriceData({
      pair: 'JUP/USDC',
      price: jupPrice,
      volume: jupData.volumes[jupData.volumes.length - 1][1],
      timestamp: new Date(jupData.prices[jupData.prices.length - 1][0]),
      source: 'test_data'
    });
    
    res.json({
      status: 'success',
      message: 'Price feed populated with test data',
      pairs: ['SOL/USDC', 'BONK/USDC', 'JUP/USDC'],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error populating price feed',
      error: error.message
    });
  }
});

// Transformer API endpoints
router.get('/transformer/status', (req, res) => {
  try {
    if (!transformerApiInitialized) {
      res.status(503).json({
        status: 'initializing',
        message: 'Transformer API is initializing'
      });
      return;
    }

    res.json({
      status: transformerApiInitialized ? 'operational' : 'initializing',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error getting transformer status',
      error: error.message
    });
  }
});

// Make a prediction with provided market data
router.post('/transformer/predict', async (req, res) => {
  try {
    if (!transformerApiInitialized) {
      res.status(503).json({
        status: 'error',
        message: 'Transformer API not initialized yet'
      });
      return;
    }

    const { pair, marketData, windowSeconds } = req.body;
    
    if (!pair) {
      res.status(400).json({
        status: 'error',
        message: 'Missing required parameter: pair'
      });
      return;
    }

    const transformer = getTransformerAPI(storage);
    
    // For testing without market data, create minimal data structure
    const testMarketData: MarketData = marketData || {
      pair,
      prices: [[new Date().toISOString(), 0]],
      volumes: [[new Date().toISOString(), 0]],
      orderBooks: [],
      indicators: {},
      externalData: {}
    };
    
    const prediction = await transformer.predict(
      pair,
      testMarketData,
      windowSeconds || 3600
    );

    res.json(prediction);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error making prediction',
      error: error.message
    });
  }
});
  
// Make a prediction using cached market data
router.post('/transformer/predict-cached', async (req, res) => {
  try {
    if (!transformerApiInitialized) {
      res.status(503).json({
        status: 'error',
        message: 'Transformer API not initialized yet'
      });
      return;
    }

    const { pair, windowSeconds } = req.body;
    
    if (!pair) {
      res.status(400).json({
        status: 'error',
        message: 'Missing required parameter: pair'
      });
      return;
    }
    
    // Get market data from cache
    const cachedData = priceFeedCache.getMarketData(pair);
    
    if (!cachedData) {
      res.status(404).json({
        status: 'error',
        message: `No cached market data found for pair: ${pair}`
      });
      return;
    }
    
    const transformer = getTransformerAPI(storage);
    const prediction = await transformer.predict(
      pair,
      cachedData,
      windowSeconds || 3600
    );

    res.json(prediction);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error making prediction',
      error: error.message
    });
  }
});

// Add market data to price feed cache
router.post('/price-feed/update', async (req, res) => {
  try {
    const { pair, marketData } = req.body;
    
    if (!pair || !marketData) {
      res.status(400).json({
        status: 'error',
        message: 'Missing required parameters: pair and marketData'
      });
      return;
    }
    
    // Validate market data
    if (!marketData.prices || !Array.isArray(marketData.prices) || marketData.prices.length === 0) {
      res.status(400).json({
        status: 'error',
        message: 'Invalid market data format: missing or invalid prices array'
      });
      return;
    }
    
    // Update market data in price feed cache
    priceFeedCache.updateMarketData(pair, marketData);
    
    // Update latest price point
    const latestPrice = marketData.prices[marketData.prices.length - 1];
    const latestVolume = marketData.volumes && marketData.volumes.length > 0 
      ? marketData.volumes[marketData.volumes.length - 1][1] 
      : 0;
    
    priceFeedCache.updatePriceData({
      pair,
      price: latestPrice[1],
      volume: latestVolume,
      timestamp: new Date(latestPrice[0]),
      source: 'api_update'
    });
    
    res.json({
      status: 'success',
      message: `Price feed updated for ${pair}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error updating price feed',
      error: error.message
    });
  }
});

// Get current price feed state
router.get('/price-feed/status', (req, res) => {
  try {
    // Get all price data
    const priceData = Array.from(priceFeedCache.getAllPriceData().values());
    
    // Get all available market data pairs
    const availableMarketDataPairs = [];
    
    // Creating a function that converts Map to an array safely
    const pairs = [];
    const marketDataCache = priceFeedCache.getAllMarketData();
    
    if (marketDataCache && typeof marketDataCache.forEach === 'function') {
      marketDataCache.forEach((value, key) => {
        pairs.push(key);
      });
    }
    
    // Get information about current data source and status
    const status = {
      activeDataSource: priceFeedCache.getActiveDataSource(),
      usingBackupSource: priceFeedCache.isUsingBackupSource(),
      priceDataCount: priceData.length,
      marketDataCount: pairs.length,
      availablePairs: pairs,
      initialized: true
    };
    
    res.json({
      status: 'success',
      data: {
        prices: priceData,
        status
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error getting price feed status',
      error: error.message
    });
  }
});

// Signal Hub API Endpoints

// Submit a signal to the signal hub
router.post('/signals', async (req, res) => {
  try {
    const signalData = req.body;
    
    if (!signalData.pair || !signalData.type || !signalData.source) {
      res.status(400).json({
        status: 'error',
        message: 'Missing required signal parameters: pair, type, and source are required'
      });
      return;
    }
    
    // Set default values for missing fields
    if (!signalData.strength) signalData.strength = SignalStrength.MODERATE;
    if (!signalData.direction) signalData.direction = SignalDirection.NEUTRAL;
    if (!signalData.priority) signalData.priority = SignalPriority.NORMAL;
    if (!signalData.confidence) signalData.confidence = 50;
    if (!signalData.description) signalData.description = `Signal for ${signalData.pair}`;
    if (!signalData.metadata) signalData.metadata = {};
    
    // Submit the signal to the hub
    const signalId = await signalHub.submitSignal(signalData);
    
    logger.info(`Signal submitted to hub: ${signalId}`);
    
    res.json({
      status: 'success',
      message: 'Signal submitted successfully',
      signalId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error submitting signal:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error submitting signal',
      error: error.message
    });
  }
});

// Get signals matching specific criteria
router.get('/signals', async (req, res) => {
  try {
    const { 
      types, 
      sources, 
      pairs, 
      since, 
      limit = 50 
    } = req.query;
    
    // Parse the query parameters
    const criteria: any = { limit: parseInt(limit as string, 10) };
    
    if (types) {
      criteria.types = (types as string).split(',');
    }
    
    if (sources) {
      criteria.sources = (sources as string).split(',');
    }
    
    if (pairs) {
      criteria.pairs = (pairs as string).split(',');
    }
    
    if (since) {
      criteria.since = new Date(since as string);
    }
    
    // Get signals from the hub
    const signals = signalHub.getSignals(criteria);
    
    res.json({
      status: 'success',
      count: signals.length,
      signals,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting signals:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error getting signals',
      error: error.message
    });
  }
});

// Get signals targeted for a specific component
router.get('/signals/component/:componentName', async (req, res) => {
  try {
    const { componentName } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    
    if (!componentName) {
      res.status(400).json({
        status: 'error',
        message: 'Missing required parameter: componentName'
      });
      return;
    }
    
    // Get signals from the hub
    const signals = signalHub.getSignalsForComponent(componentName, limit);
    
    res.json({
      status: 'success',
      component: componentName,
      count: signals.length,
      signals,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching signals for component:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching signals for component',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get a specific signal by ID
router.get('/signals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        status: 'error',
        message: 'Missing required parameter: id'
      });
      return;
    }
    
    // Get the signal from the hub
    const signal = signalHub.getSignal(id);
    
    if (!signal) {
      res.status(404).json({
        status: 'error',
        message: `Signal with ID ${id} not found`
      });
      return;
    }
    
    // Get related signals if requested
    if (req.query.includeRelated === 'true') {
      const relatedSignals = signalHub.findRelatedSignals(id);
      
      res.json({
        status: 'success',
        signal,
        relatedSignals,
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({
        status: 'success',
        signal,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Error getting signal:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error getting signal',
      error: error.message
    });
  }
});

// Signal Monitoring API Endpoints

// Get signal monitoring metrics and performance data
router.get('/signal-monitoring/metrics', async (req, res) => {
  try {
    // Import signalMonitoring here to avoid circular dependencies
    const { signalMonitoring } = require('./signalMonitoring');
    
    const metrics = signalMonitoring.getMetrics();
    
    res.json({
      status: 'success',
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting signal monitoring metrics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error getting signal monitoring metrics',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get signal validation statistics
router.get('/signal-monitoring/validation', async (req, res) => {
  try {
    // Import signalValidator here to avoid circular dependencies
    const { signalValidator } = require('./signalValidator');
    
    const validationStats = signalValidator.getStats();
    
    res.json({
      status: 'success',
      data: validationStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting signal validation stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error getting signal validation stats',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get component health information
router.get('/signal-monitoring/components', async (req, res) => {
  try {
    // Import signalMonitoring here to avoid circular dependencies
    const { signalMonitoring } = require('./signalMonitoring');
    
    const metrics = signalMonitoring.getMetrics();
    
    res.json({
      status: 'success',
      data: metrics.components,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting component health info:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error getting component health info',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get system health dashboard data
router.get('/signal-monitoring/dashboard', async (req, res) => {
  try {
    // Import signalMonitoring here to avoid circular dependencies
    const { signalMonitoring } = require('./signalMonitoring');
    
    const metrics = signalMonitoring.getMetrics();
    
    // Calculate summary metrics for dashboard
    const lastHourStats = metrics.lastHour;
    const last24HourStats = metrics.last24Hours;
    
    // Calculate performance trends
    const signalTrend = lastHourStats.total > 0 ? 
      (lastHourStats.total / (last24HourStats.total / 24 || 1)) : 0;
      
    const validationTrend = lastHourStats.validRatio > 0 && last24HourStats.validRatio > 0 ?
      (lastHourStats.validRatio / last24HourStats.validRatio) : 1;
      
    const latencyTrend = metrics.validation.latency.average.total > 0 ?
      1 : 0; // We don't have historical data yet
    
    // Identify unhealthy components
    const unhealthyComponents = metrics.components
      .filter((c: any) => c.status === 'error' || c.status === 'degraded')
      .map((c: any) => ({
        name: c.name,
        status: c.status,
        errorRate: c.errorRate,
        lastActive: c.lastActive
      }));
    
    res.json({
      status: 'success',
      data: {
        summary: {
          signalsLastHour: lastHourStats.total,
          validRatio: lastHourStats.validRatio,
          actionableRatio: lastHourStats.total > 0 ? 
            (lastHourStats.actionable / lastHourStats.total) : 0,
          averageLatencyMs: metrics.validation.latency.average.total,
          p95LatencyMs: metrics.validation.latency.p95,
          activeComponents: metrics.components.filter((c: any) => c.status === 'healthy').length,
          totalComponents: metrics.components.length
        },
        trends: {
          signal: signalTrend,
          validation: validationTrend,
          latency: latencyTrend
        },
        health: {
          systemStatus: unhealthyComponents.length === 0 ? 'healthy' : 'degraded',
          unhealthyComponents
        },
        topSignalTypes: Object.entries(lastHourStats.byType)
          .sort((a: any, b: any) => b[1] - a[1])
          .slice(0, 5)
          .map(([type, count]) => ({ type, count })),
        topSignalSources: Object.entries(lastHourStats.bySource)
          .sort((a: any, b: any) => b[1] - a[1])
          .slice(0, 5)
          .map(([source, count]) => ({ source, count }))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting dashboard data:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error getting dashboard data',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Reset metrics (for testing and monitoring recovery)
router.post('/signal-monitoring/reset', async (req, res) => {
  try {
    // Import signalMonitoring here to avoid circular dependencies
    const { signalMonitoring } = require('./signalMonitoring');
    
    signalMonitoring.resetMetrics();
    
    res.json({
      status: 'success',
      message: 'Signal monitoring metrics reset successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error resetting metrics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error resetting metrics',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// External Signal Platforms API Endpoints

// Register an external platform to receive signals
router.post('/external-platforms', async (req, res) => {
  try {
    const platformData = req.body;
    
    if (!platformData.name || !platformData.url) {
      res.status(400).json({
        status: 'error',
        message: 'Missing required parameters: name and url are required'
      });
      return;
    }
    
    // Test connectivity to the platform
    const connectivityTest = await externalSignalService.testPlatformConnectivity(
      platformData.url, 
      platformData.apiKey
    );
    
    if (!connectivityTest.success) {
      res.status(400).json({
        status: 'error',
        message: `Failed to connect to platform: ${connectivityTest.message}`,
        connectivityTest
      });
      return;
    }
    
    // Register the platform
    const platformId = externalSignalService.registerPlatform({
      name: platformData.name,
      url: platformData.url,
      apiKey: platformData.apiKey,
      active: true,
      platformType: platformData.platformType || externalSignalService.PlatformType.GENERIC,
      signalTypes: platformData.signalTypes,
      signalSources: platformData.signalSources,
      pairs: platformData.pairs,
      config: platformData.config
    });
    
    res.json({
      status: 'success',
      message: 'External platform registered successfully',
      platformId,
      connectivityTest,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error registering external platform:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error registering external platform',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get all registered external platforms
router.get('/external-platforms', (req, res) => {
  try {
    const platforms = externalSignalService.getAllPlatforms();
    
    // Remove sensitive data like API keys from the response
    const safeData = platforms.map(platform => ({
      id: platform.id,
      name: platform.name,
      url: platform.url,
      active: platform.active,
      hasApiKey: !!platform.apiKey,
      signalTypes: platform.signalTypes,
      signalSources: platform.signalSources,
      pairs: platform.pairs,
      lastSent: platform.lastSent,
      errorCount: platform.errorCount
    }));
    
    res.json({
      status: 'success',
      count: platforms.length,
      platforms: safeData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting external platforms:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error getting external platforms',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Update an external platform
router.put('/external-platforms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    if (!id) {
      res.status(400).json({
        status: 'error',
        message: 'Missing required parameter: id'
      });
      return;
    }
    
    // Check if platform exists
    const platform = externalSignalService.getPlatform(id);
    
    if (!platform) {
      res.status(404).json({
        status: 'error',
        message: `External platform with ID ${id} not found`
      });
      return;
    }
    
    // If URL is being updated, test connectivity
    if (updates.url) {
      const connectivityTest = await externalSignalService.testPlatformConnectivity(
        updates.url, 
        updates.apiKey || platform.apiKey
      );
      
      if (!connectivityTest.success) {
        res.status(400).json({
          status: 'error',
          message: `Failed to connect to updated platform URL: ${connectivityTest.message}`,
          connectivityTest
        });
        return;
      }
    }
    
    // Update the platform
    const success = externalSignalService.updatePlatform(id, updates);
    
    if (!success) {
      res.status(500).json({
        status: 'error',
        message: 'Failed to update external platform'
      });
      return;
    }
    
    res.json({
      status: 'success',
      message: 'External platform updated successfully',
      platformId: id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error updating external platform:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error updating external platform',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Delete an external platform
router.delete('/external-platforms/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        status: 'error',
        message: 'Missing required parameter: id'
      });
      return;
    }
    
    // Remove the platform
    const success = externalSignalService.removePlatform(id);
    
    if (!success) {
      res.status(404).json({
        status: 'error',
        message: `External platform with ID ${id} not found`
      });
      return;
    }
    
    res.json({
      status: 'success',
      message: 'External platform removed successfully',
      platformId: id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error removing external platform:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error removing external platform',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Manually forward a signal to external platforms
router.post('/external-platforms/forward-signal', async (req, res) => {
  try {
    const { signalId, platformIds } = req.body;
    
    if (!signalId) {
      res.status(400).json({
        status: 'error',
        message: 'Missing required parameter: signalId'
      });
      return;
    }
    
    // Get the signal from the hub
    const signal = signalHub.getSignal(signalId);
    
    if (!signal) {
      res.status(404).json({
        status: 'error',
        message: `Signal with ID ${signalId} not found`
      });
      return;
    }
    
    // Forward to specific platforms or all if not specified
    let receivingPlatforms: string[];
    
    if (platformIds && Array.isArray(platformIds) && platformIds.length > 0) {
      receivingPlatforms = await externalSignalService.forwardSignalToPlatforms(signal, platformIds);
    } else {
      receivingPlatforms = await externalSignalService.forwardSignal(signal);
    }
    
    res.json({
      status: 'success',
      message: `Signal forwarded to ${receivingPlatforms.length} platforms`,
      signalId,
      platforms: receivingPlatforms,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error forwarding signal to external platforms:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error forwarding signal to external platforms',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Test connectivity to an external platform
router.post('/external-platforms/test-connection', async (req, res) => {
  try {
    const { url, apiKey } = req.body;
    
    if (!url) {
      res.status(400).json({
        status: 'error',
        message: 'Missing required parameter: url'
      });
      return;
    }
    
    // Test connectivity
    const connectivityTest = await externalSignalService.testPlatformConnectivity(url, apiKey);
    
    res.json({
      status: connectivityTest.success ? 'success' : 'error',
      message: connectivityTest.message,
      responseTime: connectivityTest.responseTime,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error testing platform connectivity:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error testing platform connectivity',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Manually forward a signal to external platforms
router.post('/external-platforms/forward-signal/:signalId', async (req, res) => {
  try {
    const { signalId } = req.params;
    
    if (!signalId) {
      res.status(400).json({
        status: 'error',
        message: 'Missing required parameter: signalId'
      });
      return;
    }
    
    // Get the signal
    const signal = signalHub.getSignal(signalId);
    
    if (!signal) {
      res.status(404).json({
        status: 'error',
        message: `Signal with ID ${signalId} not found`
      });
      return;
    }
    
    // Forward the signal
    const platformIds = await externalSignalService.forwardSignal(signal);
    
    res.json({
      status: 'success',
      message: `Signal forwarded to ${platformIds.length} external platforms`,
      signalId,
      platformCount: platformIds.length,
      platformIds,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error forwarding signal:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error forwarding signal',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Initialize the SignalHub in routes.ts
(async () => {
  // Initialize the signal hub
  await signalHub.initialize();
  
  // Setup direct handling for market data updates instead of using events
  // We'll use the update function directly in the price feed cache
  // This ensures signals are processed without relying on event emitters
  const originalUpdateMarketData = priceFeedCache.updateMarketData;
  priceFeedCache.updateMarketData = function(pair: string, data: any) {
    // Call the original method
    const result = originalUpdateMarketData.apply(this, [pair, data]);
    
    // Process the market data through signal hub
    signalHub.processMarketData(data);
    
    return result;
  };
  
  // Setup automatic forwarding of signals to external platforms
  signalHub.onAnySignal(async (signal) => {
    try {
      // Forward all signals to external platforms
      await externalSignalService.forwardSignal(signal);
    } catch (error) {
      logger.error('Error in automatic signal forwarding:', error);
    }
  });
})();

// Update model with new data
router.post('/transformer/update', async (req, res) => {
  try {
    if (!transformerApiInitialized) {
      res.status(503).json({
        status: 'error',
        message: 'Transformer API not initialized yet'
      });
      return;
    }

    const { pair, marketData } = req.body;
    
    if (!pair || !marketData) {
      res.status(400).json({
        status: 'error',
        message: 'Missing required parameters: pair and marketData'
      });
      return;
    }

    const transformer = getTransformerAPI(storage);
    await transformer.updateModel(pair, marketData as MarketData);

    res.json({
      status: 'success',
      message: `Model updated for ${pair}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error updating model',
      error: error.message
    });
  }
});

// Train model with historical data
router.post('/transformer/train', async (req, res) => {
  try {
    if (!transformerApiInitialized) {
      res.status(503).json({
        status: 'error',
        message: 'Transformer API not initialized yet'
      });
      return;
    }

    const { pair, marketData, config } = req.body;
    
    if (!pair || !marketData) {
      res.status(400).json({
        status: 'error',
        message: 'Missing required parameters: pair and marketData'
      });
      return;
    }

    const transformer = getTransformerAPI(storage);
    const metrics = await transformer.trainModel(
      pair,
      marketData as MarketData[],
      config || {}
    );

    res.json({
      status: 'success',
      message: `Model trained for ${pair}`,
      metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error training model',
      error: error.message
    });
  }
});

// Get Solana connection status
router.get('/solana/status', async (req, res) => {
  try {
    // Use public endpoint by default for reliability
    let endpoint = 'https://api.mainnet-beta.solana.com';
    let customRpc = false;
    let apiKeyPresent = false;
    
    // Try different endpoints in order of preference
    if (process.env.HELIUS_API_KEY) {
      try {
        // Use Helius with API key
        const heliusEndpoint = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
        logger.info(`Attempting to connect to Solana using Helius endpoint`);
        
        const heliusConnection = new solanaWeb3.Connection(heliusEndpoint, 'confirmed');
        await heliusConnection.getVersion();
        
        // If we get here, the connection worked
        endpoint = heliusEndpoint;
        customRpc = true;
        apiKeyPresent = true;
        logger.info(`Successfully connected to Solana using Helius endpoint`);
      } catch (heliusError) {
        logger.error('Failed to connect using Helius:', heliusError);
        // Continue to next option
      }
    }
    
    // Only try Instant Nodes if Helius didn't work
    if (endpoint === 'https://api.mainnet-beta.solana.com') {
      try {
        // Hardcoded Instant Nodes URL for testing
        const instantNodesUrl = 'https://solana-api.instantnodes.io/token-NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9';
        
        logger.info(`Attempting to connect to Solana using Instant Nodes endpoint`);
        
        const instantNodesConnection = new solanaWeb3.Connection(instantNodesUrl, 'confirmed');
        await instantNodesConnection.getVersion();
        
        // If we get here, the connection worked
        endpoint = instantNodesUrl;
        customRpc = true;
        apiKeyPresent = true;
        logger.info(`Successfully connected to Solana using Instant Nodes endpoint`);
      } catch (instantNodesError) {
        logger.error('Failed to connect using Instant Nodes:', instantNodesError);
        // Continue to public endpoint
      }
    }
    
    // At this point, we're using whatever endpoint succeeded, or the public one as fallback
    logger.info(`Connecting to Solana using endpoint: ${endpoint.includes('api-key') ? endpoint.replace(/api-key=.*/, 'api-key=REDACTED') : endpoint}`);
    
    const connection = new solanaWeb3.Connection(endpoint, 'confirmed');
    const version = await connection.getVersion();
    
    res.json({
      status: 'operational',
      customRpc: customRpc,
      apiKey: apiKeyPresent,
      network: 'mainnet-beta',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to connect to Solana:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to connect to Solana network',
      error: error.message
    });
  }
});

// Perplexity AI API endpoints
// Analyze trading signal with AI
router.post('/ai/analyze-signal', async (req, res) => {
  try {
    const { signalId, pair } = req.body;
    
    if (!signalId) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required parameter: signalId'
      });
    }
    
    // Get the trading signal
    const signal = await storage.getSignal(signalId);
    if (!signal) {
      return res.status(404).json({
        status: 'error',
        message: `Trading signal not found: ${signalId}`
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
    
    const perplexity = getPerplexityService();
    const analysis = await perplexity.analyzeSignal(signal, marketData);
    
    res.json({
      status: 'success',
      signal_id: signalId,
      pair: signal.pair,
      analysis,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('Error analyzing signal with Perplexity AI:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error analyzing signal with AI',
      error: error.message
    });
  }
});

// Generate market insights with AI
router.post('/ai/market-insights', async (req, res) => {
  try {
    const { pair } = req.body;
    
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
    
    const perplexity = getPerplexityService();
    const insights = await perplexity.generateMarketInsights(pair, marketData);
    
    res.json({
      status: 'success',
      pair,
      insights,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('Error generating market insights with Perplexity AI:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error generating market insights with AI',
      error: error.message
    });
  }
});

// Enhance trading strategy with AI recommendations
router.post('/ai/enhance-strategy', async (req, res) => {
  try {
    const { strategyId } = req.body;
    
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
    
    const perplexity = getPerplexityService();
    const enhancement = await perplexity.enhanceStrategy(strategy, marketData);
    
    res.json({
      status: 'success',
      strategy_id: strategyId,
      pair: strategy.pair,
      enhancement,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('Error enhancing strategy with Perplexity AI:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error enhancing strategy with AI',
      error: error.message
    });
  }
});

// Generate market pattern analysis for a trading pair
router.post('/ai/market-pattern', async (req, res) => {
  try {
    const { pair } = req.body;
    
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
    
    const perplexity = getPerplexityService();
    const marketAnalysis = await perplexity.generateMarketInsights(pair, marketData);
    
    res.json({
      status: 'success',
      pair,
      marketAnalysis,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('Error generating market pattern analysis with Perplexity AI:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error generating market pattern analysis with AI',
      error: error.message
    });
  }
});

// Generate learning insight from trading history
router.post('/ai/learning-insight', async (req, res) => {
  try {
    const { pair } = req.body;
    
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
    
    // Get recent trading signals for this pair
    const signals = await storage.getSignals();
    const pairSignals = signals.filter(signal => signal.pair === pair);
    
    if (pairSignals.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: `No trading signals available for: ${pair}`
      });
    }
    
    const perplexity = getPerplexityService();
    const insight = await perplexity.generateLearningInsight(pair, marketData, pairSignals);
    
    // Save the learning insight to database
    const learningInsight = await storage.createLearningInsight({
      description: insight.insight,
      confidence: insight.confidence,
      recommendation: insight.applicationMethod,
      pair,
      agent_type: 'quantum_ai',
      insight_type: InsightType.MARKET_PATTERN,
      strategy_id: pairSignals[0].strategy_id || ''
    });
    
    res.json({
      status: 'success',
      pair,
      insight: {
        ...insight,
        id: learningInsight.id
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('Error generating learning insight with Perplexity AI:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error generating learning insight with AI',
      error: error.message
    });
  }
});

// Setup WebSocket server
export function setupWebSocketServer(httpServer: Server) {
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    // Explicitly allowing connections from any origin
    verifyClient: () => true,
  });
  
  logger.info('💻 WebSocket server accessible at /ws endpoint');
  
  // Log server address details properly
  const addr = httpServer.address();
  if (addr) {
    if (typeof addr === 'string') {
      logger.info(`Server listening on pipe/socket: ${addr}`);
    } else {
      logger.info(`Server listening on ${addr.address}:${addr.port}`);
    }
  } else {
    logger.info('Server address not available yet - waiting for it to start listening')
  }
  
  // Connection handling with detailed logging
  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    logger.info(`New WebSocket connection from ${clientIp}`);
    
    ws.on('message', (message) => {
      try {
        const parsedMessage = JSON.parse(message.toString());
        logger.info(`Received WebSocket message: ${JSON.stringify(parsedMessage)}`);
        
        // Handle PING messages with a PONG response for connection health checks
        if (parsedMessage.type === 'PING') {
          try {
            ws.send(JSON.stringify({
              type: 'PONG',
              timestamp: new Date().toISOString(),
              echo: parsedMessage.timestamp // Echo back the original timestamp for latency calculation
            }));
            logger.debug('Sent PONG response to client');
          } catch (err) {
            logger.error('Error sending PONG response:', err);
          }
        }
        
        // Handle TEST_CONNECTION messages with echo response 
        if (parsedMessage.type === 'TEST_CONNECTION') {
          try {
            ws.send(JSON.stringify({
              type: 'TEST_CONNECTION_RESPONSE',
              message: `Echo: ${parsedMessage.message || 'No message provided'}`,
              timestamp: new Date().toISOString(),
              success: true
            }));
            logger.info('Responded to TEST_CONNECTION message');
          } catch (err) {
            logger.error('Error sending TEST_CONNECTION_RESPONSE:', err);
          }
        }
        
      } catch (e) {
        logger.info(`Received non-JSON WebSocket message: ${message}`);
      }
    });
    
    ws.on('close', (code, reason) => {
      logger.info(`WebSocket connection closed: ${code} ${reason}`);
    });
    
    ws.on('error', (error) => {
      logger.error(`WebSocket error: ${error.message}`);
    });
    
    // Send a welcome message
    ws.send(JSON.stringify({
      type: 'connection_status',
      status: 'connected',
      message: 'Welcome to the Solana Quantum Trading Platform WebSocket Server',
      timestamp: new Date().toISOString()
    }));
  });
  
  // Initialize price feed cache
  priceFeedCache.initialize().catch(err => {
    logger.error('Failed to initialize price feed cache:', err);
  });
  
  // Set up periodic signal monitoring broadcasts
  setInterval(() => {
    try {
      const { signalMonitoring } = require('./signalMonitoring');
      const metrics = signalMonitoring.getMetrics();
      
      // Broadcast to all connected WebSocket clients based on their subscriptions
      wss.clients.forEach((client: WebSocket) => {
        if (client.readyState !== WebSocket.OPEN) {
          return;
        }
        
        const clientInfo = (client as any).clientInfo;
        if (!clientInfo || !clientInfo.subscribedMonitoring) {
          return;
        }
        
        // Check subscriptions and send relevant updates
        if (clientInfo.subscribedMonitoring.has('metrics')) {
          client.send(JSON.stringify({
            type: 'metrics',
            data: metrics,
            timestamp: new Date().toISOString()
          }));
        }
        
        if (clientInfo.subscribedMonitoring.has('validation')) {
          client.send(JSON.stringify({
            type: 'validation',
            data: metrics.validation,
            timestamp: new Date().toISOString()
          }));
        }
        
        if (clientInfo.subscribedMonitoring.has('component-health')) {
          client.send(JSON.stringify({
            type: 'component-health',
            data: metrics.components,
            timestamp: new Date().toISOString()
          }));
        }
        
        if (clientInfo.subscribedMonitoring.has('system-health')) {
          // Count unhealthy components
          const unhealthyComponentCount = metrics.components
            .filter((c: any) => c.status === 'error' || c.status === 'degraded')
            .length;
          
          // Determine system status
          let systemStatus = 'optimal';
          
          if (unhealthyComponentCount > 0) {
            systemStatus = unhealthyComponentCount > metrics.components.length / 3 ? 
              'degraded' : 'warning';
          }
          
          if (metrics.lastMinute.validRatio < 0.8) {
            systemStatus = 'critical';
          }
          
          client.send(JSON.stringify({
            type: 'system-health',
            data: {
              status: systemStatus,
              lastUpdated: new Date(),
              signalFlow: metrics.lastMinute.total > 0 ? 'active' : 'inactive',
              validationRate: metrics.lastMinute.validRatio,
              componentHealth: {
                healthy: metrics.components.filter((c: any) => c.status === 'healthy').length,
                degraded: metrics.components.filter((c: any) => c.status === 'degraded').length,
                error: metrics.components.filter((c: any) => c.status === 'error').length,
                inactive: metrics.components.filter((c: any) => c.status === 'inactive').length,
              },
              alertCount: 
                (metrics.lastHour.validRatio < 0.8 ? 1 : 0) + 
                unhealthyComponentCount +
                (metrics.validation.latency.average.total > 1000 ? 1 : 0)
            },
            timestamp: new Date().toISOString()
          }));
        }
      });
    } catch (error) {
      logger.error('Error broadcasting signal monitoring updates:', error);
    }
  }, 5000); // Every 5 seconds
  
  wss.on('connection', (ws) => {
    logger.info('Client connected to WebSocket');
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'WELCOME',
      message: 'Connected to Solana Trading Platform WebSocket',
      timestamp: new Date().toISOString()
    }));
    
    // Send initial connection status
    // Fix and validate endpoint URLs for WS connection status
    let customRpc = false;
    
    if (process.env.INSTANT_NODES_RPC_URL) {
      customRpc = true;
    } else if (process.env.SOLANA_RPC_API_KEY) {
      customRpc = true;
    }
    
    const connectionStatus = {
      status: 'operational',
      customRpc: customRpc,
      apiKey: true,
      network: 'mainnet-beta',
      timestamp: new Date().toISOString()
    };
    
    ws.send(JSON.stringify(['Solana connection status:', connectionStatus]));
    
    // Hook up agent WebSocket handler
    AgentManager.handleAgentWebSocket(ws);
    
    // Register client with price feed cache for real-time updates
    priceFeedCache.addClient(ws);
    
    // Handle messages
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle PING messages with PONG responses for connection monitoring
        if (data.type === 'PING') {
          logger.debug('Received PING, sending PONG response');
          ws.send(JSON.stringify({
            type: 'PONG',
            timestamp: new Date().toISOString(),
            echo: data.timestamp // Echo back the timestamp for latency calculation
          }));
          return;
        }
        
        // Handle signal monitoring subscriptions
        if (data.type === 'subscribe') {
          // Set up client info if not already present
          if (!(ws as any).clientInfo) {
            (ws as any).clientInfo = {
              subscribedTypes: new Set(),
              subscribedSources: new Set(),
              subscribedPairs: new Set(),
              subscribedMonitoring: new Set()
            };
          }
          
          const clientInfo = (ws as any).clientInfo;
          
          // Handle different subscription types
          if (data.subscriptionType === 'metrics') {
            // Subscribe to metrics updates
            clientInfo.subscribedMonitoring.add('metrics');
            logger.debug('Client subscribed to signal metrics');
            
            // Send initial metrics data
            const { signalMonitoring } = require('./signalMonitoring');
            const metrics = signalMonitoring.getMetrics();
            
            ws.send(JSON.stringify({
              type: 'metrics',
              data: metrics,
              timestamp: new Date().toISOString()
            }));
          } 
          else if (data.subscriptionType === 'validation') {
            // Subscribe to validation updates
            clientInfo.subscribedMonitoring.add('validation');
            logger.debug('Client subscribed to validation updates');
            
            // Send initial validation data
            const { signalValidator } = require('./signalValidator');
            const validationStats = signalValidator.getStats();
            
            ws.send(JSON.stringify({
              type: 'validation',
              data: validationStats,
              timestamp: new Date().toISOString()
            }));
          }
          else if (data.subscriptionType === 'component-health') {
            // Subscribe to component health updates
            clientInfo.subscribedMonitoring.add('component-health');
            logger.debug('Client subscribed to component health updates');
            
            // Send initial component health data
            const { signalMonitoring } = require('./signalMonitoring');
            const metrics = signalMonitoring.getMetrics();
            
            ws.send(JSON.stringify({
              type: 'component-health',
              data: metrics.components,
              timestamp: new Date().toISOString()
            }));
          }
          else if (data.subscriptionType === 'system-health') {
            // Subscribe to system health updates
            clientInfo.subscribedMonitoring.add('system-health');
            logger.debug('Client subscribed to system health updates');
            
            // Calculate and send system health
            const { signalMonitoring } = require('./signalMonitoring');
            const metrics = signalMonitoring.getMetrics();
            
            // Count unhealthy components
            const unhealthyComponentCount = metrics.components
              .filter((c: any) => c.status === 'error' || c.status === 'degraded')
              .length;
            
            // Determine system status
            let systemStatus = 'optimal';
            
            if (unhealthyComponentCount > 0) {
              systemStatus = unhealthyComponentCount > metrics.components.length / 3 ? 
                'degraded' : 'warning';
            }
            
            if (metrics.lastMinute.validRatio < 0.8) {
              systemStatus = 'critical';
            }
            
            ws.send(JSON.stringify({
              type: 'system-health',
              data: {
                status: systemStatus,
                lastUpdated: new Date(),
                signalFlow: metrics.lastMinute.total > 0 ? 'active' : 'inactive',
                validationRate: metrics.lastMinute.validRatio,
                componentHealth: {
                  healthy: metrics.components.filter((c: any) => c.status === 'healthy').length,
                  degraded: metrics.components.filter((c: any) => c.status === 'degraded').length,
                  error: metrics.components.filter((c: any) => c.status === 'error').length,
                  inactive: metrics.components.filter((c: any) => c.status === 'inactive').length,
                },
                alertCount: 
                  (metrics.lastHour.validRatio < 0.8 ? 1 : 0) + 
                  unhealthyComponentCount +
                  (metrics.validation.latency.average.total > 1000 ? 1 : 0)
              },
              timestamp: new Date().toISOString()
            }));
          }
        }
        else if (data.type === 'unsubscribe' && data.subscriptionType) {
          if ((ws as any).clientInfo && (ws as any).clientInfo.subscribedMonitoring) {
            (ws as any).clientInfo.subscribedMonitoring.delete(data.subscriptionType);
            logger.debug(`Client unsubscribed from ${data.subscriptionType}`);
          }
        }
        
        // Handle different message types
        switch(data.type) {
            
          case 'GET_STRATEGIES':
            const strategies = await storage.getStrategies();
            ws.send(JSON.stringify({
              type: 'STRATEGIES',
              data: strategies,
              timestamp: new Date().toISOString()
            }));
            break;
            
          case 'GET_SIGNALS':
            const signals = await storage.getSignals();
            ws.send(JSON.stringify({
              type: 'SIGNALS',
              data: signals,
              timestamp: new Date().toISOString()
            }));
            break;
            
          case 'GET_LEARNING_INSIGHTS':
            try {
              const insights = await storage.getLearningInsights();
              ws.send(JSON.stringify({
                type: 'LEARNING_INSIGHTS',
                data: {
                  insights
                },
                requestId: data.requestId,
                timestamp: new Date().toISOString()
              }));
            } catch (error) {
              logger.error('Error fetching learning insights:', error);
              ws.send(JSON.stringify({
                type: 'ERROR',
                error: 'Failed to fetch learning insights',
                requestId: data.requestId,
                timestamp: new Date().toISOString()
              }));
            }
            break;
            
          case 'GET_AGENT_INSIGHTS':
            try {
              const agentType = data.agentType;
              const insights = await storage.getLearningInsightsByAgentType(agentType);
              
              ws.send(JSON.stringify({
                type: 'AGENT_INSIGHTS',
                data: {
                  insights,
                  agentType
                },
                requestId: data.requestId,
                timestamp: new Date().toISOString()
              }));
            } catch (error) {
              logger.error('Error fetching agent insights:', error);
              ws.send(JSON.stringify({
                type: 'ERROR',
                error: 'Failed to fetch agent insights',
                requestId: data.requestId,
                timestamp: new Date().toISOString()
              }));
            }
            break;
            
          case 'CREATE_INSIGHT':
            try {
              const { 
                description, 
                strategy_id, 
                agent_type, 
                insight_type, 
                confidence, 
                recommendation, 
                pair 
              } = data;
              
              // Validate required fields
              if (!description || !strategy_id || !agent_type || !insight_type || 
                  confidence === undefined || !recommendation) {
                ws.send(JSON.stringify({
                  type: 'ERROR',
                  error: 'Missing required parameters for insight creation',
                  requestId: data.requestId,
                  timestamp: new Date().toISOString()
                }));
                break;
              }
              
              const insightData = {
                description,
                strategy_id,
                agent_type,
                insight_type,
                confidence: Number(confidence),
                recommendation,
                pair
              };
              
              const newInsight = await storage.createLearningInsight(insightData);
              
              ws.send(JSON.stringify({
                type: 'INSIGHT_CREATED',
                data: {
                  success: true,
                  insight: newInsight
                },
                requestId: data.requestId,
                timestamp: new Date().toISOString()
              }));
            } catch (error) {
              logger.error('Error creating insight:', error);
              ws.send(JSON.stringify({
                type: 'ERROR',
                error: 'Failed to create insight',
                requestId: data.requestId,
                timestamp: new Date().toISOString()
              }));
            }
            break;
            
          case 'APPLY_INSIGHT':
            try {
              const insightId = data.insightId;
              const success = data.success;
              const performanceDelta = data.performanceDelta;
              const notes = data.notes;
              
              if (!insightId || typeof success !== 'boolean' || typeof performanceDelta !== 'number' || !notes) {
                ws.send(JSON.stringify({
                  type: 'ERROR',
                  error: 'Missing required parameters',
                  requestId: data.requestId,
                  timestamp: new Date().toISOString()
                }));
                break;
              }
              
              const result = {
                success,
                performance_delta: performanceDelta,
                notes,
                applied_at: new Date()
              };
              
              const updatedInsight = await storage.applyLearningInsight(insightId, result);
              
              if (!updatedInsight) {
                ws.send(JSON.stringify({
                  type: 'ERROR',
                  error: 'Insight not found',
                  requestId: data.requestId,
                  timestamp: new Date().toISOString()
                }));
                break;
              }
              
              ws.send(JSON.stringify({
                type: 'INSIGHT_APPLIED',
                data: {
                  insightId,
                  success: true,
                  insight: updatedInsight
                },
                requestId: data.requestId,
                timestamp: new Date().toISOString()
              }));
            } catch (error) {
              logger.error('Error applying insight:', error);
              ws.send(JSON.stringify({
                type: 'ERROR',
                error: 'Failed to apply insight',
                requestId: data.requestId,
                timestamp: new Date().toISOString()
              }));
            }
            break;
            
          case 'GET_SOLANA_CONNECTION_INFO':
            try {
              // Use Instant Nodes for getting connection info
              const instantNodesUrl = 'https://solana-api.instantnodes.io/token-NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9';
              
              // Check if we have WebSocket support
              const hasWebSocket = !!process.env.INSTANT_NODES_WS_URL;
              
              let connectionInfo;
              try {
                const connection = new solanaWeb3.Connection(instantNodesUrl, 'confirmed');
                const versionInfo = await connection.getVersion();
                
                connectionInfo = {
                  status: 'operational',
                  customRpc: true,
                  apiKey: true,
                  network: 'mainnet-beta',
                  websocket: hasWebSocket,
                  version: versionInfo["solana-core"],
                  timestamp: new Date().toISOString()
                };
              } catch (connError) {
                // Fallback to public endpoint
                const publicEndpoint = 'https://api.mainnet-beta.solana.com';
                const connection = new solanaWeb3.Connection(publicEndpoint, 'confirmed');
                const versionInfo = await connection.getVersion();
                
                connectionInfo = {
                  status: 'operational',
                  customRpc: false,
                  apiKey: false,
                  network: 'mainnet-beta',
                  websocket: false,
                  version: versionInfo["solana-core"],
                  timestamp: new Date().toISOString()
                };
              }
              
              ws.send(JSON.stringify({
                type: 'SOLANA_CONNECTION_INFO',
                data: connectionInfo,
                requestId: data.requestId,
                timestamp: new Date().toISOString()
              }));
            } catch (err) {
              logger.error('Error getting Solana connection info:', err);
              ws.send(JSON.stringify({
                type: 'ERROR',
                message: 'Failed to get Solana connection info',
                error: err.message,
                requestId: data.requestId,
                timestamp: new Date().toISOString()
              }));
            }
            break;
            
          case 'PREDICT':
            if (transformerApiInitialized) {
              const transformer = getTransformerAPI(storage);
              const prediction = await transformer.predict(
                data.pair,
                data.marketData,
                data.windowSeconds || 3600
              );
              
              ws.send(JSON.stringify({
                type: 'PREDICTION',
                data: prediction,
                requestId: data.requestId,
                timestamp: new Date().toISOString()
              }));
            } else {
              ws.send(JSON.stringify({
                type: 'ERROR',
                message: 'AI system not initialized',
                requestId: data.requestId,
                timestamp: new Date().toISOString()
              }));
            }
            break;
            
          default:
            logger.warn(`Unknown message type: ${data.type}`);
        }
      } catch (error) {
        logger.error('WebSocket message processing error:', error);
        ws.send(JSON.stringify({
          type: 'ERROR',
          message: 'Failed to process message',
          error: error.message,
          timestamp: new Date().toISOString()
        }));
      }
    });
    
    // Handle close
    ws.on('close', () => {
      logger.info('Client disconnected from WebSocket');
    });
    
    // Handle errors
    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
    });
  });
  
  return wss;
}

// Get all wallets
router.get('/wallets', async (req, res) => {
  try {
    const wallets = await storage.getWallets();
    res.json(wallets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create wallet
router.post('/wallets', async (req, res) => {
  try {
    const parsedData = insertWalletSchema.parse(req.body);
    
    // Generate keypair for new wallet
    const keypair = solanaWeb3.Keypair.generate();
    
    const wallet = {
      id: uuidv4(),
      name: parsedData.name,
      address: keypair.publicKey.toString(),
      balance: 0,
      created_at: new Date()
    };
    
    const newWallet = await storage.createWallet(wallet);
    res.status(201).json(newWallet);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all strategies
router.get('/strategies', async (req, res) => {
  try {
    const strategies = await storage.getStrategies();
    res.json(strategies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all learning insights
router.get('/insights', async (req, res) => {
  try {
    const insights = await storage.getLearningInsights();
    res.json(insights);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get learning insights by agent type
router.get('/insights/agent/:type', async (req, res) => {
  try {
    const agentType = req.params.type;
    const insights = await storage.getLearningInsightsByAgentType(agentType);
    res.json(insights);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create learning insight
router.post('/insights', async (req, res) => {
  try {
    const { 
      description, 
      strategy_id, 
      agent_type, 
      insight_type, 
      confidence, 
      recommendation, 
      pair 
    } = req.body;
    
    // Validate required fields
    if (!description || !strategy_id || !agent_type || !insight_type || 
        confidence === undefined || !recommendation) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const insightData = {
      description,
      strategy_id,
      agent_type,
      insight_type,
      confidence: Number(confidence),
      recommendation,
      pair
    };
    
    const newInsight = await storage.createLearningInsight(insightData);
    
    res.status(201).json(newInsight);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Apply insight
router.post('/insights/:id/apply', async (req, res) => {
  try {
    const id = req.params.id;
    const { success, performance_delta, notes } = req.body;
    
    if (typeof success !== 'boolean' || typeof performance_delta !== 'number' || !notes) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const result = {
      success,
      performance_delta: performance_delta,
      notes,
      applied_at: new Date()
    };
    
    const updatedInsight = await storage.applyLearningInsight(id, result);
    
    if (!updatedInsight) {
      return res.status(404).json({ error: 'Insight not found' });
    }
    
    res.json(updatedInsight);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Create strategy
router.post('/strategies', async (req, res) => {
  try {
    const parsedData = insertStrategySchema.parse(req.body);
    
    const strategy = {
      id: uuidv4(),
      ...parsedData,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    const newStrategy = await storage.createStrategy(strategy);
    res.status(201).json(newStrategy);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update strategy
router.patch('/strategies/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const updates = req.body;
    
    const updatedStrategy = await storage.updateStrategy(id, {
      ...updates,
      updated_at: new Date()
    });
    
    if (!updatedStrategy) {
      return res.status(404).json({ error: 'Strategy not found' });
    }
    
    res.json(updatedStrategy);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all trading signals
router.get('/signals', async (req, res) => {
  try {
    const signals = await storage.getSignals();
    res.json(signals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create trading signal
router.post('/signals', async (req, res) => {
  try {
    const parsedData = insertTradingSignalSchema.parse(req.body);
    
    const signal = {
      id: uuidv4(),
      ...parsedData,
      created_at: new Date()
    };
    
    const newSignal = await storage.createSignal(signal);
    res.status(201).json(newSignal);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all transactions
router.get('/transactions', async (req, res) => {
  try {
    const transactions = await storage.getTransactions();
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create transaction
router.post('/transactions', async (req, res) => {
  try {
    const parsedData = insertTransactionSchema.parse(req.body);
    
    const transaction = {
      id: uuidv4(),
      ...parsedData,
      created_at: new Date()
    };
    
    const newTransaction = await storage.createTransaction(transaction);
    res.status(201).json(newTransaction);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update transaction status
router.patch('/transactions/:id/status', async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body;
    
    if (!Object.values(TransactionStatus).includes(status)) {
      return res.status(400).json({ error: 'Invalid transaction status' });
    }
    
    const updatedTransaction = await storage.updateTransactionStatus(id, status);
    
    if (!updatedTransaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    res.json(updatedTransaction);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// AI Transformer endpoints

// Initialize transformer API
const initializeTransformerAPI = async () => {
  if (!transformerApiInitialized) {
    try {
      const transformer = getTransformerAPI(storage);
      await transformer.initialize();
      transformerApiInitialized = true;
      logger.info("Transformer API initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize transformer API:", error);
    }
  }
};

// Initialize on startup
initializeTransformerAPI();

// Define agent router
const agentRouter = express.Router();

// Get all agents
agentRouter.get('/', (req, res) => {
  try {
    const agents = AgentManager.getAgents();
    res.json({
      agents,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error("Error in /api/agents:", error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

// Get agent system status
agentRouter.get('/status', (req, res) => {
  try {
    const isRunning = AgentManager.isRunning();
    res.json({
      status: isRunning ? 'running' : 'stopped',
      message: isRunning ? 'Agent system is running' : 'Agent system is stopped',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error("Error in /api/agents/status:", error);
    res.status(500).json({ error: 'Failed to get agent system status' });
  }
});

// Start agent system
agentRouter.post('/start', async (req, res) => {
  try {
    const success = await AgentManager.startAgentSystem();
    res.json({
      success,
      message: success ? 'Agent system started successfully' : 'Failed to start agent system',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error("Error in /api/agents/start:", error);
    res.status(500).json({ error: 'Failed to start agent system' });
  }
});

// Stop agent system
agentRouter.post('/stop', async (req, res) => {
  try {
    const success = await AgentManager.stopAgentSystem();
    res.json({
      success,
      message: success ? 'Agent system stopped successfully' : 'Failed to stop agent system',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error("Error in /api/agents/stop:", error);
    res.status(500).json({ error: 'Failed to stop agent system' });
  }
});

// Get specific agent
agentRouter.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const agent = AgentManager.getAgent(id);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    res.json({
      agent,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error in /api/agents/${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch agent' });
  }
});

// Activate agent
agentRouter.post('/:id/activate', async (req, res) => {
  try {
    const { id } = req.params;
    const agent = AgentManager.getAgent(id);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    if (agent.status !== 'idle') {
      return res.status(400).json({ error: `Agent is ${agent.status}, must be idle to activate` });
    }
    
    agent.active = true;
    agent.status = 'scanning';
    
    AgentManager.broadcastAgentUpdate(agent);
    
    res.json({
      success: true,
      agent,
      message: `Agent ${id} activated successfully`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error in /api/agents/${req.params.id}/activate:`, error);
    res.status(500).json({ error: 'Failed to activate agent' });
  }
});

// Deactivate agent
agentRouter.post('/:id/deactivate', async (req, res) => {
  try {
    const { id } = req.params;
    const agent = AgentManager.getAgent(id);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    agent.active = false;
    agent.status = 'idle';
    
    AgentManager.broadcastAgentUpdate(agent);
    
    res.json({
      success: true,
      agent,
      message: `Agent ${id} deactivated successfully`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error in /api/agents/${req.params.id}/deactivate:`, error);
    res.status(500).json({ error: 'Failed to deactivate agent' });
  }
});

// Register agent routes
router.use('/agents', agentRouter);

// Learning insights routes
router.get('/api/insights', async (req, res) => {
  try {
    const insights = await storage.getLearningInsights();
    res.json({
      insights,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error("Error in /api/insights:", error);
    res.status(500).json({ error: 'Failed to fetch insights' });
  }
});

// Create a learning insight
router.post('/api/insights', async (req, res) => {
  try {
    const { 
      description, 
      strategy_id, 
      agent_type, 
      insight_type, 
      confidence, 
      recommendation, 
      pair 
    } = req.body;
    
    // Validate required fields
    if (!description || !strategy_id || !agent_type || !insight_type || 
        confidence === undefined || !recommendation) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const insightData = {
      description,
      strategy_id,
      agent_type,
      insight_type,
      confidence: Number(confidence),
      recommendation,
      pair
    };
    
    const newInsight = await storage.createLearningInsight(insightData);
    
    res.status(201).json({
      success: true,
      insight: newInsight,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error("Error in POST /api/insights:", error);
    res.status(500).json({ error: 'Failed to create insight' });
  }
});

router.get('/api/insights/:agentType', async (req, res) => {
  try {
    const { agentType } = req.params;
    
    const insights = await storage.getLearningInsightsByAgentType(agentType);
    res.json({
      insights,
      agentType,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error in /api/insights/${req.params.agentType}:`, error);
    res.status(500).json({ error: 'Failed to fetch insights for agent' });
  }
});

router.post('/api/insights/:id/apply', async (req, res) => {
  try {
    const { id } = req.params;
    const { success, performance_delta, notes } = req.body;
    
    if (typeof success !== 'boolean' || typeof performance_delta !== 'number' || !notes) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const result = {
      success,
      performance_delta,
      notes,
      applied_at: new Date()
    };
    
    const updatedInsight = await storage.applyLearningInsight(id, result);
    
    if (!updatedInsight) {
      return res.status(404).json({ error: 'Insight not found' });
    }
    
    res.json({ 
      success: true, 
      message: 'Insight applied successfully',
      insight: updatedInsight,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error in /api/insights/${req.params.id}/apply:`, error);
    res.status(500).json({ error: 'Failed to apply insight' });
  }
});

// Get AI market pattern analysis for a specific pair
router.get('/api/ai/market-pattern-analysis/:pair', async (req, res) => {
  try {
    const { pair } = req.params;
    
    if (!pair) {
      return res.status(400).json({ error: 'Missing pair parameter' });
    }
    
    // Get market data from price feed cache
    const marketData = priceFeedCache.getMarketData(pair);
    
    if (!marketData) {
      return res.status(404).json({ 
        error: 'Market data not found for the specified pair',
        message: 'Please populate the price feed cache first with real market data'
      });
    }
    
    // Get Perplexity service
    const perplexityService = getPerplexityService();
    
    if (!perplexityService) {
      return res.status(500).json({ 
        error: 'Perplexity AI service not initialized',
        message: 'Make sure the PERPLEXITY_API_KEY is set'
      });
    }
    
    // Generate market analysis using Perplexity AI
    const marketAnalysis = await perplexityService.generateMarketInsights(pair, marketData);
    
    // Return the analysis
    res.json({
      success: true,
      pair,
      marketAnalysis,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error(`Error in /ai/market-pattern-analysis/${req.params.pair}:`, error);
    res.status(500).json({ 
      error: 'Failed to generate market pattern analysis',
      message: error.message
    });
  }
});

// Get transformer status
router.get('/ai/status', async (req, res) => {
  try {
    // Initialize if not already
    if (!transformerApiInitialized) {
      await initializeTransformerAPI();
    }
    
    res.json({
      status: transformerApiInitialized ? 'operational' : 'initializing',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error("Error in /ai/status:", error);
    res.status(500).json({ error: error.message });
  }
});

// Make a prediction
router.post('/ai/predict', async (req, res) => {
  try {
    if (!transformerApiInitialized) {
      await initializeTransformerAPI();
      if (!transformerApiInitialized) {
        return res.status(503).json({ error: 'Transformer API not initialized' });
      }
    }
    
    const { pair, marketData, windowSeconds } = req.body;
    
    if (!pair || !marketData) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const transformer = getTransformerAPI(storage);
    const prediction = await transformer.predict(
      pair, 
      marketData as MarketData, 
      windowSeconds || 3600
    );
    
    res.json(prediction);
  } catch (error) {
    logger.error("Error in /ai/predict:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update model with new market data
router.post('/ai/update', async (req, res) => {
  try {
    if (!transformerApiInitialized) {
      await initializeTransformerAPI();
      if (!transformerApiInitialized) {
        return res.status(503).json({ error: 'Transformer API not initialized' });
      }
    }
    
    const { pair, marketData } = req.body;
    
    if (!pair || !marketData) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const transformer = getTransformerAPI(storage);
    await transformer.updateModel(pair, marketData as MarketData);
    
    res.json({ status: 'success', timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error("Error in /ai/update:", error);
    res.status(500).json({ error: error.message });
  }
});

// Train model with historical data
router.post('/ai/train', async (req, res) => {
  try {
    if (!transformerApiInitialized) {
      await initializeTransformerAPI();
      if (!transformerApiInitialized) {
        return res.status(503).json({ error: 'Transformer API not initialized' });
      }
    }
    
    const { pair, marketData, config } = req.body;
    
    if (!pair || !marketData || !Array.isArray(marketData)) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const transformer = getTransformerAPI(storage);
    const metrics = await transformer.trainModel(
      pair, 
      marketData as MarketData[], 
      config || {}
    );
    
    res.json({ status: 'success', metrics });
  } catch (error) {
    logger.error("Error in /ai/train:", error);
    res.status(500).json({ error: error.message });
  }
});

// TEST ENDPOINT: Populate price feed cache with realistic data for testing
router.post('/api/test/populate-price-feed', async (req, res) => {
  try {
    const pairs = ['SOL/USDC', 'BONK/USDC', 'JUP/USDC'];
    const now = Date.now();
    
    for (const pair of pairs) {
      const price = pair.startsWith('SOL') ? 172.43 : 
                     pair.startsWith('BONK') ? 0.00002184 : 
                     pair.startsWith('JUP') ? 1.28 : 1.0;
                     
      // Generate price data with realistic fluctuation
      const priceData = [];
      const volumeData = [];
      const orderBookData = [];
      const macdData = [];
      const rsiData = [];
      
      for (let i = 0; i < 24; i++) {
        const timestamp = new Date(now - (23 - i) * 3600 * 1000).toISOString();
        const noise = (Math.random() - 0.5) * 0.05; // 5% random variation
        const adjustedPrice = price * (1 + noise);
        priceData.push([timestamp, adjustedPrice]);
        
        // Volume data with some realistic patterns
        const baseVolume = pair.startsWith('SOL') ? 1500000 : 
                          pair.startsWith('BONK') ? 8500000000 : 
                          pair.startsWith('JUP') ? 850000 : 100000;
        const volumeNoise = (Math.random() - 0.3) * 0.8; // Volume has more variance
        const volume = baseVolume * (1 + volumeNoise);
        volumeData.push([timestamp, volume]);
        
        // Order book data (simplified)
        const bids = [[adjustedPrice * 0.99, 1000], [adjustedPrice * 0.98, 5000], [adjustedPrice * 0.97, 10000]];
        const asks = [[adjustedPrice * 1.01, 1000], [adjustedPrice * 1.02, 5000], [adjustedPrice * 1.03, 10000]];
        orderBookData.push([timestamp, bids, asks]);
        
        // Technical indicators
        const macd = Math.sin(i / 4) * 0.5;
        macdData.push([timestamp, macd]);
        
        const rsi = 50 + Math.sin(i / 3) * 20;
        rsiData.push([timestamp, rsi]);
      }
      
      // Create market data object
      const marketData = {
        pair,
        price: priceData[priceData.length - 1][1],
        priceChange24h: ((priceData[priceData.length - 1][1] / priceData[0][1]) - 1) * 100,
        priceHistory: priceData,
        volume24h: volumeData.reduce((sum, [_, vol]) => sum + vol, 0),
        volumeHistory: volumeData,
        orderBooks: orderBookData,
        indicators: {
          macd: macdData,
          rsi: rsiData
        },
        lastUpdated: new Date().toISOString()
      };
      
      // Add to price feed cache
      priceFeedCache.updateMarketData(pair, marketData);
    }
    
    res.json({ 
      status: 'success', 
      message: 'Price feed cache populated with test data', 
      pairs 
    });
  } catch (error: any) {
    logger.error("Error in /test/populate-price-feed:", error);
    res.status(500).json({ error: error.message });
  }
});

// DEX API Endpoints
// Get all supported DEXs
router.get('/dexes', (req, res) => {
  try {
    const dexes = getAllDexes();
    
    res.json({
      status: 'success',
      count: dexes.length,
      dexes,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting all DEXes:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error getting DEX information',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get DEX by ID
router.get('/dexes/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        status: 'error',
        message: 'Missing required parameter: id'
      });
      return;
    }
    
    const dex = getDexInfo(id as DexType);
    
    if (!dex) {
      res.status(404).json({
        status: 'error',
        message: `DEX with ID ${id} not found`
      });
      return;
    }
    
    res.json({
      status: 'success',
      dex,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting DEX:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error getting DEX information',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get DEXes by category
router.get('/dexes/category/:category', (req, res) => {
  try {
    const { category } = req.params;
    
    if (!category) {
      res.status(400).json({
        status: 'error',
        message: 'Missing required parameter: category'
      });
      return;
    }
    
    const dexes = getDexesByCategory(category as DexCategory);
    
    res.json({
      status: 'success',
      count: dexes.length,
      dexes,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting DEXes by category:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error getting DEX information',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get all supported analytics platforms
router.get('/analytics-platforms', (req, res) => {
  try {
    const platforms = getAllAnalyticsPlatforms();
    
    res.json({
      status: 'success',
      count: platforms.length,
      platforms,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting analytics platforms:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error getting analytics platform information',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get all supported lending protocols
router.get('/lending-protocols', (req, res) => {
  try {
    const protocols = getAllLendingProtocols();
    
    res.json({
      status: 'success',
      count: protocols.length,
      protocols,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting lending protocols:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error getting lending protocol information',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get liquidity pools
router.get('/liquidity-pools', (req, res) => {
  try {
    const { dex } = req.query;
    
    let pools: LiquidityPoolInfo[];
    
    if (dex) {
      pools = getLiquidityPools(dex as DexType);
    } else {
      pools = getLiquidityPools();
    }
    
    res.json({
      status: 'success',
      count: pools.length,
      pools,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting liquidity pools:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error getting liquidity pool information',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get all supported trading pairs
router.get('/trading-pairs', (req, res) => {
  try {
    const pairs = getAllSupportedPairs();
    
    res.json({
      status: 'success',
      count: pairs.length,
      pairs,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting supported trading pairs:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error getting trading pair information',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Initialize transformer API
(async () => {
  try {
    if (!transformerApiInitialized) {
      logger.info('Initializing transformer API with pairs: SOL/USDC, BONK/USDC');
      const transformer = getTransformerAPI();
      
      // Check if the initialize method exists and call it
      if (typeof transformer.initialize === 'function') {
        // Use the new initialization method
        const defaultPairs = ['SOL/USDC', 'BONK/USDC', 'JUP/USDC'];
        const success = transformer.initialize(defaultPairs);
        transformerApiInitialized = success;
        if (success) {
          logger.info('Transformer API initialized successfully');
        } else {
          logger.warn('Transformer API initialization returned false');
        }
      } 
      // Try legacy initialization method as fallback
      else if (typeof transformer.initializeTransformersAPI === 'function') {
        // Use the legacy initialization method
        const defaultPairs = ['SOL/USDC', 'BONK/USDC'];
        const success = transformer.initializeTransformersAPI(defaultPairs);
        transformerApiInitialized = success;
        logger.info('Transformer API initialized successfully via legacy method');
      } else {
        // Mark as initialized to avoid blocking other features
        transformerApiInitialized = true;
        logger.warn('Transformer API object missing required initialization methods');
      }
    }
  } catch (error) {
    logger.error("Failed to initialize transformer API:", error);
    // Mark as initialized to avoid blocking other features
    transformerApiInitialized = true;
  }
})();

export default router;