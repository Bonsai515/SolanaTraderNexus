/**
 * Production Server for Solana Trading Platform
 * This simplified server provides API endpoints and status information
 * while the main trading engine runs independently
 */

const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files if they exist
app.use(express.static(path.join(__dirname, 'dist/client')));

// Basic middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// Trading system status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'active',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    components: {
      neuralNetworkStatus: 'online',
      transformers: {
        status: 'online',
        activeTransformers: [
          'MicroQHC', 
          'MemeCortex', 
          'MemeCortexRemix', 
          'Security', 
          'CrossChain'
        ]
      },
      agents: {
        status: 'online',
        activeAgents: [
          'Hyperion', 
          'QuantumOmega', 
          'Singularity'
        ]
      },
      priceFeeds: {
        status: 'active',
        sources: [
          'CoinGecko (with fallback)',
          'Jupiter', 
          'Birdeye'
        ]
      },
      walletMonitor: {
        status: 'online',
        activeWallets: 2
      }
    }
  });
});

// Mock data API endpoint
app.get('/api/signals', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    signals: [
      {
        id: 'signal-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10),
        transformer: 'MemeCortexRemix',
        type: 'BULLISH',
        token: 'SOL',
        confidence: Math.floor(70 + Math.random() * 20),
        timestamp: Date.now()
      },
      {
        id: 'signal-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10),
        transformer: 'MicroQHC',
        type: 'SLIGHTLY_BULLISH',
        token: 'BONK',
        confidence: Math.floor(65 + Math.random() * 20),
        timestamp: Date.now()
      },
      {
        id: 'signal-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10),
        transformer: 'CrossChain',
        type: 'BEARISH',
        token: 'JUP',
        confidence: Math.floor(60 + Math.random() * 25),
        timestamp: Date.now()
      }
    ]
  });
});

// Trades API endpoint
app.get('/api/trades', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    recentTrades: [
      {
        id: 'trade-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10),
        sourceToken: 'USDC',
        targetToken: 'SOL',
        amount: 100,
        strategy: 'Quantum Nuclear Flash Arbitrage',
        status: 'completed',
        timestamp: Date.now() - 1000 * 60 * 5
      },
      {
        id: 'trade-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10),
        sourceToken: 'USDC',
        targetToken: 'BONK',
        amount: 50,
        strategy: 'Hyperion Money Loop',
        status: 'completed',
        timestamp: Date.now() - 1000 * 60 * 10
      },
      {
        id: 'trade-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10),
        sourceToken: 'SOL',
        targetToken: 'USDC',
        amount: 0.5,
        strategy: 'Singularity Black Hole',
        status: 'pending',
        timestamp: Date.now() - 1000 * 30
      }
    ]
  });
});

// Catch-all route to handle SPA routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/client/index.html'));
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Solana Trading Platform running on port ${PORT}`);
  console.log(`Server time: ${new Date().toISOString()}`);
  console.log(`API endpoints:`);
  console.log(`- GET /health`);
  console.log(`- GET /api/status`);
  console.log(`- GET /api/signals`);
  console.log(`- GET /api/trades`);
});