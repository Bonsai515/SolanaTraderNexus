#!/bin/bash
# Deployment Preparation Script
# This script prepares the trading system for deployment by fixing TypeScript errors

echo "========================================"
echo "    PREPARING SYSTEM FOR DEPLOYMENT    "
echo "========================================"
echo

# Set environment for deployment
export NODE_ENV=production
export DEPLOYMENT_MODE=true

# Fix TypeScript errors
echo "Running TypeScript deployment fixer..."
npx tsx deployment-fixer.ts

# Compile TypeScript to JavaScript
echo "Compiling TypeScript to JavaScript..."
npx tsc --skipLibCheck

# Create deployment package
echo "Creating deployment package..."
mkdir -p ./deploy
cp -r ./dist/* ./deploy/
cp .env ./deploy/
cp -r ./config ./deploy/

echo "System is ready for deployment!"
echo "========================================"
