#!/bin/bash

# Hyperion Trading System Simple Dashboard
# CLI-based dashboard to monitor system wallet balances, trading status, and performance

echo "Starting Hyperion Trading System Simple Dashboard..."

# Ensure logs directory exists
mkdir -p ./logs

# Start the dashboard
node simple-dashboard.js

# If the dashboard crashes, this will show
echo "Dashboard stopped. Run ./simple-dashboard.sh to restart."