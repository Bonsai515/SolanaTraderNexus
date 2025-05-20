#!/bin/bash
# Restart all trading strategies with optimized configurations

echo "Stopping current trading strategies..."
# Find and kill current strategy processes
pkill -f "ultimate-nuclear-strategy.ts" || true
pkill -f "quantum-flash-strategy.ts" || true
pkill -f "zero-capital-flash-strategy.ts" || true
pkill -f "mev-protection-flash-strategy.ts" || true
pkill -f "quantum-multi-flash-strategy.ts" || true
pkill -f "temporal-block-arbitrage-strategy.ts" || true
pkill -f "hyperion-cascade-flash-strategy.ts" || true

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

sleep 3

npx tsx mev-protection-flash-strategy.ts > logs/mev-protection-$(date +%Y%m%d%H%M%S).log 2>&1 &
echo "MEV Protection Flash strategy started with PID: $!"

sleep 3

npx tsx quantum-multi-flash-strategy.ts > logs/multi-flash-$(date +%Y%m%d%H%M%S).log 2>&1 &
echo "Quantum Multi-Flash strategy started with PID: $!"

sleep 3

npx tsx temporal-block-arbitrage-strategy.ts > logs/temporal-block-$(date +%Y%m%d%H%M%S).log 2>&1 &
echo "Temporal Block Arbitrage strategy started with PID: $!"

sleep 3

npx tsx hyperion-cascade-flash-strategy.ts > logs/hyperion-cascade-$(date +%Y%m%d%H%M%S).log 2>&1 &
echo "Hyperion Cascade Flash strategy started with PID: $!"

echo "All strategies restarted with optimized configurations."
echo "Monitor logs in the logs directory for performance."
