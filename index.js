const path = require('path');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Import main server app
const { app: serverApp } = require('./dist/server/index');

// Serve static files from the dist directory if they exist
app.use(express.static(path.join(__dirname, 'dist/client')));

// Mount the server app
app.use('/', serverApp);

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Solana Trading Platform running on port ${PORT}`);
});