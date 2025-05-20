#!/bin/bash
# TypeScript Deployment Script
# This script prepares and deploys the trading system directly as TypeScript

echo "========================================"
echo "    DEPLOYING TYPESCRIPT TRADING SYSTEM "
echo "========================================"
echo

# Set environment for deployment
export NODE_ENV=production
export DEPLOYMENT_MODE=true

# Install ts-node globally if not already installed
echo "Ensuring ts-node is available..."
if ! command -v ts-node &> /dev/null; then
    echo "Installing ts-node..."
    npm install -g ts-node typescript @types/node
fi

# Fix TypeScript errors using our deployment fixer
echo "Running TypeScript deployment fixer..."
npx tsx deployment-fixer.ts

# Create deployment directory
echo "Creating deployment package..."
mkdir -p ./deploy
cp .env ./deploy/
cp -r ./config ./deploy/
cp -r ./src ./deploy/
cp -r ./strategies ./deploy/
cp -r ./shared ./deploy/
cp tsconfig.json ./deploy/
cp package.json ./deploy/

# Create startup script
cat > ./deploy/start.sh << 'EOL'
#!/bin/bash

export NODE_ENV=production

# Configure RPC providers
echo "Configuring RPC providers..."
npx tsx configure-all-rpcs.ts

# Start the trading system
echo "Starting trading system..."
npx tsx activate-live-trading.ts
EOL

chmod +x ./deploy/start.sh

echo "System is ready for deployment!"
echo "To start the system, run: ./start.sh"
echo "========================================"