/**
 * Transformer Connection to Rust Binaries
 * 
 * This module handles connection to the native Rust transformer binaries,
 * ensuring they are properly compiled and available to the system.
 */

import { logger } from './logger';
import { spawn, exec } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import * as path from 'path';

// Transformer binary paths
const TRANSFORMER_DIR = path.resolve(__dirname, '../rust_engine/transformers');
const TRANSFORMER_OUTPUT_DIR = path.resolve(__dirname, '../transformers');

// Transformer names
const TRANSFORMERS = [
  'microqhc',
  'memecortexremix',
  'security',
  'crosschain'
];

/**
 * Connect to Rust transformers and compile if needed
 */
export async function connectToRustTransformers(): Promise<boolean> {
  try {
    logger.info('Connecting to Rust transformer binaries...');
    
    // Create output directory if not exists
    if (!existsSync(TRANSFORMER_OUTPUT_DIR)) {
      mkdirSync(TRANSFORMER_OUTPUT_DIR, { recursive: true });
    }
    
    // Check if transformers are available
    const missingTransformers = TRANSFORMERS.filter(name => 
      !existsSync(path.join(TRANSFORMER_OUTPUT_DIR, name))
    );
    
    if (missingTransformers.length === 0) {
      logger.info('All transformer binaries are already available');
      return true;
    }
    
    // Some transformers are missing, try to build them
    logger.info(`Missing transformers: ${missingTransformers.join(', ')}`);
    
    // Check if Rust source directory exists
    if (!existsSync(TRANSFORMER_DIR)) {
      logger.warn(`Rust transformer source directory not found at ${TRANSFORMER_DIR}`);
      return false;
    }
    
    // Build transformers
    return await buildTransformers();
  } catch (error: any) {
    logger.error('Error connecting to Rust transformers:', error.message);
    return false;
  }
}

/**
 * Build transformer binaries from source
 */
async function buildTransformers(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    logger.info('Building Rust transformer binaries...');
    
    exec(`cd ${TRANSFORMER_DIR} && cargo build --release`, (error, stdout, stderr) => {
      if (error) {
        logger.error(`Failed to build transformers: ${error.message}`);
        logger.error(`Build output: ${stderr}`);
        resolve(false);
        return;
      }
      
      logger.info('Successfully built transformer binaries');
      
      // Copy binaries to output directory
      for (const transformer of TRANSFORMERS) {
        const sourcePath = path.join(TRANSFORMER_DIR, 'target/release', transformer);
        const destPath = path.join(TRANSFORMER_OUTPUT_DIR, transformer);
        
        if (existsSync(sourcePath)) {
          exec(`cp ${sourcePath} ${destPath}`, (cpError) => {
            if (cpError) {
              logger.warn(`Failed to copy ${transformer} binary: ${cpError.message}`);
            } else {
              logger.info(`Copied ${transformer} binary to ${destPath}`);
            }
          });
        } else {
          logger.warn(`Built binary not found for ${transformer} at ${sourcePath}`);
        }
      }
      
      resolve(true);
    });
  });
}

/**
 * Execute a transformer binary
 */
export async function executeTransformer(
  name: string,
  args: string[] = []
): Promise<any> {
  return new Promise((resolve, reject) => {
    const transformerPath = path.join(TRANSFORMER_OUTPUT_DIR, name);
    
    if (!existsSync(transformerPath)) {
      reject(new Error(`Transformer binary not found: ${name}`));
      return;
    }
    
    logger.debug(`Executing transformer: ${name} with args: ${args.join(' ')}`);
    
    const process = spawn(transformerPath, args);
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse transformer output: ${stdout}`));
        }
      } else {
        reject(new Error(`Transformer execution failed with code ${code}: ${stderr}`));
      }
    });
  });
}

/**
 * Check if transformer binary exists
 */
export function transformerExists(name: string): boolean {
  const transformerPath = path.join(TRANSFORMER_OUTPUT_DIR, name);
  return existsSync(transformerPath);
}

/**
 * Get path to transformer binary
 */
export function getTransformerPath(name: string): string {
  return path.join(TRANSFORMER_OUTPUT_DIR, name);
}