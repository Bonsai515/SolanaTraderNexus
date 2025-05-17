/**
 * Prepare Day 4 Strategy with Prophet Wallet
 * 
 * This script prepares the Day 4 Quantum Flash Strategy (91% ROI)
 * using the Prophet wallet private key from data/wallets.json file.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Critical paths
const WALLETS_PATH = './data/wallets.json';
const DATA_DIR = './data';
const LOGS_DIR = './logs/transactions';
const DAY4_CONFIG_PATH = './data/day4_strategy.json';

// Constants
const PROPHET_WALLET_ADDRESS = '5KJhonWngrkP8qtzf69F7trirJubtqVM7swsR7Apr2fG';
const TRADING_WALLET1_ADDRESS = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';

// Ensure directories exist
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
  console.log(`Created directory: ${LOGS_DIR}`);
}

// Load the wallet keypair from data/wallets.json
function loadProphetWallet(): Keypair {
  console.log(`Loading Prophet wallet from ${WALLETS_PATH}...`);
  
  if (!fs.existsSync(WALLETS_PATH)) {
    throw new Error(`Wallets file not found at ${WALLETS_PATH}`);
  }
  
  // Read wallets.json
  const walletsData = JSON.parse(fs.readFileSync(WALLETS_PATH, 'utf8'));
  
  // Find the Prophet wallet by public key
  const prophetWallet = walletsData.find(wallet => 
    wallet.publicKey === PROPHET_WALLET_ADDRESS
  );
  
  if (!prophetWallet) {
    throw new Error(`Prophet wallet with address ${PROPHET_WALLET_ADDRESS} not found in ${WALLETS_PATH}`);
  }
  
  if (!prophetWallet.privateKey) {
    throw new Error(`Prophet wallet found, but it has no private key`);
  }
  
  // Convert hex string to Uint8Array
  const privateKeyHex = prophetWallet.privateKey;
  const privateKeyBuffer = Buffer.from(privateKeyHex, 'hex');
  const secretKey = new Uint8Array(privateKeyBuffer);
  
  // Create keypair from private key
  const keypair = Keypair.fromSecretKey(secretKey);
  
  // Verify that the keypair's public key matches what we expect
  if (keypair.publicKey.toString() !== PROPHET_WALLET_ADDRESS) {
    throw new Error(`Generated keypair public key ${keypair.publicKey.toString()} does not match expected ${PROPHET_WALLET_ADDRESS}`);
  }
  
  console.log(`Successfully loaded Prophet wallet: ${keypair.publicKey.toString()}`);
  return keypair;
}

// Verify wallet and check balance
async function verifyWallet(keypair: Keypair): Promise<number> {
  // Get RPC URL (use Alchemy for better reliability)
  const rpcUrl = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
  console.log(`Using RPC URL: ${rpcUrl}`);
  
  try {
    console.log(`Verifying wallet: ${keypair.publicKey.toString()}`);
    const connection = new Connection(rpcUrl, 'confirmed');
    
    // Get wallet balance
    const balance = await connection.getBalance(keypair.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    
    console.log(`Wallet balance: ${solBalance} SOL`);
    return solBalance;
  } catch (error) {
    console.error('Error verifying wallet:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// Configure Day 4 strategy with the system wallet
function configureDay4Strategy(keypair: Keypair): void {
  console.log('Configuring Day 4 Quantum Flash Strategy...');
  
  // Day 4 strategy configuration with 91% ROI
  const day4Config = {
    strategy: {
      name: 'Quantum Flash Day 4',
      type: 'FLASH_ARBITRAGE',
      description: 'High-ROI (91%) flash arbitrage strategy from Day 4 market conditions',
      version: '1.0.0',
      riskLevel: 'HIGH',
      wallet: {
        publicKey: keypair.publicKey.toString(),
        hasPrivateKey: true
      },
      params: {
        flashLoanAmount: 1.1, // SOL
        flashLoanSource: 'Solend',
        flashLoanFeePercent: 0.09,
        slippageBps: 50,
        maxHops: 4,
        routeCandidates: 3,
        priorityFee: 10000, // micro-lamports
        maxTimeout: 60000,
      },
      route: {
        dexes: ['Jupiter', 'Orca', 'Raydium', 'Mercurial'],
        // Day 4 route that demonstrated 91% ROI
        hops: [
          { from: 'SOL', to: 'USDC', dex: 'Jupiter' },
          { from: 'USDC', to: 'ETH', dex: 'Orca' },
          { from: 'ETH', to: 'SOL', dex: 'Raydium' },
          { from: 'SOL', to: 'SOL', dex: 'Mercurial', partial: true, amount: 0.95 }
        ]
      },
      expectedProfit: {
        amountSol: 1.001,
        percentageRoi: 91.0,
        description: 'Extreme opportunity from market dislocation after PEPE token launch'
      },
      minRequiredBalance: 1.2, // SOL
      created: new Date().toISOString()
    },
    rpc: {
      provider: 'Alchemy',
      url: '${process.env.ALCHEMY_API_KEY ? `https://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : "https://api.mainnet-beta.solana.com"}',
      rateLimit: {
        requestsPerMinute: 4000,
        enabled: true
      },
      fallbackProviders: ['Helius']
    },
    execution: {
      mode: 'SIMULATION', // Start in simulation mode
      verifyTransactions: true,
      recordLogs: true,
      keepPrivateKeysInMemory: false,
      maxConcurrentTransactions: 1,
      timeoutMs: 60000,
      retryCount: 3,
      lastUpdated: new Date().toISOString()
    }
  };
  
  // Write configuration to file
  fs.writeFileSync(DAY4_CONFIG_PATH, JSON.stringify(day4Config, null, 2));
  console.log(`Day 4 strategy configuration saved to ${DAY4_CONFIG_PATH}`);
}

// Create execution script
function createExecutionScript(keypair: Keypair): void {
  const scriptPath = './run-day4-strategy.sh';
  
  const scriptContent = `#!/bin/bash
# Execute Day 4 Quantum Flash Strategy
# This script executes the high-profit Day 4 strategy with 91% ROI

# Color codes for output
GREEN='\\033[0;32m'
BLUE='\\033[0;34m'
YELLOW='\\033[0;33m'
RED='\\033[0;31m'
PURPLE='\\033[0;35m'
NC='\\033[0m' # No Color

# Clear the screen
clear

# Display header
echo -e "\${PURPLE}=======================================================${NC}"
echo -e "\${PURPLE}   QUANTUM FLASH STRATEGY - DAY 4 IMPLEMENTATION       ${NC}"
echo -e "\${PURPLE}=======================================================${NC}"
echo -e "\${PURPLE}Date:${NC} 2025-05-14 (Day 4 Market Conditions)"
echo -e "\${PURPLE}Wallet:${NC} ${keypair.publicKey.toString()}"
echo -e "\${PURPLE}Flash Loan Amount:${NC} 1.1 SOL"
echo -e "\${PURPLE}Flash Loan Source:${NC} Solend (0.09% fee)"
echo -e "\${PURPLE}RPC:${NC} Alchemy (Premium)"
echo -e "\${PURPLE}=======================================================${NC}"
echo ""

# Check for Alchemy API key
if [ -z "\$ALCHEMY_API_KEY" ]; then
  echo -e "\${YELLOW}ALCHEMY_API_KEY environment variable not set.${NC}"
  echo -e "Please enter your Alchemy API key:"
  read -p "> " ALCHEMY_API_KEY
  
  if [ -z "\$ALCHEMY_API_KEY" ]; then
    echo -e "\${RED}Error: Alchemy API key is required to continue.${NC}"
    exit 1
  fi
  
  # Export the key for this session
  export ALCHEMY_API_KEY="\$ALCHEMY_API_KEY"
  export RPC_URL="https://solana-mainnet.g.alchemy.com/v2/\$ALCHEMY_API_KEY"
else
  export RPC_URL="https://solana-mainnet.g.alchemy.com/v2/\$ALCHEMY_API_KEY"
fi

echo -e "\${GREEN}✓ RPC connection configured with Alchemy${NC}"
echo ""

# Check if we want to run in simulation mode or real mode
SIMULATION_FLAG="\$1"

if [ "\$SIMULATION_FLAG" == "--real" ]; then
  echo -e "\${RED}WARNING: Running in REAL BLOCKCHAIN MODE. Real transactions will be executed!${NC}"
  echo -e "This will execute transactions with real SOL on the Solana blockchain."
  echo -e "Press Ctrl+C within 5 seconds to cancel..."
  sleep 5
  
  # Run with real transactions
  echo -e "\${YELLOW}Executing Day 4 strategy with REAL transactions...${NC}"
  npx tsx execute-quantum-flash-day4.ts --real
else
  # Run in simulation mode
  echo -e "\${BLUE}Executing Day 4 strategy in SIMULATION mode...${NC}"
  echo -e "(Use --real flag to execute with real transactions)"
  echo ""
  npx tsx execute-quantum-flash-day4.ts
fi
`;

  fs.writeFileSync(scriptPath, scriptContent);
  fs.chmodSync(scriptPath, '755'); // Make executable
  console.log(`Execution script created at ${scriptPath}`);
}

// Main function
async function main() {
  console.log('=============================================');
  console.log('🚀 PREPARING DAY 4 QUANTUM FLASH STRATEGY');
  console.log('=============================================\n');
  
  try {
    // Load Prophet wallet keypair
    const walletKeypair = loadProphetWallet();
    
    // Verify wallet and check balance
    const balance = await verifyWallet(walletKeypair);
    
    // Configure Day 4 strategy with the wallet
    configureDay4Strategy(walletKeypair);
    
    // Create execution script
    createExecutionScript(walletKeypair);
    
    console.log('\n=============================================');
    console.log('✅ DAY 4 STRATEGY PREPARATION COMPLETE');
    console.log('=============================================');
    console.log(`Prophet wallet: ${walletKeypair.publicKey.toString()}`);
    console.log(`Wallet balance: ${balance} SOL`);
    console.log(`Strategy: Quantum Flash Day 4 (91% ROI)`);
    console.log('\nTo execute the strategy in simulation mode:');
    console.log('./run-day4-strategy.sh');
    console.log('\nTo execute with real blockchain transactions:');
    console.log('./run-day4-strategy.sh --real');
    console.log('=============================================');
    
    return true;
  } catch (error) {
    console.error('Error preparing Day 4 strategy:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Run the script
main();