const express = require('express');
const path = require('path');

const app = express();
const port = 3000;

// Serve static files from the client directory
app.use(express.static(path.join(__dirname, 'client')));

// API endpoint for testing
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from Solana Trading Platform API!' });
});

// Serve the app.html file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/public/app.html'));
});

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${port}`);
});