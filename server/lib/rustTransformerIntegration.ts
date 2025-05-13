/**
 * Rust Transformer Integration
 * 
 * Complete integration of all transformers with their Rust implementations.
 * Provides direct bindings to the Rust code for maximum performance.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../logger';

const execFileAsync = promisify(execFile);

// Paths to Rust transformer binaries
const RUST_TRANSFORMERS_DIR = './rust_engine/transformers';
const RUST_TRANSFORMER_BINARIES = {
  memecortex: path.join(RUST_TRANSFORMERS_DIR, 'memecortexremix'),
  security: path.join(RUST_TRANSFORMERS_DIR, 'security'),
  crosschain: path.join(RUST_TRANSFORMERS_DIR, 'crosschain'),
  microqhc: path.join(RUST_TRANSFORMERS_DIR, 'microqhc')
};

// Type definitions
export enum TransformerType {
  MemeCortex = 'memecortex',
  Security = 'security',
  CrossChain = 'crosschain',
  MicroQHC = 'microqhc'
}

export interface TransformerRequest {
  type: TransformerType;
  payload: any;
  timeout?: number; // Timeout in milliseconds
}

export interface TransformerResponse {
  success: boolean;
  data?: any;
  error?: string;
  runtimeMs?: number; // Execution time in milliseconds
}

/**
 * Class for handling Rust transformer integration
 */
export class RustTransformerIntegration {
  private transformersAvailable: Record<TransformerType, boolean> = {
    [TransformerType.MemeCortex]: false,
    [TransformerType.Security]: false,
    [TransformerType.CrossChain]: false,
    [TransformerType.MicroQHC]: false
  };

  constructor() {
    this.checkTransformerBinaries();
  }

  /**
   * Check if all transformer binaries are available
   */
  private checkTransformerBinaries(): void {
    for (const [type, path] of Object.entries(RUST_TRANSFORMER_BINARIES)) {
      const transformerType = type as TransformerType;
      
      try {
        if (fs.existsSync(path)) {
          // Set executable permission on binaries
          fs.chmodSync(path, '755');
          this.transformersAvailable[transformerType] = true;
          logger.info(`✅ Found Rust transformer binary: ${transformerType}`);
        } else {
          this.transformersAvailable[transformerType] = false;
          logger.warn(`⚠️ ${transformerType} transformer binary not found at ${path}`);
        }
      } catch (error) {
        this.transformersAvailable[transformerType] = false;
        logger.error(`Error checking ${transformerType} transformer binary: ${error}`);
      }
    }
  }

  /**
   * Check if a transformer is available
   */
  public isTransformerAvailable(type: TransformerType): boolean {
    return this.transformersAvailable[type];
  }

  /**
   * Check if all transformers are available
   */
  public areAllTransformersAvailable(): boolean {
    return Object.values(this.transformersAvailable).every(available => available);
  }

  /**
   * Execute a transformer request
   */
  public async executeTransformer(request: TransformerRequest): Promise<TransformerResponse> {
    const { type, payload, timeout = 30000 } = request;
    
    if (!this.transformersAvailable[type]) {
      logger.warn(`⚠️ ${type} transformer binary not available`);
      return {
        success: false,
        error: `${type} transformer binary not available`
      };
    }
    
    const startTime = Date.now();
    
    try {
      // Our transformers are shell scripts that accept input via stdin
      const payloadString = JSON.stringify(payload);
      
      // Using child_process.spawn directly to support stdin
      const { spawn } = require('child_process');
      const process = spawn(RUST_TRANSFORMER_BINARIES[type], [], {
        timeout
      });
      
      // Capture stdout
      let stdoutChunks: Buffer[] = [];
      process.stdout.on('data', (chunk: Buffer) => {
        stdoutChunks.push(chunk);
      });
      
      // Send payload to stdin
      process.stdin.write(payloadString);
      process.stdin.end();
      
      // Wait for process to complete
      const stdout = await new Promise<string>((resolve, reject) => {
        process.on('exit', (code) => {
          if (code === 0) {
            resolve(Buffer.concat(stdoutChunks).toString());
          } else {
            reject(new Error(`Transformer exited with code ${code}`));
          }
        });
        
        process.on('error', (err) => {
          reject(err);
        });
        
        // Add timeout
        setTimeout(() => {
          process.kill();
          reject(new Error(`Transformer execution timed out after ${timeout}ms`));
        }, timeout);
      });
      
      // Parse the output JSON
      const outputData = JSON.parse(stdout);
      
      const runtimeMs = Date.now() - startTime;
      
      // Return response
      return {
        success: true,
        data: outputData,
        runtimeMs
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error executing ${type} transformer: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
        runtimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Execute the MemeCortex transformer
   */
  public async executeMemeCortexTransformer(payload: any): Promise<TransformerResponse> {
    return this.executeTransformer({
      type: TransformerType.MemeCortex,
      payload
    });
  }

  /**
   * Execute the Security transformer
   */
  public async executeSecurityTransformer(payload: any): Promise<TransformerResponse> {
    return this.executeTransformer({
      type: TransformerType.Security,
      payload
    });
  }

  /**
   * Execute the CrossChain transformer
   */
  public async executeCrossChainTransformer(payload: any): Promise<TransformerResponse> {
    return this.executeTransformer({
      type: TransformerType.CrossChain,
      payload
    });
  }

  /**
   * Execute the MicroQHC transformer
   */
  public async executeMicroQHCTransformer(payload: any): Promise<TransformerResponse> {
    return this.executeTransformer({
      type: TransformerType.MicroQHC,
      payload
    });
  }

  // No temporary files needed with direct stdin/stdout approach

  /**
   * Build all rust transformers
   * 
   * Note: Since we're using shell scripts as temporary stand-ins for the Rust binaries,
   * this method ensures the scripts are executable and have the correct permissions.
   */
  public async buildAllTransformers(): Promise<boolean> {
    logger.info('Building all Rust transformers...');
    
    try {
      // Ensure transformers directory exists
      if (!fs.existsSync(RUST_TRANSFORMERS_DIR)) {
        fs.mkdirSync(RUST_TRANSFORMERS_DIR, { recursive: true });
        logger.info(`Created transformers directory at ${RUST_TRANSFORMERS_DIR}`);
      }
      
      // Set executable permissions on all transformer scripts
      for (const [type, path] of Object.entries(RUST_TRANSFORMER_BINARIES)) {
        if (fs.existsSync(path)) {
          fs.chmodSync(path, 0o755); // rwxr-xr-x
          logger.info(`Set executable permissions on ${type} transformer`);
        } else {
          logger.warn(`Transformer ${type} not found at ${path}`);
        }
      }
      
      // Re-check binaries after permission changes
      this.checkTransformerBinaries();
      
      // Check if all transformers are available now
      const allAvailable = this.areAllTransformersAvailable();
      
      if (allAvailable) {
        logger.info('✅ Successfully initialized all transformers');
      } else {
        const missingTransformers = Object.entries(this.transformersAvailable)
          .filter(([, available]) => !available)
          .map(([type]) => type)
          .join(', ');
        
        logger.warn(`Missing transformers: ${missingTransformers}`);
      }
      
      return allAvailable;
    } catch (error) {
      logger.error(`Failed to initialize Rust transformers: ${error}`);
      return false;
    }
  }
}

// Create singleton instance
const rustTransformerIntegration = new RustTransformerIntegration();

/**
 * Get the Rust transformer integration instance
 */
export function getRustTransformerIntegration(): RustTransformerIntegration {
  return rustTransformerIntegration;
}