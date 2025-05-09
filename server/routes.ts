import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import storage from './storage';
import { WebSocketServer } from 'ws';
import { Server } from 'http';
import * as solanaWeb3 from '@solana/web3.js';
import { getTransformerAPI, MarketData } from './transformers';
import { logger } from './logger';
import agentRouter, * as AgentManager from './agents';

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
  TransactionStatus
} from '../shared/schema';

const router = express.Router();

// API Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Transformer API endpoints
router.get('/api/transformer/status', (req, res) => {
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

// Make a prediction
router.post('/api/transformer/predict', async (req, res) => {
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

// Update model with new data
router.post('/api/transformer/update', async (req, res) => {
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
router.post('/api/transformer/train', async (req, res) => {
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
    if (process.env.SOLANA_RPC_API_KEY) {
      try {
        // Use Helius with API key
        const heliusEndpoint = `https://mainnet.helius-rpc.com/?api-key=${process.env.SOLANA_RPC_API_KEY}`;
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

// Initialize transformer API
(async () => {
  try {
    if (!transformerApiInitialized) {
      logger.info('Initializing transformer API with pairs: SOL/USDC, BONK/USDC');
      const transformer = getTransformerAPI(storage);
      await transformer.initialize();
      transformerApiInitialized = true;
      logger.info('Transformer API initialized successfully');
    }
  } catch (error) {
    logger.error("Failed to initialize transformer API:", error);
    transformerApiInitialized = false;
  }
})();

export default router;