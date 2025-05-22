#!/bin/bash
echo "=== REAL BLOCKCHAIN TRADING SYSTEM ==="
echo "Trading wallet: HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK"
echo "Profit wallet: 31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e"
echo ""
echo "WARNING: This will execute real blockchain transactions using actual funds"
echo "Press Ctrl+C within 5 seconds to cancel"
echo ""

# Wait 5 seconds for cancellation
for i in {5..1}; do
  echo -ne "Starting real trading in $i seconds...\r"
  sleep 1
done

echo ""
echo "Initializing Nexus Engine for REAL blockchain trading..."

# Load real trading environment
export $(cat .env.real-trading | grep -v '^#' | xargs)

# Kill any existing instances
pkill -f "ultra_autonomous_trader.ts" || true

# Start the real trading system with verification
npx ts-node ./nexus_engine/real_trader.ts
