import express from 'express';
import { createServer } from 'http';
import * as path from 'path';
import { WebSocket } from 'ws';
import cors from 'cors';
import routes, { setupWebSocketServer } from './routes';
import storage from './storage';
import { configureViteServer } from './vite';
import { logger } from './logger';

const app = express();
const port = process.env.PORT || 5000;

// Enable CORS for API requests
app.use(cors());
app.use(express.json());

// API routes
app.use('/api', routes);

// Create HTTP server
const httpServer = createServer(app);

// Set up WebSocket server using our enhanced implementation
const wss = setupWebSocketServer(httpServer);

// Configure server based on environment
if (process.env.NODE_ENV === 'production') {
  // Serve static files in production
  app.use(express.static(path.join(__dirname, '../dist/client')));
  
  // Ensure client-side routing works
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/client/index.html'));
  });

  // Start server
  const port = process.env.PORT || 5000;
  httpServer.listen(port, '0.0.0.0', () => {
    logger.info(`🚀 Production server running on port ${port}`);
    logger.info('💻 WebSocket server enabled');
  });
} else {
  // Development mode with Vite
  configureViteServer(app, httpServer).then(() => {
    httpServer.listen(port, '0.0.0.0', () => {
      logger.info(`🚀 Development server running on port ${port}`);
      logger.info(`💻 WebSocket server running at ws://0.0.0.0:${port}/ws`);
    });
  }).catch(err => {
    logger.error('Failed to start server:', err);
  });
}