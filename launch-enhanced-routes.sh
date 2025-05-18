#!/bin/bash

# Enhanced Trading Routes Launcher
echo "=========================================="
echo "🚀 LAUNCHING ENHANCED TRADING ROUTES"
echo "=========================================="

# Kill any running processes
pkill -f "node.*extreme-yield" || true
pkill -f "node.*octa-hop" || true

# Wait for processes to terminate
sleep 2

# Implement additional routes
npx tsx ./implement-additional-routes.ts

# Start enhanced strategy with additional routes
npx tsx ./src/extreme-yield-execution.ts &

echo "✅ Enhanced trading routes launched successfully"
echo "To monitor performance, run:"
echo "npx tsx octa-hop-profit-monitor.ts"
echo "=========================================="
