#!/bin/bash

# Extreme Yield Strategy Launcher
echo "=========================================="
echo "🚀 LAUNCHING EXTREME YIELD STRATEGY"
echo "=========================================="

# Kill any running processes
pkill -f "node.*money-glitch" || true
pkill -f "node.*extreme-yield" || true

# Wait for processes to terminate
sleep 2

# Start extreme yield strategy
npx tsx ./src/extreme-yield-execution.ts &

echo "✅ Extreme yield strategy launched successfully"
echo "To monitor performance, run:"
echo "npx tsx extreme-yield-monitor.ts"
echo "=========================================="
