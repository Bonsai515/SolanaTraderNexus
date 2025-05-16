/**
 * Capital Amplifier Module
 * 
 * Provides borrowing and flash loan functionality to all nuclear strategies,
 * enabling them to execute larger trades with minimal initial capital.
 */

import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js';
import { getNexusEngine } from '../nexus-transaction-engine';
import * as logger from '../logger';
import { getManagedConnection } from '../lib/rpcConnectionManager';
import * as walletManager from '../walletManager';

// Lending protocols
export enum LendingProtocol {
  SOLEND = 'Solend',
  JET = 'Jet Protocol',
  MANGO = 'Mango Markets',
  KAMINO = 'Kamino Finance',
  DRIFT = 'Drift Protocol'
}

// Flash loan protocols
export enum FlashLoanProtocol {
  SOLEND = 'Solend Flash',
  FLASH_MINT = 'Flash Mint',
  MARINADE = 'Marinade Finance',
  LIGHTNING = 'Lightning Pool'
}

// Borrow request interface
export interface BorrowRequest {
  amount: number;
  token: string;
  collateralAmount?: number;
  collateralToken?: string;
  duration: 'FLASH' | 'SHORT' | 'MEDIUM' | 'LONG';
  purpose: string;
  maxInterestRate?: number;
  protocol?: LendingProtocol;
}

// Borrow result interface
export interface BorrowResult {
  success: boolean;
  address?: string;
  signature?: string;
  amount?: number;
  token?: string;
  protocol?: string;
  interest?: number;
  expirationTime?: number;
  error?: string;
}

// Protocol configuration
interface ProtocolConfig {
  name: string;
  maxLTV: number;
  interestRate: number;
  supportedTokens: string[];
  minBorrowAmount: number;
  maxBorrowAmount: number;
  programId: string;
}

// Capital positions tracker
interface CapitalPosition {
  id: string;
  protocol: string;
  amount: number;
  token: string;
  collateralAmount?: number;
  collateralToken?: string;
  interestRate: number;
  openTime: string;
  expirationTime?: string;
  status: 'OPEN' | 'CLOSED' | 'DEFAULTED';
  signature: string;
}

// Define protocol configurations
const PROTOCOL_CONFIGS: Record<LendingProtocol, ProtocolConfig> = {
  [LendingProtocol.SOLEND]: {
    name: 'Solend',
    maxLTV: 0.85,
    interestRate: 0.035,
    supportedTokens: ['SOL', 'USDC', 'mSOL', 'BTC', 'ETH', 'BONK'],
    minBorrowAmount: 10,
    maxBorrowAmount: 100000,
    programId: 'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo'
  },
  [LendingProtocol.JET]: {
    name: 'Jet Protocol',
    maxLTV: 0.80,
    interestRate: 0.04,
    supportedTokens: ['SOL', 'USDC', 'BTC', 'ETH'],
    minBorrowAmount: 5,
    maxBorrowAmount: 50000,
    programId: 'JPv1rCqrhagNNmJVM5J1he7msQ5ybtvE1nNuHpDHMNU'
  },
  [LendingProtocol.MANGO]: {
    name: 'Mango Markets',
    maxLTV: 0.75,
    interestRate: 0.03,
    supportedTokens: ['SOL', 'USDC', 'BTC', 'ETH', 'MNGO'],
    minBorrowAmount: 20,
    maxBorrowAmount: 200000,
    programId: 'mv3ekLzLbnVPNxjSKvqBpU3ZeZXPQdEC3bp5MDEBG68'
  },
  [LendingProtocol.KAMINO]: {
    name: 'Kamino Finance',
    maxLTV: 0.70,
    interestRate: 0.025,
    supportedTokens: ['SOL', 'USDC', 'JUP', 'BONK'],
    minBorrowAmount: 15,
    maxBorrowAmount: 75000,
    programId: 'Kami6vY3mNAZRRhYxJxC6ENr7RgUcymr8qFynNvpAErx'
  },
  [LendingProtocol.DRIFT]: {
    name: 'Drift Protocol',
    maxLTV: 0.90,
    interestRate: 0.05,
    supportedTokens: ['SOL', 'USDC', 'BTC', 'ETH'],
    minBorrowAmount: 25,
    maxBorrowAmount: 500000,
    programId: 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH'
  }
};

// Flash loan configurations
const FLASH_LOAN_CONFIGS: Record<FlashLoanProtocol, {
  name: string;
  fee: number;
  supportedTokens: string[];
  maxLoanAmount: number;
  programId: string;
}> = {
  [FlashLoanProtocol.SOLEND]: {
    name: 'Solend Flash',
    fee: 0.003,
    supportedTokens: ['SOL', 'USDC', 'mSOL', 'BTC', 'ETH'],
    maxLoanAmount: 500000,
    programId: 'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo'
  },
  [FlashLoanProtocol.FLASH_MINT]: {
    name: 'Flash Mint',
    fee: 0.0025,
    supportedTokens: ['SOL', 'USDC'],
    maxLoanAmount: 300000,
    programId: 'F1aShdTXaxJ7LGq1Qsth eWM1UT6jK5qAUTXAeUmYPg2'
  },
  [FlashLoanProtocol.MARINADE]: {
    name: 'Marinade Finance',
    fee: 0.004,
    supportedTokens: ['SOL', 'mSOL'],
    maxLoanAmount: 200000,
    programId: 'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD'
  },
  [FlashLoanProtocol.LIGHTNING]: {
    name: 'Lightning Pool',
    fee: 0.002,
    supportedTokens: ['SOL', 'USDC', 'BTC', 'ETH'],
    maxLoanAmount: 250000,
    programId: 'LighTRvMzagQDLjdQVjEJZZxXzCDxQNBdoN9H7XKP1c'
  }
};

/**
 * Capital Amplifier class for managing loans and borrowed funds
 */
export class CapitalAmplifier {
  private connection: Connection;
  private initialized: boolean = false;
  private openPositions: CapitalPosition[] = [];
  private totalBorrowed: number = 0;
  private totalFlashLoans: number = 0;
  private totalRepaid: number = 0;
  
  constructor() {
    this.connection = getManagedConnection({ commitment: 'confirmed' });
  }
  
  /**
   * Initialize the capital amplifier
   */
  async initialize(): Promise<boolean> {
    try {
      logger.info('[CapitalAmplifier] Initializing capital amplifier module');
      
      // Check if Nexus engine is available
      const nexusEngine = getNexusEngine();
      if (!nexusEngine) {
        throw new Error('Nexus Pro Engine not available');
      }
      
      // Check wallet balance to ensure we have some collateral
      const walletBalance = await this.getWalletBalance();
      
      if (walletBalance.SOL < 0.1) {
        logger.warn('[CapitalAmplifier] Low SOL balance, some functions may be limited');
      }
      
      this.initialized = true;
      logger.info('[CapitalAmplifier] Capital amplifier initialized successfully');
      
      return true;
    } catch (error) {
      logger.error(`[CapitalAmplifier] Initialization failed: ${error}`);
      return false;
    }
  }
  
  /**
   * Get wallet SOL and token balances
   */
  private async getWalletBalance(): Promise<{ SOL: number; [key: string]: number }> {
    try {
      // Get wallet address
      const walletAddress = walletManager.getTradingWalletAddress();
      const pubkey = new PublicKey(walletAddress);
      
      // Get SOL balance
      const solBalance = await this.connection.getBalance(pubkey);
      
      // In a real implementation, this would also fetch token balances
      // For now, return SOL balance only
      
      return {
        SOL: solBalance / 1000000000 // Convert lamports to SOL
      };
    } catch (error) {
      logger.error(`[CapitalAmplifier] Error getting wallet balance: ${error}`);
      return { SOL: 0 };
    }
  }
  
  /**
   * Execute a flash loan
   */
  async executeFlashLoan(
    token: string,
    amount: number,
    protocol: FlashLoanProtocol = FlashLoanProtocol.SOLEND,
    executionCallback: (loanAddress: string) => Promise<boolean>
  ): Promise<BorrowResult> {
    try {
      logger.info(`[CapitalAmplifier] Executing flash loan for ${amount} ${token} via ${protocol}`);
      
      // Check if initialized
      if (!this.initialized) {
        throw new Error('Capital amplifier not initialized');
      }
      
      // Check protocol constraints
      const protocolConfig = FLASH_LOAN_CONFIGS[protocol];
      
      if (!protocolConfig) {
        throw new Error(`Unknown flash loan protocol: ${protocol}`);
      }
      
      if (!protocolConfig.supportedTokens.includes(token)) {
        throw new Error(`Token ${token} not supported by ${protocol}`);
      }
      
      if (amount > protocolConfig.maxLoanAmount) {
        throw new Error(`Loan amount ${amount} exceeds maximum ${protocolConfig.maxLoanAmount}`);
      }
      
      // In a real implementation, this would execute an actual flash loan transaction
      // through the Nexus Pro Engine and the respective protocol
      
      // For demonstration, create a simulated loan
      const loanAddress = `loan-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      
      // Execute the callback with the loan funds
      const callbackSuccess = await executionCallback(loanAddress);
      
      if (!callbackSuccess) {
        throw new Error('Flash loan execution callback failed');
      }
      
      // Record flash loan usage
      this.totalFlashLoans += amount;
      
      // Generate simulated transaction signature
      const signature = `flash-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      
      logger.info(`[CapitalAmplifier] Flash loan executed successfully: ${signature}`);
      
      return {
        success: true,
        address: loanAddress,
        signature,
        amount,
        token,
        protocol: protocolConfig.name
      };
    } catch (error) {
      logger.error(`[CapitalAmplifier] Flash loan execution failed: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Borrow funds with collateral
   */
  async borrowWithCollateral(request: BorrowRequest): Promise<BorrowResult> {
    try {
      logger.info(`[CapitalAmplifier] Borrowing ${request.amount} ${request.token} with collateral`);
      
      // Check if initialized
      if (!this.initialized) {
        throw new Error('Capital amplifier not initialized');
      }
      
      // Default to SOLEND if no protocol specified
      const protocol = request.protocol || LendingProtocol.SOLEND;
      const protocolConfig = PROTOCOL_CONFIGS[protocol];
      
      if (!protocolConfig) {
        throw new Error(`Unknown lending protocol: ${protocol}`);
      }
      
      if (!protocolConfig.supportedTokens.includes(request.token)) {
        throw new Error(`Token ${request.token} not supported by ${protocol}`);
      }
      
      if (request.amount < protocolConfig.minBorrowAmount || 
          request.amount > protocolConfig.maxBorrowAmount) {
        throw new Error(`Borrow amount ${request.amount} outside of allowed range`);
      }
      
      // Get wallet balance for collateral verification
      const walletBalance = await this.getWalletBalance();
      
      // Default to SOL as collateral if not specified
      const collateralToken = request.collateralToken || 'SOL';
      
      // Calculate required collateral based on max LTV
      const requiredCollateral = (request.amount / protocolConfig.maxLTV) * 1.05; // 5% buffer
      
      // If collateral amount not specified, use the calculated amount
      const collateralAmount = request.collateralAmount || requiredCollateral;
      
      // Check if we have enough collateral
      if ((walletBalance[collateralToken] || 0) < collateralAmount) {
        throw new Error(`Insufficient ${collateralToken} for collateral`);
      }
      
      // In a real implementation, this would execute an actual borrow transaction
      // through the Nexus Pro Engine and the respective protocol
      
      // For demonstration, create a simulated position
      const positionId = `pos-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      const signature = `borrow-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      
      // Calculate duration in days
      let durationDays = 1; // Default to 1 day
      
      switch (request.duration) {
        case 'SHORT':
          durationDays = 7;
          break;
        case 'MEDIUM':
          durationDays = 30;
          break;
        case 'LONG':
          durationDays = 90;
          break;
      }
      
      // Create position
      const now = new Date();
      const expirationTime = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
      
      const position: CapitalPosition = {
        id: positionId,
        protocol: protocolConfig.name,
        amount: request.amount,
        token: request.token,
        collateralAmount,
        collateralToken,
        interestRate: protocolConfig.interestRate,
        openTime: now.toISOString(),
        expirationTime: expirationTime.toISOString(),
        status: 'OPEN',
        signature
      };
      
      // Add to open positions
      this.openPositions.push(position);
      
      // Track total borrowed
      this.totalBorrowed += request.amount;
      
      logger.info(`[CapitalAmplifier] Borrowed ${request.amount} ${request.token} successfully: ${signature}`);
      
      return {
        success: true,
        address: positionId,
        signature,
        amount: request.amount,
        token: request.token,
        protocol: protocolConfig.name,
        interest: protocolConfig.interestRate,
        expirationTime: expirationTime.getTime()
      };
    } catch (error) {
      logger.error(`[CapitalAmplifier] Borrowing failed: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Repay a loan
   */
  async repayLoan(positionId: string, amount?: number): Promise<boolean> {
    try {
      logger.info(`[CapitalAmplifier] Repaying loan for position ${positionId}`);
      
      // Find the position
      const positionIndex = this.openPositions.findIndex(p => p.id === positionId);
      
      if (positionIndex === -1) {
        throw new Error(`Position ${positionId} not found`);
      }
      
      const position = this.openPositions[positionIndex];
      
      // Default to full repayment if amount not specified
      const repayAmount = amount || position.amount;
      
      if (repayAmount > position.amount) {
        throw new Error(`Repay amount ${repayAmount} exceeds borrowed amount ${position.amount}`);
      }
      
      // Get wallet balance
      const walletBalance = await this.getWalletBalance();
      
      // Check if we have enough funds to repay
      if ((walletBalance[position.token] || 0) < repayAmount) {
        throw new Error(`Insufficient ${position.token} to repay loan`);
      }
      
      // In a real implementation, this would execute an actual repayment transaction
      // through the Nexus Pro Engine and the respective protocol
      
      // For demonstration, update the position
      if (repayAmount === position.amount) {
        // Full repayment, close the position
        position.status = 'CLOSED';
      } else {
        // Partial repayment, update the position
        position.amount -= repayAmount;
      }
      
      // Update open positions
      this.openPositions[positionIndex] = position;
      
      // Track total repaid
      this.totalRepaid += repayAmount;
      
      logger.info(`[CapitalAmplifier] Repaid ${repayAmount} ${position.token} for position ${positionId}`);
      
      return true;
    } catch (error) {
      logger.error(`[CapitalAmplifier] Repayment failed: ${error}`);
      return false;
    }
  }
  
  /**
   * Get optimal capital source for a strategy
   */
  async getOptimalCapitalSource(
    token: string,
    amount: number,
    profitPercent: number,
    maxRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM'
  ): Promise<{
    method: 'FLASH_LOAN' | 'COLLATERALIZED_LOAN' | 'DIRECT';
    protocol?: string;
    maxAmount: number;
    estimatedCost: number;
  }> {
    try {
      logger.info(`[CapitalAmplifier] Finding optimal capital source for ${amount} ${token} with ${profitPercent}% profit`);
      
      // Check wallet balance
      const walletBalance = await this.getWalletBalance();
      
      // Convert token to SOL value for simplicity
      // In a real implementation, this would use actual token prices
      const tokenToSolRate = token === 'SOL' ? 1 : token === 'USDC' ? 1/60 : 0.0001;
      const amountInSol = amount * tokenToSolRate;
      
      // Check if we have enough funds directly
      const solBalance = walletBalance.SOL || 0;
      const tokenBalance = walletBalance[token] || 0;
      const tokenBalanceInSol = tokenBalance * tokenToSolRate;
      
      const totalAvailableInSol = solBalance + tokenBalanceInSol;
      
      // First priority: Use flash loan if profit exceeds fee
      const bestFlashLoan = this.findBestFlashLoanProtocol(token, amount, profitPercent);
      
      if (bestFlashLoan && profitPercent > bestFlashLoan.fee * 100) {
        return {
          method: 'FLASH_LOAN',
          protocol: bestFlashLoan.protocol,
          maxAmount: bestFlashLoan.maxAmount,
          estimatedCost: amount * bestFlashLoan.fee
        };
      }
      
      // Second priority: Use direct balance if available
      if (tokenBalance >= amount || totalAvailableInSol >= amountInSol) {
        return {
          method: 'DIRECT',
          maxAmount: Math.min(amount, tokenBalance),
          estimatedCost: 0
        };
      }
      
      // Third priority: Use collateralized loan
      const bestLoan = this.findBestLendingProtocol(token, amount, maxRisk);
      
      if (bestLoan) {
        const collateralNeeded = (amount / bestLoan.maxLTV) * 1.05; // 5% buffer
        const collateralNeededInSol = collateralNeeded * tokenToSolRate;
        
        if (solBalance >= collateralNeededInSol) {
          return {
            method: 'COLLATERALIZED_LOAN',
            protocol: bestLoan.protocol,
            maxAmount: bestLoan.maxAmount,
            estimatedCost: amount * bestLoan.interestRate * (7/365) // Assuming 7-day loan
          };
        }
      }
      
      // Fallback: Use direct with maximum available
      return {
        method: 'DIRECT',
        maxAmount: tokenBalance,
        estimatedCost: 0
      };
    } catch (error) {
      logger.error(`[CapitalAmplifier] Error finding optimal capital source: ${error}`);
      
      // Safe fallback
      return {
        method: 'DIRECT',
        maxAmount: 0,
        estimatedCost: 0
      };
    }
  }
  
  /**
   * Find the best flash loan protocol for a particular token and amount
   */
  private findBestFlashLoanProtocol(
    token: string, 
    amount: number, 
    profitPercent: number
  ): { protocol: string; fee: number; maxAmount: number } | null {
    try {
      // Find eligible protocols
      const eligibleProtocols = Object.entries(FLASH_LOAN_CONFIGS)
        .filter(([_, config]) => 
          config.supportedTokens.includes(token) && 
          config.maxLoanAmount >= amount &&
          config.fee * 100 < profitPercent // Fee must be less than profit
        )
        .map(([key, config]) => ({
          protocol: config.name,
          fee: config.fee,
          maxAmount: config.maxLoanAmount
        }));
      
      if (eligibleProtocols.length === 0) {
        return null;
      }
      
      // Sort by lowest fee
      eligibleProtocols.sort((a, b) => a.fee - b.fee);
      
      return eligibleProtocols[0];
    } catch (error) {
      logger.error(`[CapitalAmplifier] Error finding flash loan protocol: ${error}`);
      return null;
    }
  }
  
  /**
   * Find the best lending protocol based on token and risk tolerance
   */
  private findBestLendingProtocol(
    token: string,
    amount: number,
    maxRisk: 'LOW' | 'MEDIUM' | 'HIGH'
  ): { protocol: string; maxLTV: number; interestRate: number; maxAmount: number } | null {
    try {
      // Define risk levels for maximum LTV
      const maxLtvByRisk = {
        'LOW': 0.7,
        'MEDIUM': 0.8,
        'HIGH': 0.9
      };
      
      // Find eligible protocols
      const eligibleProtocols = Object.entries(PROTOCOL_CONFIGS)
        .filter(([_, config]) => 
          config.supportedTokens.includes(token) &&
          config.maxLTV <= maxLtvByRisk[maxRisk] &&
          config.minBorrowAmount <= amount &&
          config.maxBorrowAmount >= amount
        )
        .map(([key, config]) => ({
          protocol: config.name,
          maxLTV: config.maxLTV,
          interestRate: config.interestRate,
          maxAmount: config.maxBorrowAmount
        }));
      
      if (eligibleProtocols.length === 0) {
        return null;
      }
      
      // For low risk, sort by lowest LTV
      // For medium risk, balance LTV and interest
      // For high risk, optimize for highest LTV
      
      switch (maxRisk) {
        case 'LOW':
          eligibleProtocols.sort((a, b) => a.maxLTV - b.maxLTV);
          break;
        case 'MEDIUM':
          eligibleProtocols.sort((a, b) => 
            (a.interestRate * 2 + a.maxLTV) - (b.interestRate * 2 + b.maxLTV));
          break;
        case 'HIGH':
          eligibleProtocols.sort((a, b) => b.maxLTV - a.maxLTV);
          break;
      }
      
      return eligibleProtocols[0];
    } catch (error) {
      logger.error(`[CapitalAmplifier] Error finding lending protocol: ${error}`);
      return null;
    }
  }
  
  /**
   * Get open positions
   */
  getOpenPositions(): CapitalPosition[] {
    return this.openPositions.filter(p => p.status === 'OPEN');
  }
  
  /**
   * Get capital usage statistics
   */
  getStats(): {
    totalBorrowed: number;
    totalFlashLoans: number;
    totalRepaid: number;
    openPositionsCount: number;
    outstandingDebt: number;
  } {
    const openPositions = this.getOpenPositions();
    const outstandingDebt = openPositions.reduce((sum, pos) => sum + pos.amount, 0);
    
    return {
      totalBorrowed: this.totalBorrowed,
      totalFlashLoans: this.totalFlashLoans,
      totalRepaid: this.totalRepaid,
      openPositionsCount: openPositions.length,
      outstandingDebt
    };
  }
}

// Singleton instance
let amplifier: CapitalAmplifier;

/**
 * Get or create the capital amplifier
 */
export async function getCapitalAmplifier(): Promise<CapitalAmplifier> {
  if (!amplifier) {
    amplifier = new CapitalAmplifier();
    await amplifier.initialize();
  }
  
  return amplifier;
}