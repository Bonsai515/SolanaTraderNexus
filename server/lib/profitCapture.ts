/**
 * Profit Capture System for Solana Trading
 * 
 * This module handles collecting trading profits to the system wallet.
 * It manages periodic capture of profits, ensuring they are securely
 * transferred to the designated wallet for further capital deployment.
 */

import { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as fs from 'fs';
import * as logger from '../logger';
import { heliusApiIntegration } from './heliusIntegration';
import { transactionVerifier } from './transactionVerifier';

// Interfaces for profit tracking
export interface AgentProfit {
  agentId: string;
  agentName: string;
  totalProfit: number; // In SOL
  lastCapture: number;
  walletAddress: string;
}

export interface CaptureResult {
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
  private systemWalletAddress: string;
  private agentProfits: Map<string, AgentProfit> = new Map();
  private captureInterval: number = 30 * 60 * 1000; // 30 minutes
  private lastCaptureTime: number = 0;
  private connection: Connection | null = null;
  private autoCapture: boolean = true;
  private captureTimerId: NodeJS.Timeout | null = null;
  
  /**
   * Constructor
   * @param systemWalletAddress System wallet address for profit collection
   */
  constructor(systemWalletAddress?: string) {
    this.systemWalletAddress = systemWalletAddress || 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
    
    // Try to use Helius connection if available
    if (heliusApiIntegration.isInitialized()) {
      this.connection = heliusApiIntegration.getConnection();
      this.initialized = true;
      logger.info('Profit capture system initialized with Helius connection');
    } else if (process.env.HELIUS_API_KEY) {
      this.connection = new Connection(
        `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
        'confirmed'
      );
      this.initialized = true;
      logger.info('Profit capture system initialized with Helius connection');
    } else {
      logger.warn('No valid RPC connection for profit capture system');
    }
    
    // Load saved profit data if available
    this.loadProfitData();
  }
  
  /**
   * Initialize the profit capture system
   */
  public async initialize(rpcUrl?: string): Promise<boolean> {
    if (this.initialized) {
      return true;
    }
    
    try {
      if (heliusApiIntegration.isInitialized()) {
        this.connection = heliusApiIntegration.getConnection();
      } else if (rpcUrl) {
        this.connection = new Connection(rpcUrl, 'confirmed');
      } else if (process.env.HELIUS_API_KEY) {
        this.connection = new Connection(
          `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
          'confirmed'
        );
      } else {
        throw new Error('No valid RPC connection for profit capture system');
      }
      
      // Verify system wallet exists
      const systemWallet = new PublicKey(this.systemWalletAddress);
      const accountInfo = await this.connection.getAccountInfo(systemWallet);
      
      if (!accountInfo) {
        logger.warn(`System wallet ${this.systemWalletAddress} not found on blockchain`);
      } else {
        const balance = await this.connection.getBalance(systemWallet);
        logger.info(`System wallet ${this.systemWalletAddress} found with balance: ${balance / LAMPORTS_PER_SOL} SOL`);
      }
      
      this.initialized = true;
      
      // Start automatic capture if enabled
      if (this.autoCapture) {
        this.startAutomaticCapture();
      }
      
      logger.info('Profit capture system initialized successfully');
      return true;
    } catch (error: any) {
      logger.error('Failed to initialize profit capture system:', error.message);
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
      const dataPath = './data/profit_data.json';
      
      if (fs.existsSync(dataPath)) {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        
        if (data && Array.isArray(data)) {
          this.agentProfits.clear();
          data.forEach((agentProfit: AgentProfit) => {
            this.agentProfits.set(agentProfit.agentId, agentProfit);
          });
          
          logger.info(`Loaded profit data for ${data.length} agents`);
        }
      } else {
        logger.info('No profit data file found, starting with empty data');
      }
    } catch (error: any) {
      logger.error('Failed to load profit data:', error.message);
    }
  }
  
  /**
   * Save profit data to file
   */
  private saveProfitData(): void {
    try {
      const dataPath = './data/profit_data.json';
      
      // Create data directory if it doesn't exist
      if (!fs.existsSync('./data')) {
        fs.mkdirSync('./data', { recursive: true });
      }
      
      const data = Array.from(this.agentProfits.values());
      fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
      
      logger.debug(`Saved profit data for ${data.length} agents`);
    } catch (error: any) {
      logger.error('Failed to save profit data:', error.message);
    }
  }
  
  /**
   * Record profit for an agent
   */
  public recordProfit(
    agentId: string,
    agentName: string,
    amount: number,
    walletAddress: string
  ): void {
    try {
      let agentProfit = this.agentProfits.get(agentId);
      
      if (!agentProfit) {
        agentProfit = {
          agentId,
          agentName,
          totalProfit: 0,
          lastCapture: 0,
          walletAddress
        };
      }
      
      agentProfit.totalProfit += amount;
      this.agentProfits.set(agentId, agentProfit);
      
      logger.info(`Recorded profit of ${amount} SOL for agent ${agentName} (${agentId})`);
      
      // Save updated data
      this.saveProfitData();
    } catch (error: any) {
      logger.error(`Failed to record profit for agent ${agentId}:`, error.message);
    }
  }
  
  /**
   * Get total profits
   */
  public getTotalProfits(): number {
    let total = 0;
    
    for (const agentProfit of this.agentProfits.values()) {
      total += agentProfit.totalProfit;
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
  public async captureProfit(
    agentId: string,
    walletPath: string,
    amount?: number
  ): Promise<CaptureResult> {
    try {
      if (!this.initialized || !this.connection) {
        await this.initialize();
        if (!this.connection) {
          throw new Error('Profit capture system not properly initialized');
        }
      }
      
      const agentProfit = this.agentProfits.get(agentId);
      
      if (!agentProfit) {
        throw new Error(`No profit data found for agent ${agentId}`);
      }
      
      // Load agent wallet
      const agentKeyData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
      const agentKeypair = Keypair.fromSecretKey(new Uint8Array(agentKeyData));
      
      // Get agent wallet balance
      const balance = await this.connection.getBalance(agentKeypair.publicKey);
      const balanceInSol = balance / LAMPORTS_PER_SOL;
      
      logger.info(`Agent ${agentProfit.agentName} wallet balance: ${balanceInSol} SOL`);
      
      // Determine capture amount
      const captureAmount = amount !== undefined ? amount : Math.min(balanceInSol * 0.9, agentProfit.totalProfit);
      
      if (captureAmount <= 0 || captureAmount > balanceInSol - 0.01) { // Keep at least 0.01 SOL for fees
        logger.warn(`Insufficient balance to capture profit from agent ${agentProfit.agentName}`);
        return {
          success: false,
          error: 'Insufficient balance for profit capture'
        };
      }
      
      // Create transfer transaction
      const transaction = new Transaction();
      
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: agentKeypair.publicKey,
          toPubkey: new PublicKey(this.systemWalletAddress),
          lamports: Math.floor(captureAmount * LAMPORTS_PER_SOL)
        })
      );
      
      // Sign and send transaction
      transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
      transaction.feePayer = agentKeypair.publicKey;
      
      const signature = await this.connection.sendTransaction(transaction, [agentKeypair]);
      
      // Verify transaction
      const verification = await transactionVerifier.monitorUntilConfirmed(signature);
      
      if (!verification.verified) {
        throw new Error(`Transaction failed: ${verification.error}`);
      }
      
      // Update agent profit data
      agentProfit.lastCapture = Date.now();
      this.agentProfits.set(agentId, agentProfit);
      this.saveProfitData();
      
      logger.info(`Successfully captured ${captureAmount} SOL from agent ${agentProfit.agentName} to system wallet`);
      
      return {
        success: true,
        signature,
        amount: captureAmount
      };
    } catch (error: any) {
      logger.error(`Failed to capture profit from agent ${agentId}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Capture profits from all agents
   */
  public async captureAllProfits(): Promise<CaptureResult[]> {
    const results: CaptureResult[] = [];
    
    if (this.agentProfits.size === 0) {
      logger.info('No agents with profits to capture');
      return [];
    }
    
    logger.info(`Capturing profits from ${this.agentProfits.size} agents...`);
    
    for (const [agentId, agentProfit] of this.agentProfits.entries()) {
      // Skip agents with zero profit
      if (agentProfit.totalProfit <= 0) {
        continue;
      }
      
      // Determine wallet path based on agent ID
      const walletPath = `./wallets/${agentId}.json`;
      
      if (!fs.existsSync(walletPath)) {
        results.push({
          success: false,
          error: `Wallet not found for agent ${agentId}`
        });
        continue;
      }
      
      const result = await this.captureProfit(agentId, walletPath);
      results.push(result);
    }
    
    this.lastCaptureTime = Date.now();
    
    logger.info(`Completed profit capture for ${results.length} agents`);
    return results;
  }
  
  /**
   * Start automatic profit capture
   */
  public startAutomaticCapture(): void {
    if (this.captureTimerId) {
      clearInterval(this.captureTimerId);
    }
    
    this.autoCapture = true;
    
    logger.info(`Starting automatic profit capture every ${this.captureInterval / 60000} minutes`);
    
    this.captureTimerId = setInterval(async () => {
      logger.info('Running scheduled profit capture...');
      await this.captureAllProfits();
    }, this.captureInterval);
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
    logger.info('Stopped automatic profit capture');
  }
  
  /**
   * Set capture interval
   */
  public setCaptureInterval(minutes: number): void {
    if (minutes < 1) {
      throw new Error('Capture interval must be at least 1 minute');
    }
    
    this.captureInterval = minutes * 60 * 1000;
    
    logger.info(`Set profit capture interval to ${minutes} minutes`);
    
    // Restart automatic capture if enabled
    if (this.autoCapture) {
      this.startAutomaticCapture();
    }
  }
  
  /**
   * Get time until next capture
   */
  public getTimeUntilNextCapture(): number {
    if (!this.autoCapture || !this.captureTimerId) {
      return -1;
    }
    
    const elapsed = Date.now() - this.lastCaptureTime;
    return Math.max(0, this.captureInterval - elapsed);
  }
  
  /**
   * Reset profit data
   */
  public resetProfitData(): void {
    this.agentProfits.clear();
    this.saveProfitData();
    logger.info('Reset all profit data');
  }
}

// Create singleton instance
export const profitCapture = new ProfitCapture();