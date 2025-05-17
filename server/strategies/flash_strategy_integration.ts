/**
 * Flash Strategy Integration
 * 
 * Integrates the Quantum Flash Strategy with the existing trading system
 */

import { Connection } from '@solana/web3.js';
import { QuantumFlashStrategy } from './quantum_flash_strategy';
import { rpcManager } from '../lib/enhancedRpcManager';
import { multiSourcePriceFeed } from '../lib/multiSourcePriceFeed';
import * as fs from 'fs';
import * as path from 'path';

// Path to store strategy execution logs
const LOG_DIR = path.join(process.cwd(), 'logs', 'strategies');

/**
 * Flash Strategy Integration
 */
export class FlashStrategyIntegration {
  private strategy: QuantumFlashStrategy | null = null;
  private isInitialized: boolean = false;
  
  /**
   * Create a new Flash Strategy Integration
   * @param walletProvider Function that returns a wallet
   */
  constructor(private walletProvider: () => any) {
    // Ensure log directory exists
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  }
  
  /**
   * Initialize the flash strategy
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('Initializing Flash Strategy Integration...');
      
      // Get connection from RPC manager
      // Use the most healthy endpoint from the RPC manager
      const endpoints = rpcManager.getEndpointStatus();
      const healthyEndpoint = endpoints.find(e => e.healthy)?.url || 'https://api.mainnet-beta.solana.com';
      const connection = new Connection(healthyEndpoint);
      
      // Get wallet
      const wallet = this.walletProvider();
      if (!wallet) {
        throw new Error('No wallet provided');
      }
      
      // Create strategy instance
      this.strategy = new QuantumFlashStrategy(connection, wallet, 80); // 0.8% slippage tolerance
      
      // Initialize strategy
      const success = await this.strategy.initialize();
      this.isInitialized = success;
      
      console.log('Flash Strategy Integration initialized:', success);
      return success;
    } catch (error) {
      console.error('Failed to initialize Flash Strategy Integration:', error);
      this.isInitialized = false;
      return false;
    }
  }
  
  /**
   * Execute the strategy for a single day
   * @param day Day number (1-7)
   * @param amount Amount in lamports
   */
  async executeDailyStrategy(day: number, amount: number): Promise<any> {
    if (!this.isInitialized || !this.strategy) {
      console.log('Strategy not initialized, initializing now...');
      const success = await this.initialize();
      if (!success) {
        throw new Error('Failed to initialize strategy');
      }
    }
    
    console.log(`Executing Flash Strategy for day ${day} with ${amount / 1_000_000_000} SOL`);
    
    try {
      // Execute strategy
      const result = await this.strategy.executeDailyStrategy(amount, day);
      
      // Log result
      this.logStrategyExecution({
        timestamp: new Date().toISOString(),
        day,
        startingAmount: amount,
        endingAmount: result.endingAmount,
        profit: result.profit,
        operations: result.operations,
        successfulOperations: result.successfulOperations,
        successRate: result.successfulOperations / result.operations,
      });
      
      return result;
    } catch (error) {
      console.error('Error executing daily strategy:', error);
      throw error;
    }
  }
  
  /**
   * Execute the full weekly strategy
   * @param startingAmount Starting amount in lamports
   */
  async executeWeeklyStrategy(startingAmount: number): Promise<any> {
    if (!this.isInitialized || !this.strategy) {
      console.log('Strategy not initialized, initializing now...');
      const success = await this.initialize();
      if (!success) {
        throw new Error('Failed to initialize strategy');
      }
    }
    
    console.log(`Executing full Flash Strategy with ${startingAmount / 1_000_000_000} SOL`);
    
    try {
      // Execute strategy
      return await this.strategy.executeWeeklyStrategy(startingAmount);
    } catch (error) {
      console.error('Error executing weekly strategy:', error);
      throw error;
    }
  }
  
  /**
   * Log strategy execution
   */
  private logStrategyExecution(data: any): void {
    try {
      const logFile = path.join(LOG_DIR, `flash-strategy-${new Date().toISOString().split('T')[0]}.json`);
      
      // Read existing logs if file exists
      let logs: any[] = [];
      if (fs.existsSync(logFile)) {
        const content = fs.readFileSync(logFile, 'utf8');
        logs = JSON.parse(content);
      }
      
      // Add new log
      logs.push(data);
      
      // Write back to file
      fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
    } catch (error) {
      console.error('Error logging strategy execution:', error);
    }
  }
}

// Singleton instance
let flashStrategyInstance: FlashStrategyIntegration | null = null;

/**
 * Get or create flash strategy integration
 * @param walletProvider Function that returns a wallet
 */
export function getFlashStrategyIntegration(walletProvider: () => any): FlashStrategyIntegration {
  if (!flashStrategyInstance) {
    flashStrategyInstance = new FlashStrategyIntegration(walletProvider);
  }
  return flashStrategyInstance;
}