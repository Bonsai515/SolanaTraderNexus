#!/bin/bash
# Restart trading system with main wallet

echo "========================================"
echo "    RESTARTING TRADING SYSTEM          "
echo "      WITH MAIN WALLET ONLY            "
echo "========================================"
echo

# Stop running processes
echo "Stopping current trading system..."
pkill -f "ts-node" || true
pkill -f "npx tsx" || true
pkill -f "strategy.ts" || true
sleep 2

# Start with updated configuration
echo "Starting trading system with main wallet..."
./launch-enhanced-system.sh &

echo "System restarted with main wallet only"
echo "========================================"
