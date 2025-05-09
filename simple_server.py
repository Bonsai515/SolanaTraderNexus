#!/usr/bin/env python3
"""
Simple HTTP Server for Solana Trading Platform
Compatible with Python 3.x
"""

import http.server
import socketserver
import json
import os
import time
from urllib.parse import urlparse, parse_qs

# Default port to listen on
PORT = int(os.environ.get('PORT', 5000))

class SolanaHandler(http.server.SimpleHTTPRequestHandler):
    """Custom handler for Solana Trading Platform"""
    
    def do_GET(self):
        """Handle GET requests"""
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        
        print(f"Request received: {path}")
        
        # Handle API endpoints
        if path.startswith('/api/'):
            self.handle_api(path)
            return
            
        # Serve static files (default case)
        if path == '/':
            path = '/index.html'
            
        try:
            # Try to open the file
            with open('.' + path, 'rb') as file:
                self.send_response(200)
                
                # Set content type based on file extension
                if path.endswith('.html'):
                    self.send_header('Content-type', 'text/html')
                elif path.endswith('.css'):
                    self.send_header('Content-type', 'text/css')
                elif path.endswith('.js'):
                    self.send_header('Content-type', 'text/javascript')
                elif path.endswith('.json'):
                    self.send_header('Content-type', 'application/json')
                elif path.endswith(('.jpg', '.jpeg')):
                    self.send_header('Content-type', 'image/jpeg')
                elif path.endswith('.png'):
                    self.send_header('Content-type', 'image/png')
                else:
                    self.send_header('Content-type', 'application/octet-stream')
                    
                self.end_headers()
                self.wfile.write(file.read())
        except FileNotFoundError:
            # If file not found, try to serve index.html
            try:
                with open('./index.html', 'rb') as file:
                    self.send_response(200)
                    self.send_header('Content-type', 'text/html')
                    self.end_headers()
                    self.wfile.write(file.read())
            except FileNotFoundError:
                # If index.html not found, send 404
                self.send_response(404)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                self.wfile.write(b'404 Not Found')
    
    def handle_api(self, path):
        """Handle API endpoints"""
        self.send_header('Content-type', 'application/json')
        
        if path == '/api/health':
            self.send_response(200)
            self.end_headers()
            response = {
                'status': 'ok',
                'message': 'Solana Trading Platform server is running'
            }
            self.wfile.write(json.dumps(response).encode())
            
        elif path == '/api/solana/status':
            self.send_response(200)
            self.end_headers()
            # Check for API keys in environment
            has_api_key = 'SOLANA_RPC_API_KEY' in os.environ
            has_instant_nodes = 'INSTANT_NODES_RPC_URL' in os.environ
            
            response = {
                'status': 'operational',
                'customRpc': has_instant_nodes,
                'apiKey': has_api_key or True,  # Default to True for demo
                'network': 'mainnet-beta',
                'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime())
            }
            self.wfile.write(json.dumps(response).encode())
            
        elif path == '/api/agents':
            self.send_response(200)
            self.end_headers()
            # Sample agents data
            agents = [
                {
                    'id': 'hyperion-1',
                    'name': 'Hyperion Flash Arbitrage',
                    'type': 'hyperion',
                    'status': 'idle',
                    'active': True,
                    'wallets': {
                        'trading': 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe5tHE2',
                        'profit': '2xNwwA8DmH5AsLhBjevvkPzTnpvH6Zz4pQ7bvQD9rtkf',
                        'fee': '4z1PvJnKZcnLSJYGRNdZn7eYAUkKRiUJJW6Kcmt2hiEX',
                        'stealth': ['3Y7T8oBSHUb81uetPjjzSBdGe6RN2rTZ3NEN1xQ6mVi4']
                    },
                    'metrics': {
                        'totalExecutions': 157,
                        'successRate': 0.92,
                        'totalProfit': 23.45,
                        'lastExecution': time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime())
                    }
                },
                {
                    'id': 'quantum-omega-1',
                    'name': 'Quantum Omega Sniper',
                    'type': 'quantum_omega',
                    'status': 'idle',
                    'active': True,
                    'wallets': {
                        'trading': '5FHwkrdxD5oNU3DwPWbxLQkd5Za4rQXQDkxMZvHzLkSr',
                        'profit': '7XvgVxyh5cQeb9PdiUJZBbyYAqNz8JfwbFGPn6HvhNxW',
                        'fee': '3WPBgP3Mcv2XTf6Sq8QNLegzVMhGp4w1mYhRK5o3bzJ7',
                        'stealth': ['3Y7T8oBSHUb81uetPjjzSBdGe6RN2rTZ3NEN1xQ6mVi4', '9Y7T8oBSHUb81uetPjjzSBdGe6RN2rTZ3NEN1xQ6mVqW']
                    },
                    'metrics': {
                        'totalExecutions': 82,
                        'successRate': 0.88,
                        'totalProfit': 14.76,
                        'lastExecution': time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime())
                    }
                }
            ]
            self.wfile.write(json.dumps(agents).encode())
            
        else:
            self.send_response(404)
            self.end_headers()
            response = {'error': 'API endpoint not found'}
            self.wfile.write(json.dumps(response).encode())

def main():
    """Start the server"""
    handler = SolanaHandler
    
    with socketserver.TCPServer(("0.0.0.0", PORT), handler) as httpd:
        print(f"🚀 Server running on port {PORT}")
        httpd.serve_forever()

if __name__ == "__main__":
    main()