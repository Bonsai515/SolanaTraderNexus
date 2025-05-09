const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 8080;

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname)));

// Root endpoint - Dashboard
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Solana Quantum Trading Platform</title>
        <style>
          body { font-family: Arial, sans-serif; background: #0f172a; color: white; padding: 20px; }
          h1 { color: #38bdf8; }
          .card { background: #1e293b; padding: 20px; border-radius: 8px; margin: 20px 0; }
          button { background: #3b82f6; color: white; border: none; padding: 10px 20px; 
                  border-radius: 4px; cursor: pointer; margin: 5px; }
          button:hover { background: #2563eb; }
          pre { background: #0f172a; padding: 10px; border-radius: 4px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <h1>Solana Quantum Trading Platform</h1>
        <div class="card">
          <h2>Server Status</h2>
          <p>Server time: ${new Date().toISOString()}</p>
          <p>This standalone web server is working correctly.</p>
          
          <button onclick="checkAPI()">Check Main API (Port 5000)</button>
          <pre id="result">Click the button to check API status</pre>
        </div>
        
        <div class="card">
          <h2>Connection Tests</h2>
          <button onclick="testAPIHealth()">Test API Health</button>
          <button onclick="testMarketData()">Get Market Data</button>
          <button onclick="populateTestData()">Populate Test Data</button>
          <pre id="test-result"></pre>
        </div>
        
        <script>
          // Test the main API health
          async function checkAPI() {
            const resultEl = document.getElementById('result');
            resultEl.textContent = 'Checking API connection...';
            
            try {
              const resp = await fetch('http://localhost:5000/api/health');
              const data = await resp.json();
              resultEl.textContent = JSON.stringify(data, null, 2);
            } catch (error) {
              resultEl.textContent = 'Error: ' + error.message;
            }
          }
          
          // Test API health endpoint
          async function testAPIHealth() {
            const resultEl = document.getElementById('test-result');
            resultEl.textContent = 'Testing API health...';
            
            try {
              const resp = await fetch('http://localhost:5000/api/health');
              const data = await resp.json();
              resultEl.textContent = JSON.stringify(data, null, 2);
            } catch (error) {
              resultEl.textContent = 'API Health Test Error: ' + error.message;
            }
          }
          
          // Test market data endpoint
          async function testMarketData() {
            const resultEl = document.getElementById('test-result');
            resultEl.textContent = 'Getting market data...';
            
            try {
              const resp = await fetch('http://localhost:5000/api/price-feed/status');
              const data = await resp.json();
              resultEl.textContent = JSON.stringify(data, null, 2);
            } catch (error) {
              resultEl.textContent = 'Market Data Test Error: ' + error.message;
            }
          }
          
          // Populate test data
          async function populateTestData() {
            const resultEl = document.getElementById('test-result');
            resultEl.textContent = 'Populating test data...';
            
            try {
              const resp = await fetch('http://localhost:5000/api/test/populate-price-feed', {
                method: 'POST'
              });
              const data = await resp.json();
              resultEl.textContent = JSON.stringify(data, null, 2);
            } catch (error) {
              resultEl.textContent = 'Populate Test Data Error: ' + error.message;
            }
          }
        </script>
      </body>
    </html>
  `);
});

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'web-server.js',
    timestamp: new Date().toISOString()
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Web server running at http://localhost:${port}`);
  console.log(`This server runs independently of our main API server`);
});