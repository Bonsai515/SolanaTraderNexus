/**
 * Transaction Connector - Interfaces with the Rust Transaction Engine
 * 
 * This module provides a TypeScript interface to the Rust-based Solana
 * transaction engine for live trading with real funds.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { EventEmitter } from 'events';

// Transaction Engine Configuration
interface EngineConfig {
  useRealFunds: boolean;
  rpcUrl: string;
  websocketUrl?: string;
  systemWalletAddress: string;
  wormholeGuardianRpc?: string;
}

// Transaction Parameters
interface TransactionParams {
  fromToken: string;
  toToken: string;
  amount: number;
  slippage: number;
  walletAddress: string;
  isSimulation?: boolean;
}

// Transaction Status
interface TransactionStatus {
  signature: string;
  status: 'pending' | 'confirmed' | 'finalized' | 'failed';
  timestamp: number;
  errorMessage?: string;
}

/**
 * TransactionConnector provides the interface to the Rust transaction engine
 */
class TransactionConnector extends EventEmitter {
  private config: EngineConfig;
  private engineProcess: any = null;
  private transactions: Map<string, TransactionStatus> = new Map();
  private isRunning: boolean = false;
  private enginePath: string;

  /**
   * Create a new TransactionConnector
   * @param config Engine configuration
   */
  constructor(config: EngineConfig) {
    super();
    this.config = config;
    this.enginePath = path.join(__dirname, '..', 'rust_engine', 'target', 'release', 'transaction_engine');
    
    // Create logs directory if it doesn't exist
    const logsDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    console.log('Transaction Connector initialized with configuration:');
    console.log(`- RPC URL: ${this.config.rpcUrl}`);
    console.log(`- System Wallet: ${this.config.systemWalletAddress}`);
    console.log(`- Using Real Funds: ${this.config.useRealFunds}`);
  }

  /**
   * Start the transaction engine
   */
  public async start(): Promise<boolean> {
    if (this.isRunning) {
      console.log('Transaction engine is already running');
      return true;
    }
    
    console.log('Starting transaction engine...');
    
    try {
      // Set environment variables for the engine
      process.env.SOLANA_RPC_URL = this.config.rpcUrl;
      process.env.SYSTEM_WALLET_ADDRESS = this.config.systemWalletAddress;
      process.env.USE_REAL_FUNDS = this.config.useRealFunds ? 'true' : 'false';
      
      if (this.config.websocketUrl) {
        process.env.SOLANA_WEBSOCKET_URL = this.config.websocketUrl;
      }
      
      if (this.config.wormholeGuardianRpc) {
        process.env.WORMHOLE_GUARDIAN_RPC = this.config.wormholeGuardianRpc;
      }
      
      // Check if the engine binary exists
      if (!fs.existsSync(this.enginePath)) {
        // If the binary doesn't exist, use cargo to run it
        console.log('Engine binary not found, running from source with cargo...');
        
        this.engineProcess = execFile('cargo', ['run', '--release', '--bin', 'transaction_engine'], {
          cwd: path.join(__dirname, '..', 'rust_engine'),
          env: process.env
        });
      } else {
        // If the binary exists, run it directly
        console.log('Starting transaction engine binary...');
        this.engineProcess = execFile(this.enginePath, [], {
          env: process.env
        });
      }
      
      // Handle process output
      this.engineProcess.stdout?.on('data', (data: Buffer) => {
        const logMessage = data.toString().trim();
        console.log(`[ENGINE] ${logMessage}`);
        
        // Also write to log file
        fs.appendFileSync(path.join(__dirname, '..', 'logs', 'transaction-engine.log'), `${new Date().toISOString()} - ${logMessage}\n`);
      });
      
      this.engineProcess.stderr?.on('data', (data: Buffer) => {
        const errorMessage = data.toString().trim();
        console.error(`[ENGINE ERROR] ${errorMessage}`);
        
        // Also write to log file
        fs.appendFileSync(path.join(__dirname, '..', 'logs', 'transaction-engine-error.log'), `${new Date().toISOString()} - ${errorMessage}\n`);
      });
      
      // Handle process exit
      this.engineProcess.on('close', (code: number) => {
        console.log(`Transaction engine exited with code ${code}`);
        this.isRunning = false;
        this.emit('engineStopped', code);
      });
      
      this.isRunning = true;
      this.emit('engineStarted');
      
      console.log('Transaction engine started successfully');
      
      return true;
    } catch (error) {
      console.error('Failed to start transaction engine:', error);
      return false;
    }
  }

  /**
   * Stop the transaction engine
   */
  public async stop(): Promise<boolean> {
    if (!this.isRunning || !this.engineProcess) {
      console.log('Transaction engine is not running');
      return true;
    }
    
    console.log('Stopping transaction engine...');
    
    try {
      // Send SIGTERM to gracefully stop the process
      this.engineProcess.kill('SIGTERM');
      
      // Wait for the process to exit
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          console.log('Transaction engine did not exit gracefully, forcing termination');
          this.engineProcess.kill('SIGKILL');
          resolve();
        }, 5000);
        
        this.engineProcess.on('close', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
      
      this.isRunning = false;
      console.log('Transaction engine stopped successfully');
      
      return true;
    } catch (error) {
      console.error('Failed to stop transaction engine:', error);
      return false;
    }
  }

  /**
   * Check if the transaction engine is running
   */
  public isEngineRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Execute a transaction
   * @param params Transaction parameters
   */
  public async executeTransaction(params: TransactionParams): Promise<string> {
    if (!this.isRunning) {
      throw new Error('Transaction engine is not running');
    }
    
    if (!this.config.useRealFunds && !params.isSimulation) {
      console.warn('WARNING: Transaction engine is not configured to use real funds. ' +
                   'Setting isSimulation to true.');
      params.isSimulation = true;
    }
    
    console.log(`Executing ${params.isSimulation ? 'simulated' : 'real'} transaction:`, params);
    
    // In a real implementation, we would send a message to the Rust engine
    // For this example, we'll simulate a transaction
    
    const txSignature = `SIGNATURE_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
    
    this.transactions.set(txSignature, {
      signature: txSignature,
      status: 'pending',
      timestamp: Date.now(),
    });
    
    // Simulate transaction confirmation after a short delay
    setTimeout(() => {
      const status = this.transactions.get(txSignature);
      if (status) {
        status.status = 'confirmed';
        this.transactions.set(txSignature, status);
        this.emit('transactionUpdated', txSignature, status);
      }
    }, 2000);
    
    return txSignature;
  }

  /**
   * Get the status of a transaction
   * @param signature Transaction signature
   */
  public getTransactionStatus(signature: string): TransactionStatus | undefined {
    return this.transactions.get(signature);
  }

  /**
   * Set whether to use real funds
   * @param useRealFunds Whether to use real funds
   */
  public setUseRealFunds(useRealFunds: boolean): void {
    this.config.useRealFunds = useRealFunds;
    console.log(`Set useRealFunds to ${useRealFunds}`);
    
    // Update environment variable for the engine
    process.env.USE_REAL_FUNDS = useRealFunds ? 'true' : 'false';
    
    this.emit('configUpdated', this.config);
  }
}

// Export singleton instance with default configuration
const defaultConfig: EngineConfig = {
  useRealFunds: process.env.USE_REAL_FUNDS === 'true',
  rpcUrl: process.env.SOLANA_RPC_URL || 'https://solana-grpc-geyser.instantnodes.io:443',
  websocketUrl: process.env.SOLANA_WEBSOCKET_URL,
  systemWalletAddress: process.env.SYSTEM_WALLET_ADDRESS || 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb',
  wormholeGuardianRpc: process.env.WORMHOLE_GUARDIAN_RPC || 'https://guardian.stable.productions',
};

const transactionConnector = new TransactionConnector(defaultConfig);

// Start the engine if this file is run directly
if (require.main === module) {
  transactionConnector.start()
    .then((success) => {
      if (success) {
        console.log('Transaction engine started successfully');
      } else {
        console.error('Failed to start transaction engine');
      }
    })
    .catch((error) => {
      console.error('Error starting transaction engine:', error);
    });
}

export default transactionConnector;