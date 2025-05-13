#!/bin/bash

# Anchor Program Deployment Script
# This script builds and deploys the Rust-based Anchor program for the Nexus Transaction Engine

set -e

echo "⚡ Starting Anchor program deployment for Quantum HitSquad Nexus Transaction Engine"

# Check if Solana CLI is installed
if ! command -v solana &> /dev/null; then
  echo "ERROR: Solana CLI not found. Please install it first."
  exit 1
fi

# Check if Anchor CLI is installed
if ! command -v anchor &> /dev/null; then
  echo "ERROR: Anchor CLI not found. Please install it first."
  exit 1
fi

# Check if Rust/Cargo is installed
if ! command -v cargo &> /dev/null; then
  echo "ERROR: Rust/Cargo not found. Please install it first."
  exit 1
fi

# Source environment variables
if [ -f "../.env" ]; then
  source ../.env
else
  echo "WARNING: .env file not found, using existing environment variables"
fi

# Set deployment wallet
if [ -z "$DEPLOY_WALLET_PATH" ]; then
  DEPLOY_WALLET_PATH="$HOME/.config/solana/id.json"
  echo "Using default wallet at $DEPLOY_WALLET_PATH"
else
  echo "Using configured wallet at $DEPLOY_WALLET_PATH"
fi

# Configure Solana CLI
echo "Configuring Solana CLI with RPC endpoint..."
if [ -n "$INSTANT_NODES_RPC_URL" ]; then
  solana config set --url $INSTANT_NODES_RPC_URL
else
  solana config set --url https://api.mainnet-beta.solana.com
fi
solana config set --keypair $DEPLOY_WALLET_PATH

# Check wallet balance
echo "Checking wallet balance..."
WALLET_ADDRESS=$(solana address)
BALANCE=$(solana balance $WALLET_ADDRESS)
echo "Wallet $WALLET_ADDRESS has $BALANCE SOL"

# Check if we have enough SOL for deployment
REQUIRED_BALANCE=1.0
if (( $(echo "$BALANCE < $REQUIRED_BALANCE" | bc -l) )); then
  echo "ERROR: Insufficient balance for deployment. Need at least $REQUIRED_BALANCE SOL"
  exit 1
fi

# Navigate to Anchor program directory
cd "$(dirname "$0")/src/programs/nexus_engine"

# Build the program
echo "Building Anchor program..."
anchor build

# Get Program ID
PROGRAM_ID=$(solana address -k target/deploy/nexus_engine-keypair.json)
echo "Program ID: $PROGRAM_ID"

# Update Program ID in Anchor.toml
sed -i "s/nexus_engine = \".*\"/nexus_engine = \"$PROGRAM_ID\"/" Anchor.toml

# Update Program ID in lib.rs
sed -i "s/declare_id!(\".*\")/declare_id!(\"$PROGRAM_ID\")/" programs/nexus_engine/src/lib.rs

# Build again with updated IDs
echo "Rebuilding with updated Program ID..."
anchor build

# Deploy the program
echo "Deploying Anchor program to Solana..."
anchor deploy

# Verify deployment
echo "Verifying deployment..."
solana program show $PROGRAM_ID

# Update program ID in .env file
echo "Updating ANCHOR_PROGRAM_ID in .env file..."
if grep -q "ANCHOR_PROGRAM_ID" ../.env; then
  sed -i "s/ANCHOR_PROGRAM_ID=.*/ANCHOR_PROGRAM_ID=$PROGRAM_ID/" ../.env
else
  echo "ANCHOR_PROGRAM_ID=$PROGRAM_ID" >> ../.env
fi

# Build transformers
echo "Building transformer binaries..."
cd ../transformers
cargo build --release

# Copy transformer binaries to deployment directory
echo "Copying transformer binaries to deployment directory..."
mkdir -p ../../transformers
cp target/release/microqhc ../../transformers/
cp target/release/memecortexremix ../../transformers/
cp target/release/security ../../transformers/
cp target/release/crosschain ../../transformers/

echo "✅ Anchor program and transformers deployed successfully!"
echo "Program ID: $PROGRAM_ID"
echo "Transformer binaries installed to ./transformers/"