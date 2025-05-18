#!/bin/bash

# Restart Price Feed Service with Improved Rate Limit Handling

echo "=========================================="
echo "🚀 RESTARTING PRICE FEED SERVICE"
echo "=========================================="

# Kill any running price feed service
pkill -f "node.*price-feed" || true

# Wait for processes to terminate
sleep 2

# Start the improved price feed service
npx tsx src/price-feed-example.ts &

echo "✅ Price feed service restarted with improved rate limit handling"
echo "=========================================="