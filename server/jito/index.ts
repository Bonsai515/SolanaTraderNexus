/**
 * Jito Bundle Integration
 * 
 * This module integrates the Jito Bundle Service with the
 * Hyperion Flash Loan and Nexus Pro Engine systems.
 */

import { Connection, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { JitoBundleService } from './bundle-service';
import * as fs from 'fs';
import * as path from 'path';

// Constants
const CONFIG_DIR = '../config';
const JITO_CONFIG_PATH = path.join(CONFIG_DIR, 'jito.json');

// Singleton instance
let bundleService: JitoBundleService | null = null;

/**
 * Initialize Jito bundle service
 */
export function initializeJitoBundle(connection: Connection): JitoBundleService {
  if (!bundleService) {
    bundleService = new JitoBundleService(connection);
    console.log('[Jito] Bundle service initialized');
  }
  
  return bundleService;
}

/**
 * Get Jito bundle service
 */
export function getJitoBundleService(): JitoBundleService | null {
  return bundleService;
}

/**
 * Create a protected transaction
 */
export async function createProtectedTransaction(
  instructions: TransactionInstruction[],
  feePayer: PublicKey,
  priorityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' | 'MAXIMUM' = 'MEDIUM'
): Promise<any> {
  if (!bundleService) {
    throw new Error('[Jito] Bundle service not initialized');
  }
  
  return bundleService.createProtectedTransaction(
    instructions,
    feePayer,
    priorityLevel
  );
}

/**
 * Execute a transaction as a bundle
 */
export async function executeAsBundle(
  transaction: any,
  signers: any[]
): Promise<string> {
  if (!bundleService) {
    throw new Error('[Jito] Bundle service not initialized');
  }
  
  return bundleService.executeAsBundle(transaction, signers);
}

/**
 * Execute a flash loan arbitrage as a bundle
 */
export async function executeFlashLoanArbitrage(
  flashLoanIx: TransactionInstruction,
  swapIxs: TransactionInstruction[],
  repayIx: TransactionInstruction,
  feePayer: PublicKey,
  signers: any[]
): Promise<string> {
  if (!bundleService) {
    throw new Error('[Jito] Bundle service not initialized');
  }
  
  return bundleService.executeFlashLoanArbitrage(
    flashLoanIx,
    swapIxs,
    repayIx,
    feePayer,
    signers
  );
}

/**
 * Check if Jito bundle service is available
 */
export function isJitoBundleAvailable(): boolean {
  return bundleService !== null && bundleService.isConnected();
}