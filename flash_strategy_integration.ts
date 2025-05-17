/**
 * Flash Strategy Integration
 * 
 * Direct interface to run the Quantum Flash Strategy
 */

import { Connection } from '@solana/web3.js';
import { QuantumFlashStrategy } from './server/strategies/quantum_flash_strategy';
import { rpcManager } from './server/lib/enhancedRpcManager';
import * as fs from 'fs';
import * as path from 'path';

// Default wallet path
const DEFAULT_WALLET_PATH = path.join(process.cwd(), 'data', 'wallets.json');

/**
 * Get wallet for the strategy
 */
function getWallet() {
  try {
    // Load wallet data from file
    const walletData = JSON.parse(fs.readFileSync(DEFAULT_WALLET_PATH, 'utf8'));
    
    // If the wallet data has a 'mainWallet' property, use it
    if (walletData.mainWallet) {
      console.log(`Using main wallet: ${walletData.mainWallet.publicKey}`);
      return walletData.mainWallet;
    }
    
    // Otherwise, use the first wallet in the wallets array
    if (walletData.wallets && walletData.wallets.length > 0) {
      console.log(`Using first wallet: ${walletData.wallets[0].publicKey}`);
      return walletData.wallets[0];
    }
    
    throw new Error('No wallet found in wallet data');
  } catch (error) {
    console.error('Error loading wallet:', error);
    throw error;
  }
}

/**
 * Initialize the flash strategy
 */
export async function initializeFlashStrategy() {
  try {
    // Get healthy endpoint from the RPC manager
    const endpoints = rpcManager.getEndpointStatus();
    const healthyEndpoint = endpoints.find(e => e.healthy)?.url || 'https://api.mainnet-beta.solana.com';
    
    // Get connection
    const connection = new Connection(healthyEndpoint);
    
    // Get wallet
    const wallet = getWallet();
    
    // Create and initialize strategy
    const strategy = new QuantumFlashStrategy(connection, wallet);
    await strategy.initialize();
    
    console.log('Quantum Flash Strategy initialized successfully');
    
    return strategy;
  } catch (error) {
    console.error('Error initializing flash strategy:', error);
    throw error;
  }
}

/**
 * Execute a single day's strategy
 * @param day Day number (1-7)
 * @param amount Amount in SOL (default: 1.5 SOL)
 */
export async function executeSingleDayStrategy(day: number = 1, amount: number = 1.5) {
  try {
    // Convert SOL to lamports
    const lamports = amount * 1_000_000_000;
    
    console.log(`Executing Day ${day} strategy with ${amount} SOL`);
    
    // Initialize strategy
    const strategy = await initializeFlashStrategy();
    
    // Execute strategy
    const result = await strategy.executeDailyStrategy(lamports, day);
    
    // Format results for display
    return {
      day: result.day,
      startingSol: result.startingAmount / 1_000_000_000,
      endingSol: result.endingAmount / 1_000_000_000,
      profitSol: result.profit / 1_000_000_000,
      operations: result.operations,
      successfulOperations: result.successfulOperations,
      successRate: (result.successfulOperations / result.operations) * 100
    };
  } catch (error) {
    console.error('Error executing single day strategy:', error);
    throw error;
  }
}

/**
 * Execute the full weekly strategy
 * @param startingAmount Amount in SOL (default: 2 SOL)
 */
export async function executeFullWeekStrategy(startingAmount: number = 2) {
  try {
    // Convert SOL to lamports
    const lamports = startingAmount * 1_000_000_000;
    
    console.log(`Executing full 7-day strategy with ${startingAmount} SOL`);
    
    // Initialize strategy
    const strategy = await initializeFlashStrategy();
    
    // Execute strategy
    const result = await strategy.executeWeeklyStrategy(lamports);
    
    // Format results for display
    return {
      startingSol: result.startingAmount / 1_000_000_000,
      finalSol: result.finalAmount / 1_000_000_000,
      profitSol: result.totalProfit / 1_000_000_000,
      growthPercentage: result.growthPercentage,
      dailyResults: result.dailyResults.map(day => ({
        day: day.day,
        startingSol: day.startingAmount / 1_000_000_000,
        endingSol: day.endingAmount / 1_000_000_000,
        profitSol: day.profit / 1_000_000_000,
        operations: day.operations,
        successfulOperations: day.successfulOperations,
        successRate: (day.successfulOperations / day.operations) * 100
      }))
    };
  } catch (error) {
    console.error('Error executing weekly strategy:', error);
    throw error;
  }
}