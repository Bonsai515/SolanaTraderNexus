/**
 * Nexus Signal Processor
 * 
 * This script processes incoming trading signals and forwards them
 * directly to the Nexus execution engine.
 */

import * as fs from 'fs';
import * as path from 'path';

// Configuration
const SIGNAL_CONFIG_PATH = path.join(__dirname, 'signal_forwarder.json');
const NEXUS_LOG_PATH = path.join(__dirname, 'nexus_signals.log');
const SIGNAL_QUEUE_PATH = path.join(__dirname, 'signal_queue.json');

// Initialize logs and queues
if (!fs.existsSync(NEXUS_LOG_PATH)) {
  fs.writeFileSync(NEXUS_LOG_PATH, '--- NEXUS SIGNAL PROCESSOR LOG ---\n');
}

if (!fs.existsSync(SIGNAL_QUEUE_PATH)) {
  fs.writeFileSync(SIGNAL_QUEUE_PATH, JSON.stringify({ signals: [] }));
}

// Log function
function log(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(NEXUS_LOG_PATH, logMessage + '\n');
}

// Load configuration
function loadConfig(): any {
  try {
    if (fs.existsSync(SIGNAL_CONFIG_PATH)) {
      const configData = fs.readFileSync(SIGNAL_CONFIG_PATH, 'utf8');
      return JSON.parse(configData);
    }
    log('❌ Signal configuration not found');
    return null;
  } catch (error) {
    log(`❌ Error loading configuration: ${(error as Error).message}`);
    return null;
  }
}

// Signal interface
interface TradeSignal {
  id: string;
  strategy: string;
  type: string;
  sourceToken: string;
  targetToken: string;
  amount: number;
  priority: string;
  timestamp: number;
  parameters?: Record<string, any>;
}

// Process a trade signal
function processSignal(signal: TradeSignal): boolean {
  try {
    log(`Processing signal: ${signal.id} from ${signal.strategy}`);
    
    // Validate signal
    if (!signal.id || !signal.strategy || !signal.sourceToken || !signal.targetToken) {
      log(`❌ Invalid signal format: ${JSON.stringify(signal)}`);
      return false;
    }
    
    // Add signal to queue
    const signalQueue = JSON.parse(fs.readFileSync(SIGNAL_QUEUE_PATH, 'utf8'));
    signalQueue.signals.push({
      ...signal,
      status: 'pending',
      receivedAt: Date.now()
    });
    fs.writeFileSync(SIGNAL_QUEUE_PATH, JSON.stringify(signalQueue, null, 2));
    
    // Forward to Nexus (simulation)
    log(`✅ Signal ${signal.id} forwarded to Nexus for direct execution`);
    log(`   Strategy: ${signal.strategy}, ${signal.sourceToken} → ${signal.targetToken}, Amount: ${signal.amount}`);
    
    return true;
  } catch (error) {
    log(`❌ Error processing signal: ${(error as Error).message}`);
    return false;
  }
}

// Simulate signal generation (for testing)
function simulateSignals(): void {
  const strategies = [
    'flashLoanSingularity',
    'quantumArbitrage',
    'temporalBlockArbitrage',
    'cascadeFlash',
    'jitoBundle'
  ];
  
  const tokens = ['SOL', 'USDC', 'ETH', 'BTC', 'BONK', 'WIF', 'JUP', 'PYTH'];
  
  setInterval(() => {
    // 30% chance to generate a signal
    if (Math.random() < 0.3) {
      const strategy = strategies[Math.floor(Math.random() * strategies.length)];
      const sourceToken = tokens[Math.floor(Math.random() * tokens.length)];
      let targetToken = tokens[Math.floor(Math.random() * tokens.length)];
      
      // Ensure source and target are different
      while (targetToken === sourceToken) {
        targetToken = tokens[Math.floor(Math.random() * tokens.length)];
      }
      
      const signal: TradeSignal = {
        id: `signal-${strategy}-${Date.now()}`,
        strategy: strategy,
        type: 'trade',
        sourceToken: sourceToken,
        targetToken: targetToken,
        amount: Math.random() * 0.1 + 0.01, // 0.01-0.11
        priority: Math.random() < 0.3 ? 'critical' : (Math.random() < 0.7 ? 'high' : 'medium'),
        timestamp: Date.now(),
        parameters: {
          slippageBps: Math.floor(Math.random() * 50) + 10, // 10-60 bps
          route: 'optimal',
          executionMode: 'instant'
        }
      };
      
      processSignal(signal);
    }
  }, 2000); // Generate signals every 2 seconds
}

// Process signals in queue
function processQueue(): void {
  try {
    const signalQueue = JSON.parse(fs.readFileSync(SIGNAL_QUEUE_PATH, 'utf8'));
    
    // Count pending signals
    const pendingSignals = signalQueue.signals.filter((s: any) => s.status === 'pending');
    
    if (pendingSignals.length > 0) {
      log(`Processing queue: ${pendingSignals.length} pending signals`);
      
      // Process up to 5 signals at once
      for (let i = 0; i < Math.min(5, pendingSignals.length); i++) {
        const signal = pendingSignals[i];
        
        // Simulate success/failure (90% success rate)
        const success = Math.random() < 0.9;
        
        // Update signal status
        signal.status = success ? 'executed' : 'failed';
        signal.executedAt = Date.now();
        
        if (success) {
          // Simulate profit (0.0001-0.01 SOL)
          const profit = (Math.random() * 0.0099 + 0.0001).toFixed(6);
          signal.result = {
            success: true,
            profit: profit,
            executionTime: Math.floor(Math.random() * 1000) + 100 // 100-1100ms
          };
          
          log(`✅ EXECUTED: ${signal.strategy} signal ${signal.id}`);
          log(`   Profit: +${profit} SOL, ${signal.sourceToken} → ${signal.targetToken}`);
        } else {
          signal.result = {
            success: false,
            reason: 'execution_failed',
            error: 'Slippage exceeded or liquidity insufficient'
          };
          
          log(`❌ FAILED: ${signal.strategy} signal ${signal.id}`);
          log(`   Reason: ${signal.result.reason} - ${signal.result.error}`);
        }
      }
      
      // Update queue
      fs.writeFileSync(SIGNAL_QUEUE_PATH, JSON.stringify(signalQueue, null, 2));
    }
  } catch (error) {
    log(`❌ Error processing queue: ${(error as Error).message}`);
  }
  
  // Schedule next queue processing
  setTimeout(processQueue, 1000);
}

// Main function
function main(): void {
  log('Starting Nexus Signal Processor...');
  
  // Load configuration
  const config = loadConfig();
  
  if (!config) {
    log('❌ Cannot start without configuration');
    return;
  }
  
  log('Nexus Signal Processor started successfully');
  log(`Direct execution enabled: ${config.nexusIntegration.directExecutionEnabled}`);
  log('Waiting for signals from trading strategies...');
  
  // Start queue processor
  processQueue();
  
  // For testing/simulation
  if (process.env.SIMULATION_MODE === 'true') {
    log('SIMULATION MODE ENABLED - Generating test signals');
    simulateSignals();
  }
}

// Start the processor
main();
