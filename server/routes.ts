import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import storage from './storage';
import { WebSocketServer } from 'ws';
import { Server } from 'http';
import * as solanaWeb3 from '@solana/web3.js';
import { getTransformerAPI, MarketData } from './transformers';
import { logger } from './logger';
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
  TransactionStatus
} from '../shared/schema';

const router = express.Router();

// API Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get Solana connection status
router.get('/solana/status', async (req, res) => {
  try {
    // Check for Instant Nodes URL first (better performance)
    const endpoint = process.env.INSTANT_NODES_RPC_URL || 
      (process.env.SOLANA_RPC_API_KEY 
        ? `https://mainnet.helius-rpc.com/?api-key=${process.env.SOLANA_RPC_API_KEY}`
        : 'https://api.mainnet-beta.solana.com');
    
    const connection = new solanaWeb3.Connection(endpoint);
    const version = await connection.getVersion();
    
    res.json({
      status: 'operational',
      customRpc: endpoint !== 'https://api.mainnet-beta.solana.com',
      apiKey: endpoint.includes('api-key') || endpoint.includes('INSTANT_NODES'),
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

// Setup WebSocket server
export function setupWebSocketServer(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  logger.info('💻 WebSocket server accessible at /ws endpoint');
  
  wss.on('connection', (ws) => {
    logger.info('Client connected to WebSocket');
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'WELCOME',
      message: 'Connected to Solana Trading Platform WebSocket',
      timestamp: new Date().toISOString()
    }));
    
    // Send initial connection status
    const connectionStatus = {
      status: 'operational',
      customRpc: process.env.INSTANT_NODES_RPC_URL || process.env.SOLANA_RPC_API_KEY ? true : false,
      apiKey: true,
      network: 'mainnet-beta',
      timestamp: new Date().toISOString()
    };
    
    ws.send(JSON.stringify(['Solana connection status:', connectionStatus]));
    
    // Handle messages
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle different message types
        switch(data.type) {
          case 'PING':
            ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
            break;
            
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
let transformerApiInitialized = false;
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

export default router;