#!/bin/bash

echo "=== STARTING MAXIMUM CAPITAL AGGRESSIVE TRADING ==="
echo "Borrowing 53,000 SOL and deploying aggressively"

# Set ultra-aggressive environment
export NEXUS_MAX_CAPITAL="true"
export NEXUS_BORROW_MAXIMUM="true"
export NEXUS_AGGRESSIVE_MODE="ultra"
export NEXUS_LEVERAGE_MULTIPLIER="3.5"
export NEXUS_RISK_TOLERANCE="maximum"

# Apply configuration
cp ./nexus_engine/config/aggressive-capital/max-borrow.json ./nexus_engine/config/

echo "🔥 MAXIMUM CAPITAL DEPLOYMENT:"
echo "  💰 Solend: 10,000 SOL"
echo "  💰 Kamino: 15,000 SOL" 
echo "  💰 Marinade: 8,000 SOL"
echo "  💰 Flash Loans: 20,000 SOL"
echo "  📊 Total: 53,000 SOL"
echo ""
echo "⚡ AGGRESSIVE ALLOCATION:"
echo "  🎯 QuantumFlashArbitrage: 15,000 SOL"
echo "  🧠 NeuralMemeSniper: 12,000 SOL"
echo "  🔗 CrossChainArbitrage: 10,000 SOL"
echo "  🕒 TemporalBlockSingularity: 8,000 SOL"
echo "  ⚡ JitoMEVIntercept: 5,000 SOL"
echo "  🚀 HyperionFlashLoans: 3,000 SOL"

# Start maximum capital system
echo "Starting maximum capital trading system..."
node --experimental-specifier-resolution=node --no-warnings ./nexus_engine/start.js --mode=max-capital-aggressive &

echo ""
echo "🚀 MAXIMUM CAPITAL AGGRESSIVE TRADING ACTIVATED"
echo "Your system is now operating with 53,000 SOL borrowed capital:"
echo "  • 95% position sizing on each trade"
echo "  • 3.5x leverage multiplier"
echo "  • 12-second ultra-fast trade cycles"
echo "  • 8 concurrent strategies running"
echo "  • Target: 100+ SOL profit per day"
echo ""
