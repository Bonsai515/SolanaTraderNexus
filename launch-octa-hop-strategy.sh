#!/bin/bash

# Octa-Hop Optimized Strategy Launcher
echo "=========================================="
echo "🚀 LAUNCHING OCTA-HOP OPTIMIZED STRATEGY"
echo "=========================================="

# Kill any running processes
pkill -f "node.*extreme-yield" || true
pkill -f "node.*octa-hop" || true

# Wait for processes to terminate
sleep 2

# Apply Octa-Hop optimizations
npx tsx ./optimize-octa-hop-strategy.ts

# Start optimized extreme yield strategy
npx tsx ./src/extreme-yield-execution.ts &

echo "✅ Octa-Hop optimized strategy launched successfully"
echo "To monitor real-time profits, run:"
echo "npx tsx octa-hop-profit-monitor.ts"
echo "=========================================="
