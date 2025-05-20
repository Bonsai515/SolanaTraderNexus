#!/bin/bash
# Launch Nuclear Trading Strategies
# This script launches all nuclear-grade trading strategies

echo "=== LAUNCHING NUCLEAR TRADING STRATEGIES ==="
echo "Wallet: HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK"
echo "Time: $(date)"
echo

# Check for required environment variables
if [ -z "$HELIUS_API_KEY" ]; then
  echo "Warning: HELIUS_API_KEY not found in environment. Using default key."
fi

if [ -z "$ALCHEMY_API_KEY" ]; then
  echo "Warning: ALCHEMY_API_KEY not found in environment. Using Helius as fallback."
fi

# Create necessary directories
mkdir -p logs
mkdir -p data/nuclear
mkdir -p data/secure

# Display wallet information
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

# Select which strategy to launch
echo 
echo "Select which nuclear strategy to launch:"
echo "1) Ultimate Nuclear Money Glitch (4.75% profit)"
echo "2) Nuclear Flash Loan Arbitrage (3.45% profit)"
echo "3) Zero Capital Flash Arbitrage (2.95% profit)"
echo "4) Quantum Flash Strategy (specialized)"
echo "5) Launch All Strategies"
echo

read -p "Enter your choice (1-5): " strategy_choice

# Launch selected strategy
case $strategy_choice in
  1)
    echo "Launching Ultimate Nuclear Money Glitch Strategy..."
    npx tsx ultimate-nuclear-strategy.ts > logs/ultimate-nuclear-$(date +%Y%m%d%H%M%S).log 2>&1 &
    echo "Strategy launched! Check logs for details."
    ;;
  2)
    echo "Launching Nuclear Flash Loan Arbitrage Strategy..."
    npx tsx nuclear-flash-loan-strategy.ts > logs/nuclear-flash-$(date +%Y%m%d%H%M%S).log 2>&1 &
    echo "Strategy launched! Check logs for details."
    ;;
  3)
    echo "Launching Zero Capital Flash Arbitrage Strategy..."
    npx tsx zero-capital-flash-strategy.ts > logs/zero-capital-$(date +%Y%m%d%H%M%S).log 2>&1 &
    echo "Strategy launched! Check logs for details."
    ;;
  4)
    echo "Launching Quantum Flash Strategy..."
    npx tsx quantum-flash-executor.ts > logs/quantum-flash-$(date +%Y%m%d%H%M%S).log 2>&1 &
    echo "Strategy launched! Check logs for details."
    ;;
  5)
    echo "Launching ALL Nuclear Strategies..."
    npx tsx ultimate-nuclear-strategy.ts > logs/ultimate-nuclear-$(date +%Y%m%d%H%M%S).log 2>&1 &
    npx tsx nuclear-flash-loan-strategy.ts > logs/nuclear-flash-$(date +%Y%m%d%H%M%S).log 2>&1 &
    npx tsx zero-capital-flash-strategy.ts > logs/zero-capital-$(date +%Y%m%d%H%M%S).log 2>&1 &
    npx tsx quantum-flash-executor.ts > logs/quantum-flash-$(date +%Y%m%d%H%M%S).log 2>&1 &
    echo "All strategies launched! Check logs for details."
    ;;
  *)
    echo "Invalid choice. Exiting."
    exit 1
    ;;
esac

echo
echo "=== TRADING MONITOR ==="
echo "To view live logs, use:"
echo "  tail -f logs/[strategy-name]-*.log"
echo
echo "To stop trading strategies, use:"
echo "  pkill -f 'npx tsx'"
echo
echo "Happy trading!"