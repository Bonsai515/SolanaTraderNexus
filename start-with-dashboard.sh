#!/bin/bash

# Hyperion Trading System with Dashboard
# This script starts both the trading system and the monitoring dashboard

echo "🚀 Starting Hyperion Trading System with Dashboard"
echo "=================================================="

# Create logs directory if it doesn't exist
mkdir -p ./logs

# Function to check if a command exists
command_exists() {
  command -v "$1" &> /dev/null
}

# Check for Node.js
if ! command_exists node; then
  echo "❌ Error: Node.js is required but not installed"
  echo "Please install Node.js from https://nodejs.org/"
  exit 1
fi

# Start the server in the background
echo "📡 Starting trading server..."
npm run dev &
SERVER_PID=$!

echo "⏳ Waiting for server to start (10 seconds)..."
sleep 10

# Check if server is running
if ! curl -s http://localhost:5000/api/health &> /dev/null; then
  echo "⚠️ Warning: Trading server may not have started correctly."
  echo "Continuing anyway, but the dashboard might not work properly."
  echo ""
  echo "Server logs:"
  tail -n 10 ./logs/server.log
else
  echo "✅ Trading server started successfully"
fi

echo ""
echo "📊 Starting dashboard..."

# Decide which dashboard to use
if command_exists ts-node; then
  echo "✅ TypeScript support detected - launching full dashboard"
  echo ""
  echo "Launching dashboard in 3 seconds (press Ctrl+C to exit)"
  sleep 3
  ts-node system-dashboard.ts
elif command_exists npx; then
  echo "✅ NPX detected - trying to use TypeScript dashboard with npx"
  echo ""
  echo "Launching dashboard in 3 seconds (press Ctrl+C to exit)"
  sleep 3
  npx ts-node system-dashboard.ts
else
  echo "ℹ️ TypeScript not detected - launching simplified dashboard"
  echo ""
  echo "Launching dashboard in 3 seconds (press Ctrl+C to exit)"
  sleep 3
  node simple-dashboard.js
fi

# This will run when the dashboard is closed
echo ""
echo "Dashboard closed."
echo "Trading server is still running with PID: $SERVER_PID"
echo "To stop the server, run: kill $SERVER_PID"