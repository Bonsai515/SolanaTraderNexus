/**
 * Live Trade Monitor
 * 
 * Real-time monitoring system that checks for new trades every 30 seconds
 * Provides instant updates when profitable trades execute
 */

import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';

class LiveTradeMonitor {
  private connection: Connection;
  private walletKeypair: Keypair;
  private walletAddress: string;
  private lastKnownBalance: number;
  private lastTransactionSignature: string;
  private totalProfit: number;
  private monitoringActive: boolean;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
    this.lastKnownBalance = 0.056636; // Starting point
    this.lastTransactionSignature = '';
    this.totalProfit = 0;
    this.monitoringActive = true;
  }

  public async startLiveMonitoring(): Promise<void> {
    console.log('🔴 LIVE TRADE MONITORING ACTIVATED');
    console.log('📊 Real-time updates every 30 seconds');
    console.log('💰 Watching for profitable trades...');
    console.log('='.repeat(50));

    await this.loadWallet();
    await this.initializeBaseline();
    
    // Start continuous monitoring
    while (this.monitoringActive) {
      await this.checkForNewTrades();
      await new Promise(resolve => setTimeout(resolve, 30000)); // Check every 30 seconds
    }
  }

  private async loadWallet(): Promise<void> {
    const privateKeyArray = [
      178, 244, 12, 25, 27, 202, 251, 10, 212, 90, 37, 116, 218, 42, 22, 165,
      134, 165, 151, 54, 225, 215, 194, 8, 177, 201, 105, 101, 212, 120, 249,
      74, 243, 118, 55, 187, 158, 35, 75, 138, 173, 148, 39, 171, 160, 27, 89,
      6, 105, 174, 233, 82, 187, 49, 42, 193, 182, 112, 195, 65, 56, 144, 83, 218
    ];
    
    this.walletKeypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
    this.walletAddress = this.walletKeypair.publicKey.toBase58();
    
    console.log('✅ Monitoring wallet: ' + this.walletAddress);
  }

  private async initializeBaseline(): Promise<void> {
    console.log('\n📊 INITIALIZING BASELINE');
    
    // Get current balance
    const balance = await this.connection.getBalance(this.walletKeypair.publicKey);
    this.lastKnownBalance = balance / LAMPORTS_PER_SOL;
    
    // Get most recent transaction signature
    const signatures = await this.connection.getSignaturesForAddress(
      this.walletKeypair.publicKey,
      { limit: 1 }
    );
    
    if (signatures.length > 0) {
      this.lastTransactionSignature = signatures[0].signature;
    }
    
    console.log(`💎 Baseline Balance: ${this.lastKnownBalance.toFixed(6)} SOL`);
    console.log(`🔗 Last TX: ${this.lastTransactionSignature.substring(0, 12)}...`);
    console.log('🎯 Ready to detect new profitable trades');
  }

  private async checkForNewTrades(): Promise<void> {
    try {
      const currentTime = new Date().toLocaleTimeString();
      console.log(`\n⏰ ${currentTime} - Checking for new trades...`);
      
      // Get current balance
      const balance = await this.connection.getBalance(this.walletKeypair.publicKey);
      const currentBalance = balance / LAMPORTS_PER_SOL;
      
      // Check for balance change
      const balanceChange = currentBalance - this.lastKnownBalance;
      
      if (Math.abs(balanceChange) > 0.0001) { // Significant change detected
        console.log('🚨 BALANCE CHANGE DETECTED!');
        console.log(`📊 Previous: ${this.lastKnownBalance.toFixed(6)} SOL`);
        console.log(`📊 Current: ${currentBalance.toFixed(6)} SOL`);
        console.log(`📈 Change: ${balanceChange > 0 ? '+' : ''}${balanceChange.toFixed(6)} SOL`);
        
        if (balanceChange > 0) {
          console.log('💰 PROFIT DETECTED! 🎉');
          this.totalProfit += balanceChange;
        }
        
        // Check for new transactions
        await this.checkNewTransactions();
        
        this.lastKnownBalance = currentBalance;
      } else {
        console.log('📊 No changes - System monitoring...');
      }
      
      // Show current status
      const progressToTarget = (currentBalance / 1.0) * 100;
      console.log(`🎯 Progress: ${progressToTarget.toFixed(1)}% to 1 SOL`);
      
    } catch (error) {
      console.log(`⚠️ Monitor error: ${error.message}`);
    }
  }

  private async checkNewTransactions(): Promise<void> {
    try {
      console.log('🔍 Checking for new transactions...');
      
      const signatures = await this.connection.getSignaturesForAddress(
        this.walletKeypair.publicKey,
        { limit: 5 }
      );
      
      let newTransactions = 0;
      
      for (const sigInfo of signatures) {
        if (sigInfo.signature === this.lastTransactionSignature) {
          break; // Found our last known transaction
        }
        
        newTransactions++;
        const signature = sigInfo.signature;
        
        console.log(`🆕 NEW TRANSACTION: ${signature.substring(0, 12)}...`);
        console.log(`   🔗 Explorer: https://solscan.io/tx/${signature}`);
        
        // Get transaction details
        try {
          const transaction = await this.connection.getTransaction(signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0
          });
          
          if (transaction && transaction.meta) {
            const preBalance = transaction.meta.preBalances[0] / LAMPORTS_PER_SOL;
            const postBalance = transaction.meta.postBalances[0] / LAMPORTS_PER_SOL;
            const change = postBalance - preBalance;
            
            console.log(`   💰 Balance Change: ${change > 0 ? '+' : ''}${change.toFixed(6)} SOL`);
            
            if (change > 0.001) {
              console.log('   🎉 PROFITABLE TRADE CONFIRMED!');
            } else if (change < -0.001) {
              console.log('   📤 Trade execution (fees normal)');
            }
          }
        } catch (txError) {
          console.log('   ⏳ Transaction details loading...');
        }
      }
      
      if (newTransactions > 0) {
        this.lastTransactionSignature = signatures[0].signature;
        console.log(`✅ Found ${newTransactions} new transaction(s)`);
      }
      
    } catch (error) {
      console.log(`⚠️ Transaction check error: ${error.message}`);
    }
  }

  private showLiveSummary(): void {
    console.log('\n' + '='.repeat(50));
    console.log('📊 LIVE MONITORING SUMMARY');
    console.log('='.repeat(50));
    console.log(`💰 Current Balance: ${this.lastKnownBalance.toFixed(6)} SOL`);
    console.log(`📈 Session Profit: ${this.totalProfit.toFixed(6)} SOL`);
    
    const progressToTarget = (this.lastKnownBalance / 1.0) * 100;
    console.log(`🎯 Progress to 1 SOL: ${progressToTarget.toFixed(1)}%`);
    
    if (this.totalProfit > 0) {
      console.log('🚀 Profitable trades detected this session!');
    }
    
    console.log('='.repeat(50));
  }
}

async function main(): Promise<void> {
  const monitor = new LiveTradeMonitor();
  await monitor.startLiveMonitoring();
}

main().catch(console.error);