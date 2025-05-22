#!/bin/bash
echo "=== UPDATED TRADE BOOSTER ==="
echo "Higher profit thresholds for better quality trades"
echo ""

# Wait 3 seconds for cancellation
for i in {3..1}; do
  echo -ne "Starting updated trade booster in $i seconds...\r"
  sleep 1
done

echo ""
echo "🔥 Boosting trade quality with higher profit thresholds..."

# Stop any running hyper-aggressive trader
pkill -f "hyper_aggressive_trader.ts"

# Export the environment variables
export TRADING_INTERVAL_MS=120000
export MAX_POSITION_SIZE_PERCENT=95
export MIN_PROFIT_THRESHOLD_SOL=0.001
export SLIPPAGE_TOLERANCE=1.5
export MAX_DAILY_TRADE_VOLUME=3.5

# Start the hyper-aggressive trader with higher profit thresholds
npx ts-node ./nexus_engine/hyper_aggressive_trader.ts
