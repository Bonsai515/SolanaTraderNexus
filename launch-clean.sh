#!/bin/bash
# Clean System Launch Script
# Launches the system with all Instant Nodes references removed

echo "========================================"
echo "   LAUNCHING CLEAN SYSTEM               "
echo "   (NO INSTANT NODES, NO COINGECKO)     "
echo "========================================"

# Kill all running processes
pkill -f "ts-node" || true
pkill -f "tsx" || true
pkill -f "node" || true
pkill -f "npm" || true
sleep 3

# Load clean environment
export $(cat .env.clean | xargs)

# Start with premium RPC configuration
echo "Launching clean system..."
npx tsx activate-live-trading.ts

echo "Clean system launched"
echo "========================================