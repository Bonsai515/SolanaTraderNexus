/**
 * Enhanced Price Feed Server
 * 
 * This is a full-featured Express server that exposes the price feed API
 * endpoints for integration with the trading system.
 */

import express from 'express';
import priceFeedService, { 
  getTokenPrice, 
  getMultipleTokenPrices, 
  getCachedSolPrice, 
  getSupportedTokens,
  getCacheStats,
  getSourceMetrics,
  getPriceMetrics,
  startPriceMonitor 
} from './price-feed';
import fs from 'fs';
import path from 'path';

// Configuration Constants
const PORT = 3030;
const HOST = '0.0.0.0';
const DASHBOARD_UPDATE_INTERVAL_MS = 10000; // 10 seconds

// Create Express app
const app = express();

// Enable JSON parsing middleware
app.use(express.json());

// Enable CORS for local development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Create logs directory if it doesn't exist
const LOGS_DIR = './logs';
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
    
    // Log API requests for monitoring
    if (req.originalUrl.startsWith('/api/')) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        duration,
        ip: req.ip
      };
      
      // Append to log file
      fs.appendFileSync(
        path.join(LOGS_DIR, 'api-requests.log'),
        JSON.stringify(logEntry) + '\n'
      );
    }
  });
  
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  const stats = getCacheStats();
  
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    cacheStats: {
      hits: stats.hits,
      misses: stats.misses,
      keys: stats.keys
    }
  });
});

// Get supported tokens endpoint
app.get('/api/tokens', (req, res) => {
  const tokens = getSupportedTokens();
  res.json({
    tokens,
    count: tokens.length,
    timestamp: new Date().toISOString()
  });
});

// Get token price endpoint
app.get('/api/price/:token', async (req, res) => {
  const { token } = req.params;
  
  try {
    const price = await getTokenPrice(token.toUpperCase());
    res.json({
      symbol: token.toUpperCase(),
      price,
      currency: 'USD',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error fetching ${token} price:`, error);
    res.status(500).json({
      error: `Failed to fetch ${token} price`,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get SOL price endpoint (convenience shortcut)
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
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get multiple token prices endpoint
app.post('/api/prices', async (req, res) => {
  const { tokens } = req.body;
  
  if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
    return res.status(400).json({
      error: 'Invalid request, body must contain tokens array',
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    const prices = await getMultipleTokenPrices(tokens.map(t => t.toUpperCase()));
    res.json({
      prices,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching multiple token prices:', error);
    res.status(500).json({
      error: 'Failed to fetch multiple token prices',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get source metrics endpoint
app.get('/api/metrics/sources', (req, res) => {
  const metrics = getSourceMetrics();
  
  // Calculate average latency for each source
  const result = Object.keys(metrics).map(source => {
    const { requests, failures, latencyMs } = metrics[source];
    const avgLatency = latencyMs.length > 0 ? 
      latencyMs.reduce((sum, val) => sum + val, 0) / latencyMs.length : 0;
    
    return {
      source,
      requests,
      failures,
      successRate: requests > 0 ? (requests - failures) / requests : 0,
      avgLatencyMs: Math.round(avgLatency),
    };
  });
  
  res.json({
    metrics: result,
    timestamp: new Date().toISOString()
  });
});

// Get price metrics endpoint
app.get('/api/metrics/prices', (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
  const metrics = getPriceMetrics(limit);
  
  res.json({
    metrics,
    count: metrics.length,
    timestamp: new Date().toISOString()
  });
});

// Dashboard data endpoint (aggregates all metrics)
app.get('/api/dashboard', (req, res) => {
  const cacheStats = getCacheStats();
  const sourceMetrics = getSourceMetrics();
  const priceMetrics = getPriceMetrics(10); // Last 10 price checks
  const tokens = getSupportedTokens();
  
  // Calculate source stats
  const sources = Object.keys(sourceMetrics).map(source => {
    const { requests, failures, latencyMs } = sourceMetrics[source];
    const avgLatency = latencyMs.length > 0 ? 
      latencyMs.reduce((sum, val) => sum + val, 0) / latencyMs.length : 0;
    
    return {
      source,
      requests,
      failures,
      successRate: requests > 0 ? (requests - failures) / requests : 0,
      avgLatencyMs: Math.round(avgLatency),
    };
  });
  
  res.json({
    tokens,
    cacheStats: {
      hits: cacheStats.hits,
      misses: cacheStats.misses,
      keys: cacheStats.keys,
      hitRate: cacheStats.hits + cacheStats.misses > 0 ? 
        cacheStats.hits / (cacheStats.hits + cacheStats.misses) : 0
    },
    sources,
    recentPrices: priceMetrics,
    systemStatus: {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    }
  });
});

// Generate a simple HTML dashboard
app.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enhanced Price Feed Dashboard</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f7fa;
    }
    h1, h2, h3 {
      color: #2c3e50;
    }
    .dashboard-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-gap: 20px;
    }
    .dashboard-card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      padding: 20px;
      margin-bottom: 20px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      grid-gap: 10px;
    }
    .stat-box {
      background: #f8f9fa;
      border-radius: 4px;
      padding: 10px;
      text-align: center;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #3498db;
    }
    .stat-label {
      font-size: 12px;
      color: #7f8c8d;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th, td {
      padding: 8px 12px;
      text-align: left;
      border-bottom: 1px solid #e1e1e1;
    }
    th {
      background: #f8f9fa;
    }
    .success-rate {
      display: inline-block;
      width: 100%;
      height: 8px;
      background: #ecf0f1;
      border-radius: 4px;
    }
    .success-rate .bar {
      height: 100%;
      background: #2ecc71;
      border-radius: 4px;
    }
    .refresh-button {
      background: #3498db;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      margin-bottom: 20px;
    }
    .token-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      grid-gap: 10px;
    }
    .token-box {
      background: white;
      border-radius: 4px;
      padding: 10px;
      text-align: center;
      border: 1px solid #e1e1e1;
      cursor: pointer;
    }
    .token-box:hover {
      background: #f8f9fa;
    }
    .token-symbol {
      font-weight: bold;
      font-size: 18px;
    }
    .token-price {
      font-size: 16px;
      color: #2c3e50;
    }
    .footer {
      margin-top: 20px;
      text-align: center;
      color: #7f8c8d;
      font-size: 12px;
    }
    .last-updated {
      text-align: right;
      color: #7f8c8d;
      font-size: 12px;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <h1>Enhanced Price Feed Dashboard</h1>
  <button id="refresh-button" class="refresh-button">Refresh Data</button>
  
  <div class="dashboard-grid">
    <div class="dashboard-card">
      <h2>System Status</h2>
      <div class="stats-grid">
        <div class="stat-box">
          <div id="uptime" class="stat-value">-</div>
          <div class="stat-label">Uptime (s)</div>
        </div>
        <div class="stat-box">
          <div id="cache-hit-rate" class="stat-value">-</div>
          <div class="stat-label">Cache Hit Rate</div>
        </div>
        <div class="stat-box">
          <div id="cache-hits" class="stat-value">-</div>
          <div class="stat-label">Cache Hits</div>
        </div>
        <div class="stat-box">
          <div id="cache-misses" class="stat-value">-</div>
          <div class="stat-label">Cache Misses</div>
        </div>
      </div>
    </div>
    
    <div class="dashboard-card">
      <h2>Price Source Metrics</h2>
      <table id="source-metrics-table">
        <thead>
          <tr>
            <th>Source</th>
            <th>Success Rate</th>
            <th>Avg Latency</th>
            <th>Requests</th>
          </tr>
        </thead>
        <tbody>
          <!-- Source metrics will be populated here -->
        </tbody>
      </table>
    </div>
  </div>
  
  <div class="dashboard-card">
    <h2>Token Prices</h2>
    <div id="token-grid" class="token-grid">
      <!-- Token prices will be populated here -->
    </div>
  </div>
  
  <div class="dashboard-card">
    <h2>Recent Price Updates</h2>
    <table id="recent-prices-table">
      <thead>
        <tr>
          <th>Token</th>
          <th>Price (USD)</th>
          <th>Sources</th>
          <th>Latency (ms)</th>
          <th>Timestamp</th>
        </tr>
      </thead>
      <tbody>
        <!-- Recent prices will be populated here -->
      </tbody>
    </table>
  </div>
  
  <div class="footer">
    Enhanced Price Feed Service - © 2025
  </div>
  
  <script>
    // Update dashboard data
    function updateDashboard() {
      fetch('/api/dashboard')
        .then(response => response.json())
        .then(data => {
          // Update system stats
          document.getElementById('uptime').textContent = Math.round(data.systemStatus.uptime);
          
          const hitRate = data.cacheStats.hitRate * 100;
          document.getElementById('cache-hit-rate').textContent = hitRate.toFixed(1) + '%';
          document.getElementById('cache-hits').textContent = data.cacheStats.hits;
          document.getElementById('cache-misses').textContent = data.cacheStats.misses;
          
          // Update source metrics
          const sourceTable = document.getElementById('source-metrics-table').querySelector('tbody');
          sourceTable.innerHTML = '';
          
          data.sources.forEach(source => {
            const row = document.createElement('tr');
            
            // Source name
            const nameCell = document.createElement('td');
            nameCell.textContent = source.source;
            row.appendChild(nameCell);
            
            // Success rate
            const rateCell = document.createElement('td');
            const successRate = Math.round(source.successRate * 100);
            
            const rateBar = document.createElement('div');
            rateBar.className = 'success-rate';
            
            const bar = document.createElement('div');
            bar.className = 'bar';
            bar.style.width = successRate + '%';
            
            rateBar.appendChild(bar);
            rateCell.textContent = successRate + '%';
            rateCell.appendChild(rateBar);
            row.appendChild(rateCell);
            
            // Latency
            const latencyCell = document.createElement('td');
            latencyCell.textContent = source.avgLatencyMs + 'ms';
            row.appendChild(latencyCell);
            
            // Requests
            const requestsCell = document.createElement('td');
            requestsCell.textContent = source.requests + ' (' + source.failures + ' failed)';
            row.appendChild(requestsCell);
            
            sourceTable.appendChild(row);
          });
          
          // Update token grid
          const tokenGrid = document.getElementById('token-grid');
          tokenGrid.innerHTML = '';
          
          // Fetch all token prices
          fetch('/api/prices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tokens: data.tokens })
          })
            .then(response => response.json())
            .then(priceData => {
              data.tokens.forEach(token => {
                const tokenBox = document.createElement('div');
                tokenBox.className = 'token-box';
                tokenBox.onclick = () => {
                  window.open('/api/price/' + token, '_blank');
                };
                
                const symbolDiv = document.createElement('div');
                symbolDiv.className = 'token-symbol';
                symbolDiv.textContent = token;
                
                const priceDiv = document.createElement('div');
                priceDiv.className = 'token-price';
                
                if (priceData.prices[token]) {
                  // Format the price based on its magnitude
                  const price = priceData.prices[token];
                  if (price < 0.0001) {
                    priceDiv.textContent = '$' + price.toExponential(4);
                  } else if (price < 0.01) {
                    priceDiv.textContent = '$' + price.toFixed(6);
                  } else if (price < 1) {
                    priceDiv.textContent = '$' + price.toFixed(4);
                  } else if (price < 100) {
                    priceDiv.textContent = '$' + price.toFixed(2);
                  } else {
                    priceDiv.textContent = '$' + Math.round(price);
                  }
                } else {
                  priceDiv.textContent = 'N/A';
                }
                
                tokenBox.appendChild(symbolDiv);
                tokenBox.appendChild(priceDiv);
                tokenGrid.appendChild(tokenBox);
              });
            })
            .catch(error => {
              console.error('Error fetching token prices:', error);
            });
          
          // Update recent prices
          const pricesTable = document.getElementById('recent-prices-table').querySelector('tbody');
          pricesTable.innerHTML = '';
          
          data.recentPrices.forEach(priceMetric => {
            const row = document.createElement('tr');
            
            // Token
            const tokenCell = document.createElement('td');
            tokenCell.textContent = priceMetric.token;
            row.appendChild(tokenCell);
            
            // Price
            const priceCell = document.createElement('td');
            if (priceMetric.price < 0.0001) {
              priceCell.textContent = '$' + priceMetric.price.toExponential(4);
            } else if (priceMetric.price < 0.01) {
              priceCell.textContent = '$' + priceMetric.price.toFixed(6);
            } else if (priceMetric.price < 1) {
              priceCell.textContent = '$' + priceMetric.price.toFixed(4);
            } else if (priceMetric.price < 100) {
              priceCell.textContent = '$' + priceMetric.price.toFixed(2);
            } else {
              priceCell.textContent = '$' + Math.round(priceMetric.price);
            }
            row.appendChild(priceCell);
            
            // Sources
            const sourcesCell = document.createElement('td');
            sourcesCell.textContent = priceMetric.sources;
            row.appendChild(sourcesCell);
            
            // Latency
            const latencyCell = document.createElement('td');
            latencyCell.textContent = priceMetric.latencyMs + 'ms';
            row.appendChild(latencyCell);
            
            // Timestamp
            const timestampCell = document.createElement('td');
            const date = new Date(priceMetric.timestamp);
            timestampCell.textContent = date.toLocaleTimeString();
            row.appendChild(timestampCell);
            
            pricesTable.appendChild(row);
          });
          
          // Add last updated timestamp
          const lastUpdated = document.createElement('div');
          lastUpdated.className = 'last-updated';
          lastUpdated.textContent = 'Last Updated: ' + new Date().toLocaleTimeString();
          document.body.appendChild(lastUpdated);
        })
        .catch(error => {
          console.error('Error updating dashboard:', error);
        });
    }
    
    // Initial update
    updateDashboard();
    
    // Periodic update
    setInterval(updateDashboard, ${DASHBOARD_UPDATE_INTERVAL_MS});
    
    // Refresh button
    document.getElementById('refresh-button').addEventListener('click', updateDashboard);
  </script>
</body>
</html>
  `;
  
  res.send(html);
});

// Start server
app.listen(PORT, HOST, () => {
  console.log(`\n=======================================================`);
  console.log(`🚀 ENHANCED PRICE FEED SERVER STARTED`);
  console.log(`=======================================================`);
  console.log(`Server URL: http://${HOST}:${PORT}`);
  console.log(`\nAPI Endpoints:`);
  console.log(`- GET /api/tokens - Get all supported tokens`);
  console.log(`- GET /api/price/:token - Get price for a specific token`);
  console.log(`- POST /api/prices - Get multiple token prices`);
  console.log(`- GET /api/metrics/sources - Get source metrics`);
  console.log(`- GET /api/metrics/prices - Get price metrics`);
  console.log(`- GET /api/dashboard - Get dashboard data`);
  console.log(`- GET /health - Health check endpoint`);
  console.log(`\nDashboard: http://${HOST}:${PORT}/`);
  console.log(`=======================================================`);
  
  // Start price monitor for stats logging
  startPriceMonitor();
});

console.log('Starting enhanced price feed server...');