/**
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
const SYNDICA_URL = `https://solana-mainnet.api.syndica.io/api-key/${SYNDICA_API_KEY}`;
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
      console.error(`❌ Wallet ${WALLET_ADDRESS} does not exist`);
      return false;
    }
    
    // Check wallet balance
    const balance = await connection.getBalance(new PublicKey(WALLET_ADDRESS));
    const balanceSOL = balance / 1000000000; // Convert lamports to SOL
    
    if (balanceSOL < 0.001) {
      console.error(`❌ Wallet balance too low: ${balanceSOL} SOL`);
      return false;
    }
    
    console.log(`✅ Wallet ${WALLET_ADDRESS} exists with ${balanceSOL} SOL`);
    
    // Check RPC connection
    const version = await connection.getVersion();
    console.log(`✅ Connected to Solana ${version["solana-core"]}`);
    
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
    if (!envContent.includes(`${key}=`)) {
      envContent += `${key}=${value}
`;
    } else {
      envContent = envContent.replace(
        new RegExp(`${key}=.*`, 'g'),
        `${key}=${value}`
      );
    }
  }
  
  // Save the updated env file
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Updated .env.trading with real money trading settings');
  
  // Update trading config
  await updateTradingConfig();
  
  console.log('\n=== REAL MONEY TRADING ACTIVATED ===');
  console.log('✅ System will now execute actual trades on the Solana blockchain');
  console.log('✅ Trades will use real funds from your wallet');
  console.log(`✅ Trading wallet: ${WALLET_ADDRESS}`);
  
  return true;
}

// Export activation function
export default activateRealMoneyTrading;

// Run if called directly
if (require.main === module) {
  activateRealMoneyTrading();
}