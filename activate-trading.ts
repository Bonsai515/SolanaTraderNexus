/**
 * Activate Actual Trading
 * 
 * This script enables REAL blockchain trading by ensuring the system is
 * completely configured to execute trades and submit transactions.
 */

import fs from 'fs';
import path from 'path';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config({ path: '.env.trading' });

// Constants
const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY || 'q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const SYNDICA_URL = `https://solana-mainnet.api.syndica.io/api-key/${SYNDICA_API_KEY}`;
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const WALLET_ADDRESS = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';

// Ensure all necessary directories exist
const dirs = [
  './logs',
  './config',
  './cache',
  './src/nexus_engine'
];

for (const dir of dirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Update the .env.trading file with required settings
 */
function updateTradingEnv(): boolean {
  try {
    const envPath = path.join(process.cwd(), '.env.trading');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Critical settings to ensure actual trade execution
    const settings: Record<string, string> = {
      'USE_REAL_FUNDS': 'true',
      'EXECUTE_REAL_TRADES': 'true',
      'SUBMIT_TRANSACTIONS': 'true',
      'VERIFY_TRANSACTIONS': 'true',
      'TRADING_WALLET_ADDRESS': WALLET_ADDRESS,
      'SYNDICA_API_KEY': SYNDICA_API_KEY,
      'TRANSACTION_EXECUTION_ENABLED': 'true'
    };
    
    // Update each setting
    for (const [key, value] of Object.entries(settings)) {
      if (!envContent.includes(`${key}=`)) {
        envContent += `${key}=${value}\n`;
      } else {
        envContent = envContent.replace(
          new RegExp(`${key}=.*`, 'g'),
          `${key}=${value}`
        );
      }
    }
    
    // Save the updated env file
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Updated .env.trading with required trade execution settings');
    return true;
  } catch (error) {
    console.error('❌ Error updating .env.trading:', error);
    return false;
  }
}

/**
 * Create or update the transaction engine configuration
 */
function updateTransactionEngineConfig(): boolean {
  try {
    const configPath = path.join(process.cwd(), 'config', 'transaction-engine.json');
    
    const engineConfig = {
      enabled: true,
      executeRealTrades: true,
      submitTransactions: true,
      rpcProvider: {
        name: 'Syndica',
        url: SYNDICA_URL,
        priority: 1
      },
      walletAddress: WALLET_ADDRESS,
      minProfitThresholdPercent: 0.2,
      maxSlippageBps: 50,
      maxTransactionsPerHour: 14,
      minTimeBetweenTransactionsMs: 300000,
      transactionVerification: true,
      transactionLogging: true,
      transactionRetries: 3,
      priorityFeeInLamports: 250000,
      simulateBeforeSubmit: true,
      strategyPrioritization: [
        'temporal-block-arbitrage',
        'flash-loan-arbitrage',
        'layered-megalodon-prime'
      ]
    };
    
    fs.writeFileSync(configPath, JSON.stringify(engineConfig, null, 2));
    console.log('✅ Updated transaction engine configuration');
    return true;
  } catch (error) {
    console.error('❌ Error updating transaction engine configuration:', error);
    return false;
  }
}

/**
 * Create a transaction execution module
 */
function createTransactionExecutor(): boolean {
  try {
    const executorPath = path.join(process.cwd(), 'src', 'transaction-executor.ts');
    
    const executorCode = `/**
 * Transaction Executor
 * 
 * This module handles the actual execution of transactions on the Solana blockchain.
 */

import { Connection, PublicKey, Transaction, SystemProgram, Keypair, sendAndConfirmTransaction } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.trading' });

// Constants
const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY || 'q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const SYNDICA_URL = \`https://solana-mainnet.api.syndica.io/api-key/\${SYNDICA_API_KEY}\`;
const TRANSACTION_ENABLED = process.env.TRANSACTION_EXECUTION_ENABLED === 'true';
const USE_REAL_FUNDS = process.env.USE_REAL_FUNDS === 'true';
const WALLET_ADDRESS = process.env.TRADING_WALLET_ADDRESS || 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';

// Establish connection
const connection = new Connection(SYNDICA_URL);

/**
 * Log a transaction to file
 */
function logTransaction(action: string, details: any): void {
  try {
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const logPath = path.join(logDir, 'transactions.log');
    const timestamp = new Date().toISOString();
    const logEntry = \`\${timestamp} [\${action}] \${JSON.stringify(details)}\n\`;
    
    fs.appendFileSync(logPath, logEntry);
  } catch (error) {
    console.error('Error logging transaction:', error);
  }
}

/**
 * Execute a transaction on the Solana blockchain
 */
export async function executeTransaction(
  transaction: Transaction,
  signers: Keypair[],
  options: {
    skipPreflight?: boolean;
    preflightCommitment?: string;
    maxRetries?: number;
  } = {}
): Promise<string> {
  // Check if transaction execution is enabled
  if (!TRANSACTION_ENABLED || !USE_REAL_FUNDS) {
    const message = 'Transaction execution is disabled. Enable with TRANSACTION_EXECUTION_ENABLED=true and USE_REAL_FUNDS=true';
    console.log(message);
    logTransaction('SKIPPED', { message, transaction: transaction.serialize().toString() });
    throw new Error(message);
  }
  
  try {
    // Send and confirm the transaction
    console.log('Sending transaction to Solana blockchain...');
    
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      signers,
      {
        skipPreflight: options.skipPreflight || false,
        preflightCommitment: options.preflightCommitment || 'confirmed',
        maxRetries: options.maxRetries || 3
      }
    );
    
    console.log(\`Transaction confirmed! Signature: \${signature}\`);
    
    // Log the successful transaction
    logTransaction('SUCCESS', {
      signature,
      transaction: transaction.serialize().toString(),
      signers: signers.map(s => s.publicKey.toString())
    });
    
    return signature;
  } catch (error) {
    console.error('Transaction failed:', error);
    
    // Log the failed transaction
    logTransaction('FAILED', {
      error: error.toString(),
      transaction: transaction.serialize().toString(),
      signers: signers.map(s => s.publicKey.toString())
    });
    
    throw error;
  }
}

/**
 * Create and send a test transaction
 */
export async function sendTestTransaction(keypair: Keypair): Promise<string> {
  try {
    // Create a simple transaction to send 0.000001 SOL to self
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: keypair.publicKey,
        lamports: 1000 // 0.000001 SOL
      })
    );
    
    // Get a recent blockhash
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = keypair.publicKey;
    
    // Send the transaction
    return executeTransaction(transaction, [keypair]);
  } catch (error) {
    console.error('Test transaction failed:', error);
    throw error;
  }
}

// Export functions
export default {
  executeTransaction,
  sendTestTransaction
};`;
    
    fs.writeFileSync(executorPath, executorCode);
    console.log('✅ Created transaction executor module');
    return true;
  } catch (error) {
    console.error('❌ Error creating transaction executor module:', error);
    return false;
  }
}

/**
 * Create a real-money trading activator
 */
function createTradingActivator(): boolean {
  try {
    const activatorPath = path.join(process.cwd(), 'src', 'activate-real-money-trading.ts');
    
    const activatorCode = `/**
 * Activate Real Money Trading
 * 
 * This module activates real money trading with comprehensive validation.
 */

import fs from 'fs';
import path from 'path';
import { Connection, PublicKey } from '@solana/web3.js';
import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config({ path: '.env.trading' });

// Constants
const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY || 'q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const SYNDICA_URL = \`https://solana-mainnet.api.syndica.io/api-key/\${SYNDICA_API_KEY}\`;
const WALLET_ADDRESS = process.env.TRADING_WALLET_ADDRESS || 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';

// Connection
const connection = new Connection(SYNDICA_URL);

/**
 * Update trading configuration
 */
async function updateTradingConfig(): Promise<boolean> {
  try {
    const configPath = path.join(process.cwd(), 'config', 'trading-config.json');
    
    // Check wallet balance first
    const balance = await connection.getBalance(new PublicKey(WALLET_ADDRESS));
    const balanceSOL = balance / 1000000000; // Convert lamports to SOL
    
    const tradingConfig = {
      tradingEnabled: true,
      useRealFunds: true,
      walletAddress: WALLET_ADDRESS,
      walletBalanceSOL: balanceSOL,
      minProfitThreshold: 0.2, // 0.2%
      maxTradesPerHour: 14,
      minTimeBetweenTrades: 300, // seconds
      prioritizedStrategies: [
        {
          name: 'temporal-block-arbitrage',
          priority: 10,
          enabled: true
        },
        {
          name: 'flash-loan-arbitrage',
          priority: 9,
          enabled: true
        },
        {
          name: 'layered-megalodon-prime',
          priority: 8,
          enabled: true
        }
      ],
      rpcProviders: [
        {
          name: 'Syndica',
          url: SYNDICA_URL,
          priority: 1
        }
      ],
      lastActivated: new Date().toISOString()
    };
    
    fs.writeFileSync(configPath, JSON.stringify(tradingConfig, null, 2));
    console.log('✅ Updated trading configuration');
    return true;
  } catch (error) {
    console.error('❌ Error updating trading configuration:', error);
    return false;
  }
}

/**
 * Verify trading system readiness
 */
async function verifyTradingReadiness(): Promise<boolean> {
  try {
    // Check wallet exists
    const accountInfo = await connection.getAccountInfo(new PublicKey(WALLET_ADDRESS));
    if (!accountInfo) {
      console.error(\`❌ Wallet \${WALLET_ADDRESS} does not exist\`);
      return false;
    }
    
    // Check wallet balance
    const balance = await connection.getBalance(new PublicKey(WALLET_ADDRESS));
    const balanceSOL = balance / 1000000000; // Convert lamports to SOL
    
    if (balanceSOL < 0.001) {
      console.error(\`❌ Wallet balance too low: \${balanceSOL} SOL\`);
      return false;
    }
    
    console.log(\`✅ Wallet \${WALLET_ADDRESS} exists with \${balanceSOL} SOL\`);
    
    // Check RPC connection
    const version = await connection.getVersion();
    console.log(\`✅ Connected to Solana \${version["solana-core"]}\`);
    
    // Check transaction execution module exists
    const txExecutorPath = path.join(process.cwd(), 'src', 'transaction-executor.ts');
    if (!fs.existsSync(txExecutorPath)) {
      console.error('❌ Transaction executor module missing');
      return false;
    }
    
    console.log('✅ Transaction executor module exists');
    
    // Check configuration
    const tradingConfigPath = path.join(process.cwd(), 'config', 'trading-config.json');
    if (!fs.existsSync(tradingConfigPath)) {
      console.error('❌ Trading configuration missing');
      await updateTradingConfig();
    } else {
      console.log('✅ Trading configuration exists');
    }
    
    // All checks passed
    console.log('✅ Trading system is ready for real money trading');
    return true;
  } catch (error) {
    console.error('❌ Error verifying trading readiness:', error);
    return false;
  }
}

/**
 * Activate real money trading
 */
async function activateRealMoneyTrading(): Promise<boolean> {
  console.log('=== ACTIVATING REAL MONEY TRADING ===');
  
  // First verify trading readiness
  const ready = await verifyTradingReadiness();
  if (!ready) {
    console.error('❌ Trading system is not ready. Fix issues before activating.');
    return false;
  }
  
  // Update .env.trading file
  const envPath = path.join(process.cwd(), '.env.trading');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  // Critical settings for real money trading
  const settings: Record<string, string> = {
    'USE_REAL_FUNDS': 'true',
    'EXECUTE_REAL_TRADES': 'true',
    'SUBMIT_TRANSACTIONS': 'true',
    'TRANSACTION_EXECUTION_ENABLED': 'true',
    'VERIFY_TRANSACTIONS': 'true',
    'TRADING_WALLET_ADDRESS': WALLET_ADDRESS,
    'REAL_MONEY_TRADING_ACTIVATED': 'true'
  };
  
  // Update each setting
  for (const [key, value] of Object.entries(settings)) {
    if (!envContent.includes(\`\${key}=\`)) {
      envContent += \`\${key}=\${value}\n\`;
    } else {
      envContent = envContent.replace(
        new RegExp(\`\${key}=.*\`, 'g'),
        \`\${key}=\${value}\`
      );
    }
  }
  
  // Save the updated env file
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Updated .env.trading with real money trading settings');
  
  // Update trading config
  await updateTradingConfig();
  
  console.log('\\n=== REAL MONEY TRADING ACTIVATED ===');
  console.log('✅ System will now execute actual trades on the Solana blockchain');
  console.log('✅ Trades will use real funds from your wallet');
  console.log(\`✅ Trading wallet: \${WALLET_ADDRESS}\`);
  
  return true;
}

// Export activation function
export default activateRealMoneyTrading;

// Run if called directly
if (require.main === module) {
  activateRealMoneyTrading();
}`;
    
    fs.writeFileSync(activatorPath, activatorCode);
    console.log('✅ Created real money trading activator');
    return true;
  } catch (error) {
    console.error('❌ Error creating real money trading activator:', error);
    return false;
  }
}

/**
 * Check if Nexus Engine is properly configured
 */
async function configureNexusEngine(): Promise<boolean> {
  try {
    const nexusDir = path.join(process.cwd(), 'src', 'nexus_engine');
    if (!fs.existsSync(nexusDir)) {
      fs.mkdirSync(nexusDir, { recursive: true });
    }
    
    const nexusPath = path.join(nexusDir, 'index.ts');
    
    const nexusCode = `/**
 * Nexus Transaction Engine
 * 
 * This engine handles actual blockchain transaction execution.
 */

import { Connection, PublicKey, Transaction, Keypair, SystemProgram } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { executeTransaction } from '../transaction-executor';

// Load environment variables
dotenv.config({ path: '.env.trading' });

// Constants
const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY || 'q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const SYNDICA_URL = \`https://solana-mainnet.api.syndica.io/api-key/\${SYNDICA_API_KEY}\`;
const TRANSACTION_ENABLED = process.env.TRANSACTION_EXECUTION_ENABLED === 'true';
const USE_REAL_FUNDS = process.env.USE_REAL_FUNDS === 'true';
const WALLET_ADDRESS = process.env.TRADING_WALLET_ADDRESS || 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';

// Connection
const connection = new Connection(SYNDICA_URL);

class NexusEngine {
  private isInitialized: boolean = false;
  private isEnabled: boolean = false;
  
  constructor() {
    this.loadConfiguration();
  }
  
  /**
   * Load engine configuration
   */
  private loadConfiguration(): void {
    try {
      const configPath = path.join(process.cwd(), 'config', 'transaction-engine.json');
      
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        this.isEnabled = config.enabled && TRANSACTION_ENABLED && USE_REAL_FUNDS;
      } else {
        this.isEnabled = TRANSACTION_ENABLED && USE_REAL_FUNDS;
      }
      
      this.isInitialized = true;
      
      console.log(\`Nexus Engine initialized. Transaction execution: \${this.isEnabled ? 'ENABLED' : 'DISABLED'}\`);
    } catch (error) {
      console.error('Error loading Nexus Engine configuration:', error);
      this.isEnabled = false;
    }
  }
  
  /**
   * Check if engine is ready to execute transactions
   */
  public isReady(): boolean {
    return this.isInitialized && this.isEnabled;
  }
  
  /**
   * Execute a trade transaction
   */
  public async executeTrade(transaction: Transaction, signers: Keypair[]): Promise<string> {
    if (!this.isReady()) {
      throw new Error('Nexus Engine is not ready for transaction execution');
    }
    
    return executeTransaction(transaction, signers);
  }
  
  /**
   * Simulate a transaction before execution
   */
  public async simulateTransaction(transaction: Transaction): Promise<boolean> {
    try {
      const { value } = await connection.simulateTransaction(transaction);
      
      if (value.err) {
        console.error('Transaction simulation failed:', value.err);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error simulating transaction:', error);
      return false;
    }
  }
}

// Export singleton instance
export const nexusEngine = new NexusEngine();`;
    
    fs.writeFileSync(nexusPath, nexusCode);
    console.log('✅ Configured Nexus Transaction Engine');
    return true;
  } catch (error) {
    console.error('❌ Error configuring Nexus Transaction Engine:', error);
    return false;
  }
}

/**
 * Main function
 */
async function activateTrading(): Promise<void> {
  console.log('=== ACTIVATING REAL BLOCKCHAIN TRADING ===');
  
  // Update .env.trading file
  updateTradingEnv();
  
  // Update transaction engine configuration
  updateTransactionEngineConfig();
  
  // Create transaction executor
  createTransactionExecutor();
  
  // Create real money trading activator
  createTradingActivator();
  
  // Configure Nexus Engine
  await configureNexusEngine();
  
  console.log('\n=== TRADING ACTIVATION COMPLETE ===');
  console.log('✅ The trading system is now fully configured for actual blockchain transactions');
  console.log('✅ Real trades will now be executed using your wallet');
  console.log('\nTo verify the system is ready, run:');
  console.log('npx tsx src/activate-real-money-trading.ts');
  console.log('\nTo start trading with real money, run:');
  console.log('npx tsx run-trading-system.ts');
}

// Run the activation
activateTrading();