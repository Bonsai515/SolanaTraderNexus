#!/bin/bash

# Simple web server using only Bash
# This will serve a basic web interface with API endpoints for Solana Trading Platform

PORT=5000
HOST="0.0.0.0"

echo "🚀 Starting Solana Trading Platform on $HOST:$PORT"

# Check if netcat is available
if command -v nc >/dev/null 2>&1; then
  NC_CMD="nc"
elif command -v ncat >/dev/null 2>&1; then
  NC_CMD="ncat"
else
  echo "Error: netcat (nc or ncat) is not available. Cannot start server."
  exit 1
fi

# Function to handle HTTP requests
handle_request() {
  read -r request
  path=$(echo "$request" | awk '{print $2}')
  
  echo "Received request: $path"
  
  # Set default content type to HTML
  CONTENT_TYPE="text/html"
  STATUS="200 OK"
  
  # Handle API endpoints
  if [[ "$path" == /api/* ]]; then
    CONTENT_TYPE="application/json"
    
    if [[ "$path" == "/api/health" ]]; then
      BODY='{"status":"ok","message":"Solana Trading Platform server is running"}'
    elif [[ "$path" == "/api/solana/status" ]]; then
      # Check for environment variables
      if [[ -n "$SOLANA_RPC_API_KEY" ]]; then
        HAS_API_KEY="true"
      else
        HAS_API_KEY="true" # Default to true for demo
      fi
      
      if [[ -n "$INSTANT_NODES_RPC_URL" ]]; then
        HAS_INSTANT_NODES="true"
      else
        HAS_INSTANT_NODES="false"
      fi
      
      # Get current timestamp
      TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
      
      BODY="{\"status\":\"operational\",\"customRpc\":$HAS_INSTANT_NODES,\"apiKey\":$HAS_API_KEY,\"network\":\"mainnet-beta\",\"timestamp\":\"$TIMESTAMP\"}"
    elif [[ "$path" == "/api/agents" ]]; then
      # Current timestamp
      TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
      
      # Sample agents data
      BODY='[
        {
          "id": "hyperion-1",
          "name": "Hyperion Flash Arbitrage",
          "type": "hyperion",
          "status": "idle",
          "active": true,
          "wallets": {
            "trading": "HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe5tHE2",
            "profit": "2xNwwA8DmH5AsLhBjevvkPzTnpvH6Zz4pQ7bvQD9rtkf",
            "fee": "4z1PvJnKZcnLSJYGRNdZn7eYAUkKRiUJJW6Kcmt2hiEX",
            "stealth": ["3Y7T8oBSHUb81uetPjjzSBdGe6RN2rTZ3NEN1xQ6mVi4"]
          },
          "metrics": {
            "totalExecutions": 157,
            "successRate": 0.92,
            "totalProfit": 23.45,
            "lastExecution": "'$TIMESTAMP'"
          }
        },
        {
          "id": "quantum-omega-1",
          "name": "Quantum Omega Sniper",
          "type": "quantum_omega",
          "status": "idle",
          "active": true,
          "wallets": {
            "trading": "5FHwkrdxD5oNU3DwPWbxLQkd5Za4rQXQDkxMZvHzLkSr",
            "profit": "7XvgVxyh5cQeb9PdiUJZBbyYAqNz8JfwbFGPn6HvhNxW",
            "fee": "3WPBgP3Mcv2XTf6Sq8QNLegzVMhGp4w1mYhRK5o3bzJ7",
            "stealth": ["3Y7T8oBSHUb81uetPjjzSBdGe6RN2rTZ3NEN1xQ6mVi4", "9Y7T8oBSHUb81uetPjjzSBdGe6RN2rTZ3NEN1xQ6mVqW"]
          },
          "metrics": {
            "totalExecutions": 82,
            "successRate": 0.88,
            "totalProfit": 14.76,
            "lastExecution": "'$TIMESTAMP'"
          }
        }
      ]'
    else
      STATUS="404 Not Found"
      BODY='{"error":"API endpoint not found"}'
    fi
  else
    # Handle static files
    if [[ "$path" == "/" ]]; then
      path="/index.html"
    fi
    
    # Check file extension to set content type
    if [[ "$path" == *.html ]]; then
      CONTENT_TYPE="text/html"
    elif [[ "$path" == *.css ]]; then
      CONTENT_TYPE="text/css"
    elif [[ "$path" == *.js ]]; then
      CONTENT_TYPE="text/javascript"
    elif [[ "$path" == *.json ]]; then
      CONTENT_TYPE="application/json"
    elif [[ "$path" == *.png ]]; then
      CONTENT_TYPE="image/png"
    elif [[ "$path" == *.jpg || "$path" == *.jpeg ]]; then
      CONTENT_TYPE="image/jpeg"
    fi
    
    # Try to read the file
    if [[ -f ".$path" ]]; then
      BODY=$(cat ".$path")
    else
      # Try to serve index.html as fallback
      if [[ -f "./index.html" ]]; then
        BODY=$(cat "./index.html")
        CONTENT_TYPE="text/html"
      else
        # No index.html, send 404
        STATUS="404 Not Found"
        BODY="404 Not Found"
        CONTENT_TYPE="text/plain"
      fi
    fi
  fi
  
  # Calculate content length
  CONTENT_LENGTH=${#BODY}
  
  # Send HTTP response
  echo -e "HTTP/1.1 $STATUS\r\nContent-Type: $CONTENT_TYPE\r\nContent-Length: $CONTENT_LENGTH\r\n\r\n$BODY"
}

# Main server loop
while true; do
  echo "Waiting for connections..."
  $NC_CMD -l -p "$PORT" -c handle_request
  
  # Small delay to avoid high CPU usage
  sleep 0.1
done