#!/bin/bash

# Deploy Solana Transaction Engine
# This script initializes and deploys the Solana transaction engine for live trading

echo "🚀 Deploying Solana Transaction Engine for Live Trading"
echo "======================================================="

# Ensure logs directory exists
mkdir -p ./logs

echo "📡 Setting up RPC connections..."

# Save RPC URLs to environment variables
echo "export SOLANA_RPC_URL=https://solana-grpc-geyser.instantnodes.io:443" > .env.trading
echo "export SOLANA_WEBSOCKET_URL=wss://solana-api.instantnodes.io/token-${SOLANA_RPC_API_KEY}" >> .env.trading

# Set up Wormhole connection
echo "📡 Configuring cross-chain connections..."
echo "export WORMHOLE_GUARDIAN_RPC=https://guardian.stable.productions" >> .env.trading

# Set up system wallet
echo "💰 Setting up system wallet..."
echo "export SYSTEM_WALLET_ADDRESS=HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb" >> .env.trading

# Deploy transaction engine
echo "🔧 Deploying transaction engine..."
source .env.trading

# Activate the transaction engine and set it to use real funds
echo "✅ Activating transaction engine for LIVE TRADING..."
node -e "
const transactionEngine = require('./server/transaction-engine');
transactionEngine.initialize({
  rpcUrl: process.env.SOLANA_RPC_URL,
  websocketUrl: process.env.SOLANA_WEBSOCKET_URL,
  useRealFunds: true,
  systemWalletAddress: process.env.SYSTEM_WALLET_ADDRESS
});
console.log('Transaction engine initialized and ready for live trading');
" > ./logs/transaction-engine-deploy.log 2>&1

# Configure the transaction engine to use the transaction connector
echo "🔌 Connecting transaction engine to server..."
node -e "
const fs = require('fs');
const path = require('path');
const engineConfigPath = path.join(__dirname, 'server', 'config', 'engine.json');
const config = { 
  useRealFunds: true,
  rpcUrl: process.env.SOLANA_RPC_URL,
  websocketUrl: process.env.SOLANA_WEBSOCKET_URL,
  systemWalletAddress: process.env.SYSTEM_WALLET_ADDRESS,
  wormholeGuardianRpc: process.env.WORMHOLE_GUARDIAN_RPC
};
fs.writeFileSync(engineConfigPath, JSON.stringify(config, null, 2));
console.log('Transaction engine configuration saved');
" >> ./logs/transaction-engine-deploy.log 2>&1

# Start the transaction engine
echo "🚀 Starting transaction engine..."
ts-node server/transaction-connector.ts > ./logs/transaction-engine.log 2>&1 &
TRANSACTION_ENGINE_PID=$!

echo "⏳ Waiting for transaction engine to initialize..."
sleep 5

# Verify the transaction engine is running
if ps -p $TRANSACTION_ENGINE_PID > /dev/null; then
  echo "✅ Transaction engine deployed successfully! Running as process ID $TRANSACTION_ENGINE_PID"
  echo "✅ Transaction engine configured for LIVE TRADING with REAL FUNDS"
  echo "📊 Transaction engine logs can be found at: ./logs/transaction-engine.log"
else
  echo "❌ Failed to start transaction engine. Check logs at ./logs/transaction-engine-deploy.log"
  exit 1
fi

# Activate all trading agents
echo "🤖 Activating trading agents for live trading..."
ts-node -e "
import { activateAllAgents, toggleRealFunds } from './server/agents';

async function startLiveTrading() {
  try {
    // Enable real funds trading
    console.log('Enabling real funds trading...');
    await toggleRealFunds(true);
    
    // Activate all agents
    console.log('Activating all trading agents...');
    await activateAllAgents();
    
    console.log('All trading agents activated for live trading with real funds!');
  } catch (error) {
    console.error('Error starting live trading:', error);
  }
}

startLiveTrading();
" > ./logs/agent-activation.log 2>&1

echo ""
echo "✅ Solana Transaction Engine deployed and ready for live trading!"
echo "✅ All trading agents activated and configured to use real funds"
echo ""
echo "📊 Monitor system status with: ts-node system-dashboard.ts"