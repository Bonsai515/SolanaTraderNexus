#!/bin/bash

# Start the Solana Trading System
echo "Starting Solana Trading System with Quantum-Inspired Transformers..."

# Install Node.js dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing Node.js dependencies..."
    npm install
fi

# Check if client index.html exists
if [ ! -f "client/src/index.html" ]; then
    # Create directory if it doesn't exist
    mkdir -p client/src
    # Copy the index.html file if it exists in client directory
    if [ -f "client/index.html" ]; then
        echo "Copying index.html to client/src..."
        cp client/index.html client/src/
    fi
fi

# Start the Node.js server
echo "Starting Node.js server..."
node server/index.js