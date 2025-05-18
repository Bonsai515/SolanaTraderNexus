/**
 * Price Feed Server
 * 
 * This is a simple Express server that exposes the price feed API
 * endpoints for integration with the trading system.
 */

import express from 'express';
import { getCachedSolPrice, startPriceMonitor } from './price-feed';

// Configuration Constants
const PORT = 3030;
const HOST = '0.0.0.0';

// Create Express app
const app = express();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Get SOL price endpoint
app.get('/api/price/sol', async (req, res) => {
  try {
    const price = await getCachedSolPrice();
    res.json({
      symbol: 'SOL',
      price,
      currency: 'USD',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching SOL price:', error);
    res.status(500).json({
      error: 'Failed to fetch SOL price',
      timestamp: new Date().toISOString()
    });
  }
});

// Start server
app.listen(PORT, HOST, () => {
  console.log(`Price feed server started at http://${HOST}:${PORT}`);
  console.log(`- SOL price endpoint: http://${HOST}:${PORT}/api/price/sol`);
  console.log(`- Health check endpoint: http://${HOST}:${PORT}/health`);
  
  // Start price monitor for stats logging
  startPriceMonitor();
});

console.log('Starting price feed server...');