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

// Root endpoint - serve the React application 
// Let Vite middleware handle serving the index.html in development
app.get('/', (req, res, next) => {
  // We'll let the middleware chain continue so Vite can handle it
  logger.info(`Serving React app at path: / (letting middleware handle it)`);
  next();
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
    app.get(['/system', '/insights', '/dashboard', '/agents', '/analytics', '/strategies', '/trading', '/wallet'], async (req, res, next) => {
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