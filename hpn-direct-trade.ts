/**
 * HPN Wallet Direct Trading
 * 
 * This script enables trading from the HPN wallet with profits sent to Phantom.
 */

import * as fs from 'fs';
import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram, Keypair } from '@solana/web3.js';
import axios from 'axios';

// Configuration
const LOG_PATH = './hpn-direct-trade.log';
const HPN_WALLET = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const PHANTOM_WALLET = '2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH';
const PROPHET_WALLET = '31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e';
const RPC_URL = 'https://api.mainnet-beta.solana.com';
const OUTPUT_FILE = './HPN_WALLET_TRADES.md';

// Initialize log
if (!fs.existsSync(LOG_PATH)) {
  fs.writeFileSync(LOG_PATH, '--- HPN WALLET DIRECT TRADING LOG ---\n');
}

// Log function
function log(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_PATH, logMessage + '\n');
}

// Get Solana connection
function getConnection(): Connection {
  return new Connection(RPC_URL, 'confirmed');
}

// Check wallet balances
async function checkWalletBalances(): Promise<void> {
  try {
    const connection = getConnection();
    const hpnPubkey = new PublicKey(HPN_WALLET);
    const phantomPubkey = new PublicKey(PHANTOM_WALLET);
    const prophetPubkey = new PublicKey(PROPHET_WALLET);
    
    const hpnBalance = await connection.getBalance(hpnPubkey) / LAMPORTS_PER_SOL;
    const phantomBalance = await connection.getBalance(phantomPubkey) / LAMPORTS_PER_SOL;
    const prophetBalance = await connection.getBalance(prophetPubkey) / LAMPORTS_PER_SOL;
    
    log(`HPN wallet balance: ${hpnBalance.toFixed(6)} SOL`);
    log(`Phantom wallet balance: ${phantomBalance.toFixed(6)} SOL`);
    log(`Prophet wallet balance: ${prophetBalance.toFixed(6)} SOL`);
    
    return;
  } catch (error) {
    log(`Error checking wallet balances: ${(error as Error).message}`);
    throw error;
  }
}

// Create direct trade links for HPN wallet
function createHPNTradeLinks(): void {
  try {
    // Generate markdown with trading options
    let markdown = `# HPN Wallet Trading Options\n\n`;
    markdown += `Generated on: ${new Date().toLocaleString()}\n\n`;
    
    markdown += `## Available Options\n\n`;
    markdown += `You have three options for trading with your HPN wallet:\n\n`;
    
    markdown += `### Option 1: Transfer from HPN to Phantom, then trade\n\n`;
    markdown += `This is a two-step process:\n\n`;
    markdown += `1. First, transfer SOL from HPN to Phantom:\n`;
    markdown += `   - **Manual transfer**: Send SOL from HPN wallet to Phantom wallet (${PHANTOM_WALLET})\n\n`;
    markdown += `2. Then use the trade links in CUSTOM_TRADES.md to execute trades from Phantom\n\n`;
    
    markdown += `### Option 2: Use direct HPN wallet connection with Jupiter\n\n`;
    markdown += `You can trade directly from your HPN wallet by:\n\n`;
    markdown += `1. Going to [Jupiter](https://jup.ag/swap/SOL-BONK)\n`;
    markdown += `2. Connecting your HPN wallet\n`;
    markdown += `3. Selecting any trading pair and executing the swap\n\n`;
    
    markdown += `### Option 3: Import HPN wallet into Phantom\n\n`;
    markdown += `You can import your HPN wallet into Phantom:\n\n`;
    markdown += `1. Open Phantom wallet\n`;
    markdown += `2. Click on Settings > Accounts > Import Private Key\n`;
    markdown += `3. Enter your HPN wallet's private key\n`;
    markdown += `4. Use that imported account for trading\n\n`;
    
    markdown += `## Profit Collection Options\n\n`;
    markdown += `You can collect profits in either:\n\n`;
    markdown += `- **Phantom Wallet**: ${PHANTOM_WALLET}\n`;
    markdown += `- **Prophet Wallet**: ${PROPHET_WALLET}\n\n`;
    
    markdown += `To send profits to either wallet, simply execute a transfer after successful trades.\n\n`;
    
    markdown += `## Security Note\n\n`;
    markdown += `For maximum security, we recommend Option 1 or Option 2, as they don't require exposing your private key.`;
    
    fs.writeFileSync(OUTPUT_FILE, markdown);
    log(`✅ HPN wallet trading options created at ${OUTPUT_FILE}`);
  } catch (error) {
    log(`Error creating HPN wallet trade links: ${(error as Error).message}`);
  }
}

// Main function
async function main(): Promise<void> {
  try {
    log('Starting HPN wallet direct trading setup...');
    
    // Check wallet balances
    await checkWalletBalances();
    
    // Create HPN wallet trade links
    createHPNTradeLinks();
    
    log('HPN wallet direct trading setup completed');
    
    console.log('\n===== HPN WALLET TRADING SETUP COMPLETE =====');
    console.log('✅ Wallet balances checked');
    console.log('✅ Trading options created');
    console.log(`✅ Options saved to ${OUTPUT_FILE}`);
    
  } catch (error) {
    log(`Fatal error: ${(error as Error).message}`);
  }
}

// Run the main function
if (require.main === module) {
  main().catch(error => {
    log(`Unhandled error: ${error.message}`);
  });
}