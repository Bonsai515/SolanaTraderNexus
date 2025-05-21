/**
 * Signal Hub - Central Signal Processing System
 * 
 * This module connects transformers with AI agents and the Nexus engine,
 * providing real-time trading signals with entry and exit points.
 */

import * as logger from './logger';
import { EventEmitter } from 'events';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { getManagedConnection } from './lib/rpcConnectionManager';
import { getNexusEngine } from './nexus-transaction-engine';

// Signal types
export enum SignalType {
  ENTRY = 'entry',
  EXIT = 'exit',
  REBALANCE = 'rebalance',
  FLASH_OPPORTUNITY = 'flash_opportunity',
  CROSS_CHAIN = 'cross_chain',
  MARKET_SENTIMENT = 'market_sentiment',  // Added for market analysis
  ARBITRAGE_OPPORTUNITY = 'arbitrage_opportunity', // Added for arbitrage
  VOLATILITY_ALERT = 'volatility_alert'   // Added for volatility alerts
}

export enum SignalStrength {
  LOW = 'low',        // 0-30%
  MEDIUM = 'medium',  // 31-70%
  HIGH = 'high',      // 71-90%
  EXTREME = 'extreme', // 91-100%
  WEAK = 'weak',      // Added for market signals
  STRONG = 'strong'   // Added for market signals
}

// Add these enums for market analysis signals
export enum SignalDirection {
  BULLISH = 'bullish',
  BEARISH = 'bearish',
  NEUTRAL = 'neutral',
  SLIGHTLY_BULLISH = 'slightly_bullish',
  SLIGHTLY_BEARISH = 'slightly_bearish'
}

export enum SignalPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum SignalSource {
  TRANSFORMER = 'transformer',
  AGENT = 'agent',
  ENGINE = 'engine',
  PERPLEXITY_AI = 'perplexity_ai',
  LOCAL_ANALYSIS = 'local_analysis'
}

// Define the transformer signal interface
export interface TransformerSignal {
  id: string;
  timestamp: number;
  transformer: string;
  type: SignalType;
  confidence: number;
  strength: SignalStrength;
  timeframe: SignalTimeframe;
  action: 'buy' | 'sell' | 'swap' | 'borrow' | 'flash_loan';
  sourceToken: string;
  targetToken: string;
  sourceAmount?: number;
  targetAmount?: number;
  entryPriceUsd?: number;
  targetPriceUsd?: number;
  stopLossUsd?: number;
  dex?: string;
  flashLoan?: boolean;
  crossChain?: boolean;
  leverage?: number;
  description?: string;
  metadata?: any;
}

// Create a singleton signal hub class
class SignalHub {
  private signals: Map<string, TransformerSignal> = new Map();
  private eventEmitter: EventEmitter = new EventEmitter();

  constructor() {
    this.eventEmitter.setMaxListeners(50);
  }

  /**
   * Submit a new signal
   * @param signal The signal to submit
   * @returns The signal ID
   */
  public async submitSignal(signal: any): Promise<string> {
    try {
      // Generate ID if not provided
      const signalId = signal.id || `signal_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

      // Ensure ID is assigned to signal
      signal.id = signalId;

      // Store signal
      this.signals.set(signalId, signal);

      // Log signal submission
      logger.info(`[SignalHub] Signal submitted: ${signalId} (${signal.type}) - ${signal.sourceToken} → ${signal.targetToken}`);

      // Emit signal events
      this.eventEmitter.emit('signal', signal);
      this.eventEmitter.emit(`signal:${signal.type}`, signal);

      return signalId;
    } catch (error) {
      logger.error(`[SignalHub] Error submitting signal: ${error}`);
      return '';
    }
  }

  /**
   * Get a signal by ID
   * @param id The signal ID
   * @returns The signal if found, undefined otherwise
   */
  public getSignal(id: string): TransformerSignal | undefined {
    return this.signals.get(id);
  }

  /**
   * Get recent signals
   * @param limit Maximum number of signals to return
   * @returns Array of recent signals
   */
  public getRecentSignals(limit: number = 10): TransformerSignal[] {
    return Array.from(this.signals.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Listen for new signals
   * @param callback Callback function to handle new signals
   * @returns Function to remove the listener
   */
  public onSignal(callback: (signal: TransformerSignal) => void): () => void {
    this.eventEmitter.on('signal', callback);
    return () => this.eventEmitter.off('signal', callback);
  }

  /**
   * Listen for signals of a specific type
   * @param type Signal type to listen for
   * @param callback Callback function to handle signals
   * @returns Function to remove the listener
   */
  public onSignalType(type: SignalType, callback: (signal: TransformerSignal) => void): () => void {
    this.eventEmitter.on(`signal:${type}`, callback);
    return () => this.eventEmitter.off(`signal:${type}`, callback);
  }
}

// Export singleton instance
export const signalHub = new SignalHub();

export enum SignalTimeframe {
  IMMEDIATE = 'immediate',  // Execute immediately
  SHORT = 'short',          // Minutes
  MEDIUM = 'medium',        // Hours
  LONG = 'long'             // Days
}

// Token address mapping for commonly used tokens
const TOKEN_ADDRESSES: Record<string, string> = {
  'SOL': 'So11111111111111111111111111111111111111112',
  'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'BONK': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  'JUP': '7LmGzEgnXfPTkNpGHCNpnxJA2PecbQS5aHHXumP2RdQA',
  'MEME': 'METAmTMXwdb8gYzyCPfXXFmZZw4rUsXX58PNsDg7zjL',
  'GUAC': 'Lv5djULSugMxj9Zs1SN6KvAfjY5c9iN2JUxKxuYMFAk',
  'WIF': '8wmKcoG4Hv3p9j6tQFs8VdgQzMLY78PwJ2R93bmA3YL'
};

// Transform DEX info for transaction execution
const DEX_INFO: Record<string, any> = {
  'jupiter': {
    name: 'Jupiter',
    apiUrl: 'https://quote-api.jup.ag/v6',
    aggregator: true
  },
  'raydium': {
    name: 'Raydium',
    apiUrl: 'https://api.raydium.io/',
    aggregator: false
  },
  'orca': {
    name: 'Orca',
    apiUrl: 'https://api.orca.so/',
    aggregator: false
  }
};

// Market data cache
interface TokenPrice {
  symbol: string;
  usdPrice: number;
  solPrice: number;
  lastUpdated: number;
}

// Redefining the TransformerSignal interface (duplicate)
export interface TransformerSignal {
  id: string;
  timestamp: number;
  transformer: string;
  type: SignalType;
  confidence: number;
  strength: SignalStrength;
  timeframe: SignalTimeframe;
  action: 'buy' | 'sell' | 'swap' | 'borrow' | 'flash_loan';
  sourceToken: string;
  targetToken: string;
  sourceAmount?: number;
  targetAmount?: number;
  entryPriceUsd?: number;
  targetPriceUsd?: number;
  stopLossUsd?: number;
  dex?: string;
  flashLoan?: boolean;
  crossChain?: boolean;
  leverage?: number;
  description?: string;
  metadata?: any;
}

interface ProcessedSignal extends TransformerSignal {
  transactionId?: string;
  executed: boolean;
  executionTimestamp?: number;
  transactionSignature?: string;
  profit?: {
    amount: number;
    token: string;
    usdValue?: number;
  };
  status: 'pending' | 'executing' | 'completed' | 'failed';
  statusMessage?: string;
}

// Local storage for signals
const SIGNALS_DIR = path.join(process.cwd(), 'data', 'signals');
const PROCESSED_SIGNALS_PATH = path.join(SIGNALS_DIR, 'processed_signals.json');
const EVENT_EMITTER = new EventEmitter();

// Price cache
const priceCache = new Map<string, TokenPrice>();

/**
 * Initialize signal hub
 */
export async function initSignalHub(): Promise<boolean> {
  try {
    logger.info(`[SignalHub] Initializing signal processing hub`);

    // Create signals directory if it doesn't exist
    if (!fs.existsSync(SIGNALS_DIR)) {
      fs.mkdirSync(SIGNALS_DIR, { recursive: true });
    }

    // Initialize processed signals file if it doesn't exist
    if (!fs.existsSync(PROCESSED_SIGNALS_PATH)) {
      fs.writeFileSync(PROCESSED_SIGNALS_PATH, JSON.stringify([], null, 2), 'utf8');
    }

    // Update price cache initially
    await updatePriceCache();

    // Start signal processing loop
    startSignalProcessing();

    // Generate test signals for each transformer
    generateTestSignals();

    logger.info(`[SignalHub] Signal hub initialized successfully`);
    return true;
  } catch (error) {
    logger.error(`[SignalHub] Error initializing signal hub: ${error}`);
    return false;
  }
}

/**
 * Start signal processing loop
 */
function startSignalProcessing(): void {
  // Process signals every 5 seconds
  setInterval(async () => {
    try {
      await processNewSignals();
    } catch (error) {
      logger.error(`[SignalHub] Error processing signals: ${error}`);
    }
  }, 5000);

  // Update price cache every 30 seconds
  setInterval(async () => {
    try {
      await updatePriceCache();
    } catch (error) {
      logger.error(`[SignalHub] Error updating price cache: ${error}`);
    }
  }, 30000);

  logger.info(`[SignalHub] Signal processing loop started`);
}

/**
 * Generate test signals for transformers
 */
function generateTestSignals(): void {
  try {
    const transformers = [
      'MicroQHC',
      'MemeCortex',
      'MemeCortexRemix',
      'Security',
      'CrossChain'
    ];

    // Generate signals for each transformer
    transformers.forEach(transformer => {
      generateTransformerSignals(transformer);
    });

    logger.info(`[SignalHub] Generated test signals for transformers`);
  } catch (error) {
    logger.error(`[SignalHub] Error generating test signals: ${error}`);
  }
}

/**
 * Generate signals for a specific transformer
 */
function generateTransformerSignals(transformer: string): void {
  try {
    // Signal configurations based on transformer type
    let signalConfigs: Partial<TransformerSignal>[] = [];

    switch (transformer) {
      case 'MicroQHC':
        // USDC to BONK trade signal
        signalConfigs.push({
          type: SignalType.ENTRY,
          confidence: 0.87,
          strength: SignalStrength.HIGH,
          timeframe: SignalTimeframe.IMMEDIATE,
          action: 'swap',
          sourceToken: 'USDC',
          targetToken: 'BONK',
          sourceAmount: 250,
          dex: 'jupiter',
          description: 'MicroQHC detected high buy pressure on BONK'
        });

        // SOL to MEME trade signal
        signalConfigs.push({
          type: SignalType.ENTRY,
          confidence: 0.81,
          strength: SignalStrength.HIGH,
          timeframe: SignalTimeframe.SHORT,
          action: 'swap',
          sourceToken: 'USDC',
          targetToken: 'MEME',
          sourceAmount: 125,
          dex: 'jupiter',
          description: 'MicroQHC identified bullish pattern on MEME'
        });
        break;

      case 'MemeCortex':
        // USDC to JUP trade signal
        signalConfigs.push({
          type: SignalType.ENTRY,
          confidence: 0.79,
          strength: SignalStrength.MEDIUM,
          timeframe: SignalTimeframe.SHORT,
          action: 'swap',
          sourceToken: 'USDC',
          targetToken: 'JUP',
          sourceAmount: 200,
          dex: 'jupiter',
          description: 'MemeCortex detected JUP uptrend beginning'
        });
        break;

      case 'MemeCortexRemix':
        // Flash loan opportunity
        signalConfigs.push({
          type: SignalType.FLASH_OPPORTUNITY,
          confidence: 0.92,
          strength: SignalStrength.EXTREME,
          timeframe: SignalTimeframe.IMMEDIATE,
          action: 'flash_loan',
          sourceToken: 'USDC',
          targetToken: 'SOL',
          sourceAmount: 1000,
          dex: 'jupiter',
          flashLoan: true,
          description: 'MemeCortexRemix detected flash loan arbitrage opportunity'
        });
        break;

      case 'Security':
        // Exit signal for MEME
        signalConfigs.push({
          type: SignalType.EXIT,
          confidence: 0.85,
          strength: SignalStrength.HIGH,
          timeframe: SignalTimeframe.IMMEDIATE,
          action: 'sell',
          sourceToken: 'MEME',
          targetToken: 'USDC',
          dex: 'jupiter',
          description: 'Security detected potential downtrend for MEME'
        });
        break;

      case 'CrossChain':
        // Cross-chain opportunity
        signalConfigs.push({
          type: SignalType.CROSS_CHAIN,
          confidence: 0.88,
          strength: SignalStrength.HIGH,
          timeframe: SignalTimeframe.SHORT,
          action: 'swap',
          sourceToken: 'USDC',
          targetToken: 'USDC',
          sourceAmount: 500,
          crossChain: true,
          description: 'CrossChain detected arbitrage between Solana and Ethereum'
        });
        break;
    }

    // Generate and submit signals
    signalConfigs.forEach(config => {
      const signal: TransformerSignal = {
        id: `signal_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
        timestamp: Date.now(),
        transformer,
        type: config.type || SignalType.ENTRY,
        confidence: config.confidence || 0.75,
        strength: config.strength || SignalStrength.MEDIUM,
        timeframe: config.timeframe || SignalTimeframe.SHORT,
        action: config.action || 'buy',
        sourceToken: config.sourceToken || 'USDC',
        targetToken: config.targetToken || 'SOL',
        sourceAmount: config.sourceAmount,
        targetAmount: config.targetAmount,
        entryPriceUsd: config.entryPriceUsd,
        targetPriceUsd: config.targetPriceUsd,
        stopLossUsd: config.stopLossUsd,
        dex: config.dex,
        flashLoan: config.flashLoan || false,
        crossChain: config.crossChain || false,
        leverage: config.leverage,
        description: config.description || `${transformer} generated signal`,
        metadata: config.metadata
      };

      submitTransformerSignal(signal);
    });
  } catch (error) {
    logger.error(`[SignalHub] Error generating transformer signals: ${error}`);
  }
}

/**
 * Submit a new transformer signal
 */
export function submitTransformerSignal(signal: TransformerSignal): boolean {
  try {
    // Log signal receipt
    logger.info(`[SignalHub] Received new signal from ${signal.transformer}: ${signal.action} ${signal.sourceToken} → ${signal.targetToken}`);

    // Store signal in temporary file
    const signalPath = path.join(SIGNALS_DIR, `signal_${signal.id}.json`);
    fs.writeFileSync(signalPath, JSON.stringify(signal, null, 2), 'utf8');

    // Emit signal event
    EVENT_EMITTER.emit('newSignal', signal);

    return true;
  } catch (error) {
    logger.error(`[SignalHub] Error submitting transformer signal: ${error}`);
    return false;
  }
}

/**
 * Process new signals
 */
async function processNewSignals(): Promise<void> {
  try {
    // Get all signal files
    const signalFiles = fs.readdirSync(SIGNALS_DIR)
      .filter(file => file.startsWith('signal_') && file.endsWith('.json'));

    // Read processed signals
    const processedSignals: ProcessedSignal[] = JSON.parse(
      fs.readFileSync(PROCESSED_SIGNALS_PATH, 'utf8')
    );

    // Process each signal file
    for (const file of signalFiles) {
      const filePath = path.join(SIGNALS_DIR, file);
      const signal: TransformerSignal = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      // Check if signal has already been processed
      const alreadyProcessed = processedSignals.some(ps => ps.id === signal.id);

      if (!alreadyProcessed) {
        // Process signal
        await processSignal(signal, processedSignals);

        // Remove signal file after processing
        fs.unlinkSync(filePath);
      }
    }
  } catch (error) {
    logger.error(`[SignalHub] Error processing new signals: ${error}`);
  }
}

/**
 * Process a signal
 */
async function processSignal(
  signal: TransformerSignal,
  processedSignals: ProcessedSignal[]
): Promise<void> {
  try {
    logger.info(`[SignalHub] Processing signal ${signal.id} from ${signal.transformer}`);

    // Create processed signal record
    const processedSignal: ProcessedSignal = {
      ...signal,
      transactionId: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
      executed: false,
      status: 'pending',
      statusMessage: 'Signal received, preparing execution'
    };

    // Update processed signals list
    processedSignals.push(processedSignal);
    fs.writeFileSync(PROCESSED_SIGNALS_PATH, JSON.stringify(processedSignals, null, 2), 'utf8');

    // Execute signal based on type
    let success = false;

    switch (signal.type) {
      case SignalType.ENTRY:
      case SignalType.EXIT:
        success = await executeTradeSignal(processedSignal);
        break;

      case SignalType.FLASH_OPPORTUNITY:
        success = await executeFlashLoanOpportunity(processedSignal);
        break;

      case SignalType.CROSS_CHAIN:
        success = await executeCrossChainOpportunity(processedSignal);
        break;

      case SignalType.REBALANCE:
        success = await executeRebalance(processedSignal);
        break;
    }

    // Update processed signal with result
    const index = processedSignals.findIndex(ps => ps.id === processedSignal.id);
    if (index !== -1) {
      processedSignals[index] = {
        ...processedSignal,
        executed: success,
        executionTimestamp: Date.now(),
        status: success ? 'completed' : 'failed',
        statusMessage: success 
          ? 'Signal executed successfully' 
          : 'Signal execution failed'
      };

      // Save updated processed signals
      fs.writeFileSync(PROCESSED_SIGNALS_PATH, JSON.stringify(processedSignals, null, 2), 'utf8');
    }

    // Emit signal processed event
    EVENT_EMITTER.emit('signalProcessed', processedSignals[index]);

  } catch (error) {
    logger.error(`[SignalHub] Error processing signal: ${error}`);

    // Update processed signal with error
    const index = processedSignals.findIndex(ps => ps.id === signal.id);
    if (index !== -1) {
      processedSignals[index].status = 'failed';
      processedSignals[index].statusMessage = `Error: ${error}`;
      fs.writeFileSync(PROCESSED_SIGNALS_PATH, JSON.stringify(processedSignals, null, 2), 'utf8');
    }
  }
}

/**
 * Execute a trade signal
 */
async function executeTradeSignal(signal: ProcessedSignal): Promise<boolean> {
  try {
    logger.info(`[SignalHub] Executing trade signal: ${signal.action} ${signal.sourceToken} → ${signal.targetToken}`);

    // Update signal status
    updateSignalStatus(signal, 'executing', 'Preparing to execute trade');

    // Get Nexus engine
    const nexusEngine = getNexusEngine();
    if (!nexusEngine) {
      throw new Error('Nexus Engine not available');
    }

    // Prepare trade parameters
    const tradeParams = {
      sourceToken: signal.sourceToken,
      targetToken: signal.targetToken,
      amount: signal.sourceAmount,
      dex: signal.dex || 'jupiter',
      slippageBps: 50, // 0.5% slippage tolerance
      isSimulation: false, // Real trading
      signalId: signal.id,
      confidence: signal.confidence,
      description: signal.description,
      strategy: 'default'
    };

    // Execute trade via Nexus Engine
    const result = await nexusEngine.executeTrade(tradeParams);

    if (result.success) {
      // Update signal with transaction signature
      updateSignalStatus(
        signal, 
        'completed', 
        `Trade executed successfully: ${result.signature}`,
        result.signature
      );

      logger.info(`[SignalHub] Trade executed successfully: ${result.signature}`);
      return true;
    } else {
      updateSignalStatus(signal, 'failed', `Trade failed: ${result.error}`);
      logger.error(`[SignalHub] Trade failed: ${result.error}`);
      return false;
    }
  } catch (error) {
    logger.error(`[SignalHub] Error executing trade signal: ${error}`);
    updateSignalStatus(signal, 'failed', `Error: ${error}`);
    return false;
  }
}

/**
 * Execute a flash loan opportunity
 */
async function executeFlashLoanOpportunity(signal: ProcessedSignal): Promise<boolean> {
  try {
    logger.info(`[SignalHub] Executing flash loan opportunity`);

    // Update signal status
    updateSignalStatus(signal, 'executing', 'Preparing flash loan execution');

    // Get Nexus engine
    const nexusEngine = getNexusEngine();
    if (!nexusEngine) {
      throw new Error('Nexus Engine not available');
    }

    // Prepare flash loan parameters
    const flashLoanParams = {
      sourceToken: signal.sourceToken,
      amount: signal.sourceAmount,
      strategy: 'arbitrage',
      useRealFunds: true,
      signalId: signal.id
    };

    // Execute flash loan via Nexus Engine
    const result = await nexusEngine.executeFlashLoan(flashLoanParams);

    if (result.success) {
      // Update signal with transaction signature
      updateSignalStatus(
        signal, 
        'completed', 
        `Flash loan executed successfully: ${result.signature}`,
        result.signature
      );

      logger.info(`[SignalHub] Flash loan executed successfully: ${result.signature}`);
      return true;
    } else {
      updateSignalStatus(signal, 'failed', `Flash loan failed: ${result.error}`);
      logger.error(`[SignalHub] Flash loan failed: ${result.error}`);
      return false;
    }
  } catch (error) {
    logger.error(`[SignalHub] Error executing flash loan opportunity: ${error}`);
    updateSignalStatus(signal, 'failed', `Error: ${error}`);
    return false;
  }
}

/**
 * Execute a cross-chain opportunity
 */
async function executeCrossChainOpportunity(signal: ProcessedSignal): Promise<boolean> {
  try {
    logger.info(`[SignalHub] Executing cross-chain opportunity`);

    // Update signal status
    updateSignalStatus(signal, 'executing', 'Preparing cross-chain execution');

    // Get Nexus engine
    const nexusEngine = getNexusEngine();
    if (!nexusEngine) {
      throw new Error('Nexus Engine not available');
    }

    // Prepare cross-chain parameters
    const crossChainParams = {
      sourceToken: signal.sourceToken,
      targetToken: signal.targetToken,
      amount: signal.sourceAmount,
      sourceChain: 'solana',
      targetChain: 'ethereum',
      bridgeType: 'wormhole',
      useRealFunds: true,
      signalId: signal.id
    };

    // Execute cross-chain via Nexus Engine
    const result = await nexusEngine.executeCrossChain(crossChainParams);

    if (result.success) {
      // Update signal with transaction signature
      updateSignalStatus(
        signal, 
        'completed', 
        `Cross-chain executed successfully: ${result.signature}`,
        result.signature
      );

      logger.info(`[SignalHub] Cross-chain executed successfully: ${result.signature}`);
      return true;
    } else {
      updateSignalStatus(signal, 'failed', `Cross-chain failed: ${result.error}`);
      logger.error(`[SignalHub] Cross-chain failed: ${result.error}`);
      return false;
    }
  } catch (error) {
    logger.error(`[SignalHub] Error executing cross-chain opportunity: ${error}`);
    updateSignalStatus(signal, 'failed', `Error: ${error}`);
    return false;
  }
}

/**
 * Execute a portfolio rebalance
 */
async function executeRebalance(signal: ProcessedSignal): Promise<boolean> {
  try {
    logger.info(`[SignalHub] Executing portfolio rebalance`);

    // Update signal status
    updateSignalStatus(signal, 'executing', 'Preparing portfolio rebalance');

    // Get Nexus engine
    const nexusEngine = getNexusEngine();
    if (!nexusEngine) {
      throw new Error('Nexus Engine not available');
    }

    // Prepare rebalance parameters
    const rebalanceParams = {
      targetAllocation: signal.metadata?.targetAllocation || {},
      useRealFunds: true,
      signalId: signal.id
    };

    // Execute rebalance via Nexus Engine
    const result = await nexusEngine.rebalancePortfolio(rebalanceParams);

    if (result.success) {
      // Update signal with transaction signatures
      updateSignalStatus(
        signal, 
        'completed', 
        `Rebalance executed successfully with ${result.transactions.length} transactions`,
        result.transactions[0]
      );

      logger.info(`[SignalHub] Rebalance executed successfully: ${result.transactions.length} transactions`);
      return true;
    } else {
      updateSignalStatus(signal, 'failed', `Rebalance failed: ${result.error}`);
      logger.error(`[SignalHub] Rebalance failed: ${result.error}`);
      return false;
    }
  } catch (error) {
    logger.error(`[SignalHub] Error executing rebalance: ${error}`);
    updateSignalStatus(signal, 'failed', `Error: ${error}`);
    return false;
  }
}

/**
 * Update signal status
 */
function updateSignalStatus(
  signal: ProcessedSignal,
  status: 'pending' | 'executing' | 'completed' | 'failed',
  statusMessage: string,
  transactionSignature?: string
): void {
  try {
    // Read processed signals
    const processedSignals: ProcessedSignal[] = JSON.parse(
      fs.readFileSync(PROCESSED_SIGNALS_PATH, 'utf8')
    );

    // Find and update signal
    const index = processedSignals.findIndex(ps => ps.id === signal.id);
    if (index !== -1) {
      processedSignals[index].status = status;
      processedSignals[index].statusMessage = statusMessage;

      if (transactionSignature) {
        processedSignals[index].transactionSignature = transactionSignature;
      }

      // Save updated processed signals
      fs.writeFileSync(PROCESSED_SIGNALS_PATH, JSON.stringify(processedSignals, null, 2), 'utf8');

      // Update passed signal object
      signal.status = status;
      signal.statusMessage = statusMessage;
      if (transactionSignature) {
        signal.transactionSignature = transactionSignature;
      }
    }
  } catch (error) {
    logger.error(`[SignalHub] Error updating signal status: ${error}`);
  }
}

/**
 * Update price cache
 */
async function updatePriceCache(): Promise<void> {
  try {
    // For real implementation, this would fetch prices from Jupiter API or similar
    // For simplicity, we'll use placeholder values

    // Update SOL price
    priceCache.set('SOL', {
      symbol: 'SOL',
      usdPrice: 140.25,
      solPrice: 1,
      lastUpdated: Date.now()
    });

    // Update USDC price
    priceCache.set('USDC', {
      symbol: 'USDC',
      usdPrice: 1,
      solPrice: 1 / 140.25,
      lastUpdated: Date.now()
    });

    // Update BONK price
    priceCache.set('BONK', {
      symbol: 'BONK',
      usdPrice: 0.00005,
      solPrice: 0.00005 / 140.25,
      lastUpdated: Date.now()
    });

    // Update MEME price
    priceCache.set('MEME', {
      symbol: 'MEME',
      usdPrice: 0.037,
      solPrice: 0.037 / 140.25,
      lastUpdated: Date.now()
    });

    // Update JUP price
    priceCache.set('JUP', {
      symbol: 'JUP',
      usdPrice: 1.27,
      solPrice: 1.27 / 140.25,
      lastUpdated: Date.now()
    });
  } catch (error) {
    logger.error(`[SignalHub] Error updating price cache: ${error}`);
  }
}

/**
 * Get recent signals
 */
export function getRecentSignals(limit: number = 10): ProcessedSignal[] {
  try {
    if (fs.existsSync(PROCESSED_SIGNALS_PATH)) {
      const signals: ProcessedSignal[] = JSON.parse(
        fs.readFileSync(PROCESSED_SIGNALS_PATH, 'utf8')
      );

      // Return most recent signals
      return signals.slice(-limit).reverse();
    }
  } catch (error) {
    logger.error(`[SignalHub] Error getting recent signals: ${error}`);
  }

  return [];
}

/**
 * Get active (pending or executing) signals
 */
export function getActiveSignals(): ProcessedSignal[] {
  try {
    if (fs.existsSync(PROCESSED_SIGNALS_PATH)) {
      const signals: ProcessedSignal[] = JSON.parse(
        fs.readFileSync(PROCESSED_SIGNALS_PATH, 'utf8')
      );

      // Return active signals
      return signals.filter(s => s.status === 'pending' || s.status === 'executing');
    }
  } catch (error) {
    logger.error(`[SignalHub] Error getting active signals: ${error}`);
  }

  return [];
}

/**
 * Subscribe to new signal events
 */
export function onNewSignal(callback: (signal: TransformerSignal) => void): () => void {
  EVENT_EMITTER.on('newSignal', callback);

  // Return unsubscribe function
  return () => {
    EVENT_EMITTER.off('newSignal', callback);
  };
}

/**
 * Subscribe to signal processed events
 */
export function onSignalProcessed(callback: (signal: ProcessedSignal) => void): () => void {
  EVENT_EMITTER.on('signalProcessed', callback);

  // Return unsubscribe function
  return () => {
    EVENT_EMITTER.off('signalProcessed', callback);
  };
}

/**
 * Force signal generation
 */
export function forceSignalGeneration(): void {
  try {
    logger.info(`[SignalHub] Forcing signal generation for transformers`);
    generateTestSignals();
  } catch (error) {
    logger.error(`[SignalHub] Error forcing signal generation: ${error}`);
  }
}