import { Keypair, PublicKey } from '@solana/web3.js';
import { getSolanaConnection } from './solanaConnection';
import { Buffer } from 'buffer';

/**
 * Secure wallet management system
 * Handles keypair generation, encryption, and management
 */
export class WalletManager {
  private wallets: Map<string, {
    keypair: Keypair;
    name: string;
    type: WalletType;
    encryptedKey?: string;
  }> = new Map();

  /**
   * Create a new wallet
   * @param name Wallet name
   * @param type Wallet type
   * @param existingSecretKey Optional existing secret key (Uint8Array or base58)
   * @returns The wallet address
   */
  createWallet(
    name: string,
    type: WalletType,
    existingSecretKey?: Uint8Array | string
  ): string {
    try {
      let keypair: Keypair;
      
      // Create a new keypair or use existing secret key
      if (existingSecretKey) {
        if (typeof existingSecretKey === 'string') {
          // Handle base58 encoded secret key
          const decoded = Buffer.from(existingSecretKey, 'base58');
          keypair = Keypair.fromSecretKey(decoded);
        } else {
          // Handle Uint8Array secret key
          keypair = Keypair.fromSecretKey(existingSecretKey);
        }
      } else {
        // Generate a completely new keypair
        keypair = Keypair.generate();
      }
      
      const walletAddress = keypair.publicKey.toString();
      
      // Store the wallet
      this.wallets.set(walletAddress, {
        keypair,
        name,
        type,
        // In a real implementation, we would encrypt the key here
        // encryptedKey: this.encryptSecretKey(keypair.secretKey)
      });
      
      return walletAddress;
    } catch (error) {
      console.error('Failed to create wallet:', error);
      throw new Error('Failed to create wallet');
    }
  }
  
  /**
   * Get a wallet by address
   */
  getWallet(address: string) {
    const wallet = this.wallets.get(address);
    
    if (!wallet) {
      throw new Error(`Wallet not found: ${address}`);
    }
    
    return {
      address,
      name: wallet.name,
      type: wallet.type,
      publicKey: wallet.keypair.publicKey
    };
  }
  
  /**
   * Get the keypair for a wallet
   * This is a sensitive operation and should be protected
   */
  getKeypair(address: string): Keypair {
    const wallet = this.wallets.get(address);
    
    if (!wallet) {
      throw new Error(`Wallet not found: ${address}`);
    }
    
    return wallet.keypair;
  }
  
  /**
   * Get all wallet addresses
   */
  getAllWalletAddresses(): string[] {
    return Array.from(this.wallets.keys());
  }
  
  /**
   * Get all wallet info (excluding sensitive data)
   */
  getAllWallets() {
    return Array.from(this.wallets.entries()).map(([address, wallet]) => ({
      address,
      name: wallet.name,
      type: wallet.type,
      publicKey: wallet.keypair.publicKey
    }));
  }
  
  /**
   * Check if a wallet with the given address exists
   */
  hasWallet(address: string): boolean {
    return this.wallets.has(address);
  }
  
  /**
   * Get the balance for a wallet
   */
  async getBalance(address: string): Promise<number> {
    try {
      const wallet = this.wallets.get(address);
      
      if (!wallet) {
        throw new Error(`Wallet not found: ${address}`);
      }
      
      const connection = getSolanaConnection();
      const balance = await connection.getBalance(wallet.keypair.publicKey);
      
      return balance;
    } catch (error) {
      console.error('Failed to get balance:', error);
      throw error;
    }
  }
  
  /**
   * Create a specialized agent wallet
   * @param agentType The type of agent (Hyperion or Quantum Omega)
   * @param name The wallet name
   * @returns The wallet address
   */
  createAgentWallet(agentType: AgentType, name: string): string {
    const walletType = agentType === AgentType.HYPERION ? 
      WalletType.FLASH_ARBITRAGE : 
      WalletType.SNIPER;
    
    return this.createWallet(`${name} (${agentType})`, walletType);
  }
}

/**
 * Wallet types
 */
export enum WalletType {
  TRADING = 'trading',
  PROFIT = 'profit',
  FEE = 'fee',
  STEALTH = 'stealth',
  FLASH_ARBITRAGE = 'flash_arbitrage',
  SNIPER = 'sniper'
}

/**
 * Agent types
 */
export enum AgentType {
  HYPERION = 'hyperion',
  QUANTUM_OMEGA = 'quantum_omega'
}

// Create and export a singleton instance
export default new WalletManager();