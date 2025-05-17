/**
 * Quantum Omega Meme Token Sniper - High Capital Simulation
 * 
 * This script simulates the Quantum Omega meme token sniping strategy
 * with 1 SOL capital, focusing on new launches and liquidity pool sniping.
 */

import * as fs from 'fs';

// Constants
const SOL_PRICE_USD = 160;
const SIMULATION_MINUTES = 60;
const TRANSACTION_FEE_SOL = 0.000005; // Average Solana transaction fee
const SLIPPAGE_TOLERANCE = 0.02; // 2% slippage tolerance
const DEX_FEE_PERCENT = 0.3; // 0.3% DEX fee

// Token Configuration
interface MemeToken {
  symbol: string;
  name: string;
  launchTimestamp: Date | null;
  initialPrice: number;
  currentPrice: number;
  marketCap: number;
  holders: number;
  volume24h: number;
  sentiment: number; // 0-1 social sentiment
  volatility: number; // 0-1 price volatility
  botProtection: boolean; // Has bot protection
  botProtectionDuration: number; // Minutes of bot protection
  tradingEnabled: boolean;
  lpLocked: boolean;
  lpLockDuration: number; // Days
  initialLiquiditySOL: number; // Initial liquidity in SOL
  lpRatio: number; // Ratio of token:SOL in pool
  website: boolean;
  twitter: boolean;
  telegram: boolean;
  tokenomics: {
    totalSupply: number;
    burnedTokens: number;
    teamTokens: number;
    liquidityPercent: number;
    taxBuy: number;
    taxSell: number;
  }
}

// Trading Signals
interface TradingSignal {
  id: string;
  timestamp: Date;
  source: string;
  token: string;
  type: 'buy' | 'sell';
  direction: 'long' | 'short';
  confidence: number; // 0-1
  reason: string;
  urgency: 'low' | 'medium' | 'high';
}

// Trade Result
interface Trade {
  id: string;
  timestamp: Date;
  token: string;
  action: 'buy' | 'sell';
  entryPrice: number;
  exitPrice?: number;
  amountSOL: number;
  amountTokens: number;
  feesSOL: number;
  status: 'open' | 'closed' | 'failed';
  profitLossSOL?: number;
  profitLossPercent?: number;
  reason: string;
}

// Meme Token Market Simulation
class MemeTokenMarket {
  private tokens: Map<string, MemeToken> = new Map();
  private currentTimestamp: Date;
  private launchProbability = 0.12; // 12% chance of new token launch every simulation step
  
  constructor() {
    this.currentTimestamp = new Date();
    this.initializeExistingTokens();
  }
  
  private initializeExistingTokens(): void {
    // Add some existing meme tokens to the market
    const existingTokens: MemeToken[] = [
      {
        symbol: 'BONK',
        name: 'Bonk',
        launchTimestamp: new Date(this.currentTimestamp.getTime() - 180 * 24 * 60 * 60 * 1000), // 180 days ago
        initialPrice: 0.000005,
        currentPrice: 0.00001,
        marketCap: 580000000,
        holders: 320000,
        volume24h: 12000000,
        sentiment: 0.75,
        volatility: 0.08,
        botProtection: false,
        botProtectionDuration: 0,
        tradingEnabled: true,
        lpLocked: true,
        lpLockDuration: 180,
        initialLiquiditySOL: 5000,
        lpRatio: 70,
        website: true,
        twitter: true,
        telegram: true,
        tokenomics: {
          totalSupply: 56000000000000,
          burnedTokens: 5600000000000,
          teamTokens: 5600000000000,
          liquidityPercent: 80,
          taxBuy: 0,
          taxSell: 0
        }
      },
      {
        symbol: 'MEME',
        name: 'Meme',
        launchTimestamp: new Date(this.currentTimestamp.getTime() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
        initialPrice: 0.01,
        currentPrice: 0.02,
        marketCap: 240000000,
        holders: 85000,
        volume24h: 8500000,
        sentiment: 0.72,
        volatility: 0.1,
        botProtection: false,
        botProtectionDuration: 0,
        tradingEnabled: true,
        lpLocked: true,
        lpLockDuration: 365,
        initialLiquiditySOL: 4000,
        lpRatio: 65,
        website: true,
        twitter: true,
        telegram: true,
        tokenomics: {
          totalSupply: 12000000000,
          burnedTokens: 600000000,
          teamTokens: 1200000000,
          liquidityPercent: 75,
          taxBuy: 0,
          taxSell: 0
        }
      },
      {
        symbol: 'WIF',
        name: 'Dogwifhat',
        launchTimestamp: new Date(this.currentTimestamp.getTime() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
        initialPrice: 0.15,
        currentPrice: 0.52,
        marketCap: 520000000,
        holders: 62000,
        volume24h: 19000000,
        sentiment: 0.8,
        volatility: 0.09,
        botProtection: false,
        botProtectionDuration: 0,
        tradingEnabled: true,
        lpLocked: true,
        lpLockDuration: 365,
        initialLiquiditySOL: 8000,
        lpRatio: 80,
        website: true,
        twitter: true,
        telegram: true,
        tokenomics: {
          totalSupply: 1000000000,
          burnedTokens: 0,
          teamTokens: 100000000,
          liquidityPercent: 80,
          taxBuy: 0,
          taxSell: 0
        }
      }
    ];
    
    // Add existing tokens to the map
    existingTokens.forEach(token => {
      this.tokens.set(token.symbol, token);
    });
  }
  
  // Update the market for the current timestamp
  public updateMarket(timestamp: Date): void {
    this.currentTimestamp = timestamp;
    
    // Update existing token prices
    this.updateTokenPrices();
    
    // Possibly launch a new token
    this.possiblyLaunchNewToken();
  }
  
  // Update prices for existing tokens
  private updateTokenPrices(): void {
    this.tokens.forEach(token => {
      if (token.tradingEnabled) {
        // Calculate price movement based on volatility and sentiment
        const baseMovement = (Math.random() - 0.5) * 2 * token.volatility;
        
        // Sentiment influences direction (higher sentiment = more likely positive movement)
        const sentimentFactor = (token.sentiment - 0.5) * 0.04;
        
        // Combine factors
        const priceChange = baseMovement + sentimentFactor;
        
        // Update price
        token.currentPrice *= (1 + priceChange);
        
        // Update volume (with some randomness)
        token.volume24h *= (0.95 + Math.random() * 0.1);
        
        // Occasionally update sentiment
        if (Math.random() < 0.2) {
          // Sentiment tends to follow price movement a bit
          const sentimentChange = (priceChange > 0 ? 0.01 : -0.01) * Math.random();
          token.sentiment = Math.max(0.1, Math.min(0.95, token.sentiment + sentimentChange));
        }
        
        // For newly launched tokens, simulate price pump in first 15 minutes
        if (token.launchTimestamp) {
          const minutesSinceLaunch = (this.currentTimestamp.getTime() - token.launchTimestamp.getTime()) / (60 * 1000);
          if (minutesSinceLaunch < 15) {
            // Higher chance of price increase in first 15 minutes
            const pumpFactor = Math.max(0, (15 - minutesSinceLaunch) / 15) * 0.08 * Math.random();
            token.currentPrice *= (1 + pumpFactor);
          }
        }
      } else if (token.launchTimestamp && token.botProtection) {
        // Check if bot protection period has ended
        const minutesSinceLaunch = (this.currentTimestamp.getTime() - token.launchTimestamp.getTime()) / (60 * 1000);
        if (minutesSinceLaunch >= token.botProtectionDuration) {
          token.tradingEnabled = true;
          token.botProtection = false;
          console.log(`[${this.currentTimestamp.toISOString()}] 🔓 Bot protection ended for ${token.symbol}, trading now enabled`);
        }
      }
    });
  }
  
  // Possibly launch a new token with some probability
  private possiblyLaunchNewToken(): void {
    if (Math.random() < this.launchProbability) {
      this.launchNewToken();
    }
  }
  
  // Launch a new token
  private launchNewToken(): void {
    // Random token attributes
    const dogPrefixes = ['Shib', 'Doge', 'Pup', 'Woof', 'Bark', 'Fluff', 'Dog', 'Paw', 'Fur', 'Howl', 'Bull'];
    const dogSuffixes = ['Inu', 'Moon', 'Rocket', 'Coin', 'Cash', 'Dollar', 'Elon', 'Mars', 'AI', 'Sol'];
    const randomName = dogPrefixes[Math.floor(Math.random() * dogPrefixes.length)] + 
                      dogSuffixes[Math.floor(Math.random() * dogSuffixes.length)];
    
    const symbol = randomName.substring(0, 3) + randomName.substring(randomName.length - 1);
    
    // Configure token attributes
    const hasBotProtection = Math.random() < 0.3; // 30% chance of bot protection
    const hasLiquidityLocked = Math.random() < 0.8; // 80% chance of locked liquidity
    const initialPrice = 0.00001 * Math.random() * 10;
    const totalSupply = Math.pow(10, 9 + Math.floor(Math.random() * 6)); // 10^9 to 10^15
    
    // Generate initial liquidity pool size (in SOL)
    const initialLiquiditySOL = 10 + Math.random() * 490; // 10-500 SOL
    const lpRatio = 50 + Math.random() * 40; // 50-90% ratio (higher = better)
    
    const newToken: MemeToken = {
      symbol: symbol,
      name: randomName,
      launchTimestamp: new Date(this.currentTimestamp),
      initialPrice: initialPrice,
      currentPrice: initialPrice,
      marketCap: initialPrice * totalSupply * 0.3, // Assume 30% circulating
      holders: 10 + Math.floor(Math.random() * 50), // Initial holders
      volume24h: 0, // No volume yet
      sentiment: 0.5 + Math.random() * 0.3, // Initial sentiment (0.5-0.8)
      volatility: 0.1 + Math.random() * 0.15, // High initial volatility (0.1-0.25)
      botProtection: hasBotProtection,
      botProtectionDuration: hasBotProtection ? 5 + Math.floor(Math.random() * 55) : 0, // 5-60 minutes if protected
      tradingEnabled: !hasBotProtection, // Only enabled if no bot protection
      lpLocked: hasLiquidityLocked,
      lpLockDuration: hasLiquidityLocked ? 30 + Math.floor(Math.random() * 335) : 0, // 30-365 days if locked
      initialLiquiditySOL: initialLiquiditySOL,
      lpRatio: lpRatio,
      website: Math.random() < 0.7, // 70% chance of having a website
      twitter: Math.random() < 0.9, // 90% chance of having Twitter
      telegram: Math.random() < 0.95, // 95% chance of having Telegram
      tokenomics: {
        totalSupply: totalSupply,
        burnedTokens: Math.floor(totalSupply * 0.01 * Math.random()), // 0-1% burned initially
        teamTokens: Math.floor(totalSupply * (0.05 + Math.random() * 0.15)), // 5-20% team allocation
        liquidityPercent: 60 + Math.floor(Math.random() * 30), // 60-90% in liquidity
        taxBuy: Math.floor(Math.random() * 10), // 0-10% buy tax
        taxSell: Math.floor(Math.random() * 15) // 0-15% sell tax
      }
    };
    
    // Add the token to the market
    this.tokens.set(symbol, newToken);
    
    // Log the launch
    console.log(`[${this.currentTimestamp.toISOString()}] 🚀 New token launched: ${newToken.name} (${symbol}) at $${newToken.initialPrice.toFixed(10)}`);
    console.log(`    💰 Initial Market Cap: $${Math.round(newToken.marketCap).toLocaleString()}`);
    console.log(`    💧 Liquidity Pool: ${newToken.initialLiquiditySOL.toFixed(2)} SOL (${newToken.lpRatio.toFixed(0)}% ratio)`);
    console.log(`    🔒 LP Locked: ${newToken.lpLocked ? `Yes (${newToken.lpLockDuration} days)` : 'No'}`);
    console.log(`    🛡️ Bot Protection: ${newToken.botProtection ? `Yes (${newToken.botProtectionDuration} mins)` : 'No'}`);
    console.log(`    📊 Buy/Sell Tax: ${newToken.tokenomics.taxBuy}%/${newToken.tokenomics.taxSell}%`);
  }
  
  // Get all available tokens
  public getTokens(): MemeToken[] {
    return Array.from(this.tokens.values());
  }
  
  // Get a specific token
  public getToken(symbol: string): MemeToken | undefined {
    return this.tokens.get(symbol);
  }
  
  // Get newly launched tokens (within the last X minutes)
  public getNewlyLaunchedTokens(withinMinutes: number): MemeToken[] {
    const cutoffTime = new Date(this.currentTimestamp.getTime() - withinMinutes * 60 * 1000);
    
    return Array.from(this.tokens.values()).filter(token => 
      token.launchTimestamp && token.launchTimestamp >= cutoffTime);
  }
}

// Enhanced Quantum Omega Meme Token Sniper
class EnhancedQuantumOmegaSniper {
  private capital: number;
  private initialCapital: number;
  private trades: Trade[] = [];
  private openPositions: Map<string, Trade> = new Map();
  private signals: TradingSignal[] = [];
  private memeMarket: MemeTokenMarket;
  private currentTimestamp: Date;
  private simulationEndTime: Date;
  
  // Enhanced strategy parameters
  private maxPositionSizePercent = 0.12; // Maximum 12% of capital per position
  private entryConfidenceThreshold = 0.65; // Minimum confidence to enter a position
  private takeProfit = 0.5; // 50% take profit target
  private stopLoss = 0.12; // 12% stop loss (tighter than before)
  private recentLaunchThresholdMinutes = 20; // Consider tokens launched within 20 minutes
  private maxBuyTaxThreshold = 8; // Maximum buy tax to consider
  private maxSellTaxThreshold = 12; // Maximum sell tax to consider
  private lpLockRequired = true; // Require LP to be locked
  private minLiquiditySOL = 20; // Minimum liquidity in SOL
  private maxPositions = 5; // Maximum concurrent positions
  private earlyLaunchBonus = 0.2; // Confidence bonus for tokens <3 minutes old
  private aggressiveScaling = true; // Scale position size based on liquidity and confidence
  
  constructor(initialCapital: number, simulationMinutes: number) {
    this.capital = initialCapital;
    this.initialCapital = initialCapital;
    this.memeMarket = new MemeTokenMarket();
    this.currentTimestamp = new Date();
    this.simulationEndTime = new Date(this.currentTimestamp.getTime() + simulationMinutes * 60 * 1000);
  }
  
  // Run the simulation
  public runSimulation(): void {
    console.log('=============================================');
    console.log('🚀 ENHANCED QUANTUM OMEGA MEME SNIPER SIMULATION');
    console.log('=============================================');
    console.log(`Initial Capital: ${this.initialCapital.toFixed(6)} SOL ($${(this.initialCapital * SOL_PRICE_USD).toFixed(2)})`);
    console.log(`Simulation Duration: ${SIMULATION_MINUTES} minutes`);
    console.log(`Max Position Size: ${this.maxPositionSizePercent * 100}% of capital`);
    console.log(`Entry Confidence Threshold: ${this.entryConfidenceThreshold * 100}%`);
    console.log(`Take Profit: ${this.takeProfit * 100}%`);
    console.log(`Stop Loss: ${this.stopLoss * 100}%`);
    console.log(`Min Liquidity Pool: ${this.minLiquiditySOL} SOL`);
    console.log('=============================================');
    console.log('Starting simulation...');
    console.log('=============================================');
    
    // Simulation time step (1 minute)
    const timeStepMs = 60 * 1000;
    
    // Run simulation until end time
    while (this.currentTimestamp < this.simulationEndTime) {
      // Update the market
      this.memeMarket.updateMarket(this.currentTimestamp);
      
      // Analyze market and generate signals
      this.analyzeMarket();
      
      // Process signals and execute trades
      this.processSignals();
      
      // Manage existing positions
      this.managePositions();
      
      // Advance time
      this.currentTimestamp = new Date(this.currentTimestamp.getTime() + timeStepMs);
    }
    
    // Close any remaining positions at the end of simulation
    this.closeAllPositions();
    
    // Generate report
    this.generateReport();
  }
  
  // Analyze market conditions and generate trading signals
  private analyzeMarket(): void {
    // Focus on newly launched tokens
    const newTokens = this.memeMarket.getNewlyLaunchedTokens(this.recentLaunchThresholdMinutes);
    
    // Analyze each new token
    for (const token of newTokens) {
      // Skip tokens with bot protection still active
      if (token.botProtection && !token.tradingEnabled) {
        continue;
      }
      
      // Skip tokens with too high taxes
      if (token.tokenomics.taxBuy > this.maxBuyTaxThreshold || 
          token.tokenomics.taxSell > this.maxSellTaxThreshold) {
        continue;
      }
      
      // Skip tokens without locked liquidity if required
      if (this.lpLockRequired && !token.lpLocked) {
        continue;
      }
      
      // Skip tokens with insufficient liquidity
      if (token.initialLiquiditySOL < this.minLiquiditySOL) {
        continue;
      }
      
      // Calculate buy confidence based on various factors
      let buyConfidence = 0.5; // Base confidence
      
      // Adjust confidence based on token attributes
      if (token.website) buyConfidence += 0.05;
      if (token.twitter) buyConfidence += 0.05;
      if (token.telegram) buyConfidence += 0.05;
      if (token.lpLocked) buyConfidence += 0.1;
      if (token.tokenomics.taxBuy <= 3) buyConfidence += 0.05;
      if (token.tokenomics.taxSell <= 5) buyConfidence += 0.05;
      if (token.tokenomics.liquidityPercent >= 80) buyConfidence += 0.1;
      if (token.lpRatio >= 75) buyConfidence += 0.08; // Good liquidity ratio
      
      // Liquidity bonus (higher liquidity = higher confidence)
      const liquidityBonus = Math.min(0.1, token.initialLiquiditySOL / 1000);
      buyConfidence += liquidityBonus;
      
      // Adjustment for very recent launches (higher confidence)
      const minutesSinceLaunch = (this.currentTimestamp.getTime() - token.launchTimestamp!.getTime()) / (60 * 1000);
      if (minutesSinceLaunch <= 3) {
        buyConfidence += this.earlyLaunchBonus; // Significant boost for very fresh launches
      } else if (minutesSinceLaunch <= 10) {
        buyConfidence += 0.1;
      }
      
      // Random factor (market noise)
      buyConfidence += (Math.random() - 0.5) * 0.1;
      
      // Cap confidence between 0 and 1
      buyConfidence = Math.max(0, Math.min(1, buyConfidence));
      
      // Generate buy signal if confidence is high enough
      if (buyConfidence >= this.entryConfidenceThreshold) {
        const signal: TradingSignal = {
          id: `signal-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          timestamp: new Date(this.currentTimestamp),
          source: 'Quantum Omega',
          token: token.symbol,
          type: 'buy',
          direction: 'long',
          confidence: buyConfidence,
          reason: `New token launch: ${token.name} (${token.symbol}) with ${token.initialLiquiditySOL.toFixed(1)} SOL liquidity`,
          urgency: minutesSinceLaunch <= 3 ? 'high' : 'medium'
        };
        
        this.signals.push(signal);
        console.log(`[${this.currentTimestamp.toISOString()}] 🧠 Generated BUY signal for ${token.symbol} with ${(buyConfidence * 100).toFixed(1)}% confidence`);
      }
    }
    
    // Analyze existing positions for sell signals
    for (const [symbol, position] of this.openPositions.entries()) {
      const token = this.memeMarket.getToken(symbol);
      
      if (!token) continue;
      
      // Calculate current P&L
      const currentPrice = token.currentPrice;
      const entryPrice = position.entryPrice;
      const priceChange = (currentPrice - entryPrice) / entryPrice;
      
      // Generate sell signals based on:
      // 1. Take profit reached
      // 2. Stop loss triggered
      // 3. Token sentiment dropping significantly
      // 4. Liquidity ratio deteriorating
      
      let sellConfidence = 0.5; // Base sell confidence
      let sellReason = '';
      
      // Take profit check
      if (priceChange >= this.takeProfit) {
        sellConfidence = 0.9;
        sellReason = `Take profit reached: +${(priceChange * 100).toFixed(1)}%`;
      }
      // Stop loss check
      else if (priceChange <= -this.stopLoss) {
        sellConfidence = 0.9;
        sellReason = `Stop loss triggered: ${(priceChange * 100).toFixed(1)}%`;
      }
      // Sentiment check - sell on dropping sentiment
      else if (token.sentiment < 0.4 && priceChange > 0) {
        sellConfidence = 0.7;
        sellReason = `Low sentiment (${(token.sentiment * 100).toFixed(1)}%) with profit: +${(priceChange * 100).toFixed(1)}%`;
      }
      // Time-based exit for positions with good profit
      else {
        const hoursSinceEntry = (this.currentTimestamp.getTime() - position.timestamp.getTime()) / (60 * 60 * 1000);
        if (hoursSinceEntry > 4 && priceChange > 0.2) {
          sellConfidence = 0.75;
          sellReason = `Time-based exit with +${(priceChange * 100).toFixed(1)}% profit after ${hoursSinceEntry.toFixed(1)} hours`;
        }
      }
      
      // Generate sell signal if warranted
      if (sellConfidence >= 0.7) {
        const signal: TradingSignal = {
          id: `signal-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          timestamp: new Date(this.currentTimestamp),
          source: 'Quantum Omega',
          token: token.symbol,
          type: 'sell',
          direction: 'long',
          confidence: sellConfidence,
          reason: sellReason,
          urgency: priceChange <= -this.stopLoss ? 'high' : 'medium'
        };
        
        this.signals.push(signal);
        console.log(`[${this.currentTimestamp.toISOString()}] 🧠 Generated SELL signal for ${token.symbol} with ${(sellConfidence * 100).toFixed(1)}% confidence - ${sellReason}`);
      }
    }
  }
  
  // Process signals and execute trades
  private processSignals(): void {
    // Sort signals by urgency and confidence
    const actionableSignals = [...this.signals].sort((a, b) => {
      // Sort by urgency first
      const urgencyOrder = { 'high': 0, 'medium': 1, 'low': 2 };
      if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      }
      // Then by confidence
      return b.confidence - a.confidence;
    });
    
    // Process each signal
    for (const signal of actionableSignals) {
      if (signal.type === 'buy') {
        this.executeBuySignal(signal);
      } else if (signal.type === 'sell') {
        this.executeSellSignal(signal);
      }
    }
    
    // Clear processed signals
    this.signals = [];
  }
  
  // Execute buy signal
  private executeBuySignal(signal: TradingSignal): void {
    // Skip if already have position in this token
    if (this.openPositions.has(signal.token)) {
      return;
    }
    
    // Skip if reached maximum number of positions
    if (this.openPositions.size >= this.maxPositions) {
      return;
    }
    
    // Get token details
    const token = this.memeMarket.getToken(signal.token);
    if (!token || !token.tradingEnabled) {
      return;
    }
    
    // Calculate base position size 
    let basePositionSize = this.capital * this.maxPositionSizePercent;
    
    // If aggressive scaling is enabled, adjust position size based on:
    // 1. Token liquidity (higher liquidity = larger position)
    // 2. Signal confidence (higher confidence = larger position)
    if (this.aggressiveScaling) {
      // Liquidity scaling factor (0.5-1.5x)
      const liquidityFactor = Math.min(1.5, Math.max(0.5, token.initialLiquiditySOL / 100));
      
      // Confidence scaling factor (0.7-1.3x)
      const confidenceFactor = 0.7 + (signal.confidence * 0.6);
      
      // Apply scaling
      basePositionSize *= liquidityFactor * confidenceFactor;
      
      // Cap at maximum position size
      basePositionSize = Math.min(basePositionSize, this.capital * this.maxPositionSizePercent * 1.5);
    }
    
    // Check if we have enough capital
    if (basePositionSize >= this.capital) {
      basePositionSize = this.capital * 0.95; // Use 95% of remaining capital at most
    }
    
    // Calculate how many tokens we can buy
    // Account for:
    // 1. DEX fee
    // 2. Buy tax
    // 3. Slippage
    const dexFee = basePositionSize * (DEX_FEE_PERCENT / 100);
    const effectiveAmount = basePositionSize - dexFee;
    const buyTaxFactor = 1 - (token.tokenomics.taxBuy / 100);
    const slippageFactor = 1 - SLIPPAGE_TOLERANCE;
    
    // Calculate received tokens
    const tokenAmount = (effectiveAmount * SOL_PRICE_USD / token.currentPrice) * buyTaxFactor * slippageFactor;
    
    // Execute the trade
    const trade: Trade = {
      id: `trade-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      timestamp: new Date(this.currentTimestamp),
      token: token.symbol,
      action: 'buy',
      entryPrice: token.currentPrice,
      amountSOL: basePositionSize,
      amountTokens: tokenAmount,
      feesSOL: dexFee + TRANSACTION_FEE_SOL,
      status: 'open',
      reason: signal.reason
    };
    
    // Update capital
    this.capital -= basePositionSize;
    
    // Add to open positions
    this.openPositions.set(token.symbol, trade);
    
    // Add to trade history
    this.trades.push(trade);
    
    // Log the trade
    console.log(`[${this.currentTimestamp.toISOString()}] 🔄 Bought ${token.symbol} for ${basePositionSize.toFixed(6)} SOL ($${(basePositionSize * SOL_PRICE_USD).toFixed(2)}) at $${token.currentPrice.toFixed(10)}`);
  }
  
  // Execute sell signal
  private executeSellSignal(signal: TradingSignal): void {
    // Skip if no position in this token
    if (!this.openPositions.has(signal.token)) {
      return;
    }
    
    // Get token details
    const token = this.memeMarket.getToken(signal.token);
    if (!token || !token.tradingEnabled) {
      return;
    }
    
    // Get position details
    const position = this.openPositions.get(signal.token)!;
    
    // Calculate sell value
    // Account for:
    // 1. DEX fee
    // 2. Sell tax
    // 3. Slippage
    const sellTaxFactor = 1 - (token.tokenomics.taxSell / 100);
    const slippageFactor = 1 - SLIPPAGE_TOLERANCE;
    
    // Calculate gross SOL amount from selling tokens
    const grossSOLAmount = (position.amountTokens * token.currentPrice / SOL_PRICE_USD) * sellTaxFactor * slippageFactor;
    
    // Subtract DEX fee
    const dexFee = grossSOLAmount * (DEX_FEE_PERCENT / 100);
    const netSOLAmount = grossSOLAmount - dexFee - TRANSACTION_FEE_SOL;
    
    // Calculate profit/loss
    const profitLossSOL = netSOLAmount - position.amountSOL;
    const profitLossPercent = (profitLossSOL / position.amountSOL) * 100;
    
    // Update position
    position.status = 'closed';
    position.exitPrice = token.currentPrice;
    position.profitLossSOL = profitLossSOL;
    position.profitLossPercent = profitLossPercent;
    
    // Remove from open positions
    this.openPositions.delete(token.symbol);
    
    // Update capital
    this.capital += netSOLAmount;
    
    // Log the trade
    const profitLossText = profitLossSOL >= 0 ? 'profit' : 'loss';
    console.log(`[${this.currentTimestamp.toISOString()}] 🔄 Sold ${token.symbol} for ${netSOLAmount.toFixed(6)} SOL with ${profitLossText} of ${profitLossSOL.toFixed(6)} SOL (${profitLossPercent.toFixed(2)}%)`);
  }
  
  // Manage existing positions
  private managePositions(): void {
    // Update unrealized P&L for each position
    for (const [symbol, position] of this.openPositions.entries()) {
      const token = this.memeMarket.getToken(symbol);
      
      // Skip if token no longer exists
      if (!token) continue;
      
      // Calculate current P&L
      const currentPrice = token.currentPrice;
      const entryPrice = position.entryPrice;
      const priceChange = (currentPrice - entryPrice) / entryPrice;
      
      // Auto-exit if stop loss is hit
      if (priceChange <= -this.stopLoss) {
        // Create an emergency sell signal
        const signal: TradingSignal = {
          id: `signal-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          timestamp: new Date(this.currentTimestamp),
          source: 'Quantum Omega',
          token: symbol,
          type: 'sell',
          direction: 'long',
          confidence: 1.0, // Maximum confidence for stop loss
          reason: `Emergency stop loss: ${(priceChange * 100).toFixed(1)}%`,
          urgency: 'high'
        };
        
        // Execute the sell
        this.executeSellSignal(signal);
      }
      
      // Auto-exit if take profit is hit
      else if (priceChange >= this.takeProfit) {
        // Create an take profit signal
        const signal: TradingSignal = {
          id: `signal-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          timestamp: new Date(this.currentTimestamp),
          source: 'Quantum Omega',
          token: symbol,
          type: 'sell',
          direction: 'long',
          confidence: 1.0, // Maximum confidence for take profit
          reason: `Take profit triggered: +${(priceChange * 100).toFixed(1)}%`,
          urgency: 'high'
        };
        
        // Execute the sell
        this.executeSellSignal(signal);
      }
    }
  }
  
  // Close all remaining positions at the end of simulation
  private closeAllPositions(): void {
    // Get all open position symbols
    const openPositionSymbols = Array.from(this.openPositions.keys());
    
    // Create sell signals for each
    for (const symbol of openPositionSymbols) {
      const signal: TradingSignal = {
        id: `signal-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        timestamp: new Date(this.currentTimestamp),
        source: 'Quantum Omega',
        token: symbol,
        type: 'sell',
        direction: 'long',
        confidence: 1.0,
        reason: 'End of simulation',
        urgency: 'high'
      };
      
      // Execute the sell
      this.executeSellSignal(signal);
    }
  }
  
  // Generate simulation report
  private generateReport(): void {
    // Calculate performance metrics
    const finalCapital = this.capital;
    const profit = finalCapital - this.initialCapital;
    const roi = (profit / this.initialCapital) * 100;
    
    // Calculate trade statistics
    const totalTrades = this.trades.length;
    const closedTrades = this.trades.filter(t => t.status === 'closed');
    const profitableTrades = closedTrades.filter(t => t.profitLossSOL && t.profitLossSOL > 0);
    const winRate = closedTrades.length > 0 ? (profitableTrades.length / closedTrades.length) * 100 : 0;
    
    // Calculate average profit/loss
    let avgProfitPercent = 0;
    let avgLossPercent = 0;
    
    if (profitableTrades.length > 0) {
      avgProfitPercent = profitableTrades.reduce((sum, trade) => sum + (trade.profitLossPercent || 0), 0) / profitableTrades.length;
    }
    
    const lossTrades = closedTrades.filter(t => t.profitLossSOL && t.profitLossSOL <= 0);
    if (lossTrades.length > 0) {
      avgLossPercent = lossTrades.reduce((sum, trade) => sum + (trade.profitLossPercent || 0), 0) / lossTrades.length;
    }
    
    // Print report
    console.log('\n========================================');
    console.log('📊 ENHANCED QUANTUM OMEGA MEME SNIPER REPORT');
    console.log('========================================');
    console.log(`Initial Capital: ${this.initialCapital.toFixed(6)} SOL ($${(this.initialCapital * SOL_PRICE_USD).toFixed(2)})`);
    console.log(`Final Capital: ${finalCapital.toFixed(6)} SOL ($${(finalCapital * SOL_PRICE_USD).toFixed(2)})`);
    console.log(`Total Profit/Loss: ${profit.toFixed(6)} SOL ($${(profit * SOL_PRICE_USD).toFixed(2)})`);
    console.log(`Return on Investment: ${roi.toFixed(2)}%`);
    console.log('----------------------------------------');
    console.log(`Total Trades: ${totalTrades}`);
    console.log(`Completed Trades: ${closedTrades.length}`);
    console.log(`Profitable Trades: ${profitableTrades.length}`);
    console.log(`Win Rate: ${winRate.toFixed(2)}%`);
    console.log(`Average Profit: ${avgProfitPercent.toFixed(2)}%`);
    console.log(`Average Loss: ${avgLossPercent.toFixed(2)}%`);
    console.log('----------------------------------------');
    console.log('Top 3 Profitable Trades:');
    
    // Get top 3 profitable trades
    const topTrades = [...closedTrades]
      .filter(t => t.profitLossSOL !== undefined)
      .sort((a, b) => (b.profitLossSOL || 0) - (a.profitLossSOL || 0))
      .slice(0, 3);
    
    topTrades.forEach((trade, index) => {
      console.log(`${index+1}. ${trade.token}: ${trade.profitLossSOL?.toFixed(6)} SOL (${trade.profitLossPercent?.toFixed(2)}%)`);
    });
    
    console.log('========================================');
    console.log('Worst 3 Trades:');
    
    // Get worst 3 trades
    const worstTrades = [...closedTrades]
      .filter(t => t.profitLossSOL !== undefined)
      .sort((a, b) => (a.profitLossSOL || 0) - (b.profitLossSOL || 0))
      .slice(0, 3);
    
    worstTrades.forEach((trade, index) => {
      console.log(`${index+1}. ${trade.token}: ${trade.profitLossSOL?.toFixed(6)} SOL (${trade.profitLossPercent?.toFixed(2)}%)`);
    });
    
    console.log('========================================');
    console.log('SIMULATION COMPLETE');
    console.log('========================================');
    
    // Save report to file
    this.saveReportToFile(topTrades, worstTrades);
  }
  
  // Save detailed report to file
  private saveReportToFile(topTrades: Trade[], worstTrades: Trade[]): void {
    const closedTrades = this.trades.filter(t => t.status === 'closed');
    const profitableTrades = closedTrades.filter(t => t.profitLossSOL && t.profitLossSOL > 0);
    
    // Create JSON report
    const report = {
      simulation: {
        initialCapitalSOL: this.initialCapital,
        initialCapitalUSD: this.initialCapital * SOL_PRICE_USD,
        finalCapitalSOL: this.capital,
        finalCapitalUSD: this.capital * SOL_PRICE_USD,
        profitLossSOL: this.capital - this.initialCapital,
        profitLossUSD: (this.capital - this.initialCapital) * SOL_PRICE_USD,
        roi: ((this.capital - this.initialCapital) / this.initialCapital) * 100,
        durationMinutes: SIMULATION_MINUTES
      },
      trades: {
        total: this.trades.length,
        completed: closedTrades.length,
        profitable: profitableTrades.length,
        winRate: closedTrades.length > 0 ? (profitableTrades.length / closedTrades.length) * 100 : 0,
        bestTrade: topTrades.length > 0 ? {
          token: topTrades[0].token,
          profitSOL: topTrades[0].profitLossSOL,
          profitPercent: topTrades[0].profitLossPercent
        } : null,
        worstTrade: worstTrades.length > 0 ? {
          token: worstTrades[0].token,
          lossSOL: worstTrades[0].profitLossSOL,
          lossPercent: worstTrades[0].profitLossPercent
        } : null
      },
      tradeHistory: this.trades
    };
    
    try {
      // Create directory if it doesn't exist
      if (!fs.existsSync('./logs')) {
        fs.mkdirSync('./logs');
      }
      
      // Write report to file
      fs.writeFileSync(
        `./logs/enhanced-omega-simulation-${Date.now()}.json`, 
        JSON.stringify(report, null, 2)
      );
      
      console.log('Detailed report saved to logs directory');
    } catch (error) {
      console.error('Error saving report:', error);
    }
  }
}

// Run the simulation
const simulator = new EnhancedQuantumOmegaSniper(1.0, 60);
simulator.runSimulation();