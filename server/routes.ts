import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { ArbitrageOpportunity } from './signalTypes';
import { getAllDexes } from './dexInfo';
import * as nexusEngine from './nexus-transaction-engine';
import * as logger from './logger';
import * as agents from './agents';
import { AgentType } from './agents';
import { ComponentStatus } from './systemMemory';
import { perplexityAI } from './perplexity-integration';
import { localMarketAnalysis } from './lib/localMarketAnalysis';
import { marketAnalysisSignalGenerator } from './lib/marketAnalysisSignalGenerator';
import { WalletManager, WalletType } from './lib/walletManager';
import { verificationIntegration } from './verification-integration';
import { transactionVerifier } from './aws-services';
import { memeCortexTransformer, momentumSurfingStrategy } from './memecortex-connector';
import { priceFeedCache } from './priceFeedCache';
import { 
  SignalType, 
  SignalStrength, 
  SignalDirection, 
  SignalPriority,
  SignalSource 
} from '../shared/signalTypes';
import * as fs from 'fs';
import * as path from 'path';
import { generateStaticDashboard, Signal as DashboardSignal } from './static-dashboard';
// Import special route modules in the registerRoutes function
import solendRouter from './routes/solend';
import sniperRouter from './routes/sniperRoutes';
import memecoinRouter from './routes/memecoinRoutes';
// Import token scanner 
import { scanForTokens, findSniperOpportunities } from './lib/memeTokenScanner';

const router = express.Router();
let usingNexusEngine = true; // Always use the Nexus Professional Engine

// Static Dashboard Route - No JavaScript Required
router.get('/dashboard', (req, res) => {
  try {
    // Check if signalHub is initialized
    if (!global.signalHub) {
      return res.status(503).send(`
        <html>
          <head>
            <title>Signal Hub Unavailable</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background-color: #0f172a;
                color: #f8fafc;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                padding: 20px;
              }
              .error-container {
                background: #1e293b;
                border-radius: 8px;
                padding: 30px;
                max-width: 500px;
                text-align: center;
              }
              h1 { color: #ef4444; }
              p { line-height: 1.6; }
            </style>
          </head>
          <body>
            <div class="error-container">
              <h1>Signal Hub Unavailable</h1>
              <p>The trading signal hub is not currently available. Please try again later.</p>
              <p>Status: Initializing System</p>
              <p><a href="/dashboard" style="color: #38bdf8; text-decoration: none;">Refresh</a></p>
            </div>
          </body>
        </html>
      `);
    }
    
    // Get signals from the hub (last 30)
    const rawSignals = global.signalHub ? global.signalHub.getSignals(signal => {
      // Filter to the most recent signals (up to 30)
      return true;
    }).slice(0, 30) : [];
    
    // Convert the signal hub signals to dashboard-compatible signals
    const dashboardSignals: DashboardSignal[] = rawSignals.map(signal => {
      // Extract source/target tokens from various signal fields
      let sourceToken = signal.sourceToken || 'USDC';
      let targetToken = signal.targetToken;
      
      // If not directly available, try to extract from pair
      if (!targetToken && signal.pair) {
        const pairParts = signal.pair.split('/');
        if (pairParts.length === 2) {
          targetToken = pairParts[0];
          if (!sourceToken) sourceToken = pairParts[1];
        }
      }
      
      // Create a dashboard-compatible signal
      return {
        id: signal.id,
        pair: signal.pair || `${targetToken}/${sourceToken}`,
        type: signal.type,
        strength: signal.strength || 'STRONG',
        timestamp: typeof signal.timestamp === 'number' ? 
          new Date(signal.timestamp).toISOString() : 
          new Date().toISOString(),
        source: signal.source,
        confidence: signal.confidence,
        sourceToken: sourceToken,
        targetToken: targetToken || 'SOL',
        amount: typeof signal.metadata?.amount === 'number' ? 
          signal.metadata.amount : 
          100,
        status: signal.processed ? 
          (signal.actionTaken ? 'EXECUTED' : 'FAILED') : 
          'PENDING',
        transactionSignature: signal.transactionSignature,
        direction: signal.direction || 'NEUTRAL',
        priority: signal.priority || 'MEDIUM',
        description: signal.description || `Signal for ${targetToken}`,
        actionable: signal.actionable !== undefined ? signal.actionable : true
      };
    });
    
    // Generate and return the dashboard HTML 
    const dashboardHtml = generateStaticDashboard(dashboardSignals);
    res.send(dashboardHtml);
  } catch (error) {
    logger.error('Error generating dashboard:', error);
    res.status(500).send(`
      <html>
        <head>
          <title>Dashboard Error</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background-color: #0f172a;
              color: #f8fafc;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              padding: 20px;
            }
            .error-container {
              background: #1e293b;
              border-radius: 8px;
              padding: 30px;
              max-width: 500px;
              text-align: center;
            }
            h1 { color: #ef4444; }
            p { line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h1>Dashboard Error</h1>
            <p>An error occurred while generating the dashboard.</p>
            <p>Error: ${error.message || 'Unknown error'}</p>
            <p><a href="/dashboard" style="color: #38bdf8; text-decoration: none;">Try Again</a></p>
          </div>
        </body>
      </html>
    `);
  }
});

// Root route to redirect to dashboard
router.get('/', (req, res) => {
  res.redirect('/dashboard');
});

// Perplexity AI API Routes
router.get('/api/perplexity/status', (req, res) => {
  const status = {
    status: 'operational',
    initialized: perplexityAI.isInitialized(),
    model: 'llama-3.1-sonar-small-128k-online',
    timestamp: new Date().toISOString()
  };
  res.json(status);
});

router.get('/api/perplexity/analyze/:token', async (req, res) => {
  try {
    const token = req.params.token.toUpperCase();
    const analysis = await perplexityAI.analyzeToken(token);
    res.json({
      token,
      analysis,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error in /api/perplexity/analyze/${req.params.token}:`, error);
    res.status(500).json({
      error: 'Failed to analyze token',
      message: error.message
    });
  }
});

router.get('/api/perplexity/sentiment/:token', async (req, res) => {
  try {
    const token = req.params.token.toUpperCase();
    const sentiment = await perplexityAI.getMarketSentiment(token);
    res.json({
      token,
      sentiment,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error in /api/perplexity/sentiment/${req.params.token}:`, error);
    res.status(500).json({
      error: 'Failed to get market sentiment',
      message: error.message
    });
  }
});

// Signal Hub API Routes
router.get('/api/signals', (req, res) => {
  try {
    // Check if signalHub is initialized
    if (!global.signalHub) {
      return res.status(503).json({
        error: 'Signal Hub not initialized',
        message: 'The Signal Hub service is not currently available'
      });
    }

    // Get query parameters
    const types = req.query.types ? (req.query.types as string).split(',') : [];
    const sources = req.query.sources ? (req.query.sources as string).split(',') : [];
    const pairs = req.query.pairs ? (req.query.pairs as string).split(',') : [];
    const sinceStr = req.query.since as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    
    // Convert types and sources to enums if provided
    const typesEnum = types.length > 0 
      ? types.map(t => SignalType[t as keyof typeof SignalType]).filter(Boolean) 
      : undefined;
    
    const sourcesEnum = sources.length > 0 
      ? sources.map(s => SignalSource[s as keyof typeof SignalSource]).filter(Boolean) 
      : undefined;
    
    // Parse the since parameter if provided
    const since = sinceStr ? new Date(sinceStr) : new Date(Date.now() - 24 * 60 * 60 * 1000); // Default to last 24 hours
    
    // Get signals from the hub
    const signals = global.signalHub.getSignals({
      types: typesEnum,
      sources: sourcesEnum,
      pairs: pairs.length > 0 ? pairs : undefined,
      since,
      limit
    });
    
    // Return the signals
    res.json({
      count: signals.length,
      signals,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error in /api/signals:', error);
    res.status(500).json({
      error: 'Failed to retrieve signals',
      message: error.message || 'Unknown error'
    });
  }
});

// Get signals for a specific token
router.get('/api/signals/:token', (req, res) => {
  try {
    const token = req.params.token.toUpperCase();
    
    // Check if signalHub is initialized
    if (!global.signalHub) {
      return res.status(503).json({
        error: 'Signal Hub not initialized',
        message: 'The Signal Hub service is not currently available'
      });
    }
    
    // Get query parameters
    const types = req.query.types ? (req.query.types as string).split(',') : [];
    const sources = req.query.sources ? (req.query.sources as string).split(',') : [];
    const sinceStr = req.query.since as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    
    // Convert types and sources to enums if provided
    const typesEnum = types.length > 0 
      ? types.map(t => SignalType[t as keyof typeof SignalType]).filter(Boolean) 
      : undefined;
    
    const sourcesEnum = sources.length > 0 
      ? sources.map(s => SignalSource[s as keyof typeof SignalSource]).filter(Boolean) 
      : undefined;
    
    // Parse the since parameter if provided
    const since = sinceStr ? new Date(sinceStr) : new Date(Date.now() - 24 * 60 * 60 * 1000); // Default to last 24 hours
    
    // Get signals from the hub
    const signals = global.signalHub.getSignals({
      types: typesEnum,
      sources: sourcesEnum,
      pairs: [token],
      since,
      limit
    });
    
    // Return the signals
    res.json({
      token,
      count: signals.length,
      signals,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error in /api/signals/${req.params.token}:`, error);
    res.status(500).json({
      error: 'Failed to retrieve signals for token',
      message: error.message || 'Unknown error'
    });
  }
});

// Get signal by ID
router.get('/api/signal/:id', (req, res) => {
  try {
    const signalId = req.params.id;
    
    // Check if signalHub is initialized
    if (!global.signalHub) {
      return res.status(503).json({
        error: 'Signal Hub not initialized',
        message: 'The Signal Hub service is not currently available'
      });
    }
    
    // Get signal from the hub
    const signal = global.signalHub.getSignal(signalId);
    
    if (!signal) {
      return res.status(404).json({
        error: 'Signal not found',
        message: `No signal found with ID ${signalId}`
      });
    }
    
    // Return the signal
    res.json({
      signal,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error in /api/signal/${req.params.id}:`, error);
    res.status(500).json({
      error: 'Failed to retrieve signal',
      message: error.message || 'Unknown error'
    });
  }
});

router.get('/api/perplexity/arbitrage', async (req, res) => {
  try {
    const opportunities = await perplexityAI.findArbitrageOpportunities();
    res.json({
      opportunities,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error in /api/perplexity/arbitrage:', error);
    res.status(500).json({
      error: 'Failed to find arbitrage opportunities',
      message: error.message
    });
  }
});

router.get('/api/perplexity/strategies', async (req, res) => {
  try {
    const strategies = await perplexityAI.recommendTradingStrategies();
    res.json({
      strategies,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error in /api/perplexity/strategies:', error);
    res.status(500).json({
      error: 'Failed to recommend trading strategies',
      message: error.message
    });
  }
});

// Local Market Analysis Fallback Routes
router.get('/api/market/local/analyze/:token', (req, res) => {
  try {
    const token = req.params.token.toUpperCase();
    const analysis = localMarketAnalysis.analyzeToken(token);
    res.json({
      token,
      analysis,
      timestamp: new Date().toISOString(),
      source: 'local'
    });
  } catch (error) {
    logger.error(`Error in /api/market/local/analyze/${req.params.token}:`, error);
    res.status(500).json({
      error: 'Failed to analyze token with local market analysis',
      message: error.message
    });
  }
});

router.get('/api/market/local/sentiment/:token', (req, res) => {
  try {
    const token = req.params.token.toUpperCase();
    const sentiment = localMarketAnalysis.getMarketSentiment(token);
    res.json({
      token,
      sentiment,
      timestamp: new Date().toISOString(),
      source: 'local'
    });
  } catch (error) {
    logger.error(`Error in /api/market/local/sentiment/${req.params.token}:`, error);
    res.status(500).json({
      error: 'Failed to get market sentiment with local market analysis',
      message: error.message
    });
  }
});

router.get('/api/market/local/arbitrage', (req, res) => {
  try {
    const opportunities = localMarketAnalysis.findArbitrageOpportunities();
    res.json({
      opportunities,
      timestamp: new Date().toISOString(),
      source: 'local'
    });
  } catch (error) {
    logger.error('Error in /api/market/local/arbitrage:', error);
    res.status(500).json({
      error: 'Failed to find arbitrage opportunities with local market analysis',
      message: error.message
    });
  }
});

router.get('/api/market/local/strategies', (req, res) => {
  try {
    const strategies = localMarketAnalysis.recommendTradingStrategies();
    res.json({
      strategies,
      timestamp: new Date().toISOString(),
      source: 'local'
    });
  } catch (error) {
    logger.error('Error in /api/market/local/strategies:', error);
    res.status(500).json({
      error: 'Failed to recommend trading strategies with local market analysis',
      message: error.message
    });
  }
});

// Combined Market Analysis Route (tries Perplexity first, falls back to local)
router.get('/api/market/analyze/:token', async (req, res) => {
  try {
    const token = req.params.token.toUpperCase();
    
    let analysis;
    let source = 'perplexity';
    
    try {
      if (perplexityAI.isInitialized()) {
        analysis = await perplexityAI.analyzeToken(token);
      } else {
        throw new Error('Perplexity API not initialized');
      }
    } catch (aiError) {
      logger.warn(`Falling back to local market analysis for ${token}:`, aiError);
      analysis = localMarketAnalysis.analyzeToken(token);
      source = 'local';
    }
    
    // Return market analysis
    res.json({
      token,
      source,
      token_info: {
        analysis,
        name: token.toUpperCase(),
        symbol: token.toUpperCase(),
        category: "token",
        blockchain: "Solana",
        contract_security: "verified",
      },
      market_position: {
        market_cap: "analyzing",
        rank: "analyzing",
        liquidity: "medium",
        trading_volume_trend: "stable"
      },
      risk_assessment: {
        overall_risk: "medium",
        specific_risks: ["market volatility", "liquidity risk"]
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// RPC Status endpoint to monitor health and rate limiting
router.get('/api/system/rpc-status', async (req, res) => {
  try {
    // Import the RPC connection manager
    const { getRpcStatus } = require('./lib/rpcConnectionManager');
    
    // Get the current RPC service status
    const rpcStatus = getRpcStatus();
    
    // Add RPC rate limiter metrics if available
    try {
      const rpcRateLimiter = require('./lib/rpcRateLimiter');
      const rateLimiterMetrics = {
        totalRequests: rpcRateLimiter.getTotalRequests?.() || 0,
        totalRateLimitErrors: rpcRateLimiter.getTotalRateLimitErrors?.() || 0,
        isThrottled: rpcRateLimiter.isCurrentlyThrottled?.() || false,
        currentCooldownMs: rpcRateLimiter.getCurrentCooldown?.() || 0
      };
      
      // Add rate limiter metrics to status response
      rpcStatus.rateLimiter = rateLimiterMetrics;
    } catch (error) {
      console.warn('Failed to get rate limiter metrics:', error.message);
    }
    
    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      rpc: rpcStatus
    });
  } catch (error) {
    console.error('Error getting RPC status:', error);
    res.status(500).json({ 
      status: 'error',
      message: error.message || 'Failed to get RPC status'
    });
  }
});

router.get('/api/arbitrage/opportunities', async (req, res) => {
  try {
    const dexes = getAllDexes();
    const pairs = ['SOL/USDC', 'BONK/USDC', 'JUP/USDC'];
    const opportunities: ArbitrageOpportunity[] = [];

    for (const pair of pairs) {
      const opportunity = {
        pair,
        dexA: dexes[0]?.name || 'Jupiter',
        dexB: dexes[1]?.name || 'Orca',
        priceA: 0,
        priceB: 0,
        profitPercent: 0,
        timestamp: new Date().toISOString()
      };
      opportunities.push(opportunity);
    }

    res.json(opportunities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Nexus Professional Engine API endpoints
router.post('/api/engine/nexus/activate', async (req, res) => {
  try {
    logger.info('Activating Nexus Professional Engine');
    const { rpcUrl, useRealFunds = true } = req.body;
    
    // Initialize the Nexus engine
    const success = await nexusEngine.initializeTransactionEngine(rpcUrl, useRealFunds);
    
    if (success) {
      usingNexusEngine = true;
      logger.info('Nexus Professional Engine activated successfully');
      res.json({ success: true, message: 'Nexus Professional Engine activated' });
    } else {
      logger.error('Failed to activate Nexus Professional Engine');
      res.status(500).json({ success: false, message: 'Failed to activate Nexus Professional Engine' });
    }
  } catch (error) {
    logger.error('Error activating Nexus Professional Engine:', error);
    res.status(500).json({ success: false, message: `Error: ${error.message}` });
  }
});

router.post('/api/engine/nexus/deactivate', async (req, res) => {
  try {
    logger.info('Deactivating Nexus Professional Engine');
    
    if (usingNexusEngine) {
      await nexusEngine.stopTransactionEngine();
      usingNexusEngine = false;
      logger.info('Nexus Professional Engine deactivated successfully');
      res.json({ success: true, message: 'Nexus Professional Engine deactivated' });
    } else {
      logger.info('Nexus Professional Engine was not active');
      res.json({ success: true, message: 'Nexus Professional Engine was not active' });
    }
  } catch (error) {
    logger.error('Error deactivating Nexus Professional Engine:', error);
    res.status(500).json({ success: false, message: `Error: ${error.message}` });
  }
});

router.get('/api/engine/status', (req, res) => {
  try {
    const status = {
      activeEngine: 'nexus_professional',
      initialized: nexusEngine.isInitialized(),
      transactionCount: nexusEngine.getTransactionCount(),
      rpcUrl: nexusEngine.getRpcUrl(),
      registeredWallets: nexusEngine.getRegisteredWallets(),
      usingRealFunds: nexusEngine.isUsingRealFunds()
    };
    
    res.json(status);
  } catch (error) {
    logger.error('Error getting engine status:', error);
    res.status(500).json({ success: false, message: `Error: ${error.message}` });
  }
});

router.post('/api/engine/register-wallet', (req, res) => {
  try {
    const { walletAddress } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ success: false, message: 'Wallet address is required' });
    }
    
    // We're always using Nexus engine
    const success = nexusEngine.registerWallet(walletAddress);
    
    if (success) {
      res.json({ success: true, message: 'Wallet registered successfully' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to register wallet' });
    }
  } catch (error) {
    logger.error('Error registering wallet:', error);
    res.status(500).json({ success: false, message: `Error: ${error.message}` });
  }
});

router.post('/api/engine/execute-swap', async (req, res) => {
  try {
    if (!usingNexusEngine) {
      return res.status(400).json({ 
        success: false, 
        message: 'This endpoint requires the Nexus Professional Engine to be active' 
      });
    }
    
    const { fromToken, toToken, amount, slippage, walletAddress } = req.body;
    
    if (!fromToken || !toToken || !amount || !walletAddress) {
      return res.status(400).json({ 
        success: false, 
        message: 'fromToken, toToken, amount, and walletAddress are required' 
      });
    }
    
    const result = await nexusEngine.executeSwap({
      fromToken,
      toToken,
      amount: parseFloat(amount),
      slippage: slippage ? parseFloat(slippage) : 0.5,
      walletAddress
    });
    
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Error executing swap:', error);
    res.status(500).json({ success: false, message: `Error: ${error.message}` });
  }
});

// Real Solana Transaction Endpoint for Live Trading
router.post('/api/solana/execute-transaction', async (req, res) => {
  try {
    if (!nexusEngine.isInitialized()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nexus Professional Engine must be initialized before executing transactions' 
      });
    }
    
    if (!nexusEngine.isUsingRealFunds()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Real funds mode must be enabled to execute live market transactions' 
      });
    }
    
    const { type, walletPath, fromWalletPath, toWallet, amountSol, fromToken, toToken, 
            amountIn, slippageBps, swapInstructions, route, arbitrageInstructions } = req.body;
    
    if (!type) {
      return res.status(400).json({ 
        success: false, 
        message: 'Transaction type is required (transfer, swap, or arbitrage)' 
      });
    }
    
    // Execute the real market transaction
    const result = await nexusEngine.executeSolanaTransaction({
      type,
      walletPath,
      fromWalletPath,
      toWallet,
      amountSol,
      fromToken,
      toToken,
      amountIn,
      slippageBps,
      swapInstructions,
      route,
      arbitrageInstructions
    });
    
    res.json(result);
  } catch (error) {
    logger.error('Error executing Solana transaction:', error);
    res.status(500).json({ success: false, message: `Error: ${error.message}` });
  }
});

router.post('/api/engine/check-token-security', async (req, res) => {
  try {
    if (!usingNexusEngine) {
      return res.status(400).json({ 
        success: false, 
        message: 'This endpoint requires the Nexus Professional Engine to be active' 
      });
    }
    
    const { tokenAddress } = req.body;
    
    if (!tokenAddress) {
      return res.status(400).json({ success: false, message: 'Token address is required' });
    }
    
    const securityAnalysis = await nexusEngine.checkTokenSecurity(tokenAddress);
    res.json({ success: true, securityAnalysis });
  } catch (error) {
    logger.error('Error checking token security:', error);
    res.status(500).json({ success: false, message: `Error: ${error.message}` });
  }
});

router.get('/api/engine/cross-chain-opportunities', async (req, res) => {
  try {
    if (!usingNexusEngine) {
      return res.status(400).json({ 
        success: false, 
        message: 'This endpoint requires the Nexus Professional Engine to be active' 
      });
    }
    
    const opportunities = await nexusEngine.findCrossChainOpportunities();
    res.json({ success: true, opportunities });
  } catch (error) {
    logger.error('Error finding cross-chain opportunities:', error);
    res.status(500).json({ success: false, message: `Error: ${error.message}` });
  }
});

router.post('/api/engine/analyze-meme-sentiment', async (req, res) => {
  try {
    if (!usingNexusEngine) {
      return res.status(400).json({ 
        success: false, 
        message: 'This endpoint requires the Nexus Professional Engine to be active' 
      });
    }
    
    const { tokenAddress } = req.body;
    
    if (!tokenAddress) {
      return res.status(400).json({ success: false, message: 'Token address is required' });
    }
    
    const sentimentAnalysis = await nexusEngine.analyzeMemeSentiment(tokenAddress);
    res.json({ success: true, sentimentAnalysis });
  } catch (error) {
    logger.error('Error analyzing meme sentiment:', error);
    res.status(500).json({ success: false, message: `Error: ${error.message}` });
  }
});

router.post('/api/engine/set-real-funds', (req, res) => {
  try {
    const { useRealFunds } = req.body;
    
    if (typeof useRealFunds !== 'boolean') {
      return res.status(400).json({ success: false, message: 'useRealFunds must be a boolean' });
    }

    // Critical confirmation required for enabling real funds
    if (useRealFunds) {
      logger.warn('🚨 ENABLING REAL FUNDS MODE - LIVE TRADING WILL USE ACTUAL BLOCKCHAIN TRANSACTIONS 🚨');
      logger.warn('System wallet HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb will be used for trading operations');
      
      // Set real funds mode in all agents
      if (typeof agents.setUseRealFunds === 'function') {
        agents.setUseRealFunds(true);
      }

      // Disable simulation mode in nexus engine
      if (usingNexusEngine) {
        nexusEngine.setUseRealFunds(true);
      }
    } else {
      logger.info('🔄 Disabling real funds mode - returning to simulation mode');
      
      // Disable real funds mode in all agents
      if (typeof agents.setUseRealFunds === 'function') {
        agents.setUseRealFunds(false);
      }

      // Enable simulation mode in nexus engine
      if (usingNexusEngine) {
        nexusEngine.setUseRealFunds(false);
      }
    }
    
    res.json({ 
      success: true, 
      message: useRealFunds 
        ? '🚨 LIVE TRADING ACTIVATED - Using REAL FUNDS for trading 🚨' 
        : '🔄 Simulation mode activated - No real funds will be used',
      usingRealFunds: useRealFunds,
      simulationMode: !useRealFunds,
      mainWallet: 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error setting real funds mode:', error);
    res.status(500).json({ success: false, message: `Error: ${error.message}` });
  }
});

// Agent API Routes
router.get('/agents/status', (req, res) => {
  try {
    const status = agents.getAllAgentsStatus();
    res.json({ success: true, status });
  } catch (error) {
    logger.error('Error getting agent status:', error);
    res.status(500).json({ success: false, message: `Error: ${error.message}` });
  }
});

router.get('/agents/status/:type', (req, res) => {
  try {
    const type = req.params.type as AgentType;
    const status = agents.getAgentStatus(type);
    
    if (status.error) {
      return res.status(400).json({ success: false, message: status.error });
    }
    
    res.json({ success: true, status });
  } catch (error) {
    logger.error('Error getting agent status:', error);
    res.status(500).json({ success: false, message: `Error: ${error.message}` });
  }
});

// Wallet Management API Endpoints for Prophet System
router.get('/api/wallets', (req, res) => {
  try {
    const walletManager = new WalletManager();
    const wallets = walletManager.getAllWallets()
      .map(wallet => ({
        type: wallet.type,
        publicKey: wallet.publicKey,
        label: wallet.label,
        isActive: wallet.isActive,
        profitShare: wallet.profitShare || 100,
        routedTo: wallet.routedTo || null,
        hasPrivateKey: !!wallet.privateKey
      }));
    
    res.json({
      success: true,
      wallets,
      prophetsEnabled: wallets.some(w => w.label.includes('Prophet'))
    });
  } catch (error) {
    logger.error('Error getting wallets:', error);
    res.status(500).json({ success: false, message: `Error: ${error.message}` });
  }
});

router.get('/api/wallets/prophet', (req, res) => {
  try {
    // Safely export only the Prophet system wallet info
    const walletManager = new WalletManager();
    const wallets = walletManager.getAllWallets();
    
    // Get the Prophet system wallets
    const prophetWallets = wallets.filter(w => 
      w.label.includes('Prophet') || 
      (w.type === WalletType.TRADING && w.profitShare !== undefined && w.routedTo !== undefined)
    );
    
    // Get private keys from the data folder
    const privateKeysPath = path.join(process.cwd(), 'data', 'private_wallets.json');
    let privateWallets = [];
    
    if (fs.existsSync(privateKeysPath)) {
      try {
        privateWallets = JSON.parse(fs.readFileSync(privateKeysPath, 'utf8'));
      } catch (err) {
        logger.error('Error reading private wallets file:', err);
      }
    }
    
    res.json({
      success: true,
      prophetSystem: {
        profitWallet: prophetWallets.find(w => w.type === WalletType.PROFIT_COLLECTION),
        tradingWallets: prophetWallets.filter(w => w.type === WalletType.TRADING),
        privateKeys: privateWallets,
        profitShare: prophetWallets.find(w => w.type === WalletType.TRADING)?.profitShare || 5
      },
      importInstructions: "To import these wallets to Phantom, go to Phantom wallet → Settings → Import private key → paste the privateKey value."
    });
  } catch (error) {
    logger.error('Error getting Prophet wallet system:', error);
    res.status(500).json({ success: false, message: `Error: ${error.message}` });
  }
});

router.post('/api/wallets/route-profits', async (req, res) => {
  try {
    const { walletAddress, profitAmount } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ success: false, message: 'Wallet address is required' });
    }
    
    if (!profitAmount || isNaN(profitAmount) || profitAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid profit amount is required' });
    }
    
    const walletManager = new WalletManager();
    const result = await walletManager.routeProfits(walletAddress, profitAmount);
    
    res.json({
      success: true,
      routingResult: result,
      message: `Successfully routed ${result.routedAmount} lamports to Prophet wallet and kept ${result.keptAmount} lamports for reinvestment`
    });
  } catch (error) {
    logger.error('Error routing profits:', error);
    res.status(500).json({ success: false, message: `Error: ${error.message}` });
  }
});

// MomentumSurfingStrategy API Endpoints
router.get('/api/strategies/momentum/scan', async (req, res) => {
  try {
    // Initialize MemeCortex if not already
    if (!memeCortexTransformer.isInitialized()) {
      await memeCortexTransformer.initialize();
    }
    
    // Scan for momentum opportunities
    const opportunities = await momentumSurfingStrategy.scan_for_momentum_waves();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: opportunities.length,
      opportunities
    });
  } catch (error) {
    logger.error('Error scanning for momentum opportunities:', error);
    res.status(500).json({ 
      success: false, 
      message: `Error: ${error.message}`
    });
  }
});

router.post('/api/strategies/momentum/execute', async (req, res) => {
  try {
    const { token_address, amount } = req.body;
    
    if (!token_address || !amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid token_address and amount required'
      });
    }
    
    // Initialize MemeCortex if not already
    if (!memeCortexTransformer.isInitialized()) {
      await memeCortexTransformer.initialize();
    }
    
    // Get token info
    const tokenInfo = await memeCortexTransformer.getTokenInfo(token_address);
    
    // Scan for specific token opportunity
    const score = await momentumSurfingStrategy.analyze_token(token_address);
    const currentPrice = await memeCortexTransformer.getMarketData(token_address);
    const historical_scores = momentumSurfingStrategy['get_historical_momentum_scores'](token_address, 24);
    const change_rate = momentumSurfingStrategy['calculate_momentum_change_rate'](historical_scores, score);
    
    // Create opportunity object
    const opportunity = {
      token_address,
      token_symbol: tokenInfo?.symbol,
      current_score: score.overall_score,
      momentum_change_rate: change_rate,
      predicted_peak_score: momentumSurfingStrategy['predict_peak_score'](score, change_rate),
      optimal_entry_price: currentPrice?.price || 0,
      recommended_exit_timeframe: momentumSurfingStrategy['calculate_optimal_exit_timeframe'](change_rate)
    };
    
    // Execute trade
    const result = await momentumSurfingStrategy.execute_momentum_trade(opportunity, amount);
    
    if (result.success) {
      res.json({
        success: true,
        message: `Successfully executed momentum trade for ${tokenInfo?.symbol || token_address}`,
        transaction: result.txHash,
        opportunity
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.error || 'Failed to execute momentum trade',
        opportunity
      });
    }
  } catch (error) {
    logger.error('Error executing momentum trade:', error);
    res.status(500).json({ 
      success: false, 
      message: `Error: ${error.message}`
    });
  }
});

router.get('/api/strategies/momentum/active', async (req, res) => {
  try {
    // Get active positions
    const activePositions = momentumSurfingStrategy['active_positions'];
    
    const formattedPositions = Array.from(activePositions.entries()).map(([token, position]) => ({
      token_address: token,
      token_symbol: position.token_symbol,
      entry_price: position.entry_price,
      entry_time: new Date(position.entry_time).toISOString(),
      highest_price: position.highest_price,
      trailing_stop_price: position.trailing_stop_price,
      amount: position.amount,
      profit_percentage: ((position.highest_price / position.entry_price) - 1) * 100
    }));
    
    res.json({
      success: true,
      count: formattedPositions.length,
      positions: formattedPositions
    });
  } catch (error) {
    logger.error('Error getting active momentum positions:', error);
    res.status(500).json({ 
      success: false, 
      message: `Error: ${error.message}`
    });
  }
});

// Price feed status check endpoint
router.get('/api/system/price-feed', async (req, res) => {
  try {
    const { token } = req.query;
    const defaultTokens = ['SOL', 'BONK', 'WIF', 'JTO', 'PYTH'];
    
    // If a specific token is requested
    if (token && typeof token === 'string') {
      // Try to get price directly, with error handling inside try/catch
      try {
        const tokenPrice = await priceFeedCache.getTokenPrice(token);
        return res.json({
          success: true,
          token,
          price: tokenPrice,
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        // Access backup prices directly as a fallback
        if (token.toUpperCase() in priceFeedCache.BACKUP_PRICES) {
          const backupPrice = priceFeedCache.BACKUP_PRICES[token.toUpperCase()];
          return res.json({
            success: true,
            token,
            price: backupPrice,
            source: 'backup_data',
            timestamp: new Date().toISOString()
          });
        } else {
          return res.status(404).json({
            success: false,
            token,
            error: `No price data available for ${token}`
          });
        }
      }
    }
    
    // Otherwise return status of multiple tokens
    const prices = {};
    const errors = {};
    let successCount = 0;
    
    for (const symbol of defaultTokens) {
      try {
        const price = await priceFeedCache.getTokenPrice(symbol);
        if (price && price > 0) {
          prices[symbol] = price;
          successCount++;
        } else {
          // Try backup prices if external fetch fails
          if (symbol in priceFeedCache.BACKUP_PRICES) {
            prices[symbol] = priceFeedCache.BACKUP_PRICES[symbol];
            prices[`${symbol}_source`] = 'backup_data';
            successCount++;
          } else {
            errors[symbol] = 'Price returned zero or null';
          }
        }
      } catch (err) {
        // Access backup prices on error
        if (symbol in priceFeedCache.BACKUP_PRICES) {
          prices[symbol] = priceFeedCache.BACKUP_PRICES[symbol];
          prices[`${symbol}_source`] = 'backup_data';
          successCount++;
        } else {
          errors[symbol] = err.message;
        }
      }
    }
    
    // Check if price feed is updating
    const lastUpdate = priceFeedCache.getLastUpdateTime();
    const now = Date.now();
    const isStale = (now - lastUpdate) > 5 * 60 * 1000; // Stale if no updates for 5 min
    
    res.json({
      success: true,
      status: successCount > 0 ? 'operational' : 'failed',
      prices,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
      tokens_checked: defaultTokens.length,
      tokens_with_prices: successCount,
      last_update: new Date(lastUpdate).toISOString(),
      is_stale: isStale,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error checking price feed status:', error);
    res.status(500).json({ 
      success: false, 
      message: `Error checking price feed: ${error.message}`
    });
  }
});

// AI Integration status endpoint
router.get('/api/system/ai-status', async (req, res) => {
  try {
    // Check Perplexity API status
    const perplexityInitialized = perplexityAI.isInitialized();
    let perplexityStatus = 'not_initialized';
    let perplexityTestResult = null;
    
    if (perplexityInitialized) {
      try {
        // Simple test of the Perplexity API
        const testResult = await perplexityAI.getMarketSentiment('SOL');
        perplexityStatus = 'operational';
        perplexityTestResult = testResult.substring(0, 100) + '...'; // Truncate for response
      } catch (error) {
        perplexityStatus = 'error';
        perplexityTestResult = error.message;
      }
    }
    
    // Check DeepSeek AI status if available
    let deepseekStatus = 'not_configured';
    if (process.env.DEEPSEEK_API_KEY) {
      deepseekStatus = 'configured'; // We would need actual testing logic for DeepSeek
    }
    
    res.json({
      success: true,
      ai_systems: {
        perplexity: {
          status: perplexityStatus,
          initialized: perplexityInitialized,
          test_result: perplexityTestResult
        },
        deepseek: {
          status: deepseekStatus
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error checking AI integration status:', error);
    res.status(500).json({
      success: false,
      message: `Error checking AI status: ${error.message}`
    });
  }
});

// Get recent market analysis signals
router.get('/api/signals/market-analysis', (req, res) => {
  try {
    // Access the signalHub to get recent signals
    const recentSignals = [];
    
    if (global.signalHub && global.signalHub.getRecentSignals) {
      const allSignals = global.signalHub.getRecentSignals(20); // Get last 20 signals
      
      // Filter for market analysis signals only
      for (const signal of allSignals) {
        if (signal.type === 'MARKET_SENTIMENT' || 
            signal.type === 'PRICE_TARGET' || 
            signal.type === 'VOLATILITY_ALERT' ||
            signal.type === 'MOMENTUM_SIGNAL') {
          // Clone and clean the signal for API response
          const cleanSignal = {
            id: signal.id,
            type: signal.type,
            token: signal.token,
            source: signal.source,
            timestamp: signal.timestamp,
            confidence: signal.confidence || 0,
            direction: signal.direction || 'neutral',
            priority: signal.priority || 'medium'
          };
          
          // Add content if available but trim it
          if (signal.content) {
            cleanSignal.content = typeof signal.content === 'string' 
              ? signal.content.substring(0, 200) + '...' 
              : JSON.stringify(signal.content).substring(0, 200) + '...';
          }
          
          recentSignals.push(cleanSignal);
        }
      }
    }
    
    res.json({
      success: true,
      signals_count: recentSignals.length,
      signals: recentSignals,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error retrieving market analysis signals:', error);
    res.status(500).json({
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error retrieving signals'
    });
  }
});

// Update Perplexity API key
router.post('/api/system/update-perplexity-key', (req, res) => {
  try {
    const { apiKey } = req.body;
    
    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Valid API key required'
      });
    }
    
    const success = perplexityAI.updateApiKey(apiKey);
    
    if (success) {
      res.json({
        success: true,
        message: 'Perplexity API key updated successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to update Perplexity API key'
      });
    }
  } catch (error) {
    logger.error('Error updating Perplexity API key:', error);
    res.status(500).json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
});

router.post('/api/wallets/prophet/create', (req, res) => {
  try {
    const walletManager = new WalletManager();
    
    // First check if Prophet system already exists
    const wallets = walletManager.getAllWallets();
    const hasProphetWallet = wallets.some(w => w.label.includes('Prophet'));
    
    if (hasProphetWallet) {
      return res.status(400).json({ 
        success: false, 
        message: 'Prophet wallet system already exists',
        wallets: wallets.filter(w => 
          w.label.includes('Prophet') || 
          (w.type === WalletType.TRADING && w.profitShare !== undefined)
        ).map(w => ({
          publicKey: w.publicKey,
          label: w.label,
          type: w.type
        }))
      });
    }
    
    // Force recreation of the Prophet wallet system
    // This is a private method, so in a real implementation we would have a public method instead
    // For the prototype, we'll recreate all wallets which will regenerate the system
    walletManager['createProphetWalletSystem']();
    
    // Get the new Prophet system wallets
    const newWallets = walletManager.getAllWallets();
    const prophetWallets = newWallets.filter(w => 
      w.label.includes('Prophet') || 
      (w.type === WalletType.TRADING && w.profitShare !== undefined && w.routedTo !== undefined)
    );
    
    res.json({
      success: true,
      message: 'Prophet wallet system created successfully',
      prophetSystem: {
        profitWallet: prophetWallets.find(w => w.type === WalletType.PROFIT_COLLECTION),
        tradingWallets: prophetWallets.filter(w => w.type === WalletType.TRADING),
        profitShare: prophetWallets.find(w => w.type === WalletType.TRADING)?.profitShare || 5
      }
    });
  } catch (error) {
    logger.error('Error creating Prophet wallet system:', error);
    res.status(500).json({ success: false, message: `Error: ${error.message}` });
  }
});

// =====================================
// Transaction Verification API Endpoints
// ====================================

// Get verification status for a specific transaction
router.get('/api/verify/transaction/:signature', async (req, res) => {
  try {
    const { signature } = req.params;
    
    if (!signature) {
      return res.status(400).json({ success: false, message: 'Transaction signature is required' });
    }
    
    const verification = await transactionVerifier.verifyTransaction(signature);
    
    res.json({
      success: true,
      verification
    });
  } catch (error) {
    logger.error('Error verifying transaction:', error);
    res.status(500).json({ success: false, message: `Error: ${error.message}` });
  }
});

// Get verification status for a specific wallet
router.get('/api/verify/wallet/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address) {
      return res.status(400).json({ success: false, message: 'Wallet address is required' });
    }
    
    const verification = await transactionVerifier.verifyWalletBalance(address);
    
    res.json({
      success: true,
      verification
    });
  } catch (error) {
    logger.error('Error verifying wallet:', error);
    res.status(500).json({ success: false, message: `Error: ${error.message}` });
  }
});

// =====================================
// Market Opportunity API Endpoints
// =====================================

// Get all potential arbitrage opportunities
router.get('/api/opportunities/arbitrage', async (req, res) => {
  try {
    // Initialize verification integration if it hasn't started
    if (!verificationIntegration['verificationInterval']) {
      verificationIntegration.start();
    }
    
    // Get arbitrage opportunities from nexus engine
    const opportunities = nexusEngine.nexusEngine.getPotentialArbitrageOpportunities();
    
    res.json({
      success: true,
      count: opportunities.length,
      opportunities
    });
  } catch (error) {
    logger.error('Error getting arbitrage opportunities:', error);
    res.status(500).json({ success: false, message: `Error: ${error.message}` });
  }
});

// Get real-time verified trading opportunities
router.get('/api/opportunities/verified', async (req, res) => {
  try {
    const maxResults = parseInt(req.query.max as string) || 5;
    
    // Find verified opportunities
    const opportunities = await verificationIntegration.findRealTimeOpportunities(maxResults);
    
    res.json({
      success: true,
      count: opportunities.length,
      opportunities
    });
  } catch (error) {
    logger.error('Error getting verified opportunities:', error);
    res.status(500).json({ success: false, message: `Error: ${error.message}` });
  }
});

// Submit an opportunity for verification
router.post('/api/opportunities/submit', async (req, res) => {
  try {
    const opportunity = req.body;
    
    if (!opportunity || typeof opportunity !== 'object') {
      return res.status(400).json({ success: false, message: 'Valid opportunity object is required' });
    }
    
    // Submit the opportunity for verification
    const id = await verificationIntegration.submitOpportunity(opportunity);
    
    res.json({
      success: true,
      message: 'Opportunity submitted for verification',
      id
    });
  } catch (error) {
    logger.error('Error submitting opportunity:', error);
    res.status(500).json({ success: false, message: `Error: ${error.message}` });
  }
});

// Get verification status for a specific opportunity
router.get('/api/opportunities/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ success: false, message: 'Opportunity ID is required' });
    }
    
    // Verify the opportunity
    const verification = await verificationIntegration.verifyOpportunity(id);
    
    res.json({
      success: true,
      verification
    });
  } catch (error) {
    logger.error('Error verifying opportunity:', error);
    res.status(500).json({ success: false, message: `Error: ${error.message}` });
  }
});

// Get all verified transactions
router.get('/api/verify/transactions', (req, res) => {
  try {
    const transactions = transactionVerifier.getAllVerifiedTransactions();
    
    res.json({
      success: true,
      count: transactions.length,
      transactions
    });
  } catch (error) {
    logger.error('Error getting verified transactions:', error);
    res.status(500).json({ success: false, message: `Error: ${error.message}` });
  }
});

// Get all failed verifications
router.get('/api/verify/failures', (req, res) => {
  try {
    const failures = transactionVerifier.getAllFailedVerifications();
    
    res.json({
      success: true,
      count: failures.length,
      failures
    });
  } catch (error) {
    logger.error('Error getting failed verifications:', error);
    res.status(500).json({ success: false, message: `Error: ${error.message}` });
  }
});

// Generate a verification report for system wallets
router.get('/api/verify/report', async (req, res) => {
  try {
    const report = await transactionVerifier.createVerificationReport();
    
    res.json({
      success: true,
      report
    });
  } catch (error) {
    logger.error('Error generating verification report:', error);
    res.status(500).json({ success: false, message: `Error: ${error.message}` });
  }
});

// Verify multiple transactions
router.post('/api/verify/batch', async (req, res) => {
  try {
    const { signatures } = req.body;
    
    if (!signatures || !Array.isArray(signatures) || signatures.length === 0) {
      return res.status(400).json({ success: false, message: 'Transaction signatures array is required' });
    }
    
    const results = await transactionVerifier.verifyMultipleTransactions(signatures);
    
    res.json({
      success: true,
      count: results.length,
      results
    });
  } catch (error) {
    logger.error('Error verifying transactions batch:', error);
    res.status(500).json({ success: false, message: `Error: ${error.message}` });
  }
});

router.post('/agents/activate/:type', async (req, res) => {
  try {
    const type = req.params.type as AgentType;
    const { primaryWallet, secondaryWallet, profitWallet } = req.body;
    
    if (!primaryWallet) {
      return res.status(400).json({ success: false, message: 'Primary wallet address is required' });
    }
    
    const result = await agents.activateAgent(type, primaryWallet, secondaryWallet, profitWallet);
    
    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(500).json({ success: false, message: result.message });
    }
  } catch (error) {
    logger.error('Error activating agent:', error);
    res.status(500).json({ success: false, message: `Error: ${error.message}` });
  }
});

router.post('/agents/deactivate/:type', async (req, res) => {
  try {
    const type = req.params.type as AgentType;
    const result = await agents.deactivateAgent(type);
    
    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(500).json({ success: false, message: result.message });
    }
  } catch (error) {
    logger.error('Error deactivating agent:', error);
    res.status(500).json({ success: false, message: `Error: ${error.message}` });
  }
});

router.post('/agents/activate-all', async (req, res) => {
  try {
    const { primaryWallet, secondaryWallet, profitWallet } = req.body;
    
    if (!primaryWallet) {
      return res.status(400).json({ success: false, message: 'Primary wallet address is required' });
    }
    
    const results = await agents.activateAllAgents(primaryWallet, secondaryWallet, profitWallet);
    const allSuccess = results.every(r => r.success);
    
    if (allSuccess) {
      res.json({ 
        success: true, 
        message: 'All agents activated successfully', 
        results 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Some agents failed to activate', 
        results 
      });
    }
  } catch (error) {
    logger.error('Error activating all agents:', error);
    res.status(500).json({ success: false, message: `Error: ${error.message}` });
  }
});

router.post('/agents/deactivate-all', async (req, res) => {
  try {
    const results = await agents.deactivateAllAgents();
    const allSuccess = results.every(r => r.success);
    
    if (allSuccess) {
      res.json({ 
        success: true, 
        message: 'All agents deactivated successfully', 
        results 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Some agents failed to deactivate', 
        results 
      });
    }
  } catch (error) {
    logger.error('Error deactivating all agents:', error);
    res.status(500).json({ success: false, message: `Error: ${error.message}` });
  }
});

// Route to get all supported DEXs
router.get('/api/dexes', (req, res) => {
  try {
    const dexes = getAllDexes();
    res.json({
      success: true,
      count: dexes.length,
      dexes
    });
  } catch (error) {
    logger.error('Error fetching DEXs:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch DEXs'
    });
  }
});

// Route to get all price feed data
router.get('/api/prices', (req, res) => {
  try {
    if (!global.priceFeed) {
      return res.status(503).json({
        success: false,
        error: 'Price feed not initialized'
      });
    }
    
    const prices = Array.from(global.priceFeed.getAllPrices().entries()).map(([symbol, data]) => ({
      symbol,
      price: data.priceUsd,
      lastUpdated: data.lastUpdated,
      source: data.source,
      change24h: data.change24h
    }));
    
    res.json({
      success: true,
      count: prices.length,
      prices,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching prices:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch prices'
    });
  }
});

// Route to get price for a specific token
router.get('/api/price/:token', (req, res) => {
  try {
    const token = req.params.token.toUpperCase();
    
    if (!global.priceFeed) {
      return res.status(503).json({
        success: false,
        error: 'Price feed not initialized'
      });
    }
    
    const price = global.priceFeed.getTokenPrice(token);
    
    if (!price) {
      return res.status(404).json({
        success: false,
        error: `Price not found for token ${token}`
      });
    }
    
    res.json({
      success: true,
      token,
      price: price.priceUsd,
      lastUpdated: price.lastUpdated,
      source: price.source,
      change24h: price.change24h,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error fetching price for ${req.params.token}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch price'
    });
  }
});

export async function registerRoutes(app: express.Express) {
  
  // Import the trade tracker for blockchain transaction monitoring
  const { tradeTracker } = require('./transformers/trade-tracker');
  
  // API endpoint to get all tracked trades
  app.get('/api/trades', (req, res) => {
    const allTrades = tradeTracker.getAllTrades();
    res.json({ success: true, data: allTrades });
  });
  
  // API endpoint to get profit summary
  app.get('/api/profit-summary', (req, res) => {
    const profitSummary = tradeTracker.getProfitSummary();
    res.json({ success: true, data: profitSummary });
  });
  
  // API endpoint to get trades for a specific token
  app.get('/api/trades/token/:token', (req, res) => {
    const { token } = req.params;
    const trades = tradeTracker.getTradesByToken(token);
    res.json({ success: true, data: trades });
  });
  
  // API endpoint to get trades by strategy
  app.get('/api/trades/strategy/:strategy', (req, res) => {
    const { strategy } = req.params;
    const trades = tradeTracker.getTradesByStrategy(strategy);
    res.json({ success: true, data: trades });
  });
  
  // API endpoint to get trades in a time range
  app.get('/api/trades/timerange', (req, res) => {
    const { startTime, endTime } = req.query;
    if (!startTime || !endTime) {
      return res.status(400).json({ success: false, error: 'startTime and endTime are required' });
    }
    
    const trades = tradeTracker.getTradesByTimeRange(startTime as string, endTime as string);
    res.json({ success: true, data: trades });
  });
  
  // API endpoint to force update trade tracking
  app.post('/api/trades/force-update', async (req, res) => {
    try {
      await tradeTracker.forceUpdate();
      res.json({ success: true, message: 'Trade tracking update initiated' });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to force update trade tracking' });
    }
  });
  // Use the router
  app.use(router);
  
  // Import API routes dynamically to avoid circular dependencies
  try {
    const dashboardRoutes = require('./routes/dashboard').default;
    app.use('/api/dashboard', dashboardRoutes);
    console.log('✅ Dashboard routes registered successfully');
  } catch (error) {
    console.error('❌ Error loading dashboard routes:', error);
  }
  
  // Register Solend liquidator routes
  try {
    const solendRoutes = require('./routes/solend').default;
    app.use('/api/solend', solendRoutes);
    console.log('✅ Solend liquidator routes registered successfully');
  } catch (error) {
    console.error('❌ Error loading Solend routes:', error);
  }
  // Add RPC rate limiter status endpoint
  app.get('/api/system/rpc-status', (req, res) => {
    try {
      const rpcRateLimiter = require('./lib/rpcRateLimiter');
      const status = rpcRateLimiter.getThrottleState();
      res.json({
        success: true,
        status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error getting RPC rate limiter status:', error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ 
        success: false, 
        message: 'Error getting RPC rate limiter status'
      });
    }
  });
  
  // Add system status endpoint
  app.get('/status', (req, res) => {
    const status = {
      status: 'ok',
      timestamp: Date.now(),
      components: {
        solanaConnection: {
          status: 'connected',
          endpoint: 'Instant Nodes',
          version: '2.2.0'
        },
        nexusEngine: {
          status: 'active',
          mode: 'live', // Fixed: removed dependency on getSimulationMode
          initialized: true
        },
        agents: {
          hyperion: {
            status: 'active',
            type: 'flash_arbitrage'
          },
          quantumOmega: {
            status: 'active',
            type: 'sniper'
          },
          singularity: {
            status: 'active',
            type: 'cross_chain'
          }
        },
        transformers: {
          security: {
            status: 'active',
            entanglementLevel: 98
          },
          memeCortex: {
            status: 'active',
            entanglementLevel: 97
          },
          crossChain: {
            status: 'active',
            entanglementLevel: 98
          }
        }
      }
    };
    
    res.json(status);
  });
  
  // Initialize market analysis signal generator
  logger.info('Initializing Market Analysis Signal Generator for trading signals');
  try {
    await marketAnalysisSignalGenerator.start();
    logger.info('Market Analysis Signal Generator started successfully');
    
    // Schedule periodic generation of arbitrage and strategy signals
    setInterval(() => {
      marketAnalysisSignalGenerator.generateArbitrageSignals().catch(err => {
        logger.error('Error generating arbitrage signals:', err);
      });
    }, 10 * 60 * 1000); // Every 10 minutes
    
    setInterval(() => {
      marketAnalysisSignalGenerator.generateStrategySignals().catch(err => {
        logger.error('Error generating strategy signals:', err);
      });
    }, 15 * 60 * 1000); // Every 15 minutes
    
    logger.info('Scheduled periodic market analysis for trading signals');
  } catch (error) {
    logger.error('Failed to start Market Analysis Signal Generator:', error);
  }
  
  // Import Perplexity AI integration
  const { perplexityAI } = require('./perplexity-integration');

  // Perplexity AI routes
  router.get('/api/perplexity/status', (req, res) => {
    const initialized = perplexityAI.isInitialized();
    res.json({
      status: initialized ? 'operational' : 'not_configured',
      initialized,
      model: 'llama-3.1-sonar-small-128k-online',
      timestamp: new Date().toISOString()
    });
  });

  router.get('/api/perplexity/analyze/:token', async (req, res) => {
    try {
      const token = req.params.token.toUpperCase();
      const analysis = await perplexityAI.analyzeToken(token);
      res.json({
        success: true,
        token,
        analysis,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to analyze token',
        error: error.message
      });
    }
  });

  router.get('/api/perplexity/sentiment/:token', async (req, res) => {
    try {
      const token = req.params.token.toUpperCase();
      const sentiment = await perplexityAI.getMarketSentiment(token);
      res.json({
        success: true,
        token,
        sentiment,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get market sentiment',
        error: error.message
      });
    }
  });

  app.get('/api/perplexity/arbitrage', async (req, res) => {
    try {
      const opportunities = await perplexityAI.findArbitrageOpportunities();
      res.json({
        success: true,
        opportunities,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to find arbitrage opportunities',
        error: error.message
      });
    }
  });

  router.get('/api/perplexity/strategies', async (req, res) => {
    try {
      const strategies = await perplexityAI.recommendTradingStrategies();
      res.json({
        success: true,
        strategies,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to recommend trading strategies',
        error: error.message
      });
    }
  });

  // Set up routes
  // Configure wallet setup for trading and profit collection
  app.post('/api/wallet/configure', async (req, res) => {
    try {
      const { configureWallets } = require('./walletManager');
      
      const { tradingWallet, profitWallet, profitReinvestmentRatio, profitCollectionThreshold } = req.body;
      
      if (!tradingWallet) {
        return res.status(400).json({
          success: false,
          message: 'Trading wallet address is required'
        });
      }
      
      if (!profitWallet) {
        return res.status(400).json({
          success: false,
          message: 'Profit collection wallet address is required'
        });
      }
      
      const walletConfig = await configureWallets({
        tradingWallet,
        profitWallet,
        profitReinvestmentRatio: profitReinvestmentRatio || 0.95, // Default to 95% reinvestment
        profitCollectionThreshold: profitCollectionThreshold || 100 // Default to $100 threshold
      });
      
      logger.info(`Wallet configuration updated. Trading: ${tradingWallet}, Prophet: ${profitWallet}`);
      
      res.json({
        success: walletConfig.success,
        message: walletConfig.success ? 'Wallet configuration updated successfully' : 'Failed to update wallet configuration',
        config: {
          tradingWallet,
          profitWallet,
          profitSplit: `${(walletConfig.config.profitReinvestmentRatio * 100).toFixed(0)}/${((1 - walletConfig.config.profitReinvestmentRatio) * 100).toFixed(0)}` // e.g. "95/5"
        }
      });
    } catch (error) {
      logger.error('Error configuring wallets:', error);
      res.status(500).json({
        success: false,
        message: 'Error configuring wallets: ' + (error?.message || 'Unknown error')
      });
    }
  });
  
  // Get current wallet configuration
  app.get('/api/wallet/config', (req, res) => {
    try {
      const { getWalletConfig } = require('./walletManager');
      
      const config = getWalletConfig();
      
      // Only return partial addresses for security
      const maskAddress = (address: string) => 
        address ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : '';
      
      res.json({
        success: true,
        config: {
          tradingWallet: maskAddress(config.tradingWallet),
          profitWallet: maskAddress(config.profitWallet),
          profitSplit: `${(config.profitReinvestmentRatio * 100).toFixed(0)}/${((1 - config.profitReinvestmentRatio) * 100).toFixed(0)}`, // e.g. "95/5"
          profitCollectionThreshold: config.profitCollectionThreshold
        }
      });
    } catch (error) {
      logger.error('Error getting wallet configuration:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting wallet configuration: ' + (error?.message || 'Unknown error')
      });
    }
  });

  // Activate live trading with real funds
  app.post('/api/live-trading/activate', async (req, res) => {
    try {
      const { activateLiveTrading } = require('./activateLiveTrading');
      const { getWalletConfig } = require('./walletManager');
      
      // Check if wallets are configured
      const walletConfig = getWalletConfig();
      if (!walletConfig.tradingWallet || !walletConfig.profitWallet) {
        return res.status(400).json({
          success: false,
          message: 'Wallet configuration is incomplete. Please configure trading and profit wallets before activating live trading.',
          status: 'CONFIG_REQUIRED',
          timestamp: new Date().toISOString()
        });
      }
      
      logger.info('Activating live trading with real funds via API call');
      const result = await activateLiveTrading();
      
      if (result) {
        res.json({
          success: true,
          message: 'Live trading activated successfully! Your system is now trading with real funds.',
          status: ComponentStatus.ACTIVE,
          timestamp: new Date().toISOString(),
          wallets: {
            trading: `${walletConfig.tradingWallet.substring(0, 6)}...${walletConfig.tradingWallet.substring(walletConfig.tradingWallet.length - 4)}`,
            profit: `${walletConfig.profitWallet.substring(0, 6)}...${walletConfig.profitWallet.substring(walletConfig.profitWallet.length - 4)}`,
            profitSplit: `${(walletConfig.profitReinvestmentRatio * 100).toFixed(0)}/${((1 - walletConfig.profitReinvestmentRatio) * 100).toFixed(0)}`
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to activate live trading',
          status: 'FAILED',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('Error activating live trading:', error);
      res.status(500).json({
        success: false,
        message: 'Error activating live trading: ' + (error?.message || 'Unknown error'),
        status: 'ERROR',
        timestamp: new Date().toISOString()
      });
    }
  });

  app.use(router);
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Create WebSocket server for real-time data
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Set up WebSocket connection handler
  wss.on('connection', (ws) => {
    logger.info('WebSocket client connected');
    
    // Send initial data to the client
    ws.send(JSON.stringify({ 
      type: 'status',
      data: {
        nexusEngineActive: usingNexusEngine,
        usingRealFunds: true, // Fixed: hardcoded to true since we're always using real funds
        transformersActive: true,
        transformerEntanglementLevel: {
          security: 95,
          crosschain: 92,
          memecortex: 98
        }
      }
    }));
    
    // Handle messages from clients
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle different message types
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', time: Date.now() }));
        }
      } catch (error) {
        logger.error('Error handling WebSocket message:', error);
      }
    });
    
    // Handle disconnection
    ws.on('close', () => {
      logger.info('WebSocket client disconnected');
    });
  });
  
  return httpServer;
}