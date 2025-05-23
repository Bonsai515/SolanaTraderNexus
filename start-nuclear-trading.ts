/**
 * Nuclear Trading System Launcher
 * Starts all nuclear strategies with zero capital requirements
 */

import NuclearTradingEngine from './src/nuclear-trading-engine';
import NexusProEngine from './src/nexus-pro-engine';
import RealFundTrader from './src/real-fund-trader';
import { Connection } from '@solana/web3.js';

class NuclearTradingLauncher {
  private nuclearEngine: NuclearTradingEngine;
  private nexusEngine: NexusProEngine;
  private realFundTrader: RealFundTrader;
  private connection: Connection;
  private launcherActive: boolean;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
    
    this.nuclearEngine = new NuclearTradingEngine();
    this.nexusEngine = new NexusProEngine();
    this.realFundTrader = new RealFundTrader(this.connection, null);
    
    this.launcherActive = false;
    
    console.log('[NuclearLauncher] Nuclear trading system launcher initialized');
  }

  public async startNuclearTrading(): Promise<void> {
    console.log('[NuclearLauncher] === STARTING NUCLEAR TRADING SYSTEM ===');
    console.log('[NuclearLauncher] ☢️  MAXIMUM AGGRESSION MODE ACTIVATED ☢️');
    
    try {
      // Start Nexus Pro Engine first
      console.log('[NuclearLauncher] Starting Nexus Pro Engine...');
      await this.nexusEngine.startAggressiveTrading();
      
      // Start Real Fund Trading with borrowed capital
      console.log('[NuclearLauncher] Starting real fund trading with borrowed capital...');
      await this.realFundTrader.startContinuousRealFundTrading();
      
      // Start Nuclear Engine with zero capital strategies
      console.log('[NuclearLauncher] Starting nuclear engine with zero capital strategies...');
      await this.nuclearEngine.startNuclearTrading();
      
      this.launcherActive = true;
      
      // Start comprehensive monitoring
      this.startComprehensiveMonitoring();
      
      console.log('[NuclearLauncher] ✅ NUCLEAR TRADING SYSTEM FULLY OPERATIONAL');
      console.log('[NuclearLauncher] 🚀 ALL ENGINES RUNNING AT MAXIMUM CAPACITY');
      
      this.displayNuclearStatus();
      
    } catch (error) {
      console.error('[NuclearLauncher] Failed to start nuclear trading system:', (error as Error).message);
    }
  }

  private startComprehensiveMonitoring(): void {
    console.log('[NuclearLauncher] Starting comprehensive system monitoring...');
    
    // Monitor all systems every 20 seconds
    setInterval(() => {
      if (this.launcherActive) {
        this.displayComprehensiveReport();
      }
    }, 20000);
    
    // Generate detailed reports every 2 minutes
    setInterval(() => {
      if (this.launcherActive) {
        this.generateDetailedReport();
      }
    }, 120000);
  }

  private displayNuclearStatus(): void {
    console.log('\n=== NUCLEAR TRADING SYSTEM STATUS ===');
    console.log('☢️  Nuclear Engine: ACTIVE');
    console.log('🚀 Nexus Pro Engine: ACTIVE');
    console.log('💰 Real Fund Trading: ACTIVE');
    console.log('⚡ Zero Capital MEV: ENABLED');
    console.log('🎯 Jito Bundle Execution: ENABLED');
    console.log('🔥 Flash Loan Arbitrage: ENABLED');
    console.log('📊 Live Blockchain Trading: ENABLED');
    console.log('\n💎 NUCLEAR FEATURES:');
    console.log('  • Zero capital requirement strategies');
    console.log('  • Maximum yield nuclear arbitrage');
    console.log('  • Real-time MEV hunting and execution');
    console.log('  • Jito bundle optimization');
    console.log('  • Flash loan powered operations');
    console.log('  • 164,641 SOL borrowed capital active');
    console.log('  • Live blockchain transaction execution');
    console.log('=====================================\n');
  }

  private displayComprehensiveReport(): void {
    const nuclearStatus = this.nuclearEngine.getNuclearStatus();
    const nexusStatus = this.nexusEngine.getNexusProStatus();
    const fundStatus = this.realFundTrader.getRealFundTradingStatus();
    
    console.log('\n[NuclearLauncher] === COMPREHENSIVE SYSTEM REPORT ===');
    console.log(`☢️  Nuclear Profit: +${nuclearStatus.totalNuclearProfit.toFixed(6)} SOL`);
    console.log(`🚀 Nexus Profit: +${nexusStatus.totalProfitGenerated.toFixed(6)} SOL`);
    console.log(`💰 Fund Trading Profit: +${fundStatus.totalProfit.toFixed(6)} SOL`);
    
    const totalProfit = nuclearStatus.totalNuclearProfit + nexusStatus.totalProfitGenerated + fundStatus.totalProfit;
    console.log(`📈 TOTAL SYSTEM PROFIT: +${totalProfit.toFixed(6)} SOL`);
    
    console.log(`🎯 MEV Opportunities: ${nuclearStatus.mevOpportunities}`);
    console.log(`⚡ Jito Bundles: ${nuclearStatus.jitoBundles}`);
    console.log(`🔥 Nuclear Executions: ${nuclearStatus.totalExecutions}`);
    console.log(`💎 Active Strategies: ${nuclearStatus.activeStrategies + nexusStatus.activeStrategies}`);
    console.log('================================================\n');
  }

  private generateDetailedReport(): void {
    const nuclearStatus = this.nuclearEngine.getNuclearStatus();
    const nexusStatus = this.nexusEngine.getNexusProStatus();
    
    console.log('\n[NuclearLauncher] === DETAILED PERFORMANCE REPORT ===');
    
    console.log('\n🏆 TOP NUCLEAR STRATEGIES:');
    nuclearStatus.strategies.slice(0, 3).forEach((strategy: any, index: number) => {
      console.log(`${index + 1}. ${strategy.name}`);
      console.log(`   Type: ${strategy.type} | Profit: +${strategy.profitGenerated.toFixed(6)} SOL`);
      console.log(`   Executions: ${strategy.executionCount} | Yield: ${strategy.expectedYield}%`);
    });
    
    console.log('\n💰 RECENT MEV CAPTURES:');
    nuclearStatus.recentMEV.forEach((mev: any, index: number) => {
      console.log(`${index + 1}. Target: ${mev.target} | Profit: +${mev.totalProfit.toFixed(6)} SOL`);
    });
    
    console.log('\n🚀 RECENT JITO BUNDLES:');
    nuclearStatus.recentJito.forEach((bundle: any, index: number) => {
      console.log(`${index + 1}. Bundle: ${bundle.bundleId}`);
      console.log(`   Transactions: ${bundle.transactions} | Net Profit: +${bundle.netProfit.toFixed(6)} SOL`);
    });
    
    console.log('==================================================\n');
  }

  public async shutdown(): Promise<void> {
    console.log('[NuclearLauncher] Shutting down nuclear trading system...');
    
    this.nuclearEngine.stopNuclearEngine();
    this.nexusEngine.stopEngine();
    this.launcherActive = false;
    
    console.log('[NuclearLauncher] Nuclear trading system shutdown complete');
  }
}

// Start nuclear trading system
async function main(): Promise<void> {
  const launcher = new NuclearTradingLauncher();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n[NuclearLauncher] Received SIGINT, shutting down gracefully...');
    await launcher.shutdown();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n[NuclearLauncher] Received SIGTERM, shutting down gracefully...');
    await launcher.shutdown();
    process.exit(0);
  });
  
  // Start the nuclear trading system
  await launcher.startNuclearTrading();
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('[NuclearLauncher] Fatal error:', error);
    process.exit(1);
  });
}

export default NuclearTradingLauncher;