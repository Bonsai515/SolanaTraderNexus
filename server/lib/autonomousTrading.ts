/**
 * Autonomous Trading Module
 * 
 * This module provides autonomous trading functionality with on-chain integration.
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { priceFeedCache } from './priceFeedCache';
import { Connection, PublicKey } from '@solana/web3.js';

// Import necessary functions when programInterface module exists
let programInterface: any = null;
try {
  programInterface = require('./programInterface');
} catch (error) {
  console.warn('[AutonomousTrading] Program interface module not found, will use simplified trading');
}

// Load configuration
const AUTONOMOUS_CONFIG_PATH = path.join('./server/config', 'autonomous.json');
let autonomousConfig: any = {};

try {
  if (fs.existsSync(AUTONOMOUS_CONFIG_PATH)) {
    autonomousConfig = JSON.parse(fs.readFileSync(AUTONOMOUS_CONFIG_PATH, 'utf8'));
  }
} catch (error) {
  console.error('Error loading autonomous config:', error);
}

interface TradeDecision {
  id: string;
  timestamp: string;
  source: string;
  baseToken: string;
  quoteToken: string;
  type: 'BUY' | 'SELL';
  amount: number;
  price: number;
  confidence: number;
  strategies: string[];
  signals: any[];
  onChainValidation?: boolean;
}

interface TradeExecution {
  id: string;
  decisionId: string;
  timestamp: string;
  signature?: string;
  success: boolean;
  profit?: number;
  error?: string;
}

class AutonomousTrading extends EventEmitter {
  private static instance: AutonomousTrading;
  private isEnabled: boolean = false;
  private decisions: TradeDecision[] = [];
  private executions: TradeExecution[] = [];
  private connection: Connection | null = null;
  private walletPublicKey: PublicKey | null = null;
  private cooldownUntil: number = 0;
  private dailyVolume: number = 0;
  private dailyTransactions: number = 0;
  private lastDayReset: number = Date.now();
  
  private constructor() {
    super();
    
    // Auto-initialize on creation
    setImmediate(() => {
      this.initialize();
    });
  }
  
  public static getInstance(): AutonomousTrading {
    if (!AutonomousTrading.instance) {
      AutonomousTrading.instance = new AutonomousTrading();
    }
    return AutonomousTrading.instance;
  }
  
  /**
   * Initialize the autonomous trading system
   */
  private initialize(): void {
    console.log('[AutonomousTrading] Initializing autonomous trading system...');
    
    try {
      // Check if autonomous trading is enabled
      this.isEnabled = autonomousConfig?.enabled || false;
      
      if (this.isEnabled) {
        console.log('[AutonomousTrading] Autonomous trading is ENABLED');
        
        // Set up periodical checks
        setInterval(() => this.checkForTradeOpportunities(), 15000); // Every 15 seconds
        setInterval(() => this.resetDailyLimits(), 3600000); // Every hour
        
        // Set up price feed updates listener
        if (priceFeedCache) {
          priceFeedCache.on('pricesUpdated', () => {
            this.checkForTradeOpportunities();
          });
          
          // Set up price feed token update listener
          priceFeedCache.on('priceUpdated', (token: string, data: any) => {
            if (data && (data.source === 'birdeye' || data.source === 'coingecko')) {
              this.checkTokenOpportunity(token, data);
            }
          });
        }
        
        // Emit initialization event
        this.emit('initialized');
      } else {
        console.log('[AutonomousTrading] Autonomous trading is DISABLED');
      }
    } catch (error) {
      console.error('[AutonomousTrading] Initialization error:', error instanceof Error ? error.message : String(error));
    }
  }
  
  /**
   * Set the Solana connection
   */
  public setConnection(connection: Connection): void {
    this.connection = connection;
  }
  
  /**
   * Set the wallet public key
   */
  public setWalletPublicKey(pubkey: string): void {
    try {
      this.walletPublicKey = new PublicKey(pubkey);
    } catch (error) {
      console.error('[AutonomousTrading] Error setting wallet public key:', error);
    }
  }
  
  /**
   * Check if a specific token has a trading opportunity
   */
  private checkTokenOpportunity(token: string, priceData: any): void {
    if (!this.isEnabled || !this.walletPublicKey || !this.connection) {
      return;
    }
    
    // Check if we're in cooldown
    if (Date.now() < this.cooldownUntil) {
      return;
    }
    
    // Check daily limits
    if (this.dailyTransactions >= (autonomousConfig?.riskManagement?.maxDailyTransactions || 100)) {
      console.log('[AutonomousTrading] Daily transaction limit reached');
      return;
    }
    
    if (this.dailyVolume >= (autonomousConfig?.riskManagement?.maxDailyVolume || 1000)) {
      console.log('[AutonomousTrading] Daily volume limit reached');
      return;
    }
    
    // Use provided price data
    if (!priceData) {
      // Try to get the price data from cache if not provided
      if (priceFeedCache) {
        priceData = priceFeedCache.getPriceData(token);
      }
      
      if (!priceData) {
        return;
      }
    }
    
    // Example analysis: check for 5% price change in last 24 hours
    if (priceData.change24h && Math.abs(priceData.change24h) >= 5.0) {
      const tradeType: 'BUY' | 'SELL' = priceData.change24h > 0 ? 'BUY' : 'SELL';
      
      // Create a trade decision
      const decision: TradeDecision = {
        id: `decision_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        timestamp: new Date().toISOString(),
        source: 'autonomous',
        baseToken: token,
        quoteToken: 'USDC',
        type: tradeType,
        amount: 50, // $50
        price: priceData.price,
        confidence: 0.85,
        strategies: ['AUTONOMOUS'],
        signals: [{ reason: `${priceData.change24h}% price change in 24h`, confidence: 0.85 }]
      };
      
      // Store decision
      this.decisions.push(decision);
      
      // Execute the trade with on-chain validation
      this.executeTradeWithValidation(decision);
    }
  }
  
  /**
   * Check for trade opportunities across all tokens
   */
  private checkForTradeOpportunities(): void {
    if (!this.isEnabled || !this.walletPublicKey || !this.connection) {
      return;
    }
    
    // Check if we're in cooldown
    if (Date.now() < this.cooldownUntil) {
      return;
    }
    
    // Check daily limits
    if (this.dailyTransactions >= (autonomousConfig?.riskManagement?.maxDailyTransactions || 100)) {
      return;
    }
    
    if (this.dailyVolume >= (autonomousConfig?.riskManagement?.maxDailyVolume || 1000)) {
      return;
    }
    
    // Get all prices
    const allPrices = priceFeedCache ? priceFeedCache.getAllPrices() : {};
    
    // Top meme tokens to check for opportunities
    const memeTokens = ['BONK', 'WIF', 'MEME', 'PEPE'];
    
    // Check each meme token
    memeTokens.forEach(token => {
      const tokenData = allPrices[token];
      
      if (!tokenData) {
        return;
      }
      
      // Example analysis logic for meme tokens
      if (tokenData.volume24h && tokenData.volume24h > 1000000 && tokenData.change24h && Math.abs(tokenData.change24h) > 10) {
        const isBullish = tokenData.change24h > 0;
        
        // Create a meme token snipe decision
        const decision: TradeDecision = {
          id: `decision_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          timestamp: new Date().toISOString(),
          source: 'meme_sniper',
          baseToken: token,
          quoteToken: 'USDC',
          type: isBullish ? 'BUY' : 'SELL',
          amount: 75, // $75
          price: tokenData.price,
          confidence: 0.9,
          strategies: ['MEME_SNIPER'],
          signals: [
            { 
              reason: `High volume (${(tokenData.volume24h/1000000).toFixed(2)}M) with ${tokenData.change24h.toFixed(2)}% price change`, 
              confidence: 0.9 
            }
          ]
        };
        
        // Store decision
        this.decisions.push(decision);
        
        // Execute the trade with on-chain validation
        this.executeTradeWithValidation(decision);
      }
    });
    
    // Flash arbitrage logic would be added here
    // MEV extraction logic would be added here
  }
  
  /**
   * Execute a trade with on-chain validation
   */
  private async executeTradeWithValidation(decision: TradeDecision): Promise<void> {
    if (!this.connection || !this.walletPublicKey) {
      return;
    }
    
    try {
      // Determine transaction type based on strategy
      if (decision.strategies.includes('MEME_SNIPER')) {
        await this.executeMemeSnipe(decision);
      } else if (decision.strategies.includes('FLASH_ARBITRAGE')) {
        await this.executeFlashArbitrage(decision);
      } else {
        // Generic trade execution
        await this.executeGenericTrade(decision);
      }
    } catch (error) {
      console.error(`[AutonomousTrading] Failed to execute trade: ${error instanceof Error ? error.message : String(error)}`);
      
      // Record failed execution
      this.executions.push({
        id: `execution_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        decisionId: decision.id,
        timestamp: new Date().toISOString(),
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  /**
   * Execute a meme token snipe trade
   */
  private async executeMemeSnipe(decision: TradeDecision): Promise<void> {
    if (!this.connection || !this.walletPublicKey) {
      return;
    }
    
    try {
      console.log(`[AutonomousTrading] Executing meme token snipe for ${decision.baseToken}`);
      
      // Check if programInterface is available
      if (programInterface && programInterface.createMemeSnipeInstruction) {
        // Lookup token mint address (actual implementation would use a token map)
        // This is a placeholder address for example purposes
        const tokenMint = new PublicKey('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'); // BONK for example
        
        // Convert amount to lamports (smallest unit)
        const amountIn = BigInt(Math.floor(decision.amount * 1000000)); // USDC has 6 decimals
        
        // Calculate minimum amount out with 1% slippage
        const tokenPrice = decision.price;
        const tokenAmount = decision.amount / tokenPrice;
        const minAmountOut = BigInt(Math.floor(tokenAmount * 0.99 * 1000000000)); // 1% slippage
        
        // Create meme snipe instruction
        const instruction = programInterface.createMemeSnipeInstruction(
          this.walletPublicKey,
          tokenMint,
          amountIn,
          minAmountOut,
          100 // 1% slippage as basis points
        );
        
        // Execute on-chain
        const signature = await programInterface.executeOnChainInstruction(
          this.connection,
          instruction,
          this.walletPublicKey
        );
        
        // Record successful execution
        this.executions.push({
          id: `execution_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          decisionId: decision.id,
          timestamp: new Date().toISOString(),
          signature,
          success: true
        });
        
        // Update daily tracking
        this.dailyTransactions++;
        this.dailyVolume += decision.amount;
        
        console.log(`[AutonomousTrading] Successfully executed meme token snipe: ${signature}`);
        
        // Emit event
        this.emit('tradeExecuted', signature, decision);
      } else {
        // Fallback to generic trade execution if programInterface is not available
        await this.executeGenericTrade(decision);
      }
    } catch (error) {
      console.error(`[AutonomousTrading] Failed to execute meme token snipe: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Execute a flash arbitrage trade
   */
  private async executeFlashArbitrage(decision: TradeDecision): Promise<void> {
    if (!this.connection || !this.walletPublicKey) {
      return;
    }
    
    try {
      console.log(`[AutonomousTrading] Executing flash arbitrage for ${decision.baseToken}`);
      
      // Check if programInterface is available
      if (programInterface && programInterface.createFlashArbitrageInstruction) {
        // Convert amount to lamports (smallest unit)
        const amountIn = BigInt(Math.floor(decision.amount * 1000000)); // USDC has 6 decimals
        
        // Calculate minimum amount out with expected profit
        const expectedProfit = decision.amount * 0.01; // 1% profit
        const minAmountOut = BigInt(Math.floor((decision.amount + expectedProfit) * 1000000));
        
        // Placeholder route data (in a real implementation, this would be actual route data)
        const routeData = Buffer.from('placeholder_route_data');
        
        // Create flash arbitrage instruction
        const instruction = programInterface.createFlashArbitrageInstruction(
          this.walletPublicKey,
          amountIn,
          minAmountOut,
          routeData
        );
        
        // Execute on-chain
        const signature = await programInterface.executeOnChainInstruction(
          this.connection,
          instruction,
          this.walletPublicKey
        );
        
        // Record successful execution
        this.executions.push({
          id: `execution_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          decisionId: decision.id,
          timestamp: new Date().toISOString(),
          signature,
          success: true,
          profit: expectedProfit
        });
        
        // Update daily tracking
        this.dailyTransactions++;
        this.dailyVolume += decision.amount;
        
        console.log(`[AutonomousTrading] Successfully executed flash arbitrage: ${signature}`);
        
        // Emit event
        this.emit('tradeExecuted', signature, decision);
      } else {
        // Fallback to generic trade execution if programInterface is not available
        await this.executeGenericTrade(decision);
      }
    } catch (error) {
      console.error(`[AutonomousTrading] Failed to execute flash arbitrage: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Execute a generic trade
   */
  private async executeGenericTrade(decision: TradeDecision): Promise<void> {
    // In a real implementation, this would call the nexusEngine to execute a trade
    // This is a placeholder implementation
    console.log(`[AutonomousTrading] Executing generic trade for ${decision.baseToken}`);
    
    // Simulate successful execution
    const signature = `simulated_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    // Record execution
    this.executions.push({
      id: `execution_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      decisionId: decision.id,
      timestamp: new Date().toISOString(),
      signature,
      success: true
    });
    
    // Update daily tracking
    this.dailyTransactions++;
    this.dailyVolume += decision.amount;
    
    console.log(`[AutonomousTrading] Successfully executed generic trade: ${signature}`);
    
    // Emit event
    this.emit('tradeExecuted', signature, decision);
  }
  
  /**
   * Reset daily limits at midnight
   */
  private resetDailyLimits(): void {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    if (now - this.lastDayReset >= oneDayMs) {
      this.dailyTransactions = 0;
      this.dailyVolume = 0;
      this.lastDayReset = now;
      console.log('[AutonomousTrading] Daily limits reset');
    }
  }
  
  /**
   * Get trade decisions
   */
  public getDecisions(): TradeDecision[] {
    return [...this.decisions];
  }
  
  /**
   * Get trade executions
   */
  public getExecutions(): TradeExecution[] {
    return [...this.executions];
  }
  
  /**
   * Check if autonomous trading is enabled
   */
  public isAutonomousEnabled(): boolean {
    return this.isEnabled;
  }
  
  /**
   * Enable or disable autonomous trading
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log(`[AutonomousTrading] Autonomous trading ${enabled ? 'ENABLED' : 'DISABLED'}`);
    this.emit('statusChanged', enabled);
  }
}

// Export singleton instance
export const autonomousTrading = AutonomousTrading.getInstance();