#!/bin/bash

echo "=== STARTING TYPESCRIPT SOLANA EXECUTOR WITH NEXUS PRO ENGINE ==="
echo "Building and launching integrated Solana connection and trade executor"

# Set TypeScript execution environment
export NEXUS_SOLANA_EXECUTOR="true"
export NEXUS_TYPESCRIPT_MODE="true"
export NEXUS_LIVE_TRADING="true"
export NEXUS_CONNECTION_PREMIUM="true"

cd ./nexus_engine/solana-executor

# Install TypeScript dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing TypeScript dependencies..."
  npm install
fi

# Build TypeScript
echo "Building TypeScript Solana executor..."
npm run build

# Start the executor
echo "Starting Nexus Pro Engine with TypeScript Solana executor..."
npm start &

cd ../..

echo ""
echo "✅ TYPESCRIPT SOLANA EXECUTOR INTEGRATED WITH NEXUS PRO ENGINE"
echo ""
echo "🔗 SOLANA CONNECTION:"
echo "  • Premium Syndica RPC endpoint"
echo "  • WebSocket connection for real-time updates"
echo "  • Advanced connection management with health checks"
echo "  • Automatic retry and failover capabilities"
echo ""
echo "⚡ TRADE EXECUTOR:"
echo "  • TypeScript-based high-performance execution"
echo "  • Support for Jupiter, Flash Loans, Cross-Chain, MEV"
echo "  • Direct integration with neural signal processing"
echo "  • Real-time transaction confirmation and tracking"
echo ""
echo "🧠 NEXUS INTEGRATION:"
echo "  • Direct neural signal → trade execution pipeline"
echo "  • Real-time signal processing and validation"
echo "  • Multi-strategy execution with profit tracking"
echo "  • Full blockchain verification and monitoring"
echo ""
echo "🚀 Your Nexus Pro Engine now has TypeScript-powered Solana execution!"
