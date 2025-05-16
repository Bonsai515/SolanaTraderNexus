#!/bin/bash

echo "Starting build process for Solana Trading System..."
echo "Cleaning dist directory..."
rm -rf dist
mkdir -p dist/client
mkdir -p dist/server
mkdir -p dist/shared

echo "Running TypeScript compilation..."
npx tsc

echo "Copying static files..."
cp -r client/public dist/client/ || true

echo "Copying index.html for static dashboard..."
cp index.html dist/ || true

echo "Copying transformers folder for neural models..."
mkdir -p dist/server/transformers || true
cp -r server/transformers dist/server/ || true

echo "Copying additional resources..."
mkdir -p dist/logs || true

# Set permissions
chmod -R 755 dist

echo "Build completed successfully!"