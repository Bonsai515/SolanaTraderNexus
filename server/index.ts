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
  app.use(express.static('dist/client'));

  // Start server
  httpServer.listen(5000, '0.0.0.0', () => {
    console.log('🚀 Production server running on port 5000');
    console.log('💻 WebSocket server enabled');
  });
} else {
  // Development mode with Vite
  configureViteServer(app, httpServer).then(() => {
    httpServer.listen(port, '0.0.0.0', () => {
      console.log(`🚀 Development server running on port ${port}`);
      console.log(`💻 WebSocket server running at ws://0.0.0.0:${port}/ws`);
    });
  }).catch(err => {
    console.error('Failed to start server:', err);
  });
}