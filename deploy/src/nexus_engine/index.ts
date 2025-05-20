/**
 * Nexus Transaction Engine
 * 
 * This engine handles actual blockchain transaction execution.
 */

import { Connection, PublicKey, Transaction, Keypair, SystemProgram } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { executeTransaction } from '../transaction-executor';

// Load environment variables
dotenv.config({ path: '.env.trading' });

// Constants
const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY || 'q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const SYNDICA_URL = `https://solana-mainnet.api.syndica.io/api-key/${SYNDICA_API_KEY}`;
const TRANSACTION_ENABLED = process.env.TRANSACTION_EXECUTION_ENABLED === 'true';
const USE_REAL_FUNDS = process.env.USE_REAL_FUNDS === 'true';
const WALLET_ADDRESS = process.env.TRADING_WALLET_ADDRESS || 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';

// Connection
const connection = new Connection(SYNDICA_URL);

class NexusEngine {
  private isInitialized: boolean = false;
  private isEnabled: boolean = false;
  
  constructor() {
    this.loadConfiguration();
  }
  
  /**
   * Load engine configuration
   */
  private loadConfiguration(): void {
    try {
      const configPath = path.join(process.cwd(), 'config', 'transaction-engine.json');
      
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        this.isEnabled = config.enabled && TRANSACTION_ENABLED && USE_REAL_FUNDS;
      } else {
        this.isEnabled = TRANSACTION_ENABLED && USE_REAL_FUNDS;
      }
      
      this.isInitialized = true;
      
      console.log(`Nexus Engine initialized. Transaction execution: ${this.isEnabled ? 'ENABLED' : 'DISABLED'}`);
    } catch (error) {
      console.error('Error loading Nexus Engine configuration:', error);
      this.isEnabled = false;
    }
  }
  
  /**
   * Check if engine is ready to execute transactions
   */
  public isReady(): boolean {
    return this.isInitialized && this.isEnabled;
  }
  
  /**
   * Execute a trade transaction
   */
  public async executeTrade(transaction: Transaction, signers: Keypair[]): Promise<string> {
    if (!this.isReady()) {
      throw new Error('Nexus Engine is not ready for transaction execution');
    }
    
    return executeTransaction(transaction, signers);
  }
  
  /**
   * Simulate a transaction before execution
   */
  public async simulateTransaction(transaction: Transaction): Promise<boolean> {
    try {
      const { value } = await connection.simulateTransaction(transaction);
      
      if (value.err) {
        console.error('Transaction simulation failed:', value.err);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error simulating transaction:', error);
      return false;
    }
  }
}

// Export singleton instance
export const nexusEngine = new NexusEngine();