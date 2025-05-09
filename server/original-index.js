const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const routes = require('./routes');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 5000;

// Enable JSON parsing
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Set up WebSocket server
const wss = routes.setupWebSocketServer(server);

// API routes
app.use('/api', routes);

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`[DEBUG] Received request: ${req.method} ${req.url}`);
  next();
});

// Serve static files from client directory
console.log(`[DEBUG] Setting up static directory: ${path.join(__dirname, '../client')}`);
app.use(express.static(path.join(__dirname, '../client')));

// Check if index.html exists
const indexHtmlPath = path.join(__dirname, '../client/index.html');
if (fs.existsSync(indexHtmlPath)) {
  console.log(`[DEBUG] index.html exists at ${indexHtmlPath}`);
} else {
  console.log(`[DEBUG] index.html does NOT exist at ${indexHtmlPath}`);
}

// Special route for our app.html
app.get('/app', (req, res) => {
  console.log(`[DEBUG] Serving app.html for path: /app`);
  res.sendFile(path.join(__dirname, '../client/public/app.html'));
});

// Fallback route - serve index.html for all other routes
app.get('*', (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
    return next();
  }
  
  // Try to serve app.html if it's the root path
  if (req.path === '/') {
    console.log(`[DEBUG] Redirecting to /app for root path`);
    return res.redirect('/app');
  }
  
  console.log(`[DEBUG] Serving index.html for path: ${req.path}`);
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Start the server
server.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Solana Trading Platform server running on port ${port}`);
  console.log(`💻 WebSocket server accessible at /ws endpoint`);
  console.log(`📂 Serving static files from: ${path.join(__dirname, '../client')}`);
  console.log(`🔗 Server URL: http://localhost:${port}`);
});