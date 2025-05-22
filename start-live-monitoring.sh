#!/bin/bash
echo "=== LIVE WALLET MONITORING FOR AUTONOMOUS TRADING ==="
echo "Monitoring HPN wallet and Prophet wallet for balance changes..."
echo "You'll see real-time updates when trades happen."
echo ""
echo "Starting monitoring system..."
echo ""

# Run the wallet monitor in the background
npx ts-node monitor-wallet-balances.ts &
MONITOR_PID=$!

# Run the trading system if it's not already running
if ! pgrep -f "ultra_autonomous_trader.ts" > /dev/null; then
  echo "Starting ultra-aggressive trading system..."
  npx ts-node nexus_engine/ultra_autonomous_trader.ts &
  TRADING_PID=$!
fi

# Function to handle exit
function cleanup {
  echo ""
  echo "Stopping monitoring system..."
  kill $MONITOR_PID 2>/dev/null
  
  if [ ! -z "$TRADING_PID" ]; then
    echo "Stopping trading system..."
    kill $TRADING_PID 2>/dev/null
  fi
  
  echo "Exited live monitoring. Your trades will continue in the background."
  exit 0
}

# Set up trap for cleanup
trap cleanup SIGINT

# Keep script running
echo "Live monitoring active. Press Ctrl+C to stop monitoring."
echo ""
echo "Checking wallet balances every 10 seconds..."
echo ""

# Show the dashboard in the terminal
watch -n 10 "cat WALLET_BALANCE_DASHBOARD.md"