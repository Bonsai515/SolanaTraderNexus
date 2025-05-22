/**
 * Wallet Balance Change Monitor
 * 
 * This script monitors your wallet balances in real-time and shows
 * when trades are happening with detailed balance changes.
 */

import * as fs from 'fs';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Configuration
const LOG_PATH = './wallet-balance-monitor.log';
const HPN_WALLET = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const PROPHET_WALLET = '31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e';
const RPC_URL = 'https://api.mainnet-beta.solana.com';
const CHECK_INTERVAL_MS = 10000; // 10 seconds
const DASHBOARD_PATH = './WALLET_BALANCE_DASHBOARD.md';

// Initialize log
if (!fs.existsSync(LOG_PATH)) {
  fs.writeFileSync(LOG_PATH, '--- WALLET BALANCE MONITOR LOG ---\n');
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

// Store previous balances for change detection
let previousHpnBalance = 0;
let previousProphetBalance = 0;
let balanceHistory: {
  timestamp: Date;
  hpnBalance: number;
  prophetBalance: number;
  hpnChange: number;
  prophetChange: number;
}[] = [];

// Check wallet balances
async function checkWalletBalances(): Promise<{ 
  hpnBalance: number; 
  prophetBalance: number;
  hpnChange: number;
  prophetChange: number;
}> {
  try {
    const connection = getConnection();
    
    // Check HPN wallet balance
    const hpnPubkey = new PublicKey(HPN_WALLET);
    const hpnBalance = await connection.getBalance(hpnPubkey) / LAMPORTS_PER_SOL;
    
    // Check Prophet wallet balance
    const prophetPubkey = new PublicKey(PROPHET_WALLET);
    const prophetBalance = await connection.getBalance(prophetPubkey) / LAMPORTS_PER_SOL;
    
    // Calculate changes
    const hpnChange = previousHpnBalance > 0 ? hpnBalance - previousHpnBalance : 0;
    const prophetChange = previousProphetBalance > 0 ? prophetBalance - previousProphetBalance : 0;
    
    // Update previous balances
    previousHpnBalance = hpnBalance;
    previousProphetBalance = prophetBalance;
    
    // Return current balances and changes
    return { 
      hpnBalance, 
      prophetBalance,
      hpnChange,
      prophetChange
    };
  } catch (error) {
    log(`Error checking wallet balances: ${(error as Error).message}`);
    return { 
      hpnBalance: previousHpnBalance, 
      prophetBalance: previousProphetBalance,
      hpnChange: 0,
      prophetChange: 0
    };
  }
}

// Create wallet balance dashboard
function createBalanceDashboard(): boolean {
  try {
    let dashboardContent = `# WALLET BALANCE REAL-TIME MONITOR\n\n`;
    dashboardContent += `**Last Updated:** ${new Date().toLocaleString()}\n\n`;
    
    dashboardContent += `## CURRENT WALLET BALANCES\n\n`;
    
    if (balanceHistory.length > 0) {
      const latest = balanceHistory[balanceHistory.length - 1];
      
      dashboardContent += `- **HPN Wallet:** ${latest.hpnBalance.toFixed(6)} SOL`;
      if (latest.hpnChange !== 0) {
        const changeIcon = latest.hpnChange > 0 ? '↑' : '↓';
        const changeColor = latest.hpnChange > 0 ? '🟢' : '🔴';
        dashboardContent += ` ${changeIcon} ${changeColor} ${Math.abs(latest.hpnChange).toFixed(6)} SOL`;
      }
      dashboardContent += `\n`;
      
      dashboardContent += `- **Prophet Wallet:** ${latest.prophetBalance.toFixed(6)} SOL`;
      if (latest.prophetChange !== 0) {
        const changeIcon = latest.prophetChange > 0 ? '↑' : '↓';
        const changeColor = latest.prophetChange > 0 ? '🟢' : '🔴';
        dashboardContent += ` ${changeIcon} ${changeColor} ${Math.abs(latest.prophetChange).toFixed(6)} SOL`;
      }
      dashboardContent += `\n\n`;
    } else {
      dashboardContent += `- **HPN Wallet:** Checking...\n`;
      dashboardContent += `- **Prophet Wallet:** Checking...\n\n`;
    }
    
    dashboardContent += `## REAL-TIME BALANCE CHANGES\n\n`;
    dashboardContent += `| Time | HPN Wallet | Change | Prophet Wallet | Change | Trade Event |\n`;
    dashboardContent += `|------|------------|--------|----------------|--------|------------|\n`;
    
    // Add last 20 balance changes (most recent first)
    const recentHistory = [...balanceHistory].reverse().slice(0, 20);
    
    for (const record of recentHistory) {
      const time = record.timestamp.toLocaleTimeString();
      
      // Format HPN change
      let hpnChangeText = '';
      if (record.hpnChange !== 0) {
        const changeIcon = record.hpnChange > 0 ? '↑' : '↓';
        const changeColor = record.hpnChange > 0 ? '🟢' : '🔴';
        hpnChangeText = `${changeIcon} ${changeColor} ${Math.abs(record.hpnChange).toFixed(6)}`;
      }
      
      // Format Prophet change
      let prophetChangeText = '';
      if (record.prophetChange !== 0) {
        const changeIcon = record.prophetChange > 0 ? '↑' : '↓';
        const changeColor = record.prophetChange > 0 ? '🟢' : '🔴';
        prophetChangeText = `${changeIcon} ${changeColor} ${Math.abs(record.prophetChange).toFixed(6)}`;
      }
      
      // Detect trade events
      let tradeEvent = '';
      if (record.hpnChange < 0 && record.prophetChange > 0) {
        tradeEvent = '✅ Profit Collection';
      } else if (record.hpnChange < 0 && record.prophetChange === 0) {
        tradeEvent = '🔄 Trade Execution';
      } else if (record.hpnChange > 0 && record.prophetChange === 0) {
        tradeEvent = '💰 Trade Profit';
      }
      
      dashboardContent += `| ${time} | ${record.hpnBalance.toFixed(6)} | ${hpnChangeText} | ${record.prophetBalance.toFixed(6)} | ${prophetChangeText} | ${tradeEvent} |\n`;
    }
    
    dashboardContent += `\n## SUMMARY\n\n`;
    
    // Calculate total changes
    let totalHpnChange = 0;
    let totalProphetChange = 0;
    let tradeCount = 0;
    
    for (const record of balanceHistory) {
      if (record.hpnChange !== 0 || record.prophetChange !== 0) {
        totalHpnChange += record.hpnChange;
        totalProphetChange += record.prophetChange;
        if (record.hpnChange < 0 || record.prophetChange > 0) {
          tradeCount++;
        }
      }
    }
    
    dashboardContent += `- **Monitoring Since:** ${balanceHistory.length > 0 ? balanceHistory[0].timestamp.toLocaleString() : 'Just started'}\n`;
    dashboardContent += `- **Total HPN Wallet Change:** ${totalHpnChange.toFixed(6)} SOL\n`;
    dashboardContent += `- **Total Prophet Wallet Change:** ${totalProphetChange.toFixed(6)} SOL\n`;
    dashboardContent += `- **Total Trade Events:** ${tradeCount}\n`;
    dashboardContent += `- **Update Frequency:** Every 10 seconds\n\n`;
    
    dashboardContent += `## HOW TO USE THIS MONITOR\n\n`;
    dashboardContent += `This dashboard automatically updates every 10 seconds to show real-time wallet balance changes.\n\n`;
    dashboardContent += `- **🔄 Trade Execution:** When HPN wallet balance decreases but Prophet balance stays the same\n`;
    dashboardContent += `- **💰 Trade Profit:** When HPN wallet balance increases from trading\n`;
    dashboardContent += `- **✅ Profit Collection:** When funds move from HPN wallet to Prophet wallet\n\n`;
    
    dashboardContent += `The monitor runs in the background. Keep this window open to see real-time balance updates.\n`;
    
    fs.writeFileSync(DASHBOARD_PATH, dashboardContent);
    return true;
  } catch (error) {
    log(`Error creating dashboard: ${(error as Error).message}`);
    return false;
  }
}

// Main monitoring function
async function monitorWalletBalances(): Promise<void> {
  try {
    log('Starting wallet balance monitoring...');
    log(`Monitoring HPN wallet: ${HPN_WALLET}`);
    log(`Monitoring Prophet wallet: ${PROPHET_WALLET}`);
    log(`Update interval: ${CHECK_INTERVAL_MS / 1000} seconds`);
    
    // Initial check
    const initialBalances = await checkWalletBalances();
    log(`Initial HPN wallet balance: ${initialBalances.hpnBalance.toFixed(6)} SOL`);
    log(`Initial Prophet wallet balance: ${initialBalances.prophetBalance.toFixed(6)} SOL`);
    
    // Add to history
    balanceHistory.push({
      timestamp: new Date(),
      hpnBalance: initialBalances.hpnBalance,
      prophetBalance: initialBalances.prophetBalance,
      hpnChange: 0,
      prophetChange: 0
    });
    
    // Create initial dashboard
    createBalanceDashboard();
    
    console.log(`\n✅ Wallet balance monitor started!`);
    console.log(`✅ Dashboard created at ${DASHBOARD_PATH}`);
    console.log(`✅ Monitoring wallets every ${CHECK_INTERVAL_MS / 1000} seconds`);
    console.log(`\nKeep this window open to see balance updates.\n`);
    
    // Set up periodic check
    const checkInterval = setInterval(async () => {
      try {
        // Check balances
        const balances = await checkWalletBalances();
        
        // Detect changes
        const hpnChanged = balances.hpnChange !== 0;
        const prophetChanged = balances.prophetChange !== 0;
        
        // Log significant changes
        if (hpnChanged || prophetChanged) {
          // Add to history
          balanceHistory.push({
            timestamp: new Date(),
            hpnBalance: balances.hpnBalance,
            prophetBalance: balances.prophetBalance,
            hpnChange: balances.hpnChange,
            prophetChange: balances.prophetChange
          });
          
          // Update dashboard
          createBalanceDashboard();
          
          // Log to console with special formatting for trade events
          if (balances.hpnChange < 0 && balances.prophetChange > 0) {
            console.log(`\n🟢 PROFIT COLLECTION DETECTED 🟢`);
            console.log(`⬇️ HPN Wallet: ${balances.hpnChange.toFixed(6)} SOL (now ${balances.hpnBalance.toFixed(6)} SOL)`);
            console.log(`⬆️ Prophet Wallet: +${balances.prophetChange.toFixed(6)} SOL (now ${balances.prophetBalance.toFixed(6)} SOL)`);
            console.log(`📝 Dashboard updated at ${DASHBOARD_PATH}\n`);
          } else if (balances.hpnChange < 0) {
            console.log(`\n🔄 TRADE EXECUTION DETECTED 🔄`);
            console.log(`⬇️ HPN Wallet: ${balances.hpnChange.toFixed(6)} SOL (now ${balances.hpnBalance.toFixed(6)} SOL)`);
            console.log(`📝 Dashboard updated at ${DASHBOARD_PATH}\n`);
          } else if (balances.hpnChange > 0) {
            console.log(`\n💰 TRADE PROFIT DETECTED 💰`);
            console.log(`⬆️ HPN Wallet: +${balances.hpnChange.toFixed(6)} SOL (now ${balances.hpnBalance.toFixed(6)} SOL)`);
            console.log(`📝 Dashboard updated at ${DASHBOARD_PATH}\n`);
          }
        }
      } catch (error) {
        log(`Error in balance check interval: ${(error as Error).message}`);
      }
    }, CHECK_INTERVAL_MS);
    
    // Handle termination
    process.on('SIGINT', () => {
      clearInterval(checkInterval);
      log('Wallet balance monitoring stopped');
      process.exit(0);
    });
  } catch (error) {
    log(`Fatal error: ${(error as Error).message}`);
  }
}

// Run the main function
if (require.main === module) {
  monitorWalletBalances().catch(error => {
    log(`Unhandled error: ${error.message}`);
  });
}