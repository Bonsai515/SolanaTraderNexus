#!/bin/bash

echo "🚀 Starting Solana Trading System..."

# Ensure TypeScript compilation succeeds
echo "Building TypeScript files..."
npx tsc --skipLibCheck

# Run the server
echo "Starting server..."
npx tsx server/index.ts