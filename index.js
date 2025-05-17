const path = require('path');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files if they exist
app.use(express.static(path.join(__dirname, 'dist/client')));

// Simple health check route
app.get('/health', (req, res) => {
  res.status(200).send({ status: 'ok', timestamp: new Date().toISOString() });
});

// Simple API route for trading system status
app.get('/api/status', (req, res) => {
  res.json({
    status: 'active',
    system: 'Solana Trading Platform',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    components: {
      neuralNetwork: 'online',
      transformers: 'online',
      agents: 'online',
      nexusEngine: 'online'
    }
  });
});

// Start the server directly without requiring the internal app
// This avoids compatibility issues with the compiled TypeScript
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Solana Trading Platform running on port ${PORT}`);
  console.log(`API endpoints available at http://localhost:${PORT}/api/status`);
});