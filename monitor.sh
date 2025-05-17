#!/bin/bash
# Run TypeScript monitoring dashboard

echo "Starting Solana Trading Platform Monitor..."
npx tsx start-monitoring.ts

# Exit gracefully on CTRL+C
trap "echo 'Exiting monitor...'; exit 0" INT