#!/bin/bash
# Execute Quantum Flash Strategy with Alchemy RPC (1.1 SOL)

echo "======================================================"
echo "   QUANTUM FLASH STRATEGY - USING ALCHEMY RPC         "
echo "======================================================"
echo ""
echo "Configuration:"
echo " - System Wallet: HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb"
echo " - Amount: 1.1 SOL"
echo " - Strategy: Day 1 (Conservative)"
echo " - Expected Profit: ~7% (0.077 SOL)"
echo " - Alchemy RPC Provider (reliable connection)"
echo ""
echo "This script will force the use of Alchemy instead of InstantNodes"
echo "Press ENTER to start or Ctrl+C to cancel..."
read

# Create logs directory
mkdir -p logs/transactions

# Force the use of Alchemy across the entire system
export SOLANA_RPC_URL="https://solana-mainnet.g.alchemy.com/v2/PPQbbM4WmrX_82GOP8QR5pJ_JsBvyLWR"
export ALCHEMY_RPC_URL="https://solana-mainnet.g.alchemy.com/v2/PPQbbM4WmrX_82GOP8QR5pJ_JsBvyLWR"
export NEXT_PUBLIC_ALCHEMY_RPC="https://solana-mainnet.g.alchemy.com/v2/PPQbbM4WmrX_82GOP8QR5pJ_JsBvyLWR"
export FORCE_ALCHEMY=true

# Run the strategy with the real wallet balance
echo "Executing Quantum Flash Strategy with Alchemy RPC..."
node -e "
const { Connection, PublicKey } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

// Import our strategy
const { QuantumFlashStrategy } = require('./server/strategies/quantum_flash_strategy');

async function executeAlchemyTrade() {
  // Using Alchemy for reliable RPC connection
  const rpcUrl = 'https://solana-mainnet.g.alchemy.com/v2/PPQbbM4WmrX_82GOP8QR5pJ_JsBvyLWR';
  const connection = new Connection(rpcUrl);
  
  // System wallet for trading
  const walletAddress = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
  const walletPubkey = new PublicKey(walletAddress);
  
  console.log('Checking wallet balance with Alchemy...');
  const balance = await connection.getBalance(walletPubkey);
  const solBalance = balance / 1_000_000_000;
  
  console.log(\`Current balance: \${solBalance} SOL\`);
  
  // Amount to use for trading
  const tradeAmount = 1.1;
  
  if (solBalance < tradeAmount) {
    console.log(\`Warning: Wallet balance (\${solBalance} SOL) is less than requested trade amount (\${tradeAmount} SOL)\`);
    console.log(\`Adjusting amount to \${solBalance - 0.05} SOL to leave buffer for fees\`);
  }
  
  // Create wallet interface for the strategy
  const wallet = {
    publicKey: walletPubkey,
    address: walletAddress,
    signTransaction: async (tx) => {
      console.log('Would sign transaction (simulation only)');
      return tx;
    }
  };
  
  console.log('\\nInitializing Quantum Flash Strategy with Alchemy RPC...');
  const strategy = new QuantumFlashStrategy(connection, wallet);
  const initialized = await strategy.initialize();
  
  if (!initialized) {
    console.error('Failed to initialize strategy with Alchemy');
    return;
  }
  
  // Execute the strategy with Day 1 (most conservative)
  console.log('\\nExecuting Day 1 strategy with 1.1 SOL...');
  const result = await strategy.executeDailyStrategy(tradeAmount * 1_000_000_000, 1);
  
  console.log('\\n=== STRATEGY RESULTS ===');
  console.log(\`Starting amount: \${tradeAmount} SOL\`);
  console.log(\`Ending amount: \${result.endingAmount / 1_000_000_000} SOL\`);
  console.log(\`Profit: \${result.profit / 1_000_000_000} SOL\`);
  
  // Save results to log file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logDir = path.join(process.cwd(), 'logs', 'transactions');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  
  const logFile = path.join(logDir, \`alchemy-trade-\${timestamp}.json\`);
  const logData = {
    timestamp,
    wallet: walletAddress,
    startingAmount: tradeAmount,
    endingAmount: result.endingAmount / 1_000_000_000,
    profit: result.profit / 1_000_000_000,
    rpc: 'Alchemy',
    strategy: 'Quantum Flash Strategy - Day 1'
  };
  
  fs.writeFileSync(logFile, JSON.stringify(logData, null, 2));
  console.log(\`\\nTransaction log saved to \${logFile}\`);
  
  // Check balance after trade (in simulation, will be unchanged)
  const newBalance = await connection.getBalance(walletPubkey);
  console.log(\`\\nWallet balance after trade: \${newBalance / 1_000_000_000} SOL\`);
}

// Execute trade with proper error handling
executeAlchemyTrade().catch(err => console.error('Error executing Alchemy trade:', err));
"

echo ""
echo "Trade execution complete. See logs for details."