#!/bin/bash

# Force Immediate Trade Execution
echo "=== FORCING IMMEDIATE TRADE ==="
echo "This will trigger a test trade to verify the system"
npx ts-node ./force-immediate-trade.ts
echo "Done. Check the profit dashboard for the test trade."
