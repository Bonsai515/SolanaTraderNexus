#!/bin/bash
echo "=== HYPER-AGGRESSIVE BLOCKCHAIN TRADING SYSTEM ==="
echo "Trading wallet: HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK"
echo "Profit wallet: 31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e"
echo ""
echo "⚠️ WARNING: HYPER-AGGRESSIVE MODE ACTIVATED ⚠️"
echo "This will execute real blockchain transactions using up to 90% of your funds"
echo "Trading every 30 seconds with minimum profit threshold of 0.0002 SOL"
echo ""
echo "Press Ctrl+C within 10 seconds to cancel"
echo ""

# Wait 10 seconds for cancellation
for i in {10..1}; do
  echo -ne "Starting HYPER-AGGRESSIVE trading in $i seconds...\r"
  sleep 1
done

echo ""
echo "🔥 Initializing Nexus Engine for HYPER-AGGRESSIVE blockchain trading..."

# Load hyper-aggressive trading environment
export $(cat .env.hyper-aggressive | grep -v '^#' | xargs)

# Kill any existing instances
pkill -f "real_trader.ts" || true

# Start the hyper-aggressive trading system with verification
npx ts-node ./nexus_engine/hyper_aggressive_trader.ts
