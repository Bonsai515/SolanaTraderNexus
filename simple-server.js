// No-dependency HTTP server for Solana Trading Platform
const http = require('http');
const fs = require('fs');
const path = require('path');

// Define MIME types for different file extensions
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Create a server
const server = http.createServer((req, res) => {
  console.log('Request URL:', req.url);
  
  // Handle API endpoints
  if (req.url.startsWith('/api/')) {
    return handleApiRequest(req, res);
  }
  
  // Normalize URL path to get the file path
  let filePath = '.' + req.url;
  if (filePath === './') {
    filePath = './index.html';
  }
  
  // Get file extension
  const extname = path.extname(filePath);
  const contentType = mimeTypes[extname] || 'application/octet-stream';
  
  // Read the file
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // File not found, try to serve index.html instead
        fs.readFile('./index.html', (err, indexContent) => {
          if (err) {
            res.writeHead(404);
            res.end('404 Not Found');
            return;
          }
          
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(indexContent, 'utf-8');
        });
      } else {
        // Some server error
        res.writeHead(500);
        res.end('500 Server Error: ' + error.code);
      }
    } else {
      // Success
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Handle API requests
function handleApiRequest(req, res) {
  res.setHeader('Content-Type', 'application/json');
  
  if (req.url === '/api/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', message: 'Solana Trading Platform server is running' }));
  } 
  else if (req.url === '/api/solana/status') {
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
  }
  else if (req.url === '/api/agents') {
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
  }
  else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'API endpoint not found' }));
  }
}

// Listen on port 5000 to match Replit's expected port
const port = 5000;
server.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${port}`);
});