/**
 * Quantum Omega Sniper Agent
 * 
 * Specializes in ultra-fast sniping of new token launches across DEXes
 * with neural network pattern recognition for optimal entry and exit.
 */

import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { logger } from '../logger';
import * as nexusEngine from '../nexus-transaction-engine';
import { priceFeedCache } from '../priceFeedCache';
import { neuralPriceFeed } from '../lib/neuralPriceFeed';
import { getFlashLoanEngine, FlashLoanProvider, FlashLoanStrategy } from '../dex/flashLoans';

// Launch detection settings
interface LaunchDetectionSettings {
  minLiquidityUsd: number;
  maxAgeMinutes: number;
  minPriceMovementPercent: number;
  maxSlippagePercent: number;
  confidenceThreshold: number;
  scanIntervalMs: number;
  enableFlashLoans: boolean;
  autoTakeProfit: boolean;
  autoStopLoss: boolean;
  takeProfitMultiplier: number;
  stopLossPercent: number;
}

// Launch opportunity
interface LaunchOpportunity {
  id: string;
  tokenAddress: string;
  tokenSymbol?: string;
  tokenName?: string;
  launchDex: string;
  launchLiquidityUsd: number;
  initialPriceUsd: number;
  currentPriceUsd: number;
  priceChangePercent: number;
  discoveredAt: number;
  confidence: number;
  score: number;
  status: 'detected' | 'analyzing' | 'approved' | 'sniping' | 'monitoring' | 'exited' | 'rejected';
  analysisResults?: {
    securityScore?: number;
    liquidityScore?: number;
    communityScore?: number;
    technicalScore?: number;
    redFlags?: string[];
  };
}

// Position
interface Position {
  opportunityId: string;
  tokenAddress: string;
  tokenSymbol?: string;
  entryPriceUsd: number;
  currentPriceUsd: number;
  amount: number;
  valueUsd: number;
  profitLossUsd: number;
  profitLossPercent: number;
  openedAt: number;
  status: 'open' | 'closed';
  exitPriceUsd?: number;
  exitedAt?: number;
  takeProfitUsd?: number;
  stopLossUsd?: number;
  txHash?: string;
}

class OmegaSniperAgent {
  private connection: Connection;
  private isActive: boolean = false;
  private systemWallet: string | null = null;
  private profitWallet: string | null = null;
  private scanInterval: NodeJS.Timeout | null = null;
  
  private settings: LaunchDetectionSettings = {
    minLiquidityUsd: 10000, // Minimum $10K liquidity
    maxAgeMinutes: 60, // 1 hour
    minPriceMovementPercent: 5, // 5% price movement
    maxSlippagePercent: 3, // 3% max slippage
    confidenceThreshold: 0.7, // 70% confidence
    scanIntervalMs: 5000, // 5 seconds
    enableFlashLoans: true, // Use flash loans
    autoTakeProfit: true, // Auto take profit
    autoStopLoss: true, // Auto stop loss
    takeProfitMultiplier: 2.0, // 2x entry price
    stopLossPercent: 15 // 15% stop loss
  };
  
  private opportunities: Map<string, LaunchOpportunity> = new Map();
  private positions: Map<string, Position> = new Map();
  private recentlyRejected: Set<string> = new Set();
  
  constructor(connection: Connection) {
    this.connection = connection;
    logger.info('Initializing Quantum Omega Sniper Agent');
  }
  
  /**
   * Activate the Omega Sniper agent
   */
  public async activate(
    systemWallet: string,
    profitWallet?: string
  ): Promise<boolean> {
    try {
      if (this.isActive) {
        logger.info('Omega Sniper agent is already active');
        return true;
      }
      
      this.systemWallet = systemWallet;
      this.profitWallet = profitWallet || systemWallet;
      
      // Register wallets with the Nexus engine
      nexusEngine.registerWallet(systemWallet);
      if (profitWallet && profitWallet !== systemWallet) {
        nexusEngine.registerWallet(profitWallet);
      }
      
      // Initialize neural price feed for fast price updates
      await neuralPriceFeed.initialize({
        neuraxisEntangled: true,
        latencyMs: 25,
        qualityThreshold: 0.85
      });
      
      // Start listening for new launches
      this.startLaunchDetection();
      
      this.isActive = true;
      logger.info('Quantum Omega Sniper agent activated successfully');
      return true;
    } catch (error) {
      logger.error('Failed to activate Quantum Omega Sniper agent:', error);
      return false;
    }
  }
  
  /**
   * Deactivate the Omega Sniper agent
   */
  public async deactivate(): Promise<boolean> {
    try {
      if (!this.isActive) {
        logger.info('Quantum Omega Sniper agent is already inactive');
        return true;
      }
      
      if (this.scanInterval) {
        clearInterval(this.scanInterval);
        this.scanInterval = null;
      }
      
      this.isActive = false;
      logger.info('Quantum Omega Sniper agent deactivated successfully');
      return true;
    } catch (error) {
      logger.error('Failed to deactivate Quantum Omega Sniper agent:', error);
      return false;
    }
  }
  
  /**
   * Update agent settings
   */
  public updateSettings(newSettings: Partial<LaunchDetectionSettings>): boolean {
    try {
      this.settings = { ...this.settings, ...newSettings };
      logger.info('Quantum Omega Sniper settings updated:', this.settings);
      
      // Restart scan interval if it was changed and we're active
      if (
        newSettings.scanIntervalMs &&
        newSettings.scanIntervalMs !== this.settings.scanIntervalMs &&
        this.isActive
      ) {
        this.startLaunchDetection();
      }
      
      return true;
    } catch (error) {
      logger.error('Failed to update Quantum Omega Sniper settings:', error);
      return false;
    }
  }
  
  /**
   * Get agent status
   */
  public getStatus(): any {
    return {
      isActive: this.isActive,
      systemWallet: this.systemWallet,
      profitWallet: this.profitWallet,
      settings: this.settings,
      activeOpportunities: Array.from(this.opportunities.values()).filter(o => 
        o.status === 'analyzing' || o.status === 'approved' || o.status === 'sniping' || o.status === 'monitoring'
      ),
      openPositions: Array.from(this.positions.values()).filter(p => p.status === 'open'),
      recentPositions: Array.from(this.positions.values())
        .filter(p => p.status === 'closed')
        .sort((a, b) => (b.exitedAt || 0) - (a.exitedAt || 0))
        .slice(0, 5),
      stats: this.getPerformanceStats()
    };
  }
  
  /**
   * Get performance stats
   */
  private getPerformanceStats(): any {
    const positions = Array.from(this.positions.values());
    const closedPositions = positions.filter(p => p.status === 'closed');
    
    const totalPositions = positions.length;
    const totalClosed = closedPositions.length;
    const totalProfit = closedPositions.reduce((sum, p) => sum + (p.profitLossUsd || 0), 0);
    const winningTrades = closedPositions.filter(p => p.profitLossUsd > 0).length;
    const winRate = totalClosed > 0 ? (winningTrades / totalClosed) * 100 : 0;
    
    // Calculate average metrics
    const avgProfitPerTrade = totalClosed > 0 ? totalProfit / totalClosed : 0;
    const avgHoldingTimeMinutes = totalClosed > 0 
      ? closedPositions.reduce((sum, p) => sum + ((p.exitedAt || 0) - p.openedAt) / 60000, 0) / totalClosed
      : 0;
    
    return {
      totalPositions,
      totalClosed,
      openPositions: totalPositions - totalClosed,
      totalProfitUsd: totalProfit,
      winRate,
      avgProfitPerTrade,
      avgHoldingTimeMinutes,
      bestTrade: closedPositions.length > 0 
        ? closedPositions.reduce((best, p) => p.profitLossUsd > best.profitLossUsd ? p : best, closedPositions[0])
        : null,
      worstTrade: closedPositions.length > 0
        ? closedPositions.reduce((worst, p) => p.profitLossUsd < worst.profitLossUsd ? p : worst, closedPositions[0])
        : null
    };
  }
  
  /**
   * Start scanning for new token launches
   */
  private startLaunchDetection(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
    }
    
    // Scan at the configured interval
    this.scanInterval = setInterval(async () => {
      if (!this.isActive) return;
      
      try {
        // Detect new launches
        await this.detectNewLaunches();
        
        // Analyze detected opportunities
        await this.analyzeOpportunities();
        
        // Execute approved opportunities
        await this.executeApprovedLaunches();
        
        // Monitor open positions
        await this.monitorPositions();
      } catch (error) {
        logger.error('Error in Quantum Omega Sniper scan:', error);
      }
    }, this.settings.scanIntervalMs);
    
    logger.info(`Launch detection started with scan interval of ${this.settings.scanIntervalMs}ms`);
  }
  
  /**
   * Detect new token launches across DEXes
   */
  private async detectNewLaunches(): Promise<void> {
    try {
      // In a real implementation, this would:
      // 1. Monitor mempool for new token pair creations
      // 2. Monitor DEX factory contracts for new pair events
      // 3. Check liquidity additions to existing pairs
      // 4. Monitor social media for announcements
      
      // For demonstration, we'll simulate by looking at recent price movements
      // in the price feed cache (which would be populated from external sources)
      
      const allPrices = priceFeedCache.getAllPrices();
      const currentTime = Date.now();
      
      for (const [symbol, data] of Object.entries(allPrices)) {
        // Skip if we already have this as an opportunity or recently rejected it
        const tokenAddress = data.address || symbol;
        if (
          this.opportunities.has(tokenAddress) ||
          this.recentlyRejected.has(tokenAddress)
        ) {
          continue;
        }
        
        // Check if it meets our criteria for a new launch
        const isRecentLaunch = data.timestamp && 
          (currentTime - data.timestamp) < this.settings.maxAgeMinutes * 60000;
        
        const hasSignificantMovement = data.change && 
          Math.abs(data.change) >= this.settings.minPriceMovementPercent;
        
        const hasMinimumLiquidity = data.liquidityUsd && 
          data.liquidityUsd >= this.settings.minLiquidityUsd;
        
        if (isRecentLaunch && hasSignificantMovement && hasMinimumLiquidity) {
          const opportunityId = `launch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          const opportunity: LaunchOpportunity = {
            id: opportunityId,
            tokenAddress,
            tokenSymbol: symbol,
            tokenName: data.name,
            launchDex: data.source || 'unknown',
            launchLiquidityUsd: data.liquidityUsd || 0,
            initialPriceUsd: data.price,
            currentPriceUsd: data.price,
            priceChangePercent: data.change || 0,
            discoveredAt: currentTime,
            confidence: 0.5, // Initial confidence, will be refined by analysis
            score: 0, // Will be calculated during analysis
            status: 'detected'
          };
          
          this.opportunities.set(tokenAddress, opportunity);
          
          logger.info(`New launch detected: ${symbol} on ${opportunity.launchDex} with ${opportunity.launchLiquidityUsd.toFixed(2)} USD liquidity`);
        }
      }
    } catch (error) {
      logger.error('Error detecting new launches:', error);
    }
  }
  
  /**
   * Analyze detected opportunities
   */
  private async analyzeOpportunities(): Promise<void> {
    for (const opportunity of this.opportunities.values()) {
      if (opportunity.status !== 'detected') continue;
      
      try {
        // Mark as analyzing
        opportunity.status = 'analyzing';
        
        logger.info(`Analyzing launch opportunity for ${opportunity.tokenSymbol || opportunity.tokenAddress}`);
        
        // In a real implementation, this would:
        // 1. Check token contract security (minting, ownership, etc.)
        // 2. Analyze tokenomics
        // 3. Check liquidity lock status
        // 4. Assess team/project credibility
        // 5. Sentiment analysis from social media
        
        // For demonstration, we'll simulate an analysis
        const securityScore = Math.random() * 40 + 60; // 60-100
        const liquidityScore = Math.random() * 30 + 70; // 70-100
        const communityScore = Math.random() * 50 + 50; // 50-100
        const technicalScore = Math.random() * 40 + 60; // 60-100
        
        // Generate some random red flags
        const redFlags: string[] = [];
        if (securityScore < 75) redFlags.push('Ownership not renounced');
        if (liquidityScore < 85) redFlags.push('Short liquidity lock period');
        if (Math.random() > 0.7) redFlags.push('High team token allocation');
        
        opportunity.analysisResults = {
          securityScore,
          liquidityScore,
          communityScore,
          technicalScore,
          redFlags
        };
        
        // Calculate overall score
        opportunity.score = (
          securityScore * 0.4 +
          liquidityScore * 0.3 +
          communityScore * 0.15 +
          technicalScore * 0.15
        );
        
        // Calculate confidence based on scores and red flags
        opportunity.confidence = Math.min(
          1.0,
          opportunity.score / 100 * (1 - redFlags.length * 0.1)
        );
        
        // Update price information
        const priceData = priceFeedCache.getPrice(opportunity.tokenSymbol || opportunity.tokenAddress);
        if (priceData) {
          opportunity.currentPriceUsd = priceData.price;
          opportunity.priceChangePercent = ((opportunity.currentPriceUsd / opportunity.initialPriceUsd) - 1) * 100;
        }
        
        // Decide whether to approve or reject
        if (
          opportunity.confidence >= this.settings.confidenceThreshold &&
          opportunity.score >= 70 &&
          redFlags.length <= 2
        ) {
          opportunity.status = 'approved';
          logger.info(`Approved launch for ${opportunity.tokenSymbol || opportunity.tokenAddress} with score ${opportunity.score.toFixed(2)} and confidence ${opportunity.confidence.toFixed(2)}`);
        } else {
          opportunity.status = 'rejected';
          this.recentlyRejected.add(opportunity.tokenAddress);
          logger.info(`Rejected launch for ${opportunity.tokenSymbol || opportunity.tokenAddress} with score ${opportunity.score.toFixed(2)} and confidence ${opportunity.confidence.toFixed(2)}`);
        }
        
      } catch (error) {
        logger.error(`Error analyzing opportunity ${opportunity.id}:`, error);
        opportunity.status = 'rejected';
        this.recentlyRejected.add(opportunity.tokenAddress);
      }
    }
    
    // Clean up rejected opportunities
    for (const [tokenAddress, opportunity] of this.opportunities.entries()) {
      if (opportunity.status === 'rejected') {
        this.opportunities.delete(tokenAddress);
      }
    }
    
    // Limit size of recentlyRejected set
    if (this.recentlyRejected.size > 1000) {
      // Convert to array, slice, and convert back to set
      const rejectedArray = Array.from(this.recentlyRejected);
      this.recentlyRejected = new Set(rejectedArray.slice(-500));
    }
  }
  
  /**
   * Execute approved launch opportunities
   */
  private async executeApprovedLaunches(): Promise<void> {
    if (!this.systemWallet) {
      logger.error('Cannot execute launches: No system wallet configured');
      return;
    }
    
    for (const opportunity of this.opportunities.values()) {
      if (opportunity.status !== 'approved') continue;
      
      try {
        logger.info(`Executing snipe for ${opportunity.tokenSymbol || opportunity.tokenAddress}`);
        
        // Mark as sniping
        opportunity.status = 'sniping';
        
        // Determine amount to invest based on confidence and score
        const baseInvestAmount = 50; // $50 base investment
        const confidenceMultiplier = opportunity.confidence * 2;
        const scoreMultiplier = opportunity.score / 100 * 2;
        
        const investAmountUsd = baseInvestAmount * confidenceMultiplier * scoreMultiplier;
        
        // In a real implementation, we'd:
        // 1. Determine optimal entry point
        // 2. Calculate optimal amount
        // 3. Execute the swap
        
        // Use flash loan if enabled and appropriate
        if (this.settings.enableFlashLoans && investAmountUsd > 200) {
          await this.executeWithFlashLoan(opportunity, investAmountUsd);
        } else {
          await this.executeDirectSwap(opportunity, investAmountUsd);
        }
        
        // Mark as monitoring
        opportunity.status = 'monitoring';
        
      } catch (error) {
        logger.error(`Error executing launch ${opportunity.id}:`, error);
        opportunity.status = 'rejected';
        this.recentlyRejected.add(opportunity.tokenAddress);
      }
    }
  }
  
  /**
   * Execute a launch opportunity with a flash loan
   */
  private async executeWithFlashLoan(
    opportunity: LaunchOpportunity,
    amountUsd: number
  ): Promise<boolean> {
    try {
      logger.info(`Executing with flash loan for ${opportunity.tokenSymbol || opportunity.tokenAddress}, amount: $${amountUsd.toFixed(2)}`);
      
      const flashLoanEngine = getFlashLoanEngine();
      const result = await flashLoanEngine.executeFlashLoan({
        provider: FlashLoanProvider.Raydium,
        token: 'USDC',
        amount: amountUsd,
        strategy: FlashLoanStrategy.JustInTimeLibiquidity,
        walletAddress: this.systemWallet!
      });
      
      if (result.success) {
        // Create a position
        const position: Position = {
          opportunityId: opportunity.id,
          tokenAddress: opportunity.tokenAddress,
          tokenSymbol: opportunity.tokenSymbol,
          entryPriceUsd: opportunity.currentPriceUsd,
          currentPriceUsd: opportunity.currentPriceUsd,
          amount: amountUsd / opportunity.currentPriceUsd,
          valueUsd: amountUsd,
          profitLossUsd: 0,
          profitLossPercent: 0,
          openedAt: Date.now(),
          status: 'open',
          txHash: result.txHash
        };
        
        // Set take profit and stop loss if enabled
        if (this.settings.autoTakeProfit) {
          position.takeProfitUsd = opportunity.currentPriceUsd * this.settings.takeProfitMultiplier;
        }
        
        if (this.settings.autoStopLoss) {
          position.stopLossUsd = opportunity.currentPriceUsd * (1 - this.settings.stopLossPercent / 100);
        }
        
        // Store the position
        this.positions.set(opportunity.id, position);
        
        logger.info(`Successfully opened position for ${opportunity.tokenSymbol || opportunity.tokenAddress} with flash loan`);
        return true;
      } else {
        logger.error(`Flash loan execution failed: ${result.errorMessage}`);
        return false;
      }
    } catch (error) {
      logger.error(`Error executing with flash loan:`, error);
      return false;
    }
  }
  
  /**
   * Execute a direct swap for a launch opportunity
   */
  private async executeDirectSwap(
    opportunity: LaunchOpportunity,
    amountUsd: number
  ): Promise<boolean> {
    try {
      logger.info(`Executing direct swap for ${opportunity.tokenSymbol || opportunity.tokenAddress}, amount: $${amountUsd.toFixed(2)}`);
      
      // Execute swap through Nexus engine
      const swapResult = await nexusEngine.executeSwap({
        fromToken: 'USDC',
        toToken: opportunity.tokenAddress,
        amount: amountUsd,
        slippage: this.settings.maxSlippagePercent,
        walletAddress: this.systemWallet!
      });
      
      if (swapResult.success) {
        // Create a position
        const position: Position = {
          opportunityId: opportunity.id,
          tokenAddress: opportunity.tokenAddress,
          tokenSymbol: opportunity.tokenSymbol,
          entryPriceUsd: opportunity.currentPriceUsd,
          currentPriceUsd: opportunity.currentPriceUsd,
          amount: swapResult.outputAmount || amountUsd / opportunity.currentPriceUsd,
          valueUsd: amountUsd,
          profitLossUsd: 0,
          profitLossPercent: 0,
          openedAt: Date.now(),
          status: 'open',
          txHash: swapResult.signature
        };
        
        // Set take profit and stop loss if enabled
        if (this.settings.autoTakeProfit) {
          position.takeProfitUsd = opportunity.currentPriceUsd * this.settings.takeProfitMultiplier;
        }
        
        if (this.settings.autoStopLoss) {
          position.stopLossUsd = opportunity.currentPriceUsd * (1 - this.settings.stopLossPercent / 100);
        }
        
        // Store the position
        this.positions.set(opportunity.id, position);
        
        logger.info(`Successfully opened position for ${opportunity.tokenSymbol || opportunity.tokenAddress}`);
        return true;
      } else {
        logger.error(`Swap execution failed: ${swapResult.error}`);
        return false;
      }
    } catch (error) {
      logger.error(`Error executing direct swap:`, error);
      return false;
    }
  }
  
  /**
   * Monitor open positions
   */
  private async monitorPositions(): Promise<void> {
    for (const [id, position] of this.positions.entries()) {
      if (position.status !== 'open') continue;
      
      try {
        // Get latest price
        const priceData = priceFeedCache.getPrice(position.tokenSymbol || position.tokenAddress);
        
        if (!priceData) continue;
        
        // Update position with latest price
        position.currentPriceUsd = priceData.price;
        position.valueUsd = position.amount * position.currentPriceUsd;
        position.profitLossUsd = position.valueUsd - (position.amount * position.entryPriceUsd);
        position.profitLossPercent = ((position.currentPriceUsd / position.entryPriceUsd) - 1) * 100;
        
        // Check take profit and stop loss
        if (position.takeProfitUsd && position.currentPriceUsd >= position.takeProfitUsd) {
          await this.exitPosition(id, 'take_profit');
        } else if (position.stopLossUsd && position.currentPriceUsd <= position.stopLossUsd) {
          await this.exitPosition(id, 'stop_loss');
        }
        
        // Update opportunity status
        const opportunity = this.opportunities.get(position.tokenAddress);
        if (opportunity) {
          opportunity.currentPriceUsd = position.currentPriceUsd;
          opportunity.priceChangePercent = ((opportunity.currentPriceUsd / opportunity.initialPriceUsd) - 1) * 100;
        }
        
      } catch (error) {
        logger.error(`Error monitoring position ${id}:`, error);
      }
    }
  }
  
  /**
   * Exit a position
   */
  private async exitPosition(
    positionId: string,
    reason: 'take_profit' | 'stop_loss' | 'manual'
  ): Promise<boolean> {
    try {
      const position = this.positions.get(positionId);
      
      if (!position) {
        logger.error(`Cannot exit position ${positionId}: Position not found`);
        return false;
      }
      
      if (position.status !== 'open') {
        logger.info(`Position ${positionId} is already closed`);
        return true;
      }
      
      logger.info(`Exiting position ${positionId} for ${position.tokenSymbol || position.tokenAddress} due to ${reason}`);
      
      // Execute swap back to USDC
      const swapResult = await nexusEngine.executeSwap({
        fromToken: position.tokenAddress,
        toToken: 'USDC',
        amount: position.amount,
        slippage: this.settings.maxSlippagePercent,
        walletAddress: this.systemWallet!
      });
      
      // Update position with exit info
      position.status = 'closed';
      position.exitPriceUsd = position.currentPriceUsd;
      position.exitedAt = Date.now();
      
      if (swapResult.success) {
        logger.info(`Successfully exited position for ${position.tokenSymbol || position.tokenAddress} with ${position.profitLossPercent.toFixed(2)}% profit/loss`);
        
        // If profit is positive and we have a profit wallet, transfer part of profit
        if (position.profitLossUsd > 0 && this.profitWallet && this.profitWallet !== this.systemWallet) {
          // Transfer 50% of profits to profit wallet
          const profitToTransfer = position.profitLossUsd * 0.5;
          
          logger.info(`Transferring ${profitToTransfer.toFixed(2)} USDC profit to ${this.profitWallet}`);
          
          // In a real implementation, this would execute a transfer
        }
        
        return true;
      } else {
        logger.error(`Swap execution failed on exit: ${swapResult.error}`);
        return false;
      }
    } catch (error) {
      logger.error(`Error exiting position ${positionId}:`, error);
      return false;
    }
  }
  
  /**
   * Manually snipe a token
   */
  public async manualSnipe(
    tokenAddress: string,
    amountUsd: number,
    useFlashLoan: boolean = false
  ): Promise<boolean> {
    try {
      if (!this.isActive) {
        logger.error('Cannot execute manual snipe: Agent is not active');
        return false;
      }
      
      if (!this.systemWallet) {
        logger.error('Cannot execute manual snipe: No system wallet configured');
        return false;
      }
      
      logger.info(`Executing manual snipe for ${tokenAddress}, amount: $${amountUsd.toFixed(2)}`);
      
      // Create a new opportunity
      const opportunityId = `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Get token price
      const priceData = priceFeedCache.getPrice(tokenAddress);
      
      if (!priceData) {
        logger.error(`Cannot execute manual snipe: No price data for ${tokenAddress}`);
        return false;
      }
      
      const opportunity: LaunchOpportunity = {
        id: opportunityId,
        tokenAddress,
        tokenSymbol: priceData.symbol,
        launchDex: priceData.source || 'unknown',
        launchLiquidityUsd: priceData.liquidityUsd || 0,
        initialPriceUsd: priceData.price,
        currentPriceUsd: priceData.price,
        priceChangePercent: 0,
        discoveredAt: Date.now(),
        confidence: 0.8, // Higher confidence for manual snipes
        score: 80, // Higher score for manual snipes
        status: 'approved'
      };
      
      this.opportunities.set(tokenAddress, opportunity);
      
      // Execute snipe
      let success = false;
      if (useFlashLoan) {
        success = await this.executeWithFlashLoan(opportunity, amountUsd);
      } else {
        success = await this.executeDirectSwap(opportunity, amountUsd);
      }
      
      if (success) {
        opportunity.status = 'monitoring';
        return true;
      } else {
        opportunity.status = 'rejected';
        this.opportunities.delete(tokenAddress);
        return false;
      }
    } catch (error) {
      logger.error(`Error executing manual snipe:`, error);
      return false;
    }
  }
  
  /**
   * Manually exit a position
   */
  public async manualExit(positionId: string): Promise<boolean> {
    return this.exitPosition(positionId, 'manual');
  }
}

// Export a singleton instance
let omegaSniperAgent: OmegaSniperAgent | null = null;

export function getOmegaSniperAgent(connection?: Connection): OmegaSniperAgent {
  if (!omegaSniperAgent && connection) {
    omegaSniperAgent = new OmegaSniperAgent(connection);
  } else if (!omegaSniperAgent) {
    throw new Error('Omega Sniper agent not initialized');
  }
  
  return omegaSniperAgent;
}

export async function startOmegaSniper(config: {
  id: string;
  name: string;
  active: boolean;
  wallets: {
    system: string;
    profit?: string;
  }
}): Promise<boolean> {
  try {
    logger.info(`Starting Omega Sniper agent ${config.id}: ${config.name}`);
    const systemWallet = config.wallets.system;
    const profitWallet = config.wallets.profit;
    
    // Get agent instance
    const agent = getOmegaSniperAgent();
    
    // Activate agent
    return agent.activate(systemWallet, profitWallet);
  } catch (error) {
    logger.error(`Failed to start Omega Sniper agent ${config.id}:`, error);
    return false;
  }
}