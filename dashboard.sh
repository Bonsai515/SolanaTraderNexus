#!/bin/bash

# Hyperion Trading System Dashboard
# CLI-based dashboard to monitor system wallet balances, trading status, and performance metrics

echo "Starting Hyperion Trading System Dashboard..."

# Ensure logs directory exists
mkdir -p ./logs

# Check if tslib is installed
if ! command -v ts-node &> /dev/null; then
    echo "Installing ts-node to run the dashboard..."
    npm install -g ts-node typescript
fi

# Start the dashboard
ts-node system-dashboard.ts

# If the dashboard crashes, this will show
echo "Dashboard stopped. Run ./dashboard.sh to restart."