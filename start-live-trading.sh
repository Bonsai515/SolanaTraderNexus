#!/bin/bash

# Start Live Trading with Real Funds
# This script activates the Solana transaction engine and trading agents with real funds

echo "🚀 Activating Live Trading with Real Funds"
echo "=========================================="

# Run the TypeScript activation script
echo "⚡ Running transaction engine activation..."
ts-node activate-live-trading.ts

# Show a clear message that live trading has been activated
echo ""
echo "🚨 LIVE TRADING WITH REAL FUNDS ACTIVATED 🚨"
echo ""

# Check if the user wants to monitor the system
read -p "Do you want to monitor the system with the dashboard? (y/n): " monitor_choice
if [[ "$monitor_choice" == "y" || "$monitor_choice" == "Y" ]]; then
  echo "📊 Starting system dashboard..."
  ts-node system-dashboard.ts
else
  echo "You can monitor the system at any time by running: ts-node system-dashboard.ts"
  echo "You can check agent status by running: ts-node -e 'require(\"./server/agents\").checkAgentStatus()'"
fi