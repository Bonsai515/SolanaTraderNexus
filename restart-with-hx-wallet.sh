#!/bin/bash
# Restart trading system with HX wallet integration

echo "========================================"
echo "    RESTARTING TRADING SYSTEM          "
echo "    WITH HX WALLET INTEGRATION         "
echo "========================================"
echo

# Stop running processes
echo "Stopping current trading system..."
pkill -f "ts-node" || true
pkill -f "npx tsx" || true
pkill -f "strategy.ts" || true
sleep 2

# Start with new wallet configuration
echo "Starting enhanced trading system with HX wallet..."
./launch-enhanced-system.sh &

echo "System restarted with HX wallet (1.53 SOL)"
echo "Total trading capital: ~2.1 SOL"
echo "========================================"
