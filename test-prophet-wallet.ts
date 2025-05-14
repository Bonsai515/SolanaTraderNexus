/**
 * Test Prophet Wallet System
 * 
 * This script tests the Prophet wallet system, which creates a set of wallets
 * for trading and profit collection with configurable profit sharing.
 */

import { WalletManager, WalletType } from './server/lib/walletManager';
import fs from 'fs';
import path from 'path';

console.log("Testing Prophet Wallet System");

async function testProphetWalletSystem() {
  // Initialize the wallet manager
  const walletManager = new WalletManager();
  
  // Force the creation of the Prophet wallet system
  console.log("Creating Prophet wallet system...");
  try {
    // This accesses a private method but it's for testing purposes only
    (walletManager as any).createProphetWalletSystem();
    
    // Get all wallets
    const wallets = walletManager.getAllWallets();
    
    // Display Prophet system wallets
    console.log("\n--- Prophet System Wallets ---");
    
    const prophetWallets = wallets.filter(w => 
      w.label.includes('Prophet') || 
      (w.type === WalletType.TRADING && w.profitShare !== undefined && w.routedTo !== undefined)
    );
    
    for (const wallet of prophetWallets) {
      console.log(`\nWallet: ${wallet.label}`);
      console.log(`Type: ${wallet.type}`);
      console.log(`Address: ${wallet.publicKey}`);
      console.log(`Active: ${wallet.isActive}`);
      
      if (wallet.profitShare !== undefined) {
        console.log(`Profit Share: ${wallet.profitShare}%`);
      }
      
      if (wallet.routedTo !== undefined) {
        console.log(`Routes To: ${wallet.routedTo}`);
      }
    }
    
    // Display private keys (in a real system, never log these!)
    const privateKeysPath = path.join(process.cwd(), 'data', 'private_wallets.json');
    if (fs.existsSync(privateKeysPath)) {
      const privateWallets = JSON.parse(fs.readFileSync(privateKeysPath, 'utf8'));
      
      console.log("\n--- Private Keys for Phantom Import ---");
      for (const wallet of privateWallets) {
        console.log(`\n${wallet.label}:`);
        console.log(`Public Key: ${wallet.publicKey}`);
        console.log(`Private Key: ${wallet.privateKey}`);
      }
    }
    
    // Test profit routing
    if (prophetWallets.length > 1) {
      const tradingWallet = prophetWallets.find(w => w.type === WalletType.TRADING);
      if (tradingWallet) {
        console.log("\n--- Testing Profit Routing ---");
        console.log(`Routing profits from trading wallet: ${tradingWallet.publicKey}`);
        
        const profitAmount = 1000000000; // 1 SOL in lamports
        const result = await walletManager.routeProfits(tradingWallet.publicKey, profitAmount);
        
        console.log("\nRouting Result:");
        console.log(`Amount kept for reinvestment: ${result.keptAmount / 1000000000} SOL (${100 - tradingWallet.profitShare!}%)`);
        console.log(`Amount sent to Prophet wallet: ${result.routedAmount / 1000000000} SOL (${tradingWallet.profitShare}%)`);
        console.log(`Destination wallet: ${result.destination}`);
      }
    }
    
  } catch (error) {
    console.error("Error testing Prophet wallet system:", error);
  }
}

// Run the test
testProphetWalletSystem()
  .then(() => console.log("\nTest completed"))
  .catch(error => console.error("Test failed:", error));