#!/bin/bash
# Launch Trading Dashboard
# This script starts the trading dashboard web interface

echo "=== LAUNCHING NUCLEAR TRADING DASHBOARD ==="
echo "Wallet: HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK"
echo "Time: $(date)"
echo

# Create necessary directories
mkdir -p logs
mkdir -p public

# Check wallet balance
echo "Checking wallet status..."
npx tsx -e "
  const { Connection, PublicKey } = require('@solana/web3.js');
  const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=5d0d1d98-4695-4a7d-b8a0-d4f9836da17f');
  const wallet = new PublicKey('HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK');
  
  async function main() {
    try {
      const balance = await connection.getBalance(wallet);
      console.log(\`Wallet balance: \${balance/1000000000} SOL\`);
    } catch (error) {
      console.error('Error checking wallet:', error);
    }
  }
  
  main();
"

# Start the dashboard
echo "Starting trading dashboard..."
npx tsx trading-dashboard.ts > logs/dashboard-$(date +%Y%m%d%H%M%S).log 2>&1 &
DASHBOARD_PID=$!

echo "Dashboard started with PID: $DASHBOARD_PID"
echo "Access the dashboard at: http://localhost:3000"
echo
echo "To stop the dashboard, run: kill $DASHBOARD_PID"
echo
echo "Trading statistics and profits will be displayed in real-time on the dashboard."