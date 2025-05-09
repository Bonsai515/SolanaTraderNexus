const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const router = express.Router();

// API Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get Solana connection status
router.get('/solana/status', async (req, res) => {
  try {
    // Check for Instant Nodes URL first (better performance)
    const hasApiKey = process.env.SOLANA_RPC_API_KEY ? true : false;
    const hasInstantNodes = process.env.INSTANT_NODES_RPC_URL ? true : false;
    
    res.json({
      status: 'operational',
      customRpc: hasInstantNodes,
      apiKey: hasApiKey,
      network: 'mainnet-beta',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Setup WebSocket server
function setupWebSocketServer(httpServer) {
  const { WebSocketServer } = require('ws');
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  console.log('💻 WebSocket server accessible at /ws endpoint');
  
  wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    
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
            
          default:
            console.log(`Received message type: ${data.type}`);
            ws.send(JSON.stringify({
              type: 'ECHO',
              data: message.toString(),
              timestamp: new Date().toISOString()
            }));
        }
      } catch (error) {
        console.error('WebSocket message processing error:', error);
        ws.send(JSON.stringify({
          type: 'ERROR',
          message: 'Failed to process message',
          timestamp: new Date().toISOString()
        }));
      }
    });
    
    // Handle close
    ws.on('close', () => {
      console.log('Client disconnected from WebSocket');
    });
    
    // Handle errors
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });
  
  return wss;
}

// Mock API endpoints for agent interactions
// GET /api/agents
router.get('/agents', (req, res) => {
  // Return sample agents
  const agents = [
    {
      id: 'hyperion-1',
      name: 'Hyperion Flash Arbitrage',
      type: 'hyperion',
      status: 'idle',
      active: false,
      wallets: {
        trading: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe5tHE2',
        profit: '2xNwwA8DmH5AsLhBjevvkPzTnpvH6Zz4pQ7bvQD9rtkf',
        fee: '4z1PvJnKZcnLSJYGRNdZn7eYAUkKRiUJJW6Kcmt2hiEX',
        stealth: ['3Y7T8oBSHUb81uetPjjzSBdGe6RN2rTZ3NEN1xQ6mVi4']
      },
      metrics: {
        totalExecutions: 157,
        successRate: 0.92,
        totalProfit: 23.45,
        lastExecution: new Date().toISOString()
      }
    },
    {
      id: 'quantum-omega-1',
      name: 'Quantum Omega Sniper',
      type: 'quantum_omega',
      status: 'idle',
      active: false,
      wallets: {
        trading: '5FHwkrdxD5oNU3DwPWbxLQkd5Za4rQXQDkxMZvHzLkSr',
        profit: '7XvgVxyh5cQeb9PdiUJZBbyYAqNz8JfwbFGPn6HvhNxW',
        fee: '3WPBgP3Mcv2XTf6Sq8QNLegzVMhGp4w1mYhRK5o3bzJ7',
        stealth: ['3Y7T8oBSHUb81uetPjjzSBdGe6RN2rTZ3NEN1xQ6mVi4', '9Y7T8oBSHUb81uetPjjzSBdGe6RN2rTZ3NEN1xQ6mVqW']
      },
      metrics: {
        totalExecutions: 82,
        successRate: 0.88,
        totalProfit: 14.76,
        lastExecution: new Date().toISOString()
      }
    }
  ];
  
  res.json(agents);
});

// POST /api/agents/system/start
router.post('/agents/system/start', (req, res) => {
  res.json({ success: true });
});

// POST /api/agents/system/stop
router.post('/agents/system/stop', (req, res) => {
  res.json({ success: true });
});

// GET /api/executions
router.get('/executions', (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit) : 10;
  
  // Return sample executions
  const executions = Array.from({ length: limit }, (_, i) => ({
    id: uuidv4(),
    agentId: i % 2 === 0 ? 'hyperion-1' : 'quantum-omega-1',
    success: Math.random() > 0.2,
    profit: (Math.random() * 2 - 0.5).toFixed(4) * 1,
    timestamp: new Date(Date.now() - i * 3600000).toISOString(),
    strategy: i % 2 === 0 ? 'flash_arb_v2' : 'mev_sniper_v1',
    metrics: {
      executionTime: Math.round(Math.random() * 500),
      gasUsed: Math.round(Math.random() * 200000),
      slippage: (Math.random() * 0.01).toFixed(4) * 1
    },
    signature: `5${uuidv4().replace(/-/g, '')}`,
    error: Math.random() > 0.8 ? 'Execution reverted: insufficient liquidity' : undefined
  }));
  
  res.json(executions);
});

// GET /ai/status
router.get('/ai/status', (req, res) => {
  res.json({
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
module.exports.setupWebSocketServer = setupWebSocketServer;