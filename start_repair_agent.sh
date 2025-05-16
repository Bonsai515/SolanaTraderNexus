#!/bin/bash

# Start Quantum Repair Agent for Solana Trading System
echo "🚀 Starting Quantum Repair Agent..."

# Check for required environment variables
if [ -z "$PERPLEXITY_API_KEY" ]; then
  echo "⚠️ PERPLEXITY_API_KEY not set. Please set this environment variable."
  echo "The AI repair system needs this key to fix code issues."
  exit 1
fi

if [ -z "$DEEPSEEK_API_KEY" ]; then
  echo "⚠️ DEEPSEEK_API_KEY not set. Please set this environment variable."
  echo "The AI repair system needs this key as a fallback for complex fixes."
  exit 1
fi

# Create necessary directories if they don't exist
mkdir -p logs
mkdir -p ai_agent/skills

# Ensure we have the latest version
if [ -d ".git" ]; then
  git pull --quiet
fi

# Install required dependencies
echo "📦 Installing dependencies..."
npm install --quiet

# Setup Rust environment for the agent
if ! command -v cargo &> /dev/null; then
  echo "⚠️ Rust not found. Installing Rust..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  source "$HOME/.cargo/env"
fi

echo "🔧 Building AI repair agent..."
cd ai_agent
cargo build --release

# Run initial system check and repair
echo "🔍 Running initial system check..."
node -e "
const fs = require('fs');
const { execSync } = require('child_process');

// Paths to check
const criticalPaths = [
  '../server/nexus-transaction-engine.ts',
  '../server/neural-network-integrator.ts',
  '../server/strategies/capital-amplifier.ts',
  '../server/strategies/hyper-acceleration.ts',
  '../server/transaction-engine-adapter.ts',
  '../server/signalHub.ts'
];

// Check for each critical file
let needsRepair = false;
let missingFiles = [];

criticalPaths.forEach(path => {
  if (!fs.existsSync(path)) {
    console.log(\`❌ Critical file missing: \${path}\`);
    missingFiles.push(path);
    needsRepair = true;
  } else {
    console.log(\`✅ Found: \${path}\`);
  }
});

if (needsRepair) {
  console.log('🔧 System needs repair. Starting repair process...');
  
  // Additional diagnostics for the repair agent
  try {
    execSync('cd .. && npx tsc --noEmit', { stdio: 'pipe' });
  } catch (error) {
    console.log('📝 TypeScript diagnostics collected for repair agent');
  }
  
  try {
    execSync('cd ../trading-system && cargo check', { stdio: 'pipe' });
  } catch (error) {
    console.log('📝 Rust diagnostics collected for repair agent');
  }
}

console.log('🚀 Starting AI repair agent process...');
"

# Start the AI Repair Agent
echo "🤖 AI Repair Agent activated and monitoring system"
cd ..
cargo run --release --manifest-path=ai_agent/Cargo.toml

# Keep the agent running
while true; do
  if ! pgrep -f "ai_agent" > /dev/null; then
    echo "⚠️ AI Repair Agent stopped. Restarting..."
    cargo run --release --manifest-path=ai_agent/Cargo.toml &
  fi
  sleep 30
done