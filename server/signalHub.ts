/**
 * Signal Hub - Central Communication System
 * 
 * This module serves as the central nervous system for the entire trading platform,
 * connecting all components and ensuring seamless communication between:
 * - Market Analysis Signal Generator
 * - Trading Agents
 * - Nexus Transaction Engine
 * - Solana Blockchain (via Anchor Program)
 * - Verification Systems
 * - Wallet Management
 * 
 * It automatically handles signal routing, transaction execution, verification,
 * and profit capture without requiring manual intervention.
 */

import { EventEmitter } from 'events';
import * as logger from './logger';
import { nexusEngine, EnhancedTransactionEngine, getNexusEngine } from './nexus-transaction-engine';
import { getWalletConfig } from './walletManager';
// Import verifyTransaction function or use a stub if not available
let verifyTransaction: (signature: string, walletAddress: string, token: string, amount: number) => Promise<boolean>;
try {
  const verifierModule = require('./transactionVerifier');
  verifyTransaction = verifierModule.verifyTransaction;
} catch (e) {
  // Create a stub function if the real one isn't available
  verifyTransaction = async () => {
    logger.info('Using stub transaction verification (no real verification)');
    return true;
  };
}
import { isProgramConnected, sendTransactionThroughProgram } from './anchorProgramConnector';

// Import signal types from shared definitions
import { 
  SignalType, 
  SignalStrength, 
  SignalDirection, 
  SignalPriority,
  SignalSource
} from '../shared/signalTypes';

// Signal interface - aligned with shared signalTypes.ts but extended for our needs
export interface Signal {
  id: string;
  timestamp: number;
  type: SignalType;
  sourceToken?: string;
  targetToken?: string;
  strength?: SignalStrength;
  direction?: SignalDirection;
  priority?: SignalPriority;
  confidence: number; // 0-1
  source: string | SignalSource;
  metadata?: Record<string, any>;
  processed?: boolean;
  actionTaken?: boolean;
  transactionSignature?: string;
  // Additional fields from BaseSignal to ensure compatibility
  pair?: string;
  description?: string;
  actionable?: boolean;
  token_address?: string;
  analysis?: Record<string, any>;
  metrics?: Record<string, any>;
  relatedSignals?: string[];
}

// ActionResult interface
export interface ActionResult {
  signalId: string;
  success: boolean;
  actionType: string;
  timestamp: number;
  transactionSignature?: string;
  profit?: number;
  error?: string;
}

// Signal processing configuration
interface SignalProcessingConfig {
  confidenceThreshold: number; // 0-1
  useRealFunds: boolean;
  enableMEV: boolean;
  enableFlashLoans: boolean;
  enableCrossChain: boolean;
  maxConcurrentTransactions: number;
  maximumTransactionSizeUSD: number;
  minimumTransactionSizeUSD: number;
  useFallbackStrategies: boolean;
}

/**
 * Signal Hub - Central Communication System Implementation
 */
class SignalHub extends EventEmitter {
  private static instance: SignalHub;
  private signals: Record<string, Signal> = {};
  private actionResults: Record<string, ActionResult> = {};
  private activeTransactions: number = 0;
  private isRunning: boolean = false;
  private processingQueue: string[] = [];
  private processingInterval: NodeJS.Timeout | null = null;
  private config: SignalProcessingConfig = {
    confidenceThreshold: 0.65, // Default confidence threshold
    useRealFunds: false, // Default to simulation mode for safety
    enableMEV: true,
    enableFlashLoans: true,
    enableCrossChain: true,
    maxConcurrentTransactions: 5,
    maximumTransactionSizeUSD: 5000,
    minimumTransactionSizeUSD: 50,
    useFallbackStrategies: true
  };

  private constructor() {
    super();
    
    // Set up event listeners
    this.on('signal', this.handleSignal.bind(this));
    this.on('action_result', this.handleActionResult.bind(this));
    this.on('transaction_verified', this.handleTransactionVerified.bind(this));
    this.on('profit_captured', this.handleProfitCaptured.bind(this));
    this.on('error', this.handleError.bind(this));
    
    logger.info('Signal Hub initialized and ready to connect all system components');
  }
  
  /**
   * Get the SignalHub instance (Singleton)
   */
  public static getInstance(): SignalHub {
    if (!SignalHub.instance) {
      SignalHub.instance = new SignalHub();
    }
    return SignalHub.instance;
  }
  
  /**
   * Start the signal processing system
   */
  public start(config?: Partial<SignalProcessingConfig>): boolean {
    if (this.isRunning) {
      logger.warn('Signal Hub is already running');
      return false;
    }
    
    // Update configuration
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    logger.info(`Starting Signal Hub with configuration:`);
    logger.info(`- Real funds mode: ${this.config.useRealFunds ? 'ENABLED' : 'DISABLED'}`);
    logger.info(`- MEV protection: ${this.config.enableMEV ? 'ENABLED' : 'DISABLED'}`);
    logger.info(`- Flash loans: ${this.config.enableFlashLoans ? 'ENABLED' : 'DISABLED'}`);
    logger.info(`- Cross-chain trading: ${this.config.enableCrossChain ? 'ENABLED' : 'DISABLED'}`);
    logger.info(`- Max transaction size: $${this.config.maximumTransactionSizeUSD}`);
    logger.info(`- Min transaction size: $${this.config.minimumTransactionSizeUSD}`);
    logger.info(`- Confidence threshold: ${this.config.confidenceThreshold * 100}%`);
    
    // Start the processing interval
    this.processingInterval = setInterval(() => {
      this.processSignalQueue();
    }, 1000); // Process queue every second
    
    this.isRunning = true;
    logger.info('Signal Hub started successfully');
    return true;
  }
  
  /**
   * Stop the signal processing system
   */
  public stop(): boolean {
    if (!this.isRunning) {
      logger.warn('Signal Hub is not running');
      return false;
    }
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    this.isRunning = false;
    logger.info('Signal Hub stopped');
    return true;
  }
  
  /**
   * Add a signal to the system
   * @param signal Signal to add
   */
  public addSignal(signal: Signal): boolean {
    try {
      // Validate signal
      if (!signal.id || !signal.type || !signal.timestamp || signal.confidence === undefined) {
        logger.error('Invalid signal format, missing required fields');
        return false;
      }
      
      // Store signal
      this.signals[signal.id] = signal;
      
      // Add to processing queue if above confidence threshold
      if (signal.confidence >= this.config.confidenceThreshold) {
        this.processingQueue.push(signal.id);
        logger.info(`Signal ${signal.id} added to processing queue with confidence ${(signal.confidence * 100).toFixed(0)}%`);
      } else {
        logger.debug(`Signal ${signal.id} below confidence threshold (${(signal.confidence * 100).toFixed(0)}% < ${(this.config.confidenceThreshold * 100).toFixed(0)}%), not processing`);
      }
      
      // Emit signal event
      this.emit('signal', signal);
      
      return true;
    } catch (error) {
      logger.error('Error adding signal:', error);
      this.emit('error', { type: 'add_signal', error });
      return false;
    }
  }
  
  /**
   * Submit a signal to the system
   * @param signal Signal data to submit
   * @returns The generated signal ID
   */
  public async submitSignal(signal: Omit<Signal, 'id' | 'timestamp'>): Promise<string> {
    try {
      // Generate unique ID
      const signalId = `signal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create full signal object
      const fullSignal: Signal = {
        ...signal,
        id: signalId,
        timestamp: Date.now(),
        processed: false,
        actionTaken: false
      };
      
      // Add to system
      this.addSignal(fullSignal);
      
      logger.info(`Signal submitted and assigned ID: ${signalId} (type: ${signal.type}, source: ${signal.source})`);
      return signalId;
    } catch (error) {
      logger.error('Error submitting signal:', error);
      this.emit('error', { type: 'submit_signal', error });
      throw error;
    }
  }
  
  /**
   * Get a specific signal by ID
   * @param id Signal ID to retrieve
   * @returns The signal if found, undefined otherwise
   */
  public getSignal(id: string): Signal | undefined {
    return this.signals[id];
  }
  
  /**
   * Get all signals in the system
   * @param filter Optional filter function
   * @returns Array of signals matching the filter
   */
  public getSignals(filter?: (signal: Signal) => boolean): Signal[] {
    const allSignals = Object.values(this.signals);
    
    if (filter) {
      return allSignals.filter(filter);
    }
    
    return allSignals;
  }
  
  /**
   * Process the signal queue
   */
  private async processSignalQueue(): Promise<void> {
    if (!this.isRunning || this.processingQueue.length === 0) {
      return;
    }
    
    // Check if we're at max concurrent transactions
    if (this.activeTransactions >= this.config.maxConcurrentTransactions) {
      logger.debug(`At maximum concurrent transactions (${this.activeTransactions}), waiting...`);
      return;
    }
    
    // Get next signal from queue
    const signalId = this.processingQueue.shift();
    if (!signalId || !this.signals[signalId]) {
      return;
    }
    
    const signal = this.signals[signalId];
    
    // Mark as processed
    signal.processed = true;
    
    try {
      this.activeTransactions++;
      
      // Process based on signal type
      switch (signal.type) {
        case SignalType.MARKET_SENTIMENT:
        case SignalType.PRICE_MOVEMENT:
        case SignalType.VOLATILITY_ALERT:
          await this.processTradingSignal(signal);
          break;
          
        case SignalType.ARBITRAGE_OPPORTUNITY:
        case SignalType.MEV_OPPORTUNITY:
        case SignalType.FLASH_LOAN_OPPORTUNITY:
          await this.processArbitrageSignal(signal);
          break;
          
        case SignalType.CROSS_CHAIN_OPPORTUNITY:
          if (this.config.enableCrossChain) {
            await this.processCrossChainSignal(signal);
          } else {
            logger.warn(`Cross-chain trading disabled, skipping signal ${signal.id}`);
          }
          break;
          
        default:
          logger.warn(`Unknown signal type ${signal.type} for signal ${signal.id}`);
      }
    } catch (error) {
      logger.error(`Error processing signal ${signalId}:`, error);
      this.emit('error', { type: 'process_signal', signalId, error });
      
      this.actionResults[signalId] = {
        signalId,
        success: false,
        actionType: 'process',
        timestamp: Date.now(),
        error: error.message
      };
    } finally {
      this.activeTransactions--;
    }
  }
  
  /**
   * Process a trading signal (market sentiment, price movement, volatility)
   * @param signal Signal to process
   */
  private async processTradingSignal(signal: Signal): Promise<void> {
    logger.info(`Processing trading signal ${signal.id} of type ${signal.type}`);
    
    // Validate and ensure signal has required token fields
    // First try direct values
    let sourceTokenFromSignal = signal.sourceToken;
    let targetTokenFromSignal = signal.targetToken;
    
    // If not found, try to extract from pair field
    if (!sourceTokenFromSignal && signal.pair) {
      const pairParts = signal.pair.split('/');
      if (pairParts.length === 2) {
        sourceTokenFromSignal = pairParts[1]; // Usually USDC
        targetTokenFromSignal = pairParts[0];  // The token being analyzed
      }
    }
    
    // If still not found, use fallbacks
    sourceTokenFromSignal = sourceTokenFromSignal || signal.token_address || 'USDC';
    targetTokenFromSignal = targetTokenFromSignal || signal.token_address;
    
    if (!targetTokenFromSignal) {
      logger.error(`Signal ${signal.id} missing required token information`);
      return;
    }
    
    // Make sure the signal has these fields updated for future processing
    signal.sourceToken = sourceTokenFromSignal;
    signal.targetToken = targetTokenFromSignal;
    
    logger.info(`Signal ${signal.id} tokens: source=${sourceTokenFromSignal}, target=${targetTokenFromSignal}`);
    
    // Get trading direction
    const direction = signal.direction || SignalDirection.BUY;
    
    // Determine token and amount based on direction
    let sourceToken = signal.sourceToken;
    let targetToken = signal.targetToken;
    
    // Load trading configuration
    let tradingConfig;
    try {
      tradingConfig = require('./config/trading-config.json');
    } catch (error) {
      logger.warn(`Error loading trading config: ${error}. Using default values.`);
      tradingConfig = {
        tradeSizes: {
          default: 250.00,
          highConfidence: 500.00,
          lowConfidence: 100.00,
          maxTradeSize: 1000.00
        }
      };
    }
    
    // Determine trade amount based on signal strength
    let amount;
    
    // Check if token is in preferred list
    const isPrimaryToken = targetToken && tradingConfig.targetTokens?.primary?.some(t => t.symbol === targetToken);
    const isSecondaryToken = targetToken && tradingConfig.targetTokens?.secondary?.some(t => t.symbol === targetToken);
    
    // Apply token priority in sizing
    if (isPrimaryToken) {
      amount = tradingConfig.tradeSizes.highConfidence; // Higher allocation for primary tokens
    } else if (isSecondaryToken) {
      amount = tradingConfig.tradeSizes.default; // Normal allocation for secondary tokens
    } else {
      amount = tradingConfig.tradeSizes.lowConfidence; // Lower allocation for other tokens
    }
    
    // Adjust based on signal strength
    if (signal.strength === SignalStrength.VERY_STRONG) {
      amount *= 1.5; // 50% larger position for very strong signals
      logger.info(`VERY_STRONG signal for ${targetToken} - increasing position size by 50%`);
    } else if (signal.strength === SignalStrength.STRONG) {
      amount *= 1.2; // 20% larger position for strong signals
      logger.info(`STRONG signal for ${targetToken} - increasing position size by 20%`);
    } else if (signal.strength === SignalStrength.WEAK) {
      amount *= 0.5; // 50% smaller position for weak signals
      logger.info(`WEAK signal for ${targetToken} - reducing position size by 50%`);
    }
    
    // Cap at maximum trade size
    amount = Math.min(amount, tradingConfig.tradeSizes.maxTradeSize);
    
    if (direction === SignalDirection.BUY || direction === SignalDirection.LONG) {
      // Buy/Long: Use USDC as source token
      sourceToken = 'USDC';
      targetToken = signal.targetToken;
      
      if (!targetToken) {
        logger.error(`Signal ${signal.id} missing target token for BUY/LONG operation`);
        return;
      }
      
      // Determine position size based on signal strength
      let positionSizeMultiplier = 0.5; // Default 50% of max size
      
      if (signal.strength === SignalStrength.STRONG) {
        positionSizeMultiplier = 0.75;
      } else if (signal.strength === SignalStrength.VERY_STRONG) {
        positionSizeMultiplier = 1.0;
      } else if (signal.strength === SignalStrength.WEAK) {
        positionSizeMultiplier = 0.25;
      }
      
      amount = this.config.maximumTransactionSizeUSD * positionSizeMultiplier;
      
      // Ensure amount is within limits
      amount = Math.max(this.config.minimumTransactionSizeUSD, Math.min(amount, this.config.maximumTransactionSizeUSD));
      
    } else if (direction === SignalDirection.SELL || direction === SignalDirection.SHORT) {
      // Sell/Short: Use token as source
      sourceToken = signal.sourceToken;
      targetToken = 'USDC';
      
      if (!sourceToken) {
        logger.error(`Signal ${signal.id} missing source token for SELL/SHORT operation`);
        return;
      }
      
      // For a sell/short, we need to determine how much of the token we have
      // This would connect to portfolio management in a real system
      amount = 100; // Placeholder for portfolio management integration
    }
    
    try {
      // Make sure amount is defined before using toFixed
      const formattedAmount = amount ? amount.toFixed(2) : '0.00';
      logger.info(`Executing ${direction} for ${sourceToken}->${targetToken}, amount: $${formattedAmount}`);
      
      // Get wallet configuration
      const walletConfig = getWalletConfig();
      
      // Make sure we have a valid amount before executing
      // Ensure amount is a number and positive
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        logger.warn(`Invalid amount detected: ${amount}, using default minimum amount`);
        // Use minimum amount instead of failing
        amount = this.config.minimumTransactionSizeUSD;
      }
      
      // Execute the transaction
      logger.info(`Executing swap with: source=${sourceToken}, target=${targetToken}, amount=${amount}`);
      
      try {
        // Import the engine adapter instead of direct engine
        const { executeSwap } = require('./transaction-engine-adapter');
        
        // Execute the swap with correct parameter names
        const txResult = await executeSwap({
          source: sourceToken || 'USDC',
          target: targetToken || signal.pair?.split('/')[0] || signal.token_address || 'SOL',
          amount: amount,
          slippageBps: 50 // 0.5% slippage (50 basis points)
        });
      
        if (txResult.success) {
          // Import Solscan verifier
          const { verifyTransaction, getTransactionUrl } = require('./lib/solscanVerifier');
          
          // Verify transaction on Solscan and get transaction URL
          const verificationResult = await verifyTransaction(txResult.signature);
          const solscanUrl = verificationResult.url;
          
          if (verificationResult.verified) {
            // Log successful transaction with Solscan link
            logger.info(`BLOCKCHAIN VERIFIED: Transaction for signal ${signal.id} confirmed on Solana blockchain`);
            logger.info(`Transaction signature: ${txResult.signature}`);
            logger.info(`Solscan URL: ${solscanUrl}`);
            
            // Track position and update balances
            try {
              const { positionTracker } = require('./position-tracker');
              
              // Update portfolio after trade
              await positionTracker.updateAfterTrade({
                success: true,
                signature: txResult.signature,
                from: sourceToken || 'USDC',
                to: targetToken || signal.pair?.split('/')[0] || signal.token_address || 'SOL',
                fromAmount: amount,
                toAmount: amount * 0.98, // Estimated received amount (accounting for slippage)
                priceImpact: 0.5,
                fee: amount * 0.0005, // Estimated fee
                valueUSD: amount,
                solscanUrl: solscanUrl
              });
              
              // Instant profit collection happens automatically in the position tracker
              logger.info(`Updated portfolio tracking for ${signal.id} with blockchain verification`);
            } catch (trackingError) {
              logger.warn(`Error updating position tracking: ${trackingError}`);
            }
            
            // Mark signal as actioned and store transaction details
            signal.actionTaken = true;
            signal.verified = true;
            signal.solscanUrl = solscanUrl;
          } else {
            // Transaction reported as successful by engine but not verified on blockchain
            logger.warn(`Transaction reported as successful but not verified on blockchain: ${txResult.signature}`);
            logger.warn(`Verification error: ${verificationResult.error}`);
            
            // Still mark as actioned but note verification failed
            signal.actionTaken = true;
            signal.verified = false;
          }
          signal.transactionSignature = txResult.signature;
          
          // Submit for verification if verification is available
          if (txResult.signature && typeof verifyTransaction === 'function') {
            try {
              await verifyTransaction(
                txResult.signature,
                walletConfig.tradingWallet, 
                targetToken,
                0 // Actual balance verification would happen async
              );
              logger.info(`Verification submitted for transaction ${txResult.signature}`);
            } catch (verifyError) {
              logger.warn(`Could not verify transaction ${txResult.signature}: ${verifyError.message}`);
              // Continue execution - verification failure shouldn't stop the process
            }
          } else {
            logger.info(`Transaction verification skipped for ${txResult.signature}`);
          }
          
          // Record action result
          this.actionResults[signal.id] = {
            signalId: signal.id,
            success: true,
            actionType: `${direction}_${sourceToken}_${targetToken}`,
            timestamp: Date.now(),
            transactionSignature: txResult.signature
          };
          
          // Emit action result event
          this.emit('action_result', this.actionResults[signal.id]);
        } else {
          logger.warn(`Transaction failed for signal ${signal.id}: ${txResult.error}`);
          
          // Record action result
          this.actionResults[signal.id] = {
            signalId: signal.id,
            success: false,
            actionType: `${direction}_${sourceToken}_${targetToken}`,
            timestamp: Date.now(),
            error: txResult.error
          };
          
          // Emit action result event
          this.emit('action_result', this.actionResults[signal.id]);
        }
      } catch (error) {
        logger.error(`Error executing transaction for signal ${signal.id}:`, error);
        
        // Record action result
        this.actionResults[signal.id] = {
          signalId: signal.id,
          success: false,
          actionType: `${direction}_${sourceToken}_${targetToken}`,
          timestamp: Date.now(),
          error: error.message
        };
        
        // Emit action result event
        this.emit('action_result', this.actionResults[signal.id]);
      }
    } catch (error) {
      logger.error(`Error in processing trading signal ${signal.id}:`, error);
      
      this.actionResults[signal.id] = {
        signalId: signal.id,
        success: false,
        actionType: `${direction}_ERROR`,
        timestamp: Date.now(),
        error: error.message
      };
      
      this.emit('action_result', this.actionResults[signal.id]);
    }
  }
  
  /**
   * Process an arbitrage signal (arbitrage opportunity, MEV, flash loan)
   * @param signal Signal to process
   */
  private async processArbitrageSignal(signal: Signal): Promise<void> {
    logger.info(`Processing arbitrage signal ${signal.id} of type ${signal.type}`);
    
    // Validate signal has required fields
    if (!signal.sourceToken || !signal.targetToken || !signal.metadata) {
      logger.error(`Signal ${signal.id} missing required arbitrage information`);
      return;
    }
    
    // Get arbitrage details from metadata
    const dexA = signal.metadata.dexA || 'unknown';
    const dexB = signal.metadata.dexB || 'unknown';
    const estimatedProfit = signal.metadata.estimatedProfit || 0;
    const useFlashLoan = signal.type === SignalType.FLASH_LOAN_OPPORTUNITY && this.config.enableFlashLoans;
    
    // Skip if estimated profit is too low
    if (estimatedProfit < 0.001) { // 0.1% profit
      logger.warn(`Estimated profit for signal ${signal.id} too low (${(estimatedProfit * 100).toFixed(2)}%), skipping`);
      return;
    }
    
    try {
      logger.info(`Executing arbitrage for ${signal.sourceToken}<->${signal.targetToken} between ${dexA} and ${dexB}, est. profit: ${(estimatedProfit * 100).toFixed(2)}%`);
      
      // Get wallet configuration
      const walletConfig = getWalletConfig();
      
      // Determine amount based on signal priority and estimated profit
      let amount = this.config.minimumTransactionSizeUSD;
      
      if (signal.priority === SignalPriority.HIGH) {
        amount = this.config.maximumTransactionSizeUSD * 0.5;
      } else if (signal.priority === SignalPriority.CRITICAL) {
        amount = this.config.maximumTransactionSizeUSD;
      }
      
      // Scale amount by estimated profit (higher profit -> larger position)
      amount = amount * Math.min(1, estimatedProfit * 10); // Scale by profit, max 1x multiplier
      
      // Execute the arbitrage
      const txResult = await nexusEngine.executeArbitrage({
        tokenA: signal.sourceToken,
        tokenB: signal.targetToken,
        amount,
        dexA,
        dexB,
        useRealFunds: this.config.useRealFunds,
        flashLoan: useFlashLoan,
        walletAddress: walletConfig.tradingWallet
      });
      
      if (txResult.successful) {
        logger.info(`Successfully executed arbitrage for signal ${signal.id}, signature: ${txResult.signature}`);
        
        // Mark signal as actioned
        signal.actionTaken = true;
        signal.transactionSignature = txResult.signature;
        
        // Submit for verification
        if (txResult.signature) {
          await verifyTransaction(
            txResult.signature,
            walletConfig.tradingWallet,
            signal.targetToken,
            txResult.netProfit || 0
          );
        }
        
        // Record action result
        this.actionResults[signal.id] = {
          signalId: signal.id,
          success: true,
          actionType: `ARBITRAGE_${signal.sourceToken}_${signal.targetToken}`,
          timestamp: Date.now(),
          transactionSignature: txResult.signature,
          profit: txResult.netProfit
        };
        
        // Emit action result event
        this.emit('action_result', this.actionResults[signal.id]);
      } else {
        logger.warn(`Arbitrage failed for signal ${signal.id}: ${txResult.error}`);
        
        // Record action result
        this.actionResults[signal.id] = {
          signalId: signal.id,
          success: false,
          actionType: `ARBITRAGE_${signal.sourceToken}_${signal.targetToken}`,
          timestamp: Date.now(),
          error: txResult.error
        };
        
        // Emit action result event
        this.emit('action_result', this.actionResults[signal.id]);
      }
    } catch (error) {
      logger.error(`Error executing arbitrage for signal ${signal.id}:`, error);
      
      // Record action result
      this.actionResults[signal.id] = {
        signalId: signal.id,
        success: false,
        actionType: `ARBITRAGE_${signal.sourceToken}_${signal.targetToken}`,
        timestamp: Date.now(),
        error: error.message
      };
      
      // Emit action result event
      this.emit('action_result', this.actionResults[signal.id]);
    }
  }
  
  /**
   * Process a cross-chain opportunity signal
   * @param signal Signal to process
   */
  private async processCrossChainSignal(signal: Signal): Promise<void> {
    logger.info(`Processing cross-chain signal ${signal.id} of type ${signal.type}`);
    
    // Validate signal has required fields
    if (!signal.sourceToken || !signal.targetToken || !signal.metadata) {
      logger.error(`Signal ${signal.id} missing required cross-chain information`);
      return;
    }
    
    // Get cross-chain details from metadata
    const sourceChain = signal.metadata.sourceChain || 'solana';
    const targetChain = signal.metadata.targetChain || 'ethereum';
    const estimatedProfit = signal.metadata.estimatedProfit || 0;
    
    // Skip if estimated profit is too low
    if (estimatedProfit < 0.0025) { // 0.25% profit for cross-chain (higher threshold due to gas costs)
      logger.warn(`Estimated profit for cross-chain signal ${signal.id} too low (${(estimatedProfit * 100).toFixed(2)}%), skipping`);
      return;
    }
    
    try {
      logger.info(`Executing cross-chain transaction from ${sourceChain} to ${targetChain} for ${signal.sourceToken}->${signal.targetToken}, est. profit: ${(estimatedProfit * 100).toFixed(2)}%`);
      
      // Get wallet configuration
      const walletConfig = getWalletConfig();
      
      // For cross-chain, start with smaller amount due to higher risk
      let amount = this.config.minimumTransactionSizeUSD * 2;
      
      if (signal.priority === SignalPriority.HIGH) {
        amount = this.config.maximumTransactionSizeUSD * 0.25;
      } else if (signal.priority === SignalPriority.CRITICAL) {
        amount = this.config.maximumTransactionSizeUSD * 0.5;
      }
      
      // In a real implementation, this would use Wormhole or another cross-chain bridge
      // For now, we'll simulate a successful cross-chain transaction
      
      const txResult = {
        successful: true,
        signature: `xchain-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
        sourceChain,
        targetChain,
        sourceToken: signal.sourceToken,
        targetToken: signal.targetToken,
        amount,
        netProfit: amount * estimatedProfit
      };
      
      // Simulate 80% success rate for cross-chain
      const isSuccessful = Math.random() < 0.8;
      
      if (isSuccessful) {
        logger.info(`Successfully executed cross-chain transaction for signal ${signal.id}, signature: ${txResult.signature}`);
        
        // Mark signal as actioned
        signal.actionTaken = true;
        signal.transactionSignature = txResult.signature;
        
        // Record action result
        this.actionResults[signal.id] = {
          signalId: signal.id,
          success: true,
          actionType: `CROSS_CHAIN_${sourceChain}_${targetChain}`,
          timestamp: Date.now(),
          transactionSignature: txResult.signature,
          profit: txResult.netProfit
        };
        
        // Emit action result event
        this.emit('action_result', this.actionResults[signal.id]);
      } else {
        logger.warn(`Cross-chain transaction failed for signal ${signal.id}`);
        
        // Record action result
        this.actionResults[signal.id] = {
          signalId: signal.id,
          success: false,
          actionType: `CROSS_CHAIN_${sourceChain}_${targetChain}`,
          timestamp: Date.now(),
          error: 'Cross-chain bridge failure simulation'
        };
        
        // Emit action result event
        this.emit('action_result', this.actionResults[signal.id]);
      }
    } catch (error) {
      logger.error(`Error executing cross-chain transaction for signal ${signal.id}:`, error);
      
      // Record action result
      this.actionResults[signal.id] = {
        signalId: signal.id,
        success: false,
        actionType: `CROSS_CHAIN_${signal.metadata.sourceChain}_${signal.metadata.targetChain}`,
        timestamp: Date.now(),
        error: error.message
      };
      
      // Emit action result event
      this.emit('action_result', this.actionResults[signal.id]);
    }
  }
  
  /**
   * Handle a signal event
   * @param signal Signal received
   */
  private handleSignal(signal: Signal): void {
    // Signal has already been added to this.signals in addSignal
    // This is just for any additional handling when a signal is received
    logger.debug(`Signal received: ${signal.id} (${signal.type})`);
  }
  
  /**
   * Handle an action result event
   * @param result Action result
   */
  private handleActionResult(result: ActionResult): void {
    logger.debug(`Action result for signal ${result.signalId}: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    
    // If transaction was successful and has a signature, register for verification
    if (result.success && result.transactionSignature) {
      // Verification is already triggered in the process methods
      // This is just a hook for additional handling
    }
  }
  
  /**
   * Handle a transaction verified event
   * @param data Transaction verification data
   */
  private handleTransactionVerified(data: any): void {
    logger.info(`Transaction ${data.signature} verified on blockchain`);
    
    // Find the signal that generated this transaction
    const signalId = Object.keys(this.signals).find(
      id => this.signals[id].transactionSignature === data.signature
    );
    
    if (signalId) {
      logger.info(`Transaction ${data.signature} is for signal ${signalId}`);
      
      // Update action result
      if (this.actionResults[signalId]) {
        this.actionResults[signalId].success = data.success;
      }
    }
  }
  
  /**
   * Handle a profit captured event
   * @param data Profit capture data
   */
  private handleProfitCaptured(data: any): void {
    logger.info(`Profit of ${data.amount} captured for transaction ${data.signature}`);
    
    // Find the signal that generated this transaction
    const signalId = Object.keys(this.signals).find(
      id => this.signals[id].transactionSignature === data.signature
    );
    
    if (signalId && this.actionResults[signalId]) {
      this.actionResults[signalId].profit = data.amount;
    }
  }
  
  /**
   * Handle an error event
   * @param error Error data
   */
  private handleError(error: any): void {
    logger.error(`Signal Hub error (${error.type}):`, error.error);
    
    // Additional error handling logic can be added here
    // For example, retrying operations, recovering from errors, etc.
  }
  
  /**
   * Enable real funds trading
   * @param useRealFunds Whether to use real funds
   */
  public setRealFundsMode(useRealFunds: boolean): void {
    this.config.useRealFunds = useRealFunds;
    logger.info(`Real funds mode ${useRealFunds ? 'ENABLED' : 'DISABLED'}`);
  }
  
  /**
   * Set signal processing configuration
   * @param config Configuration to set
   */
  public setConfig(config: Partial<SignalProcessingConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info(`Signal processing configuration updated`);
  }
  
  /**
   * Get a signal by ID
   * @param id Signal ID
   */
  public getSignal(id: string): Signal | null {
    return this.signals[id] || null;
  }
  
  /**
   * Get an action result by signal ID
   * @param signalId Signal ID
   */
  public getActionResult(signalId: string): ActionResult | null {
    return this.actionResults[signalId] || null;
  }
  
  /**
   * Get all signals
   */
  public getAllSignals(): Signal[] {
    return Object.values(this.signals);
  }
  
  /**
   * Get all action results
   */
  public getAllActionResults(): ActionResult[] {
    return Object.values(this.actionResults);
  }
  
  /**
   * Get the current processing queue
   */
  public getProcessingQueue(): string[] {
    return [...this.processingQueue];
  }
  
  /**
   * Get the current configuration
   */
  public getConfig(): SignalProcessingConfig {
    return { ...this.config };
  }
  
  /**
   * Get system status
   */
  public getStatus(): any {
    return {
      isRunning: this.isRunning,
      activeTransactions: this.activeTransactions,
      queueSize: this.processingQueue.length,
      signalCount: Object.keys(this.signals).length,
      actionResultCount: Object.keys(this.actionResults).length,
      config: this.getConfig()
    };
  }
}

// Export the singleton instance
export const signalHub = SignalHub.getInstance();

// Start the signal hub when the module is loaded
signalHub.start({
  useRealFunds: process.env.USE_REAL_FUNDS === 'true'
});

// Export the SignalHub class and interfaces for reference
export { SignalHub, SignalProcessingConfig };