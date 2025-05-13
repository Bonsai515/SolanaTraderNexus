/**
 * Agent Singularity - Cross-Chain Strategy Master
 * 
 * This agent specializes in cross-chain arbitrage and operations, 
 * focusing on opportunities across multiple blockchains via Wormhole.
 * It's designed to work with the CrossChain transformer for discovery
 * and execution of profitable cross-chain trades.
 */

import * as web3 from '@solana/web3.js';
import { logger } from '../logger';
import * as nexusEngine from '../nexus-transaction-engine';
import { priceFeedCache } from '../priceFeedCache';
import { securityTransformer } from '../security-connector';
import { crossChainTransformer } from '../crosschain-connector';

// Types for cross-chain operations
interface ChainConfig {
  chainId: string;
  name: string;
  rpcUrl?: string;
  explorer?: string;
  enabled: boolean;
  gasAsset: string;
  stablecoins: string[];
}

interface CrossChainOpportunity {
  id: string;
  sourceChain: string;
  targetChain: string;
  sourceToken: string;
  targetToken: string;
  sourceAmount?: number;
  expectedTargetAmount?: number;
  estimatedProfitUsd: number;
  estimatedFee: number;
  estimatedTime: number;
  confidence: number;
  routePath?: any;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  timestamp: number;
}

interface CrossChainTransaction {
  opportunityId: string;
  sourceChain: string;
  targetChain: string;
  sourceToken: string;
  targetToken: string;
  sourceAmount: number;
  targetAmount?: number;
  sourceTxHash?: string;
  targetTxHash?: string;
  bridgeTxHash?: string;
  startTime: number;
  completionTime?: number;
  status: 'initiated' | 'source_confirmed' | 'bridging' | 'target_confirmed' | 'completed' | 'failed';
  profit?: number;
  errorMessage?: string;
}

// In-memory state for the Singularity agent
class SingularityAgent {
  private isActive: boolean = false;
  private sourceWallet: string | null = null;
  private targetWallet: string | null = null;
  private profitWallet: string | null = null;
  private scanInterval: NodeJS.Timeout | null = null;
  private activeTransactions: Map<string, CrossChainTransaction> = new Map();
  private transactionHistory: CrossChainTransaction[] = [];
  private opportunities: CrossChainOpportunity[] = [];
  private chains: ChainConfig[] = [
    {
      chainId: '1',
      name: 'Solana',
      enabled: true,
      gasAsset: 'SOL',
      stablecoins: ['USDC', 'USDT', 'USDH']
    },
    {
      chainId: '2',
      name: 'Ethereum',
      enabled: true,
      gasAsset: 'ETH',
      stablecoins: ['USDC', 'USDT', 'DAI']
    },
    {
      chainId: '4',
      name: 'Arbitrum',
      enabled: true,
      gasAsset: 'ETH',
      stablecoins: ['USDC', 'USDT']
    },
    {
      chainId: '5',
      name: 'Base',
      enabled: true,
      gasAsset: 'ETH',
      stablecoins: ['USDC']
    }
  ];
  private settings = {
    minProfitUsd: 10,
    maxTimeoutSeconds: 300,
    minConfidence: 0.7,
    maxConcurrentTransactions: 3,
    scanIntervalMs: 15000,
    defaultAmount: 100, // USD
    gasBuffer: 1.5, // Multiplier for estimated gas
    bridgeTimeoutMs: 180000 // 3 minutes
  };

  constructor() {
    logger.info('Initializing Singularity Cross-Chain Agent');
  }

  /**
   * Activate the Singularity agent
   */
  public async activate(
    sourceWallet: string,
    targetWallet: string,
    profitWallet: string
  ): Promise<boolean> {
    try {
      if (this.isActive) {
        logger.info('Singularity agent is already active');
        return true;
      }

      this.sourceWallet = sourceWallet;
      this.targetWallet = targetWallet;
      this.profitWallet = profitWallet;
      
      // Register wallets with the Nexus engine
      nexusEngine.registerWallet(sourceWallet);
      if (targetWallet !== sourceWallet) {
        nexusEngine.registerWallet(targetWallet);
      }
      nexusEngine.registerWallet(profitWallet);
      
      // Start opportunity scanning
      this.startOpportunityScan();
      
      this.isActive = true;
      logger.info('Singularity agent activated successfully');
      return true;
    } catch (error) {
      logger.error('Failed to activate Singularity agent:', error);
      return false;
    }
  }

  /**
   * Deactivate the Singularity agent
   */
  public async deactivate(): Promise<boolean> {
    try {
      if (!this.isActive) {
        logger.info('Singularity agent is already inactive');
        return true;
      }

      if (this.scanInterval) {
        clearInterval(this.scanInterval);
        this.scanInterval = null;
      }

      this.isActive = false;
      logger.info('Singularity agent deactivated successfully');
      return true;
    } catch (error) {
      logger.error('Failed to deactivate Singularity agent:', error);
      return false;
    }
  }

  /**
   * Get the current status of the Singularity agent
   */
  public getStatus(): any {
    return {
      isActive: this.isActive,
      sourceWallet: this.sourceWallet,
      targetWallet: this.targetWallet,
      profitWallet: this.profitWallet,
      activeTransactions: Array.from(this.activeTransactions.values()),
      recentTransactions: this.transactionHistory.slice(-5), // Last 5 transactions
      pendingOpportunities: this.opportunities.length,
      enabledChains: this.chains.filter(c => c.enabled).map(c => c.name),
      settings: this.settings,
      metrics: this.getPerformanceMetrics()
    };
  }

  /**
   * Update agent settings
   */
  public updateSettings(newSettings: Partial<typeof this.settings>): boolean {
    try {
      this.settings = { ...this.settings, ...newSettings };
      logger.info('Singularity settings updated:', this.settings);
      
      // If scan interval changed and we're active, restart scanning
      if (
        newSettings.scanIntervalMs &&
        newSettings.scanIntervalMs !== this.settings.scanIntervalMs &&
        this.isActive
      ) {
        this.startOpportunityScan();
      }
      
      return true;
    } catch (error) {
      logger.error('Failed to update Singularity settings:', error);
      return false;
    }
  }

  /**
   * Update chain configuration
   */
  public updateChainConfig(chainId: string, config: Partial<ChainConfig>): boolean {
    try {
      const chainIndex = this.chains.findIndex(c => c.chainId === chainId);
      
      if (chainIndex === -1) {
        // Add new chain
        if (config.chainId && config.name && config.gasAsset && config.stablecoins) {
          this.chains.push({
            chainId: config.chainId,
            name: config.name,
            rpcUrl: config.rpcUrl,
            explorer: config.explorer,
            enabled: config.enabled ?? true,
            gasAsset: config.gasAsset,
            stablecoins: config.stablecoins
          });
          logger.info(`Added new chain: ${config.name}`);
        } else {
          logger.error('Cannot add new chain: missing required fields');
          return false;
        }
      } else {
        // Update existing chain
        this.chains[chainIndex] = { ...this.chains[chainIndex], ...config };
        logger.info(`Updated chain configuration for ${this.chains[chainIndex].name}`);
      }
      
      return true;
    } catch (error) {
      logger.error('Failed to update chain configuration:', error);
      return false;
    }
  }

  /**
   * Start scanning for cross-chain opportunities
   */
  private startOpportunityScan(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
    }

    // Scan at the configured interval
    this.scanInterval = setInterval(async () => {
      if (!this.isActive) return;

      try {
        // Scan for opportunities
        const newOpportunities = await this.findCrossChainOpportunities();
        
        // Process and filter the opportunities
        const validOpportunities = this.filterAndRankOpportunities(newOpportunities);
        
        // Add new opportunities to the queue
        this.opportunities.push(...validOpportunities);
        
        // Execute pending opportunities
        await this.executeOpportunities();
        
        // Monitor active transactions
        await this.monitorActiveTransactions();
      } catch (error) {
        logger.error('Error in Singularity opportunity scan:', error);
      }
    }, this.settings.scanIntervalMs);
  }

  /**
   * Find cross-chain arbitrage opportunities
   */
  private async findCrossChainOpportunities(): Promise<CrossChainOpportunity[]> {
    const opportunities: CrossChainOpportunity[] = [];
    
    try {
      // Use the CrossChain transformer to find opportunities
      const crossChainOpps = await crossChainTransformer.findArbitrageOpportunities();
      
      // Convert to our format
      for (const opp of crossChainOpps) {
        // Check token security
        if (opp.sourceToken) {
          const security = await securityTransformer.checkTokenSecurity(opp.sourceToken);
          
          if (!security.isSafe) {
            logger.debug(`Skipping cross-chain opportunity with unsafe token: ${opp.sourceToken}`);
            continue;
          }
        }
        
        // Only include opportunities between enabled chains
        const sourceChainConfig = this.chains.find(c => c.name === opp.sourceChain);
        const targetChainConfig = this.chains.find(c => c.name === opp.targetChain);
        
        if (!sourceChainConfig?.enabled || !targetChainConfig?.enabled) {
          logger.debug(`Skipping opportunity between disabled chains: ${opp.sourceChain} -> ${opp.targetChain}`);
          continue;
        }
        
        opportunities.push({
          id: `xchain-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          sourceChain: opp.sourceChain,
          targetChain: opp.targetChain,
          sourceToken: opp.sourceToken,
          targetToken: opp.targetToken,
          sourceAmount: opp.sourceAmount || this.settings.defaultAmount,
          expectedTargetAmount: opp.expectedTargetAmount,
          estimatedProfitUsd: opp.estimatedProfit,
          estimatedFee: opp.estimatedFee || 0,
          estimatedTime: opp.estimatedTime || 60000, // ms
          confidence: opp.confidence || 0.7,
          routePath: opp.routePath,
          status: 'pending',
          timestamp: Date.now()
        });
      }
    } catch (error) {
      logger.error('Error finding cross-chain opportunities:', error);
    }
    
    return opportunities;
  }

  /**
   * Filter and rank opportunities by expected profit and confidence
   */
  private filterAndRankOpportunities(opps: CrossChainOpportunity[]): CrossChainOpportunity[] {
    // Filter based on our settings
    let filtered = opps.filter(opp => 
      opp.estimatedProfitUsd >= this.settings.minProfitUsd &&
      opp.confidence >= this.settings.minConfidence &&
      opp.estimatedTime <= this.settings.maxTimeoutSeconds * 1000
    );
    
    // Sort by estimated profit (highest first)
    return filtered.sort((a, b) => b.estimatedProfitUsd - a.estimatedProfitUsd);
  }

  /**
   * Execute pending opportunities
   */
  private async executeOpportunities(): Promise<void> {
    if (this.opportunities.length === 0) return;
    
    // Only execute new transactions if we're below the concurrent limit
    const availableSlots = this.settings.maxConcurrentTransactions - this.activeTransactions.size;
    
    if (availableSlots <= 0) return;
    
    // Get the top opportunities up to the available slots
    const toExecute = this.opportunities.splice(0, availableSlots);
    
    for (const opp of toExecute) {
      try {
        if (!this.sourceWallet) {
          logger.error('Cannot execute opportunity: No source wallet configured');
          continue;
        }
        
        logger.info(`Executing cross-chain opportunity ${opp.id} from ${opp.sourceChain} to ${opp.targetChain}`);
        
        // Start a new transaction
        const transaction: CrossChainTransaction = {
          opportunityId: opp.id,
          sourceChain: opp.sourceChain,
          targetChain: opp.targetChain,
          sourceToken: opp.sourceToken,
          targetToken: opp.targetToken,
          sourceAmount: opp.sourceAmount || this.settings.defaultAmount,
          startTime: Date.now(),
          status: 'initiated'
        };
        
        // Add to active transactions
        this.activeTransactions.set(opp.id, transaction);
        
        // Execute the cross-chain transaction
        await this.executeCrossChainTransaction(transaction);
      } catch (error) {
        logger.error(`Failed to execute opportunity ${opp.id}:`, error);
        
        // Update status to failed
        const transaction = this.activeTransactions.get(opp.id);
        if (transaction) {
          transaction.status = 'failed';
          transaction.errorMessage = error.message;
          
          // Move to history
          this.transactionHistory.push(transaction);
          this.activeTransactions.delete(opp.id);
        }
      }
    }
  }

  /**
   * Execute a cross-chain transaction
   */
  private async executeCrossChainTransaction(tx: CrossChainTransaction): Promise<void> {
    try {
      // Phase 1: Execute source chain transaction
      const sourceResult = await nexusEngine.executeSwap({
        fromToken: 'USDC', // Start with USDC
        toToken: tx.sourceToken,
        amount: tx.sourceAmount,
        slippage: 1, // 1% slippage
        walletAddress: this.sourceWallet as string,
        crossChain: true,
        targetChain: tx.targetChain
      });
      
      if (!sourceResult || !sourceResult.success) {
        throw new Error('Source chain transaction failed');
      }
      
      // Update transaction with source info
      tx.sourceTxHash = sourceResult.signature;
      tx.status = 'source_confirmed';
      
      // Phase 2: Bridge transaction (handled by Nexus engine in this case)
      // We'll simulate this by waiting for a bit
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      tx.status = 'bridging';
      tx.bridgeTxHash = `bridge-${Date.now()}`;
      
      // Wait for bridge confirmation (in reality, this would poll the bridge status)
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Phase 3: Execute target chain transaction
      const targetWallet = this.targetWallet || this.sourceWallet;
      
      const targetResult = await nexusEngine.executeSwap({
        fromToken: tx.targetToken,
        toToken: 'USDC', // End with USDC
        amount: sourceResult.outputAmount || 0,
        slippage: 1, // 1% slippage
        walletAddress: targetWallet as string
      });
      
      if (!targetResult || !targetResult.success) {
        throw new Error('Target chain transaction failed');
      }
      
      // Update transaction with target info
      tx.targetTxHash = targetResult.signature;
      tx.targetAmount = targetResult.outputAmount;
      tx.status = 'target_confirmed';
      
      // Calculate profit
      tx.profit = (targetResult.outputAmount || 0) - tx.sourceAmount;
      tx.completionTime = Date.now();
      tx.status = 'completed';
      
      logger.info(`Cross-chain transaction ${tx.opportunityId} completed successfully with profit: $${tx.profit.toFixed(2)}`);
      
      // Move to history
      this.transactionHistory.push({...tx});
      this.activeTransactions.delete(tx.opportunityId);
      
      // If we made profit and have a profit wallet, transfer some profits
      if (tx.profit > 0 && this.profitWallet) {
        const profitToTransfer = tx.profit * 0.5; // Transfer 50% of profits
        
        // TODO: Implement profit transfer
        logger.info(`Would transfer ${profitToTransfer} USDC profit to ${this.profitWallet}`);
      }
    } catch (error) {
      logger.error(`Error executing cross-chain transaction ${tx.opportunityId}:`, error);
      
      tx.status = 'failed';
      tx.errorMessage = error.message;
      tx.completionTime = Date.now();
      
      // Move to history
      this.transactionHistory.push({...tx});
      this.activeTransactions.delete(tx.opportunityId);
    }
  }

  /**
   * Monitor active transactions
   */
  private async monitorActiveTransactions(): Promise<void> {
    // Check for timed out transactions
    const now = Date.now();
    
    for (const [id, tx] of this.activeTransactions.entries()) {
      const elapsedMs = now - tx.startTime;
      
      // Time out transactions that have been running too long
      if (elapsedMs > this.settings.maxTimeoutSeconds * 1000) {
        logger.warn(`Cross-chain transaction ${id} timed out after ${elapsedMs}ms`);
        
        tx.status = 'failed';
        tx.errorMessage = 'Transaction timed out';
        tx.completionTime = now;
        
        // Move to history
        this.transactionHistory.push({...tx});
        this.activeTransactions.delete(id);
      }
      
      // Check specific statuses for additional actions
      if (tx.status === 'bridging' && elapsedMs > this.settings.bridgeTimeoutMs) {
        logger.warn(`Bridge operation for transaction ${id} is taking longer than expected`);
        
        // TODO: Implement recovery options for stuck bridge transactions
      }
    }
    
    // Keep transaction history limited to last 100 entries
    if (this.transactionHistory.length > 100) {
      this.transactionHistory.splice(0, this.transactionHistory.length - 100);
    }
  }

  /**
   * Get performance metrics for the agent
   */
  private getPerformanceMetrics(): any {
    const totalTxs = this.transactionHistory.length;
    
    if (totalTxs === 0) {
      return {
        totalTransactions: 0,
        successRate: 0,
        averageProfit: 0,
        averageExecutionTime: 0
      };
    }
    
    const completedTxs = this.transactionHistory.filter(tx => tx.status === 'completed');
    const successfulTxs = completedTxs.filter(tx => (tx.profit || 0) > 0);
    
    const totalProfit = successfulTxs.reduce((sum, tx) => sum + (tx.profit || 0), 0);
    const totalExecutionTime = completedTxs.reduce((sum, tx) => {
      return sum + ((tx.completionTime || 0) - tx.startTime);
    }, 0);
    
    return {
      totalTransactions: totalTxs,
      successRate: completedTxs.length > 0 ? successfulTxs.length / completedTxs.length : 0,
      averageProfit: successfulTxs.length > 0 ? totalProfit / successfulTxs.length : 0,
      averageExecutionTime: completedTxs.length > 0 ? totalExecutionTime / completedTxs.length / 1000 : 0 // in seconds
    };
  }
}

// Export a singleton instance
export const singularityAgent = new SingularityAgent();