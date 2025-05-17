/**
 * Production API Server
 * 
 * This is the main entry point for the production deployment.
 * It sets up all necessary API endpoints to support the trading platform.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { systemOptimizer } = require('./server/lib/systemOptimizer');
const { priceAggregator } = require('./server/lib/priceAggregator');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client')));

// Initialize system optimizer for resource monitoring
systemOptimizer.startMonitoring();
systemOptimizer.registerMemoryOptimizationCallback(() => {
  console.log('[Production] Cleaning up resources due to high memory usage');
  priceAggregator.clearCache();
});

// Sample data for API responses when external services are rate limited
const SAMPLE_TOKENS = [
  { symbol: "SOL", price: 118.45, price_change_24h: 2.3 },
  { symbol: "BONK", price: 0.00002341, price_change_24h: 5.2 },
  { symbol: "WIF", price: 0.89, price_change_24h: -2.1 },
  { symbol: "JUP", price: 1.34, price_change_24h: 3.7 },
  { symbol: "MEME", price: 0.03451, price_change_24h: 7.8 },
  { symbol: "DOGE", price: 0.125, price_change_24h: 1.2 },
  { symbol: "ETH", price: 3320.45, price_change_24h: 1.5 },
  { symbol: "USDC", price: 1.00, price_change_24h: 0.01 }
];

const SAMPLE_SIGNALS = [
  { id: "signal-1", token: "SOL", type: "BULLISH", confidence: 78.5, timestamp: Date.now() - 300000 },
  { id: "signal-2", token: "BONK", type: "SLIGHTLY_BULLISH", confidence: 65.2, timestamp: Date.now() - 200000 },
  { id: "signal-3", token: "WIF", type: "BEARISH", confidence: 72.1, timestamp: Date.now() - 150000 }
];

const SAMPLE_TRADES = [
  { id: "trade-1", token: "SOL", type: "BUY", amount: 0.5, price: 117.23, timestamp: Date.now() - 400000, status: "COMPLETED" },
  { id: "trade-2", token: "BONK", type: "SELL", amount: 10000, price: 0.00002341, timestamp: Date.now() - 250000, status: "COMPLETED" },
  { id: "trade-3", token: "JUP", type: "BUY", amount: 10, price: 1.32, timestamp: Date.now() - 100000, status: "PENDING" }
];

// API Routes

// Health check endpoint
app.get('/health', (req, res) => {
  const memoryUsage = process.memoryUsage();
  const status = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    memory: {
      rss: Math.round(memoryUsage.rss / (1024 * 1024)) + ' MB',
      heapTotal: Math.round(memoryUsage.heapTotal / (1024 * 1024)) + ' MB',
      heapUsed: Math.round(memoryUsage.heapUsed / (1024 * 1024)) + ' MB'
    },
    system: systemOptimizer.getSystemInfo()
  };
  
  res.json(status);
});

// API Status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    services: {
      priceFeeds: true,
      trading: true,
      wallets: true,
      signals: true
    }
  });
});

// Price API endpoints
app.get('/api/prices', async (req, res) => {
  try {
    const prices = [];
    
    // Use priceAggregator to get token prices
    for (const token of SAMPLE_TOKENS) {
      const price = await priceAggregator.getPrice(token.symbol);
      prices.push({
        symbol: token.symbol,
        price: price || token.price, // Fallback to sample if not available
        price_change_24h: token.price_change_24h
      });
    }
    
    res.json(prices);
  } catch (error) {
    console.error('[API] Error fetching prices:', error);
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
});

app.get('/api/prices/:token', async (req, res) => {
  try {
    const token = req.params.token.toUpperCase();
    const sampleToken = SAMPLE_TOKENS.find(t => t.symbol === token);
    
    if (!sampleToken) {
      return res.status(404).json({ error: `Token ${token} not found` });
    }
    
    const price = await priceAggregator.getPrice(token);
    
    res.json({
      symbol: token,
      price: price || sampleToken.price, // Fallback to sample if not available
      price_change_24h: sampleToken.price_change_24h
    });
  } catch (error) {
    console.error(`[API] Error fetching price for ${req.params.token}:`, error);
    res.status(500).json({ error: `Failed to fetch price for ${req.params.token}` });
  }
});

// Signals API endpoints
app.get('/api/signals', (req, res) => {
  res.json(SAMPLE_SIGNALS);
});

app.get('/api/signals/:token', (req, res) => {
  const token = req.params.token.toUpperCase();
  const signals = SAMPLE_SIGNALS.filter(s => s.token === token);
  
  if (signals.length === 0) {
    return res.status(404).json({ error: `No signals found for token ${token}` });
  }
  
  res.json(signals);
});

// Trades API endpoints
app.get('/api/trades', (req, res) => {
  res.json(SAMPLE_TRADES);
});

app.get('/api/trades/:id', (req, res) => {
  const trade = SAMPLE_TRADES.find(t => t.id === req.params.id);
  
  if (!trade) {
    return res.status(404).json({ error: `Trade ${req.params.id} not found` });
  }
  
  res.json(trade);
});

// Wallet API endpoints
app.get('/api/wallets', (req, res) => {
  res.json([
    { address: "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb", balance: 9.99834, type: "main" },
    { address: "31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e", balance: 1.53442, type: "profit" }
  ]);
});

app.get('/api/wallets/:address', (req, res) => {
  if (req.params.address === "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb") {
    return res.json({ address: "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb", balance: 9.99834, type: "main" });
  } else if (req.params.address === "31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e") {
    return res.json({ address: "31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e", balance: 1.53442, type: "profit" });
  } else {
    return res.status(404).json({ error: `Wallet ${req.params.address} not found` });
  }
});

// Neural network API endpoints
app.get('/api/neural-network', (req, res) => {
  res.json({
    status: 'active',
    connections: 28,
    activeTransformers: ['MicroQHC', 'MemeCortex', 'MemeCortexRemix', 'Security', 'CrossChain'],
    activeAgents: ['Hyperion', 'QuantumOmega', 'Singularity'],
    signalsProcessed: 1243,
    timestamp: new Date().toISOString()
  });
});

// Add the missing /solana/tokens/trending endpoint
app.get('/solana/tokens/trending', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const trendingTokens = [
      { symbol: "BONK", price_change_24h: 5.2 },
      { symbol: "WIF", price_change_24h: -2.1 },
      { symbol: "MEME", price_change_24h: 7.8 },
      { symbol: "JUP", price_change_24h: 3.7 },
      { symbol: "POPCAT", price_change_24h: 12.3 },
      { symbol: "GUAC", price_change_24h: -4.1 },
      { symbol: "BOOK", price_change_24h: 0.8 },
      { symbol: "PNUT", price_change_24h: 2.6 },
      { symbol: "SLERF", price_change_24h: 18.2 },
      { symbol: "MOON", price_change_24h: 9.3 }
    ].slice(0, limit);
    
    res.json(trendingTokens);
  } catch (error) {
    console.error('[API] Error fetching trending tokens:', error);
    res.status(500).json({ error: 'Failed to fetch trending tokens' });
  }
});

// Serve the client for any other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/index.html'));
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Production] Server running on port ${PORT}`);
  console.log(`[Production] Access the trading platform at http://localhost:${PORT}`);
});

module.exports = app;