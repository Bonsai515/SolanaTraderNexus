/**
 * Profit Collection Module
 * 
 * This module handles the collection and routing of profits.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { calculatePerformanceMetrics, addProfitCapture } from './analytics';

// Constants
const DATA_DIR = '../data';
const CONFIG_DIR = '../config';
const PROFIT_CONFIG_PATH = path.join(CONFIG_DIR, 'profit.json');

// Types
interface WalletInfo {
  address: string;
  label: string;
  profitShare: number;
}

/**
 * Load profit configuration
 */
function loadProfitConfig(): any {
  try {
    if (fs.existsSync(PROFIT_CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(PROFIT_CONFIG_PATH, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading profit config:', error);
  }
  
  return {
    enabled: true,
    captureIntervalMinutes: 4,
    reinvestment: { rate: 95 }
  };
}

/**
 * Profit Collection class
 */
export class ProfitCollection {
  private connection: Connection;
  private config: any;
  private walletAddress: string | null = null;
  private lastCapture: number = 0;
  private captureIntervalMs: number = 4 * 60 * 1000; // Default 4 minutes
  private captureDurations: number[] = [];
  
  constructor(connection: Connection) {
    this.connection = connection;
    this.config = loadProfitConfig();
    this.captureIntervalMs = (this.config.captureIntervalMinutes || 4) * 60 * 1000;
  }
  
  /**
   * Initialize with wallet
   */
  public initialize(walletAddress: string): void {
    this.walletAddress = walletAddress;
    console.log(`[ProfitCollection] Initialized with wallet: ${walletAddress}`);
    
    // Schedule profit capture
    this.scheduleNextCapture();
  }
  
  /**
   * Schedule next profit capture
   */
  private scheduleNextCapture(): void {
    if (!this.config.enabled) {
      console.log('[ProfitCollection] Profit collection disabled');
      return;
    }
    
    const now = Date.now();
    const elapsedSinceLastCapture = now - this.lastCapture;
    const nextCaptureIn = Math.max(0, this.captureIntervalMs - elapsedSinceLastCapture);
    
    console.log(`[ProfitCollection] Next profit capture in ${nextCaptureIn / 1000} seconds`);
    
    setTimeout(() => this.captureProfit(), nextCaptureIn);
  }
  
  /**
   * Get current routing strategy
   */
  private getCurrentRoutingStrategy(): string {
    if (!this.config.profitRouting?.enabled) {
      return "REINVEST"; // Default strategy
    }
    
    // Check if auto-switch is enabled
    if (this.config.profitRouting.autoSwitch?.enabled) {
      // Get performance metrics
      const metrics = calculatePerformanceMetrics();
      
      // Switch based on volatility
      if (metrics.volatility > (this.config.profitRouting.autoSwitch.volatilityThreshold || 5.0)) {
        return "SECURE";
      }
      
      // Switch based on profit
      if (metrics.totalProfit > (this.config.profitRouting.autoSwitch.profitThreshold || 20.0)) {
        return "BALANCED";
      }
    }
    
    // Use default strategy
    return this.config.profitRouting.autoSwitch?.defaultStrategy || "REINVEST";
  }
  
  /**
   * Get wallet distribution for the current strategy
   */
  private getWalletDistribution(): WalletInfo[] {
    const strategy = this.getCurrentRoutingStrategy();
    
    // Get wallet distribution for the strategy
    if (this.config.profitRouting?.strategies?.[strategy]?.wallets) {
      return this.config.profitRouting.strategies[strategy].wallets;
    }
    
    // Default distribution
    return [
      {
        address: this.walletAddress || "",
        label: "Trading Wallet",
        profitShare: this.config.reinvestment?.rate || 95
      },
      {
        address: this.config.reinvestment?.targetWallet || "",
        label: "Prophet Wallet",
        profitShare: 100 - (this.config.reinvestment?.rate || 95)
      }
    ];
  }
  
  /**
   * Capture profit
   */
  public async captureProfit(): Promise<boolean> {
    if (!this.walletAddress) {
      console.error('[ProfitCollection] Wallet not initialized');
      return false;
    }
    
    try {
      const startTime = Date.now();
      console.log('[ProfitCollection] Starting profit capture...');
      
      // Update last capture time
      this.lastCapture = startTime;
      
      // In a real implementation, this would calculate actual profits
      // For now, we'll simulate a small profit
      const profit = Math.random() * 0.01; // Random profit between 0 and 0.01 SOL
      console.log(`[ProfitCollection] Calculated profit: ${profit} SOL`);
      
      // If no profit, skip rest of process
      if (profit <= 0) {
        console.log('[ProfitCollection] No profit to capture');
        this.scheduleNextCapture();
        return true;
      }
      
      // Get wallet distribution for the current strategy
      const distribution = this.getWalletDistribution();
      const strategy = this.getCurrentRoutingStrategy();
      
      console.log(`[ProfitCollection] Using ${strategy} routing strategy`);
      console.log(`[ProfitCollection] Profit routing: ${JSON.stringify(distribution.map(w => `${w.label} (${w.profitShare}%)`))}`);
      
      // Log profit capture
      for (const wallet of distribution) {
        const walletShare = profit * (wallet.profitShare / 100);
        
        // Skip if share is 0
        if (walletShare <= 0) continue;
        
        console.log(`[ProfitCollection] Routing ${walletShare} SOL (${wallet.profitShare}%) to ${wallet.label} (${wallet.address})`);
        
        // In a real implementation, this would transfer the profit to each wallet
        // For now, we'll just log it
        
        // Log the profit capture
        addProfitCapture({
          timestamp: new Date().toISOString(),
          amount: walletShare,
          sourceWallet: this.walletAddress,
          destinationWallet: wallet.address,
          strategy,
          reinvestmentAmount: wallet.label === "Trading Wallet" ? walletShare : 0
        });
      }
      
      // Calculate duration
      const duration = Date.now() - startTime;
      this.captureDurations.push(duration);
      
      // Keep only the last 10 durations
      if (this.captureDurations.length > 10) {
        this.captureDurations.shift();
      }
      
      // Calculate average duration
      const avgDuration = this.captureDurations.reduce((sum, val) => sum + val, 0) / this.captureDurations.length;
      
      console.log(`[ProfitCollection] Profit capture completed in ${duration}ms (avg: ${avgDuration.toFixed(2)}ms)`);
      
      // Schedule next capture
      this.scheduleNextCapture();
      
      return true;
    } catch (error) {
      console.error('[ProfitCollection] Error capturing profit:', error);
      
      // Schedule next capture despite error
      this.scheduleNextCapture();
      
      return false;
    }
  }
  
  /**
   * Get profit collection status
   */
  public getStatus(): any {
    return {
      enabled: this.config.enabled,
      captureIntervalMinutes: this.config.captureIntervalMinutes,
      lastCapture: this.lastCapture ? new Date(this.lastCapture).toISOString() : null,
      nextCapture: this.lastCapture ? new Date(this.lastCapture + this.captureIntervalMs).toISOString() : null,
      currentStrategy: this.getCurrentRoutingStrategy(),
      walletDistribution: this.getWalletDistribution(),
      metrics: calculatePerformanceMetrics()
    };
  }
  
  /**
   * Reload configuration
   */
  public reloadConfig(): void {
    this.config = loadProfitConfig();
    this.captureIntervalMs = (this.config.captureIntervalMinutes || 4) * 60 * 1000;
    console.log(`[ProfitCollection] Configuration reloaded, interval: ${this.config.captureIntervalMinutes} minutes`);
  }
}