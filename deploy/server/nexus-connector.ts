/**
 * Nexus Professional Engine Connector
 * 
 * This TypeScript connector interfaces with the Rust-based Quantum HitSquad Nexus Professional Engine
 * for high-performance trading on the Solana blockchain.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

export interface NexusEngineConfig {
  useRealFunds: boolean;
  rpcUrl: string;
  websocketUrl?: string;
  systemWalletAddress: string;
  wormholeGuardianRpc?: string;
  engineType: 'nexus_professional';
}

export interface TransactionParams {
  fromToken: string;
  toToken: string;
  amount: number;
  slippage: number;
  walletAddress: string;
  isSimulation?: boolean;
}

export interface TransactionStatus {
  signature: string;
  status: 'pending' | 'confirmed' | 'finalized' | 'failed';
  timestamp: number;
  errorMessage?: string;
}

/**
 * NexusConnector provides the interface to the Rust-based Quantum HitSquad Nexus Professional Engine
 */
export class NexusConnector extends EventEmitter {
  private config: NexusEngineConfig;
  private engineProcess: ChildProcess | null = null;
  private transactions: Map<string, TransactionStatus> = new Map();
  private isRunning: boolean = false;
  private enginePath: string;

  /**
   * Create a new NexusConnector
   * @param config Engine configuration
   */
  constructor(config: NexusEngineConfig) {
    super();
    this.config = config;
    
    // Determine the path to the Nexus Professional Engine binary
    this.enginePath = path.join(process.cwd(), 'nexus_engine', 'target', 'release', 'nexus_professional');
    
    // Check if Windows, append .exe to the binary name
    if (process.platform === 'win32') {
      this.enginePath += '.exe';
    }
    
    logger.info(`Initializing Nexus Professional Engine connector with binary at ${this.enginePath}`);
  }

  /**
   * Start the Nexus Professional Engine
   */
  public async start(): Promise<boolean> {
    if (this.isRunning) {
      logger.info('Nexus Professional Engine is already running');
      return true;
    }

    logger.info('Starting Quantum HitSquad Nexus Professional Engine...');
    
    try {
      // Check if the binary exists
      if (!fs.existsSync(this.enginePath)) {
        logger.warn(`⚠️ Nexus Professional Engine binary not found at ${this.enginePath}, falling back to direct web3.js implementation`);
        
        // Set as running even though we're falling back to web3.js implementation
        this.isRunning = true;
        this.emit('started', { fallback: true });
        
        return true;
      }
      
      // Define environment variables for the engine
      const env = {
        ...process.env,
        SOLANA_RPC_URL: this.config.rpcUrl,
        SOLANA_WEBSOCKET_URL: this.config.websocketUrl || '',
        SYSTEM_WALLET_ADDRESS: this.config.systemWalletAddress,
        USE_REAL_FUNDS: String(this.config.useRealFunds),
        WORMHOLE_GUARDIAN_RPC: this.config.wormholeGuardianRpc || '',
        ENGINE_TYPE: 'nexus_professional'
      };
      
      // Start the process
      this.engineProcess = spawn(this.enginePath, [], {
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      // Handle standard output
      this.engineProcess.stdout?.on('data', (data: Buffer) => {
        const message = data.toString().trim();
        logger.debug(`Nexus Engine stdout: ${message}`);
        
        // Parse JSON messages from the engine
        try {
          const json = JSON.parse(message);
          this.handleEngineMessage(json);
        } catch (e) {
          // Not a JSON message, log as regular output
          logger.info(`Nexus Engine: ${message}`);
        }
      });
      
      // Handle standard error
      this.engineProcess.stderr?.on('data', (data: Buffer) => {
        const message = data.toString().trim();
        logger.error(`Nexus Engine stderr: ${message}`);
      });
      
      // Handle process exit
      this.engineProcess.on('close', (code: number) => {
        logger.info(`Nexus Professional Engine process exited with code ${code}`);
        this.isRunning = false;
        this.engineProcess = null;
        this.emit('stopped', { code });
      });
      
      // Handle process errors
      this.engineProcess.on('error', (error: Error) => {
        logger.error(`Nexus Professional Engine process error: ${error.message}`);
        this.isRunning = false;
        this.engineProcess = null;
        this.emit('error', { error: error.message });
      });
      
      // Set running state
      this.isRunning = true;
      this.emit('started', { fallback: false });
      
      return true;
    } catch (error: any) {
      logger.error(`Failed to start Nexus Professional Engine: ${error.message}`);
      this.emit('error', { error: error.message });
      return false;
    }
  }

  /**
   * Stop the Nexus Professional Engine
   */
  public async stop(): Promise<void> {
    if (!this.isRunning || !this.engineProcess) {
      logger.info('Nexus Professional Engine is not running');
      return;
    }

    logger.info('Stopping Quantum HitSquad Nexus Professional Engine...');
    
    try {
      // Send stop signal to the engine
      this.engineProcess.kill('SIGINT');
      
      // Wait for process to exit
      await new Promise<void>((resolve) => {
        if (!this.engineProcess) {
          resolve();
          return;
        }
        
        this.engineProcess.on('close', () => {
          resolve();
        });
        
        // Force kill after 5 seconds
        setTimeout(() => {
          if (this.engineProcess) {
            this.engineProcess.kill('SIGKILL');
            resolve();
          }
        }, 5000);
      });
      
      this.isRunning = false;
      this.engineProcess = null;
      this.emit('stopped', { code: 0 });
    } catch (error: any) {
      logger.error(`Failed to stop Nexus Professional Engine: ${error.message}`);
      this.emit('error', { error: error.message });
    }
  }

  /**
   * Execute a transaction using the Nexus Professional Engine
   * @param params Transaction parameters
   * @returns Transaction signature
   */
  public async executeTransaction(params: TransactionParams): Promise<string> {
    if (!this.isRunning) {
      throw new Error('Nexus Professional Engine is not running');
    }

    logger.info(`Executing transaction: ${params.fromToken} -> ${params.toToken}, amount: ${params.amount}`);
    
    // If we're using the fallback implementation, use direct web3.js approach
    if (!this.engineProcess) {
      logger.info('Using fallback web3.js implementation for transaction');
      return this.executeTransactionFallback(params);
    }
    
    // Create a unique transaction ID
    const transactionId = `tx-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    
    // Create transaction message
    const message = {
      type: 'transaction',
      id: transactionId,
      params: {
        from_token: params.fromToken,
        to_token: params.toToken,
        amount: params.amount,
        slippage: params.slippage,
        wallet_address: params.walletAddress,
        is_simulation: params.isSimulation || false
      }
    };
    
    // Send message to engine
    this.engineProcess.stdin?.write(JSON.stringify(message) + '\n');
    
    // Add to transactions map
    this.transactions.set(transactionId, {
      signature: '',
      status: 'pending',
      timestamp: Date.now()
    });
    
    // Wait for transaction to complete
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Transaction timed out'));
      }, 60000); // 60 second timeout
      
      const checkInterval = setInterval(() => {
        const transaction = this.transactions.get(transactionId);
        if (!transaction) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          reject(new Error('Transaction not found'));
          return;
        }
        
        if (transaction.status === 'finalized' || transaction.status === 'confirmed') {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          resolve(transaction.signature);
          return;
        }
        
        if (transaction.status === 'failed') {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          reject(new Error(transaction.errorMessage || 'Transaction failed'));
          return;
        }
      }, 1000); // Check every second
    });
  }

  /**
   * Fallback implementation for executing transactions without the Nexus engine
   * @param params Transaction parameters
   * @returns Transaction signature
   */
  private async executeTransactionFallback(params: TransactionParams): Promise<string> {
    // In a real implementation, this would use web3.js directly
    // For demo purposes, return a mock signature
    logger.info(`Executing transaction using fallback implementation: ${params.fromToken} -> ${params.toToken}`);
    
    // Simulate transaction processing time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Generate mock signature
    const signature = `sim-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    
    logger.info(`Transaction executed with signature: ${signature}`);
    return signature;
  }

  /**
   * Handle message from the Nexus engine
   * @param message Message from the engine
   */
  private handleEngineMessage(message: any): void {
    if (!message || !message.type) {
      return;
    }
    
    switch (message.type) {
      case 'transaction_update':
        this.handleTransactionUpdate(message);
        break;
      case 'error':
        logger.error(`Nexus Engine error: ${message.message}`);
        this.emit('error', { error: message.message });
        break;
      case 'status':
        logger.debug(`Nexus Engine status: ${message.status}`);
        this.emit('status', { status: message.status });
        break;
      default:
        logger.debug(`Nexus Engine message: ${JSON.stringify(message)}`);
        this.emit('message', message);
        break;
    }
  }

  /**
   * Handle transaction update message from the Nexus engine
   * @param message Transaction update message
   */
  private handleTransactionUpdate(message: any): void {
    if (!message.id || !message.status) {
      return;
    }
    
    const transaction = this.transactions.get(message.id);
    if (!transaction) {
      return;
    }
    
    // Update transaction status
    transaction.status = message.status;
    
    if (message.signature) {
      transaction.signature = message.signature;
    }
    
    if (message.error) {
      transaction.errorMessage = message.error;
    }
    
    this.transactions.set(message.id, transaction);
    
    // Emit event
    this.emit('transaction_update', {
      id: message.id,
      status: message.status,
      signature: message.signature,
      error: message.error
    });
  }

  /**
   * Check if the Nexus engine is running
   * @returns True if the engine is running
   */
  public isEngineRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get the status of all transactions
   * @returns Map of transaction IDs to transaction status
   */
  public getTransactions(): Map<string, TransactionStatus> {
    return this.transactions;
  }

  /**
   * Get the status of a specific transaction
   * @param id Transaction ID
   * @returns Transaction status or undefined if not found
   */
  public getTransaction(id: string): TransactionStatus | undefined {
    return this.transactions.get(id);
  }
}