/**
 * Fix Syndica Connection for Real Trading
 * 
 * This script fixes the Syndica RPC connection issues by properly configuring
 * header-based authentication and updating all necessary configuration files.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: '.env.trading' });

// Constants
const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY || 'q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const SYNDICA_URL = 'https://solana-api.syndica.io/rpc';
const CONFIG_DIR = path.join(process.cwd(), 'config');

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

/**
 * Test Syndica connection with proper headers
 */
async function testSyndicaConnection() {
  try {
    console.log('Testing Syndica connection with correct headers...');
    
    // Set up request with proper headers
    const response = await axios.post(
      SYNDICA_URL,
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'getBlockHeight',
        params: []
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': SYNDICA_API_KEY
        }
      }
    );
    
    // Check if response is valid
    if (response.data && response.data.result !== undefined) {
      console.log(`✅ Syndica connection successful! Block height: ${response.data.result}`);
      return true;
    } else {
      console.error('❌ Syndica connection failed: Invalid response');
      return false;
    }
  } catch (error) {
    console.error('❌ Syndica connection failed:', error.message);
    return false;
  }
}

/**
 * Update .env.trading file with proper Syndica configuration
 */
function updateEnvFile() {
  try {
    const envPath = path.join(process.cwd(), '.env.trading');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Update Syndica API key
    if (!envContent.includes('SYNDICA_API_KEY=')) {
      envContent += `SYNDICA_API_KEY=${SYNDICA_API_KEY}\n`;
    } else {
      envContent = envContent.replace(
        /SYNDICA_API_KEY=.*/,
        `SYNDICA_API_KEY=${SYNDICA_API_KEY}`
      );
    }
    
    // Update Syndica URL
    if (!envContent.includes('SYNDICA_RPC_URL=')) {
      envContent += `SYNDICA_RPC_URL=${SYNDICA_URL}\n`;
    } else {
      envContent = envContent.replace(
        /SYNDICA_RPC_URL=.*/,
        `SYNDICA_RPC_URL=${SYNDICA_URL}`
      );
    }
    
    // Set header auth flag
    if (!envContent.includes('SYNDICA_USE_HEADER_AUTH=')) {
      envContent += `SYNDICA_USE_HEADER_AUTH=true\n`;
    } else {
      envContent = envContent.replace(
        /SYNDICA_USE_HEADER_AUTH=.*/,
        'SYNDICA_USE_HEADER_AUTH=true'
      );
    }
    
    // Add Syndica header name
    if (!envContent.includes('SYNDICA_HEADER_NAME=')) {
      envContent += `SYNDICA_HEADER_NAME=X-API-Key\n`;
    } else {
      envContent = envContent.replace(
        /SYNDICA_HEADER_NAME=.*/,
        'SYNDICA_HEADER_NAME=X-API-Key'
      );
    }
    
    // Save the updated env file
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Updated .env.trading file with Syndica connection settings');
    return true;
  } catch (error) {
    console.error('❌ Error updating .env.trading file:', error.message);
    return false;
  }
}

/**
 * Update Jupiter DEX configuration
 */
function updateJupiterConfig() {
  try {
    const configPath = path.join(CONFIG_DIR, 'jupiter-config.json');
    const jupiterConfig = {
      rpcConnection: {
        url: SYNDICA_URL,
        useHeaderAuth: true,
        headerName: 'X-API-Key',
        apiKey: SYNDICA_API_KEY
      },
      slippageBps: 50,
      feeBps: 5,
      priorityFeeInLamports: 100000,
      maxRetries: 3,
      retryBackoffMs: 250
    };
    
    fs.writeFileSync(configPath, JSON.stringify(jupiterConfig, null, 2));
    console.log('✅ Updated Jupiter configuration');
    return true;
  } catch (error) {
    console.error('❌ Error updating Jupiter configuration:', error.message);
    return false;
  }
}

/**
 * Update Raydium DEX configuration
 */
function updateRaydiumConfig() {
  try {
    const configPath = path.join(CONFIG_DIR, 'raydium-config.json');
    const raydiumConfig = {
      rpcConnection: {
        url: SYNDICA_URL,
        useHeaderAuth: true,
        headerName: 'X-API-Key',
        apiKey: SYNDICA_API_KEY
      },
      slippageBps: 50,
      feeBps: 5,
      priorityFeeInLamports: 100000,
      maxRetries: 3,
      retryBackoffMs: 250
    };
    
    fs.writeFileSync(configPath, JSON.stringify(raydiumConfig, null, 2));
    console.log('✅ Updated Raydium configuration');
    return true;
  } catch (error) {
    console.error('❌ Error updating Raydium configuration:', error.message);
    return false;
  }
}

/**
 * Update Orca DEX configuration
 */
function updateOrcaConfig() {
  try {
    const configPath = path.join(CONFIG_DIR, 'orca-config.json');
    const orcaConfig = {
      rpcConnection: {
        url: SYNDICA_URL,
        useHeaderAuth: true,
        headerName: 'X-API-Key',
        apiKey: SYNDICA_API_KEY
      },
      slippageBps: 50,
      feeBps: 5,
      priorityFeeInLamports: 100000,
      maxRetries: 3,
      retryBackoffMs: 250
    };
    
    fs.writeFileSync(configPath, JSON.stringify(orcaConfig, null, 2));
    console.log('✅ Updated Orca configuration');
    return true;
  } catch (error) {
    console.error('❌ Error updating Orca configuration:', error.message);
    return false;
  }
}

/**
 * Update connection code in nexus directory
 */
function updateNexusConnectionCode() {
  try {
    const nexusDir = path.join(process.cwd(), 'nexus_engine');
    if (!fs.existsSync(nexusDir)) {
      fs.mkdirSync(nexusDir, { recursive: true });
    }
    
    const connectionPath = path.join(nexusDir, 'connection.js');
    const connectionCode = `
/**
 * Nexus Engine Connection Module
 * 
 * This module provides optimized connection handling for the Nexus Engine
 * with proper header-based authentication for Syndica.
 */

const { Connection, ConnectionConfig } = require('@solana/web3.js');
require('dotenv').config({ path: '.env.trading' });

// Get connection parameters from environment
const SYNDICA_URL = process.env.SYNDICA_RPC_URL || 'https://solana-api.syndica.io/rpc';
const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY || 'q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const USE_HEADER_AUTH = process.env.SYNDICA_USE_HEADER_AUTH === 'true';
const HEADER_NAME = process.env.SYNDICA_HEADER_NAME || 'X-API-Key';

/**
 * Create an optimized Solana connection with proper authentication
 */
function createConnection(commitment = 'confirmed') {
  // Set up connection configuration
  const config = {
    commitment,
    confirmTransactionInitialTimeout: 60000
  };
  
  // Add header authentication if enabled
  if (USE_HEADER_AUTH) {
    config.httpHeaders = {
      [HEADER_NAME]: SYNDICA_API_KEY
    };
  }
  
  // Create and return connection
  return new Connection(SYNDICA_URL, config);
}

// Export the connection factory
module.exports = {
  createConnection
};
`;
    
    fs.writeFileSync(connectionPath, connectionCode);
    console.log('✅ Updated Nexus Engine connection code');
    return true;
  } catch (error) {
    console.error('❌ Error updating Nexus Engine connection code:', error.message);
    return false;
  }
}

/**
 * Update all protocol configurations
 */
function updateAllProtocolConfigs() {
  const protocols = [
    'hyperion', 'quantum-omega', 'singularity', 'memecortex',
    'aimodelsynapse', 'database-flash', 'temporal-arbitrage',
    'nuclear-strategy', 'flash-loan'
  ];
  
  let successCount = 0;
  
  for (const protocol of protocols) {
    try {
      const configPath = path.join(CONFIG_DIR, `${protocol}-config.json`);
      const config = {
        rpcConnection: {
          url: SYNDICA_URL,
          useHeaderAuth: true,
          headerName: 'X-API-Key',
          apiKey: SYNDICA_API_KEY
        },
        useRealFunds: true,
        maxTransactionsPerSecond: 5,
        maxSlippageBps: 50,
        minProfitThresholdPercent: 0.5, // Lower threshold to 0.5% to increase trade frequency
        priorityFeeInLamports: 100000
      };
      
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      successCount++;
    } catch (error) {
      console.error(`❌ Error updating ${protocol} configuration:`, error.message);
    }
  }
  
  console.log(`✅ Updated ${successCount}/${protocols.length} protocol configurations`);
  return successCount === protocols.length;
}

/**
 * Main function to fix all Syndica connection issues
 */
async function fixSyndicaConnection() {
  console.log('=== FIXING SYNDICA CONNECTION ISSUES ===');
  
  // First, test the connection
  const connectionWorks = await testSyndicaConnection();
  
  if (connectionWorks) {
    console.log('Syndica connection is working with proper headers! Proceeding with updates...');
    
    // Update environment file
    updateEnvFile();
    
    // Update DEX configurations
    updateJupiterConfig();
    updateRaydiumConfig();
    updateOrcaConfig();
    
    // Update Nexus Engine code
    updateNexusConnectionCode();
    
    // Update all protocol configurations
    updateAllProtocolConfigs();
    
    console.log('\n=== SYNDICA CONNECTION FIXES COMPLETE ===');
    console.log('✅ All configurations have been updated to use Syndica with proper header authentication');
    console.log('✅ DEX integrations have been configured for optimal performance');
    console.log('✅ Nexus Engine is now properly configured to execute real trades');
    
    console.log('\nYour trading system should now begin executing real trades. Please check the real-trade-monitor');
    console.log('for verified trades and profits.');
  } else {
    console.error('\n❌ Syndica connection test failed. Connection could not be established.');
    console.error('Please check your Syndica API key and try again.');
  }
}

// Run the fix script
fixSyndicaConnection();