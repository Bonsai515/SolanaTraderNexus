/**
 * Rust Bridge Module
 * 
 * This module provides TypeScript bindings for the Rust-based components,
 * enabling high-performance computation through FFI.
 */

import { logger } from '../logger';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

interface RustCallOptions {
  functionName: string;
  params: any;
  returnType?: string;
}

export class RustBridge {
  private static instance: RustBridge;
  private readonly rustBinaryPath: string;
  private initialized: boolean = false;
  
  private constructor() {
    // Define path to Rust binary
    this.rustBinaryPath = path.join(
      process.cwd(), 
      'rust_engine', 
      'target', 
      'release', 
      'rust_engine'
    );
    
    this.initialize();
  }
  
  /**
   * Get the RustBridge singleton instance
   */
  public static getInstance(): RustBridge {
    if (!RustBridge.instance) {
      RustBridge.instance = new RustBridge();
    }
    return RustBridge.instance;
  }
  
  /**
   * Initialize the Rust bridge
   */
  private initialize(): void {
    try {
      // Check if Rust binary exists
      if (fs.existsSync(this.rustBinaryPath)) {
        this.initialized = true;
        logger.info(`Rust bridge initialized with binary at ${this.rustBinaryPath}`);
      } else {
        logger.warn(`Rust binary not found at ${this.rustBinaryPath}`);
        this.initialized = false;
      }
    } catch (error) {
      logger.error(`Failed to initialize Rust bridge: ${error.message}`);
      this.initialized = false;
    }
  }
  
  /**
   * Check if the Rust bridge is available
   */
  public static isAvailable(): boolean {
    return RustBridge.getInstance().initialized;
  }
  
  /**
   * Call a Rust function through the bridge
   * 
   * @param functionName Name of the Rust function to call
   * @param params Parameters to pass to the function
   * @returns Result from the Rust function
   */
  public static async callFunction(
    functionName: string,
    params: any
  ): Promise<any> {
    const bridge = RustBridge.getInstance();
    
    if (!bridge.initialized) {
      throw new Error('Rust bridge not initialized');
    }
    
    try {
      // Prepare the command
      const paramsJson = JSON.stringify(params);
      const command = `${bridge.rustBinaryPath} ${functionName} '${paramsJson}'`;
      
      // Execute the command
      const result = execSync(command, { encoding: 'utf8' });
      
      // Parse the result
      try {
        return JSON.parse(result);
      } catch (e) {
        return result.trim();
      }
    } catch (error) {
      logger.error(`Error calling Rust function ${functionName}: ${error.message}`);
      throw error;
    }
  }
}