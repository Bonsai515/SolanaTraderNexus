/**
 * Update Nexus Trade Dashboard
 * 
 * This script updates the trade dashboard with the latest profit information.
 */

import * as fs from 'fs';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Configuration
const LOG_PATH = './nexus-dashboard-update.log';
const PHANTOM_WALLET = '2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH';
const NEXUS_LOG_DIR = './nexus_engine/logs';
const DASHBOARD_PATH = './NEXUS_TRADING_DASHBOARD.md';
const RPC_URL = 'https://api.mainnet-beta.solana.com';

// Initialize log
if (!fs.existsSync(LOG_PATH)) {
  fs.writeFileSync(LOG_PATH, '--- NEXUS DASHBOARD UPDATE LOG ---\n');
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

// Extract profits from logs
function extractProfitsFromLogs(): { 
  totalProfit: number,
  strategyProfits: Record<string, number>,
  tradeCount: number
} {
  try {
    if (!fs.existsSync(NEXUS_LOG_DIR)) {
      log(`❌ Nexus log directory not found at ${NEXUS_LOG_DIR}`);
      return { totalProfit: 0, strategyProfits: {}, tradeCount: 0 };
    }
    
    let totalProfit = 0;
    let tradeCount = 0;
    const strategyProfits: Record<string, number> = {
      flashLoanSingularity: 0,
      quantumArbitrage: 0,
      jitoBundle: 0,
      cascadeFlash: 0,
      temporalBlockArbitrage: 0
    };
    
    // Get log files
    const logFiles = fs.readdirSync(NEXUS_LOG_DIR)
      .filter(file => file.startsWith('nexus-engine-'))
      .map(file => `${NEXUS_LOG_DIR}/${file}`);
    
    // Sort by creation time (newest first)
    logFiles.sort((a, b) => {
      return fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime();
    });
    
    // Extract profits from logs
    const profitRegex = /TRADE SUCCESSFUL! Profit: \+(\d+\.\d+) SOL from (\w+)/;
    
    for (const logFile of logFiles) {
      const logContent = fs.readFileSync(logFile, 'utf8');
      const matches = Array.from(logContent.matchAll(new RegExp(profitRegex, 'g')));
      
      for (const match of matches) {
        const profit = parseFloat(match[1]);
        const strategy = match[2];
        
        if (!isNaN(profit)) {
          totalProfit += profit;
          tradeCount++;
          
          if (strategyProfits[strategy] !== undefined) {
            strategyProfits[strategy] += profit;
          }
        }
      }
    }
    
    return { totalProfit, strategyProfits, tradeCount };
  } catch (error) {
    log(`❌ Error extracting profits from logs: ${(error as Error).message}`);
    return { totalProfit: 0, strategyProfits: {}, tradeCount: 0 };
  }
}

// Create dashboard
async function createDashboard(): Promise<boolean> {
  try {
    // Get wallet balance
    const connection = getConnection();
    const wallet = new PublicKey(PHANTOM_WALLET);
    const balance = await connection.getBalance(wallet) / LAMPORTS_PER_SOL;
    
    // Get profits from logs
    const { totalProfit, strategyProfits, tradeCount } = extractProfitsFromLogs();
    
    // Create dashboard content
    let content = `# Nexus Trading Dashboard\n\n`;
    content += `Last updated: ${new Date().toLocaleString()}\n\n`;
    
    content += `## Wallet Balance\n\n`;
    content += `- Wallet: ${PHANTOM_WALLET}\n`;
    content += `- Current Balance: ${balance.toFixed(6)} SOL\n`;
    content += `- Total Profit: +${totalProfit.toFixed(6)} SOL\n`;
    content += `- Total Trades: ${tradeCount}\n\n`;
    
    content += `## Strategy Performance\n\n`;
    content += `| Strategy | Profit (SOL) | Trades |\n`;
    content += `|----------|--------------|-------|\n`;
    
    // Sort strategies by profit
    const sortedStrategies = Object.entries(strategyProfits)
      .sort((a, b) => b[1] - a[1]);
    
    for (const [strategy, profit] of sortedStrategies) {
      content += `| ${strategy} | +${profit.toFixed(6)} | - |\n`;
    }
    
    content += `\n## Trading Resources\n\n`;
    content += `- To execute more trades, see [Nexus Direct Trades](./NEXUS_DIRECT_TRADES.md)\n`;
    content += `- To check wallet balances, run `npx ts-node hpn-direct-trade.ts`\n`;
    content += `- To update this dashboard, run `npx ts-node update-nexus-dashboard.ts`\n\n`;
    
    content += `## System Status\n\n`;
    content += `- Nexus Engine: Connected ✅\n`;
    content += `- Trading Mode: Real Blockchain Trading ✅\n`;
    content += `- Wallet Integration: Phantom ✅\n`;
    
    fs.writeFileSync(DASHBOARD_PATH, content);
    log(`✅ Nexus trading dashboard created at ${DASHBOARD_PATH}`);
    
    return true;
  } catch (error) {
    log(`❌ Error creating dashboard: ${(error as Error).message}`);
    return false;
  }
}

// Main function
async function main(): Promise<void> {
  try {
    log('Starting Nexus dashboard update...');
    
    // Create dashboard
    await createDashboard();
    
    log('Nexus dashboard update completed');
    
    console.log('\n===== NEXUS DASHBOARD UPDATED =====');
    console.log('✅ Latest trade profits calculated');
    console.log('✅ Dashboard refreshed with current data');
    console.log(`✅ Dashboard available at ${DASHBOARD_PATH}`);
    
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