/**
 * Lending Protocols Module
 * 
 * Provides integration with Solana-based lending protocols for borrowing,
 * lending, and leveraged trading operations.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { logger } from '../logger';
import { LendingProtocolType } from '../dexInfo';

interface Protocol {
  id: string;
  name: string;
  website: string;
  description: string;
  active: boolean;
  chains: string[];
  supportedAssets: string[];
  minLoanAmount: number;
}

interface LendingRate {
  asset: string;
  supplyAPY: number;
  borrowAPY: number;
  utilizationRate: number;
  timestamp: number;
}

interface LoanPosition {
  protocol: string;
  asset: string;
  amount: number;
  collateral: {
    asset: string;
    amount: number;
  };
  healthFactor: number;
  interestRate: number;
  liquidationThreshold: number;
  openedAt: number;
}

class LendingProtocolManager {
  private connection: Connection;
  private protocols: Map<string, Protocol> = new Map();
  private rates: Map<string, Map<string, LendingRate>> = new Map();
  private positions: Map<string, LoanPosition[]> = new Map(); // wallet -> positions
  private updateInterval: NodeJS.Timeout | null = null;
  
  constructor(connection: Connection) {
    this.connection = connection;
    
    // Initialize protocols
    this.initializeProtocols();
  }
  
  /**
   * Initialize supported lending protocols
   */
  private initializeProtocols() {
    const protocolsList: Protocol[] = [
      {
        id: LendingProtocolType.MarginFi,
        name: 'MarginFi',
        website: 'https://marginfi.com',
        description: 'MarginFi is a decentralized lending and borrowing protocol on Solana.',
        active: true,
        chains: ['solana'],
        supportedAssets: ['SOL', 'USDC', 'ETH', 'BTC', 'mSOL', 'jitoSOL', 'BONK'],
        minLoanAmount: 10
      },
      {
        id: LendingProtocolType.Kamino,
        name: 'Kamino Finance',
        website: 'https://kamino.finance',
        description: 'Automated liquidity management and yield generation protocol on Solana.',
        active: true,
        chains: ['solana'],
        supportedAssets: ['SOL', 'USDC', 'USDT', 'ETH', 'STSOL', 'MSOL'],
        minLoanAmount: 5
      },
      {
        id: LendingProtocolType.Mercurial,
        name: 'Mercurial',
        website: 'https://mercurial.finance',
        description: 'DeFi ecosystem focusing on trading, yield, and payments on Solana.',
        active: true,
        chains: ['solana'],
        supportedAssets: ['SOL', 'USDC', 'USDT', 'ETH'],
        minLoanAmount: 1
      },
      {
        id: LendingProtocolType.Jet,
        name: 'Jet Protocol',
        website: 'https://jetprotocol.io',
        description: 'Decentralized lending platform with multiple pools on Solana.',
        active: true,
        chains: ['solana'],
        supportedAssets: ['SOL', 'USDC', 'USDT', 'ETH', 'BTC', 'mSOL'],
        minLoanAmount: 10
      },
      {
        id: LendingProtocolType.Bolt,
        name: 'Bolt',
        website: 'https://bolt.com',
        description: 'Leveraged trading and lending protocol with DeFi integration.',
        active: true,
        chains: ['solana'],
        supportedAssets: ['SOL', 'USDC', 'USDT', 'ETH', 'BTC'],
        minLoanAmount: 5
      }
    ];
    
    for (const protocol of protocolsList) {
      this.protocols.set(protocol.id, protocol);
      this.rates.set(protocol.id, new Map());
    }
    
    logger.info(`Initialized ${this.protocols.size} lending protocols`);
  }
  
  /**
   * Start the rate update mechanism
   */
  public startRateUpdates(intervalMs = 60000) {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    // Initial update
    this.updateAllRates();
    
    // Schedule regular updates
    this.updateInterval = setInterval(() => {
      this.updateAllRates();
    }, intervalMs);
    
    logger.info(`Started lending protocol rate updates every ${intervalMs}ms`);
  }
  
  /**
   * Stop rate updates
   */
  public stopRateUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      logger.info('Stopped lending protocol rate updates');
    }
  }
  
  /**
   * Update rates for all protocols and assets
   */
  private async updateAllRates() {
    try {
      for (const protocol of this.protocols.values()) {
        if (!protocol.active) continue;
        
        for (const asset of protocol.supportedAssets) {
          await this.updateRate(protocol.id, asset);
        }
      }
    } catch (error) {
      logger.error('Error updating lending protocol rates:', error);
    }
  }
  
  /**
   * Update rate for a specific protocol and asset
   */
  private async updateRate(protocolId: string, asset: string) {
    try {
      // Here, we'd make an API call to the protocol or use a smart contract
      // to fetch the current rate. For demonstration purposes, we use a
      // realistic model based on protocol and asset with some randomness.
      
      const now = Date.now();
      const baseSupplyAPY = this.getBaseSupplyAPY(protocolId, asset);
      const baseBorrowAPY = baseSupplyAPY * 1.5; // Borrow rate is typically higher
      const utilizationRate = 0.5 + (Math.random() * 0.3); // 50-80% utilization
      
      // Apply some market volatility to the rates
      const volatility = 0.02; // 2% volatility
      const supplyAPY = baseSupplyAPY * (1 + (Math.random() * volatility * 2 - volatility));
      const borrowAPY = baseBorrowAPY * (1 + (Math.random() * volatility * 2 - volatility));
      
      const rate: LendingRate = {
        asset,
        supplyAPY,
        borrowAPY,
        utilizationRate,
        timestamp: now
      };
      
      // Store the rate
      if (!this.rates.has(protocolId)) {
        this.rates.set(protocolId, new Map());
      }
      
      this.rates.get(protocolId)!.set(asset, rate);
      
    } catch (error) {
      logger.error(`Error updating rate for ${protocolId}/${asset}:`, error);
    }
  }
  
  /**
   * Get base supply APY for a protocol and asset (realistic model)
   */
  private getBaseSupplyAPY(protocolId: string, asset: string): number {
    // Returns realistic APY values for different assets and protocols
    const baseRates: Record<string, Record<string, number>> = {
      [LendingProtocolType.MarginFi]: {
        'SOL': 0.03, // 3%
        'USDC': 0.045, // 4.5%
        'ETH': 0.0325, // 3.25%
        'BTC': 0.0315, // 3.15%
        'mSOL': 0.06, // 6%
        'jitoSOL': 0.065, // 6.5%
        'BONK': 0.12 // 12%
      },
      [LendingProtocolType.Kamino]: {
        'SOL': 0.035, // 3.5%
        'USDC': 0.05, // 5%
        'USDT': 0.048, // 4.8%
        'ETH': 0.034, // 3.4%
        'STSOL': 0.064, // 6.4%
        'MSOL': 0.062 // 6.2%
      },
      [LendingProtocolType.Mercurial]: {
        'SOL': 0.033, // 3.3%
        'USDC': 0.047, // 4.7%
        'USDT': 0.045, // 4.5%
        'ETH': 0.032 // 3.2%
      },
      [LendingProtocolType.Jet]: {
        'SOL': 0.034, // 3.4%
        'USDC': 0.052, // 5.2%
        'USDT': 0.05, // 5%
        'ETH': 0.0335, // 3.35%
        'BTC': 0.0325, // 3.25%
        'mSOL': 0.063 // 6.3%
      },
      [LendingProtocolType.Bolt]: {
        'SOL': 0.036, // 3.6%
        'USDC': 0.053, // 5.3%
        'USDT': 0.051, // 5.1%
        'ETH': 0.0345, // 3.45%
        'BTC': 0.0335 // 3.35%
      }
    };
    
    // If we have a specific rate, use it; otherwise use a default
    if (baseRates[protocolId] && baseRates[protocolId][asset]) {
      return baseRates[protocolId][asset];
    }
    
    // Default rates for assets
    const defaultRates: Record<string, number> = {
      'SOL': 0.035,
      'USDC': 0.05,
      'USDT': 0.048,
      'ETH': 0.033,
      'BTC': 0.032,
      'mSOL': 0.062,
      'jitoSOL': 0.064,
      'STSOL': 0.063,
      'BONK': 0.11
    };
    
    return defaultRates[asset] || 0.04; // 4% as fallback
  }
  
  /**
   * Get all supported protocols
   */
  public getProtocols(): Protocol[] {
    return Array.from(this.protocols.values());
  }
  
  /**
   * Get a specific protocol by ID
   */
  public getProtocol(id: string): Protocol | undefined {
    return this.protocols.get(id);
  }
  
  /**
   * Get all current rates for a protocol
   */
  public getRates(protocolId: string): Map<string, LendingRate> | undefined {
    return this.rates.get(protocolId);
  }
  
  /**
   * Get rate for a specific protocol and asset
   */
  public getRate(protocolId: string, asset: string): LendingRate | undefined {
    return this.rates.get(protocolId)?.get(asset);
  }
  
  /**
   * Get best supply rate for a given asset across all protocols
   */
  public getBestSupplyRate(asset: string): { protocolId: string, rate: LendingRate } | undefined {
    let bestRate: LendingRate | undefined;
    let bestProtocolId: string | undefined;
    
    for (const [protocolId, assetRates] of this.rates.entries()) {
      const rate = assetRates.get(asset);
      if (rate && (!bestRate || rate.supplyAPY > bestRate.supplyAPY)) {
        bestRate = rate;
        bestProtocolId = protocolId;
      }
    }
    
    if (bestRate && bestProtocolId) {
      return { protocolId: bestProtocolId, rate: bestRate };
    }
    
    return undefined;
  }
  
  /**
   * Get best borrow rate for a given asset across all protocols
   */
  public getBestBorrowRate(asset: string): { protocolId: string, rate: LendingRate } | undefined {
    let bestRate: LendingRate | undefined;
    let bestProtocolId: string | undefined;
    
    for (const [protocolId, assetRates] of this.rates.entries()) {
      const rate = assetRates.get(asset);
      if (rate && (!bestRate || rate.borrowAPY < bestRate.borrowAPY)) {
        bestRate = rate;
        bestProtocolId = protocolId;
      }
    }
    
    if (bestRate && bestProtocolId) {
      return { protocolId: bestProtocolId, rate: bestRate };
    }
    
    return undefined;
  }
  
  /**
   * Open a loan position
   */
  public async openLoanPosition(
    protocolId: string,
    walletAddress: string,
    asset: string,
    amount: number,
    collateralAsset: string,
    collateralAmount: number
  ): Promise<LoanPosition | undefined> {
    try {
      const protocol = this.protocols.get(protocolId);
      
      if (!protocol) {
        throw new Error(`Protocol ${protocolId} not found`);
      }
      
      if (!protocol.active) {
        throw new Error(`Protocol ${protocolId} is not active`);
      }
      
      if (amount < protocol.minLoanAmount) {
        throw new Error(`Loan amount ${amount} is below minimum ${protocol.minLoanAmount}`);
      }
      
      // Check if the protocol supports the asset
      if (!protocol.supportedAssets.includes(asset)) {
        throw new Error(`Asset ${asset} not supported by protocol ${protocolId}`);
      }
      
      // Check if the protocol supports the collateral asset
      if (!protocol.supportedAssets.includes(collateralAsset)) {
        throw new Error(`Collateral asset ${collateralAsset} not supported by protocol ${protocolId}`);
      }
      
      // Get the current borrow rate
      const rateInfo = this.getRate(protocolId, asset);
      if (!rateInfo) {
        throw new Error(`Rate information for ${asset} not available`);
      }
      
      // Calculate health factor based on collateral value and loan amount
      // This is a simplified model - real protocols would use oracle prices
      const collateralFactor = this.getCollateralFactor(collateralAsset);
      const collateralValue = this.getAssetValue(collateralAsset, collateralAmount);
      const loanValue = this.getAssetValue(asset, amount);
      
      const healthFactor = (collateralValue * collateralFactor) / loanValue;
      
      if (healthFactor < 1.2) {
        throw new Error(`Health factor ${healthFactor.toFixed(2)} is too low, minimum 1.2 required`);
      }
      
      // Create the loan position
      const position: LoanPosition = {
        protocol: protocolId,
        asset,
        amount,
        collateral: {
          asset: collateralAsset,
          amount: collateralAmount
        },
        healthFactor,
        interestRate: rateInfo.borrowAPY,
        liquidationThreshold: collateralFactor * 0.95, // Typically slightly lower than collateral factor
        openedAt: Date.now()
      };
      
      // Store the position
      if (!this.positions.has(walletAddress)) {
        this.positions.set(walletAddress, []);
      }
      
      this.positions.get(walletAddress)!.push(position);
      
      logger.info(`Opened loan position on ${protocolId} for ${amount} ${asset} with ${collateralAmount} ${collateralAsset} collateral`);
      
      return position;
      
    } catch (error) {
      logger.error(`Error opening loan position on ${protocolId}:`, error);
      return undefined;
    }
  }
  
  /**
   * Get collateral factor for an asset (simplified model)
   */
  private getCollateralFactor(asset: string): number {
    // Different assets have different collateral factors based on their volatility
    const factors: Record<string, number> = {
      'USDC': 0.9, // 90%
      'USDT': 0.85, // 85%
      'SOL': 0.7, // 70%
      'ETH': 0.75, // 75%
      'BTC': 0.75, // 75%
      'mSOL': 0.65, // 65%
      'jitoSOL': 0.65, // 65%
      'STSOL': 0.65, // 65%
      'BONK': 0.3 // 30%
    };
    
    return factors[asset] || 0.5; // 50% as default
  }
  
  /**
   * Get asset value in USD (simplified model)
   */
  private getAssetValue(asset: string, amount: number): number {
    // Mock USD prices - in a real system, these would come from oracles
    const prices: Record<string, number> = {
      'USDC': 1.0,
      'USDT': 1.0,
      'SOL': 156.85,
      'ETH': 3450.25,
      'BTC': 49785.12,
      'mSOL': 164.25,
      'jitoSOL': 165.10,
      'STSOL': 163.95,
      'BONK': 0.00002145
    };
    
    return (prices[asset] || 1.0) * amount;
  }
  
  /**
   * Get all loan positions for a wallet
   */
  public getPositions(walletAddress: string): LoanPosition[] {
    return this.positions.get(walletAddress) || [];
  }
  
  /**
   * Close a loan position
   */
  public async closeLoanPosition(walletAddress: string, positionIndex: number): Promise<boolean> {
    try {
      const positions = this.positions.get(walletAddress);
      
      if (!positions || positionIndex >= positions.length) {
        throw new Error(`Position not found for wallet ${walletAddress} at index ${positionIndex}`);
      }
      
      const position = positions[positionIndex];
      
      // Here we would interact with the protocol to close the position
      // For now, we'll just remove it from our tracking
      
      positions.splice(positionIndex, 1);
      
      logger.info(`Closed loan position on ${position.protocol} for ${position.amount} ${position.asset}`);
      
      return true;
      
    } catch (error) {
      logger.error(`Error closing loan position:`, error);
      return false;
    }
  }
}

// Export a singleton instance
let lendingManager: LendingProtocolManager | null = null;

export function getLendingProtocolManager(connection?: Connection): LendingProtocolManager {
  if (!lendingManager && connection) {
    lendingManager = new LendingProtocolManager(connection);
  } else if (!lendingManager) {
    throw new Error('Lending protocol manager not initialized');
  }
  
  return lendingManager;
}