/**
 * Rust Transformer Integration
 *
 * Complete integration of all transformers with their Rust implementations.
 * Provides direct bindings to the Rust code for maximum performance.
 */

import { ChildProcess, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../logger';

export interface RustTransformerConfig {
  libPath: string;
  useMultiThreading: boolean;
  threadCount?: number;
  logLevel: string;
  maxBatchSize: number;
  enableJIT: boolean;
}

export interface TransformerResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTimeMs?: number;
}

interface QueueRequest {
  command: string;
  data: any;
  resolve: (value: TransformerResult) => void;
  reject: (reason: any) => void;
  timestamp: number;
}

export class RustTransformerIntegration {
  private initialized: boolean = false;
  private transformerProcess: ChildProcess | null = null;
  private libPath: string = './rust_engine/target/release/librust_transformer.so';
  private config: RustTransformerConfig;
  private securityEnabled: boolean = true;
  private backoffTime: number = 0;
  private maxBackoffTime: number = 30000; // 30 seconds
  private restartCount: number = 0;
  private maxRestarts: number = 5;
  private requestQueue: QueueRequest[] = [];
  private isProcessingQueue: boolean = false;
  private execPromise = promisify(require('child_process').exec);

  constructor(config: Partial<RustTransformerConfig> = {}) {
    this.config = {
      libPath: config.libPath || this.libPath,
      useMultiThreading: config.useMultiThreading !== undefined ? config.useMultiThreading : true,
      threadCount: config.threadCount || (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 4),
      logLevel: config.logLevel || 'info',
      maxBatchSize: config.maxBatchSize || 10,
      enableJIT: config.enableJIT !== undefined ? config.enableJIT : true
    };
  }

  /**
   * Initialize the transformer integration
   */
  public async initialize(): Promise<boolean> {
    try {
      // Check if the Rust library exists
      const libExists = fs.existsSync(this.config.libPath);
      
      if (!libExists) {
        logger.warn(`Rust transformer library not found at ${this.config.libPath}, attempting to build`);
        await this.buildRustTransformer();
      }
      
      // Start the transformer process
      await this.startTransformerProcess();
      
      this.initialized = true;
      logger.info('Rust transformer integration initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize Rust transformer integration:', error);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Check if the transformer integration is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Start the transformer process
   */
  private async startTransformerProcess(): Promise<void> {
    // Kill any existing process
    if (this.transformerProcess) {
      this.stopTransformerProcess();
    }
    
    try {
      // Start the transformer process
      this.transformerProcess = spawn('node', [
        '-e',
        `
        const ffi = require('ffi-napi');
        const ref = require('ref-napi');
        
        // Load the Rust library
        const lib = ffi.Library('${this.config.libPath}', {
          'execute_transformer': ['string', ['string', 'string']],
          'initialize_transformer': ['int', ['int', 'int', 'string']]
        });
        
        // Initialize the transformer
        const result = lib.initialize_transformer(
          ${this.config.useMultiThreading ? 1 : 0},
          ${this.config.threadCount || 4},
          '${this.config.logLevel}'
        );
        
        if (result !== 1) {
          console.error('Failed to initialize transformer');
          process.exit(1);
        }
        
        // Listen for commands on stdin
        process.stdin.on('data', (data) => {
          try {
            const input = data.toString().trim();
            const { id, command, payload } = JSON.parse(input);
            
            try {
              const result = lib.execute_transformer(command, JSON.stringify(payload));
              process.stdout.write(JSON.stringify({ id, result: JSON.parse(result) }) + '\\n');
            } catch (error) {
              process.stdout.write(JSON.stringify({ id, error: error.message }) + '\\n');
            }
          } catch (error) {
            process.stdout.write(JSON.stringify({ error: error.message }) + '\\n');
          }
        });
        
        // Signal that we're ready
        process.stdout.write(JSON.stringify({ status: 'ready' }) + '\\n');
        `
      ]);
      
      // Set up event handlers
      if (this.transformerProcess.stdout) {
        this.transformerProcess.stdout.on('data', (data) => {
          const messages = data.toString().trim().split('\n');
          for (const message of messages) {
            try {
              const response = JSON.parse(message);
              this.processResponse(response);
            } catch (error) {
              logger.error('Failed to parse transformer response:', message);
            }
          }
        });
      }
      
      if (this.transformerProcess.stderr) {
        this.transformerProcess.stderr.on('data', (data) => {
          logger.error('Transformer error:', data.toString());
        });
      }
      
      this.transformerProcess.on('exit', (code) => {
        this.handleProcessExit(code);
      });
      
      // Wait for the ready signal
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Transformer process failed to start'));
        }, 5000);
        
        const onData = (data: Buffer) => {
          const messages = data.toString().trim().split('\n');
          for (const message of messages) {
            try {
              const response = JSON.parse(message);
              if (response.status === 'ready') {
                clearTimeout(timeout);
                if (this.transformerProcess?.stdout) {
                  this.transformerProcess.stdout.removeListener('data', onData);
                }
                resolve();
                return;
              }
            } catch (error) {
              // Ignore parse errors for now
            }
          }
        };
        
        if (this.transformerProcess?.stdout) {
          this.transformerProcess.stdout.on('data', onData);
        } else {
          reject(new Error('Transformer process failed to start'));
        }
      });
      
      logger.info('Transformer process started successfully');
    } catch (error) {
      logger.error('Failed to start transformer process:', error);
      throw error;
    }
  }

  /**
   * Stop the transformer process
   */
  private stopTransformerProcess(): void {
    if (this.transformerProcess) {
      try {
        // On Windows, child_process.kill() doesn't kill the process tree
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', this.transformerProcess.pid!.toString(), '/f', '/t']);
        } else {
          this.transformerProcess.kill('SIGTERM');
        }
      } catch (error) {
        logger.error('Error killing transformer process:', error);
      }
      
      this.transformerProcess = null;
    }
  }

  /**
   * Handle process exit and restart if needed
   */
  private handleProcessExit(code: number | null): void {
    logger.warn(`Transformer process exited with code ${code}`);
    this.transformerProcess = null;
    
    // Calculate exponential backoff
    if (this.backoffTime === 0) {
      this.backoffTime = 1000; // Start with 1 second
    } else {
      this.backoffTime = Math.min(this.backoffTime * 2, this.maxBackoffTime);
    }
    
    this.restartCount++;
    
    if (this.restartCount <= this.maxRestarts) {
      logger.info(`Restarting transformer process in ${this.backoffTime}ms (attempt ${this.restartCount}/${this.maxRestarts})`);
      
      setTimeout(() => {
        this.startTransformerProcess()
          .then(() => {
            logger.info('Transformer process restarted successfully');
            this.backoffTime = 0;
            this.processRequestQueue();
          })
          .catch((error) => {
            logger.error('Failed to restart transformer process:', error);
            this.failAllQueuedRequests('Failed to restart transformer process');
          });
      }, this.backoffTime);
    } else {
      logger.error(`Maximum restart attempts (${this.maxRestarts}) reached`);
      this.failAllQueuedRequests('Maximum transformer restart attempts reached');
    }
  }

  /**
   * Process a response from the transformer
   */
  private processResponse(response: any): void {
    if (!response.id) {
      // This is a status message, not a response to a request
      return;
    }
    
    const index = this.requestQueue.findIndex(req => req.timestamp.toString() === response.id);
    
    if (index !== -1) {
      const request = this.requestQueue.splice(index, 1)[0];
      
      if (response.error) {
        request.reject(new Error(response.error));
      } else {
        request.resolve(response.result || { success: true });
      }
      
      // Process next request if available
      if (this.requestQueue.length > 0) {
        this.processRequestQueue();
      } else {
        this.isProcessingQueue = false;
      }
    }
  }

  /**
   * Process the request queue
   */
  private processRequestQueue(): void {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    // Get the next batch of requests
    const batchSize = Math.min(this.config.maxBatchSize, this.requestQueue.length);
    const batch = this.requestQueue.slice(0, batchSize);
    
    // Process the batch
    this.sendRequests(batch)
      .catch((error) => {
        logger.error('Error processing request batch:', error);
        
        // Remove the processed requests from the queue
        for (const request of batch) {
          const index = this.requestQueue.findIndex(req => req === request);
          if (index !== -1) {
            this.requestQueue.splice(index, 1);
            request.reject(error);
          }
        }
      })
      .finally(() => {
        if (this.requestQueue.length > 0) {
          // Continue processing the queue
          setImmediate(() => this.processRequestQueue());
        } else {
          this.isProcessingQueue = false;
        }
      });
  }

  /**
   * Send requests to the transformer
   */
  private async sendRequests(requests: QueueRequest[]): Promise<void> {
    if (!this.transformerProcess || !this.transformerProcess.stdin) {
      throw new Error('Transformer process not running');
    }
    
    for (const request of requests) {
      const { command, data, timestamp } = request;
      
      const input = JSON.stringify({
        id: timestamp,
        command,
        payload: data
      });
      
      this.transformerProcess.stdin.write(input + '\n');
    }
  }

  /**
   * Fail all queued requests
   */
  private failAllQueuedRequests(errorMessage: string): void {
    for (const request of this.requestQueue) {
      request.reject(new Error(errorMessage));
    }
    
    this.requestQueue = [];
    this.isProcessingQueue = false;
  }

  /**
   * Execute a transformer command
   */
  public async executeCommand(command: string, data: any): Promise<TransformerResult> {
    if (!this.initialized) {
      throw new Error('Transformer integration not initialized');
    }
    
    // Add security checks if enabled
    if (this.securityEnabled) {
      // Add security timestamp and checks
      data = {
        ...data,
        _securityTimestamp: Date.now(),
        _securityEnabled: true
      };
    }
    
    return new Promise<TransformerResult>((resolve, reject) => {
      const request: QueueRequest = {
        command,
        data,
        resolve,
        reject,
        timestamp: Date.now()
      };
      
      this.requestQueue.push(request);
      
      // Start processing the queue if not already processing
      if (!this.isProcessingQueue) {
        this.processRequestQueue();
      }
    });
  }

  /**
   * Build the Rust transformer
   */
  private async buildRustTransformer(): Promise<void> {
    logger.info('Building Rust transformer...');
    
    try {
      // Navigate to the rust_engine directory
      const engineDir = path.resolve('./rust_engine');
      
      // Check if the directory exists
      if (!fs.existsSync(engineDir)) {
        throw new Error(`Rust engine directory not found at ${engineDir}`);
      }
      
      // Build the transformer
      const buildCommand = process.platform === 'win32'
        ? 'cargo build --release'
        : 'cargo build --release';
      
      const { stdout, stderr } = await this.execPromise(buildCommand, { cwd: engineDir });
      
      // Check if the build was successful
      const libPath = path.resolve(this.config.libPath);
      if (!fs.existsSync(libPath)) {
        throw new Error(`Failed to build Rust transformer: library not found at ${libPath}`);
      }
      
      logger.info('Rust transformer built successfully');
    } catch (error) {
      logger.error('Failed to build Rust transformer:', error);
      throw error;
    }
  }

  /**
   * Set security mode
   */
  public setSecurityEnabled(enabled: boolean): void {
    this.securityEnabled = enabled;
  }

  /**
   * Get transformer status
   */
  public getStatus(): {
    initialized: boolean;
    processRunning: boolean;
    queueLength: number;
    restartCount: number;
  } {
    return {
      initialized: this.initialized,
      processRunning: this.transformerProcess !== null,
      queueLength: this.requestQueue.length,
      restartCount: this.restartCount
    };
  }

  /**
   * Shutdown the transformer integration
   */
  public shutdown(): void {
    this.stopTransformerProcess();
    this.failAllQueuedRequests('Transformer integration shutdown');
    this.initialized = false;
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<RustTransformerConfig>): void {
    const needsRestart = 
      (config.libPath !== undefined && config.libPath !== this.config.libPath) ||
      (config.useMultiThreading !== undefined && config.useMultiThreading !== this.config.useMultiThreading) ||
      (config.threadCount !== undefined && config.threadCount !== this.config.threadCount) ||
      (config.enableJIT !== undefined && config.enableJIT !== this.config.enableJIT);
    
    this.config = {
      ...this.config,
      ...config
    };
    
    if (needsRestart && this.initialized) {
      logger.info('Restarting transformer process due to configuration change');
      this.stopTransformerProcess();
      this.startTransformerProcess()
        .catch(error => {
          logger.error('Failed to restart transformer process after config update:', error);
        });
    }
  }
}

// Export singleton instance
export const rustTransformerIntegration = new RustTransformerIntegration();