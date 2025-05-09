const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Serve static files from the root directory
app.use(express.static(__dirname));

// Serve the index.html file at the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'simple-web-server',
    timestamp: new Date().toISOString()
  });
});

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`Simple web server running at http://localhost:${port}`);
});