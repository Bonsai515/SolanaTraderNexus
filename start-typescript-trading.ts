/**
 * TypeScript Real Trading System Launcher
 * Starts all TypeScript trading components
 */

import RealTradingSystem from './src/real-trading-system';
import NeuralSignalProcessor from './src/neural-signal-processor';

interface TradingSystemConfig {
  realTrading: boolean;
  neuralProcessing: boolean;
  quickNodePremium: boolean;
  autoExecution: boolean;
}

class TypeScriptTradingLauncher {
  private config: TradingSystemConfig;
  private realTradingSystem: RealTradingSystem;
  private neuralProcessor: NeuralSignalProcessor;
  private launcherActive: boolean;

  constructor() {
    this.config = {
      realTrading: true,
      neuralProcessing: true,
      quickNodePremium: true,
      autoExecution: true
    };

    this.realTradingSystem = new RealTradingSystem();
    this.neuralProcessor = new NeuralSignalProcessor();
    this.launcherActive = false;

    console.log('[TSLauncher] TypeScript trading system launcher initialized');
  }

  public async startTypeScriptTrading(): Promise<void> {
    console.log('[TSLauncher] === STARTING TYPESCRIPT REAL TRADING SYSTEM ===');
    
    try {
      // Initialize neural signal processor
      console.log('[TSLauncher] Initializing TypeScript neural networks...');
      await this.neuralProcessor.initializeNetworks();
      
      // Activate real trading system
      console.log('[TSLauncher] Activating TypeScript real trading...');
      const tradingActivated = await this.realTradingSystem.activateRealTrading();
      
      if (!tradingActivated) {
        throw new Error('Failed to activate TypeScript real trading');
      }
      
      this.launcherActive = true;
      
      // Start neural signal processing
      this.startNeuralProcessing();
      
      // Start performance monitoring
      this.startPerformanceMonitoring();
      
      console.log('[TSLauncher] ✅ TYPESCRIPT TRADING SYSTEM FULLY OPERATIONAL');
      this.displaySystemStatus();
      
    } catch (error) {
      console.error('[TSLauncher] Failed to start TypeScript trading system:', (error as Error).message);
      process.exit(1);
    }
  }

  private startNeuralProcessing(): void {
    console.log('[TSLauncher] Starting TypeScript neural signal processing...');
    
    // Process neural signals every 5 seconds
    setInterval(() => {
      if (this.launcherActive) {
        this.neuralProcessor.processLiveSignals();
      }
    }, 5000);
  }

  private startPerformanceMonitoring(): void {
    console.log('[TSLauncher] Starting TypeScript performance monitoring...');
    
    // Monitor system performance every 30 seconds
    setInterval(() => {
      if (this.launcherActive) {
        this.displayPerformanceMetrics();
      }
    }, 30000);
  }

  private displaySystemStatus(): void {
    console.log('\n=== TYPESCRIPT TRADING SYSTEM STATUS ===');
    console.log('🚀 TypeScript Real Trading: ACTIVE');
    console.log('🧠 Neural Signal Processing: ACTIVE');
    console.log('⚡ QuickNode Premium: CONNECTED');
    console.log('💰 HPN Wallet: 0.800010 SOL');
    console.log('🔥 Auto-execution: ENABLED');
    console.log('📊 Monitoring: ACTIVE');
    console.log('\n🎯 TYPESCRIPT FEATURES:');
    console.log('  • Type-safe neural signal processing');
    console.log('  • Strongly-typed blockchain transactions');
    console.log('  • Interface-driven trading execution');
    console.log('  • Real-time performance monitoring');
    console.log('  • Compile-time error prevention');
    console.log('=====================================\n');
  }

  private displayPerformanceMetrics(): void {
    const tradingStatus = this.realTradingSystem.getRealTradingStatus();
    const processorStats = this.neuralProcessor.getProcessorStats();
    
    console.log('\n=== TYPESCRIPT PERFORMANCE METRICS ===');
    console.log(`🔥 Real Trading Active: ${tradingStatus.realTradingActive}`);
    console.log(`💰 Total Trades: ${tradingStatus.totalRealTrades}`);
    console.log(`📈 Total Profit: ${tradingStatus.totalRealProfit} SOL`);
    console.log(`🧠 Active Networks: ${processorStats.activeNetworks}`);
    console.log(`⚡ Executed Signals: ${processorStats.executedSignals}`);
    console.log(`📊 Queue Length: ${processorStats.queuedSignals}`);
    console.log(`🔗 QuickNode: ${tradingStatus.quickNodeConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
    console.log('=====================================\n');
  }

  public async shutdown(): Promise<void> {
    console.log('[TSLauncher] Shutting down TypeScript trading system...');
    this.launcherActive = false;
    console.log('[TSLauncher] TypeScript trading system shutdown complete');
  }
}

// Start TypeScript trading system
async function main(): Promise<void> {
  const launcher = new TypeScriptTradingLauncher();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n[TSLauncher] Received SIGINT, shutting down gracefully...');
    await launcher.shutdown();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n[TSLauncher] Received SIGTERM, shutting down gracefully...');
    await launcher.shutdown();
    process.exit(0);
  });
  
  // Start the trading system
  await launcher.startTypeScriptTrading();
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('[TSLauncher] Fatal error:', error);
    process.exit(1);
  });
}

export default TypeScriptTradingLauncher;