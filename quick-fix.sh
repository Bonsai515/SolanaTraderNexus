#!/bin/bash
# Quick fix for RPC rate limit issues

echo "=== QUICK FIX FOR RPC RATE LIMITS ==="

# 1. Update RPC config for Syndica
mkdir -p config
cat > config/rpc-config.json << EOL
{
  "rpcEndpoints": [
    {
      "url": "https://solana-api.syndica.io/rpc",
      "priority": 1,
      "weight": 10,
      "rateLimit": { "requestsPerMinute": 200 }
    },
    {
      "url": "https://api.mainnet-beta.solana.com",
      "priority": 3,
      "weight": 1,
      "rateLimit": { "requestsPerMinute": 40 }
    },
    {
      "url": "https://solana-api.projectserum.com",
      "priority": 3,
      "weight": 1,
      "rateLimit": { "requestsPerMinute": 40 }
    }
  ],
  "caching": {
    "enabled": true,
    "defaultTtlMs": 30000
  },
  "rateLimiting": {
    "enabled": true
  }
}
EOL

echo "✅ Updated RPC configuration"

# 2. Set up environment variables
if [ ! -f .env ]; then
  touch .env
fi

if ! grep -q "RPC_URL" .env; then
  echo "RPC_URL=https://solana-api.syndica.io/rpc" >> .env
  echo "✅ Added RPC_URL to .env file"
fi

# 3. Create folder structure for caching
mkdir -p data/rpc_cache
mkdir -p logs

echo "✅ Created cache directories"

# 4. Restart the trading system with updated config
echo ""
echo "Restarting trading system with improved RPC settings..."
echo ""

if [ -f "./launch-enhanced-system.sh" ]; then
  ./launch-enhanced-system.sh &
  echo "✅ System restarted with enhanced RPC settings"
else
  echo "⚠️ Could not find launch script"
fi

echo ""
echo "System is now using Syndica as primary RPC provider with caching enabled"
echo "This should significantly reduce rate limit errors (429 responses)"
echo ""
echo "Tomorrow when you add more funds and premium RPC, your system will:"
echo "1. Use your increased capital to execute larger trades"
echo "2. Leverage the premium RPC to avoid rate limits completely"
echo "3. Execute trades at much higher frequencies"