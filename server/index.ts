import express from 'express';
import { createServer } from 'http';
import * as path from 'path';
import { WebSocket } from 'ws';
import cors from 'cors';
import routes, { setupWebSocketServer } from './routes';
import storage from './storage';
import { logger } from './logger';
import net from 'net';
import { createServer as createViteServer } from 'vite';
import * as fs from 'fs';
import signalMonitoring from './signalMonitoring';

// Set the InstantNodes URLs for the 2-day trial
process.env.INSTANT_NODES_RPC_URL = 'https://solana-grpc-geyser.instantnodes.io:443';
process.env.INSTANT_NODES_WS_URL = 'wss://solana-api.instantnodes.io/token-NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9';
logger.info(`Using InstantNodes trial RPC URL: ${process.env.INSTANT_NODES_RPC_URL}`);
logger.info(`Using InstantNodes trial WebSocket URL: ${process.env.INSTANT_NODES_WS_URL}`);

const app = express();
const DEFAULT_PORT = 5000;

// Function to find an available port
async function findAvailablePort(startPort: number): Promise<number> {
  const isPortAvailable = (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      server.listen(port, '0.0.0.0');
    });
  };

  let port = startPort;
  while (!(await isPortAvailable(port))) {
    logger.info(`Port ${port} is in use, trying next port...`);
    port++;
    if (port > startPort + 100) {
      throw new Error('Could not find an available port after 100 attempts');
    }
  }
  
  return port;
}

// Get preferred port from environment variables
// For Replit, we should use port 5000 as the workflow expects this port, but allow overriding through env var
const preferredPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;

// Enable CORS for API requests
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes - register without '/api' prefix
app.use('/', routes);

// Root endpoint is now included in the React app routes handler below

// Add a health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve our standalone WebSocket test HTML file
app.get('/ws-test-page', (req, res) => {
  res.sendFile(path.join(__dirname, '../ws-test.html'));
});

// Add a detailed API health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    server: 'running',
    timestamp: new Date().toISOString(),
    clientIp: req.ip || 'unknown',
    environment: process.env.NODE_ENV || 'development',
    port: preferredPort
  });
});

// Create HTTP server
const httpServer = createServer(app);

// Initialize signal monitoring service
signalMonitoring.initializeSignalMonitoring();
logger.info('Signal monitoring service initialized');

// Set up WebSocket server using our enhanced implementation
const wss = setupWebSocketServer(httpServer);

// Main function to start the server
async function startServer() {
  try {
    // Find an available port
    const port = await findAvailablePort(preferredPort);
    
    // Set up Vite in development mode - this is critical for our React app
    if (process.env.NODE_ENV !== 'production') {
      try {
        // Create Vite server in middleware mode with specific configuration for proper HMR
        const vite = await createViteServer({
          server: { 
            middlewareMode: true,
            fs: {
              strict: false, // Allow serving files from outside the root directory
              allow: [path.join(__dirname, '..')] // Allow serving files from project root
            },
            hmr: {
              server: httpServer,
              port: port,
              protocol: 'ws',
              host: 'localhost',
              clientPort: port // Ensure client and server use the same port
            }
          },
          root: path.join(__dirname, '../client'),
          base: '/',
          appType: 'spa',
          optimizeDeps: {
            force: true, // Force dependency optimization
            entries: [path.join(__dirname, '../client/index.html')]
          },
          build: {
            outDir: path.join(__dirname, '../dist')
          }
        });
        
        // Use vite's connect instance as middleware (must come before other static files)
        app.use(vite.middlewares);
        logger.info('Vite development server middleware initialized with HMR support');
      } catch (error) {
        logger.error('Failed to initialize Vite middleware:', error);
        logger.info('Falling back to static file serving');
      }
    }
    
    // Serve client assets from public directory
    logger.info(`Serving client public assets from ${path.join(__dirname, '../client/public')}`);
    app.use(express.static(path.join(__dirname, '../client/public')));
    
    // Serve API documentation and other static files
    logger.info(`Serving static files from ${path.join(__dirname, '..')}`);
    app.use(express.static(path.join(__dirname, '..')));
    
    // Serve client src directory for development
    logger.info(`Serving client files from ${path.join(__dirname, '../client')}`);
    app.use('/client', express.static(path.join(__dirname, '../client')));
    
    // Handle all routes for the React app - this needs to come before more specific routes
    app.get(['/', '/system', '/insights', '/dashboard', '/agents', '/analytics', '/strategies', '/trading', '/wallet', '/ws-test', '/neural'], async (req, res, next) => {
      try {
        // Read the index.html from client directory
        let template = fs.readFileSync(path.join(__dirname, '../client/index.html'), 'utf-8');
        
        // Log the path being accessed
        logger.info(`Serving React app at path: ${req.path}`);
        
        // Return the index.html for client-side routing
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        logger.error(`Error serving React route ${req.path}:`, e);
        next(e);
      }
    });
    
    // Create a simple HTML page for testing
    app.get('/test-page', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Test Page</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #0f172a; color: #f1f5f9; }
              h1 { color: #38bdf8; }
              section { margin-bottom: 20px; padding: 15px; border: 1px solid #334155; border-radius: 8px; }
              button { padding: 8px 16px; margin: 5px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; }
              button:hover { background: #1d4ed8; }
              pre { background: #1e293b; padding: 10px; border-radius: 4px; overflow: auto; max-height: 300px; }
              .success { color: #4ade80; }
              .error { color: #f87171; }
              #wsStatus { padding: 10px; border-radius: 4px; margin-top: 10px; }
              .connected { background: rgba(74, 222, 128, 0.2); }
              .disconnected { background: rgba(248, 113, 113, 0.2); }
              #marketData { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px; }
              .card { background: #1e293b; padding: 15px; border-radius: 8px; }
              .card h3 { margin-top: 0; color: #38bdf8; }
              .positive { color: #4ade80; }
              .negative { color: #f87171; }
            </style>
          </head>
          <body>
            <h1>Solana Quantum Trading Platform - Test Page</h1>
            <p>This page provides testing tools for the trading platform with InstantNodes RPC integration.</p>
            <p>Server time: ${new Date().toISOString()}</p>
            
            <section>
              <h2>API Status</h2>
              <button onclick="testAPI()">Test API Health</button>
              <button onclick="testPriceFeed()">Test Price Feed</button>
              <pre id="apiResult">Results will appear here...</pre>
            </section>
            
            <section>
              <h2>WebSocket Connection</h2>
              <button onclick="connectWS()">Connect WebSocket</button>
              <button onclick="disconnectWS()">Disconnect WebSocket</button>
              <button onclick="sendPing()">Send Ping</button>
              <button onclick="requestMarketData()">Request Market Data</button>
              <div id="wsStatus" class="disconnected">WebSocket disconnected</div>
              <pre id="wsMessages">WebSocket messages will appear here...</pre>
            </section>
            
            <section>
              <h2>Market Data</h2>
              <div id="marketData">
                <div class="card">
                  <h3>SOL/USDC</h3>
                  <div>Loading...</div>
                </div>
                <div class="card">
                  <h3>BONK/USDC</h3>
                  <div>Loading...</div>
                </div>
                <div class="card">
                  <h3>JUP/USDC</h3>
                  <div>Loading...</div>
                </div>
              </div>
            </section>
            
            <section>
              <h2>Trading Test</h2>
              <button onclick="testTrade()">Test Trade Execution</button>
              <pre id="tradeResult">Trading results will appear here...</pre>
            </section>
            
            <script>
              let ws = null;
              const wsMessages = document.getElementById('wsMessages');
              const wsStatus = document.getElementById('wsStatus');
              const apiResult = document.getElementById('apiResult');
              const tradeResult = document.getElementById('tradeResult');
              const marketDataContainer = document.getElementById('marketData');
              
              // Market data storage
              const marketData = {
                'SOL/USDC': null,
                'BONK/USDC': null,
                'JUP/USDC': null
              };
              
              // Test API health
              async function testAPI() {
                try {
                  apiResult.textContent = 'Testing API...';
                  const response = await fetch('/api/health');
                  const data = await response.json();
                  apiResult.innerHTML = '<span class="success">Success!</span> ' + JSON.stringify(data, null, 2);
                } catch (error) {
                  apiResult.innerHTML = '<span class="error">Error:</span> ' + error.message;
                }
              }
              
              // Test price feed
              async function testPriceFeed() {
                try {
                  apiResult.textContent = 'Testing price feed...';
                  const response = await fetch('/api/price-feed/status');
                  const data = await response.json();
                  apiResult.innerHTML = '<span class="success">Success!</span> ' + JSON.stringify(data, null, 2);
                  
                  // Update market data display
                  if (data.data && data.data.pairData) {
                    updateMarketDataDisplay(data.data.pairData);
                  }
                } catch (error) {
                  apiResult.innerHTML = '<span class="error">Error:</span> ' + error.message;
                }
              }
              
              // Connect WebSocket
              function connectWS() {
                if (ws) {
                  wsMessages.textContent = 'Already connected. Disconnect first to reconnect.';
                  return;
                }
                
                try {
                  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                  const wsUrl = \`\${protocol}//\${window.location.host}/ws\`;
                  wsMessages.textContent = \`Connecting to \${wsUrl}...\`;
                  
                  ws = new WebSocket(wsUrl);
                  
                  ws.onopen = () => {
                    wsStatus.className = 'connected';
                    wsStatus.textContent = 'WebSocket connected';
                    wsMessages.textContent = 'Connected to WebSocket server\\n' + wsMessages.textContent;
                  };
                  
                  ws.onclose = (event) => {
                    wsStatus.className = 'disconnected';
                    wsStatus.textContent = \`WebSocket disconnected (code: \${event.code})\`;
                    wsMessages.textContent = \`Disconnected: \${event.reason || 'No reason provided'}\\n\` + wsMessages.textContent;
                    ws = null;
                  };
                  
                  ws.onerror = (error) => {
                    wsStatus.className = 'disconnected';
                    wsStatus.textContent = 'WebSocket error';
                    wsMessages.textContent = \`Error: \${error}\\n\` + wsMessages.textContent;
                  };
                  
                  ws.onmessage = (event) => {
                    const message = JSON.parse(event.data);
                    wsMessages.textContent = \`Received: \${JSON.stringify(message).substring(0, 150)}...\n\` + wsMessages.textContent;
                    
                    // Handle market data
                    if (message.type === 'MARKET_DATA' && message.data) {
                      if (message.data.pair && message.data.prices) {
                        // Single pair data
                        marketData[message.data.pair] = message.data;
                        updateMarketDataCard(message.data.pair, message.data);
                      } else if (message.data.pairs) {
                        // Multiple pairs
                        for (const pair in message.data.pairs) {
                          marketData[pair] = message.data.pairs[pair];
                          updateMarketDataCard(pair, message.data.pairs[pair]);
                        }
                      }
                    }
                  };
                } catch (error) {
                  wsMessages.textContent = \`Error connecting: \${error.message}\\n\` + wsMessages.textContent;
                }
              }
              
              // Disconnect WebSocket
              function disconnectWS() {
                if (!ws) {
                  wsMessages.textContent = 'Not connected.\\n' + wsMessages.textContent;
                  return;
                }
                
                try {
                  ws.close(1000, 'User initiated disconnect');
                  wsMessages.textContent = 'Closing connection...\\n' + wsMessages.textContent;
                } catch (error) {
                  wsMessages.textContent = \`Error disconnecting: \${error.message}\\n\` + wsMessages.textContent;
                }
              }
              
              // Send ping
              function sendPing() {
                if (!ws || ws.readyState !== WebSocket.OPEN) {
                  wsMessages.textContent = 'WebSocket not connected. Cannot send ping.\\n' + wsMessages.textContent;
                  return;
                }
                
                try {
                  const pingMessage = {
                    type: 'PING',
                    timestamp: new Date().toISOString()
                  };
                  ws.send(JSON.stringify(pingMessage));
                  wsMessages.textContent = \`Sent: \${JSON.stringify(pingMessage)}\\n\` + wsMessages.textContent;
                } catch (error) {
                  wsMessages.textContent = \`Error sending ping: \${error.message}\\n\` + wsMessages.textContent;
                }
              }
              
              // Request market data
              function requestMarketData() {
                if (!ws || ws.readyState !== WebSocket.OPEN) {
                  wsMessages.textContent = 'WebSocket not connected. Cannot request market data.\\n' + wsMessages.textContent;
                  return;
                }
                
                try {
                  const message = {
                    type: 'GET_MARKET_DATA',
                    pairs: ['SOL/USDC', 'BONK/USDC', 'JUP/USDC'],
                    timestamp: new Date().toISOString()
                  };
                  ws.send(JSON.stringify(message));
                  wsMessages.textContent = \`Sent market data request: \${JSON.stringify(message)}\\n\` + wsMessages.textContent;
                } catch (error) {
                  wsMessages.textContent = \`Error requesting market data: \${error.message}\\n\` + wsMessages.textContent;
                }
              }
              
              // Update market data display
              function updateMarketDataDisplay(pairData) {
                for (const pair in pairData) {
                  marketData[pair] = pairData[pair];
                  updateMarketDataCard(pair, pairData[pair]);
                }
              }
              
              // Update a single market data card
              function updateMarketDataCard(pair, data) {
                const card = marketDataContainer.querySelector(\`.card h3:contains("\${pair}")\`).closest('.card');
                if (!card || !data) return;
                
                let html = '';
                
                if (data.price) {
                  html += \`<div><strong>Price:</strong> \${data.price.toFixed(6)} USDC</div>\`;
                }
                
                if (data.priceChange24h) {
                  const changeClass = data.priceChange24h >= 0 ? 'positive' : 'negative';
                  const changeSign = data.priceChange24h >= 0 ? '+' : '';
                  html += \`<div><strong>24h Change:</strong> <span class="\${changeClass}">\${changeSign}\${(data.priceChange24h * 100).toFixed(2)}%</span></div>\`;
                }
                
                if (data.volume24h) {
                  html += \`<div><strong>24h Volume:</strong> \${data.volume24h.toLocaleString()} USDC</div>\`;
                }
                
                if (data.highPrice24h && data.lowPrice24h) {
                  html += \`<div><strong>24h Range:</strong> \${data.lowPrice24h.toFixed(6)} - \${data.highPrice24h.toFixed(6)}</div>\`;
                }
                
                if (data.lastUpdated) {
                  html += \`<div><strong>Updated:</strong> \${new Date(data.lastUpdated).toLocaleString()}</div>\`;
                }
                
                card.querySelector('div').innerHTML = html || 'No data available';
              }
              
              // Test trade execution
              async function testTrade() {
                try {
                  tradeResult.textContent = 'Executing test trade...';
                  
                  // First register a test wallet
                  const walletResponse = await fetch('/api/trade/wallet/connect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      walletAddress: 'dummyWalletAddressForTesting' + Math.floor(Math.random() * 1000000),
                      walletType: 'phantom'
                    })
                  });
                  
                  if (!walletResponse.ok) {
                    throw new Error(\`Wallet connection failed with status \${walletResponse.status}\`);
                  }
                  
                  const walletData = await walletResponse.json();
                  tradeResult.innerHTML = '<span class="success">Wallet connected:</span> ' + JSON.stringify(walletData, null, 2) + '\\n\\nExecuting trade...';
                  
                  // Execute a small test trade
                  const tradeResponse = await fetch('/api/trade/execute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      pair: 'SOL/USDC',
                      amount: '0.01',
                      type: 'BUY',
                      walletAddress: walletData.wallet.address,
                      dex: 'jupiter',
                      slippage: '1.0'
                    })
                  });
                  
                  const tradeData = await tradeResponse.json();
                  
                  if (tradeResponse.ok) {
                    tradeResult.innerHTML = '<span class="success">Trade executed successfully:</span>\\n' + JSON.stringify(tradeData, null, 2);
                  } else {
                    tradeResult.innerHTML = '<span class="error">Trade execution failed:</span>\\n' + JSON.stringify(tradeData, null, 2);
                  }
                } catch (error) {
                  tradeResult.innerHTML = '<span class="error">Error:</span> ' + error.message;
                }
              }
              
              // Helper to polyfill the :contains selector
              // This is needed because some browsers don't support :contains
              jQuery.expr[':'].contains = function(a, i, m) {
                return jQuery(a).text().toUpperCase().indexOf(m[3].toUpperCase()) >= 0;
              };
              
              // Automatically connect WebSocket and fetch initial data
              window.addEventListener('DOMContentLoaded', () => {
                // First test the API
                testAPI();
                
                // Then test the price feed after a short delay
                setTimeout(testPriceFeed, 1000);
                
                // Finally connect WebSocket after prices are loaded
                setTimeout(connectWS, 2000);
                
                // Set up regular polling for market data
                setInterval(testPriceFeed, 30000);
              });
            </script>
          </body>
        </html>
      `);
    });
    
    // Catch-all route to handle all other React routes
    app.get('*', async (req, res, next) => {
      // Only handle paths that look like frontend routes (not API or static assets)
      if (!req.path.startsWith('/api/') && 
          !req.path.includes('.') && 
          req.path !== '/health' && 
          req.path !== '/test-page') {
        try {
          // Read the index.html from client directory
          let template = fs.readFileSync(path.join(__dirname, '../client/index.html'), 'utf-8');
          
          // Log the path being accessed
          logger.info(`Serving React app at path: ${req.path}`);
          
          // Return the index.html for client-side routing
          res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
        } catch (e) {
          logger.error(`Error serving React route ${req.path}:`, e);
          next(e);
        }
      } else if (!req.path.startsWith('/api/') && req.path.includes('.')) {
        // This is likely a static file request that wasn't found
        logger.warn(`Static file not found: ${req.path}`);
        res.status(404).send('File not found');
      } else {
        // For any routes not handled, pass to the next middleware (which will 404)
        logger.warn(`Route not found: ${req.path}`);
        res.status(404).send('Not found');
      }
    });
    
    // Start HTTP server
    // Make sure to bind to 0.0.0.0 to allow external connections
    httpServer.listen(port, '0.0.0.0', () => {
      logger.info(`🚀 Server running on port ${port}`);
      logger.info(`💻 WebSocket server accessible at /ws endpoint`);
      logger.info(`🧪 Test page available at http://localhost:${port}/test-page`);
      
      // Print additional debugging information
      logger.info('🔍 DEBUG: Server details:');
      const addr = httpServer.address();
      if (addr && typeof addr === 'object') {
        logger.info(`- Server listening on ${addr.address}:${addr.port}`);
      } else if (addr && typeof addr === 'string') {
        logger.info(`- Server listening on pipe/socket: ${addr}`);
      } else {
        logger.info('- Server address not available');
      }
      logger.info(`- Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`- Replit URL: ${process.env.REPL_SLUG || 'Not in Replit'}`);
      logger.info(`- Process ID: ${process.pid}`);
      
      // Test reachability
      setTimeout(() => {
        const http = require('http');
        http.get(`http://localhost:${port}/health`, (res: any) => {
          let data = '';
          res.on('data', (chunk: any) => { data += chunk; });
          res.on('end', () => {
            logger.info(`✅ Self-test successful: ${data}`);
          });
        }).on('error', (err: Error) => {
          logger.error(`❌ Self-test failed: ${err.message}`);
        });
      }, 1000);
    });
  } catch (err: any) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Start the server
startServer();