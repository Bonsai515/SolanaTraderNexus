#!/bin/bash
echo "Starting ULTRA AGGRESSIVE Trading System..."
echo "Trading wallet: HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK"
echo "Profit wallet: 31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e"
echo ""
echo "Initializing Nexus Engine in ULTRA AGGRESSIVE mode..."

# Kill any existing instances
pkill -f "autonomous-trading"

# Start the autonomous trading with ultra aggressive config
npx ts-node ./nexus_engine/ultra_autonomous_trader.ts
