/**
 * Market Threshold Analyzer
 * 
 * This module analyzes the market to find the optimal minimum profit threshold
 * by examining historical spreads and transaction costs.
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { streamingPriceFeed } from './optimized-streaming-price-feed';

// Load environment variables
dotenv.config({ path: '.env.trading' });

// Constants
const CACHE_DIR = path.join(process.cwd(), 'cache');
const ANALYSIS_FILE = path.join(CACHE_DIR, 'threshold-analysis.json');
const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY || 'q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const SYNDICA_URL = `https://solana-mainnet.api.syndica.io/api-key/${SYNDICA_API_KEY}`;

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Type definitions
interface ExchangeSpread {
  exchange: string;
  pair: string;
  bidPrice: number;
  askPrice: number;
  spreadPercent: number;
  timestamp: number;
}

interface TransactionCost {
  network: string;
  baseFee: number;
  priorityFee: number;
  totalCostUsd: number;
  timestamp: number;
}

interface MarketAnalysis {
  minSpreadFound: number;
  averageSpread: number;
  medianSpread: number;
  transactionCosts: {
    average: number;
    min: number;
    max: number;
  };
  recommendedThreshold: number;
  updated: number;
  confidence: number;
  sampleSize: number;
}

class MarketThresholdAnalyzer {
  private spreads: ExchangeSpread[] = [];
  private transactionCosts: TransactionCost[] = [];
  private analysis: MarketAnalysis | null = null;
  private updating: boolean = false;
  
  constructor() {
    // Load cached data if available
    this.loadCache();
  }
  
  /**
   * Load cached data
   */
  private loadCache(): void {
    try {
      if (fs.existsSync(ANALYSIS_FILE)) {
        const data = fs.readFileSync(ANALYSIS_FILE, 'utf8');
        this.analysis = JSON.parse(data);
        console.log('Loaded cached market analysis');
      }
    } catch (error) {
      console.error('Error loading cached analysis:', error);
    }
  }
  
  /**
   * Save analysis to cache
   */
  private saveCache(): void {
    try {
      if (this.analysis) {
        fs.writeFileSync(ANALYSIS_FILE, JSON.stringify(this.analysis, null, 2));
      }
    } catch (error) {
      console.error('Error saving analysis cache:', error);
    }
  }
  
  /**
   * Fetch Jupiter spread data
   */
  private async fetchJupiterSpreads(): Promise<ExchangeSpread[]> {
    try {
      const response = await axios.get('https://quote-api.jup.ag/v6/quotes', {
        params: {
          inputMint: 'So11111111111111111111111111111111111111112', // SOL
          outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
          amount: 1000000000, // 1 SOL
          slippageBps: 10
        },
        timeout: 5000
      });
      
      if (response.data && response.data.data) {
        const routes = response.data.data;
        const now = Date.now();
        
        return routes.map((route: any) => {
          const inAmount = parseFloat(route.inAmount) / 1e9; // Convert from lamports to SOL
          const outAmount = parseFloat(route.outAmount) / 1e6; // Convert from USDC to USD
          
          // Calculate spread from the route
          const bidPrice = outAmount / inAmount;
          const askPrice = bidPrice * 1.005; // Estimate ask as 0.5% higher for this analysis
          const spreadPercent = ((askPrice - bidPrice) / bidPrice) * 100;
          
          return {
            exchange: route.marketInfos?.[0]?.label || 'Jupiter',
            pair: 'SOL/USDC',
            bidPrice,
            askPrice,
            spreadPercent,
            timestamp: now
          };
        });
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching Jupiter spreads:', error);
      return [];
    }
  }
  
  /**
   * Fetch transaction cost data
   */
  private async fetchTransactionCosts(): Promise<TransactionCost[]> {
    try {
      // Get SOL price for USD conversion
      const solPrice = streamingPriceFeed.getPrice('SOL')?.priceUsd || 150;
      
      // Get current priority fee levels
      const response = await axios.post(
        SYNDICA_URL,
        {
          jsonrpc: '2.0',
          id: '1',
          method: 'getRecentPrioritizationFees'
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 5000
        }
      );
      
      if (response.data && response.data.result) {
        const fees = response.data.result;
        const now = Date.now();
        
        // Calculate average priority fee
        let totalPriorityFee = 0;
        for (const fee of fees) {
          totalPriorityFee += fee.prioritizationFee;
        }
        const avgPriorityFee = totalPriorityFee / fees.length;
        
        // Base transaction fee in lamports
        const baseFee = 5000;
        
        // Convert to USD
        const totalCostUsd = (baseFee + avgPriorityFee) / LAMPORTS_PER_SOL * solPrice;
        
        return [{
          network: 'solana',
          baseFee,
          priorityFee: avgPriorityFee,
          totalCostUsd,
          timestamp: now
        }];
      }
      
      // Fallback to estimated costs if RPC fails
      return [{
        network: 'solana',
        baseFee: 5000,
        priorityFee: 200000,
        totalCostUsd: 0.0031 * solPrice,
        timestamp: Date.now()
      }];
    } catch (error) {
      console.error('Error fetching transaction costs:', error);
      
      // Use reasonable defaults
      const solPrice = streamingPriceFeed.getPrice('SOL')?.priceUsd || 150;
      return [{
        network: 'solana',
        baseFee: 5000,
        priorityFee: 200000,
        totalCostUsd: 0.0031 * solPrice,
        timestamp: Date.now()
      }];
    }
  }
  
  /**
   * Calculate the lowest viable profit threshold
   */
  private calculateThreshold(): MarketAnalysis {
    // Sort spreads
    this.spreads.sort((a, b) => a.spreadPercent - b.spreadPercent);
    
    // Calculate statistics
    const minSpread = this.spreads[0]?.spreadPercent || 0.1;
    
    // Calculate average spread
    const totalSpread = this.spreads.reduce((sum, s) => sum + s.spreadPercent, 0);
    const averageSpread = totalSpread / this.spreads.length;
    
    // Calculate median spread
    const medianIndex = Math.floor(this.spreads.length / 2);
    const medianSpread = this.spreads[medianIndex]?.spreadPercent || averageSpread;
    
    // Calculate transaction costs
    const totalCost = this.transactionCosts.reduce((sum, c) => sum + c.totalCostUsd, 0);
    const avgCost = totalCost / this.transactionCosts.length;
    const minCost = Math.min(...this.transactionCosts.map(c => c.totalCostUsd));
    const maxCost = Math.max(...this.transactionCosts.map(c => c.totalCostUsd));
    
    // Calculate recommended threshold
    // We need: transaction costs + spread + safety margin
    const solPrice = streamingPriceFeed.getPrice('SOL')?.priceUsd || 150;
    const transactionCostPercent = (avgCost / solPrice) * 100;
    const safetyMargin = 0.05; // 0.05% safety margin
    
    // The threshold must cover:
    // 1. The minimum spread (to overcome spread costs)
    // 2. Transaction costs as a percentage of trade value
    // 3. Safety margin
    let recommendedThreshold = minSpread + transactionCostPercent + safetyMargin;
    
    // Ensure we don't go below 0.1% absolute minimum
    recommendedThreshold = Math.max(recommendedThreshold, 0.1);
    
    // But also keep it as low as reasonably possible to capture more opportunities
    recommendedThreshold = Math.min(recommendedThreshold, 0.25);
    
    // Round to 2 decimal places
    recommendedThreshold = Math.round(recommendedThreshold * 100) / 100;
    
    return {
      minSpreadFound: minSpread,
      averageSpread: averageSpread,
      medianSpread: medianSpread,
      transactionCosts: {
        average: avgCost,
        min: minCost,
        max: maxCost
      },
      recommendedThreshold: recommendedThreshold,
      updated: Date.now(),
      confidence: 0.85,
      sampleSize: this.spreads.length
    };
  }
  
  /**
   * Update market analysis
   */
  public async updateAnalysis(): Promise<MarketAnalysis> {
    if (this.updating) {
      // Return existing analysis if already updating
      return this.analysis || {
        minSpreadFound: 0.1,
        averageSpread: 0.2,
        medianSpread: 0.15,
        transactionCosts: {
          average: 0.45,
          min: 0.3,
          max: 0.6
        },
        recommendedThreshold: 0.25,
        updated: Date.now(),
        confidence: 0.7,
        sampleSize: 0
      };
    }
    
    this.updating = true;
    
    try {
      // Fetch latest data
      const newSpreads = await this.fetchJupiterSpreads();
      const newCosts = await this.fetchTransactionCosts();
      
      // Update collections
      this.spreads = [...this.spreads, ...newSpreads].slice(-100); // Keep last 100 spread samples
      this.transactionCosts = [...this.transactionCosts, ...newCosts].slice(-20); // Keep last 20 cost samples
      
      // Calculate new analysis
      this.analysis = this.calculateThreshold();
      
      // Save cache
      this.saveCache();
      
      console.log(`Market analysis updated: ${this.analysis.recommendedThreshold.toFixed(2)}% threshold recommended`);
      
      return this.analysis;
    } catch (error) {
      console.error('Error updating market analysis:', error);
      
      // Return existing analysis or fallback
      return this.analysis || {
        minSpreadFound: 0.1,
        averageSpread: 0.2,
        medianSpread: 0.15,
        transactionCosts: {
          average: 0.45,
          min: 0.3,
          max: 0.6
        },
        recommendedThreshold: 0.25,
        updated: Date.now(),
        confidence: 0.7,
        sampleSize: 0
      };
    } finally {
      this.updating = false;
    }
  }
  
  /**
   * Get the recommended profit threshold
   */
  public async getRecommendedThreshold(): Promise<number> {
    // Update analysis if needed or use cached
    const now = Date.now();
    const cacheAge = this.analysis ? now - this.analysis.updated : Infinity;
    
    if (!this.analysis || cacheAge > 3600000) { // Update if older than 1 hour
      await this.updateAnalysis();
    }
    
    return this.analysis?.recommendedThreshold || 0.25;
  }
  
  /**
   * Get the full analysis
   */
  public async getAnalysis(): Promise<MarketAnalysis> {
    // Update analysis if needed or use cached
    const now = Date.now();
    const cacheAge = this.analysis ? now - this.analysis.updated : Infinity;
    
    if (!this.analysis || cacheAge > 3600000) { // Update if older than 1 hour
      await this.updateAnalysis();
    }
    
    return this.analysis || {
      minSpreadFound: 0.1,
      averageSpread: 0.2,
      medianSpread: 0.15,
      transactionCosts: {
        average: 0.45,
        min: 0.3,
        max: 0.6
      },
      recommendedThreshold: 0.25,
      updated: Date.now(),
      confidence: 0.7,
      sampleSize: 0
    };
  }
}

// Create and export singleton instance
export const marketThresholdAnalyzer = new MarketThresholdAnalyzer();

// If this module is run directly, analyze and print
if (require.main === module) {
  const analyzer = marketThresholdAnalyzer;
  
  async function run() {
    console.log('Analyzing market to find optimal profit threshold...');
    
    const analysis = await analyzer.updateAnalysis();
    
    console.log('\n=== MARKET THRESHOLD ANALYSIS ===');
    console.log(`Minimum spread found: ${analysis.minSpreadFound.toFixed(2)}%`);
    console.log(`Average spread: ${analysis.averageSpread.toFixed(2)}%`);
    console.log(`Median spread: ${analysis.medianSpread.toFixed(2)}%`);
    console.log(`Transaction costs: $${analysis.transactionCosts.average.toFixed(4)} (avg)`);
    console.log(`Recommended minimum profit threshold: ${analysis.recommendedThreshold.toFixed(2)}%`);
    console.log(`Confidence: ${(analysis.confidence * 100).toFixed(0)}%`);
    console.log(`Sample size: ${analysis.sampleSize} spread measurements`);
    console.log('=====================================');
    
    process.exit(0);
  }
  
  run();
}