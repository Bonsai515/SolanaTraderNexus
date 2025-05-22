#!/bin/bash
echo "Starting Autonomous Trading System..."
echo "Trading wallet: HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK"
echo "Profit wallet: 31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e"
echo ""
echo "Initializing Nexus Engine..."
npx ts-node ./nexus_engine/autonomous_trader.ts
