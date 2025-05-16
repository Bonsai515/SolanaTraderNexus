/**
 * Activate Real Trading with Real Funds
 * 
 * This script configures the system for real blockchain trading
 * with actual funds using the main wallet. All simulations are
 * disabled and real transactions will be executed.
 */

import * as fs from 'fs';
import * as path from 'path';

// Critical paths
const DATA_DIR = './data';
const CONFIG_DIR = './server/config';
const SYSTEM_MEMORY_PATH = path.join(DATA_DIR, 'system-memory.json');
const ENGINE_CONFIG_PATH = path.join(CONFIG_DIR, 'engine.json');
const WALLETS_PATH = path.join(DATA_DIR, 'wallets.json');

// Main wallet address
const MAIN_WALLET_ADDRESS = "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb";
const PROPHET_WALLET_ADDRESS = "31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e";

/**
 * Update the system memory configuration to enable real trading
 */
function updateSystemMemory(): void {
  console.log('Updating system memory configuration for real trading...');
  
  try {
    // Create directory if it doesn't exist
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    // Default configuration if file doesn't exist
    let systemMemory: any = {
      features: {},
      config: {}
    };
    
    // Load existing configuration if it exists
    if (fs.existsSync(SYSTEM_MEMORY_PATH)) {
      try {
        systemMemory = JSON.parse(fs.readFileSync(SYSTEM_MEMORY_PATH, 'utf8'));
      } catch (e) {
        console.error('Error parsing system memory:', e);
        // Continue with default config if parsing fails
      }
    }
    
    // Update trading flags to enable real trading
    systemMemory.features = {
      ...(systemMemory.features || {}),
      realTrading: true,
      simulation: false,
      testMode: false
    };
    
    // Ensure config exists
    if (!systemMemory.config) {
      systemMemory.config = {};
    }
    
    // Update trading configuration
    systemMemory.config.trading = {
      ...(systemMemory.config.trading || {}),
      useRealFunds: true,
      simulationMode: false,
      testMode: false,
      walletUpdate: true, // Enable real wallet balance updates
      maxSlippageTolerance: 1.0, // 1% slippage for real transactions
      priorityFee: "HIGH",
      confirmations: 3 // Wait for 3 confirmations for real transactions
    };
    
    // Update wallet configuration
    systemMemory.config.wallet = {
      ...(systemMemory.config.wallet || {}),
      mainWallet: MAIN_WALLET_ADDRESS,
      prophetWallet: PROPHET_WALLET_ADDRESS,
      useRealWallet: true
    };
    
    // Update last updated timestamp
    systemMemory.lastUpdated = new Date().toISOString();
    
    // Write updated configuration
    fs.writeFileSync(SYSTEM_MEMORY_PATH, JSON.stringify(systemMemory, null, 2));
    console.log(`✅ Updated system memory at ${SYSTEM_MEMORY_PATH}`);
    
    return;
  } catch (error) {
    console.error('Failed to update system memory:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Update the Nexus engine configuration for real trading
 */
function updateEngineConfig(): void {
  console.log('Updating Nexus engine configuration for real trading...');
  
  try {
    // Create config directory if it doesn't exist
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    
    // Load existing engine configuration if it exists
    let engineConfig: any = {};
    if (fs.existsSync(ENGINE_CONFIG_PATH)) {
      try {
        engineConfig = JSON.parse(fs.readFileSync(ENGINE_CONFIG_PATH, 'utf8'));
      } catch (e) {
        console.error('Error parsing engine config:', e);
        // Continue with new config if parsing fails
      }
    }
    
    // Update engine configuration for real trading
    engineConfig = {
      ...engineConfig,
      name: "Nexus Professional Engine",
      version: "3.0.0",
      useRealFunds: true,
      simulationMode: false,
      testTransactions: false,
      realBlockchainTransactions: true,
      updateWalletBalance: true,
      maxConcurrentTransactions: 5,
      priorityFeeLevels: {
        LOW: 10000,
        MEDIUM: 100000,
        HIGH: 500000,
        VERY_HIGH: 1000000,
        MAXIMUM: 5000000
      },
      defaultPriorityFee: "HIGH",
      rpcConfig: {
        mainRpc: process.env.HELIUS_API_KEY ? 
          `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}` : 
          process.env.INSTANT_NODES_RPC_URL,
        backupRpc: [
          process.env.INSTANT_NODES_RPC_URL,
          process.env.ALCHEMY_RPC_URL,
          "https://api.mainnet-beta.solana.com"
        ],
        rateLimit: {
          requestsPerMinute: 225,
          maxRetries: 5,
          retryDelay: 1000
        }
      },
      transactionConfig: {
        maxRetries: 5,
        retryDelay: 1000,
        confirmationLevel: "confirmed",
        confirmations: 3,
        maxSlippage: 1.0, // 1% slippage for real transactions
        timeout: 60000, // 60 second timeout
        skipPreflight: false // Execute preflight checks for safety
      },
      wallets: {
        main: MAIN_WALLET_ADDRESS,
        prophet: PROPHET_WALLET_ADDRESS
      }
    };
    
    // Write updated engine configuration
    fs.writeFileSync(ENGINE_CONFIG_PATH, JSON.stringify(engineConfig, null, 2));
    console.log(`✅ Updated Nexus engine configuration at ${ENGINE_CONFIG_PATH}`);
    
    return;
  } catch (error) {
    console.error('Failed to update engine configuration:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Create a dedicated real trading wallet configuration
 */
function createRealTradingWalletConfig(): void {
  console.log('Creating real trading wallet configuration...');
  
  try {
    // Create data directory if it doesn't exist
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    // Create wallet configuration
    const walletConfig = {
      version: "1.0.0",
      wallets: {
        main: {
          address: MAIN_WALLET_ADDRESS,
          type: "main",
          active: true,
          description: "Main trading wallet",
          useForTrading: true
        },
        prophet: {
          address: PROPHET_WALLET_ADDRESS,
          type: "profit",
          active: true,
          description: "Prophet wallet for profit collection",
          useForTrading: false
        }
      },
      config: {
        useRealWallet: true,
        updateBalanceAfterTrades: true,
        verifyTransactions: true,
        recordTransactions: true,
        transactionSigningMethod: "nexus"
      }
    };
    
    // Write wallet configuration
    const realWalletConfigPath = path.join(DATA_DIR, 'real-wallets.json');
    fs.writeFileSync(realWalletConfigPath, JSON.stringify(walletConfig, null, 2));
    console.log(`✅ Created real trading wallet configuration at ${realWalletConfigPath}`);
    
    return;
  } catch (error) {
    console.error('Failed to create real trading wallet configuration:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Update trading strategy configurations for real trading
 */
function updateStrategyConfigs(): void {
  console.log('Updating trading strategy configurations for real trading...');
  
  try {
    const strategiesConfigPath = path.join(CONFIG_DIR, 'strategies.json');
    
    if (fs.existsSync(strategiesConfigPath)) {
      // Load existing strategies
      const strategies = JSON.parse(fs.readFileSync(strategiesConfigPath, 'utf8'));
      
      // Update each strategy to use real trading
      strategies.forEach((strategy) => {
        strategy.config = strategy.config || {};
        
        // Enable real trading for this strategy
        strategy.config.useRealFunds = true;
        strategy.config.simulationMode = false;
        
        // Set reasonable trade sizes for real trading
        if (strategy.type === 'FLASH_ARBITRAGE') {
          strategy.config.maxAmount = 100; // USD
          strategy.config.minProfitThreshold = 0.5; // %
        } else if (strategy.type === 'MEME_SNIPER') {
          strategy.config.maxAmount = 50; // USD
          strategy.config.minROIThreshold = 5.0; // %
        } else if (strategy.type === 'CROSS_CHAIN_ARB') {
          strategy.config.maxAmount = 75; // USD
          strategy.config.minProfitThreshold = 0.8; // %
        }
        
        // Enable real wallet balance updates
        strategy.config.updateWalletBalance = true;
      });
      
      // Write updated strategies
      fs.writeFileSync(strategiesConfigPath, JSON.stringify(strategies, null, 2));
      console.log(`✅ Updated trading strategies for real trading at ${strategiesConfigPath}`);
    } else {
      console.warn(`⚠️ Strategies configuration not found at ${strategiesConfigPath}`);
    }
    
    return;
  } catch (error) {
    console.error('Failed to update strategy configurations:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Create configuration for transaction verification
 */
function createTransactionVerificationConfig(): void {
  console.log('Creating transaction verification configuration...');
  
  try {
    // Create config directory if it doesn't exist
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    
    // Create transaction verification configuration
    const verificationConfig = {
      enabled: true,
      verifyAllTransactions: true,
      methods: {
        solscan: true,
        explorer: true,
        rpcConfirmation: true
      },
      requiredConfirmations: 3,
      recordTransactions: true,
      recordPath: path.join(DATA_DIR, 'transactions'),
      alertOnFailure: true,
      alertOnSuccess: true,
      minVerificationAmount: 0, // Verify all transactions, no minimum
      maxWaitTimeMs: 60000 // 60 seconds max wait
    };
    
    // Write verification configuration
    const verificationConfigPath = path.join(CONFIG_DIR, 'verification.json');
    fs.writeFileSync(verificationConfigPath, JSON.stringify(verificationConfig, null, 2));
    console.log(`✅ Created transaction verification configuration at ${verificationConfigPath}`);
    
    return;
  } catch (error) {
    console.error('Failed to create transaction verification configuration:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Create safety configuration to protect real funds
 */
function createSafetyConfig(): void {
  console.log('Creating safety configuration to protect real funds...');
  
  try {
    // Create config directory if it doesn't exist
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    
    // Create safety configuration
    const safetyConfig = {
      enabled: true,
      maxDailyTransactions: 100,
      maxDailyVolume: 500, // USD
      maxTransactionAmount: 100, // USD
      stopLoss: {
        enabled: true,
        threshold: 5.0, // 5% loss triggers stop
        cooldownMinutes: 60 // 1 hour cooldown after stop loss
      },
      profitTaking: {
        enabled: true,
        threshold: 10.0, // 10% profit triggers take profit
        percentage: 50 // Take 50% of profits
      },
      riskLevels: {
        low: {
          maxAmount: 25, // USD
          slippage: 0.5 // %
        },
        medium: {
          maxAmount: 50, // USD
          slippage: 1.0 // %
        },
        high: {
          maxAmount: 100, // USD
          slippage: 2.0 // %
        }
      },
      tokenSafety: {
        requireLiquidity: true,
        minLiquidityUsd: 50000, // USD
        excludeNonVerified: true
      }
    };
    
    // Write safety configuration
    const safetyConfigPath = path.join(CONFIG_DIR, 'safety.json');
    fs.writeFileSync(safetyConfigPath, JSON.stringify(safetyConfig, null, 2));
    console.log(`✅ Created safety configuration at ${safetyConfigPath}`);
    
    return;
  } catch (error) {
    console.error('Failed to create safety configuration:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Main function to activate real trading
 */
function main(): void {
  console.log('=============================================');
  console.log('🚀 ACTIVATING REAL TRADING WITH REAL FUNDS');
  console.log('=============================================\n');
  
  try {
    console.log(`👛 Main Trading Wallet: ${MAIN_WALLET_ADDRESS}`);
    console.log(`💰 Prophet Profit Wallet: ${PROPHET_WALLET_ADDRESS}`);
    console.log('');
    
    // Step 1: Update system memory
    updateSystemMemory();
    
    // Step 2: Update Nexus engine configuration
    updateEngineConfig();
    
    // Step 3: Create real trading wallet configuration
    createRealTradingWalletConfig();
    
    // Step 4: Update trading strategy configurations
    updateStrategyConfigs();
    
    // Step 5: Create transaction verification configuration
    createTransactionVerificationConfig();
    
    // Step 6: Create safety configuration
    createSafetyConfig();
    
    console.log('\n✅ REAL TRADING SUCCESSFULLY ACTIVATED');
    console.log('Your trading system will now execute REAL blockchain transactions');
    console.log('with REAL funds from your wallet.');
    console.log('');
    console.log('IMPORTANT SAFETY FEATURES ENABLED:');
    console.log('- Maximum transaction amount: $100');
    console.log('- 1% maximum slippage tolerance');
    console.log('- 3 confirmations required for each transaction');
    console.log('- Stop-loss protection at 5% loss');
    console.log('- Transaction verification through Solscan');
    console.log('- Wallet balance updates after each trade');
    console.log('\nRestart the trading system with:');
    console.log('npx tsx server/index.ts');
    console.log('=============================================');
    
    return;
  } catch (error) {
    console.error('Failed to activate real trading:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the script
main();