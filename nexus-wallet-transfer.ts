/**
 * Nexus Wallet Transfer 
 * 
 * Transfers funds between wallets using the Nexus Pro system
 * without requiring private keys directly in the code.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import axios from 'axios';

// Configuration
const LOG_PATH = './nexus-transfer.log';
const HPN_WALLET = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const PHANTOM_WALLET = '2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH';
const RPC_URL = 'https://empty-hidden-spring.solana-mainnet.quiknode.pro/ea24f1bb95ea3b2dc4cddbe74a4bce8e10eaa88e/';
const NEXUS_CONFIG_PATH = './nexus-config.json';
const NEXUS_SIGNAL_PATH = './nexus-transfer-signal.json';

// Initialize log
if (!fs.existsSync(LOG_PATH)) {
  fs.writeFileSync(LOG_PATH, '--- NEXUS WALLET TRANSFER LOG ---\n');
}

// Log function
function log(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_PATH, logMessage + '\n');
}

// Connect to Solana
function connectToSolana(): Connection {
  try {
    log('Connecting to Solana blockchain via premium QuickNode RPC...');
    return new Connection(RPC_URL, 'confirmed');
  } catch (error) {
    log(`Error connecting to Solana: ${(error as Error).message}`);
    throw error;
  }
}

// Check wallet balance
async function checkWalletBalance(connection: Connection, walletAddress: string): Promise<number> {
  try {
    const publicKey = new PublicKey(walletAddress);
    const balance = await connection.getBalance(publicKey);
    const balanceSOL = balance / LAMPORTS_PER_SOL;
    
    log(`Wallet ${walletAddress} balance: ${balanceSOL.toFixed(6)} SOL`);
    return balance;
  } catch (error) {
    log(`Error checking wallet balance: ${(error as Error).message}`);
    return 0;
  }
}

// Create Nexus transfer signal
function createTransferSignal() {
  try {
    // Create a signal file for Nexus to process
    const signal = {
      type: 'wallet_transfer',
      source: HPN_WALLET,
      destination: PHANTOM_WALLET,
      amount: 'all', // Transfer all funds minus fees
      timestamp: Date.now(),
      priority: 'high',
      id: `transfer-${Date.now()}`,
      callback: null
    };
    
    fs.writeFileSync(NEXUS_SIGNAL_PATH, JSON.stringify(signal, null, 2));
    log('Created Nexus transfer signal file');
    
    return true;
  } catch (error) {
    log(`Error creating transfer signal: ${(error as Error).message}`);
    return false;
  }
}

// Create Nexus wallet config
function updateNexusConfig() {
  try {
    // Create or update Nexus configuration
    const config = {
      walletTransfer: {
        enabled: true,
        fromAddress: HPN_WALLET,
        toAddress: PHANTOM_WALLET,
        transferAll: true,
        timestamp: Date.now()
      },
      lastUpdated: new Date().toISOString()
    };
    
    fs.writeFileSync(NEXUS_CONFIG_PATH, JSON.stringify(config, null, 2));
    log('Updated Nexus configuration for wallet transfer');
    
    return true;
  } catch (error) {
    log(`Error updating Nexus configuration: ${(error as Error).message}`);
    return false;
  }
}

// Create Nexus transaction file
function createNexusTransaction() {
  try {
    // Create a transaction descriptor for Nexus
    const dataDir = path.join('.', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const transaction = {
      type: 'transfer',
      source: HPN_WALLET,
      destination: PHANTOM_WALLET,
      amount: 'all',
      fee: 5000, // 0.000005 SOL
      priority: 'high',
      timestamp: Date.now(),
      status: 'pending',
      id: `transfer-${Date.now()}`,
      description: 'Transfer all funds from HPN wallet to Phantom wallet'
    };
    
    const transactionsPath = path.join(dataDir, 'nexus-transactions.json');
    let transactions = [];
    
    if (fs.existsSync(transactionsPath)) {
      try {
        transactions = JSON.parse(fs.readFileSync(transactionsPath, 'utf8'));
      } catch (error) {
        log(`Error reading existing transactions: ${(error as Error).message}`);
      }
    }
    
    transactions.push(transaction);
    fs.writeFileSync(transactionsPath, JSON.stringify(transactions, null, 2));
    log('Added transfer transaction to Nexus transaction queue');
    
    return true;
  } catch (error) {
    log(`Error creating Nexus transaction: ${(error as Error).message}`);
    return false;
  }
}

// Display instructions for verifying and completing the transfer
function displayTransferInstructions(hpnBalance: number, phantomBalance: number) {
  console.log('\n===== WALLET TRANSFER INSTRUCTIONS =====');
  console.log('\nThe Nexus system has been configured to transfer your funds:');
  console.log(`FROM: ${HPN_WALLET} (${(hpnBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL)`);
  console.log(`TO: ${PHANTOM_WALLET} (${(phantomBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL)`);
  
  console.log('\nThe transfer is now queued in the Nexus system!');
  console.log('\nTo monitor the transfer:');
  console.log('1. Check your Phantom wallet balance periodically');
  console.log('2. Verify on Solscan when complete: https://solscan.io/account/' + PHANTOM_WALLET);
  
  console.log('\nOnce the transfer is complete, you can use:');
  console.log('npx ts-node nexus-phantom-connector.ts');
  console.log('to verify your new balance and ensure Nexus Pro Engine is properly connected.');
  
  console.log('\nExpected total after transfer: ~' + 
    ((hpnBalance + phantomBalance - 5000) / LAMPORTS_PER_SOL).toFixed(6) + ' SOL');
}

// Main function
async function main() {
  try {
    log('Starting Nexus wallet transfer process...');
    
    // Connect to Solana
    const connection = connectToSolana();
    
    // Check both wallet balances
    const hpnBalance = await checkWalletBalance(connection, HPN_WALLET);
    const phantomBalance = await checkWalletBalance(connection, PHANTOM_WALLET);
    
    // Create all necessary files for Nexus to process the transfer
    const signalCreated = createTransferSignal();
    const configUpdated = updateNexusConfig();
    const transactionCreated = createNexusTransaction();
    
    if (signalCreated && configUpdated && transactionCreated) {
      log('Successfully created all required configurations for Nexus transfer');
      displayTransferInstructions(hpnBalance, phantomBalance);
    } else {
      log('Failed to create all required configurations for Nexus transfer');
      console.log('\n❌ Transfer setup was not completed successfully.');
    }
    
  } catch (error) {
    log(`Error in transfer process: ${(error as Error).message}`);
    console.log(`\n❌ Error: ${(error as Error).message}`);
  }
}

// Run main function
if (require.main === module) {
  main().catch(error => {
    log(`Unhandled error: ${error.message}`);
  });
}