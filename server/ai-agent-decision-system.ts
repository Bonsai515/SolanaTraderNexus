/**
 * AI Agent Decision System
 * 
 * This module implements the decision logic for AI agents:
 * 1. Receives transformer signals with suggested entry/exit points
 * 2. Analyzes and potentially modifies entry/exit strategy based on agent intelligence
 * 3. Passes execution parameters to Nexus Pro Engine for blockchain execution
 * 4. Includes MEV protection, Jito bundles, stealth routing, and gas optimization
 * 5. Handles transaction construction and execution timing
 */

import * as logger from './logger';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { Connection, PublicKey } from '@solana/web3.js';
import { getManagedConnection } from './lib/rpcConnectionManager';
import { getNexusEngine } from './nexus-transaction-engine';

// Import interfaces from neural communication hub for type consistency
import { EventEmitter as EventEmitter2 } from 'events'; // Use alias to avoid conflict

// Agent configuration
interface AgentConfig {
  id: string;
  name: string;
  type: 'arbiter' | 'sniper' | 'quantitative' | 'flash';
  strategy: string;
  minConfidence: number;
  maxSlippageBps: number;
  riskTolerance: number; // 1-10 scale
  maxPositionSizeUSD: number;
  profitTargetPercent: number;
  stopLossPercent: number;
  emergencySellThresholdPercent: number;
  aiModelVersion: string;
  allowedTokens: string[];
  forbiddenTokens: string[];
  preferredDexes: string[];
}

// Agent decision
interface AgentDecision {
  signalId: string;
  agentId: string;
  timestamp: number;
  decision: 'execute' | 'reject' | 'modify' | 'hold';
  confidence: number;
  modifications?: Record<string, any>;
  reasoning: string;
}

// Signal from transformer
interface TransformerSignal {
  id: string;
  timestamp: number;
  transformer: string;
  type: string;
  confidence: number;
  strength: string;
  timeframe: string;
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
  
  // Entry/exit timing parameters
  entryTimestamp?: number;
  entryWindow?: { start: number; end: number };
  exitTimestamp?: number;
  exitWindow?: { start: number; end: number };
  
  // Risk management parameters
  stopLossPercent?: number;
  takeProfitPercent?: number;
  emergencySellConditions?: {
    priceDropPercent?: number;
    timeBasedSell?: number;
    marketConditionTrigger?: string;
    volumeDropPercent?: number;
  };
  
  // Special instructions
  holdInstructions?: {
    minHoldTime?: number;
    maxHoldTime?: number;
    targetPrice?: number;
    overrideConditions?: string[];
  };
}

// Execution parameters for Nexus
interface ExecutionParams {
  signalId: string;
  agentId: string;
  sourceToken: string;
  targetToken: string;
  amount: number;
  slippageBps: number;
  isSimulation: boolean;
  
  // Timing parameters
  executeAt: number;
  expiresAt: number;
  
  // Exit strategy
  exitStrategy: {
    type: 'time' | 'price' | 'combined';
    targetTimestamp?: number;
    targetPrice?: number;
    stopLoss?: number;
    takeProfit?: number;
    trailingStopPercent?: number;
  };
  
  // MEV & execution protection
  mevProtection: {
    enabled: boolean;
    useJitoBundles: boolean;
    useStealthRouting: boolean;
    decoyTrades: boolean;
    routeFragmentation: boolean;
  };
  
  // Transaction parameters
  transactionParams: {
    priorityFee: number;
    deadline: number;
    gasOptimization: 'default' | 'aggressive' | 'conservative';
    transactionBundling: boolean;
    maxRetries: number;
  };
  
  // Special parameters
  specialInstructions?: {
    holdConditions?: string[];
    overrideSignals?: string[];
    executionPriority: 'normal' | 'high' | 'extreme';
  };
}

// Token price and liquidity data
interface TokenData {
  symbol: string;
  address: string;
  usdPrice: number;
  solPrice: number;
  liquidity: number;
  volume24h: number;
  priceChange1h: number;
  priceChange24h: number;
  lastUpdated: number;
}

// Market condition
interface MarketCondition {
  timestamp: number;
  solPrice: number;
  overallMarketHealth: 'bullish' | 'bearish' | 'neutral' | 'volatile';
  volatilityIndex: number;
  memeTokenIndex: number;
  majorCoinsHealth: 'bullish' | 'bearish' | 'neutral';
  liquidityScore: number;
  sentimentScore: number;
}

// AI agent event emitter
const agentEvents = new EventEmitter();
const neuralBus = new EventEmitter2(); // For receiving signals

// Map of agent configurations
const agents: Map<string, AgentConfig> = new Map();

// Cache for token data
const tokenCache: Map<string, TokenData> = new Map();

// Current market condition
let currentMarketCondition: MarketCondition | null = null;

// Decision history for learning
const decisionHistory: AgentDecision[] = [];

// Pending decisions
const pendingDecisions: Map<string, TransformerSignal> = new Map();

// Scheduled exit strategies
const scheduledExits: Map<string, {
  signalId: string;
  token: string;
  targetTimestamp: number;
  targetPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  agentId: string;
}> = new Map();

// Default agent configurations
const DEFAULT_AGENTS: AgentConfig[] = [
  {
    id: 'hyperion',
    name: 'Hyperion Flash Arbitrage',
    type: 'flash',
    strategy: 'flash_arbitrage',
    minConfidence: 0.82,
    maxSlippageBps: 150,
    riskTolerance: 8,
    maxPositionSizeUSD: 5000,
    profitTargetPercent: 5,
    stopLossPercent: 2,
    emergencySellThresholdPercent: 3,
    aiModelVersion: 'hyperion-v2.1',
    allowedTokens: ['SOL', 'USDC', 'BONK', 'JUP', 'MEME', 'GUAC', 'WIF'],
    forbiddenTokens: [],
    preferredDexes: ['jupiter', 'orca', 'raydium']
  },
  {
    id: 'quantum_omega',
    name: 'Quantum Omega Meme Sniper',
    type: 'sniper',
    strategy: 'memecoin_sniper',
    minConfidence: 0.75,
    maxSlippageBps: 300,
    riskTolerance: 9,
    maxPositionSizeUSD: 3000,
    profitTargetPercent: 30,
    stopLossPercent: 15,
    emergencySellThresholdPercent: 20,
    aiModelVersion: 'quantum-omega-v1.8',
    allowedTokens: ['SOL', 'USDC', 'BONK', 'MEME', 'GUAC', 'WIF'],
    forbiddenTokens: [],
    preferredDexes: ['jupiter', 'raydium']
  },
  {
    id: 'singularity',
    name: 'MEV Singularity',
    type: 'arbiter',
    strategy: 'mev_extraction',
    minConfidence: 0.85,
    maxSlippageBps: 80,
    riskTolerance: 7,
    maxPositionSizeUSD: 10000,
    profitTargetPercent: 3,
    stopLossPercent: 1,
    emergencySellThresholdPercent: 1.5,
    aiModelVersion: 'singularity-v3.0',
    allowedTokens: ['SOL', 'USDC', 'BONK', 'JUP', 'MEME', 'RAY'],
    forbiddenTokens: [],
    preferredDexes: ['jupiter', 'openbook', 'raydium', 'orca']
  }
];

/**
 * Initialize AI agent decision system
 */
export async function initAIAgentDecisionSystem(): Promise<boolean> {
  try {
    logger.info(`[AIAgents] Initializing AI agent decision system`);
    
    // Create data directory if not exists
    const dataDir = path.join(process.cwd(), 'data', 'agents');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Initialize agent configurations
    initializeAgentConfigurations();
    
    // Listen for signals from neural communication hub
    registerSignalListeners();
    
    // Initialize token data cache
    await updateTokenDataCache();
    
    // Initialize market condition analysis
    await updateMarketCondition();
    
    // Start monitoring scheduled exits
    startExitMonitoring();
    
    // Start agent heartbeats
    startAgentHeartbeats();
    
    logger.info(`[AIAgents] AI agent decision system initialized with ${agents.size} agents`);
    return true;
  } catch (error) {
    logger.error(`[AIAgents] Error initializing AI agent decision system: ${error}`);
    return false;
  }
}

/**
 * Initialize agent configurations
 */
function initializeAgentConfigurations(): void {
  try {
    // Clear current agents
    agents.clear();
    
    // Load agent configurations from file if exists
    const configFile = path.join(process.cwd(), 'data', 'agents', 'agent_configurations.json');
    let loadedConfigs: AgentConfig[] = [];
    
    if (fs.existsSync(configFile)) {
      try {
        loadedConfigs = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        logger.info(`[AIAgents] Loaded ${loadedConfigs.length} agent configurations from file`);
      } catch (error) {
        logger.error(`[AIAgents] Error loading agent configurations: ${error}`);
        loadedConfigs = [];
      }
    }
    
    // If no configs loaded, use defaults
    if (loadedConfigs.length === 0) {
      loadedConfigs = DEFAULT_AGENTS;
      logger.info(`[AIAgents] Using default agent configurations`);
    }
    
    // Initialize agents
    loadedConfigs.forEach(config => {
      agents.set(config.id, config);
      logger.info(`[AIAgents] Initialized agent: ${config.name} (${config.id})`);
    });
    
    // Save configurations to file
    fs.writeFileSync(configFile, JSON.stringify(Array.from(agents.values()), null, 2), 'utf8');
  } catch (error) {
    logger.error(`[AIAgents] Error initializing agent configurations: ${error}`);
  }
}

/**
 * Register signal listeners
 */
function registerSignalListeners(): void {
  try {
    // Listen for signals from neural communication hub
    neuralBus.on('agent:input:hyperion', (signal: TransformerSignal) => {
      processSignal(signal, 'hyperion');
    });
    
    neuralBus.on('agent:input:quantum_omega', (signal: TransformerSignal) => {
      processSignal(signal, 'quantum_omega');
    });
    
    neuralBus.on('agent:input:singularity', (signal: TransformerSignal) => {
      processSignal(signal, 'singularity');
    });
    
    // Listen for market updates
    neuralBus.on('market:update', async () => {
      await updateMarketCondition();
      await updateTokenDataCache();
    });
    
    logger.info(`[AIAgents] Registered signal listeners for agents`);
  } catch (error) {
    logger.error(`[AIAgents] Error registering signal listeners: ${error}`);
  }
}

/**
 * Process incoming signal
 */
async function processSignal(signal: TransformerSignal, agentId: string): Promise<void> {
  try {
    logger.info(`[AIAgents] Agent ${agentId} processing signal: ${signal.id}`);
    
    // Get agent configuration
    const agentConfig = agents.get(agentId);
    if (!agentConfig) {
      logger.error(`[AIAgents] Agent configuration not found for: ${agentId}`);
      return;
    }
    
    // Store signal for decision processing
    pendingDecisions.set(signal.id, signal);
    
    // Make agent decision
    const decision = await makeAgentDecision(signal, agentConfig);
    
    // Store decision in history
    decisionHistory.push(decision);
    
    // Limit history size
    if (decisionHistory.length > 1000) {
      decisionHistory.splice(0, decisionHistory.length - 1000);
    }
    
    // Emit decision event
    agentEvents.emit('agent:decision', decision);
    
    // Route decision to neural communication hub
    neuralBus.emit(`agent:decision:${agentId}`, decision);
    
    // If decision is to execute, create execution parameters
    if (decision.decision === 'execute' || decision.decision === 'modify') {
      const executionParams = await createExecutionParams(signal, decision, agentConfig);
      if (executionParams) {
        // Route execution to neural communication hub
        neuralBus.emit(`agent:output:${agentId}`, executionParams);
        
        // Schedule exit strategy if needed
        scheduleExitStrategy(signal, decision, agentConfig);
      }
    }
    
    logger.info(`[AIAgents] Agent ${agentId} decision for signal ${signal.id}: ${decision.decision}`);
  } catch (error) {
    logger.error(`[AIAgents] Error processing signal: ${error}`);
  }
}

/**
 * Make agent decision based on signal and agent configuration
 */
async function makeAgentDecision(
  signal: TransformerSignal,
  agentConfig: AgentConfig
): Promise<AgentDecision> {
  try {
    // Basic validation
    if (signal.confidence < agentConfig.minConfidence) {
      return {
        signalId: signal.id,
        agentId: agentConfig.id,
        timestamp: Date.now(),
        decision: 'reject',
        confidence: signal.confidence,
        reasoning: `Signal confidence ${signal.confidence} below minimum threshold ${agentConfig.minConfidence}`
      };
    }
    
    // Check if token is allowed
    if (!agentConfig.allowedTokens.includes(signal.targetToken)) {
      return {
        signalId: signal.id,
        agentId: agentConfig.id,
        timestamp: Date.now(),
        decision: 'reject',
        confidence: signal.confidence,
        reasoning: `Token ${signal.targetToken} not in allowed tokens list`
      };
    }
    
    // Check if token is forbidden
    if (agentConfig.forbiddenTokens.includes(signal.targetToken)) {
      return {
        signalId: signal.id,
        agentId: agentConfig.id,
        timestamp: Date.now(),
        decision: 'reject',
        confidence: signal.confidence,
        reasoning: `Token ${signal.targetToken} is in forbidden tokens list`
      };
    }
    
    // Check market conditions
    if (shouldRejectDueToMarketConditions(signal, agentConfig)) {
      return {
        signalId: signal.id,
        agentId: agentConfig.id,
        timestamp: Date.now(),
        decision: 'reject',
        confidence: signal.confidence,
        reasoning: `Market conditions unfavorable for ${signal.targetToken} trading`
      };
    }
    
    // Get token data
    const tokenData = tokenCache.get(signal.targetToken);
    
    // Agent-specific analysis
    let decision: AgentDecision;
    
    switch (agentConfig.id) {
      case 'hyperion':
        decision = hyperionAgentAnalysis(signal, agentConfig, tokenData);
        break;
        
      case 'quantum_omega':
        decision = quantumOmegaAgentAnalysis(signal, agentConfig, tokenData);
        break;
        
      case 'singularity':
        decision = singularityAgentAnalysis(signal, agentConfig, tokenData);
        break;
        
      default:
        decision = defaultAgentAnalysis(signal, agentConfig, tokenData);
    }
    
    return decision;
  } catch (error) {
    logger.error(`[AIAgents] Error making agent decision: ${error}`);
    
    // Return reject decision on error
    return {
      signalId: signal.id,
      agentId: agentConfig.id,
      timestamp: Date.now(),
      decision: 'reject',
      confidence: 0,
      reasoning: `Error in decision making: ${error}`
    };
  }
}

/**
 * Hyperion agent analysis for flash arbitrage
 */
function hyperionAgentAnalysis(
  signal: TransformerSignal,
  agentConfig: AgentConfig,
  tokenData?: TokenData
): AgentDecision {
  // Check if flash arbitrage opportunity
  if (signal.action === 'flash_loan' || signal.flashLoan) {
    // High risk tolerance for flash loans
    if (signal.confidence >= 0.9) {
      // Accept as is
      return {
        signalId: signal.id,
        agentId: agentConfig.id,
        timestamp: Date.now(),
        decision: 'execute',
        confidence: signal.confidence,
        reasoning: `High confidence flash arbitrage opportunity accepted`
      };
    } else if (signal.confidence >= 0.8) {
      // Accept but modify parameters
      return {
        signalId: signal.id,
        agentId: agentConfig.id,
        timestamp: Date.now(),
        decision: 'modify',
        confidence: signal.confidence,
        modifications: {
          // Add more safety parameters for flash loans
          stopLossPercent: agentConfig.stopLossPercent / 2, // Tighter stop loss
          slippageBps: Math.floor(agentConfig.maxSlippageBps * 0.7), // Reduced slippage
          emergencySellConditions: {
            priceDropPercent: agentConfig.stopLossPercent * 0.8,
            timeBasedSell: Date.now() + 3600000 // 1 hour max
          }
        },
        reasoning: `Medium confidence flash opportunity accepted with modified risk parameters`
      };
    } else {
      // Reject lower confidence flash loans
      return {
        signalId: signal.id,
        agentId: agentConfig.id,
        timestamp: Date.now(),
        decision: 'reject',
        confidence: signal.confidence,
        reasoning: `Flash loan opportunity confidence too low (${signal.confidence})`
      };
    }
  }
  
  // Regular trading logic
  if (signal.type === 'entry') {
    // For regular trades, Hyperion specializes in very short timeframes
    if (signal.timeframe === 'immediate' || signal.timeframe === 'short') {
      // Good fit for Hyperion
      if (signal.confidence >= agentConfig.minConfidence) {
        return {
          signalId: signal.id,
          agentId: agentConfig.id,
          timestamp: Date.now(),
          decision: 'execute',
          confidence: signal.confidence,
          modifications: {
            // Hyperion always adds quick exit strategy
            takeProfitPercent: agentConfig.profitTargetPercent,
            stopLossPercent: agentConfig.stopLossPercent,
            exitTimestamp: Date.now() + 1800000, // 30 min max hold
            exitWindow: {
              start: Date.now() + 300000, // 5 min min hold
              end: Date.now() + 1800000 // 30 min max hold
            }
          },
          reasoning: `Hyperion approves short-term trading opportunity`
        };
      }
    } else {
      // Not ideal for Hyperion's strategy
      return {
        signalId: signal.id,
        agentId: agentConfig.id,
        timestamp: Date.now(),
        decision: 'reject',
        confidence: signal.confidence,
        reasoning: `Signal timeframe (${signal.timeframe}) not optimal for Hyperion's flash strategy`
      };
    }
  }
  
  // Default response
  return {
    signalId: signal.id,
    agentId: agentConfig.id,
    timestamp: Date.now(),
    decision: 'reject',
    confidence: signal.confidence,
    reasoning: `Signal type not compatible with Hyperion agent strategy`
  };
}

/**
 * Quantum Omega agent analysis for meme tokens
 */
function quantumOmegaAgentAnalysis(
  signal: TransformerSignal,
  agentConfig: AgentConfig,
  tokenData?: TokenData
): AgentDecision {
  // Quantum Omega specializes in meme tokens
  const memeTokens = ['BONK', 'MEME', 'GUAC', 'WIF'];
  
  // Check if signal is for a meme token
  if (signal.type === 'entry' && memeTokens.includes(signal.targetToken)) {
    // Assess token's momentum from tokenData
    let momentumScore = 0;
    
    if (tokenData) {
      // Higher volume is good for meme tokens
      if (tokenData.volume24h > 1000000) momentumScore += 2;
      else if (tokenData.volume24h > 500000) momentumScore += 1;
      
      // Recent price increase is good
      if (tokenData.priceChange1h > 5) momentumScore += 3;
      else if (tokenData.priceChange1h > 2) momentumScore += 1;
      
      // Higher liquidity is safer
      if (tokenData.liquidity > 5000000) momentumScore += 1;
    }
    
    // Check market condition for meme tokens
    if (currentMarketCondition && currentMarketCondition.memeTokenIndex > 70) {
      momentumScore += 2;
    }
    
    // Combine momentum with signal confidence
    const combinedConfidence = Math.min(signal.confidence * (1 + momentumScore / 10), 0.99);
    
    if (combinedConfidence >= agentConfig.minConfidence) {
      // Good meme token opportunity
      return {
        signalId: signal.id,
        agentId: agentConfig.id,
        timestamp: Date.now(),
        decision: 'execute',
        confidence: combinedConfidence,
        modifications: {
          // Quantum Omega modifies parameters for meme tokens
          takeProfitPercent: agentConfig.profitTargetPercent,
          stopLossPercent: agentConfig.stopLossPercent,
          
          // Dynamic exit strategy based on momentum
          holdInstructions: {
            minHoldTime: 300000, // 5 min minimum
            maxHoldTime: momentumScore > 3 ? 86400000 : 3600000, // 1 day for high momentum, 1 hour otherwise
            overrideConditions: ['major_news']
          },
          
          // Specific parameters for meme token trading
          emergencySellConditions: {
            volumeDropPercent: 50, // Meme tokens can be volatile, exit on volume drops
            priceDropPercent: agentConfig.stopLossPercent * 1.2
          }
        },
        reasoning: `Quantum Omega approves meme token trading opportunity for ${signal.targetToken} with momentum score ${momentumScore}`
      };
    }
  } else if (signal.type === 'exit' && memeTokens.includes(signal.sourceToken)) {
    // Quantum Omega is very responsive to exit signals for meme tokens
    if (signal.confidence >= agentConfig.minConfidence * 0.8) { // Lower threshold for exits
      return {
        signalId: signal.id,
        agentId: agentConfig.id,
        timestamp: Date.now(),
        decision: 'execute',
        confidence: signal.confidence,
        modifications: {
          slippageBps: agentConfig.maxSlippageBps * 1.5, // Higher slippage tolerance for exits
          exitTimestamp: Date.now() + 300000, // Execute within 5 minutes
        },
        reasoning: `Quantum Omega approves rapid exit from meme token ${signal.sourceToken}`
      };
    }
  }
  
  // Default response
  return {
    signalId: signal.id,
    agentId: agentConfig.id,
    timestamp: Date.now(),
    decision: 'reject',
    confidence: signal.confidence,
    reasoning: `Signal not compatible with Quantum Omega's meme token strategy`
  };
}

/**
 * Singularity agent analysis for MEV extraction
 */
function singularityAgentAnalysis(
  signal: TransformerSignal,
  agentConfig: AgentConfig,
  tokenData?: TokenData
): AgentDecision {
  // Singularity focuses on MEV opportunities
  if (signal.type === 'entry' && signal.timeframe === 'immediate') {
    // Check for high liquidity tokens (better for MEV)
    if (tokenData && tokenData.liquidity > 10000000) {
      // High liquidity is good for MEV
      if (signal.confidence >= agentConfig.minConfidence) {
        return {
          signalId: signal.id,
          agentId: agentConfig.id,
          timestamp: Date.now(),
          decision: 'execute',
          confidence: signal.confidence * 1.1, // Boost confidence for high liquidity
          modifications: {
            // Singularity always adds MEV protection and Jito bundles
            transactionParams: {
              priorityFee: 1000000, // High priority fee for MEV
              deadline: 30, // Tight deadline
              gasOptimization: 'aggressive',
              transactionBundling: true,
              maxRetries: 3
            },
            
            // Quick exit strategy
            takeProfitPercent: agentConfig.profitTargetPercent,
            stopLossPercent: agentConfig.stopLossPercent,
            exitTimestamp: Date.now() + 600000, // 10 min max hold
            
            // MEV-specific instructions
            specialInstructions: {
              executionPriority: 'extreme'
            }
          },
          reasoning: `Singularity approves MEV opportunity with high liquidity for ${signal.targetToken}`
        };
      }
    } else {
      // For lower liquidity, higher confidence needed
      if (signal.confidence >= agentConfig.minConfidence * 1.2) {
        return {
          signalId: signal.id,
          agentId: agentConfig.id,
          timestamp: Date.now(),
          decision: 'execute',
          confidence: signal.confidence,
          modifications: {
            // More cautious MEV strategy for lower liquidity
            transactionParams: {
              priorityFee: 500000, // Medium priority fee
              deadline: 60, // Longer deadline
              gasOptimization: 'default',
              transactionBundling: true,
              maxRetries: 2
            },
            
            // More cautious exit strategy
            takeProfitPercent: agentConfig.profitTargetPercent * 0.8,
            stopLossPercent: agentConfig.stopLossPercent * 0.7,
            exitTimestamp: Date.now() + 300000, // 5 min max hold
          },
          reasoning: `Singularity cautiously approves MEV opportunity with lower liquidity for ${signal.targetToken}`
        };
      }
    }
  }
  
  // Default response
  return {
    signalId: signal.id,
    agentId: agentConfig.id,
    timestamp: Date.now(),
    decision: 'reject',
    confidence: signal.confidence,
    reasoning: `Signal not compatible with Singularity's MEV extraction strategy`
  };
}

/**
 * Default agent analysis
 */
function defaultAgentAnalysis(
  signal: TransformerSignal,
  agentConfig: AgentConfig,
  tokenData?: TokenData
): AgentDecision {
  // Basic analysis for any agent
  if (signal.confidence >= agentConfig.minConfidence) {
    return {
      signalId: signal.id,
      agentId: agentConfig.id,
      timestamp: Date.now(),
      decision: 'execute',
      confidence: signal.confidence,
      modifications: {
        takeProfitPercent: agentConfig.profitTargetPercent,
        stopLossPercent: agentConfig.stopLossPercent
      },
      reasoning: `Default decision to execute signal with sufficient confidence`
    };
  } else {
    return {
      signalId: signal.id,
      agentId: agentConfig.id,
      timestamp: Date.now(),
      decision: 'reject',
      confidence: signal.confidence,
      reasoning: `Default decision to reject signal with insufficient confidence`
    };
  }
}

/**
 * Check if signal should be rejected due to market conditions
 */
function shouldRejectDueToMarketConditions(
  signal: TransformerSignal,
  agentConfig: AgentConfig
): boolean {
  if (!currentMarketCondition) return false;
  
  // For very high risk tolerance agents, only reject in extreme conditions
  if (agentConfig.riskTolerance >= 9) {
    return currentMarketCondition.overallMarketHealth === 'bearish' &&
           currentMarketCondition.volatilityIndex > 80;
  }
  
  // For high risk tolerance agents
  if (agentConfig.riskTolerance >= 7) {
    // Reject in very bearish conditions
    if (currentMarketCondition.overallMarketHealth === 'bearish' &&
        currentMarketCondition.volatilityIndex > 70) {
      return true;
    }
    
    // For meme tokens, check meme token index
    const memeTokens = ['BONK', 'MEME', 'GUAC', 'WIF'];
    if (memeTokens.includes(signal.targetToken) && 
        currentMarketCondition.memeTokenIndex < 30) {
      return true;
    }
  }
  
  // For medium risk tolerance agents
  if (agentConfig.riskTolerance >= 4 && agentConfig.riskTolerance < 7) {
    // Reject in bearish or volatile conditions
    if (currentMarketCondition.overallMarketHealth === 'bearish' ||
        (currentMarketCondition.volatilityIndex > 60 && 
         currentMarketCondition.majorCoinsHealth !== 'bullish')) {
      return true;
    }
  }
  
  // For low risk tolerance agents
  if (agentConfig.riskTolerance < 4) {
    // Only trade in bullish conditions
    if (currentMarketCondition.overallMarketHealth !== 'bullish' ||
        currentMarketCondition.volatilityIndex > 40) {
      return true;
    }
  }
  
  return false;
}

/**
 * Create execution parameters for Nexus
 */
async function createExecutionParams(
  signal: TransformerSignal,
  decision: AgentDecision,
  agentConfig: AgentConfig
): Promise<ExecutionParams | null> {
  try {
    // Get agent's modifications
    const modifications = decision.modifications || {};
    
    // Create execution parameters for Nexus
    const executionParams: ExecutionParams = {
      signalId: signal.id,
      agentId: agentConfig.id,
      sourceToken: signal.sourceToken,
      targetToken: signal.targetToken,
      amount: signal.sourceAmount || 0,
      slippageBps: modifications.slippageBps || agentConfig.maxSlippageBps,
      isSimulation: false, // Real trading
      
      // Timing parameters
      executeAt: Date.now(), // Immediate execution
      expiresAt: Date.now() + 300000, // 5 minutes expiry
      
      // Exit strategy
      exitStrategy: {
        type: 'combined',
        targetTimestamp: modifications.exitTimestamp || signal.exitTimestamp || (Date.now() + 3600000), // Default 1 hour
        targetPrice: modifications.targetPrice || signal.targetPriceUsd,
        stopLoss: modifications.stopLossPercent || signal.stopLossPercent || agentConfig.stopLossPercent,
        takeProfit: modifications.takeProfitPercent || signal.takeProfitPercent || agentConfig.profitTargetPercent,
        trailingStopPercent: modifications.trailingStopPercent || 2
      },
      
      // MEV protection - defaults based on agent type
      mevProtection: {
        enabled: true,
        useJitoBundles: agentConfig.id === 'singularity', // MEV agent always uses Jito
        useStealthRouting: agentConfig.riskTolerance > 5,
        decoyTrades: agentConfig.riskTolerance > 8,
        routeFragmentation: agentConfig.riskTolerance > 7
      },
      
      // Transaction parameters
      transactionParams: {
        priorityFee: agentConfig.id === 'singularity' ? 1000000 : 100000, // High for MEV agent
        deadline: 60, // 60 seconds
        gasOptimization: 'default',
        transactionBundling: agentConfig.id === 'singularity', // Bundle for MEV agent
        maxRetries: 3
      },
      
      // Special instructions
      specialInstructions: {
        executionPriority: signal.strength === 'extreme' ? 'extreme' : 'normal',
        holdConditions: signal.holdInstructions?.overrideConditions || []
      }
    };
    
    // Apply any transaction parameters from agent decision
    if (modifications.transactionParams) {
      Object.assign(executionParams.transactionParams, modifications.transactionParams);
    }
    
    // Apply any MEV protection parameters from agent decision
    if (modifications.mevProtection) {
      Object.assign(executionParams.mevProtection, modifications.mevProtection);
    }
    
    // Apply any special instructions from agent decision
    if (modifications.specialInstructions) {
      Object.assign(executionParams.specialInstructions, modifications.specialInstructions);
    }
    
    // Apply emergency sell conditions if available
    if (signal.emergencySellConditions || modifications.emergencySellConditions) {
      executionParams.exitStrategy.type = 'combined';
      
      // Merge signal and agent emergency conditions
      const emergencyConditions = {
        ...(signal.emergencySellConditions || {}),
        ...(modifications.emergencySellConditions || {})
      };
      
      // If price drop percent is specified, use it as additional stop loss
      if (emergencyConditions.priceDropPercent) {
        // Use the more conservative (smaller) of the two
        const emergencyStopLoss = emergencyConditions.priceDropPercent;
        executionParams.exitStrategy.stopLoss = Math.min(
          executionParams.exitStrategy.stopLoss || 100,
          emergencyStopLoss
        );
      }
      
      // If time-based sell is specified, use it as additional target timestamp
      if (emergencyConditions.timeBasedSell) {
        // Use the earlier of the two
        const emergencyTimestamp = emergencyConditions.timeBasedSell;
        executionParams.exitStrategy.targetTimestamp = Math.min(
          executionParams.exitStrategy.targetTimestamp || Number.MAX_SAFE_INTEGER,
          emergencyTimestamp
        );
      }
    }
    
    return executionParams;
  } catch (error) {
    logger.error(`[AIAgents] Error creating execution parameters: ${error}`);
    return null;
  }
}

/**
 * Schedule exit strategy for executed trades
 */
function scheduleExitStrategy(
  signal: TransformerSignal,
  decision: AgentDecision,
  agentConfig: AgentConfig
): void {
  try {
    // Only schedule for executed or modified signals
    if (decision.decision !== 'execute' && decision.decision !== 'modify') {
      return;
    }
    
    // Get modifications from decision
    const modifications = decision.modifications || {};
    
    // Create exit strategy entry
    const exitId = `exit_${signal.id}`;
    const exitStrategy = {
      signalId: signal.id,
      token: signal.targetToken,
      targetTimestamp: modifications.exitTimestamp || signal.exitTimestamp || (Date.now() + 3600000), // Default 1 hour
      targetPrice: modifications.targetPrice || signal.targetPriceUsd,
      stopLoss: modifications.stopLossPercent || signal.stopLossPercent || agentConfig.stopLossPercent,
      takeProfit: modifications.takeProfitPercent || signal.takeProfitPercent || agentConfig.profitTargetPercent,
      agentId: agentConfig.id
    };
    
    // Add to scheduled exits
    scheduledExits.set(exitId, exitStrategy);
    
    logger.info(`[AIAgents] Scheduled exit strategy for ${signal.id}: stopLoss=${exitStrategy.stopLoss}%, takeProfit=${exitStrategy.takeProfit}%, targetTime=${new Date(exitStrategy.targetTimestamp).toISOString()}`);
  } catch (error) {
    logger.error(`[AIAgents] Error scheduling exit strategy: ${error}`);
  }
}

/**
 * Start monitoring scheduled exits
 */
function startExitMonitoring(): void {
  try {
    // Check scheduled exits every 30 seconds
    setInterval(async () => {
      await checkScheduledExits();
    }, 30000);
    
    logger.info(`[AIAgents] Started exit strategy monitoring`);
  } catch (error) {
    logger.error(`[AIAgents] Error starting exit monitoring: ${error}`);
  }
}

/**
 * Check scheduled exits for execution
 */
async function checkScheduledExits(): Promise<void> {
  try {
    const now = Date.now();
    
    // Get Nexus engine
    const nexusEngine = getNexusEngine();
    if (!nexusEngine) {
      logger.error(`[AIAgents] Nexus Engine not available for exit strategy execution`);
      return;
    }
    
    // Check each scheduled exit
    for (const [exitId, exit] of scheduledExits.entries()) {
      // Check if it's time to exit based on timestamp
      const timeToExit = now >= exit.targetTimestamp;
      
      if (timeToExit) {
        logger.info(`[AIAgents] Executing time-based exit for signal ${exit.signalId}`);
        
        // Prepare exit parameters
        const exitParams = {
          signalId: `exit_${exit.signalId}`,
          sourceToken: exit.token,
          targetToken: 'USDC', // Default exit to USDC
          isSimulation: false,
          reason: 'time_based_exit',
          executeImmediate: true
        };
        
        try {
          // Execute exit via Nexus Engine
          const result = await nexusEngine.executeExit(exitParams);
          
          if (result.success) {
            logger.info(`[AIAgents] Successfully executed time-based exit: ${result.signature}`);
          } else {
            logger.error(`[AIAgents] Failed to execute time-based exit: ${result.error}`);
          }
        } catch (error) {
          logger.error(`[AIAgents] Error executing time-based exit: ${error}`);
        }
        
        // Remove from scheduled exits
        scheduledExits.delete(exitId);
      } else {
        // Check if price-based exit conditions are met
        // This would require current token prices from token cache
        
        const tokenData = tokenCache.get(exit.token);
        if (tokenData) {
          // Check stop loss
          if (exit.stopLoss && tokenData.priceChange1h <= -exit.stopLoss) {
            logger.info(`[AIAgents] Executing stop-loss exit for signal ${exit.signalId}: price dropped by ${tokenData.priceChange1h}%`);
            
            // Prepare stop loss exit parameters
            const stopLossParams = {
              signalId: `stoploss_${exit.signalId}`,
              sourceToken: exit.token,
              targetToken: 'USDC',
              isSimulation: false,
              reason: 'stop_loss_triggered',
              executeImmediate: true
            };
            
            try {
              // Execute exit via Nexus Engine
              const result = await nexusEngine.executeExit(stopLossParams);
              
              if (result.success) {
                logger.info(`[AIAgents] Successfully executed stop-loss exit: ${result.signature}`);
              } else {
                logger.error(`[AIAgents] Failed to execute stop-loss exit: ${result.error}`);
              }
            } catch (error) {
              logger.error(`[AIAgents] Error executing stop-loss exit: ${error}`);
            }
            
            // Remove from scheduled exits
            scheduledExits.delete(exitId);
          }
          
          // Check take profit
          if (exit.takeProfit && tokenData.priceChange1h >= exit.takeProfit) {
            logger.info(`[AIAgents] Executing take-profit exit for signal ${exit.signalId}: price increased by ${tokenData.priceChange1h}%`);
            
            // Prepare take profit exit parameters
            const takeProfitParams = {
              signalId: `takeprofit_${exit.signalId}`,
              sourceToken: exit.token,
              targetToken: 'USDC',
              isSimulation: false,
              reason: 'take_profit_triggered',
              executeImmediate: true
            };
            
            try {
              // Execute exit via Nexus Engine
              const result = await nexusEngine.executeExit(takeProfitParams);
              
              if (result.success) {
                logger.info(`[AIAgents] Successfully executed take-profit exit: ${result.signature}`);
              } else {
                logger.error(`[AIAgents] Failed to execute take-profit exit: ${result.error}`);
              }
            } catch (error) {
              logger.error(`[AIAgents] Error executing take-profit exit: ${error}`);
            }
            
            // Remove from scheduled exits
            scheduledExits.delete(exitId);
          }
        }
      }
    }
  } catch (error) {
    logger.error(`[AIAgents] Error checking scheduled exits: ${error}`);
  }
}

/**
 * Start agent heartbeats
 */
function startAgentHeartbeats(): void {
  try {
    // Emit agent status every 60 seconds
    setInterval(() => {
      for (const [agentId, agentConfig] of agents.entries()) {
        agentEvents.emit('agent:heartbeat', {
          id: agentId,
          name: agentConfig.name,
          timestamp: Date.now(),
          active: true,
          pendingDecisions: Array.from(pendingDecisions.values())
            .filter(s => s.transformer === agentConfig.type).length,
          scheduledExits: Array.from(scheduledExits.values())
            .filter(e => e.agentId === agentId).length
        });
      }
    }, 60000);
    
    logger.info(`[AIAgents] Started agent heartbeats`);
  } catch (error) {
    logger.error(`[AIAgents] Error starting agent heartbeats: ${error}`);
  }
}

/**
 * Update token data cache
 */
async function updateTokenDataCache(): Promise<void> {
  try {
    // In a real implementation, this would fetch from price API
    // For now, we'll use placeholder values
    
    const tokens = [
      'SOL', 'USDC', 'BONK', 'JUP', 'MEME', 'GUAC', 'WIF', 'RAY'
    ];
    
    for (const token of tokens) {
      // Get existing data or create new
      const existing = tokenCache.get(token) || {
        symbol: token,
        address: '',
        usdPrice: 0,
        solPrice: 0,
        liquidity: 0,
        volume24h: 0,
        priceChange1h: 0,
        priceChange24h: 0,
        lastUpdated: 0
      };
      
      // Update with new data (simulated)
      const tokenData: TokenData = {
        ...existing,
        lastUpdated: Date.now()
      };
      
      // Add to cache
      tokenCache.set(token, tokenData);
    }
    
    // Simulated values for a few key tokens
    
    // SOL
    const sol = tokenCache.get('SOL');
    if (sol) {
      sol.usdPrice = 140.25;
      sol.solPrice = 1;
      sol.liquidity = 500000000;
      sol.volume24h = 150000000;
      sol.priceChange1h = 0.5;
      sol.priceChange24h = 2.3;
      tokenCache.set('SOL', sol);
    }
    
    // USDC
    const usdc = tokenCache.get('USDC');
    if (usdc) {
      usdc.usdPrice = 1;
      usdc.solPrice = 1 / 140.25;
      usdc.liquidity = 1000000000;
      usdc.volume24h = 500000000;
      usdc.priceChange1h = 0.01;
      usdc.priceChange24h = 0.05;
      tokenCache.set('USDC', usdc);
    }
    
    // BONK
    const bonk = tokenCache.get('BONK');
    if (bonk) {
      bonk.usdPrice = 0.00005;
      bonk.solPrice = 0.00005 / 140.25;
      bonk.liquidity = 50000000;
      bonk.volume24h = 20000000;
      bonk.priceChange1h = 3.5;
      bonk.priceChange24h = -8.2;
      tokenCache.set('BONK', bonk);
    }
    
    // MEME
    const meme = tokenCache.get('MEME');
    if (meme) {
      meme.usdPrice = 0.037;
      meme.solPrice = 0.037 / 140.25;
      meme.liquidity = 25000000;
      meme.volume24h = 15000000;
      meme.priceChange1h = 5.2;
      meme.priceChange24h = 12.5;
      tokenCache.set('MEME', meme);
    }
    
    logger.info(`[AIAgents] Updated token data cache for ${tokens.length} tokens`);
  } catch (error) {
    logger.error(`[AIAgents] Error updating token data cache: ${error}`);
  }
}

/**
 * Update market condition
 */
async function updateMarketCondition(): Promise<void> {
  try {
    // In a real implementation, this would analyze market data from various sources
    // For now, we'll use placeholder values
    
    currentMarketCondition = {
      timestamp: Date.now(),
      solPrice: 140.25,
      overallMarketHealth: 'bullish',
      volatilityIndex: 45,
      memeTokenIndex: 72,
      majorCoinsHealth: 'bullish',
      liquidityScore: 85,
      sentimentScore: 65
    };
    
    logger.info(`[AIAgents] Updated market condition: ${currentMarketCondition.overallMarketHealth}, volatility: ${currentMarketCondition.volatilityIndex}%`);
  } catch (error) {
    logger.error(`[AIAgents] Error updating market condition: ${error}`);
  }
}

/**
 * Get recent agent decisions
 */
export function getRecentAgentDecisions(limit: number = 10): AgentDecision[] {
  return decisionHistory.slice(-limit);
}

/**
 * Subscribe to agent decision events
 */
export function onAgentDecision(callback: (decision: AgentDecision) => void): () => void {
  agentEvents.on('agent:decision', callback);
  
  return () => {
    agentEvents.off('agent:decision', callback);
  };
}

/**
 * Force signal processing by an agent
 */
export function forceSignalProcessing(signal: TransformerSignal, agentId: string): void {
  processSignal(signal, agentId);
}

/**
 * Get all active agent configurations
 */
export function getAgentConfigurations(): AgentConfig[] {
  return Array.from(agents.values());
}

/**
 * Connect to neural communication hub
 */
export function connectToNeuralCommunicationHub(eventEmitter: EventEmitter2): void {
  try {
    // Save reference to neural bus
    neuralBus = eventEmitter;
    
    // Register new listeners
    registerSignalListeners();
    
    logger.info(`[AIAgents] Connected to neural communication hub`);
  } catch (error) {
    logger.error(`[AIAgents] Error connecting to neural communication hub: ${error}`);
  }
}