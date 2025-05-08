import express from 'express';
import { createServer } from 'http';
import * as path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import routes from './routes';
import storage from './storage';
import { configureViteServer } from './vite';

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for API requests
app.use(cors());
app.use(express.json());

// API routes
app.use('/api', routes);

// Create HTTP server
const httpServer = createServer(app);

// Set up WebSocket server on same HTTP server but different path
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  
  ws.on('message', (message) => {
    console.log('Received message:', message.toString());
    
    // Echo back for now - we'll add actual trading functionality later
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ 
        type: 'ECHO', 
        message: message.toString() 
      }));
    }
  });
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
  
  // Send initial connection message
  ws.send(JSON.stringify({ 
    type: 'CONNECT', 
    message: 'Connected to Solana Trading Platform',
    timestamp: new Date().toISOString()
  }));
});

// Configure Vite in development mode
configureViteServer(app, httpServer).then(() => {
  // Start the server
  httpServer.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
    console.log(`💻 WebSocket server running at ws://localhost:${port}/ws`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
});