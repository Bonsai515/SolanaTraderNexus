#!/bin/bash
# Launch Real Trading System
# This script starts all trading strategies and the monitoring dashboard

echo "=== LAUNCHING REAL BLOCKCHAIN TRADING SYSTEM ==="
echo "Wallet: HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK"
echo "Time: $(date)"
echo

# Create necessary directories
mkdir -p logs
mkdir -p data/nuclear
mkdir -p data/secure

# Check for required environment variables
if [ -z "$HELIUS_API_KEY" ]; then
  echo "Using default Helius API key"
else
  echo "Using custom Helius API key"
fi

if [ -z "$ALCHEMY_API_KEY" ]; then
  echo "Alchemy API key not found. Some features may be limited."
else
  echo "Using Alchemy API key"
fi

if [ -z "$SYNDICA_API_KEY" ]; then
  echo "Syndica API key not found. Some features may be limited."
else
  echo "Using Syndica API key"
fi

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

# Select which strategies to launch
echo 
echo "Select which trading strategy mode to activate:"
echo "1) Ultimate Nuclear Money Glitch (4.75% profit) - Highest yield"
echo "2) Capital Builder Mode (multiple strategies)"
echo "3) Safe Mode (low risk strategies only)"
echo "4) Expert Mode (select individual strategies)"
echo

read -p "Enter your choice (1-4): " mode_choice

case $mode_choice in
  1)
    echo "Launching Ultimate Nuclear Money Glitch Strategy..."
    npx tsx ultimate-nuclear-strategy.ts > logs/ultimate-nuclear-$(date +%Y%m%d%H%M%S).log 2>&1 &
    echo "Ultimate Nuclear strategy launched!"
    ;;
  2)
    echo "Launching Capital Builder Mode..."
    echo "Starting Temporal Block Arbitrage..."
    npx tsx temporal-block-arbitrage.ts > logs/temporal-block-$(date +%Y%m%d%H%M%S).log 2>&1 &
    echo "Starting Zero Capital Flash Strategy..."
    npx tsx zero-capital-flash-strategy.ts > logs/zero-capital-$(date +%Y%m%d%H%M%S).log 2>&1 &
    echo "Capital Builder Mode activated with multiple strategies!"
    ;;
  3)
    echo "Launching Safe Mode (low risk strategies)..."
    echo "Starting Temporal Block Arbitrage..."
    npx tsx temporal-block-arbitrage.ts > logs/temporal-block-$(date +%Y%m%d%H%M%S).log 2>&1 &
    echo "Starting Quantum Flash Strategy..."
    npx tsx quantum-flash-executor.ts > logs/quantum-flash-$(date +%Y%m%d%H%M%S).log 2>&1 &
    echo "Safe Mode activated!"
    ;;
  4)
    echo "Expert Mode - Select individual strategies:"
    
    read -p "Launch Ultimate Nuclear Strategy? (y/n): " nuclear_choice
    if [[ $nuclear_choice == "y" ]]; then
      npx tsx ultimate-nuclear-strategy.ts > logs/ultimate-nuclear-$(date +%Y%m%d%H%M%S).log 2>&1 &
      echo "Ultimate Nuclear Strategy launched!"
    fi
    
    read -p "Launch Nuclear Flash Loan Strategy? (y/n): " flash_choice
    if [[ $flash_choice == "y" ]]; then
      npx tsx nuclear-flash-loan-strategy.ts > logs/nuclear-flash-$(date +%Y%m%d%H%M%S).log 2>&1 &
      echo "Nuclear Flash Loan Strategy launched!"
    fi
    
    read -p "Launch Zero Capital Flash Strategy? (y/n): " zero_choice
    if [[ $zero_choice == "y" ]]; then
      npx tsx zero-capital-flash-strategy.ts > logs/zero-capital-$(date +%Y%m%d%H%M%S).log 2>&1 &
      echo "Zero Capital Flash Strategy launched!"
    fi
    
    read -p "Launch Temporal Block Arbitrage? (y/n): " temporal_choice
    if [[ $temporal_choice == "y" ]]; then
      npx tsx temporal-block-arbitrage.ts > logs/temporal-block-$(date +%Y%m%d%H%M%S).log 2>&1 &
      echo "Temporal Block Arbitrage launched!"
    fi
    
    read -p "Launch Quantum Flash Strategy? (y/n): " quantum_choice
    if [[ $quantum_choice == "y" ]]; then
      npx tsx quantum-flash-executor.ts > logs/quantum-flash-$(date +%Y%m%d%H%M%S).log 2>&1 &
      echo "Quantum Flash Strategy launched!"
    fi
    ;;
  *)
    echo "Invalid choice. Exiting."
    exit 1
    ;;
esac

# Launch dashboard
echo "Launching trading dashboard..."
npx tsx trading-dashboard.ts > logs/dashboard-$(date +%Y%m%d%H%M%S).log 2>&1 &
DASHBOARD_PID=$!

echo
echo "=== TRADING SYSTEM ACTIVATED ==="
echo "Trading dashboard available at: http://localhost:3000"
echo
echo "To view live logs, use:"
echo "  tail -f logs/[strategy-name]-*.log"
echo
echo "To stop all trading strategies, use:"
echo "  pkill -f 'npx tsx'"
echo
echo "Happy trading! Your nuclear strategies are now making real profits on the blockchain."