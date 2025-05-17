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
const dotenv = require('dotenv');
const http = require('http');

// Load environment variables
dotenv.config({ path: '.env.deployment' });

// Import enhanced managers (with .js extension for CommonJS compatibility)
const { rpcManager } = require('./server/lib/enhancedRpcManager.js');
const { priceAggregator } = require('./server/lib/advancedPriceAggregator.js');
const { pythPriceService } = require('./server/lib/pythPriceService.js');
const { multiSourcePriceFeed } = require('./server/lib/multiSourcePriceFeed.js');
const { healthMonitor } = require('./server/lib/healthMonitor.js');

// Create Express app and HTTP server
const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client')));

// Sample data for API responses
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

// Start health monitoring
healthMonitor.startMonitoring();

// Health check endpoint
app.get('/health', (req, res) => {
  const memoryUsage = process.memoryUsage();
  const systemHealth = healthMonitor.getSystemHealth();
  
  const status = {
    status: systemHealth.status,
    timestamp: new Date().toISOString(),
    services: {
      total: systemHealth.services,
      healthy: systemHealth.healthy,
      degraded: systemHealth.degraded,
      unhealthy: systemHealth.unhealthy
    },
    memory: {
      rss: Math.round(memoryUsage.rss / (1024 * 1024)) + ' MB',
      heapTotal: Math.round(memoryUsage.heapTotal / (1024 * 1024)) + ' MB',
      heapUsed: Math.round(memoryUsage.heapUsed / (1024 * 1024)) + ' MB'
    }
  };
  
  res.json(status);
});

// Detailed service health status
app.get('/health/services', (req, res) => {
  res.json(healthMonitor.getServiceHealth());
});

// RPC status endpoint
app.get('/health/rpc', (req, res) => {
  try {
    res.json(rpcManager.getEndpointStatus());
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 'unhealthy'
    });
  }
});

// API Status endpoint
app.get('/api/status', (req, res) => {
  const systemHealth = healthMonitor.getSystemHealth();
  
  res.json({
    status: systemHealth.status,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    services: {
      priceFeeds: systemHealth.services > 0,
      trading: true,
      wallets: true,
      signals: true,
      health: {
        healthy: systemHealth.healthy,
        degraded: systemHealth.degraded,
        unhealthy: systemHealth.unhealthy
      }
    },
    rpc: {
      status: rpcManager.getStatus()
    }
  });
});

// Status dashboard UI
app.get('/status', (req, res) => {
  // Load and serve the HTML status dashboard
  const dashboardHtml = fs.readFileSync('./server/lib/status-dashboard.html', 'utf8');
  res.send(dashboardHtml);
});

// Price API endpoints
app.get('/api/prices', async (req, res) => {
  try {
    // Use the multi-source price feed for more reliable data
    const supportedTokens = ['SOL', 'USDC', 'BONK', 'JUP', 'MEME', 'WIF', 'ETH', 'BTC'];
    const prices = await multiSourcePriceFeed.getPrices(supportedTokens);
    res.json(Object.values(prices));
  } catch (error) {
    console.error('[API] Error fetching prices:', error);
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
});

app.get('/api/prices/:token', async (req, res) => {
  try {
    const token = req.params.token.toUpperCase();
    
    // Try the multi-source price feed first (most reliable)
    const price = await multiSourcePriceFeed.getPrice(token);
    
    if (price) {
      return res.json(price);
    }
    
    // Fallback to the old price aggregator
    const legacyPrice = await priceAggregator.getPrice(token);
    
    if (!legacyPrice) {
      return res.status(404).json({ error: `Token ${token} not found` });
    }
    
    res.json(legacyPrice);
  } catch (error) {
    console.error(`[API] Error fetching price for ${req.params.token}:`, error);
    res.status(500).json({ error: `Failed to fetch price for ${req.params.token}` });
  }
});

// On-chain price data from Pyth Network
app.get('/api/pyth-prices/:token', async (req, res) => {
  try {
    const token = req.params.token.toUpperCase();
    
    // Get price from Pyth Network with fallbacks
    const priceData = await pythPriceService.getPrice(token);
    
    if (!priceData || priceData.price === 0) {
      return res.status(404).json({ error: `Token ${token} not found` });
    }
    
    res.json(priceData);
  } catch (error) {
    console.error(`[API] Error fetching Pyth price for ${req.params.token}:`, error);
    res.status(500).json({ error: `Failed to fetch Pyth price for ${req.params.token}` });
  }
});

// Enhanced market data API with multi-source pricing
app.get('/api/market/:token', async (req, res) => {
  try {
    const token = req.params.token.toUpperCase();
    
    // Get prices from multiple sources in parallel for maximum reliability
    const [multiSourcePrice, pythPrice, aggregatorPrice] = await Promise.all([
      multiSourcePriceFeed.getPrice(token),
      pythPriceService.getPrice(token).catch(() => null),
      priceAggregator.getPrice(token).catch(() => null)
    ]);
    
    // Use the most reliable source, prioritize multi-source
    if (!multiSourcePrice && !aggregatorPrice) {
      return res.status(404).json({ error: `Token ${token} not found` });
    }
    
    // Use multi-source price or fall back to aggregator
    const mainPrice = multiSourcePrice || aggregatorPrice;
    
    // Combine the data from all sources
    res.json({
      symbol: token,
      price: mainPrice.price,
      price_change_24h: mainPrice.priceChange || (aggregatorPrice ? aggregatorPrice.price_change_24h : 0),
      on_chain_price: pythPrice ? pythPrice.price : null,
      sources: {
        primary: mainPrice.source,
        on_chain: pythPrice ? pythPrice.source : 'unavailable',
        aggregator: aggregatorPrice ? aggregatorPrice.source : 'unavailable'
      },
      timestamp: Date.now(),
      last_updated: mainPrice.lastUpdated
    });
  } catch (error) {
    console.error(`[API] Error fetching market data for ${req.params.token}:`, error);
    res.status(500).json({ error: `Failed to fetch market data for ${req.params.token}` });
  }
});

// Price source status endpoint
app.get('/api/price-sources', (req, res) => {
  try {
    const sources = {
      multiSource: multiSourcePriceFeed.getSourceStatus(),
      pyth: pythPriceService.getCircuitStatus()
    };
    
    res.json(sources);
  } catch (error) {
    console.error('[API] Error fetching price source status:', error);
    res.status(500).json({ error: 'Failed to fetch price source status' });
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

// Initialize WebSocket server
const { WebSocketManager } = require('./server/websocket.js');
const wsManager = new WebSocketManager(httpServer);

// Start the server with httpServer (needed for WebSocket)
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[Production] Server running on port ${PORT}`);
  console.log(`[Production] Access the trading platform at http://localhost:${PORT}`);
  console.log(`[Production] WebSocket server available at ws://localhost:${PORT}/ws`);
});

module.exports = app;