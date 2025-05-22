/**
 * Check Wallet Balances for Active Trading
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Wallet addresses
const HPN_WALLET = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const PROPHET_WALLET = '31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e';
const PHANTOM_WALLET = '2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH';

// RPC Endpoint
const RPC_URL = 'https://api.mainnet-beta.solana.com';

async function checkWalletBalances() {
  try {
    console.log('=== REAL-TIME WALLET BALANCE CHECK ===');
    console.log('Checking balances on Solana mainnet...');
    
    const connection = new Connection(RPC_URL, 'confirmed');
    
    // Check HPN Trading Wallet
    const hpnPubkey = new PublicKey(HPN_WALLET);
    const hpnBalance = await connection.getBalance(hpnPubkey) / LAMPORTS_PER_SOL;
    console.log(`\nHPN Trading Wallet: ${HPN_WALLET}`);
    console.log(`Balance: ${hpnBalance.toFixed(6)} SOL`);
    
    // Check Prophet Wallet
    const prophetPubkey = new PublicKey(PROPHET_WALLET);
    const prophetBalance = await connection.getBalance(prophetPubkey) / LAMPORTS_PER_SOL;
    console.log(`\nProphet Profit Wallet: ${PROPHET_WALLET}`);
    console.log(`Balance: ${prophetBalance.toFixed(6)} SOL`);
    
    // Check Phantom Wallet
    const phantomPubkey = new PublicKey(PHANTOM_WALLET);
    const phantomBalance = await connection.getBalance(phantomPubkey) / LAMPORTS_PER_SOL;
    console.log(`\nPhantom Wallet: ${PHANTOM_WALLET}`);
    console.log(`Balance: ${phantomBalance.toFixed(6)} SOL`);
    
    // Display profit summary
    console.log('\n=== TRADING SUMMARY ===');
    console.log(`Total trading capital: ${hpnBalance.toFixed(6)} SOL`);
    console.log(`Total profit collected: ${prophetBalance.toFixed(6)} SOL`);
    
    // Calculate profits if any
    const initialHPNBalance = 0.800010; // Initial funded amount
    const currentProfit = hpnBalance - initialHPNBalance + prophetBalance;
    const profitPercentage = (currentProfit / initialHPNBalance) * 100;
    
    if (currentProfit > 0) {
      console.log(`\n✅ CURRENT PROFIT: +${currentProfit.toFixed(6)} SOL (+${profitPercentage.toFixed(2)}%)`);
    } else if (currentProfit < 0) {
      console.log(`\n❌ CURRENT LOSS: ${currentProfit.toFixed(6)} SOL (${profitPercentage.toFixed(2)}%)`);
    } else {
      console.log(`\nBreak even (0.000000 SOL profit/loss)`);
    }
    
    // Update wallet balance dashboard
    updateWalletBalanceDashboard(hpnBalance, prophetBalance, phantomBalance, currentProfit);
    
  } catch (error) {
    console.error(`Error checking wallet balances: ${error.message}`);
  }
}

// Update wallet balance dashboard
function updateWalletBalanceDashboard(hpnBalance: number, prophetBalance: number, phantomBalance: number, currentProfit: number) {
  const fs = require('fs');
  const dashboardPath = './REAL_TIME_WALLET_BALANCES.md';
  
  try {
    const timestamp = new Date().toLocaleString();
    
    let content = `# REAL-TIME WALLET BALANCES\n\n`;
    content += `**Last Updated:** ${timestamp}\n\n`;
    
    content += `## ACTIVE TRADING WALLETS\n\n`;
    content += `- **HPN Trading Wallet:** ${hpnBalance.toFixed(6)} SOL\n`;
    content += `- **Prophet Profit Wallet:** ${prophetBalance.toFixed(6)} SOL\n`;
    content += `- **Phantom Wallet:** ${phantomBalance.toFixed(6)} SOL\n\n`;
    
    content += `## TRADING PERFORMANCE\n\n`;
    content += `- **Initial Capital:** 0.800010 SOL\n`;
    content += `- **Current Trading Balance:** ${hpnBalance.toFixed(6)} SOL\n`;
    content += `- **Collected Profits:** ${prophetBalance.toFixed(6)} SOL\n`;
    
    const profitPercentage = (currentProfit / 0.800010) * 100;
    
    if (currentProfit > 0) {
      content += `- **Total Profit:** +${currentProfit.toFixed(6)} SOL (+${profitPercentage.toFixed(2)}%)\n\n`;
    } else if (currentProfit < 0) {
      content += `- **Total Loss:** ${currentProfit.toFixed(6)} SOL (${profitPercentage.toFixed(2)}%)\n\n`;
    } else {
      content += `- **Profit/Loss:** 0.000000 SOL (0.00%)\n\n`;
    }
    
    content += `## TRADING CONFIGURATION\n\n`;
    content += `- **Position Sizing:** 85-95% of capital\n`;
    content += `- **Trading Frequency:** Every 2 minutes\n`;
    content += `- **Daily Volume Limit:** 3.5 SOL\n`;
    content += `- **Min Profit Threshold:** 0.0008-0.0012 SOL\n\n`;
    
    content += `## NOTES\n\n`;
    content += `- This represents the current on-chain wallet balances\n`;
    content += `- Trading system is running in hyper-aggressive mode\n`;
    content += `- Profits are reinvested until transferred to Prophet wallet\n`;
    
    fs.writeFileSync(dashboardPath, content);
    console.log(`\n✅ Updated real-time wallet balance dashboard at ${dashboardPath}`);
  } catch (error) {
    console.error(`Error updating dashboard: ${error.message}`);
  }
}

// Run the function
checkWalletBalances();