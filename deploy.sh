#!/bin/bash

# Deployment script for the Solana trading platform
echo "Starting deployment process..."

# Step 1: Copy production configuration
echo "Setting up deployment environment..."
cp .env.deployment .env.production

# Step 2: Start the production server
echo "Starting production server..."
node production-server.js