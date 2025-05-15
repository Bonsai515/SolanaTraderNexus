/**
 * Rust ZK Proof Bridge
 * 
 * This module provides bridging between TypeScript and the Rust-based ZK proof system,
 * allowing for high-performance signal verification without revealing model parameters.
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../logger';
import { ZkProof, ZkProofScheme, ZkVerificationResult, ModelWeights } from './zkProofVerification';

// Path to the Rust binary
const RUST_ZK_BINARY_PATH = path.join(__dirname, '../../rust_engine/target/release/zk_proof_verifier');

// Check if Rust binary exists
const rustBinaryExists = fs.existsSync(RUST_ZK_BINARY_PATH);

/**
 * Generate a ZK proof using the Rust implementation
 * @param signalData Serialized signal data
 * @param modelWeights Model weights
 * @param scheme ZK proof scheme to use
 * @returns Promise resolving to the generated proof
 */
export async function generateProofWithRust(
  signalData: string,
  modelWeights: ModelWeights,
  scheme: ZkProofScheme
): Promise<ZkProof | null> {
  if (!rustBinaryExists) {
    logger.warn('Rust ZK binary not found, falling back to TypeScript implementation');
    return null;
  }
  
  return new Promise((resolve, reject) => {
    // Create temporary files for inputs
    const tempDir = process.env.TEMP || '/tmp';
    const signalDataFile = path.join(tempDir, `signal_data_${Date.now()}.json`);
    const modelWeightsFile = path.join(tempDir, `model_weights_${Date.now()}.json`);
    
    // Write data to temporary files
    fs.writeFileSync(signalDataFile, signalData);
    fs.writeFileSync(modelWeightsFile, JSON.stringify(modelWeights));
    
    // Spawn Rust process
    const rustProcess = spawn(RUST_ZK_BINARY_PATH, [
      'generate',
      '--signal-data', signalDataFile,
      '--model-weights', modelWeightsFile,
      '--scheme', scheme
    ]);
    
    let output = '';
    let errorOutput = '';
    
    rustProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    rustProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    rustProcess.on('close', (code) => {
      // Clean up temporary files
      try {
        fs.unlinkSync(signalDataFile);
        fs.unlinkSync(modelWeightsFile);
      } catch (e) {
        logger.warn(`Failed to clean up temporary files: ${e.message}`);
      }
      
      if (code !== 0) {
        logger.error(`Rust ZK proof generation failed with code ${code}: ${errorOutput}`);
        reject(new Error(`Rust ZK proof generation failed: ${errorOutput}`));
        return;
      }
      
      try {
        // Parse the output as JSON
        const proof = JSON.parse(output) as ZkProof;
        resolve(proof);
      } catch (e) {
        logger.error(`Failed to parse Rust ZK proof output: ${e.message}`);
        reject(new Error(`Failed to parse Rust ZK proof output: ${e.message}`));
      }
    });
  });
}

/**
 * Verify a ZK proof using the Rust implementation
 * @param proof ZK proof to verify
 * @returns Promise resolving to the verification result
 */
export async function verifyProofWithRust(proof: ZkProof): Promise<ZkVerificationResult | null> {
  if (!rustBinaryExists) {
    logger.warn('Rust ZK binary not found, falling back to TypeScript implementation');
    return null;
  }
  
  return new Promise((resolve, reject) => {
    // Create temporary file for input
    const tempDir = process.env.TEMP || '/tmp';
    const proofFile = path.join(tempDir, `proof_${Date.now()}.json`);
    
    // Write proof to temporary file
    fs.writeFileSync(proofFile, JSON.stringify(proof));
    
    // Spawn Rust process
    const rustProcess = spawn(RUST_ZK_BINARY_PATH, [
      'verify',
      '--proof', proofFile
    ]);
    
    let output = '';
    let errorOutput = '';
    
    rustProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    rustProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    rustProcess.on('close', (code) => {
      // Clean up temporary file
      try {
        fs.unlinkSync(proofFile);
      } catch (e) {
        logger.warn(`Failed to clean up temporary file: ${e.message}`);
      }
      
      if (code !== 0) {
        logger.error(`Rust ZK proof verification failed with code ${code}: ${errorOutput}`);
        reject(new Error(`Rust ZK proof verification failed: ${errorOutput}`));
        return;
      }
      
      try {
        // Parse the output as JSON
        const result = JSON.parse(output) as ZkVerificationResult;
        resolve(result);
      } catch (e) {
        logger.error(`Failed to parse Rust ZK proof verification output: ${e.message}`);
        reject(new Error(`Failed to parse Rust ZK proof verification output: ${e.message}`));
      }
    });
  });
}

/**
 * Check if the Rust ZK proof binary is available
 * @returns Whether the binary exists
 */
export function isRustZkProofAvailable(): boolean {
  return rustBinaryExists;
}

// Export the Rust ZK proof bridge
export const rustZkProofBridge = {
  generateProof: generateProofWithRust,
  verifyProof: verifyProofWithRust,
  isAvailable: isRustZkProofAvailable
};

export default rustZkProofBridge;