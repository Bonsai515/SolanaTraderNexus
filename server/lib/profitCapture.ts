/**
 * Profit Capture System for Solana Trading
 *
 * This module handles collecting trading profits to the system wallet.
 * It manages periodic capture of profits, ensuring they are securely
 * transferred to the designated wallet for further capital deployment.
 */

import { Connection, Keypair, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import * as fs from 'fs';
import { logger } from '../logger';
import { heliusApiIntegration } from './heliusIntegration';
import { transactionVerifier } from './transactionVerifier';

/**
 * Agent profit data structure
 */
interface AgentProfit {
  agentId: string;
  agentName: string;
  totalProfit: number;
  lastCapture: number;
  walletAddress?: string;
}

/**
 * Transaction result interface
 */
interface TransactionResult {
  success: boolean;
  signature?: string;
  amount?: number;
  error?: string;
}

/**
 * Profit Capture System
 */
export class ProfitCapture {
  private initialized: boolean = false;
  private agentProfits: Map<string, AgentProfit> = new Map();
  private captureInterval: number = 30 * 60 * 1000; // 30 minutes
  private lastCaptureTime: number = 0;
  private connection: Connection | null = null;
  private autoCapture: boolean = true;
  private captureTimerId: NodeJS.Timeout | null = null;
  private systemWalletAddress: string;

  /**
   * Constructor
   * @param systemWalletAddress System wallet address for profit collection
   */
  constructor(systemWalletAddress?: string) {
    this.systemWalletAddress = systemWalletAddress || process.env.SYSTEM_WALLET_ADDRESS || 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
    this.loadProfitData();
  }

  /**
   * Initialize the profit capture system
   */
  public async initialize(rpcUrl?: string): Promise<boolean> {
    try {
      // Initialize connection
      if (heliusApiIntegration.isInitialized()) {
        this.connection = heliusApiIntegration.getConnection();
      } else if (rpcUrl) {
        this.connection = new Connection(rpcUrl);
      } else {
        throw new Error('No connection available and no RPC URL provided');
      }

      // Validate system wallet
      if (!this.systemWalletAddress) {
        logger.warn('No system wallet address specified for profit capture');
      } else {
        try {
          const systemPubkey = new PublicKey(this.systemWalletAddress);
          logger.info(`Profit capture system initialized with system wallet: ${this.systemWalletAddress}`);
        } catch (error) {
          logger.error(`Invalid system wallet address: ${this.systemWalletAddress}`);
          this.systemWalletAddress = '';
        }
      }

      this.initialized = true;

      // Start automatic capture if enabled
      if (this.autoCapture) {
        this.startAutomaticCapture();
      }

      return true;
    } catch (error) {
      logger.error('Failed to initialize profit capture system:', error);
      return false;
    }
  }

  /**
   * Check if the system is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Load profit data from file
   */
  private loadProfitData(): void {
    try {
      // Create directory if it doesn't exist
      const dataDir = './data';
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const filePath = `${dataDir}/profit_data.json`;
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        if (Array.isArray(data)) {
          data.forEach((agentProfit: AgentProfit) => {
            this.agentProfits.set(agentProfit.agentId, agentProfit);
          });
          
          logger.info(`Loaded profit data for ${data.length} agents`);
        }
      }
    } catch (error) {
      logger.error('Error loading profit data:', error);
    }
  }

  /**
   * Save profit data to file
   */
  private saveProfitData(): void {
    try {
      const dataDir = './data';
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const filePath = `${dataDir}/profit_data.json`;
      fs.writeFileSync(
        filePath,
        JSON.stringify(Array.from(this.agentProfits.values()), null, 2)
      );
    } catch (error) {
      logger.error('Error saving profit data:', error);
    }
  }

  /**
   * Record profit for an agent
   */
  public recordProfit(agentId: string, agentName: string, amount: number, walletAddress?: string): void {
    const existingProfit = this.agentProfits.get(agentId);
    
    if (existingProfit) {
      existingProfit.totalProfit += amount;
      if (walletAddress) {
        existingProfit.walletAddress = walletAddress;
      }
      this.agentProfits.set(agentId, existingProfit);
    } else {
      this.agentProfits.set(agentId, {
        agentId,
        agentName,
        totalProfit: amount,
        lastCapture: 0,
        walletAddress
      });
    }
    
    this.saveProfitData();
    logger.info(`Recorded ${amount} SOL profit for agent ${agentName} (${agentId})`);
  }

  /**
   * Get total profits
   */
  public getTotalProfits(): number {
    let total = 0;
    for (const profit of this.agentProfits.values()) {
      total += profit.totalProfit;
    }
    return total;
  }

  /**
   * Get profits by agent
   */
  public getProfitsByAgent(): AgentProfit[] {
    return Array.from(this.agentProfits.values());
  }

  /**
   * Capture profits from agent wallet to system wallet
   */
  public async captureProfit(agentId: string, walletPath: string, amount?: number): Promise<TransactionResult> {
    if (!this.initialized || !this.connection) {
      return {
        success: false,
        error: 'Profit capture system not initialized'
      };
    }

    if (!this.systemWalletAddress) {
      return {
        success: false,
        error: 'No system wallet address specified'
      };
    }

    const agentProfit = this.agentProfits.get(agentId);
    if (!agentProfit) {
      return {
        success: false,
        error: `No profit data found for agent ${agentId}`
      };
    }

    try {
      // Load agent wallet keypair
      const agentKeypair = loadWalletKeypair(walletPath);
      
      // Check wallet address
      const walletAddress = agentKeypair.publicKey.toString();
      if (agentProfit.walletAddress && agentProfit.walletAddress !== walletAddress) {
        logger.warn(`Agent wallet address mismatch: ${agentProfit.walletAddress} vs ${walletAddress}`);
      }
      
      // Get wallet balance
      const balance = await this.connection.getBalance(agentKeypair.publicKey);
      const balanceSOL = balance / 1e9;
      
      // Calculate capture amount
      const captureAmount = amount !== undefined ? amount : agentProfit.totalProfit;
      
      if (captureAmount > balanceSOL) {
        return {
          success: false,
          error: `Insufficient balance: ${balanceSOL} SOL (need ${captureAmount} SOL)`
        };
      }
      
      // Create transaction
      const transaction = new Transaction();
      
      // Add transfer instruction
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: agentKeypair.publicKey,
          toPubkey: new PublicKey(this.systemWalletAddress),
          lamports: captureAmount * 1e9
        })
      );
      
      // Set fee payer
      transaction.feePayer = agentKeypair.publicKey;
      
      const signature = await this.connection.sendTransaction(transaction, [agentKeypair]);
      
      // Verify transaction
      const verification = await transactionVerifier.monitorUntilConfirmed(
        signature, 
        10,  // 10 retries
        2000  // 2 second interval
      );
      
      if (verification.verified) {
        // Update last capture time
        agentProfit.lastCapture = Date.now();
        this.agentProfits.set(agentId, agentProfit);
        this.saveProfitData();
        
        logger.info(`Successfully captured ${captureAmount} SOL from agent ${agentProfit.agentName}`);
        
        return {
          success: true,
          signature,
          amount: captureAmount
        };
      } else {
        logger.error(`Failed to verify profit capture transaction: ${verification.error}`);
        return {
          success: false,
          signature,
          error: verification.error
        };
      }
    } catch (error: any) {
      logger.error(`Error in profit capture:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Capture profits from all agents
   */
  public async captureAllProfits(): Promise<{
    totalCaptured: number;
    results: { agentId: string; result: TransactionResult }[];
  }> {
    const results: { agentId: string; result: TransactionResult }[] = [];
    let totalCaptured = 0;
    
    if (!this.initialized) {
      return {
        totalCaptured: 0,
        results: [
          {
            agentId: 'system',
            result: {
              success: false,
              error: 'Profit capture system not initialized'
            }
          }
        ]
      };
    }
    
    for (const [agentId, agentProfit] of this.agentProfits.entries()) {
      if (!agentProfit.walletAddress) {
        results.push({
          agentId,
          result: {
            success: false,
            error: 'No wallet address specified for agent'
          }
        });
        continue;
      }
      
      // Skip if no profits to capture
      if (agentProfit.totalProfit <= 0) {
        continue;
      }
      
      // Find wallet path for agent
      const walletPath = getWalletPathForAgent(agentId);
      if (!walletPath) {
        results.push({
          agentId,
          result: {
            success: false,
            error: 'Could not find wallet path for agent'
          }
        });
        continue;
      }
      
      const result = await this.captureProfit(agentId, walletPath);
      results.push({ agentId, result });
      
      if (result.success && result.amount) {
        totalCaptured += result.amount;
      }
    }
    
    this.lastCaptureTime = Date.now();
    
    return {
      totalCaptured,
      results
    };
  }

  /**
   * Start automatic profit capture
   */
  public startAutomaticCapture(): void {
    if (this.captureTimerId) {
      clearInterval(this.captureTimerId);
    }
    
    this.autoCapture = true;
    this.captureTimerId = setInterval(() => {
      this.captureAllProfits()
        .then(result => {
          logger.info(`Automatic profit capture complete: ${result.totalCaptured} SOL captured`);
        })
        .catch(error => {
          logger.error('Error in automatic profit capture:', error);
        });
    }, this.captureInterval);
    
    logger.info(`Automatic profit capture started with interval of ${this.captureInterval / 60000} minutes`);
  }

  /**
   * Stop automatic profit capture
   */
  public stopAutomaticCapture(): void {
    if (this.captureTimerId) {
      clearInterval(this.captureTimerId);
      this.captureTimerId = null;
    }
    
    this.autoCapture = false;
    logger.info('Automatic profit capture stopped');
  }

  /**
   * Set capture interval
   */
  public setCaptureInterval(minutes: number): void {
    this.captureInterval = minutes * 60 * 1000;
    
    if (this.autoCapture && this.captureTimerId) {
      // Restart timer with new interval
      this.stopAutomaticCapture();
      this.startAutomaticCapture();
    }
    
    logger.info(`Profit capture interval set to ${minutes} minutes`);
  }

  /**
   * Reset profit data for an agent
   */
  public resetProfit(agentId: string): boolean {
    const agentProfit = this.agentProfits.get(agentId);
    
    if (!agentProfit) {
      return false;
    }
    
    agentProfit.totalProfit = 0;
    agentProfit.lastCapture = Date.now();
    this.agentProfits.set(agentId, agentProfit);
    this.saveProfitData();
    
    return true;
  }

  /**
   * Get system wallet address
   */
  public getSystemWalletAddress(): string {
    return this.systemWalletAddress;
  }

  /**
   * Set system wallet address
   */
  public setSystemWalletAddress(address: string): void {
    try {
      // Validate the address
      new PublicKey(address);
      this.systemWalletAddress = address;
      logger.info(`System wallet address set to ${address}`);
    } catch (error) {
      logger.error(`Invalid wallet address: ${address}`);
    }
  }
}

/**
 * Load wallet keypair from file
 */
function loadWalletKeypair(path: string): Keypair {
  const keypairData = JSON.parse(fs.readFileSync(path, 'utf8'));
  return Keypair.fromSecretKey(
    Uint8Array.from(keypairData)
  );
}

/**
 * Get wallet path for agent
 */
function getWalletPathForAgent(agentId: string): string | null {
  const walletDir = './wallets';
  
  if (!fs.existsSync(walletDir)) {
    return null;
  }
  
  // Check for exact match
  const exactPath = `${walletDir}/${agentId}.json`;
  if (fs.existsSync(exactPath)) {
    return exactPath;
  }
  
  // Check for prefix match
  const files = fs.readdirSync(walletDir);
  for (const file of files) {
    if (file.startsWith(agentId) && file.endsWith('.json')) {
      return `${walletDir}/${file}`;
    }
  }
  
  return null;
}

// Export singleton instance
export const profitCapture = new ProfitCapture();