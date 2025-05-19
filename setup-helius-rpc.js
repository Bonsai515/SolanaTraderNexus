/**
 * Setup Helius RPC for Real Trading
 * 
 * This script configures the trading system to use Helius RPC
 * for executing real blockchain transactions.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: '.env.trading' });

// Constants
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const CONFIG_DIR = path.join(process.cwd(), 'config');

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

/**
 * Test Helius RPC connection
 */
async function testHeliusConnection() {
  try {
    console.log('Testing Helius RPC connection...');
    
    const response = await axios.post(
      HELIUS_URL,
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'getBlockHeight',
        params: []
      }
    );
    
    if (response.data && response.data.result !== undefined) {
      console.log(`✅ Helius RPC connection successful! Block height: ${response.data.result}`);
      return true;
    } else {
      console.error('❌ Helius RPC connection failed: Invalid response');
      return false;
    }
  } catch (error) {
    console.error('❌ Helius RPC connection failed:', error.message);
    return false;
  }
}

/**
 * Update .env.trading file with Helius configuration
 */
function updateEnvFile() {
  try {
    const envPath = path.join(process.cwd(), '.env.trading');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Update RPC provider priority
    if (!envContent.includes('PRIMARY_RPC_PROVIDER=')) {
      envContent += `PRIMARY_RPC_PROVIDER=helius\n`;
    } else {
      envContent = envContent.replace(
        /PRIMARY_RPC_PROVIDER=.*/,
        `PRIMARY_RPC_PROVIDER=helius`
      );
    }
    
    // Update Helius URL
    if (!envContent.includes('HELIUS_RPC_URL=')) {
      envContent += `HELIUS_RPC_URL=${HELIUS_URL}\n`;
    } else {
      envContent = envContent.replace(
        /HELIUS_RPC_URL=.*/,
        `HELIUS_RPC_URL=${HELIUS_URL}`
      );
    }
    
    // Save the updated env file
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Updated .env.trading file with Helius RPC settings');
    return true;
  } catch (error) {
    console.error('❌ Error updating .env.trading file:', error.message);
    return false;
  }
}

/**
 * Update trading configuration files to use Helius
 */
function updateTradingConfigs() {
  try {
    // Create config directory if it doesn't exist
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    
    const configPath = path.join(CONFIG_DIR, 'rpc-config.json');
    const rpcConfig = {
      providers: [
        {
          name: 'Helius',
          url: HELIUS_URL,
          priority: 1,
          enabled: true
        }
      ],
      fallbackEnabled: true,
      maxRetries: 3,
      retryDelayMs: 500
    };
    
    fs.writeFileSync(configPath, JSON.stringify(rpcConfig, null, 2));
    console.log('✅ Updated RPC configuration');
    
    // Update DEX configs to use Helius
    const dexConfigs = ['jupiter', 'raydium', 'orca'];
    
    for (const dex of dexConfigs) {
      const dexConfigPath = path.join(CONFIG_DIR, `${dex}-config.json`);
      const dexConfig = {
        rpcConnection: {
          url: HELIUS_URL
        },
        slippageBps: 50,
        feeBps: 5,
        priorityFeeInLamports: 100000
      };
      
      fs.writeFileSync(dexConfigPath, JSON.stringify(dexConfig, null, 2));
      console.log(`✅ Updated ${dex} configuration`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error updating trading configurations:', error.message);
    return false;
  }
}

/**
 * Update Nexus Engine connection settings
 */
function updateNexusEngine() {
  try {
    const nexusConfigPath = path.join(CONFIG_DIR, 'nexus-engine-config.json');
    const nexusConfig = {
      rpcProvider: {
        name: 'Helius',
        url: HELIUS_URL,
        priority: 1
      },
      executionSettings: {
        maxConcurrentTransactions: 3,
        simulateBeforeSubmit: true,
        priorityFeeInLamports: 100000,
        maxRetries: 3,
        retryDelayMs: 500
      },
      profitThresholds: {
        minProfitBps: 50, // 0.5% min profit
        targetProfitBps: 100, // 1% target profit
        maxSlippageBps: 50 // 0.5% max slippage
      }
    };
    
    fs.writeFileSync(nexusConfigPath, JSON.stringify(nexusConfig, null, 2));
    console.log('✅ Updated Nexus Engine configuration');
    return true;
  } catch (error) {
    console.error('❌ Error updating Nexus Engine configuration:', error.message);
    return false;
  }
}

/**
 * Lower trade thresholds to increase frequency
 */
function lowerTradeThresholds() {
  const strategiesDir = path.join(CONFIG_DIR, 'strategies');
  
  if (!fs.existsSync(strategiesDir)) {
    fs.mkdirSync(strategiesDir, { recursive: true });
  }
  
  const strategies = [
    'hyperion-flash',
    'quantum-omega',
    'aimodelsynapse',
    'database-flash',
    'temporal-arbitrage',
    'nuclear'
  ];
  
  for (const strategy of strategies) {
    try {
      const configPath = path.join(strategiesDir, `${strategy}.json`);
      const config = {
        enabled: true,
        minProfitThresholdBps: 50, // Lowered to 0.5%
        maxSlippageBps: 50,
        targetProfitBps: 100,
        maxFeeInSol: 0.002,
        priorityFeeInLamports: 100000,
        rpcProvider: 'helius',
        useRealFunds: true
      };
      
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(`✅ Updated ${strategy} threshold configuration`);
    } catch (error) {
      console.error(`❌ Error updating ${strategy} threshold:`, error.message);
    }
  }
  
  return true;
}

/**
 * Main function to set up Helius RPC
 */
async function setupHeliusRpc() {
  console.log('=== SETTING UP HELIUS RPC FOR REAL TRADING ===');
  
  // First, test the Helius connection
  const connectionWorks = await testHeliusConnection();
  
  if (connectionWorks) {
    console.log('Helius RPC connection is working! Updating trading configurations...');
    
    // Update environment variables
    updateEnvFile();
    
    // Update trading configurations
    updateTradingConfigs();
    
    // Update Nexus Engine
    updateNexusEngine();
    
    // Lower trade thresholds
    lowerTradeThresholds();
    
    console.log('\n=== HELIUS RPC SETUP COMPLETE ===');
    console.log('✅ All configurations updated to use Helius RPC');
    console.log('✅ Trade thresholds lowered to increase frequency');
    console.log('✅ Your trading system should now begin executing real trades');
    
    console.log('\nPlease restart your application to apply these changes.');
  } else {
    console.error('❌ Helius RPC connection test failed.');
    console.error('Please check your Helius API key and try again.');
  }
}

// Run the setup
setupHeliusRpc();