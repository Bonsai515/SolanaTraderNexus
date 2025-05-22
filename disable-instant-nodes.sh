#!/bin/bash

# Disable Instant Nodes and Optimize RPC Configuration
# This script updates your system to avoid using Instant Nodes and rely on premium endpoints

echo "=== DISABLING INSTANT NODES AND OPTIMIZING RPC CONNECTIONS ==="
echo "This will configure your system to exclusively use Syndica and QuickNode"
echo "for faster and more reliable blockchain trading operations."

# Update the RPC configuration
echo "Updating RPC configuration to avoid Instant Nodes..."
cp ./config/no-instant-nodes.json ./config/rpc-config.json

# Create environment config that avoids Instant Nodes
echo "Creating specialized environment configuration..."
cat > ./.env.no-instant-nodes << EOF
USE_SYNDICA=true
USE_QUICKNODE=true
AVOID_INSTANT_NODES=true
PREFERRED_RPC_PROVIDER=syndica
BACKUP_RPC_PROVIDER=quicknode
EOF

# Apply the environment configuration
echo "Applying no-instant-nodes environment configuration..."
cat ./.env.no-instant-nodes >> ./.env

# Update the trading system to use the new configuration
echo "Updating trading system configuration..."
mkdir -p ./nexus_engine/config
cat > ./nexus_engine/config/rpc-preferences.json << EOF
{
  "preferredProviders": ["syndica", "quicknode", "helius"],
  "avoidedProviders": ["instantnodes"],
  "connectionStrategy": "premium-only",
  "fallbackStrategy": "rotate-premium-only"
}
EOF

# Restart the app with optimized settings
echo "Restarting Nexus engine with optimized RPC connections..."
pkill -f "node.*nexus" || true
sleep 2

# Start the hyper-aggressive trading with premium endpoints
echo "Launching hyper-aggressive trading with premium endpoints..."
chmod +x ./start-hyper-aggressive-trading.sh
./start-hyper-aggressive-trading.sh &

echo ""
echo "✅ INSTANT NODES DISABLED"
echo "Your trading system is now using only Syndica and QuickNode premium RPC endpoints"
echo "Benefits:"
echo "  • More stable connections without Instant Nodes timeouts"
echo "  • Avoiding rate limits from Instant Nodes"
echo "  • Higher reliability for trade execution"
echo "  • Consistent performance for your trading strategies"
echo ""
echo "To monitor your trades, check the dashboard: ./HYPER_AGGRESSIVE_PROFIT_DASHBOARD.md"