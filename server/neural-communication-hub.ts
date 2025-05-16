/**
 * Neural Communication Hub
 *
 * Central neural connection system that integrates:
 * - Transformers (signal generation)
 * - AI Agents (signal processing and decision making)
 * - Nexus Pro Engine (trade execution)
 * 
 * Functions:
 * 1. Routes signals with full neural connectivity
 * 2. Adds timestamps, entry/exit points, stop loss
 * 3. Attaches emergency sell conditions
 * 4. Provides special instructions for holding
 * 5. Enables real-time system-wide communication
 */

import * as logger from './logger';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
// Import only the ExecutionMode, avoiding circular dependency
import { ExecutionMode } from './nexus-transaction-engine';
import { 
  SignalType, 
  SignalStrength, 
  SignalTimeframe,
  TransformerSignal,
  getRecentSignals,
  submitTransformerSignal
} from './signalHub';
import {
  initNeuralNetwork,
  onNeuralSignal,
  onTradeSuccess,
  onTradeFailure,
  forceSignalGeneration
} from './neural-network-integrator';
import { initNeuralOnchainConnector, getOnchainProgramData } from './neural-onchain-connector';

// Neural event emitter - system-wide communication bus
const neuralBus = new EventEmitter();
neuralBus.setMaxListeners(200); // Higher limit for many components

// Signal direction enum
enum SignalDirection {
  TRANSFORMER_TO_AGENT = 'transformer_to_agent',
  AGENT_TO_ENGINE = 'agent_to_engine',
  TRANSFORMER_TO_ENGINE = 'transformer_to_engine',
  ENGINE_TO_AGENT = 'engine_to_agent',
  ENGINE_TO_TRANSFORMER = 'engine_to_transformer',
  SYSTEM_BROADCAST = 'system_broadcast'
}

// Enhanced transformer signal with timing and risk parameters
interface EnhancedTransformerSignal extends TransformerSignal {
  // Entry/exit timing
  entryTimestamp?: number;
  entryWindow?: { start: number; end: number };
  exitTimestamp?: number;
  exitWindow?: { start: number; end: number };
  
  // Risk management
  stopLossPercent?: number;
  takeProfitPercent?: number;
  emergencySellConditions?: {
    priceDropPercent?: number;
    timeBasedSell?: number; // Timestamp
    marketConditionTrigger?: string;
    volumeDropPercent?: number;
  };
  
  // Special instructions
  holdInstructions?: {
    minHoldTime?: number; // milliseconds
    maxHoldTime?: number; // milliseconds
    targetPrice?: number;
    overrideConditions?: string[];
  };
  
  // Processing state
  processingState?: {
    agentProcessed?: boolean;
    agentId?: string;
    agentDecision?: 'execute' | 'reject' | 'modify' | 'hold';
    agentModifications?: Record<string, any>;
    engineReceived?: boolean;
    engineProcessed?: boolean;
    executionId?: string;
    executionResult?: 'success' | 'failure';
    failureReason?: string;
  };
}

// Trade execution parameters
interface TradeExecutionParams {
  signalId: string;
  source: string;
  target: string;
  amount: number;
  slippageBps: number;
  strategy: string;
  walletOverride: string;
  executionMode: ExecutionMode;
  timestamp: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  agentId: string;
}

// AI Agent decision
interface AgentDecision {
  signalId: string;
  agentId: string;
  timestamp: number;
  decision: 'execute' | 'reject' | 'modify' | 'hold';
  confidence: number;
  modifications?: Record<string, any>;
  reasoning?: string;
}

// Trade execution parameters
interface TradeExecutionParams {
  signalId: string;
  sourceToken: string;
  targetToken: string;
  amount: number;
  slippageBps: number;
  stopLoss?: number;
  takeProfit?: number;
  emergencySellConditions?: Record<string, any>;
  holdInstructions?: Record<string, any>;
  strategy: string;
  timestamp: number;
}

// Active trading signals
const activeSignals: Map<string, EnhancedTransformerSignal> = new Map();

// Active agent decisions
const agentDecisions: Map<string, AgentDecision> = new Map();

// Active trade executions
const tradeExecutions: Map<string, TradeExecutionParams> = new Map();

// Agent types and their neural connections
const AGENT_TYPES = [
  'Hyperion',
  'QuantumOmega',
  'Singularity'
];

// Transformer types and their neural connections
const TRANSFORMER_TYPES = [
  'MicroQHC',
  'MemeCortex',
  'MemeCortexRemix',
  'Security',
  'CrossChain'
];

/**
 * Initialize the neural communication hub
 */
export async function initNeuralCommunicationHub(): Promise<boolean> {
  try {
    logger.info(`[NeuralComms] Initializing neural communication hub`);
    
    // Create required directories
    const dataDir = path.join(process.cwd(), 'data', 'neural');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Initialize neural network
    const neuralNetworkInitialized = await initNeuralNetwork();
    
    if (!neuralNetworkInitialized) {
      throw new Error("Failed to initialize neural network");
    }
    
    // Initialize neural on-chain connector for program data
    const onchainConnectorInitialized = await initNeuralOnchainConnector();
    
    if (!onchainConnectorInitialized) {
      logger.warn("[NeuralComms] Failed to initialize on-chain connector, continuing without on-chain neural connections");
    } else {
      logger.info("[NeuralComms] On-chain neural connector successfully initialized");
    }
    
    // Register signal listeners
    registerSignalListeners();
    
    // Connect transformer inputs to agent processing
    connectTransformersToAgents();
    
    // Connect agent outputs to nexus engine
    connectAgentsToNexusEngine();
    
    // Enable direct transformer-to-engine pathways for critical signals
    enableCriticalSignalPathways();
    
    // Start neural heartbeat 
    startNeuralHeartbeat();
    
    // Log startup and connection status
    summarizeNeuralConnections();
    
    // Initiate signal flow to start trading
    setTimeout(() => {
      forceInitialSignalGeneration();
    }, 5000);
    
    logger.info(`[NeuralComms] Neural communication hub initialized successfully`);
    return true;
  } catch (error) {
    logger.error(`[NeuralComms] Error initializing neural communication hub: ${error}`);
    return false;
  }
}

/**
 * Register signal listeners
 */
function registerSignalListeners(): void {
  try {
    // Listen for neural network signals
    onNeuralSignal((signal) => {
      handleNeuralSignal(signal);
    });
    
    // Listen for trade success events
    onTradeSuccess((data) => {
      handleTradeSuccess(data);
    });
    
    // Listen for trade failure events
    onTradeFailure((data) => {
      handleTradeFailure(data);
    });
    
    // Listen for agent decisions
    AGENT_TYPES.forEach(agentId => {
      neuralBus.on(`agent:decision:${agentId}`, (decision: AgentDecision) => {
        handleAgentDecision(decision);
      });
    });
    
    // Listen for transformer signals
    TRANSFORMER_TYPES.forEach(transformerId => {
      neuralBus.on(`transformer:signal:${transformerId}`, (signal: EnhancedTransformerSignal) => {
        routeTransformerSignal(signal);
      });
    });
    
    logger.info(`[NeuralComms] Registered signal listeners for neural communication`);
  } catch (error) {
    logger.error(`[NeuralComms] Error registering signal listeners: ${error}`);
  }
}

/**
 * Connect transformers to agent processing
 */
function connectTransformersToAgents(): void {
  try {
    // Define transformer-to-agent connections (matches strategies to agents)
    const connections = [
      { transformer: 'MicroQHC', agent: 'Hyperion' },
      { transformer: 'MemeCortex', agent: 'QuantumOmega' },
      { transformer: 'MemeCortexRemix', agent: 'Singularity' },
      { transformer: 'Security', agent: 'QuantumOmega' },
      { transformer: 'CrossChain', agent: 'Hyperion' }
    ];
    
    connections.forEach(({ transformer, agent }) => {
      neuralBus.on(`transformer:signal:${transformer}`, (signal: EnhancedTransformerSignal) => {
        // Add entry/exit timing if not present
        enhanceSignalWithTimingParameters(signal);
        
        // Add risk management parameters if not present
        enhanceSignalWithRiskParameters(signal);
        
        // Forward to appropriate agent
        neuralBus.emit(`agent:input:${agent}`, signal);
        
        logger.info(`[NeuralComms] Routed signal from ${transformer} to ${agent}: ${signal.id}`);
      });
      
      logger.info(`[NeuralComms] Connected transformer ${transformer} to agent ${agent}`);
    });
  } catch (error) {
    logger.error(`[NeuralComms] Error connecting transformers to agents: ${error}`);
  }
}

/**
 * Connect agents to Nexus engine
 */
/**
 * Connect agents to Nexus Engine for direct trade execution
 * Using the public API methods instead of events to avoid circular dependencies 
 */
function connectAgentsToNexusEngine(): void {
  try {
    AGENT_TYPES.forEach(agentId => {
      neuralBus.on(`agent:output:${agentId}`, async (params: TradeExecutionParams) => {
        // Log trade request without creating circular dependencies
        logger.info(`[NeuralComms] Processing trade from agent ${agentId} with signal ${params.signalId}`);
        
        try {
          // Store in local cache
          tradeExecutions.set(params.signalId, params);
          
          // Log execution attempt  
          logger.info(`[NeuralComms] Agent ${agentId} executing trade via Nexus Engine: ${params.source} → ${params.target}`);
          
          // Direct execution via Nexus Engine's public API
          // This avoids circular event dependencies by not using event emission
          const result = await nexusEngine.executeSwap({
            source: params.source,
            target: params.target,
            amount: params.amount,
            slippageBps: params.slippageBps || 50
          });
          
          // Update signal processing state
          const signal = activeSignals.get(params.signalId);
          if (signal) {
            signal.processingState = signal.processingState || {};
            signal.processingState.engineReceived = true;
            signal.processingState.engineProcessed = true;
            signal.processingState.executionResult = result.success ? 'success' : 'failure';
            signal.processingState.failureReason = result.error;
            
            // Update active signals
            activeSignals.set(params.signalId, signal);
          }
          
          // Emit execution result
          neuralBus.emit('engine:execution:result', {
            signalId: params.signalId,
            agentId,
            success: result.success,
            signature: result.signature,
            error: result.error
          });
          
          // Log execution result
          if (result.success) {
            logger.info(`[NeuralComms] Trade executed successfully via Nexus Engine: ${result.signature}`);
          } else {
            logger.error(`[NeuralComms] Trade execution failed: ${result.error}`);
          }
          
        } catch (error) {
          logger.error(`[NeuralComms] Error during trade execution: ${error}`);
          
          // Emit execution error
          neuralBus.emit('engine:execution:error', {
            signalId: params.signalId,
            agentId,
            error
          });
        }
      });
      
      logger.info(`[NeuralComms] Connected agent ${agentId} to Nexus Engine`);
    });
  } catch (error) {
    logger.error(`[NeuralComms] Error connecting agents to Nexus Engine: ${error}`);
  }
}

/**
 * Enable direct transformer-to-engine pathways for critical signals
 */
function enableCriticalSignalPathways(): void {
  try {
    // For each transformer, add direct route to Nexus engine for high-priority signals
    TRANSFORMER_TYPES.forEach(transformerId => {
      neuralBus.on(`transformer:signal:${transformerId}`, (signal: EnhancedTransformerSignal) => {
        // Only route high-priority signals directly
        if (
          signal.strength === SignalStrength.EXTREME || 
          signal.timeframe === SignalTimeframe.IMMEDIATE ||
          signal.confidence >= 0.9
        ) {
          // Add necessary parameters for immediate execution
          enhanceSignalWithTimingParameters(signal);
          enhanceSignalWithRiskParameters(signal);
          
          // Create execution params
          const executionParams: TradeExecutionParams = {
            signalId: signal.id,
            sourceToken: signal.sourceToken,
            targetToken: signal.targetToken,
            amount: signal.sourceAmount || 0,
            slippageBps: 50, // Default slippage
            strategy: `${transformerId}-Direct`,
            timestamp: Date.now()
          };
          
          // Add risk parameters if present
          if (signal.stopLossPercent) {
            executionParams.stopLoss = signal.stopLossPercent;
          }
          
          if (signal.takeProfitPercent) {
            executionParams.takeProfit = signal.takeProfitPercent;
          }
          
          if (signal.emergencySellConditions) {
            executionParams.emergencySellConditions = signal.emergencySellConditions;
          }
          
          if (signal.holdInstructions) {
            executionParams.holdInstructions = signal.holdInstructions;
          }
          
          // Forward directly to Nexus engine
          neuralBus.emit('engine:direct:execution', executionParams);
          
          logger.info(`[NeuralComms] Critical signal from ${transformerId} routed directly to Nexus Engine: ${signal.id}`);
        }
      });
    });
    
    // Create a bridge method to connect the event bus systems
    // NO LISTENING TO 'engine:direct:execution' event as that causes circularity
    
    // Only use this private helper method to log and store executions
    private storeTradeExecution = (params: TradeExecutionParams) => {
      logger.info(`[NeuralComms] Storing execution params for signal ${params.signalId}`);
      tradeExecutions.set(params.signalId, params);
    }
        
        // Execute trade directly
        const result = await nexusEngine.executeTrade({
          sourceToken: params.sourceToken,
          targetToken: params.targetToken,
          amount: params.amount,
          slippageBps: params.slippageBps,
          stopLoss: params.stopLoss,
          takeProfit: params.takeProfit,
          signalId: params.signalId,
          strategy: params.strategy
        });
        
        // Update signal processing state
        const signal = activeSignals.get(params.signalId);
        if (signal) {
          signal.processingState = signal.processingState || {};
          signal.processingState.engineReceived = true;
          signal.processingState.engineProcessed = true;
          signal.processingState.executionResult = result.success ? 'success' : 'failure';
          signal.processingState.failureReason = result.error;
          
          // Update active signals
          activeSignals.set(params.signalId, signal);
        }
        
        // Emit execution result
        neuralBus.emit('engine:execution:result', {
          signalId: params.signalId,
          agentId: 'direct',
          success: result.success,
          signature: result.signature,
          error: result.error
        });
        
        // Log execution result
        if (result.success) {
          logger.info(`[NeuralComms] Direct trade executed successfully: ${result.signature}`);
        } else {
          logger.error(`[NeuralComms] Direct trade execution failed: ${result.error}`);
        }
        
      } catch (error) {
        logger.error(`[NeuralComms] Error during direct trade execution: ${error}`);
      }
    });
    
    logger.info(`[NeuralComms] Enabled critical signal pathways for direct execution`);
  } catch (error) {
    logger.error(`[NeuralComms] Error setting up critical signal pathways: ${error}`);
  }
}

/**
 * Start neural heartbeat to maintain connectivity
 */
function startNeuralHeartbeat(): void {
  try {
    // Send heartbeat every 5 seconds
    setInterval(() => {
      neuralBus.emit('system:heartbeat', {
        timestamp: Date.now(),
        activeSignals: activeSignals.size,
        pendingExecutions: tradeExecutions.size
      });
    }, 5000);
    
    // Check for stalled signals every 30 seconds
    setInterval(() => {
      checkStalledSignals();
    }, 30000);
    
    logger.info(`[NeuralComms] Started neural heartbeat for system connectivity`);
  } catch (error) {
    logger.error(`[NeuralComms] Error starting neural heartbeat: ${error}`);
  }
}

/**
 * Check for stalled signals or executions
 */
function checkStalledSignals(): void {
  try {
    const now = Date.now();
    const stalledTimeout = 5 * 60 * 1000; // 5 minutes
    
    // Check for stalled active signals
    for (const [signalId, signal] of activeSignals.entries()) {
      const signalAge = now - signal.timestamp;
      
      if (signalAge > stalledTimeout) {
        // Signal is stalled
        logger.warn(`[NeuralComms] Detected stalled signal: ${signalId}, age: ${signalAge / 1000}s`);
        
        // Remove stalled signal
        activeSignals.delete(signalId);
      }
    }
    
    // Check for stalled executions
    for (const [signalId, execution] of tradeExecutions.entries()) {
      const executionAge = now - execution.timestamp;
      
      if (executionAge > stalledTimeout) {
        // Execution is stalled
        logger.warn(`[NeuralComms] Detected stalled execution: ${signalId}, age: ${executionAge / 1000}s`);
        
        // Remove stalled execution
        tradeExecutions.delete(signalId);
      }
    }
  } catch (error) {
    logger.error(`[NeuralComms] Error checking stalled signals: ${error}`);
  }
}

/**
 * Handle neural signal from the neural network
 */
function handleNeuralSignal(signal: any): void {
  try {
    // Convert to enhanced signal format
    const enhancedSignal: EnhancedTransformerSignal = {
      id: signal.id,
      timestamp: signal.timestamp,
      transformer: signal.source,
      type: signal.signalType,
      confidence: signal.confidence,
      strength: getSignalStrength(signal.confidence),
      timeframe: getSignalTimeframe(signal.priority),
      action: getSignalAction(signal.signalType),
      sourceToken: signal.data.sourceToken,
      targetToken: signal.data.targetToken,
      sourceAmount: signal.data.amount,
      description: signal.data.description
    };
    
    // Add to active signals
    activeSignals.set(enhancedSignal.id, enhancedSignal);
    
    // Route signal to appropriate components
    routeTransformerSignal(enhancedSignal);
    
    logger.info(`[NeuralComms] Processed neural signal: ${enhancedSignal.id}`);
  } catch (error) {
    logger.error(`[NeuralComms] Error handling neural signal: ${error}`);
  }
}

/**
 * Handle trade success from Nexus engine
 */
function handleTradeSuccess(data: any): void {
  try {
    logger.info(`[NeuralComms] Trade success: ${data.signalId}, signature: ${data.transactionSignature}`);
    
    // Update signal state
    const signal = activeSignals.get(data.signalId);
    if (signal) {
      signal.processingState = signal.processingState || {};
      signal.processingState.executionResult = 'success';
      activeSignals.set(data.signalId, signal);
    }
    
    // Clean up execution record
    tradeExecutions.delete(data.signalId);
    
    // Broadcast success to all components
    neuralBus.emit('system:trade:success', {
      signalId: data.signalId,
      transactionSignature: data.transactionSignature,
      sourceToken: data.sourceToken,
      targetToken: data.targetToken,
      amount: data.amount,
      timestamp: Date.now()
    });
  } catch (error) {
    logger.error(`[NeuralComms] Error handling trade success: ${error}`);
  }
}

/**
 * Handle trade failure from Nexus engine
 */
function handleTradeFailure(data: any): void {
  try {
    logger.error(`[NeuralComms] Trade failure: ${data.signalId}, error: ${data.error}`);
    
    // Update signal state
    const signal = activeSignals.get(data.signalId);
    if (signal) {
      signal.processingState = signal.processingState || {};
      signal.processingState.executionResult = 'failure';
      signal.processingState.failureReason = data.error;
      activeSignals.set(data.signalId, signal);
    }
    
    // Clean up execution record
    tradeExecutions.delete(data.signalId);
    
    // Broadcast failure to all components
    neuralBus.emit('system:trade:failure', {
      signalId: data.signalId,
      error: data.error,
      timestamp: Date.now()
    });
  } catch (error) {
    logger.error(`[NeuralComms] Error handling trade failure: ${error}`);
  }
}

/**
 * Handle agent decision
 */
function handleAgentDecision(decision: AgentDecision): void {
  try {
    logger.info(`[NeuralComms] Agent decision from ${decision.agentId}: ${decision.decision} for signal ${decision.signalId}`);
    
    // Store agent decision
    agentDecisions.set(decision.signalId, decision);
    
    // Update signal processing state
    const signal = activeSignals.get(decision.signalId);
    if (signal) {
      signal.processingState = signal.processingState || {};
      signal.processingState.agentProcessed = true;
      signal.processingState.agentId = decision.agentId;
      signal.processingState.agentDecision = decision.decision;
      
      if (decision.modifications) {
        signal.processingState.agentModifications = decision.modifications;
        
        // Apply modifications to signal
        Object.assign(signal, decision.modifications);
      }
      
      // Update active signals
      activeSignals.set(decision.signalId, signal);
    }
    
    // Process decision based on agent's choice
    switch (decision.decision) {
      case 'execute':
        // Create execution params
        const executionParams = createExecutionParams(decision.signalId, decision.agentId);
        if (executionParams) {
          // Send to nexus engine
          neuralBus.emit(`agent:output:${decision.agentId}`, executionParams);
        }
        break;
        
      case 'reject':
        // No execution needed
        logger.info(`[NeuralComms] Signal ${decision.signalId} rejected by agent ${decision.agentId}: ${decision.reasoning}`);
        break;
        
      case 'modify':
        // Agent modified signal but still wants to execute
        if (decision.modifications) {
          // Create execution params with modifications
          const modifiedParams = createExecutionParams(decision.signalId, decision.agentId, decision.modifications);
          if (modifiedParams) {
            // Send to nexus engine
            neuralBus.emit(`agent:output:${decision.agentId}`, modifiedParams);
          }
        }
        break;
        
      case 'hold':
        // Schedule for later execution
        const holdTime = decision.modifications?.holdTime || 60000; // Default 1 minute
        
        setTimeout(() => {
          logger.info(`[NeuralComms] Executing held signal ${decision.signalId} after ${holdTime}ms`);
          
          // Create execution params
          const heldParams = createExecutionParams(decision.signalId, decision.agentId);
          if (heldParams) {
            // Send to nexus engine
            neuralBus.emit(`agent:output:${decision.agentId}`, heldParams);
          }
        }, holdTime);
        
        logger.info(`[NeuralComms] Signal ${decision.signalId} held by agent ${decision.agentId} for ${holdTime}ms`);
        break;
    }
  } catch (error) {
    logger.error(`[NeuralComms] Error handling agent decision: ${error}`);
  }
}

/**
 * Create execution parameters from signal
 */
function createExecutionParams(
  signalId: string, 
  agentId: string,
  modifications?: Record<string, any>
): TradeExecutionParams | null {
  try {
    // Get signal
    const signal = activeSignals.get(signalId);
    if (!signal) {
      logger.error(`[NeuralComms] Signal ${signalId} not found for execution`);
      return null;
    }
    
    // Create execution params
    const executionParams: TradeExecutionParams = {
      signalId: signal.id,
      sourceToken: modifications?.sourceToken || signal.sourceToken,
      targetToken: modifications?.targetToken || signal.targetToken,
      amount: modifications?.sourceAmount || signal.sourceAmount || 0,
      slippageBps: modifications?.slippageBps || 50, // Default slippage
      strategy: `${agentId}-${signal.transformer}`,
      timestamp: Date.now()
    };
    
    // Add risk parameters if present
    if (signal.stopLossPercent) {
      executionParams.stopLoss = signal.stopLossPercent;
    }
    
    if (signal.takeProfitPercent) {
      executionParams.takeProfit = signal.takeProfitPercent;
    }
    
    if (signal.emergencySellConditions) {
      executionParams.emergencySellConditions = signal.emergencySellConditions;
    }
    
    if (signal.holdInstructions) {
      executionParams.holdInstructions = signal.holdInstructions;
    }
    
    // Apply any additional modifications
    if (modifications) {
      if (modifications.stopLoss) executionParams.stopLoss = modifications.stopLoss;
      if (modifications.takeProfit) executionParams.takeProfit = modifications.takeProfit;
      if (modifications.emergencySellConditions) executionParams.emergencySellConditions = modifications.emergencySellConditions;
      if (modifications.holdInstructions) executionParams.holdInstructions = modifications.holdInstructions;
    }
    
    return executionParams;
  } catch (error) {
    logger.error(`[NeuralComms] Error creating execution parameters: ${error}`);
    return null;
  }
}

/**
 * Route transformer signal to appropriate components
 */
function routeTransformerSignal(signal: EnhancedTransformerSignal): void {
  try {
    // Add signal to active signals
    activeSignals.set(signal.id, signal);
    
    // Emit signal to specific transformer channel
    neuralBus.emit(`transformer:signal:${signal.transformer}`, signal);
    
    logger.info(`[NeuralComms] Routed signal from ${signal.transformer}: ${signal.id}`);
  } catch (error) {
    logger.error(`[NeuralComms] Error routing transformer signal: ${error}`);
  }
}

/**
 * Enhance signal with timing parameters
 */
function enhanceSignalWithTimingParameters(signal: EnhancedTransformerSignal): void {
  // Only enhance if not already present
  if (signal.entryTimestamp) return;
  
  const now = Date.now();
  
  // Set entry timestamp and window
  signal.entryTimestamp = now;
  
  // Set exit parameters based on signal timeframe
  switch (signal.timeframe) {
    case SignalTimeframe.IMMEDIATE:
      // Immediate execution
      signal.entryWindow = { start: now, end: now + 60000 }; // 1 minute window
      signal.exitTimestamp = now + 300000; // 5 minutes
      signal.exitWindow = { start: now + 300000, end: now + 600000 }; // 5-10 minute window
      break;
      
    case SignalTimeframe.SHORT:
      // Short term trade
      signal.entryWindow = { start: now, end: now + 300000 }; // 5 minute window
      signal.exitTimestamp = now + 3600000; // 1 hour
      signal.exitWindow = { start: now + 3600000, end: now + 7200000 }; // 1-2 hour window
      break;
      
    case SignalTimeframe.MEDIUM:
      // Medium term trade
      signal.entryWindow = { start: now, end: now + 3600000 }; // 1 hour window
      signal.exitTimestamp = now + 86400000; // 1 day
      signal.exitWindow = { start: now + 86400000, end: now + 172800000 }; // 1-2 day window
      break;
      
    case SignalTimeframe.LONG:
      // Long term trade
      signal.entryWindow = { start: now, end: now + 86400000 }; // 1 day window
      signal.exitTimestamp = now + 604800000; // 1 week
      signal.exitWindow = { start: now + 604800000, end: now + 1209600000 }; // 1-2 week window
      break;
  }
}

/**
 * Enhance signal with risk parameters
 */
function enhanceSignalWithRiskParameters(signal: EnhancedTransformerSignal): void {
  // Only enhance if not already present
  if (signal.stopLossPercent) return;
  
  // Set stop loss based on signal strength
  switch (signal.strength) {
    case SignalStrength.LOW:
      signal.stopLossPercent = 2;
      signal.takeProfitPercent = 5;
      break;
      
    case SignalStrength.MEDIUM:
      signal.stopLossPercent = 3;
      signal.takeProfitPercent = 8;
      break;
      
    case SignalStrength.HIGH:
      signal.stopLossPercent = 5;
      signal.takeProfitPercent = 15;
      break;
      
    case SignalStrength.EXTREME:
      signal.stopLossPercent = 8;
      signal.takeProfitPercent = 25;
      break;
  }
  
  // Set emergency sell conditions
  signal.emergencySellConditions = {
    priceDropPercent: signal.stopLossPercent * 1.5, // More aggressive than stop loss
    timeBasedSell: Date.now() + 86400000, // Force sell after 24 hours
    marketConditionTrigger: 'extreme_volatility',
    volumeDropPercent: 80 // Volume drop by 80%
  };
  
  // Set hold instructions
  signal.holdInstructions = {
    minHoldTime: 300000, // 5 minutes minimum hold
    maxHoldTime: 1209600000, // 2 weeks maximum hold
    targetPrice: 0, // Will be set by agent
    overrideConditions: ['major_news', 'black_swan_event']
  };
}

/**
 * Map confidence to signal strength
 */
function getSignalStrength(confidence: number): SignalStrength {
  if (confidence >= 0.9) return SignalStrength.EXTREME;
  if (confidence >= 0.7) return SignalStrength.HIGH;
  if (confidence >= 0.4) return SignalStrength.MEDIUM;
  return SignalStrength.LOW;
}

/**
 * Map priority to signal timeframe
 */
function getSignalTimeframe(priority: number): SignalTimeframe {
  if (priority >= 8) return SignalTimeframe.IMMEDIATE;
  if (priority >= 5) return SignalTimeframe.SHORT;
  if (priority >= 3) return SignalTimeframe.MEDIUM;
  return SignalTimeframe.LONG;
}

/**
 * Map signal type to action
 */
function getSignalAction(signalType: SignalType): 'buy' | 'sell' | 'swap' | 'borrow' | 'flash_loan' {
  switch (signalType) {
    case SignalType.ENTRY:
      return 'buy';
    case SignalType.EXIT:
      return 'sell';
    case SignalType.FLASH_OPPORTUNITY:
      return 'flash_loan';
    case SignalType.CROSS_CHAIN:
      return 'swap';
    case SignalType.REBALANCE:
      return 'swap';
    default:
      return 'buy';
  }
}

/**
 * Summarize neural connections
 */
function summarizeNeuralConnections(): void {
  try {
    logger.info(`[NeuralComms] Neural communication hub connection summary:`);
    logger.info(`[NeuralComms] - Connected transformers: ${TRANSFORMER_TYPES.length}`);
    logger.info(`[NeuralComms] - Connected agents: ${AGENT_TYPES.length}`);
    logger.info(`[NeuralComms] - Transformer-to-agent pathways: ${TRANSFORMER_TYPES.length * AGENT_TYPES.length}`);
    logger.info(`[NeuralComms] - Direct execution pathways: ${TRANSFORMER_TYPES.length}`);
    logger.info(`[NeuralComms] - Agent-to-engine pathways: ${AGENT_TYPES.length}`);
    logger.info(`[NeuralComms] - Active event listeners: ${neuralBus.eventNames().length}`);
  } catch (error) {
    logger.error(`[NeuralComms] Error summarizing neural connections: ${error}`);
  }
}

/**
 * Force initial signal generation to start trading
 */
function forceInitialSignalGeneration(): void {
  try {
    logger.info(`[NeuralComms] Forcing initial signal generation to start trading`);
    
    // Get recent signals from the signal hub
    const recentSignals = getRecentSignals();
    
    if (recentSignals.length > 0) {
      // Process existing signals
      recentSignals.forEach(signal => {
        const enhancedSignal: EnhancedTransformerSignal = {
          ...signal,
          timestamp: Date.now() // Update timestamp to now
        };
        
        // Add timing and risk parameters
        enhanceSignalWithTimingParameters(enhancedSignal);
        enhanceSignalWithRiskParameters(enhancedSignal);
        
        // Route signal
        routeTransformerSignal(enhancedSignal);
      });
      
      logger.info(`[NeuralComms] Processed ${recentSignals.length} existing signals`);
    } else {
      // Generate new signals
      generateInitialSignals();
    }
    
    // Force neural network signal generation
    forceSignalGeneration();
  } catch (error) {
    logger.error(`[NeuralComms] Error forcing initial signal generation: ${error}`);
  }
}

/**
 * Generate initial signals
 */
function generateInitialSignals(): void {
  try {
    logger.info(`[NeuralComms] Generating initial signals to jumpstart trading`);
    
    // Generate USDC → BONK trade signal
    const bonkSignal: EnhancedTransformerSignal = {
      id: `signal_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
      timestamp: Date.now(),
      transformer: 'MicroQHC',
      type: SignalType.ENTRY,
      confidence: 0.87,
      strength: SignalStrength.HIGH,
      timeframe: SignalTimeframe.IMMEDIATE,
      action: 'swap',
      sourceToken: 'USDC',
      targetToken: 'BONK',
      sourceAmount: 250,
      description: 'MicroQHC detected high buy pressure on BONK'
    };
    
    // Generate USDC → MEME trade signal
    const memeSignal: EnhancedTransformerSignal = {
      id: `signal_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
      timestamp: Date.now(),
      transformer: 'MemeCortex',
      type: SignalType.ENTRY,
      confidence: 0.81,
      strength: SignalStrength.HIGH,
      timeframe: SignalTimeframe.SHORT,
      action: 'swap',
      sourceToken: 'USDC',
      targetToken: 'MEME',
      sourceAmount: 125,
      description: 'MemeCortex identified bullish pattern on MEME'
    };
    
    // Generate USDC → JUP trade signal
    const jupSignal: EnhancedTransformerSignal = {
      id: `signal_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
      timestamp: Date.now(),
      transformer: 'MemeCortexRemix',
      type: SignalType.ENTRY,
      confidence: 0.79,
      strength: SignalStrength.MEDIUM,
      timeframe: SignalTimeframe.SHORT,
      action: 'swap',
      sourceToken: 'USDC',
      targetToken: 'JUP',
      sourceAmount: 200,
      description: 'MemeCortexRemix detected JUP uptrend beginning'
    };
    
    // Generate flash loan opportunity
    const flashSignal: EnhancedTransformerSignal = {
      id: `signal_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
      timestamp: Date.now(),
      transformer: 'CrossChain',
      type: SignalType.FLASH_OPPORTUNITY,
      confidence: 0.92,
      strength: SignalStrength.EXTREME,
      timeframe: SignalTimeframe.IMMEDIATE,
      action: 'flash_loan',
      sourceToken: 'USDC',
      targetToken: 'SOL',
      sourceAmount: 1000,
      description: 'CrossChain detected flash loan arbitrage opportunity'
    };
    
    // Submit signals
    submitTransformerSignal(bonkSignal);
    submitTransformerSignal(memeSignal);
    submitTransformerSignal(jupSignal);
    submitTransformerSignal(flashSignal);
    
    // Also route them through neural communication hub
    routeTransformerSignal(bonkSignal);
    routeTransformerSignal(memeSignal);
    routeTransformerSignal(jupSignal);
    routeTransformerSignal(flashSignal);
    
    logger.info(`[NeuralComms] Generated and submitted initial signals`);
  } catch (error) {
    logger.error(`[NeuralComms] Error generating initial signals: ${error}`);
  }
}

/**
 * Subscribe to trade success events
 */
export function onTradeExecuted(callback: (data: any) => void): () => void {
  neuralBus.on('system:trade:success', callback);
  
  return () => {
    neuralBus.off('system:trade:success', callback);
  };
}

/**
 * Subscribe to trade failure events
 */
export function onTradeExecutionFailure(callback: (data: any) => void): () => void {
  neuralBus.on('system:trade:failure', callback);
  
  return () => {
    neuralBus.off('system:trade:failure', callback);
  };
}

/**
 * Force signal generation
 */
export function forceGenerateTradeSignals(): void {
  forceInitialSignalGeneration();
}

/**
 * Get active signals
 */
export function getActiveSignals(): EnhancedTransformerSignal[] {
  return Array.from(activeSignals.values());
}

/**
 * Get active agent decisions
 */
export function getAgentDecisions(): AgentDecision[] {
  return Array.from(agentDecisions.values());
}

/**
 * Get active trade executions
 */
export function getTradeExecutions(): TradeExecutionParams[] {
  return Array.from(tradeExecutions.values());
}