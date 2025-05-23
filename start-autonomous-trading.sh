#!/bin/bash

echo "=== STARTING AUTONOMOUS AI TRADING SYSTEM ==="
echo "Launching self-executing AI agents with forced trade execution"

# Set autonomous trading environment
export AUTONOMOUS_TRADING="true"
export FORCE_EXECUTION="true"
export AI_AGENTS_ACTIVE="true"
export AUTO_EXECUTE_SIGNALS="true"
export IGNORE_THRESHOLDS="true"

# Start autonomous trading engine
echo "Starting autonomous AI trading engine..."
node ./nexus_engine/autonomous/auto-trader.js &

# Start AI agent controller
echo "Starting AI agent controller..."
node ./nexus_engine/autonomous/ai-agent-controller.js &

echo ""
echo "✅ AUTONOMOUS AI TRADING SYSTEM OPERATIONAL"
echo ""
echo "🤖 ACTIVE AI AGENTS:"
echo "  • Neural Meme Agent: Meme token prediction & execution"
echo "  • Quantum Arbitrage Agent: Advanced arbitrage strategies"
echo "  • Flash Loan Agent: Flash loan arbitrage execution"
echo "  • Cross-Chain Agent: Cross-chain arbitrage opportunities"
echo "  • MEV Extraction Agent: MEV opportunity capture"
echo "  • Temporal Agent: Time-based prediction trading"
echo ""
echo "⚡ AUTONOMOUS FEATURES:"
echo "  • Force execution on ALL signals (no threshold checks)"
echo "  • Continuous signal monitoring every 2 seconds"
echo "  • Auto-generation of trading opportunities"
echo "  • Real-time profit tracking and compounding"
echo "  • Multiple AI strategies running simultaneously"
echo ""
echo "🚀 Your AI agents are now trading autonomously with forced execution!"
