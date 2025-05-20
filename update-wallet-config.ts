/**
 * Update Wallet Configuration
 * 
 * This script updates the wallet configuration to use only the accessible wallet
 * and prepare for tomorrow's upgrades (additional capital, premium RPC, Jupiter API).
 */

import fs from 'fs';
import path from 'path';
import { PublicKey } from '@solana/web3.js';
import { config } from 'dotenv';

// Load environment variables
config();

// Main wallet address
const MAIN_WALLET_ADDRESS = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';

// HX wallet address to remove
const HX_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';

// Configuration files to update
const CONFIG_FILES = [
  'config/wallet-config.json',
  'config/trading-config.json',
  'config/system-config.json',
  'config/nexus-engine-config.json',
  'config/transaction-engine.json',
  'config/quantum-flash-config.json',
  'config/zero-capital-flash-config.json',
  'config/hyperion-cascade-flash-config.json',
  'config/temporal-block-strategy.json',
  'config/ultimate-nuclear-config.json',
  'config/neural-transformer-config.json'
];

// Update wallet configuration files
function updateWalletConfigs(): void {
  console.log('\n=== UPDATING WALLET CONFIGURATION ===');
  
  let updatedFiles = 0;
  
  for (const file of CONFIG_FILES) {
    if (fs.existsSync(file)) {
      console.log(`Updating ${file}...`);
      
      try {
        const config = JSON.parse(fs.readFileSync(file, 'utf-8'));
        
        // Update various wallet configuration formats
        let updated = false;
        
        // Format 1: walletAddress field
        if (config.walletAddress === HX_WALLET_ADDRESS) {
          config.walletAddress = MAIN_WALLET_ADDRESS;
          updated = true;
        }
        
        // Format 2: tradingWalletAddress field
        if (config.tradingWalletAddress === HX_WALLET_ADDRESS) {
          config.tradingWalletAddress = MAIN_WALLET_ADDRESS;
          updated = true;
        }
        
        // Format 3: wallets array
        if (Array.isArray(config.wallets)) {
          const filteredWallets = config.wallets.filter(
            (wallet: any) => wallet.address !== HX_WALLET_ADDRESS && wallet.publicKey !== HX_WALLET_ADDRESS
          );
          
          if (filteredWallets.length !== config.wallets.length) {
            config.wallets = filteredWallets;
            
            // Make sure the main wallet is included
            const hasMainWallet = filteredWallets.some(
              (wallet: any) => wallet.address === MAIN_WALLET_ADDRESS || wallet.publicKey === MAIN_WALLET_ADDRESS
            );
            
            if (!hasMainWallet) {
              filteredWallets.push({
                address: MAIN_WALLET_ADDRESS,
                label: 'Main Trading Wallet',
                active: true
              });
            }
            
            updated = true;
          }
        }
        
        // Format 4: activeWalletAddress field
        if (config.activeWalletAddress === HX_WALLET_ADDRESS) {
          config.activeWalletAddress = MAIN_WALLET_ADDRESS;
          updated = true;
        }
        
        // Format 5: wallet object
        if (config.wallet && (config.wallet.address === HX_WALLET_ADDRESS || config.wallet.publicKey === HX_WALLET_ADDRESS)) {
          config.wallet.address = MAIN_WALLET_ADDRESS;
          config.wallet.publicKey = MAIN_WALLET_ADDRESS;
          updated = true;
        }
        
        // Format 6: systemWalletAddress field
        if (config.systemWalletAddress === HX_WALLET_ADDRESS) {
          config.systemWalletAddress = MAIN_WALLET_ADDRESS;
          updated = true;
        }
        
        // Save updated config if changes were made
        if (updated) {
          fs.writeFileSync(file, JSON.stringify(config, null, 2));
          console.log(`✅ Updated ${file}`);
          updatedFiles++;
        } else {
          console.log(`No changes needed in ${file}`);
        }
      } catch (error) {
        console.error(`Error updating ${file}:`, error);
      }
    } else {
      console.log(`${file} does not exist, skipping`);
    }
  }
  
  console.log(`\nUpdated ${updatedFiles} configuration files to use main wallet`);
}

// Create premium RPC configuration template
function createPremiumRpcTemplate(): void {
  console.log('\n=== CREATING PREMIUM RPC TEMPLATE ===');
  
  const rpcConfig = {
    providers: [
      {
        name: 'Premium',
        url: '[PREMIUM_RPC_URL]',
        websocketUrl: '[PREMIUM_WS_URL]',
        priority: 1,
        weight: 10,
        maxRequestsPerSecond: 100,
        maxRequestsPerMinute: 5000,
        maxRequestsPerHour: 250000,
        apiKey: '[API_KEY_PLACEHOLDER]'
      },
      {
        name: 'Helius',
        url: process.env.HELIUS_API_KEY ? 
          `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}` : 
          'https://mainnet.helius-rpc.com/?api-key=[HELIUS_API_KEY]',
        websocketUrl: process.env.HELIUS_API_KEY ? 
          `wss://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}` : 
          'wss://mainnet.helius-rpc.com/?api-key=[HELIUS_API_KEY]',
        priority: 2,
        weight: 8,
        maxRequestsPerSecond: 40,
        maxRequestsPerMinute: 1500,
        maxRequestsPerHour: 70000,
        apiKey: process.env.HELIUS_API_KEY || '[HELIUS_API_KEY]'
      },
      {
        name: 'Public',
        url: 'https://api.mainnet-beta.solana.com',
        websocketUrl: 'wss://api.mainnet-beta.solana.com',
        priority: 3,
        weight: 1,
        maxRequestsPerSecond: 10,
        maxRequestsPerMinute: 100,
        maxRequestsPerHour: 1000
      }
    ],
    loadBalancingStrategy: 'adaptive',
    failoverThreshold: 2,
    healthCheckIntervalMs: 15000,
    maxConsecutiveFailures: 3,
    retryDelayMs: 500,
    maxRetries: 3,
    cacheTimeMs: 5000,
    logActivity: true,
    requestTimeoutMs: 30000,
    performanceMonitoring: true
  };
  
  const configDir = 'config/premium';
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  fs.writeFileSync(`${configDir}/premium-rpc-config.json`, JSON.stringify(rpcConfig, null, 2));
  console.log(`✅ Created premium RPC configuration template: ${configDir}/premium-rpc-config.json`);
}

// Create Jupiter API configuration template
function createJupiterApiTemplate(): void {
  console.log('\n=== CREATING JUPITER API TEMPLATE ===');
  
  const jupiterConfig = {
    apiKey: '[JUPITER_API_KEY]',
    useV6Router: true,
    useIndexedRouteMap: true,
    priorityFeeLevel: 'medium',
    slippageBps: 50, // 0.5%
    cacheQuotesMs: 2000,
    forceDirectRoutes: false,
    maxSwapRetries: 3,
    enableSmartRouting: true,
    platformFeeBps: 0,
    maxAccounts: 30,
    onlyDirectRoutes: false,
    useVersionedTransactions: true,
    usePriorityFees: true,
    minPriorityFeeMicroLamports: 50000, // 0.00005 SOL
    maxPriorityFeeMicroLamports: 1000000, // 0.001 SOL
    routes: {
      SOL_USDC: {
        forceDirectRoute: true,
        slippageBps: 30, // 0.3%
        priorityFeeBps: 2 // 0.02%
      },
      USDC_SOL: {
        forceDirectRoute: true,
        slippageBps: 30, // 0.3%
        priorityFeeBps: 2 // 0.02%
      }
    }
  };
  
  const configDir = 'config/premium';
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  fs.writeFileSync(`${configDir}/jupiter-api-config.json`, JSON.stringify(jupiterConfig, null, 2));
  console.log(`✅ Created Jupiter API configuration template: ${configDir}/jupiter-api-config.json`);
}

// Create trade frequency configuration template for increased capital
function createIncreasedCapitalTemplate(): void {
  console.log('\n=== CREATING INCREASED CAPITAL TEMPLATE ===');
  
  const capitalConfig = {
    expectedCapital: 2.6, // 2.6 SOL
    maxCapitalPerStrategy: {
      'Ultimate Nuclear': 1.5,
      'Quantum Flash': 1.2,
      'MEV Protection': 1.0,
      'Zero Capital': 0.8,
      'Multi-Flash': 1.3,
      'Temporal Block': 1.4,
      'Hyperion Cascade': 1.6
    },
    capitalAllocationStrategy: 'dynamic', // static, dynamic, adaptive
    maxTotalAllocation: 2.4, // 2.4 SOL (leave 0.2 for reserves)
    minReserveAmount: 0.2, // 0.2 SOL
    riskProfiles: {
      'Ultimate Nuclear': 'medium',
      'Quantum Flash': 'medium-high',
      'MEV Protection': 'low',
      'Zero Capital': 'low',
      'Multi-Flash': 'medium-high',
      'Temporal Block': 'medium',
      'Hyperion Cascade': 'high'
    },
    capitalRebalanceFrequencyMs: 1800000, // 30 minutes
    profitCollectionRate: 95, // 95% reinvestment rate
    emergencyReserve: 0.05 // 0.05 SOL emergency reserve
  };
  
  const configDir = 'config/premium';
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  fs.writeFileSync(`${configDir}/capital-allocation-config.json`, JSON.stringify(capitalConfig, null, 2));
  console.log(`✅ Created increased capital template: ${configDir}/capital-allocation-config.json`);
}

// Update trade frequency optimizer configuration
function updateTradeFrequencyOptimizerConfig(): void {
  console.log('\n=== UPDATING TRADE FREQUENCY OPTIMIZER ===');
  
  const tradeFrequencyConfig = {
    strategyProfiles: [
      {
        name: 'Ultimate Nuclear',
        requestsPerTrade: 25,
        requestsPerCheck: 8,
        checkIntervalMs: 5000,
        minTimeBetweenTradesMs: 230000, // ~3.8 minutes (reduced from 5.5 minutes)
        currentTimeBetweenTradesMs: 230000,
        tradeSuccessRate: 0.85,
        profitPerTrade: 0.0162, // SOL
        activeHoursPerDay: 24,
        maxDailyTrades: 15 // Increased from 10
      },
      {
        name: 'Quantum Flash',
        requestsPerTrade: 18,
        requestsPerCheck: 6,
        checkIntervalMs: 5000,
        minTimeBetweenTradesMs: 195000, // ~3.2 minutes (reduced from 4.7 minutes)
        currentTimeBetweenTradesMs: 195000,
        tradeSuccessRate: 0.90,
        profitPerTrade: 0.0085, // SOL
        activeHoursPerDay: 24,
        maxDailyTrades: 20 // Increased from 14
      },
      {
        name: 'MEV Protection',
        requestsPerTrade: 22,
        requestsPerCheck: 7,
        checkIntervalMs: 4000,
        minTimeBetweenTradesMs: 220000, // ~3.7 minutes (reduced from 5.3 minutes)
        currentTimeBetweenTradesMs: 220000,
        tradeSuccessRate: 0.88,
        profitPerTrade: 0.0078, // SOL
        activeHoursPerDay: 24,
        maxDailyTrades: 38 // Increased from 28
      },
      {
        name: 'Zero Capital',
        requestsPerTrade: 15,
        requestsPerCheck: 5,
        checkIntervalMs: 6000,
        minTimeBetweenTradesMs: 240000, // ~4.0 minutes (reduced from 5.7 minutes)
        currentTimeBetweenTradesMs: 240000,
        tradeSuccessRate: 0.92,
        profitPerTrade: 0.0045, // SOL
        activeHoursPerDay: 24,
        maxDailyTrades: 42 // Increased from 32
      },
      {
        name: 'Multi-Flash',
        requestsPerTrade: 30,
        requestsPerCheck: 10,
        checkIntervalMs: 5000,
        minTimeBetweenTradesMs: 195000, // ~3.2 minutes (reduced from 4.7 minutes)
        currentTimeBetweenTradesMs: 195000,
        tradeSuccessRate: 0.85,
        profitPerTrade: 0.0113, // SOL
        activeHoursPerDay: 24,
        maxDailyTrades: 26 // Increased from 18
      },
      {
        name: 'Temporal Block',
        requestsPerTrade: 28,
        requestsPerCheck: 9,
        checkIntervalMs: 3800,
        minTimeBetweenTradesMs: 195000, // ~3.2 minutes (reduced from 4.7 minutes)
        currentTimeBetweenTradesMs: 195000,
        tradeSuccessRate: 0.80,
        profitPerTrade: 0.0125, // SOL
        activeHoursPerDay: 24,
        maxDailyTrades: 34 // Increased from 24
      },
      {
        name: 'Hyperion Cascade',
        requestsPerTrade: 40,
        requestsPerCheck: 12,
        checkIntervalMs: 4800,
        minTimeBetweenTradesMs: 210000, // ~3.5 minutes (reduced from 4.9 minutes)
        currentTimeBetweenTradesMs: 210000,
        tradeSuccessRate: 0.78,
        profitPerTrade: 0.0195, // SOL
        activeHoursPerDay: 24,
        maxDailyTrades: 32 // Increased from 24
      }
    ],
    systemWideSettings: {
      safetyBuffer: 0.75, // Use only 75% of available RPC capacity
      minTradeInterval: 90000, // 1.5 minutes minimum between trades
      maxTradeInterval: 900000, // 15 minutes maximum between trades
      strategyPrioritization: 'profit', // 'profit', 'success', 'balanced'
      loadBalancingMode: 'adaptive', // 'static', 'adaptive', 'time-of-day'
      requestsReservedForBackgroundTasks: 1000, // per hour (increased for premium RPC)
      preferredActiveHours: {
        start: 1, // 1 AM UTC
        end: 6 // 6 AM UTC
      },
      optimizationCheckIntervalMs: 3600000, // 1 hour
      applyChangesImmediately: true,
      logChanges: true
    },
    rpcProviders: [
      {
        name: 'Premium',
        maxRequestsPerSecond: 100,
        maxRequestsPerMinute: 5000,
        maxRequestsPerHour: 250000,
        optimizedBatchSize: 40,
        priority: 1,
        healthCheckIntervalMs: 30000,
        retryDelayMs: 300,
        maxRetries: 5
      },
      {
        name: 'Helius',
        maxRequestsPerSecond: 40,
        maxRequestsPerMinute: 1800,
        maxRequestsPerHour: 80000,
        optimizedBatchSize: 15,
        priority: 2,
        healthCheckIntervalMs: 120000,
        retryDelayMs: 500,
        maxRetries: 3
      },
      {
        name: 'Public',
        maxRequestsPerSecond: 10,
        maxRequestsPerMinute: 300,
        maxRequestsPerHour: 10000,
        optimizedBatchSize: 5,
        priority: 3,
        healthCheckIntervalMs: 180000,
        retryDelayMs: 1000,
        maxRetries: 2
      }
    ]
  };
  
  const configDir = 'config/premium';
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  fs.writeFileSync(`${configDir}/trade-frequency-optimizer-config.json`, JSON.stringify(tradeFrequencyConfig, null, 2));
  console.log(`✅ Created updated trade frequency optimizer configuration: ${configDir}/trade-frequency-optimizer-config.json`);
}

// Create a script to apply the premium configuration
function createSetupScript(): void {
  console.log('\n=== CREATING SETUP SCRIPT ===');
  
  const scriptContent = `#!/bin/bash
# Apply Premium RPC, Jupiter API, and Increased Capital Configuration

echo "========================================"
echo "    PREMIUM TRADING SYSTEM SETUP       "
echo "========================================"
echo

# Check for required API keys
if [ -z "$1" ]; then
  echo "Error: Premium RPC API key not provided"
  echo "Usage: ./setup-premium-trading.sh <PREMIUM_RPC_API_KEY> <JUPITER_API_KEY> [RPC_URL] [WS_URL]"
  exit 1
fi

if [ -z "$2" ]; then
  echo "Error: Jupiter API key not provided"
  echo "Usage: ./setup-premium-trading.sh <PREMIUM_RPC_API_KEY> <JUPITER_API_KEY> [RPC_URL] [WS_URL]"
  exit 1
fi

# Get arguments
PREMIUM_RPC_API_KEY=$1
JUPITER_API_KEY=$2
PREMIUM_RPC_URL=${3:-"https://solana-api.syndica.io/access-token/$PREMIUM_RPC_API_KEY"}
PREMIUM_WS_URL=${4:-"wss://solana-api.syndica.io/access-token/$PREMIUM_RPC_API_KEY"}

echo "Setting up premium trading system..."
echo "RPC URL: $PREMIUM_RPC_URL"
echo "Jupiter API key: [Provided]"
echo

# Create config directory if it doesn't exist
mkdir -p config

# Update premium RPC configuration
sed -i "s|\\[PREMIUM_RPC_URL\\]|$PREMIUM_RPC_URL|g" config/premium/premium-rpc-config.json
sed -i "s|\\[PREMIUM_WS_URL\\]|$PREMIUM_WS_URL|g" config/premium/premium-rpc-config.json
sed -i "s|\\[API_KEY_PLACEHOLDER\\]|$PREMIUM_RPC_API_KEY|g" config/premium/premium-rpc-config.json

# Update Jupiter API configuration
sed -i "s|\\[JUPITER_API_KEY\\]|$JUPITER_API_KEY|g" config/premium/jupiter-api-config.json

# Copy configurations to main config directory
cp config/premium/premium-rpc-config.json config/rpc-config.json
cp config/premium/jupiter-api-config.json config/jupiter-config.json
cp config/premium/capital-allocation-config.json config/capital-allocation-config.json
cp config/premium/trade-frequency-optimizer-config.json config/trade-frequency-optimizer-config.json

echo "All configurations updated successfully!"
echo "Ready to launch premium trading system"
echo "Run: ./launch-enhanced-system.sh"
echo "========================================"
`;
  
  fs.writeFileSync('setup-premium-trading.sh', scriptContent);
  fs.chmodSync('setup-premium-trading.sh', 0o755); // Make executable
  
  console.log(`✅ Created setup script: setup-premium-trading.sh`);
}

// Main function
function main(): void {
  console.log('=== PREPARING FOR UPGRADES ===');
  
  // Update wallet configurations to only use the main wallet
  updateWalletConfigs();
  
  // Create premium RPC configuration template
  createPremiumRpcTemplate();
  
  // Create Jupiter API configuration template
  createJupiterApiTemplate();
  
  // Create increased capital configuration template
  createIncreasedCapitalTemplate();
  
  // Update trade frequency optimizer configuration
  updateTradeFrequencyOptimizerConfig();
  
  // Create setup script
  createSetupScript();
  
  console.log('\n=== SYSTEM PREPARED FOR TOMORROW\'S UPGRADES ===');
  console.log('1. HX wallet removed from configuration');
  console.log('2. Premium RPC template created');
  console.log('3. Jupiter API template created');
  console.log('4. Increased capital configuration prepared');
  console.log('5. Trade frequency optimizer updated');
  console.log('\nWhen ready tomorrow, run:');
  console.log('./setup-premium-trading.sh <PREMIUM_RPC_API_KEY> <JUPITER_API_KEY>');
}

// Run the main function
main();