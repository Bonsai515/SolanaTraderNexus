/**
 * Use Existing Wallet for Trading
 * 
 * This script sets up your trading system to use your existing wallet
 * for real on-chain trading.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.trading' });

// Constants
const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY || 'q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const SYNDICA_URL = `https://solana-mainnet.api.syndica.io/api-key/${SYNDICA_API_KEY}`;
const WALLET_ADDRESS = process.env.WALLET_ADDRESS || 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';

// Solana connection
const connection = new Connection(SYNDICA_URL, 'confirmed');

/**
 * Update the .env.trading file with the correct wallet address
 */
function updateEnvFile(): boolean {
  try {
    const envPath = path.join(process.cwd(), '.env.trading');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Required settings
    const settings: Record<string, string> = {
      'USE_REAL_FUNDS': 'true',
      'EXECUTE_REAL_TRADES': 'true',
      'SUBMIT_TRANSACTIONS': 'true',
      'TRANSACTION_EXECUTION_ENABLED': 'true',
      'WALLET_ADDRESS': WALLET_ADDRESS,
      'TRADING_WALLET_ADDRESS': WALLET_ADDRESS,
      'REAL_MONEY_TRADING_ACTIVATED': 'true'
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
    console.log('✅ Updated .env.trading with your wallet address');
    return true;
  } catch (error) {
    console.error('❌ Error updating .env.trading:', error);
    return false;
  }
}

/**
 * Update the trading configuration files to use your wallet
 */
function updateTradingConfig(): boolean {
  try {
    // Update the transaction engine config
    const configDir = path.join(process.cwd(), 'config');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    const engineConfigPath = path.join(configDir, 'transaction-engine.json');
    
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
    
    fs.writeFileSync(engineConfigPath, JSON.stringify(engineConfig, null, 2));
    
    // Update trading config
    const tradingConfigPath = path.join(configDir, 'trading-config.json');
    
    const tradingConfig = {
      tradingEnabled: true,
      useRealFunds: true,
      walletAddress: WALLET_ADDRESS,
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
    
    fs.writeFileSync(tradingConfigPath, JSON.stringify(tradingConfig, null, 2));
    
    console.log('✅ Updated trading configuration files');
    return true;
  } catch (error) {
    console.error('❌ Error updating trading configuration:', error);
    return false;
  }
}

/**
 * Check wallet balance
 */
async function checkWalletBalance(): Promise<number> {
  try {
    console.log(`Checking wallet balance for ${WALLET_ADDRESS}...`);
    
    const balance = await connection.getBalance(new PublicKey(WALLET_ADDRESS));
    const balanceSOL = balance / 1000000000; // Convert lamports to SOL
    
    console.log(`✅ Wallet balance: ${balanceSOL.toFixed(6)} SOL`);
    return balanceSOL;
  } catch (error) {
    console.error('❌ Error checking wallet balance:', error);
    
    // Try a fallback RPC provider
    try {
      console.log('Trying alternate RPC provider...');
      
      const response = await axios.post(
        'https://api.mainnet-beta.solana.com',
        {
          jsonrpc: '2.0',
          id: '1',
          method: 'getBalance',
          params: [WALLET_ADDRESS]
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data && response.data.result && response.data.result.value) {
        const balance = response.data.result.value;
        const balanceSOL = balance / 1000000000;
        console.log(`✅ Wallet balance (from fallback): ${balanceSOL.toFixed(6)} SOL`);
        return balanceSOL;
      }
    } catch (fallbackError) {
      console.error('❌ Fallback method also failed:', fallbackError);
    }
    
    return 0;
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log('=== USE EXISTING WALLET FOR TRADING ===');
  console.log(`Setting up your trading system to use wallet: ${WALLET_ADDRESS}`);
  
  // Update .env.trading file
  updateEnvFile();
  
  // Update trading configuration
  updateTradingConfig();
  
  // Check wallet balance
  const balance = await checkWalletBalance();
  
  if (balance > 0) {
    console.log(`\n=== WALLET READY FOR TRADING ===`);
    console.log(`✅ Wallet address: ${WALLET_ADDRESS}`);
    console.log(`✅ Wallet balance: ${balance.toFixed(6)} SOL`);
    console.log(`✅ Trading system configured to use this wallet for real trades`);
    
    console.log('\nTo start executing real trades:');
    console.log('1. Run: npx tsx run-trading-system.ts');
    console.log('\nThis will start the trading system with your wallet configured.');
    console.log('The system will automatically execute trades when it finds profitable opportunities.');
  } else {
    console.error(`\n❌ Could not verify wallet balance or wallet has no funds`);
    console.log(`Please make sure your wallet ${WALLET_ADDRESS} has SOL for trading.`);
  }
}

// Run the script
main();