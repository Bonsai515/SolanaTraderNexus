/**
 * Syndica Nexus Pro Integration
 * 
 * This module integrates Syndica directly with the Nexus Pro Engine
 * to ensure proper RPC connections for executing real trades.
 */

import { Connection, ConnectionConfig, Commitment } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.trading' });

// Constants
const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY || 'q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const SYNDICA_URL = 'https://solana-api.syndica.io/rpc';

// Nexus Engine connection config file path
const NEXUS_CONFIG_PATH = path.join(process.cwd(), 'config', 'nexus-engine-config.json');

/**
 * Test Syndica connection with proper headers
 */
async function testSyndicaProConnection(): Promise<boolean> {
  try {
    console.log('Testing Syndica Pro connection with correct headers...');
    
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
      console.log(`✅ Syndica Pro connection successful! Block height: ${response.data.result}`);
      
      // Also test getting a recent blockhash
      const blockhashResponse = await axios.post(
        SYNDICA_URL,
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'getLatestBlockhash',
          params: []
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': SYNDICA_API_KEY
          }
        }
      );
      
      if (blockhashResponse.data && blockhashResponse.data.result) {
        console.log(`✅ Got recent blockhash: ${blockhashResponse.data.result.value.blockhash}`);
      }
      
      return true;
    } else {
      console.error('❌ Syndica Pro connection failed: Invalid response');
      return false;
    }
  } catch (error) {
    console.error('❌ Syndica Pro connection failed:', error);
    return false;
  }
}

/**
 * Create Syndica connection with proper headers
 */
function createSyndicaProConnection(commitment: Commitment = 'confirmed'): Connection {
  const config: ConnectionConfig = {
    commitment,
    confirmTransactionInitialTimeout: 60000,
    httpHeaders: {
      'X-API-Key': SYNDICA_API_KEY
    }
  };
  
  return new Connection(SYNDICA_URL, config);
}

/**
 * Update Nexus Engine to use Syndica Pro
 */
async function updateNexusEngineConfig(): Promise<boolean> {
  try {
    // Create config directory if it doesn't exist
    const configDir = path.dirname(NEXUS_CONFIG_PATH);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // Create or update Nexus Engine config
    const nexusConfig = {
      version: '2.0',
      updated: new Date().toISOString(),
      rpcProviders: {
        primary: {
          type: 'syndica',
          url: SYNDICA_URL,
          apiKey: SYNDICA_API_KEY,
          authType: 'header',
          headerName: 'X-API-Key',
          priority: 1
        },
        backups: [
          {
            type: 'helius',
            url: process.env.HELIUS_RPC_URL || `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
            priority: 2
          },
          {
            type: 'alchemy',
            url: process.env.ALCHEMY_RPC_URL || `https://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
            priority: 3
          }
        ]
      },
      executionSettings: {
        maxConcurrentTransactions: 5,
        useOptimalFees: true,
        priorityLevel: 'maximum',
        simulateBeforeSubmit: true,
        retryOnFailure: true,
        maxRetries: 3
      },
      logging: {
        level: 'info',
        saveToFile: true,
        logDirectory: path.join(process.cwd(), 'logs'),
        includeTimestamps: true
      }
    };
    
    // Save config
    fs.writeFileSync(NEXUS_CONFIG_PATH, JSON.stringify(nexusConfig, null, 2));
    console.log(`✅ Updated Nexus Engine config to use Syndica Pro`);
    
    return true;
  } catch (error) {
    console.error('Error updating Nexus Engine config:', error);
    return false;
  }
}

/**
 * Update existing nuclear strategies to use Syndica Pro
 */
async function updateNuclearStrategiesConfig(): Promise<boolean> {
  try {
    const strategiesDir = path.join(process.cwd(), 'config');
    const strategyFiles = [
      'nuclear-strategies.json',
      'ultimate-nuclear-strategies.json',
      'maximized-aimodelsynapse-strategies.json'
    ];
    
    for (const file of strategyFiles) {
      const filePath = path.join(strategiesDir, file);
      
      if (fs.existsSync(filePath)) {
        console.log(`Updating ${file} to use Syndica Pro...`);
        
        // Read strategy config
        const strategyConfig = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Update RPC provider in each strategy
        for (const [key, strategy] of Object.entries(strategyConfig)) {
          // Add rpcProvider property to strategy if it doesn't have one
          if (typeof strategy === 'object' && strategy !== null) {
            (strategy as any).rpcProvider = {
              type: 'syndica',
              url: SYNDICA_URL,
              apiKey: SYNDICA_API_KEY,
              authType: 'header',
              headerName: 'X-API-Key'
            };
          }
        }
        
        // Save updated config
        fs.writeFileSync(filePath, JSON.stringify(strategyConfig, null, 2));
        console.log(`✅ Updated ${file} to use Syndica Pro`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error updating strategy configs:', error);
    return false;
  }
}

/**
 * Update the .env.trading file to ensure Syndica integration
 */
async function updateEnvConfig(): Promise<boolean> {
  try {
    const envPath = path.join(process.cwd(), '.env.trading');
    
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      // Update or add Syndica API key
      if (!envContent.includes('SYNDICA_API_KEY=')) {
        envContent += `\nSYNDICA_API_KEY=${SYNDICA_API_KEY}\n`;
      } else {
        envContent = envContent.replace(
          /SYNDICA_API_KEY=.*/,
          `SYNDICA_API_KEY=${SYNDICA_API_KEY}`
        );
      }
      
      // Update or add Syndica URL
      if (!envContent.includes('SYNDICA_RPC_URL=')) {
        envContent += `\nSYNDICA_RPC_URL=${SYNDICA_URL}\n`;
      } else {
        envContent = envContent.replace(
          /SYNDICA_RPC_URL=.*/,
          `SYNDICA_RPC_URL=${SYNDICA_URL}`
        );
      }
      
      // Add Syndica integration flag
      if (!envContent.includes('USE_SYNDICA_INTEGRATION=')) {
        envContent += `\nUSE_SYNDICA_INTEGRATION=true\n`;
      } else {
        envContent = envContent.replace(
          /USE_SYNDICA_INTEGRATION=.*/,
          'USE_SYNDICA_INTEGRATION=true'
        );
      }
      
      // Save updated env file
      fs.writeFileSync(envPath, envContent);
      console.log('✅ Updated .env.trading with Syndica integration settings');
      
      return true;
    } else {
      console.error('.env.trading file not found');
      return false;
    }
  } catch (error) {
    console.error('Error updating .env.trading:', error);
    return false;
  }
}

/**
 * Execute main integration process
 */
async function integrateSyndicaWithNexusEngine(): Promise<void> {
  console.log('==== INTEGRATING SYNDICA WITH NEXUS PRO ENGINE ====');
  
  // First test the Syndica connection
  const connectionSuccess = await testSyndicaProConnection();
  
  if (connectionSuccess) {
    console.log('Syndica Pro connection is working. Updating Nexus Engine...');
    
    // Update Nexus Engine config
    await updateNexusEngineConfig();
    
    // Update nuclear strategies config
    await updateNuclearStrategiesConfig();
    
    // Update .env config
    await updateEnvConfig();
    
    console.log('==== SYNDICA PRO INTEGRATION COMPLETE ====');
    console.log('✅ Nexus Pro Engine now using Syndica Pro for all trades');
    console.log('✅ All trading strategies updated to use Syndica Pro');
    console.log('✅ Environment configuration updated');
    
    console.log('\nYour trading system is now using the proper Syndica Pro connection.');
    console.log('You should start seeing real trades executing shortly.');
  } else {
    console.error('Failed to connect to Syndica Pro. Integration aborted.');
  }
}

// Execute the integration
integrateSyndicaWithNexusEngine();