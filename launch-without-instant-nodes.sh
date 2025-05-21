#!/bin/bash
# Launch with Instant Nodes Completely Disabled

echo "========================================"
echo "  LAUNCHING WITHOUT INSTANT NODES       "
echo "========================================"

# Stop all running processes
pkill -f "ts-node" || true
pkill -f "tsx" || true
pkill -f "node" || true
pkill -f "npm" || true
sleep 3

# Apply the RPC manager patch
echo "Patching RPC connection manager to remove Instant Nodes..."
npx tsx patch-rpc-manager.ts

# Set environment from the no-instant-nodes configuration
echo "Setting environment without Instant Nodes..."
export $(cat .env.no-instant-nodes | xargs)

# Require the blocker module to force block Instant Nodes
echo "Launching with Instant Nodes blocker..."
NODE_OPTIONS="--require ./blockers/instant-nodes-blocker.js" npx tsx activate-live-trading.ts

echo "System launched without Instant Nodes"
echo "========================================"
