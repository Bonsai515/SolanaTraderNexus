#!/bin/bash
# Monitor and Execute Real Flash Trading with 1.1 SOL

# Create logs directory if it doesn't exist
mkdir -p logs

# Start the monitoring dashboard in the background
echo "Starting Quantum Flash Trading dashboard..."
npx tsx flash-trading-dashboard.ts &
DASHBOARD_PID=$!

# Wait a moment for the dashboard to initialize
sleep 2

# Display confirmation message
echo ""
echo "⚠️  WARNING: REAL BLOCKCHAIN TRADING ⚠️"
echo "This will execute actual transactions on the Solana blockchain using real funds."
echo "Day: 1 strategy"
echo "Amount: 1.1 SOL"
echo ""
echo "Trading dashboard is now running. You can monitor the trade execution in real-time."
echo ""
echo "Press Enter to start trading or Ctrl+C to cancel..."
read

# Automatically answer "y" to the confirmation prompt
echo "Executing real blockchain trading..."
echo "y" | npx tsx execute-real-flash-trading.ts 1 1.1

# Wait for user to press Enter to exit the dashboard
echo ""
echo "Press Enter to stop the dashboard and exit..."
read

# Kill the dashboard process
kill $DASHBOARD_PID
echo "Dashboard stopped. Trading will continue in the background."