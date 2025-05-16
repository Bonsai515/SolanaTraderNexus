/**
 * On-Chain Program Connector
 * 
 * Provides direct integration with deployed Solana programs
 * for transformers and trading strategies.
 */

import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

// Program addresses from configuration
let PROGRAM_ADDRESSES: Record<string, string> = {};

// Load program addresses from config
try {
  const configPath = path.join(__dirname, '..', 'data', 'onchain-programs.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    PROGRAM_ADDRESSES = Object.fromEntries(
      config.programs.map((p: any) => [p.name, p.address])
    );
    logger.info(`[OnChainConnector] Loaded ${Object.keys(PROGRAM_ADDRESSES).length} program addresses`);
  } else {
    logger.warn('[OnChainConnector] Program config not found, using defaults');
    PROGRAM_ADDRESSES = {
      HYPERION_FLASH_LOAN: 'HPRNAUMsdRs7XG9UBKtLwkuZbh4VJzXbsR5kPbK7ZwTa',
      QUANTUM_VAULT: 'QVKTLwksMPTt5fQVhNPak3xYpYQNXDPrLKAxZBMTK2VL',
      MEMECORTEX: 'MECRSRB4mQM5GpHcZKVCwvydaQn7YZ7WZPzw3G1nssrV', 
      SINGULARITY_BRIDGE: 'SNG4ARty417DcPNTQUvGBXVKPbLTzBq1XmMsJQQFC81H',
      NEXUS_ENGINE: 'NEXSa876vaGCt8jz4Qsqdx6ZrWNUZM7JDEHvTb6im1Jx'
    };
  }
} catch (error) {
  logger.error('[OnChainConnector] Error loading program addresses:', error);
  // Default addresses in case of error
  PROGRAM_ADDRESSES = {
    HYPERION_FLASH_LOAN: 'HPRNAUMsdRs7XG9UBKtLwkuZbh4VJzXbsR5kPbK7ZwTa',
    QUANTUM_VAULT: 'QVKTLwksMPTt5fQVhNPak3xYpYQNXDPrLKAxZBMTK2VL',
    MEMECORTEX: 'MECRSRB4mQM5GpHcZKVCwvydaQn7YZ7WZPzw3G1nssrV',
    SINGULARITY_BRIDGE: 'SNG4ARty417DcPNTQUvGBXVKPbLTzBq1XmMsJQQFC81H',
    NEXUS_ENGINE: 'NEXSa876vaGCt8jz4Qsqdx6ZrWNUZM7JDEHvTb6im1Jx'
  };
}

// IDL cache
const idlCache = new Map<string, any>();

/**
 * On-Chain Program Connector class
 */
export class OnChainConnector {
  private connection: Connection;
  private wallet: Keypair | null = null;
  
  /**
   * Constructor
   * @param rpcUrl Solana RPC URL
   */
  constructor(rpcUrl: string) {
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.loadWallet();
    logger.info(`[OnChainConnector] Initialized with RPC URL: ${rpcUrl}`);
  }
  
  /**
   * Load wallet for transaction signing
   */
  private loadWallet(): void {
    try {
      const walletPath = path.join(__dirname, '..', 'wallet.json');
      
      if (fs.existsSync(walletPath)) {
        const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
        const secretKey = new Uint8Array(walletData);
        this.wallet = Keypair.fromSecretKey(secretKey);
        logger.info(`[OnChainConnector] Loaded wallet: ${this.wallet.publicKey.toString()}`);
      } else {
        logger.error('[OnChainConnector] Wallet file not found');
      }
    } catch (error) {
      logger.error('[OnChainConnector] Error loading wallet:', error);
    }
  }
  
  /**
   * Get program pubkey
   * @param programName Program name
   * @returns Program public key
   */
  public getProgramId(programName: string): PublicKey | null {
    try {
      const address = PROGRAM_ADDRESSES[programName];
      if (!address) {
        logger.warn(`[OnChainConnector] Program ${programName} not found`);
        return null;
      }
      
      return new PublicKey(address);
    } catch (error) {
      logger.error(`[OnChainConnector] Invalid program address for ${programName}:`, error);
      return null;
    }
  }
  
  /**
   * Load IDL for a program
   * @param programName Program name
   * @returns Program IDL
   */
  public async loadIdl(programName: string): Promise<any | null> {
    // Check cache first
    if (idlCache.has(programName)) {
      return idlCache.get(programName);
    }
    
    try {
      const idlPath = path.join(__dirname, '..', 'data', 'idl', `${programName.toLowerCase()}.json`);
      
      if (fs.existsSync(idlPath)) {
        const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
        idlCache.set(programName, idl);
        return idl;
      } else {
        logger.warn(`[OnChainConnector] IDL for ${programName} not found`);
        return null;
      }
    } catch (error) {
      logger.error(`[OnChainConnector] Error loading IDL for ${programName}:`, error);
      return null;
    }
  }
  
  /**
   * Verify connection to a program
   * @param programName Program name
   * @returns Whether connection is valid
   */
  public async verifyProgramConnection(programName: string): Promise<boolean> {
    const programId = this.getProgramId(programName);
    
    if (!programId) {
      return false;
    }
    
    try {
      const accountInfo = await this.connection.getAccountInfo(programId);
      
      if (!accountInfo) {
        logger.error(`[OnChainConnector] Program ${programName} not found on-chain`);
        return false;
      }
      
      if (!accountInfo.executable) {
        logger.error(`[OnChainConnector] Program ${programName} is not executable`);
        return false;
      }
      
      logger.info(`[OnChainConnector] Successfully verified program ${programName}`);
      return true;
    } catch (error) {
      logger.error(`[OnChainConnector] Error verifying program ${programName}:`, error);
      return false;
    }
  }
  
  /**
   * Execute a program instruction
   * @param programName Program name
   * @param instructionData Instruction data
   * @returns Transaction signature
   */
  public async executeProgramInstruction(
    programName: string,
    instructionData: Buffer
  ): Promise<string | null> {
    const programId = this.getProgramId(programName);
    
    if (!programId || !this.wallet) {
      return null;
    }
    
    try {
      // Create transaction
      const transaction = new Transaction();
      
      // Add instruction
      transaction.add({
        keys: [
          {
            pubkey: this.wallet.publicKey,
            isSigner: true,
            isWritable: true
          }
        ],
        programId,
        data: instructionData
      });
      
      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.wallet.publicKey;
      
      // Sign and send transaction
      transaction.sign(this.wallet);
      const signature = await this.connection.sendRawTransaction(transaction.serialize());
      
      // Confirm transaction
      const confirmation = await this.connection.confirmTransaction(signature);
      
      if (confirmation.value.err) {
        logger.error(`[OnChainConnector] Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        return null;
      }
      
      logger.info(`[OnChainConnector] Successfully executed ${programName} instruction: ${signature}`);
      return signature;
    } catch (error) {
      logger.error(`[OnChainConnector] Error executing ${programName} instruction:`, error);
      return null;
    }
  }
}

// Create singleton instance
let onChainConnector: OnChainConnector | null = null;

/**
 * Get the on-chain connector instance
 * @param rpcUrl RPC URL (optional, uses default if not provided)
 * @returns On-chain connector instance
 */
export function getOnChainConnector(rpcUrl?: string): OnChainConnector {
  if (!onChainConnector) {
    const defaultRpcUrl = 'https://solana-api.instantnodes.io/token-NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9';
    onChainConnector = new OnChainConnector(rpcUrl || defaultRpcUrl);
  }
  
  return onChainConnector;
}

// Transformer integration helpers
export const transformerHelpers = {
  /**
   * Execute MemeCortex prediction
   * @param tokenAddress Token address
   * @param timeframeMinutes Timeframe in minutes
   * @returns Prediction data
   */
  async executeMemePredictor(tokenAddress: string, timeframeMinutes: number): Promise<any> {
    const connector = getOnChainConnector();
    
    try {
      // Prepare instruction data
      const instructionData = Buffer.from(
        JSON.stringify({
          action: 'predict',
          token: tokenAddress,
          timeframe: timeframeMinutes
        })
      );
      
      const signature = await connector.executeProgramInstruction(
        'MEMECORTEX',
        instructionData
      );
      
      if (!signature) {
        logger.warn('[OnChainConnector] Failed to execute MEMECORTEX prediction');
        return null;
      }
      
      // Simulated response for development
      return {
        tokenAddress,
        prediction: 'bullish',
        confidence: 0.87,
        timeframe: timeframeMinutes,
        signature
      };
    } catch (error) {
      logger.error('[OnChainConnector] Error executing MEMECORTEX prediction:', error);
      return null;
    }
  },
  
  /**
   * Execute Hyperion flash loan arbitrage
   * @param sourceToken Source token
   * @param targetToken Target token
   * @param amount Amount
   * @returns Transaction result
   */
  async executeFlashArbitrage(sourceToken: string, targetToken: string, amount: number): Promise<any> {
    const connector = getOnChainConnector();
    
    try {
      // Prepare instruction data
      const instructionData = Buffer.from(
        JSON.stringify({
          action: 'flashArbitrage',
          sourceToken,
          targetToken,
          amount
        })
      );
      
      const signature = await connector.executeProgramInstruction(
        'HYPERION_FLASH_LOAN',
        instructionData
      );
      
      if (!signature) {
        logger.warn('[OnChainConnector] Failed to execute HYPERION_FLASH_LOAN arbitrage');
        return null;
      }
      
      // Simulated response for development
      return {
        sourceToken,
        targetToken,
        amount,
        profit: amount * 0.05, // 5% profit
        signature
      };
    } catch (error) {
      logger.error('[OnChainConnector] Error executing HYPERION_FLASH_LOAN arbitrage:', error);
      return null;
    }
  }
};
