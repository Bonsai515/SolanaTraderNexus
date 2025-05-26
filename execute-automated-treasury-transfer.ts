
/**
 * Automated Treasury Transfer Executor
 * 
 * Executes the 1000 SOL transfer automatically with monitoring and retry logic
 */

import { spawn } from 'child_process';
import fs from 'fs';

class AutomatedTransferExecutor {
  private transferInProgress = false;
  private lastAttempt: Date | null = null;
  private successfulTransfers: string[] = [];

  public async startAutomatedExecution(): Promise<void> {
    console.log('🚀 AUTOMATED TREASURY TRANSFER EXECUTOR STARTED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 Target: 2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH');
    console.log('💰 Amount: 1000 SOL');
    console.log('🤖 Mode: Fully Automated');
    console.log('');

    // Execute immediate transfer attempt
    await this.executeTransferAttempt();

    // Set up monitoring interval
    this.startMonitoring();
  }

  private async executeTransferAttempt(): Promise<void> {
    if (this.transferInProgress) {
      console.log('⏳ Transfer already in progress, skipping...');
      return;
    }

    this.transferInProgress = true;
    this.lastAttempt = new Date();

    console.log(`🤖 [${new Date().toISOString()}] Executing automated transfer attempt...`);

    try {
      // Execute the transfer script
      const child = spawn('npx', ['ts-node', 'send-1000-sol-to-address.ts'], {
        stdio: 'pipe'
      });

      let output = '';
      let errorOutput = '';

      child.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        console.log(text.trim());
      });

      child.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        console.error(text.trim());
      });

      child.on('close', (code) => {
        this.transferInProgress = false;
        
        if (code === 0) {
          console.log('✅ Transfer script completed successfully');
          this.handleSuccessfulTransfer(output);
        } else {
          console.log(`⚠️ Transfer script exited with code ${code}`);
          this.handleFailedTransfer(errorOutput);
        }
      });

    } catch (error) {
      this.transferInProgress = false;
      console.error('❌ Error executing transfer script:', error);
    }
  }

  private handleSuccessfulTransfer(output: string): void {
    // Extract transaction signature if present
    const signatureMatch = output.match(/Transaction signature: ([A-Za-z0-9]+)/);
    if (signatureMatch) {
      const signature = signatureMatch[1];
      this.successfulTransfers.push(signature);
      
      console.log('🎉 TRANSFER SUCCESS DETECTED!');
      console.log(`📝 Signature: ${signature}`);
      console.log(`🔗 View: https://solscan.io/tx/${signature}`);
      
      // Log success
      this.logTransferEvent('SUCCESS', signature);
      
      // Stop monitoring since transfer was successful
      console.log('✅ Automated monitoring stopped - transfer completed');
      process.exit(0);
    }
  }

  private handleFailedTransfer(errorOutput: string): void {
    console.log('⚠️ Transfer attempt did not complete successfully');
    console.log('🔄 Will retry in next monitoring cycle');
    
    this.logTransferEvent('RETRY', null, errorOutput);
  }

  private startMonitoring(): void {
    console.log('👁️ Starting continuous monitoring...');
    console.log('🔄 Will attempt transfer every 5 minutes until successful');
    
    setInterval(async () => {
      if (!this.transferInProgress) {
        console.log('\n🔄 Monitoring cycle - attempting transfer...');
        await this.executeTransferAttempt();
      }
    }, 300000); // 5 minutes

    // Also monitor for manual success indicators
    this.monitorForManualSuccess();
  }

  private monitorForManualSuccess(): void {
    setInterval(async () => {
      try {
        // Check if transfer was completed manually by monitoring the target address
        const { Connection, PublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
        const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=5d0d1d98-4695-4a7d-b8a0-d4f9836da17f');
        
        const targetAddress = new PublicKey('2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH');
        const balance = await connection.getBalance(targetAddress);
        const balanceSOL = balance / LAMPORTS_PER_SOL;
        
        console.log(`📊 Target address balance: ${balanceSOL.toFixed(6)} SOL`);
        
        // If balance is significantly higher, transfer might have been completed
        if (balanceSOL >= 1000) {
          console.log('🎉 TARGET ADDRESS HAS 1000+ SOL - TRANSFER LIKELY COMPLETED!');
          console.log('✅ Stopping automated monitoring');
          process.exit(0);
        }
        
      } catch (error) {
        // Silent fail for monitoring check
      }
    }, 60000); // Check every minute
  }

  private logTransferEvent(status: string, signature: string | null, error?: string): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      status,
      signature,
      error,
      targetAddress: '2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH',
      amount: '1000 SOL'
    };

    try {
      if (!fs.existsSync('logs')) {
        fs.mkdirSync('logs');
      }
      
      fs.appendFileSync('logs/automated-transfer.log', JSON.stringify(logEntry) + '\n');
    } catch (e) {
      console.log('⚠️ Could not write to log file');
    }
  }

  public showStatus(): void {
    console.log('\n📊 AUTOMATED TRANSFER STATUS');
    console.log('─────────────────────────────');
    console.log(`🔄 Transfer in progress: ${this.transferInProgress}`);
    console.log(`⏰ Last attempt: ${this.lastAttempt?.toISOString() || 'None'}`);
    console.log(`✅ Successful transfers: ${this.successfulTransfers.length}`);
    
    if (this.successfulTransfers.length > 0) {
      console.log('📝 Signatures:');
      this.successfulTransfers.forEach(sig => {
        console.log(`   ${sig}`);
      });
    }
  }
}

async function main(): Promise<void> {
  const executor = new AutomatedTransferExecutor();
  
  // Handle process signals
  process.on('SIGINT', () => {
    console.log('\n🛑 Automated transfer executor stopping...');
    executor.showStatus();
    process.exit(0);
  });
  
  await executor.startAutomatedExecution();
  
  // Keep process alive for monitoring
  process.stdin.resume();
}

main().catch(console.error);
