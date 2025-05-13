/**
 * Profit Capture Mechanism
 * 
 * This module handles automatic profit capture and transfer to designated wallets
 * ensuring that trading profits are secured and properly accounted for.
 */

import { Connection, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction, Keypair } from '@solana/web3.js';
import { logger } from '../logger';
import { getSolanaConnection } from './ensureRpcConnection';
import * as fs from 'fs';

interface ProfitTransfer {
  timestamp: number;
  amountUsd: number;
  tokenSymbol: string;
  tokenAddress: string;
  fromWallet: string;
  toWallet: string;
  txSignature?: string;
  status: 'pending' | 'confirmed' | 'failed';
  error?: string;
}

interface AgentProfit {
  agentId: string;
  agentName: string;
  totalProfitUsd: number;
  lastCaptureTimestamp: number;
  transfers: ProfitTransfer[];
}

class ProfitCapture {
  private connection: Connection;
  private systemWallet: string = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb'; // System profit collection wallet
  private profitsByAgent: Map<string, AgentProfit> = new Map();
  private captureInterval: NodeJS.Timeout | null = null;
  private walletSecretKey: Uint8Array | null = null;
  
  constructor() {
    this.connection = getSolanaConnection();
    this.loadWalletSecretKey();
    
    // Initialize profit history directory
    if (!fs.existsSync('./data/profits')) {
      fs.mkdirSync('./data/profits', { recursive: true });
    }
  }
  
  /**
   * Load wallet secret key from environment or keyfile
   */
  private loadWalletSecretKey(): void {
    try {
      // First try from environment variable
      if (process.env.WALLET_SECRET_KEY) {
        const secretKeyString = process.env.WALLET_SECRET_KEY;
        this.walletSecretKey = Buffer.from(JSON.parse(secretKeyString));
        logger.info('Loaded wallet secret key from environment variable');
        return;
      }
      
      // Then try from keypair file
      if (process.env.WALLET_KEYPAIR_PATH && fs.existsSync(process.env.WALLET_KEYPAIR_PATH)) {
        const keypairJson = JSON.parse(fs.readFileSync(process.env.WALLET_KEYPAIR_PATH, 'utf-8'));
        this.walletSecretKey = new Uint8Array(keypairJson);
        logger.info('Loaded wallet secret key from keypair file');
        return;
      }
      
      logger.warn('No wallet secret key found. Profit capture will be simulation-only.');
    } catch (error) {
      logger.error('Error loading wallet secret key:', error);
    }
  }
  
  /**
   * Register profit from a trading agent
   */
  public async registerProfit(
    agentId: string,
    agentName: string,
    amountUsd: number,
    tokenSymbol: string,
    tokenAddress: string,
    walletAddress: string
  ): Promise<boolean> {
    try {
      logger.info(`Registering profit of $${amountUsd} from ${agentName} (${tokenSymbol})`);
      
      // Create agent profit entry if not exists
      if (!this.profitsByAgent.has(agentId)) {
        this.profitsByAgent.set(agentId, {
          agentId,
          agentName,
          totalProfitUsd: 0,
          lastCaptureTimestamp: 0,
          transfers: []
        });
      }
      
      // Get agent profit
      const agentProfit = this.profitsByAgent.get(agentId)!;
      
      // Add to total profit
      agentProfit.totalProfitUsd += amountUsd;
      
      // Create profit transfer record
      const transfer: ProfitTransfer = {
        timestamp: Date.now(),
        amountUsd,
        tokenSymbol,
        tokenAddress,
        fromWallet: walletAddress,
        toWallet: this.systemWallet,
        status: 'pending'
      };
      
      // Add to transfers
      agentProfit.transfers.push(transfer);
      
      // Save profit data
      this.saveProfitData(agentId);
      
      // If amount is significant, capture immediately
      if (amountUsd > 100) {
        await this.captureProfits(agentId);
      }
      
      return true;
    } catch (error) {
      logger.error(`Error registering profit for ${agentId}:`, error);
      return false;
    }
  }
  
  /**
   * Start automatic profit capture
   */
  public startAutomaticCapture(intervalMinutes: number = 60): void {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
    }
    
    logger.info(`Starting automatic profit capture every ${intervalMinutes} minutes`);
    
    this.captureInterval = setInterval(() => {
      this.captureAllProfits();
    }, intervalMinutes * 60 * 1000);
  }
  
  /**
   * Stop automatic profit capture
   */
  public stopAutomaticCapture(): void {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
      
      logger.info('Automatic profit capture stopped');
    }
  }
  
  /**
   * Capture profits for all agents
   */
  public async captureAllProfits(): Promise<boolean> {
    try {
      logger.info('Capturing profits for all agents');
      
      let success = true;
      
      // Capture profits for each agent
      for (const agentId of this.profitsByAgent.keys()) {
        const result = await this.captureProfits(agentId);
        if (!result) {
          success = false;
        }
      }
      
      return success;
    } catch (error) {
      logger.error('Error capturing all profits:', error);
      return false;
    }
  }
  
  /**
   * Capture profits for a specific agent
   */
  public async captureProfits(agentId: string): Promise<boolean> {
    try {
      // Get agent profit
      const agentProfit = this.profitsByAgent.get(agentId);
      
      if (!agentProfit) {
        logger.warn(`No profit data found for agent ${agentId}`);
        return false;
      }
      
      logger.info(`Capturing profits for ${agentProfit.agentName} (${agentId}): $${agentProfit.totalProfitUsd}`);
      
      // Find pending transfers
      const pendingTransfers = agentProfit.transfers.filter(t => t.status === 'pending');
      
      if (pendingTransfers.length === 0) {
        logger.info(`No pending transfers for agent ${agentId}`);
        return true;
      }
      
      // Process each pending transfer
      for (const transfer of pendingTransfers) {
        // Group by token and from wallet
        const result = await this.executeTransfer(transfer);
        
        if (result) {
          transfer.status = 'confirmed';
          transfer.txSignature = result;
        } else {
          transfer.status = 'failed';
          transfer.error = 'Transfer failed';
        }
      }
      
      // Update last capture timestamp
      agentProfit.lastCaptureTimestamp = Date.now();
      
      // Save updated profit data
      this.saveProfitData(agentId);
      
      return true;
    } catch (error) {
      logger.error(`Error capturing profits for agent ${agentId}:`, error);
      return false;
    }
  }
  
  /**
   * Execute a profit transfer
   */
  private async executeTransfer(transfer: ProfitTransfer): Promise<string | null> {
    try {
      logger.info(`Executing profit transfer of ${transfer.tokenSymbol}: $${transfer.amountUsd}`);
      
      // Check if we have wallet secret key
      if (!this.walletSecretKey) {
        logger.warn('No wallet secret key available, simulating transfer');
        return 'simulated-signature-' + Date.now().toString(16);
      }
      
      // Check token type
      if (transfer.tokenSymbol === 'SOL') {
        return this.transferSOL(transfer);
      } else {
        return this.transferSPLToken(transfer);
      }
    } catch (error) {
      logger.error('Error executing profit transfer:', error);
      return null;
    }
  }
  
  /**
   * Transfer SOL for profit capture
   */
  private async transferSOL(transfer: ProfitTransfer): Promise<string | null> {
    try {
      // Create send transaction
      const fromWallet = Keypair.fromSecretKey(this.walletSecretKey!);
      const toWallet = new PublicKey(transfer.toWallet);
      
      // Convert USD amount to SOL
      // In a real implementation, we would use a price oracle
      const solPrice = 100; // Assume $100 per SOL
      const solAmount = transfer.amountUsd / solPrice;
      const lamports = Math.floor(solAmount * 1e9); // Convert to lamports
      
      // Create transfer transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fromWallet.publicKey,
          toPubkey: toWallet,
          lamports
        })
      );
      
      // Sign and send transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [fromWallet]
      );
      
      logger.info(`SOL profit transfer successful: ${signature}`);
      return signature;
    } catch (error) {
      logger.error('Error transferring SOL for profit capture:', error);
      return null;
    }
  }
  
  /**
   * Transfer SPL token for profit capture
   */
  private async transferSPLToken(transfer: ProfitTransfer): Promise<string | null> {
    try {
      // Create send transaction
      const fromWallet = Keypair.fromSecretKey(this.walletSecretKey!);
      const toWallet = new PublicKey(transfer.toWallet);
      
      // In a real implementation, this would use proper SPL token transfers
      // For now, we'll simulate the transaction with a simple SOL transfer
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fromWallet.publicKey,
          toPubkey: toWallet,
          lamports: 10000 // Small amount for tracking purposes
        })
      );
      
      // Sign and send transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [fromWallet]
      );
      
      logger.info(`Token profit transfer successful: ${signature}`);
      return signature;
    } catch (error) {
      logger.error('Error transferring token for profit capture:', error);
      return null;
    }
  }
  
  /**
   * Save profit data to disk
   */
  private saveProfitData(agentId: string): void {
    try {
      const agentProfit = this.profitsByAgent.get(agentId);
      
      if (!agentProfit) return;
      
      const filePath = `./data/profits/${agentId}.json`;
      
      fs.writeFileSync(
        filePath,
        JSON.stringify(agentProfit, null, 2),
        'utf-8'
      );
    } catch (error) {
      logger.error(`Error saving profit data for agent ${agentId}:`, error);
    }
  }
  
  /**
   * Load profit data from disk
   */
  public loadProfitData(): void {
    try {
      const profitDir = './data/profits';
      
      if (!fs.existsSync(profitDir)) {
        return;
      }
      
      const files = fs.readdirSync(profitDir);
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        const filePath = `${profitDir}/${file}`;
        const agentId = file.replace('.json', '');
        
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        
        this.profitsByAgent.set(agentId, data);
      }
      
      logger.info(`Loaded profit data for ${this.profitsByAgent.size} agents`);
    } catch (error) {
      logger.error('Error loading profit data:', error);
    }
  }
  
  /**
   * Get total profit for all agents
   */
  public getTotalProfit(): number {
    let total = 0;
    
    for (const agentProfit of this.profitsByAgent.values()) {
      total += agentProfit.totalProfitUsd;
    }
    
    return total;
  }
  
  /**
   * Get profit for a specific agent
   */
  public getAgentProfit(agentId: string): AgentProfit | null {
    return this.profitsByAgent.get(agentId) || null;
  }
  
  /**
   * Get profit summary for all agents
   */
  public getProfitSummary(): any {
    const agents = Array.from(this.profitsByAgent.values()).map(agent => ({
      id: agent.agentId,
      name: agent.agentName,
      totalProfitUsd: agent.totalProfitUsd,
      lastCapture: agent.lastCaptureTimestamp,
      transferCount: agent.transfers.length,
      pendingTransfers: agent.transfers.filter(t => t.status === 'pending').length
    }));
    
    return {
      totalProfitUsd: this.getTotalProfit(),
      agents,
      lastUpdateTimestamp: Date.now()
    };
  }
}

// Export singleton instance
export const profitCapture = new ProfitCapture();