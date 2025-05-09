#!/bin/bash

# Deployment script for Solana Quantum Trading Platform
echo "🚀 Deploying Solana Quantum Trading Platform..."

# Ensure we have the standalone HTML file as our index
echo "📄 Setting up HTML interface..."
if [ -f "standalone.html" ]; then
  cp standalone.html index.html
  echo "✅ Copied standalone.html to index.html"
else
  echo "⚠️ standalone.html not found, using existing index.html if available"
fi

# Check if we have a JavaScript fallback server
echo "🌐 Setting up server..."
if [ -f "static_server.js" ]; then
  echo "✅ Using JavaScript static file server"
  DEPLOY_METHOD="js"
elif [ -f "simple_server.py" ]; then
  echo "✅ Using Python static file server"
  DEPLOY_METHOD="py"
else
  echo "⚠️ No server found, creating minimal server"
  cat > minimal_server.js << 'EOF'
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5000;

// Simple static file server
http.createServer((req, res) => {
  console.log(req.url);
  
  let url = req.url;
  if (url === '/') url = '/index.html';
  
  const filePath = path.join(process.cwd(), url);
  
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (url.startsWith('/api/')) {
        // Handle API endpoints
        res.setHeader('Content-Type', 'application/json');
        
        if (url === '/api/health') {
          res.writeHead(200);
          res.end(JSON.stringify({ status: 'ok' }));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Not found' }));
        }
        return;
      }
      
      // Try index.html as fallback
      fs.readFile('./index.html', (err2, indexContent) => {
        if (err2) {
          res.writeHead(404);
          res.end('404 Not Found');
          return;
        }
        
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(indexContent);
      });
      return;
    }
    
    // Determine content type
    const ext = path.extname(url).toLowerCase();
    const contentTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg'
    };
    
    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
    res.end(content);
  });
}).listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
EOF
  DEPLOY_METHOD="minimal"
fi

echo "🔍 Checking deployment method: $DEPLOY_METHOD"
case $DEPLOY_METHOD in
  "js")
    echo "🚀 Starting JavaScript server"
    node static_server.js
    ;;
  "py")
    echo "🚀 Starting Python server"
    python3 simple_server.py
    ;;
  "minimal")
    echo "🚀 Starting minimal server"
    node minimal_server.js
    ;;
  *)
    echo "❌ Unknown deployment method"
    exit 1
    ;;
esac