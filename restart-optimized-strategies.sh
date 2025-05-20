#!/bin/bash
# Restart trading strategies with optimized configurations

echo "Stopping current trading strategies..."
# Find and kill current strategy processes
pkill -f "ultimate-nuclear-strategy.ts" || true
pkill -f "quantum-flash-strategy.ts" || true
pkill -f "zero-capital-flash-strategy.ts" || true

echo "Waiting for processes to terminate..."
sleep 5

echo "Starting strategies with optimized configurations..."
npx tsx ultimate-nuclear-strategy.ts > logs/ultimate-nuclear-$(date +%Y%m%d%H%M%S).log 2>&1 &
echo "Ultimate Nuclear strategy started with PID: $!"

sleep 3

npx tsx quantum-flash-strategy.ts > logs/quantum-flash-$(date +%Y%m%d%H%M%S).log 2>&1 &
echo "Quantum Flash strategy started with PID: $!"

sleep 3

npx tsx zero-capital-flash-strategy.ts > logs/zero-capital-$(date +%Y%m%d%H%M%S).log 2>&1 &
echo "Zero Capital Flash strategy started with PID: $!"

echo "All strategies restarted with optimized configurations."
echo "Monitor logs in the logs directory for performance."
