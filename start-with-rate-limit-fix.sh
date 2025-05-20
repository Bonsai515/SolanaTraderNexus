#!/bin/bash
# Restart trading system with rate limit fix

echo "========================================"
echo "    RESTARTING TRADING SYSTEM          "
echo "    WITH RATE LIMIT FIX                "
echo "========================================"
echo

# Stop running processes
echo "Stopping current trading system..."
pkill -f "ts-node" || true
pkill -f "npx tsx" || true
pkill -f "strategy.ts" || true
sleep 2

# Set up environment
export USE_RATE_LIMIT_FIX=true
export USE_AGGRESSIVE_CACHING=true
export DISABLE_INSTANT_NODES=true  # Disable the exhausted InstantNodes provider

# Start system with rate limit fix
echo "Starting trading system with rate limit fix..."
npx tsx activate-live-trading.ts

echo "System restarted with rate limit fix"
echo "========================================"