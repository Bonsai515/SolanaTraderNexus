#!/bin/bash

export NODE_ENV=production

# Configure RPC providers
echo "Configuring RPC providers..."
npx tsx configure-all-rpcs.ts

# Start the trading system
echo "Starting trading system..."
npx tsx activate-live-trading.ts
