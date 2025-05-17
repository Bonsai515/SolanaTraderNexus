#!/bin/bash

# Quantum Flash Day 4 Strategy Runner
# This script executes the Day 4 strategy with 91% ROI

echo "=============================================
🚀 QUANTUM FLASH DAY 4 STRATEGY
=============================================
"

# Process arguments
REAL_MODE=""
if [[ "$@" == *"--real"* ]]; then
  REAL_MODE="--real"
  echo "⚠️  WARNING: Running in REAL TRANSACTION mode! ⚠️"
  echo "Press Ctrl+C in the next 5 seconds to cancel"
  sleep 5
else
  echo "Running in SIMULATION mode"
fi

echo "
=============================================
"

# Execute the day4 strategy with our available wallet
npx tsx execute-day4-strategy.ts $REAL_MODE

echo "
=============================================
Day 4 Strategy execution complete.
=============================================
"