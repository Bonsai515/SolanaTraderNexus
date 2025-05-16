/**
 * Anchor Program Connector
 * 
 * Provides connectivity to Solana on-chain programs using Anchor framework
 * with reliable connection management and verification.
 */

import { Connection, PublicKey, Keypair, Transaction, SystemProgram } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

// Program IDs for our deployed programs
const PROGRAM_IDS = {
  HYPERION_FLASH_LOAN: new PublicKey('HPRNAUMsdRs7XG9UBKtLwkuZbh4VJzXbsR5kPbK7ZwTa'),
  QUANTUM_VAULT: new PublicKey('QVKTLwksMPTt5fQVhNPak3xYpYQNXDPrLKAxZBMTK2VL'),
  MEMECORTEX: new PublicKey('MECRSRB4mQM5GpHcZKVCwvydaQn7YZ7WZPzw3G1nssrV'),
  SINGULARITY_BRIDGE: new PublicKey('SNG4ARty417DcPNTQUvGBXVKPbLTzBq1XmMsJQQFC81H'),
  NEXUS_ENGINE: new PublicKey('NEXSa876vaGCt8jz4Qsqdx6ZrWNUZM7JDEHvTb6im1Jx')
};

// Connection configuration
interface ConnectionConfig {
  url: string;
  commitment: string;
  confirmTransactionInitialTimeout: number;
}

/**
 * Anchor Program Connection Manager
 */
export class AnchorProgramConnector {
  private connection: Connection | null = null;
  private connectionConfig: ConnectionConfig;
  private programIds: Record<string, PublicKey>;
  private walletKeyPair: Keypair | null = null;
  private connectionTimeoutIds: NodeJS.Timeout[] = [];
  private lastConnectionCheck: number = 0;
  private isConnectionHealthy: boolean = false;
  
  /**
   * Constructor
   * @param rpcUrl The RPC URL to connect to
   */
  constructor(rpcUrl: string) {
    // Default connection configuration
    this.connectionConfig = {
      url: rpcUrl,
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000 // 60 seconds
    };
    
    this.programIds = { ...PROGRAM_IDS };
    
    this.initializeConnection();
    this.loadSystemWallet();
  }
  
  /**
   * Initialize Solana connection
   */
  private initializeConnection(): void {
    try {
      this.connection = new Connection(
        this.connectionConfig.url,
        {
          commitment: this.connectionConfig.commitment as any,
          confirmTransactionInitialTimeout: this.connectionConfig.confirmTransactionInitialTimeout
        }
      );
      
      logger.info(`[Anchor] Initialized connection to ${this.connectionConfig.url}`);
      
      // Schedule regular connection checks
      this.scheduleConnectionChecks();
    } catch (error) {
      logger.error('[Anchor] Failed to initialize connection:', error);
      throw new Error(`Failed to initialize Solana connection: ${error.message}`);
    }
  }
  
  /**
   * Load system wallet for transaction signing
   */
  private loadSystemWallet(): void {
    try {
      // In production, this would load from an environment variable or secure storage
      // For development, we'll create a new keypair if one doesn't exist
      const walletPath = path.join(__dirname, '..', 'wallet.json');
      
      let secretKey: Uint8Array;
      
      if (fs.existsSync(walletPath)) {
        const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
        secretKey = new Uint8Array(walletData);
      } else {
        // For development only - not for production use
        const newKeypair = Keypair.generate();
        secretKey = newKeypair.secretKey;
        fs.writeFileSync(walletPath, JSON.stringify(Array.from(secretKey)));
        logger.info('[Anchor] Generated new wallet keypair for development');
      }
      
      this.walletKeyPair = Keypair.fromSecretKey(secretKey);
      logger.info(`[Anchor] Loaded wallet: ${this.walletKeyPair.publicKey.toString()}`);
    } catch (error) {
      logger.error('[Anchor] Failed to load wallet:', error);
    }
  }
  
  /**
   * Schedule regular connection health checks
   */
  private scheduleConnectionChecks(): void {
    // Clear any existing timeouts
    this.connectionTimeoutIds.forEach(id => clearTimeout(id));
    this.connectionTimeoutIds = [];
    
    // Schedule an immediate check
    const immediateCheck = setTimeout(() => this.checkConnectionHealth(), 1000);
    this.connectionTimeoutIds.push(immediateCheck);
    
    // Schedule regular checks every 2 minutes
    const regularCheck = setInterval(() => this.checkConnectionHealth(), 2 * 60 * 1000);
    this.connectionTimeoutIds.push(regularCheck as unknown as NodeJS.Timeout);
  }
  
  /**
   * Check connection health
   */
  private async checkConnectionHealth(): Promise<boolean> {
    if (!this.connection) {
      logger.error('[Anchor] No connection to check');
      this.isConnectionHealthy = false;
      return false;
    }
    
    try {
      const currentTime = Date.now();
      
      // Only check if it's been at least 30 seconds since the last check
      if (currentTime - this.lastConnectionCheck < 30000) {
        return this.isConnectionHealthy;
      }
      
      this.lastConnectionCheck = currentTime;
      
      // Get recent blockhash to check connection
      const blockhash = await this.connection.getLatestBlockhash();
      
      if (blockhash && blockhash.blockhash) {
        this.isConnectionHealthy = true;
        logger.debug('[Anchor] Connection is healthy');
      } else {
        this.isConnectionHealthy = false;
        logger.warn('[Anchor] Connection check failed: Invalid blockhash');
        this.reconnect();
      }
    } catch (error) {
      this.isConnectionHealthy = false;
      logger.error('[Anchor] Connection check failed:', error);
      this.reconnect();
    }
    
    return this.isConnectionHealthy;
  }
  
  /**
   * Reconnect to Solana
   */
  private reconnect(): void {
    logger.info('[Anchor] Attempting to reconnect...');
    
    try {
      this.initializeConnection();
    } catch (error) {
      logger.error('[Anchor] Reconnection failed:', error);
    }
  }
  
  /**
   * Get the Solana connection
   */
  public getConnection(): Connection | null {
    return this.connection;
  }
  
  /**
   * Get wallet keypair
   */
  public getWalletKeypair(): Keypair | null {
    return this.walletKeyPair;
  }
  
  /**
   * Get program pubkey by name
   * @param programName The name of the program
   */
  public getProgramId(programName: string): PublicKey | null {
    return this.programIds[programName] || null;
  }
  
  /**
   * Verify program is deployable and accessible
   * @param programName The name of the program to verify
   */
  public async verifyProgramDeployment(programName: string): Promise<boolean> {
    if (!this.connection) {
      logger.error('[Anchor] No connection to verify program deployment');
      return false;
    }
    
    const programId = this.getProgramId(programName);
    
    if (!programId) {
      logger.error(`[Anchor] Unknown program: ${programName}`);
      return false;
    }
    
    try {
      // Query program account info to verify it exists and is executable
      const accountInfo = await this.connection.getAccountInfo(programId);
      
      if (!accountInfo) {
        logger.error(`[Anchor] Program ${programName} not found on-chain`);
        return false;
      }
      
      if (!accountInfo.executable) {
        logger.error(`[Anchor] Program ${programName} exists but is not executable`);
        return false;
      }
      
      logger.info(`[Anchor] Program ${programName} is deployed and executable`);
      return true;
    } catch (error) {
      logger.error(`[Anchor] Failed to verify program ${programName}:`, error);
      return false;
    }
  }
  
  /**
   * Verify all known programs
   */
  public async verifyAllPrograms(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const programName of Object.keys(this.programIds)) {
      results[programName] = await this.verifyProgramDeployment(programName);
    }
    
    const deployedCount = Object.values(results).filter(Boolean).length;
    logger.info(`[Anchor] Verified ${deployedCount}/${Object.keys(results).length} programs`);
    
    return results;
  }
  
  /**
   * Configure fallback RPC URLs
   * @param fallbackUrls Array of fallback RPC URLs
   */
  public setFallbackRpcUrls(fallbackUrls: string[]): void {
    // Store fallback URLs for reconnection logic
    this.fallbackRpcUrls = fallbackUrls;
    logger.info(`[Anchor] Configured ${fallbackUrls.length} fallback RPC URLs`);
  }
  
  private fallbackRpcUrls: string[] = [];
  private currentUrlIndex: number = 0;
  
  /**
   * Try next fallback URL when primary fails
   */
  private useNextFallbackUrl(): boolean {
    if (this.fallbackRpcUrls.length === 0) {
      logger.error('[Anchor] No fallback URLs configured');
      return false;
    }
    
    this.currentUrlIndex = (this.currentUrlIndex + 1) % this.fallbackRpcUrls.length;
    const nextUrl = this.fallbackRpcUrls[this.currentUrlIndex];
    
    logger.info(`[Anchor] Switching to fallback RPC URL: ${nextUrl}`);
    this.connectionConfig.url = nextUrl;
    
    try {
      this.initializeConnection();
      return true;
    } catch (error) {
      logger.error('[Anchor] Failed to connect to fallback URL:', error);
      return false;
    }
  }
  
  /**
   * Send a test transaction to verify full functionality
   */
  public async sendTestTransaction(): Promise<string | null> {
    if (!this.connection || !this.walletKeyPair) {
      logger.error('[Anchor] Connection or wallet not initialized');
      return null;
    }
    
    try {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.walletKeyPair.publicKey,
          toPubkey: this.walletKeyPair.publicKey,
          lamports: 100
        })
      );
      
      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.walletKeyPair.publicKey;
      
      // Sign transaction
      transaction.sign(this.walletKeyPair);
      
      // Send transaction
      const signature = await this.connection.sendRawTransaction(transaction.serialize());
      
      // Confirm transaction
      const confirmation = await this.connection.confirmTransaction(signature);
      
      if (confirmation.value.err) {
        logger.error(`[Anchor] Test transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        return null;
      }
      
      logger.info(`[Anchor] Test transaction successful: ${signature}`);
      return signature;
    } catch (error) {
      logger.error('[Anchor] Test transaction failed:', error);
      return null;
    }
  }
}

// Export a factory function to create the connector
export function createAnchorProgramConnector(rpcUrl: string): AnchorProgramConnector {
  return new AnchorProgramConnector(rpcUrl);
}