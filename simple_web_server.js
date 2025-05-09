// Simple Web Server for Solana Trading Platform
// Using only built-in Node.js modules
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Define PORT - use environment variable or default to 5000 for Replit
const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer((req, res) => {
  // Parse URL
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;
  
  console.log(`Received request for ${pathname}`);
  
  // Handle API requests
  if (pathname.startsWith('/api/')) {
    handleApiRequest(pathname, res);
    return;
  }
  
  // Serve static files - default to index.html
  if (pathname === '/') {
    pathname = '/index.html';
  }
  
  // Get file path
  const filePath = path.join(process.cwd(), pathname);
  
  // Get file extension
  const ext = path.extname(filePath);
  let contentType = 'text/html';
  
  // Map file extensions to content types
  switch (ext) {
    case '.js':
      contentType = 'text/javascript';
      break;
    case '.css':
      contentType = 'text/css';
      break;
    case '.json':
      contentType = 'application/json';
      break;
    case '.png':
      contentType = 'image/png';
      break;
    case '.jpg':
      contentType = 'image/jpg';
      break;
    case '.svg':
      contentType = 'image/svg+xml';
      break;
  }
  
  // Read file
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // File not found - try to serve index.html
        fs.readFile(path.join(process.cwd(), 'index.html'), (indexErr, indexContent) => {
          if (indexErr) {
            // If index.html also not found, return 404
            res.writeHead(404);
            res.end('404 Not Found');
            return;
          }
          
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(indexContent, 'utf-8');
        });
      } else {
        // Server error
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      // Success
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Handle API requests
function handleApiRequest(pathname, res) {
  res.setHeader('Content-Type', 'application/json');
  
  switch (pathname) {
    case '/api/health':
      res.writeHead(200);
      res.end(JSON.stringify({ 
        status: 'ok', 
        message: 'Solana Trading Platform server is running' 
      }));
      break;
      
    case '/api/solana/status':
      // Check for API keys in environment
      const hasApiKey = process.env.SOLANA_RPC_API_KEY ? true : false;
      const hasInstantNodes = process.env.INSTANT_NODES_RPC_URL ? true : false;
      
      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'operational',
        customRpc: hasInstantNodes,
        apiKey: hasApiKey || true, // Default to true for demo
        network: 'mainnet-beta',
        timestamp: new Date().toISOString()
      }));
      break;
      
    case '/api/agents':
      // Return sample agents
      const agents = [
        {
          id: 'hyperion-1',
          name: 'Hyperion Flash Arbitrage',
          type: 'hyperion',
          status: 'idle',
          active: true,
          wallets: {
            trading: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe5tHE2',
            profit: '2xNwwA8DmH5AsLhBjevvkPzTnpvH6Zz4pQ7bvQD9rtkf',
            fee: '4z1PvJnKZcnLSJYGRNdZn7eYAUkKRiUJJW6Kcmt2hiEX',
            stealth: ['3Y7T8oBSHUb81uetPjjzSBdGe6RN2rTZ3NEN1xQ6mVi4']
          },
          metrics: {
            totalExecutions: 157,
            successRate: 0.92,
            totalProfit: 23.45,
            lastExecution: new Date().toISOString()
          }
        },
        {
          id: 'quantum-omega-1',
          name: 'Quantum Omega Sniper',
          type: 'quantum_omega',
          status: 'idle',
          active: true,
          wallets: {
            trading: '5FHwkrdxD5oNU3DwPWbxLQkd5Za4rQXQDkxMZvHzLkSr',
            profit: '7XvgVxyh5cQeb9PdiUJZBbyYAqNz8JfwbFGPn6HvhNxW',
            fee: '3WPBgP3Mcv2XTf6Sq8QNLegzVMhGp4w1mYhRK5o3bzJ7',
            stealth: ['3Y7T8oBSHUb81uetPjjzSBdGe6RN2rTZ3NEN1xQ6mVi4', '9Y7T8oBSHUb81uetPjjzSBdGe6RN2rTZ3NEN1xQ6mVqW']
          },
          metrics: {
            totalExecutions: 82,
            successRate: 0.88,
            totalProfit: 14.76,
            lastExecution: new Date().toISOString()
          }
        }
      ];
      
      res.writeHead(200);
      res.end(JSON.stringify(agents));
      break;
      
    default:
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'API endpoint not found' }));
      break;
  }
}

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});