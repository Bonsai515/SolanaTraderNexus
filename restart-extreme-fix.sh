#!/bin/bash
# Restart with Extreme Rate Limit Fix

echo "========================================"
echo "   RESTARTING WITH EXTREME RATE FIX    "
echo "========================================"

# Stop running processes
echo "Stopping current processes..."
pkill -f "ts-node" || true
pkill -f "npx tsx" || true
pkill -f "activate-" || true
sleep 2

# Clear temporary files
echo "Cleaning temporary files..."
find ./data -name "temp_*" -delete 2>/dev/null || true
find ./logs -name "*.log" -mmin +60 -delete 2>/dev/null || true

# Export environment variables
export RATE_LIMIT_FIX=true
export USE_INSTANT_NODES=false
export MAX_REQUESTS_PER_SECOND=3
export USE_AGGRESSIVE_CACHING=true
export FORCE_HELIUS=true
export DISABLE_BACKGROUND_TASKS=true
export REDUCE_POLLING_FREQUENCY=true
export SYSTEM_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export TRADING_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK

# Start system with minimal polling
echo "Starting system with extreme rate limit fix..."
npx tsx activate-live-trading.ts

echo "System restarted with extreme rate limit fix"
echo "========================================"
