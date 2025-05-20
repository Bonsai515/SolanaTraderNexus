#!/bin/bash
# Launch Quantum Flash Trading Strategy
# Automatically generated on 2025-05-20T00:57:38.075Z

echo "=== LAUNCHING QUANTUM FLASH TRADING STRATEGY ==="
echo "Strategy: Zero-capital flash loan arbitrage with neural routing"
echo "Wallet: HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK"
echo "Time: $(date)"
echo

# Start the trading engine
echo "Starting Quantum Flash trading engine..."
npx tsx quantum-flash-executor.ts

# Keep this script running
echo "Trading engine started. Press Ctrl+C to exit."
