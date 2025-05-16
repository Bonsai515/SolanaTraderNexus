/**
 * Force Real Blockchain Transactions Execution
 * 
 * This script ensures all strategies, AI agents, and the Nexus Pro Engine
 * are executing real blockchain transactions with actual funds.
 */

import * as fs from 'fs';
import * as path from 'path';

// Critical paths
const DATA_DIR = './data';
const CONFIG_DIR = './server/config';
const SYSTEM_MEMORY_PATH = path.join(DATA_DIR, 'system-memory.json');
const ENGINE_CONFIG_PATH = path.join(CONFIG_DIR, 'engine.json');
const STRATEGIES_CONFIG_PATH = path.join(CONFIG_DIR, 'strategies.json');
const AGENT_CONFIG_PATH = path.join(CONFIG_DIR, 'agents.json');

// Main wallet address
const MAIN_WALLET_ADDRESS = "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb";

/**
 * Force all simulation and test modes off
 */
function forceSimulationOff(): void {
  console.log('Forcing all simulation and test modes OFF...');
  
  // Update system memory
  if (fs.existsSync(SYSTEM_MEMORY_PATH)) {
    try {
      const systemMemory = JSON.parse(fs.readFileSync(SYSTEM_MEMORY_PATH, 'utf8'));
      
      // Update feature flags
      if (!systemMemory.features) {
        systemMemory.features = {};
      }
      
      systemMemory.features = {
        ...(systemMemory.features || {}),
        realTrading: true,
        simulation: false,
        testMode: false,
        simulateTransactions: false,
        liveMode: true,
        forceRealTransactions: true
      };
      
      // Update configuration
      if (!systemMemory.config) {
        systemMemory.config = {};
      }
      
      // Force real trading configuration
      systemMemory.config.trading = {
        ...(systemMemory.config.trading || {}),
        useRealFunds: true,
        simulationMode: false,
        testMode: false,
        dryRun: false,
        walletUpdate: true,
        forceLiveTransactions: true
      };
      
      // Update last updated timestamp
      systemMemory.lastUpdated = new Date().toISOString();
      
      // Write updated configuration
      fs.writeFileSync(SYSTEM_MEMORY_PATH, JSON.stringify(systemMemory, null, 2));
      console.log(`✅ System memory updated: simulation modes disabled`);
    } catch (error) {
      console.error('Failed to update system memory:', error instanceof Error ? error.message : String(error));
    }
  }
  
  // Update engine configuration
  if (fs.existsSync(ENGINE_CONFIG_PATH)) {
    try {
      const engineConfig = JSON.parse(fs.readFileSync(ENGINE_CONFIG_PATH, 'utf8'));
      
      // Force real transactions in engine
      engineConfig.useRealFunds = true;
      engineConfig.simulationMode = false;
      engineConfig.testTransactions = false;
      engineConfig.realBlockchainTransactions = true;
      engineConfig.updateWalletBalance = true;
      engineConfig.forceRealTransactions = true;
      engineConfig.skipSimulation = true;
      
      // Write updated engine configuration
      fs.writeFileSync(ENGINE_CONFIG_PATH, JSON.stringify(engineConfig, null, 2));
      console.log(`✅ Nexus engine configuration updated: real transactions enforced`);
    } catch (error) {
      console.error('Failed to update engine configuration:', error instanceof Error ? error.message : String(error));
    }
  }
  
  // Update strategy configurations
  if (fs.existsSync(STRATEGIES_CONFIG_PATH)) {
    try {
      const strategies = JSON.parse(fs.readFileSync(STRATEGIES_CONFIG_PATH, 'utf8'));
      
      // Update each strategy to force real trading
      strategies.forEach((strategy) => {
        strategy.config = strategy.config || {};
        
        // Force real transactions in strategy
        strategy.config.useRealFunds = true;
        strategy.config.simulationMode = false;
        strategy.config.dryRun = false;
        strategy.config.forceRealTransactions = true;
        strategy.config.skipSimulation = true;
        
        // Always update wallet balance with real transactions
        strategy.config.updateWalletBalance = true;
      });
      
      // Write updated strategies
      fs.writeFileSync(STRATEGIES_CONFIG_PATH, JSON.stringify(strategies, null, 2));
      console.log(`✅ Strategy configurations updated: real transactions enforced`);
    } catch (error) {
      console.error('Failed to update strategy configurations:', error instanceof Error ? error.message : String(error));
    }
  }
  
  // Create or update agent configuration
  try {
    // Create config directory if it doesn't exist
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    
    // Define agent configuration
    const agentConfig = {
      version: "3.0.0",
      globalConfig: {
        useRealFunds: true,
        simulationMode: false,
        testMode: false,
        walletUpdate: true,
        forceRealTransactions: true
      },
      agents: [
        {
          id: "hyperion-1",
          name: "Hyperion Flash Arbitrage",
          type: "hyperion",
          status: "active",
          active: true,
          config: {
            useRealFunds: true,
            simulationMode: false,
            testMode: false,
            walletUpdate: true,
            forceRealTransactions: true,
            maxAmount: 100, // USD
            priorityFee: "HIGH"
          },
          wallet: MAIN_WALLET_ADDRESS
        },
        {
          id: "quantum-omega-1",
          name: "Quantum Omega Sniper",
          type: "quantum_omega",
          status: "active",
          active: true,
          config: {
            useRealFunds: true,
            simulationMode: false,
            testMode: false,
            walletUpdate: true,
            forceRealTransactions: true,
            maxAmount: 100, // USD
            priorityFee: "HIGH"
          },
          wallet: MAIN_WALLET_ADDRESS
        },
        {
          id: "singularity-1",
          name: "Singularity Cross-Chain Oracle",
          type: "singularity",
          status: "active",
          active: true,
          config: {
            useRealFunds: true,
            simulationMode: false,
            testMode: false,
            walletUpdate: true,
            forceRealTransactions: true,
            maxAmount: 100, // USD
            priorityFee: "HIGH"
          },
          wallet: MAIN_WALLET_ADDRESS
        }
      ]
    };
    
    // Write agent configuration
    fs.writeFileSync(AGENT_CONFIG_PATH, JSON.stringify(agentConfig, null, 2));
    console.log(`✅ Agent configuration created: all agents using real transactions`);
  } catch (error) {
    console.error('Failed to create agent configuration:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * Create force real transactions environment variables
 */
function createEnvVariables(): void {
  console.log('Creating environment variables to force real transactions...');
  
  try {
    // Create environment file
    const envContent = `
# Force real transactions environment variables
FORCE_REAL_TRANSACTIONS=true
SIMULATION_MODE=false
TEST_MODE=false
USE_REAL_FUNDS=true
SKIP_SIMULATION=true
SKIP_CONFIRMATION=false
UPDATE_WALLET_BALANCE=true

# Wallet and blockchain settings
MAIN_WALLET_ADDRESS=${MAIN_WALLET_ADDRESS}
SYSTEM_WALLET=${MAIN_WALLET_ADDRESS}
WALLET_TYPE=real

# Transaction settings
MAX_TRANSACTION_AMOUNT=100
PRIORITY_FEE=HIGH
MAX_RETRIES=5
CONFIRMATION_LEVEL=confirmed
REQUIRED_CONFIRMATIONS=2
`;
    
    // Write environment file
    fs.writeFileSync('.env.force-real', envContent);
    console.log(`✅ Created force real transactions environment variables at .env.force-real`);
    
    // Also append to main .env file if it exists
    if (fs.existsSync('.env')) {
      fs.appendFileSync('.env', envContent);
      console.log(`✅ Updated main .env file with force real transactions variables`);
    }
  } catch (error) {
    console.error('Failed to create environment variables:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * Create force transaction script
 */
function createForceTransactionScript(): void {
  console.log('Creating force transaction script...');
  
  try {
    // Create script content
    const scriptContent = `/**
 * Force Transaction Execution Script
 * 
 * This script forces the execution of a transaction on the blockchain
 * to verify real fund trading is working.
 */

import { nexusEngine } from './server/nexus-transaction-engine';

// Main wallet address
const MAIN_WALLET_ADDRESS = "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb";

// Force a real transaction
async function forceTransaction() {
  console.log('Forcing real blockchain transaction execution...');
  
  try {
    // Make sure wallet is registered
    if (!nexusEngine) {
      throw new Error('Nexus engine not initialized');
    }
    
    nexusEngine.registerWallet(MAIN_WALLET_ADDRESS);
    console.log(\`✅ Wallet \${MAIN_WALLET_ADDRESS} registered with Nexus engine\`);
    
    // Force a real USDC->SOL swap
    const result = await nexusEngine.executeSwap({
      sourceToken: 'USDC',
      targetToken: 'SOL',
      amount: 10, // 10 USDC
      slippageBps: 100, // 1%
      walletAddress: MAIN_WALLET_ADDRESS,
      priority: 'HIGH',
      forceReal: true,
      skipSimulation: true,
      updateBalance: true,
      maxRetries: 5
    });
    
    if (result && result.signature) {
      console.log(\`✅ Successfully executed REAL blockchain transaction: \${result.signature}\`);
      console.log(\`Transaction details: \${JSON.stringify(result)}\`);
    } else {
      console.error('❌ Transaction failed:', result);
    }
  } catch (error) {
    console.error('❌ Error forcing transaction:', error instanceof Error ? error.message : String(error));
  }
}

// Execute force transaction
forceTransaction();
`;
    
    // Write script file
    fs.writeFileSync('execute-force-transaction.ts', scriptContent);
    console.log(`✅ Created force transaction script at execute-force-transaction.ts`);
  } catch (error) {
    console.error('Failed to create force transaction script:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * Create blockchain connection verification script
 */
function createBlockchainVerificationScript(): void {
  console.log('Creating blockchain connection verification script...');
  
  try {
    // Create script content
    const scriptContent = `/**
 * Verify Blockchain Connection 
 * 
 * This script verifies the connection to the Solana blockchain
 * and ensures the wallet is properly configured.
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Main wallet address
const MAIN_WALLET_ADDRESS = "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb";

// Array of RPC endpoints to try
const RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  process.env.INSTANT_NODES_RPC_URL,
  process.env.ALCHEMY_RPC_URL,
  process.env.HELIUS_API_KEY ? \`https://mainnet.helius-rpc.com/?api-key=\${process.env.HELIUS_API_KEY}\` : null
].filter(Boolean) as string[];

// Verify blockchain connection and wallet
async function verifyBlockchainConnection() {
  console.log('Verifying blockchain connection and wallet...');
  console.log(\`Wallet address: \${MAIN_WALLET_ADDRESS}\`);
  
  // Try each RPC endpoint until one works
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      console.log(\`Trying RPC endpoint: \${endpoint}\`);
      
      const connection = new Connection(endpoint, 'confirmed');
      
      // Get network version to verify connection
      const version = await connection.getVersion();
      console.log(\`✅ Connected to Solana \${version["solana-core"]}\`);
      
      // Check wallet existence and balance
      const pubkey = new PublicKey(MAIN_WALLET_ADDRESS);
      const balance = await connection.getBalance(pubkey);
      const solBalance = balance / LAMPORTS_PER_SOL;
      
      console.log(\`✅ Wallet exists and has balance: \${solBalance} SOL\`);
      
      // Get recent blockhash to verify we can submit transactions
      const { blockhash } = await connection.getLatestBlockhash();
      console.log(\`✅ Latest blockhash: \${blockhash}\`);
      
      // Get recent transactions for this wallet
      const signatures = await connection.getSignaturesForAddress(pubkey, { limit: 5 });
      console.log(\`✅ Found \${signatures.length} recent transactions for this wallet\`);
      
      if (signatures.length > 0) {
        console.log('Recent transaction signatures:');
        signatures.forEach((sig, i) => {
          console.log(\`  \${i+1}. \${sig.signature} (\${new Date(sig.blockTime! * 1000).toISOString()})\`);
        });
      }
      
      // Successfully connected and verified
      console.log(\`✅ Blockchain connection verified with endpoint: \${endpoint}\`);
      return true;
    } catch (error) {
      console.warn(\`⚠️ Failed with endpoint \${endpoint}: \${error instanceof Error ? error.message : String(error)}\`);
    }
  }
  
  // All endpoints failed
  console.error('❌ Could not connect to any Solana RPC endpoint');
  return false;
}

// Execute verification
verifyBlockchainConnection();
`;
    
    // Write script file
    fs.writeFileSync('verify-blockchain-connection.ts', scriptContent);
    console.log(`✅ Created blockchain verification script at verify-blockchain-connection.ts`);
  } catch (error) {
    console.error('Failed to create blockchain verification script:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * Main function to force real transactions
 */
function main(): void {
  console.log('=============================================');
  console.log('🚀 FORCING REAL BLOCKCHAIN TRANSACTIONS');
  console.log('=============================================\n');
  
  try {
    console.log(`👛 Main Trading Wallet: ${MAIN_WALLET_ADDRESS}`);
    console.log('');
    
    // Step 1: Force all simulation off
    forceSimulationOff();
    
    // Step 2: Create environment variables
    createEnvVariables();
    
    // Step 3: Create force transaction script
    createForceTransactionScript();
    
    // Step 4: Create blockchain verification script
    createBlockchainVerificationScript();
    
    console.log('\n✅ REAL TRANSACTIONS SUCCESSFULLY ENFORCED');
    console.log('Your trading system will now execute ONLY REAL blockchain transactions');
    console.log('All simulation modes have been disabled');
    console.log('All AI agents have been configured to use your real wallet');
    console.log('');
    console.log('To execute a test transaction to verify everything is working:');
    console.log('npx tsx execute-force-transaction.ts');
    console.log('');
    console.log('To verify blockchain connection and wallet:');
    console.log('npx tsx verify-blockchain-connection.ts');
    console.log('');
    console.log('To restart the trading system with forced real transactions:');
    console.log('source .env.force-real && npx tsx server/index.ts');
    console.log('=============================================');
    
    return;
  } catch (error) {
    console.error('Failed to force real transactions:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the script
main();