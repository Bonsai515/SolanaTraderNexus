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

// Configure Vite in development mode
configureViteServer(app, httpServer).then(() => {
  // Start the server
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
    console.log(`💻 WebSocket server running at ws://localhost:${port}/ws`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
});