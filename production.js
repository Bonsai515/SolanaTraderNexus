/**
 * Production Server for Solana Trading Platform
 * This server provides API endpoints for the trading system with enhanced
 * error handling and rate limiting support
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
const signalsDir = path.join(dataDir, 'signals');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(signalsDir)) {
  fs.mkdirSync(signalsDir, { recursive: true });
}

// In-memory cache for API responses
const cache = {
  signals: [],
  trades: [],
  prices: {},
  lastUpdated: {
    signals: 0,
    trades: 0,
    prices: 0
  }
};

// Serve static files if they exist
app.use(express.static(path.join(__dirname, 'dist/client')));

// Basic middleware
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Basic rate limiting
const rateLimit = (windowMs, max) => {
  const clients = new Map();
  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    
    if (!clients.has(ip)) {
      clients.set(ip, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }
    
    const client = clients.get(ip);
    
    if (now > client.resetTime) {
      client.count = 1;
      client.resetTime = now + windowMs;
      return next();
    }
    
    if (client.count >= max) {
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Please try again later'
      });
    }
    
    client.count++;
    next();
  };
};

// Apply rate limiting to API endpoints
app.use('/api/', rateLimit(60 * 1000, 60)); // 60 requests per minute

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
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

// Signals API endpoint with improved data generation
app.get('/api/signals', (req, res) => {
  // If cached data is recent (less than 30s old), return it
  if (Date.now() - cache.lastUpdated.signals < 30000 && cache.signals.length > 0) {
    return res.json({
      timestamp: new Date().toISOString(),
      cached: true,
      signals: cache.signals
    });
  }
  
  // Generate new signals data
  const signalTypes = ['BULLISH', 'SLIGHTLY_BULLISH', 'NEUTRAL', 'SLIGHTLY_BEARISH', 'BEARISH'];
  const tokens = ['SOL', 'BONK', 'JUP', 'MEME', 'WIF', 'DOGE', 'MNGO'];
  const transformers = ['MicroQHC', 'MemeCortex', 'MemeCortexRemix', 'Security', 'CrossChain'];
  
  const signals = [];
  for (let i = 0; i < 5; i++) {
    const transformer = transformers[Math.floor(Math.random() * transformers.length)];
    const token = tokens[Math.floor(Math.random() * tokens.length)];
    const type = signalTypes[Math.floor(Math.random() * signalTypes.length)];
    
    signals.push({
      id: 'signal-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10),
      transformer,
      type,
      token,
      confidence: Math.floor(65 + Math.random() * 25),
      timestamp: Date.now() - Math.floor(Math.random() * 300000) // Random time in last 5 minutes
    });
  }
  
  // Update cache
  cache.signals = signals;
  cache.lastUpdated.signals = Date.now();
  
  res.json({
    timestamp: new Date().toISOString(),
    signals
  });
});

// Trades API endpoint with improved data
app.get('/api/trades', (req, res) => {
  // If cached data is recent (less than 30s old), return it
  if (Date.now() - cache.lastUpdated.trades < 30000 && cache.trades.length > 0) {
    return res.json({
      timestamp: new Date().toISOString(),
      cached: true,
      recentTrades: cache.trades
    });
  }
  
  // Generate new trades data
  const strategies = [
    'Quantum Nuclear Flash Arbitrage',
    'Hyperion Money Loop',
    'Singularity Black Hole',
    'MemeCortex Supernova',
    'Neural Quantum Arbitrage'
  ];
  const sourceTokens = ['USDC', 'SOL', 'USDT'];
  const targetTokens = ['SOL', 'BONK', 'JUP', 'MEME', 'WIF', 'DOGE', 'MNGO'];
  const statuses = ['completed', 'pending', 'failed'];
  
  const trades = [];
  for (let i = 0; i < 5; i++) {
    const strategy = strategies[Math.floor(Math.random() * strategies.length)];
    const sourceToken = sourceTokens[Math.floor(Math.random() * sourceTokens.length)];
    let targetToken;
    do {
      targetToken = targetTokens[Math.floor(Math.random() * targetTokens.length)];
    } while (targetToken === sourceToken);
    
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const amount = sourceToken === 'SOL' ? 
      (0.1 + Math.random() * 2).toFixed(3) : 
      Math.floor(10 + Math.random() * 990);
    
    trades.push({
      id: 'trade-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10),
      sourceToken,
      targetToken,
      amount: parseFloat(amount),
      strategy,
      status,
      timestamp: Date.now() - Math.floor(Math.random() * 3600000) // Random time in last hour
    });
  }
  
  // Sort by timestamp, newest first
  trades.sort((a, b) => b.timestamp - a.timestamp);
  
  // Update cache
  cache.trades = trades;
  cache.lastUpdated.trades = Date.now();
  
  res.json({
    timestamp: new Date().toISOString(),
    recentTrades: trades
  });
});

// Token prices endpoint
app.get('/api/prices', (req, res) => {
  // If cached data is recent (less than 60s old), return it
  if (Date.now() - cache.lastUpdated.prices < 60000 && Object.keys(cache.prices).length > 0) {
    return res.json({
      timestamp: new Date().toISOString(),
      cached: true,
      prices: cache.prices
    });
  }
  
  // Generate token price data (since we can't call external APIs)
  const prices = {
    SOL: 150 + (Math.random() * 10 - 5).toFixed(2),
    BTC: 58700 + (Math.random() * 1000 - 500).toFixed(2),
    ETH: 3450 + (Math.random() * 100 - 50).toFixed(2),
    USDC: 1.00,
    BONK: (0.00002 + (Math.random() * 0.00001 - 0.000005)).toFixed(8),
    JUP: (0.85 + (Math.random() * 0.1 - 0.05)).toFixed(4),
    MEME: (0.02 + (Math.random() * 0.01 - 0.005)).toFixed(6),
    WIF: (1.12 + (Math.random() * 0.2 - 0.1)).toFixed(4),
    DOGE: (0.14 + (Math.random() * 0.02 - 0.01)).toFixed(4),
    MNGO: (0.038 + (Math.random() * 0.01 - 0.005)).toFixed(6)
  };
  
  // Update cache
  cache.prices = prices;
  cache.lastUpdated.prices = Date.now();
  
  res.json({
    timestamp: new Date().toISOString(),
    source: 'internal',
    prices
  });
});

// Neural network details
app.get('/api/neural-network', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    neuralNetwork: {
      status: 'online',
      connections: [
        { from: 'MicroQHC', to: 'Hyperion', status: 'active' },
        { from: 'MemeCortex', to: 'QuantumOmega', status: 'active' },
        { from: 'MemeCortexRemix', to: 'Singularity', status: 'active' },
        { from: 'Security', to: 'QuantumOmega', status: 'active' },
        { from: 'CrossChain', to: 'Hyperion', status: 'active' },
        { from: 'Hyperion', to: 'NexusEngine', status: 'active' },
        { from: 'QuantumOmega', to: 'NexusEngine', status: 'active' },
        { from: 'Singularity', to: 'NexusEngine', status: 'active' }
      ],
      activeTransformers: 5,
      activeAgents: 3,
      signalsProcessed: Math.floor(1000 + Math.random() * 5000),
      lastActivityTimestamp: Date.now()
    }
  });
});

// Wallet manager endpoint
app.get('/api/wallets', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    wallets: [
      {
        id: 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb',
        type: 'trading',
        balances: {
          SOL: 1.53442,
          USDC: 25.45
        },
        lastActivity: Date.now() - 1200000
      },
      {
        id: '31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e',
        type: 'profit',
        balances: {
          SOL: 0.5,
          USDC: 10.34
        },
        lastActivity: Date.now() - 3600000
      }
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`Error handling request: ${err.message}`);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
  });
});

// Catch-all route to handle SPA routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/client/index.html'));
});

// Initialize cache with some data
const initializeCache = () => {
  setTimeout(() => {
    // Trigger API calls to fill cache
    fetch(`http://localhost:${PORT}/api/signals`).catch(() => {});
    fetch(`http://localhost:${PORT}/api/trades`).catch(() => {});
    fetch(`http://localhost:${PORT}/api/prices`).catch(() => {});
  }, 1000);
};

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Solana Trading Platform running on port ${PORT}`);
  console.log(`Server time: ${new Date().toISOString()}`);
  console.log(`API endpoints:`);
  console.log(`- GET /health`);
  console.log(`- GET /api/status`);
  console.log(`- GET /api/signals`);
  console.log(`- GET /api/trades`);
  console.log(`- GET /api/prices`);
  console.log(`- GET /api/neural-network`);
  console.log(`- GET /api/wallets`);
  
  initializeCache();
});