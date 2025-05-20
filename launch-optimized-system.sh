#!/bin/bash
# Launch optimized trading system for Replit

echo "========================================"
echo "    LAUNCHING OPTIMIZED TRADING SYSTEM  "
echo "      FOR REPLIT ENVIRONMENT           "
echo "========================================"
echo

# Apply Replit optimizations
echo "Applying Replit-specific optimizations..."
export NODE_OPTIONS="--max-old-space-size=4096"
export RPC_URL="https://solana-api.syndica.io/rpc"

# Clear cached data that might be stale
echo "Clearing stale cache data..."
find ./data/rpc_cache -name "*.json" -mmin +60 -delete 2>/dev/null || true

# Apply trading config fixes
echo "Applying trading configuration fixes..."
npx tsx fix-trading-config.ts

# Apply connection optimization
echo "Applying connection rate optimizations..."
node -e "require('./optimize-connections.ts')" &

# Start with enhanced configuration
echo "Starting trading system with Replit optimizations..."
./launch-enhanced-system.sh

echo "System launched with Replit optimizations"
echo "========================================"
