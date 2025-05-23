#!/bin/bash

# Clean Trading System Startup
# Uses only working, premium data sources and RPC endpoints

echo "=== STARTING CLEAN TRADING SYSTEM ==="
echo "Using only premium, working data sources and RPC endpoints"

# Kill any existing processes
pkill -f "node.*nexus" || true
pkill -f "profit-tracker" || true
sleep 2

# Apply clean configurations
cp ./config/premium-rpc-config.json ./config/rpc-config.json
cp ./config/data-sources/premium-dex-config.json ./nexus_engine/config/data-sources.json

# Set environment variables for clean operation
export NODE_OPTIONS="--max-old-space-size=4096"
export NEXUS_CLEAN_MODE="true"
export NEXUS_DISABLE_PROBLEMATIC_SOURCES="true"
export NEXUS_USE_PREMIUM_RPC_ONLY="true"
export NEXUS_TRADER_MODE="clean-performance"

echo "Disabled problematic sources: pump.fun, gmgn.ai, meteora.ag, instantnodes"
echo "Using premium RPC: Syndica + QuickNode only"
echo "Using working DEX sources: Jupiter, Raydium, Orca, DexScreener"

# Start the trading system
echo "Starting clean trading system..."
node --experimental-specifier-resolution=node --no-warnings ./nexus_engine/start.js --mode=clean-performance &

echo ""
echo "✅ CLEAN TRADING SYSTEM STARTED"
echo "Your system is now running with:"
echo "  • Premium Syndica + QuickNode RPC only"
echo "  • Jupiter, Raydium, Orca DEX integrations"
echo "  • DexScreener as backup price source"
echo "  • All problematic APIs disabled"
echo ""
