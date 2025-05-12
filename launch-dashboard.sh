#!/bin/bash

# Hyperion Trading System Dashboard Launcher
# This script automatically selects the best dashboard version based on system capabilities

echo "🚀 Hyperion Trading System Dashboard Launcher"
echo "----------------------------------------------"

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

# Check if the server is running
if ! curl -s http://localhost:5000/api/health &> /dev/null; then
  echo "⚠️ Warning: Trading server doesn't appear to be running"
  echo "Make sure to start the trading server before using the dashboard"
  
  # Ask if user wants to continue anyway
  read -p "Continue anyway? (y/n): " continue_answer
  if [[ ! "$continue_answer" =~ ^[Yy]$ ]]; then
    echo "Exiting. Start the server and try again."
    exit 1
  fi
fi

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

# Show this when dashboard exits
echo ""
echo "Dashboard stopped. Run ./launch-dashboard.sh to restart."