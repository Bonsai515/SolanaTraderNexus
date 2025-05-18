#!/bin/bash

# Optimized Extreme Yield Strategy Launcher
echo "=========================================="
echo "🚀 LAUNCHING OPTIMIZED EXTREME YIELD STRATEGY"
echo "=========================================="

# Kill any running processes
pkill -f "node.*money-glitch" || true
pkill -f "node.*extreme-yield" || true

# Wait for processes to terminate
sleep 2

# Apply optimized configuration
npx tsx ./optimize-extreme-strategy.ts

# Start optimized extreme yield strategy
npx tsx ./src/extreme-yield-execution.ts &

echo "✅ Optimized extreme yield strategy launched successfully"
echo "To monitor performance, run:"
echo "npx tsx optimized-extreme-yield-monitor.ts"
echo "=========================================="
