#!/bin/bash
# Restart with Rate Limit Fix

echo "========================================"
echo "    RESTARTING WITH RATE LIMIT FIX     "
echo "========================================"

# Stop running processes
echo "Stopping current processes..."
pkill -f "ts-node" || true
pkill -f "npx tsx" || true
pkill -f "activate-" || true
sleep 2

# Export environment variables
export RATE_LIMIT_FIX=true
export USE_INSTANT_NODES=false
export MAX_REQUESTS_PER_SECOND=10
export USE_AGGRESSIVE_CACHING=true

# Start system
echo "Starting system with rate limit fix..."
npx tsx activate-live-trading.ts

echo "System restarted with rate limit fix"
echo "========================================"
