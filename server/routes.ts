import express from 'express';
import { ArbitrageOpportunity } from './signalTypes';
import { getAllDexes } from './dexInfo';
import * as transactionEngine from './transaction-engine';
import * as nexusTransactionEngine from './nexus-transaction-engine';
import { logger } from './logger';

const router = express.Router();
let usingNexusEngine = false; // By default, use the original engine

router.get('/api/market/analyze/:token', async (req, res) => {
  try {
    const token = req.params.token;

    // Return basic market analysis
    res.json({
      token_info: {
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
    const success = await nexusTransactionEngine.initializeTransactionEngine(rpcUrl, useRealFunds);
    
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
      await nexusTransactionEngine.stopTransactionEngine();
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
      activeEngine: usingNexusEngine ? 'nexus_professional' : 'standard',
      initialized: usingNexusEngine ? 
        nexusTransactionEngine.isInitialized() : 
        transactionEngine.isInitialized(),
      transactionCount: usingNexusEngine ? 
        nexusTransactionEngine.getTransactionCount() : 
        transactionEngine.getTransactionCount(),
      rpcUrl: usingNexusEngine ? 
        nexusTransactionEngine.getRpcUrl() : 
        transactionEngine.getRpcUrl(),
      registeredWallets: usingNexusEngine ? 
        nexusTransactionEngine.getRegisteredWallets() : 
        transactionEngine.getRegisteredWallets(),
      usingRealFunds: usingNexusEngine ? 
        nexusTransactionEngine.isUsingRealFunds() : 
        true
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
    
    const success = usingNexusEngine ? 
      nexusTransactionEngine.registerWallet(walletAddress) : 
      transactionEngine.registerWallet(walletAddress);
    
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
    
    const result = await nexusTransactionEngine.executeSwap({
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
    
    const securityAnalysis = await nexusTransactionEngine.checkTokenSecurity(tokenAddress);
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
    
    const opportunities = await nexusTransactionEngine.findCrossChainOpportunities();
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
    
    const sentimentAnalysis = await nexusTransactionEngine.analyzeMemeSentiment(tokenAddress);
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
      nexusTransactionEngine.setUseRealFunds(useRealFunds);
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

module.exports = function(app) {
  app.use(router);
};