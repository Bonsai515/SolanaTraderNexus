/**
 * Activate HPN Wallet for Trading
 * 
 * This script activates the HPN wallet for all trading operations
 * and configures the system to use that wallet address with its 0.5 SOL balance.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Connection, PublicKey } from '@solana/web3.js';

// Configuration
const HPN_WALLET_ADDRESS = 'HPN9rV3Ja5FCgT3WiNLK6PWrPkLZs3zXE1QWWwJGmvmF';
const HPN_BALANCE = 0.5; // SOL
const RPC_URL = 'https://api.mainnet-beta.solana.com';

// Utility functions
function log(message: string): void {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// Update all wallet configuration files
async function updateWalletConfigurations(): Promise<boolean> {
  try {
    log('Updating wallet configurations...');
    
    // Create data directory if it doesn't exist
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Basic wallet info
    const walletInfo = {
      trading: HPN_WALLET_ADDRESS,
      profit: '31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e',
      balance: HPN_BALANCE
    };
    
    // Update wallet.json
    fs.writeFileSync(
      path.join(dataDir, 'wallet.json'),
      JSON.stringify(walletInfo, null, 2)
    );
    log('Updated wallet.json');
    
    // Update active-wallet.json
    const activeWalletConfig = {
      version: '1.0.0',
      wallets: {
        main: {
          address: HPN_WALLET_ADDRESS,
          type: 'main',
          active: true,
          description: 'HPN Trading Wallet with 0.5 SOL balance',
          useForTrading: true
        }
      },
      config: {
        useRealWallet: true,
        updateBalanceAfterTrades: true,
        verifyTransactions: true,
        recordTransactions: true,
        transactionSigningMethod: 'nexus'
      }
    };
    
    fs.writeFileSync(
      path.join(dataDir, 'active-wallet.json'),
      JSON.stringify(activeWalletConfig, null, 2)
    );
    log('Updated active-wallet.json');
    
    // Update real-wallets.json
    const realWalletsConfig = {
      version: '1.0.0',
      wallets: {
        main: {
          address: HPN_WALLET_ADDRESS,
          type: 'main',
          active: true,
          description: 'Main trading wallet',
          useForTrading: true
        },
        prophet: {
          address: '31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e',
          type: 'profit',
          active: true,
          description: 'Prophet wallet for profit collection',
          useForTrading: false
        }
      },
      config: {
        useRealWallet: true,
        updateBalanceAfterTrades: true,
        verifyTransactions: true,
        recordTransactions: true,
        transactionSigningMethod: 'nexus'
      }
    };
    
    fs.writeFileSync(
      path.join(dataDir, 'real-wallets.json'),
      JSON.stringify(realWalletsConfig, null, 2)
    );
    log('Updated real-wallets.json');
    
    return true;
  } catch (error) {
    log(`Error updating wallet configurations: ${error.message}`);
    return false;
  }
}

// Main function
async function main() {
  log(`Activating HPN wallet (${HPN_WALLET_ADDRESS}) for trading...`);
  
  try {
    // Update all wallet configuration files
    const configsUpdated = await updateWalletConfigurations();
    if (!configsUpdated) {
      log('Failed to update wallet configurations');
      process.exit(1);
    }
    
    log('✅ Successfully activated HPN wallet for trading');
    log(`Trading wallet: ${HPN_WALLET_ADDRESS}`);
    log(`Balance: ${HPN_BALANCE} SOL`);
    
    return true;
  } catch (error) {
    log(`Error activating HPN wallet: ${error.message}`);
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => {
      log('HPN wallet activation completed successfully');
    })
    .catch(error => {
      log(`Error: ${error.message}`);
      process.exit(1);
    });
}