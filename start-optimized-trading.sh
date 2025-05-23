#!/bin/bash

echo "=== STARTING OPTIMIZED RPC TRADING SYSTEM ==="
echo "Separating transaction execution from other functions"

# Set optimized trading environment
export OPTIMIZED_RPC="true"
export TRANSACTION_RPC_DEDICATED="true"
export RATE_LIMIT_ENFORCED="true"
export RPC_DISTRIBUTION="true"

echo "🔧 RPC DISTRIBUTION SETUP:"
echo "  📤 Transaction RPC: Syndica (dedicated, rate limited)"
echo "  📊 Price Data RPC: Mainnet Beta (unlimited)"
echo "  💰 Wallet Monitor RPC: Ankr (balance checks)"
echo "  ⚡ Arbitrage RPC: Alchemy (market data)"

# Start optimized trading system
echo "Starting optimized RPC trading system..."
node ./nexus_engine/rpc-management/optimized-trader.js &

echo ""
echo "✅ OPTIMIZED RPC TRADING SYSTEM OPERATIONAL"
echo ""
echo "🔧 OPTIMIZATIONS ACTIVE:"
echo "  • Dedicated transaction RPC with 1 tx/second rate limit"
echo "  • Separate RPCs for price data, wallet monitoring, arbitrage"
echo "  • Automatic health checks across all RPC endpoints"
echo "  • Load distribution to prevent rate limiting"
echo ""
echo "📊 RPC USAGE:"
echo "  • Transactions: Syndica RPC only (protected)"
echo "  • Price feeds: Mainnet Beta RPC"
echo "  • Balance checks: Ankr RPC" 
echo "  • Arbitrage data: Alchemy RPC"
echo ""
echo "🚀 Trading continues with optimized RPC distribution!"
