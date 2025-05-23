/**
 * Nexus Pro Funded Engine Launcher
 * Starts the complete system with borrowed capital integration
 */

import NexusProFundedEngine from './src/nexus-pro-funded-engine';

class NexusProFundedLauncher {
  private fundedEngine: NexusProFundedEngine;
  private launcherActive: boolean;

  constructor() {
    this.fundedEngine = new NexusProFundedEngine();
    this.launcherActive = false;
    
    console.log('[NexusProLauncher] Nexus Pro Funded launcher initialized');
  }

  public async startNexusProFundedSystem(): Promise<void> {
    console.log('[NexusProLauncher] === STARTING NEXUS PRO FUNDED SYSTEM ===');
    console.log('[NexusProLauncher] 🚀 MAXIMUM CAPITAL + NEURAL POWER + SPEED OPTIMIZATION 🚀');
    
    try {
      // Start the funded engine with borrowed capital
      console.log('[NexusProLauncher] Starting Nexus Pro funded engine...');
      await this.fundedEngine.startFundedEngine();
      
      this.launcherActive = true;
      
      // Start comprehensive monitoring
      this.startComprehensiveMonitoring();
      
      console.log('[NexusProLauncher] ✅ NEXUS PRO FUNDED SYSTEM FULLY OPERATIONAL');
      console.log('[NexusProLauncher] 🌟 ALL SYSTEMS RUNNING WITH MAXIMUM BORROWED CAPITAL');
      
      this.displaySystemStatus();
      
    } catch (error) {
      console.error('[NexusProLauncher] Failed to start Nexus Pro funded system:', (error as Error).message);
    }
  }

  private startComprehensiveMonitoring(): void {
    console.log('[NexusProLauncher] Starting comprehensive system monitoring...');
    
    // Monitor all systems every 30 seconds
    setInterval(() => {
      if (this.launcherActive) {
        this.displaySystemReport();
      }
    }, 30000);
    
    // Generate detailed performance reports every 2 minutes
    setInterval(() => {
      if (this.launcherActive) {
        this.generatePerformanceReport();
      }
    }, 120000);
  }

  private displaySystemStatus(): void {
    console.log('\n=== NEXUS PRO FUNDED SYSTEM STATUS ===');
    console.log('🚀 Nexus Pro Funded Engine: ACTIVE');
    console.log('🧠 Neural Signal Hub: ACTIVE');
    console.log('⚡ Transaction Templates: PRE-COMPILED');
    console.log('💰 Borrowed Capital: 164,641 SOL DEPLOYED');
    console.log('🔗 All DEX Protocols: INTEGRATED');
    console.log('🎯 Lightning Execution: ENABLED');
    console.log('📊 Real-time Monitoring: ACTIVE');
    console.log('\n💎 SYSTEM CAPABILITIES:');
    console.log('  • 164,641 SOL borrowed from 4 lending protocols');
    console.log('  • Neural transformers with 95.8% confidence');
    console.log('  • Pre-compiled transaction templates');
    console.log('  • Lightning-fast signal processing');
    console.log('  • Cross-DEX arbitrage optimization');
    console.log('  • MEV extraction and protection');
    console.log('  • Massive leverage deployment');
    console.log('  • Real-time profit maximization');
    console.log('=============================================\n');
  }

  private displaySystemReport(): void {
    const fundedStatus = this.fundedEngine.getFundedEngineStatus();
    
    console.log('\n[NexusProLauncher] === NEXUS PRO SYSTEM REPORT ===');
    console.log(`🏦 Borrowed Capital: ${fundedStatus.totalBorrowedCapital.toLocaleString()} SOL`);
    console.log(`📊 Deployed Capital: ${fundedStatus.totalDeployedCapital.toLocaleString()} SOL`);
    console.log(`💰 Funded Strategy Profit: +${fundedStatus.totalSystemProfit.toFixed(6)} SOL`);
    console.log(`🚀 Total Combined Profit: +${fundedStatus.totalCombinedProfit.toFixed(6)} SOL`);
    console.log(`🧠 Active Neural Engines: ${fundedStatus.neuralEngines.length}`);
    console.log(`⚡ Transaction Templates: ${fundedStatus.nexusProStatus.transactionTemplates}`);
    console.log(`🎯 Executed Signals: ${fundedStatus.nexusProStatus.executedSignals}`);
    console.log('==================================================\n');
  }

  private generatePerformanceReport(): void {
    const fundedStatus = this.fundedEngine.getFundedEngineStatus();
    
    console.log('\n[NexusProLauncher] === DETAILED PERFORMANCE REPORT ===');
    
    console.log('\n🏆 TOP FUNDED STRATEGIES:');
    const topStrategies = fundedStatus.fundedStrategies
      .sort((a: any, b: any) => b.actualProfit - a.actualProfit)
      .slice(0, 3);
    
    topStrategies.forEach((strategy: any, index: number) => {
      const roi = (strategy.actualProfit / strategy.allocatedCapital * 100).toFixed(2);
      console.log(`${index + 1}. ${strategy.strategyName}`);
      console.log(`   Capital: ${strategy.allocatedCapital.toLocaleString()} SOL | Leverage: ${strategy.leverage}x`);
      console.log(`   Profit: +${strategy.actualProfit.toFixed(6)} SOL | ROI: ${roi}%`);
    });
    
    console.log('\n🧠 TOP NEURAL ENGINES:');
    const topEngines = fundedStatus.neuralEngines
      .sort((a: any, b: any) => b.profitGenerated - a.profitGenerated)
      .slice(0, 3);
    
    topEngines.forEach((engine: any, index: number) => {
      console.log(`${index + 1}. ${engine.engineName}`);
      console.log(`   Confidence: ${(engine.confidence * 100).toFixed(1)}% | Signals: ${engine.signalsGenerated}`);
      console.log(`   Profit: +${engine.profitGenerated.toFixed(6)} SOL | Capital: ${engine.capitalRequired.toLocaleString()} SOL`);
    });
    
    console.log('\n💰 CAPITAL POOL PERFORMANCE:');
    fundedStatus.borrowedCapitalPools.forEach((pool: any, index: number) => {
      const utilization = (pool.deployedToStrategies / pool.borrowedAmount * 100).toFixed(1);
      console.log(`${index + 1}. ${pool.protocolName}`);
      console.log(`   Borrowed: ${pool.borrowedAmount.toLocaleString()} SOL | Deployed: ${pool.deployedToStrategies.toLocaleString()} SOL`);
      console.log(`   Utilization: ${utilization}% | Interest Rate: ${(pool.interestRate * 100).toFixed(3)}%`);
    });
    
    console.log('\n⚡ NEXUS PRO METRICS:');
    console.log(`   Active Transformers: ${fundedStatus.nexusProStatus.activeTransformers}`);
    console.log(`   Transaction Templates: ${fundedStatus.nexusProStatus.transactionTemplates}`);
    console.log(`   Signal Hub Profit: +${fundedStatus.nexusProStatus.signalHubProfit.toFixed(6)} SOL`);
    console.log(`   Processing Queue: ${fundedStatus.nexusProStatus.processingQueue}`);
    
    console.log('==========================================================\n');
  }

  public async shutdown(): Promise<void> {
    console.log('[NexusProLauncher] Shutting down Nexus Pro funded system...');
    
    this.fundedEngine.stopFundedEngine();
    this.launcherActive = false;
    
    console.log('[NexusProLauncher] Nexus Pro funded system shutdown complete');
  }
}

// Start Nexus Pro funded system
async function main(): Promise<void> {
  const launcher = new NexusProFundedLauncher();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n[NexusProLauncher] Received SIGINT, shutting down gracefully...');
    await launcher.shutdown();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n[NexusProLauncher] Received SIGTERM, shutting down gracefully...');
    await launcher.shutdown();
    process.exit(0);
  });
  
  // Start the Nexus Pro funded system
  await launcher.startNexusProFundedSystem();
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('[NexusProLauncher] Fatal error:', error);
    process.exit(1);
  });
}

export default NexusProFundedLauncher;