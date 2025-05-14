/**
 * Wallet Manager for Solana
 * 
 * This module provides wallet management capabilities for the 
 * Solana trading system, supporting multiple wallet types and roles.
 */

import { logger } from '../logger';
import { Keypair, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// Wallet types
export enum WalletType {
  TRADING = 'TRADING',         // Main trading wallet
  PROFIT_COLLECTION = 'PROFIT_COLLECTION', // Wallet to receive profits
  HOT_FUND = 'HOT_FUND',       // Hot wallet for operations
  FLASH_LOAN = 'FLASH_LOAN',   // Wallet for flash loan operations
  FEE_PAYMENT = 'FEE_PAYMENT'  // Wallet for fee payments
}

// Wallet data storage
interface WalletData {
  type: WalletType;
  publicKey: string;
  privateKey?: string; // Optional private key for user-controlled wallets
  label: string;
  isActive: boolean;
  lastUsed?: number;
  balanceHistory?: { timestamp: number, balance: number }[];
  profitShare?: number; // What percentage of profits is kept (0-100)
  routedTo?: string; // Public key of wallet to route profits to
}

/**
 * Wallet Manager implementation
 */
export class WalletManager {
  private wallets: Map<string, WalletData> = new Map();
  private activeWallet: string | null = null;
  private walletFilePath: string = path.join(process.cwd(), 'data', 'wallets.json');
  private privateKeysFilePath: string = path.join(process.cwd(), 'data', 'private_wallets.json');
  private systemWallet: string = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
  
  constructor() {
    this.loadWallets();
    this.initDefaultWallets();
    
    logger.info('Wallet Manager initialized');
  }
  
  /**
   * Load wallets from storage
   */
  private loadWallets(): void {
    try {
      // Check if the wallet file exists
      if (fs.existsSync(this.walletFilePath)) {
        const walletData = JSON.parse(fs.readFileSync(this.walletFilePath, 'utf8'));
        
        // Load wallets
        walletData.forEach((wallet: WalletData) => {
          this.wallets.set(wallet.publicKey, wallet);
        });
        
        // Find active wallet
        const activeWallet = Array.from(this.wallets.values()).find(w => w.isActive);
        if (activeWallet) {
          this.activeWallet = activeWallet.publicKey;
        }
        
        logger.info(`Loaded ${this.wallets.size} wallets from storage`);
      } else {
        logger.info('No wallet file found, initializing with defaults');
      }
    } catch (error) {
      logger.error('Error loading wallets:', error);
    }
  }
  
  /**
   * Initialize default wallets if none exist
   */
  private initDefaultWallets(): void {
    // If no wallets, add system wallet
    if (this.wallets.size === 0) {
      // Add system wallet as trading wallet
      this.addWallet({
        type: WalletType.TRADING,
        publicKey: this.systemWallet,
        label: 'System Trading Wallet',
        isActive: true
      });
      
      // Add system wallet as profit collection
      this.addWallet({
        type: WalletType.PROFIT_COLLECTION,
        publicKey: this.systemWallet,
        label: 'Profit Collection Wallet',
        isActive: false
      });
      
      // Create a user-controlled Prophet wallet and trading wallets
      this.createProphetWalletSystem();
      
      // Save wallets
      this.saveWallets();
      
      logger.info('Initialized default wallets');
    }
  }
  
  /**
   * Create the Prophet wallet system with two trading wallets
   * and a profit collection wallet that the user can access
   */
  private createProphetWalletSystem(): void {
    try {
      logger.info('Creating Prophet wallet system with private keys for user access');
      
      // Create Prophet wallet (main profit collection wallet)
      const prophetKeypair = Keypair.generate();
      const prophetWallet: WalletData = {
        type: WalletType.PROFIT_COLLECTION,
        publicKey: prophetKeypair.publicKey.toString(),
        privateKey: Buffer.from(prophetKeypair.secretKey).toString('hex'),
        label: 'Prophet Wallet (User Controlled)',
        isActive: true,
        profitShare: 100 // 100% of routed profits go here
      };
      
      // Create Trading Wallet 1
      const tradingKeypair1 = Keypair.generate();
      const tradingWallet1: WalletData = {
        type: WalletType.TRADING,
        publicKey: tradingKeypair1.publicKey.toString(),
        privateKey: Buffer.from(tradingKeypair1.secretKey).toString('hex'),
        label: 'Trading Wallet 1 (95% reinvestment)',
        isActive: true,
        profitShare: 5, // Only 5% of profits go to Prophet wallet
        routedTo: prophetKeypair.publicKey.toString() // Route to Prophet wallet
      };
      
      // Create Trading Wallet 2
      const tradingKeypair2 = Keypair.generate();
      const tradingWallet2: WalletData = {
        type: WalletType.TRADING,
        publicKey: tradingKeypair2.publicKey.toString(),
        privateKey: Buffer.from(tradingKeypair2.secretKey).toString('hex'),
        label: 'Trading Wallet 2 (95% reinvestment)',
        isActive: false,
        profitShare: 5, // Only 5% of profits go to Prophet wallet
        routedTo: prophetKeypair.publicKey.toString() // Route to Prophet wallet
      };
      
      // Save these wallets
      this.addWallet(prophetWallet);
      this.addWallet(tradingWallet1);
      this.addWallet(tradingWallet2);
      
      // Save private keys separately for added security
      this.savePrivateWallets([
        {
          label: 'Prophet Wallet (Profit Collection)',
          publicKey: prophetKeypair.publicKey.toString(),
          privateKey: Buffer.from(prophetKeypair.secretKey).toString('hex')
        },
        {
          label: 'Trading Wallet 1',
          publicKey: tradingKeypair1.publicKey.toString(),
          privateKey: Buffer.from(tradingKeypair1.secretKey).toString('hex')
        },
        {
          label: 'Trading Wallet 2',
          publicKey: tradingKeypair2.publicKey.toString(),
          privateKey: Buffer.from(tradingKeypair2.secretKey).toString('hex')
        }
      ]);
      
      logger.info(`Created Prophet wallet system with wallet address ${prophetKeypair.publicKey.toString()}`);
      logger.info(`Created Trading wallet 1 with address ${tradingKeypair1.publicKey.toString()}`);
      logger.info(`Created Trading wallet 2 with address ${tradingKeypair2.publicKey.toString()}`);
      
      logger.info('Private keys saved to data/private_wallets.json - import these to Phantom wallet');
    } catch (error) {
      logger.error('Error creating Prophet wallet system:', error);
    }
  }
  
  /**
   * Save private wallet information to a separate file
   * This allows for backup and import to external wallets
   */
  private savePrivateWallets(wallets: { label: string, publicKey: string, privateKey: string }[]): void {
    try {
      // Create directory if it doesn't exist
      const dir = path.dirname(this.privateKeysFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Save wallet info
      fs.writeFileSync(
        this.privateKeysFilePath,
        JSON.stringify(wallets, null, 2)
      );
      
      logger.info(`Saved private wallet information to ${this.privateKeysFilePath}`);
    } catch (error) {
      logger.error('Error saving private wallet information:', error);
    }
  }
  
  /**
   * Save wallets to storage
   */
  private saveWallets(): void {
    try {
      // Create directory if it doesn't exist
      const dir = path.dirname(this.walletFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Save wallets
      fs.writeFileSync(
        this.walletFilePath,
        JSON.stringify(Array.from(this.wallets.values()), null, 2)
      );
      
      logger.debug('Saved wallets to storage');
    } catch (error) {
      logger.error('Error saving wallets:', error);
    }
  }
  
  /**
   * Add a wallet to the manager
   * @param wallet Wallet data
   */
  public addWallet(wallet: WalletData): void {
    // Validate public key format
    try {
      new PublicKey(wallet.publicKey);
    } catch (error) {
      throw new Error(`Invalid public key format: ${wallet.publicKey}`);
    }
    
    // Add wallet
    this.wallets.set(wallet.publicKey, wallet);
    
    // If this is the first wallet, set as active
    if (this.wallets.size === 1 || wallet.isActive) {
      this.setActiveWallet(wallet.publicKey);
    }
    
    logger.info(`Added wallet: ${wallet.label} (${wallet.publicKey.substring(0, 6)}...)`);
    
    // Save wallets
    this.saveWallets();
  }
  
  /**
   * Remove a wallet
   * @param publicKey Public key of wallet to remove
   */
  public removeWallet(publicKey: string): boolean {
    // Check if wallet exists
    if (!this.wallets.has(publicKey)) {
      return false;
    }
    
    // Get wallet
    const wallet = this.wallets.get(publicKey);
    
    // Remove wallet
    this.wallets.delete(publicKey);
    
    // If active wallet is removed, set a new active wallet
    if (this.activeWallet === publicKey) {
      this.activeWallet = null;
      
      // Find next wallet of same type
      for (const [key, w] of this.wallets.entries()) {
        if (w.type === wallet?.type) {
          this.setActiveWallet(key);
          break;
        }
      }
      
      // If no wallet of same type, set first wallet as active
      if (!this.activeWallet && this.wallets.size > 0) {
        this.setActiveWallet(Array.from(this.wallets.keys())[0]);
      }
    }
    
    logger.info(`Removed wallet: ${wallet?.label} (${publicKey.substring(0, 6)}...)`);
    
    // Save wallets
    this.saveWallets();
    
    return true;
  }
  
  /**
   * Set active wallet
   * @param publicKey Public key of wallet to set as active
   */
  public setActiveWallet(publicKey: string): boolean {
    // Check if wallet exists
    if (!this.wallets.has(publicKey)) {
      return false;
    }
    
    // Set all wallets of the same type to inactive
    const walletType = this.wallets.get(publicKey)?.type;
    for (const [key, wallet] of this.wallets.entries()) {
      if (wallet.type === walletType) {
        wallet.isActive = (key === publicKey);
      }
    }
    
    // Set active wallet
    this.activeWallet = publicKey;
    
    logger.info(`Set active wallet to: ${publicKey.substring(0, 6)}...`);
    
    // Save wallets
    this.saveWallets();
    
    return true;
  }
  
  /**
   * Get active wallet
   * @returns Active wallet data
   */
  public getActiveWallet(): WalletData | null {
    if (!this.activeWallet) {
      return null;
    }
    
    return this.wallets.get(this.activeWallet) || null;
  }
  
  /**
   * Get active wallet public key
   * @returns Active wallet public key
   */
  public getActivePubkey(): PublicKey | null {
    if (!this.activeWallet) {
      return null;
    }
    
    try {
      return new PublicKey(this.activeWallet);
    } catch (error) {
      logger.error('Invalid active wallet public key:', error);
      return null;
    }
  }
  
  /**
   * Get active wallet keypair
   * @returns Active wallet keypair
   * @throws Error if wallet secret is not available
   */
  public getActiveKeypair(): Keypair {
    if (!this.activeWallet) {
      throw new Error('No active wallet selected');
    }
    
    const wallet = this.wallets.get(this.activeWallet);
    if (!wallet) {
      throw new Error(`Active wallet ${this.activeWallet} not found`);
    }
    
    if (!wallet.privateKey) {
      throw new Error('Private key not available for this wallet');
    }
    
    try {
      const secretKey = Buffer.from(wallet.privateKey, 'hex');
      return Keypair.fromSecretKey(secretKey);
    } catch (error) {
      logger.error('Error creating keypair from private key:', error);
      throw new Error('Invalid private key format');
    }
  }
  
  /**
   * Get keypair for a specific wallet
   * @param publicKey Public key of the wallet
   * @returns Keypair for the wallet
   */
  public getKeypairByPublicKey(publicKey: string): Keypair {
    const wallet = this.wallets.get(publicKey);
    if (!wallet) {
      throw new Error(`Wallet ${publicKey} not found`);
    }
    
    if (!wallet.privateKey) {
      throw new Error('Private key not available for this wallet');
    }
    
    try {
      const secretKey = Buffer.from(wallet.privateKey, 'hex');
      return Keypair.fromSecretKey(secretKey);
    } catch (error) {
      logger.error('Error creating keypair from private key:', error);
      throw new Error('Invalid private key format');
    }
  }
  
  /**
   * Route profits according to wallet configuration
   * @param fromWallet Source wallet public key
   * @param profitAmount Amount of profit in lamports
   * @returns Transaction details if successful
   */
  public async routeProfits(fromWallet: string, profitAmount: number): Promise<any> {
    try {
      const wallet = this.wallets.get(fromWallet);
      if (!wallet) {
        throw new Error(`Wallet ${fromWallet} not found`);
      }
      
      // If no routing configured, keep all profits
      if (!wallet.routedTo || !wallet.profitShare) {
        logger.info(`Wallet ${fromWallet} has no profit routing configured, keeping 100% of profits`);
        return { 
          success: true, 
          keptAmount: profitAmount,
          routedAmount: 0,
          destination: null
        };
      }
      
      // Calculate amounts based on profit share
      const profitShare = wallet.profitShare / 100; // Convert percentage to decimal
      const amountToRoute = Math.floor(profitAmount * profitShare);
      const amountToKeep = profitAmount - amountToRoute;
      
      logger.info(`Routing ${profitShare * 100}% (${amountToRoute}) of profits from ${fromWallet} to ${wallet.routedTo}`);
      logger.info(`Keeping ${100 - (profitShare * 100)}% (${amountToKeep}) in ${fromWallet}`);
      
      // In production, this would create and send a transaction
      // For prototype, we'll just simulate the routing
      
      return {
        success: true,
        keptAmount: amountToKeep,
        routedAmount: amountToRoute,
        destination: wallet.routedTo,
        fromWallet: fromWallet,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error('Error routing profits:', error);
      throw error;
    }
  }
  
  /**
   * Get all wallets
   * @returns Array of wallet data
   */
  public getAllWallets(): WalletData[] {
    return Array.from(this.wallets.values());
  }
  
  /**
   * Get wallets by type
   * @param type Wallet type
   * @returns Array of wallet data
   */
  public getWalletsByType(type: WalletType): WalletData[] {
    return Array.from(this.wallets.values()).filter(w => w.type === type);
  }
  
  /**
   * Get active wallet by type
   * @param type Wallet type
   * @returns Active wallet of specified type
   */
  public getActiveWalletByType(type: WalletType): WalletData | null {
    return Array.from(this.wallets.values()).find(w => w.type === type && w.isActive) || null;
  }
  
  /**
   * Update wallet balance history
   * @param publicKey Public key of wallet
   * @param balance Current balance
   */
  public updateWalletBalance(publicKey: string, balance: number): void {
    const wallet = this.wallets.get(publicKey);
    if (!wallet) {
      return;
    }
    
    // Initialize balance history if not exists
    if (!wallet.balanceHistory) {
      wallet.balanceHistory = [];
    }
    
    // Add balance entry
    wallet.balanceHistory.push({
      timestamp: Date.now(),
      balance
    });
    
    // Keep only last 100 entries
    if (wallet.balanceHistory.length > 100) {
      wallet.balanceHistory = wallet.balanceHistory.slice(-100);
    }
    
    // Save wallets
    this.saveWallets();
  }
}

// Export wallet manager
export default WalletManager;