import express from 'express';
import { createServer } from 'http';
import * as path from 'path';
import { WebSocket } from 'ws';
import cors from 'cors';
import routes, { setupWebSocketServer } from './routes';
import storage from './storage';
import { logger } from './logger';
import net from 'net';

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

// API routes - register with '/api' prefix
app.use('/api', routes);

// Add a root endpoint
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Solana Quantum Trading Platform</title>
        <style>
          body { font-family: Arial, sans-serif; background: #0f172a; color: white; padding: 20px; }
          h1 { color: #38bdf8; }
          .card { background: #1e293b; padding: 20px; border-radius: 8px; margin: 20px 0; }
          button { background: #3b82f6; color: white; border: none; padding: 10px 20px; 
                  border-radius: 4px; cursor: pointer; }
          pre { background: #0f172a; padding: 10px; border-radius: 4px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <h1>Solana Quantum Trading Platform</h1>
        <div class="card">
          <h2>Server Status</h2>
          <p>Server time: ${new Date().toISOString()}</p>
          <button onclick="fetch('/api/health').then(r=>r.json()).then(d=>{
            document.getElementById('result').textContent = JSON.stringify(d, null, 2);
          })">Check API Health</button>
          <pre id="result"></pre>
        </div>
        <div class="card">
          <h2>Test Data</h2>
          <button onclick="fetch('/api/test/populate-price-feed', {method:'POST'})
            .then(r=>r.json()).then(d=>{
              document.getElementById('test-result').textContent = JSON.stringify(d, null, 2);
            })">Populate Test Data</button>
          <pre id="test-result"></pre>
        </div>
      </body>
    </html>
  `);
});

// Add a health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

// Set up WebSocket server using our enhanced implementation
const wss = setupWebSocketServer(httpServer);

// Main function to start the server
async function startServer() {
  try {
    // Find an available port
    const port = await findAvailablePort(preferredPort);
    
    // Serve static files from the root directory where index.html is located
    logger.info(`Serving static files from ${path.join(__dirname, '..')}`);
    app.use(express.static(path.join(__dirname, '..')));
    
    // Serve client files 
    logger.info(`Serving client files from ${path.join(__dirname, '../client')}`);
    app.use('/client', express.static(path.join(__dirname, '../client')));
    
    // Handle all routes for the React app - this needs to come before more specific routes
    app.get(['/system', '/insights', '/dashboard', '/agents', '/analytics', '/strategies', '/trading', '/wallet'], (req, res) => {
      res.sendFile(path.join(__dirname, '../client/index.html'));
    });
    
    // Create a simple HTML page for testing
    app.get('/test-page', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Test Page</title></head>
          <body>
            <h1>Server is running!</h1>
            <p>This is a test page to verify that the server is accessible.</p>
            <p>Server time: ${new Date().toISOString()}</p>
            <button onclick="fetch('/api/health').then(r=>r.json()).then(d=>alert(JSON.stringify(d)))">
              Test API Call
            </button>
          </body>
        </html>
      `);
    });
    
    // Catch-all route to handle all other React routes
    app.get('*', (req, res) => {
      // Only handle paths that look like frontend routes (not API or static assets)
      if (!req.path.startsWith('/api/') && 
          !req.path.includes('.') && 
          req.path !== '/health' && 
          req.path !== '/test-page') {
        res.sendFile(path.join(__dirname, '../client/index.html'));
      } else {
        // For any routes not handled, pass to the next middleware (which will 404)
        res.status(404).send('Not found');
      }
    });
    
    // Start HTTP server
    httpServer.listen(port, '0.0.0.0', () => {
      logger.info(`🚀 Server running on port ${port}`);
      logger.info(`💻 WebSocket server accessible at /ws endpoint`);
      logger.info(`🧪 Test page available at http://localhost:${port}/test-page`);
      
      // Print additional debugging information
      logger.info('🔍 DEBUG: Server details:');
      logger.info(`- Server address: ${httpServer.address()}`);
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