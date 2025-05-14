import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { ArbitrageOpportunity } from './signalTypes';
import { getAllDexes } from './dexInfo';
import * as nexusEngine from './nexus-transaction-engine';
import { logger } from './logger';
import * as agents from './agents';
import { AgentType } from './agents';
import { perplexityAI } from './perplexity-integration';
import { localMarketAnalysis } from './lib/localMarketAnalysis';

const router = express.Router();
let usingNexusEngine = true; // Always use the Nexus Professional Engine

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
    
    if (usingNexusEngine) {
      nexusEngine.setUseRealFunds(useRealFunds);
    }
    
    res.json({ 
      success: true, 
      message: `Real funds mode ${useRealFunds ? 'enabled' : 'disabled'}`,
      usingRealFunds: useRealFunds
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

export function registerRoutes(app: express.Express) {
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

  router.get('/api/perplexity/arbitrage', async (req, res) => {
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
        usingRealFunds: nexusEngine.isUsingRealFunds(),
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