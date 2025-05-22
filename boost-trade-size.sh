#!/bin/bash
echo "=== TRADE SIZE BOOSTER ==="
echo "This script creates larger, less frequent trades for maximum volume efficiency"
echo ""

# Wait 3 seconds for cancellation
for i in {3..1}; do
  echo -ne "Starting trade size boost in $i seconds...\r"
  sleep 1
done

echo ""
echo "🔥 Boosting trade sizes and reducing frequency..."

# Stop any running hyper-aggressive trader
pkill -f "hyper_aggressive_trader.ts"

# Export the environment variables
export TRADING_INTERVAL_MS=120000
export MAX_POSITION_SIZE_PERCENT=95
export MIN_PROFIT_THRESHOLD_SOL=0.0005
export SLIPPAGE_TOLERANCE=1.5
export MAX_DAILY_TRADE_VOLUME=3.5

# Start the hyper-aggressive trader with larger trades
npx ts-node ./nexus_engine/hyper_aggressive_trader.ts
