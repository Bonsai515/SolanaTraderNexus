const express = require('express');
const path = require('path');
const app = express();

// Serve static files (CSS, JS, images)
app.use(express.static(path.join(__dirname, '..')));

// Serve our standalone HTML file at the root
app.get('/', (req, res) => {
  console.log('Serving index.html from root path');
  res.sendFile(path.join(__dirname, '../index.html'));
});

// Special endpoints for testing
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Solana Trading Platform server is running' });
});

app.get('/api/solana/status', (req, res) => {
  // Check for API keys in environment
  const hasApiKey = process.env.SOLANA_RPC_API_KEY ? true : false;
  const hasInstantNodes = process.env.INSTANT_NODES_RPC_URL ? true : false;
  
  res.json({
    status: 'operational',
    customRpc: hasInstantNodes,
    apiKey: hasApiKey || true, // Default to true for demo
    network: 'mainnet-beta',
    timestamp: new Date().toISOString()
  });
});

// Agent endpoints
app.get('/api/agents', (req, res) => {
  // Return sample agents
  const agents = [
    {
      id: 'hyperion-1',
      name: 'Hyperion Flash Arbitrage',
      type: 'hyperion',
      status: 'idle',
      active: true,
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
      active: true,
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

app.get('/api/executions', (req, res) => {
  const { v4: uuidv4 } = require('uuid');
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

// Add WebSocket support
const http = require('http');
const { Server } = require('ws');

const server = http.createServer(app);
const wss = new Server({ server, path: '/ws' });

wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket');
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'WELCOME',
    message: 'Connected to Solana Trading Platform WebSocket',
    timestamp: new Date().toISOString()
  }));
  
  ws.on('close', () => {
    console.log('Client disconnected from WebSocket');
  });
  
  ws.on('message', (message) => {
    console.log('Received message:', message.toString());
  });
});

// Listen on port 5000 for production deployment
const port = process.env.PORT || 5000;
server.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`💻 WebSocket server accessible at /ws endpoint`);
}););
});