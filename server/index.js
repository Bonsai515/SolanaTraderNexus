const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');

const app = express();
const port = process.env.PORT || 5000;

// Enable JSON parsing
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Set up WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });

// Serve static files from the client build directory
app.use(express.static(path.join(__dirname, '../client')));

// Simple API route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'Solana Trading Platform API is running'
  });
});

// Solana test endpoint
app.get('/api/solana/status', async (req, res) => {
  try {
    // Check if we have API key in environment
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

// WebSocket connection
wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket');
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'WELCOME',
    message: 'Connected to Solana Trading Platform WebSocket',
    timestamp: new Date().toISOString()
  }));
  
  // Handle incoming messages
  ws.on('message', (message) => {
    console.log('Received message:', message.toString());
    
    // Echo back message for now
    ws.send(JSON.stringify({
      type: 'ECHO',
      data: message.toString(),
      timestamp: new Date().toISOString()
    }));
  });
  
  // Handle disconnect
  ws.on('close', () => {
    console.log('Client disconnected from WebSocket');
  });
});

// Fallback route - serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Start the server
server.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Solana Trading Platform server running on port ${port}`);
  console.log(`💻 WebSocket server accessible at /ws endpoint`);
});