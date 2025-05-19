#!/bin/bash
echo "=== Starting Nuclear Solana Trading System ==="
echo "Wallet: HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK"
echo "Version: NUCLEAR EDITION"
echo

# Set environment variables
export USE_REAL_FUNDS=true
export EXECUTE_REAL_TRADES=true
export SUBMIT_TRANSACTIONS=true
export NUCLEAR_STRATEGIES_ENABLED=true
export WALLET_ADDRESS=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK

# Start the nuclear trading system
echo "Starting nuclear strategies..."
npx tsx run-nuclear-trading-system.ts
