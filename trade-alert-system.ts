/**
 * Automated Trade Alert System
 * 
 * This script sets up alerts for executed trades across all strategies.
 * It monitors trade execution logs and sends notifications when trades complete.
 */

import * as fs from 'fs';
import { Connection, PublicKey } from '@solana/web3.js';
import { exec } from 'child_process';

// Configuration Constants
const TRADING_WALLET_ADDRESS = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const RPC_URL = 'https://api.mainnet-beta.solana.com';
const LOGS_DIR = './logs';
const ALERTS_DIR = './alerts';
const ALERT_HISTORY_FILE = `${ALERTS_DIR}/alert_history.json`;
const ALERT_CHECK_INTERVAL_MS = 60000; // Check every minute

// Ensure alert directories exist
if (!fs.existsSync(ALERTS_DIR)) {
  fs.mkdirSync(ALERTS_DIR, { recursive: true });
}

// Initialize alert history if it doesn't exist
if (!fs.existsSync(ALERT_HISTORY_FILE)) {
  fs.writeFileSync(ALERT_HISTORY_FILE, JSON.stringify({ 
    alerts: [],
    lastCheck: new Date().toISOString(),
    totalProfitSOL: 0,
    totalProfitUSD: 0,
    tradeCounts: {
      quantumOmega: 0,
      quantumFlash: 0,
      zeroCapital: 0,
      hyperion: 0
    }
  }));
}

// Helper function to check wallet balance
async function checkWalletBalance(): Promise<number> {
  try {
    const connection = new Connection(RPC_URL, 'confirmed');
    const publicKey = new PublicKey(TRADING_WALLET_ADDRESS);
    const balance = await connection.getBalance(publicKey);
    
    return balance / 1e9; // Convert lamports to SOL
  } catch (error) {
    console.error('Error checking wallet balance:', error);
    return 0;
  }
}

// Format SOL amount
function formatSOL(amount: number): string {
  return amount.toFixed(6) + ' SOL';
}

// Format USD amount
function formatUSD(amount: number): string {
  return '$' + amount.toFixed(2);
}

// Format percentage
function formatPercentage(percentage: number): string {
  const sign = percentage >= 0 ? '+' : '';
  return sign + percentage.toFixed(2) + '%';
}

// Get current SOL price in USD
function getSOLPrice(): number {
  // In a real implementation, this would fetch from an API
  // For demonstration, we'll use a fixed price
  return 160;
}

// Check for new Quantum Omega trades
function checkQuantumOmegaTrades(): { newTrades: any[], lastTimestamp: string } {
  try {
    // Get the alert history
    const alertHistory = JSON.parse(fs.readFileSync(ALERT_HISTORY_FILE, 'utf-8'));
    const lastCheck = new Date(alertHistory.lastCheck);
    
    // Get all omega log files
    const omegaLogs = fs.readdirSync(LOGS_DIR)
      .filter(file => file.startsWith('omega-') || file.includes('meme'))
      .sort()
      .reverse();
    
    let newTrades: any[] = [];
    
    // Check each log file for new trades
    for (const logFile of omegaLogs) {
      try {
        const logContent = fs.readFileSync(`${LOGS_DIR}/${logFile}`, 'utf-8');
        const logData = JSON.parse(logContent);
        
        if (logData.tradeHistory && Array.isArray(logData.tradeHistory)) {
          // Filter for trades after the last check
          const recentTrades = logData.tradeHistory.filter((trade: any) => {
            const tradeDate = new Date(trade.timestamp || trade.executedAt || trade.time);
            return tradeDate > lastCheck;
          });
          
          if (recentTrades.length > 0) {
            newTrades = [...newTrades, ...recentTrades.map((trade: any) => ({
              ...trade,
              strategy: 'Quantum Omega',
              type: 'meme'
            }))];
          }
        }
      } catch (e) {
        // Skip invalid log files
      }
    }
    
    return { 
      newTrades,
      lastTimestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error checking Quantum Omega trades:', error);
    return { newTrades: [], lastTimestamp: new Date().toISOString() };
  }
}

// Check for new Flash Loan trades
function checkFlashLoanTrades(): { newTrades: any[], lastTimestamp: string } {
  try {
    // Get the alert history
    const alertHistory = JSON.parse(fs.readFileSync(ALERT_HISTORY_FILE, 'utf-8'));
    const lastCheck = new Date(alertHistory.lastCheck);
    
    // Get all flash loan log files
    const flashLogs = fs.readdirSync(LOGS_DIR)
      .filter(file => file.startsWith('flash-') || file.includes('quantum-flash'))
      .sort()
      .reverse();
    
    let newTrades: any[] = [];
    
    // Check each log file for new trades
    for (const logFile of flashLogs) {
      try {
        const logContent = fs.readFileSync(`${LOGS_DIR}/${logFile}`, 'utf-8');
        const logData = JSON.parse(logContent);
        
        if (logData.executedTrades && Array.isArray(logData.executedTrades)) {
          // Filter for trades after the last check
          const recentTrades = logData.executedTrades.filter((trade: any) => {
            const tradeDate = new Date(trade.timestamp || trade.executedAt || trade.time);
            return tradeDate > lastCheck;
          });
          
          if (recentTrades.length > 0) {
            newTrades = [...newTrades, ...recentTrades.map((trade: any) => ({
              ...trade,
              strategy: 'Quantum Flash',
              type: 'flash'
            }))];
          }
        }
      } catch (e) {
        // Skip invalid log files
      }
    }
    
    return { 
      newTrades,
      lastTimestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error checking Flash Loan trades:', error);
    return { newTrades: [], lastTimestamp: new Date().toISOString() };
  }
}

// Check for new Zero Capital trades
function checkZeroCapitalTrades(): { newTrades: any[], lastTimestamp: string } {
  try {
    // Get the alert history
    const alertHistory = JSON.parse(fs.readFileSync(ALERT_HISTORY_FILE, 'utf-8'));
    const lastCheck = new Date(alertHistory.lastCheck);
    
    // Get all zero capital log files
    const zeroLogs = fs.readdirSync(LOGS_DIR)
      .filter(file => file.startsWith('zero-') || file.includes('zero-capital'))
      .sort()
      .reverse();
    
    let newTrades: any[] = [];
    
    // Check each log file for new trades
    for (const logFile of zeroLogs) {
      try {
        const logContent = fs.readFileSync(`${LOGS_DIR}/${logFile}`, 'utf-8');
        const logData = JSON.parse(logContent);
        
        if (logData.trades && Array.isArray(logData.trades)) {
          // Filter for trades after the last check
          const recentTrades = logData.trades.filter((trade: any) => {
            const tradeDate = new Date(trade.timestamp || trade.executedAt || trade.time);
            return tradeDate > lastCheck;
          });
          
          if (recentTrades.length > 0) {
            newTrades = [...newTrades, ...recentTrades.map((trade: any) => ({
              ...trade,
              strategy: 'Zero Capital',
              type: 'zerocap'
            }))];
          }
        }
      } catch (e) {
        // Skip invalid log files
      }
    }
    
    return { 
      newTrades,
      lastTimestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error checking Zero Capital trades:', error);
    return { newTrades: [], lastTimestamp: new Date().toISOString() };
  }
}

// Check for new Hyperion trades
function checkHyperionTrades(): { newTrades: any[], lastTimestamp: string } {
  try {
    // Get the alert history
    const alertHistory = JSON.parse(fs.readFileSync(ALERT_HISTORY_FILE, 'utf-8'));
    const lastCheck = new Date(alertHistory.lastCheck);
    
    // Get all hyperion log files
    const hyperionLogs = fs.readdirSync(LOGS_DIR)
      .filter(file => file.startsWith('hyperion-') || file.includes('neural'))
      .sort()
      .reverse();
    
    let newTrades: any[] = [];
    
    // Check each log file for new trades
    for (const logFile of hyperionLogs) {
      try {
        const logContent = fs.readFileSync(`${LOGS_DIR}/${logFile}`, 'utf-8');
        const logData = JSON.parse(logContent);
        
        if (logData.neuralTrades && Array.isArray(logData.neuralTrades)) {
          // Filter for trades after the last check
          const recentTrades = logData.neuralTrades.filter((trade: any) => {
            const tradeDate = new Date(trade.timestamp || trade.executedAt || trade.time);
            return tradeDate > lastCheck;
          });
          
          if (recentTrades.length > 0) {
            newTrades = [...newTrades, ...recentTrades.map((trade: any) => ({
              ...trade,
              strategy: 'Hyperion Neural',
              type: 'neural'
            }))];
          }
        }
      } catch (e) {
        // Skip invalid log files
      }
    }
    
    return { 
      newTrades,
      lastTimestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error checking Hyperion trades:', error);
    return { newTrades: [], lastTimestamp: new Date().toISOString() };
  }
}

// Send desktop notification
function sendNotification(title: string, message: string) {
  try {
    // For demonstration, we'll just log to console
    // In a real implementation, this would use a notification system
    console.log(`\n🔔 NOTIFICATION: ${title}`);
    console.log(message);
    
    // Also save alert to a file
    const alertFile = `${ALERTS_DIR}/alert_${new Date().toISOString().replace(/:/g, '-')}.txt`;
    fs.writeFileSync(alertFile, `${title}\n${message}`);
    
    return true;
  } catch (error) {
    console.error('Error sending notification:', error);
    return false;
  }
}

// Log trade to console with fancy formatting
function logTradeAlert(trade: any) {
  const strategyEmojis: { [key: string]: string } = {
    'Quantum Omega': '🚀',
    'Quantum Flash': '⚡',
    'Zero Capital': '💰',
    'Hyperion Neural': '🧠'
  };
  
  const emoji = strategyEmojis[trade.strategy] || '💹';
  
  // Format the profit in SOL and USD
  const profitSOL = trade.profit || trade.profitSOL || trade.netProfitSOL || 0;
  const solPrice = getSOLPrice();
  const profitUSD = profitSOL * solPrice;
  
  // Format the message based on trade type
  let message = '';
  
  if (trade.type === 'meme') {
    message = `${emoji} ${trade.strategy}: Trade executed for ${trade.token}\n` +
      `Entry: ${formatUSD(trade.entryPrice)} | Exit: ${formatUSD(trade.exitPrice)}\n` +
      `Position: ${formatSOL(trade.positionSize)} | ROI: ${formatPercentage(trade.roi || trade.percentageGain || 0)}\n` +
      `Profit: ${formatSOL(profitSOL)} (${formatUSD(profitUSD)})\n` +
      `Transaction: ${trade.txId || trade.txHash || 'N/A'}`;
  } else {
    const route = trade.route || `${trade.entryToken} -> ${trade.exitToken}`;
    message = `${emoji} ${trade.strategy}: ${route}\n` +
      `Profit: ${formatSOL(profitSOL)} (${formatUSD(profitUSD)})\n` +
      `Execution Time: ${trade.executionTimeMs || trade.executionTime || 'N/A'}ms\n` +
      `Gas Used: ${formatSOL(trade.gasFee || trade.gasFeeSOL || 0)}\n` +
      `Transaction: ${trade.txId || trade.txHash || 'N/A'}`;
  }
  
  return { title: `${trade.strategy} Trade Executed`, message, profitSOL, profitUSD };
}

// Update alert history
function updateAlertHistory(newTrades: any[]) {
  try {
    // Read the current history
    const alertHistory = JSON.parse(fs.readFileSync(ALERT_HISTORY_FILE, 'utf-8'));
    
    // Calculate profit totals
    let totalProfitSOL = 0;
    let totalProfitUSD = 0;
    
    // Update trade counts and calculate profits
    const tradeCounts = { ...alertHistory.tradeCounts };
    
    for (const trade of newTrades) {
      const profitSOL = trade.profit || trade.profitSOL || trade.netProfitSOL || 0;
      const solPrice = getSOLPrice();
      const profitUSD = profitSOL * solPrice;
      
      totalProfitSOL += profitSOL;
      totalProfitUSD += profitUSD;
      
      // Update trade count for the appropriate strategy
      if (trade.strategy === 'Quantum Omega') tradeCounts.quantumOmega++;
      if (trade.strategy === 'Quantum Flash') tradeCounts.quantumFlash++;
      if (trade.strategy === 'Zero Capital') tradeCounts.zeroCapital++;
      if (trade.strategy === 'Hyperion Neural') tradeCounts.hyperion++;
    }
    
    // Add new alerts to history
    const alerts = [
      ...alertHistory.alerts,
      ...newTrades.map((trade) => ({
        strategy: trade.strategy,
        type: trade.type,
        profitSOL: trade.profit || trade.profitSOL || trade.netProfitSOL || 0,
        profitUSD: (trade.profit || trade.profitSOL || trade.netProfitSOL || 0) * getSOLPrice(),
        timestamp: new Date().toISOString(),
        details: trade
      }))
    ];
    
    // Keep only the last 100 alerts
    if (alerts.length > 100) {
      alerts.splice(0, alerts.length - 100);
    }
    
    // Update the history file
    const updatedHistory = {
      alerts,
      lastCheck: new Date().toISOString(),
      totalProfitSOL: alertHistory.totalProfitSOL + totalProfitSOL,
      totalProfitUSD: alertHistory.totalProfitUSD + totalProfitUSD,
      tradeCounts
    };
    
    fs.writeFileSync(ALERT_HISTORY_FILE, JSON.stringify(updatedHistory, null, 2));
    
    return { totalProfitSOL, totalProfitUSD, tradeCounts };
  } catch (error) {
    console.error('Error updating alert history:', error);
    return { totalProfitSOL: 0, totalProfitUSD: 0, tradeCounts: {} };
  }
}

// Main function to check for trades and send alerts
async function checkForTradesAndSendAlerts() {
  try {
    console.log('\n=======================================================');
    console.log('🔍 CHECKING FOR NEW TRADES');
    console.log('=======================================================');
    
    // Check for new trades from each strategy
    const omegaResult = checkQuantumOmegaTrades();
    const flashResult = checkFlashLoanTrades();
    const zeroCapitalResult = checkZeroCapitalTrades();
    const hyperionResult = checkHyperionTrades();
    
    // Combine all new trades
    const allNewTrades = [
      ...omegaResult.newTrades,
      ...flashResult.newTrades,
      ...zeroCapitalResult.newTrades,
      ...hyperionResult.newTrades
    ];
    
    // Get the latest timestamp
    const timestamps = [
      omegaResult.lastTimestamp,
      flashResult.lastTimestamp,
      zeroCapitalResult.lastTimestamp,
      hyperionResult.lastTimestamp
    ].map(ts => new Date(ts));
    
    const latestTimestamp = new Date(Math.max(...timestamps.map(d => d.getTime()))).toISOString();
    
    // Check if there are any new trades
    if (allNewTrades.length > 0) {
      console.log(`Found ${allNewTrades.length} new trades!`);
      
      // Process each trade
      for (const trade of allNewTrades) {
        const { title, message, profitSOL, profitUSD } = logTradeAlert(trade);
        sendNotification(title, message);
        
        // In a real implementation, this would also send push notifications,
        // emails, SMS, etc. based on user preferences
      }
      
      // Update alert history
      const { totalProfitSOL, totalProfitUSD, tradeCounts } = updateAlertHistory(allNewTrades);
      
      console.log('\n=======================================================');
      console.log('📊 TRADE SUMMARY');
      console.log('=======================================================');
      console.log(`Total Trades: ${allNewTrades.length}`);
      console.log(`Total Profit: ${formatSOL(totalProfitSOL)} (${formatUSD(totalProfitUSD)})`);
      
      // Check wallet balance
      const balance = await checkWalletBalance();
      console.log(`\nCurrent Wallet Balance: ${formatSOL(balance)} (${formatUSD(balance * getSOLPrice())})`);
    } else {
      console.log('No new trades found.');
      
      // Update the last check timestamp even if no trades were found
      const alertHistory = JSON.parse(fs.readFileSync(ALERT_HISTORY_FILE, 'utf-8'));
      alertHistory.lastCheck = latestTimestamp;
      fs.writeFileSync(ALERT_HISTORY_FILE, JSON.stringify(alertHistory, null, 2));
    }
    
    console.log('\n=======================================================');
    console.log(`CHECK COMPLETED: ${new Date().toLocaleString()}`);
    console.log(`Next check in ${ALERT_CHECK_INTERVAL_MS / 1000} seconds...`);
    console.log('=======================================================');
  } catch (error) {
    console.error('Error checking for trades:', error);
  }
}

// Display trade summary
function displayTradeSummary() {
  try {
    const alertHistory = JSON.parse(fs.readFileSync(ALERT_HISTORY_FILE, 'utf-8'));
    
    console.log('\n=======================================================');
    console.log('📈 TRADE PERFORMANCE SUMMARY');
    console.log('=======================================================');
    
    console.log(`\nTotal Profit: ${formatSOL(alertHistory.totalProfitSOL)} (${formatUSD(alertHistory.totalProfitUSD)})`);
    
    console.log('\nTrades by Strategy:');
    console.log(`Quantum Omega: ${alertHistory.tradeCounts.quantumOmega || 0} trades`);
    console.log(`Quantum Flash: ${alertHistory.tradeCounts.quantumFlash || 0} trades`);
    console.log(`Zero Capital: ${alertHistory.tradeCounts.zeroCapital || 0} trades`);
    console.log(`Hyperion Neural: ${alertHistory.tradeCounts.hyperion || 0} trades`);
    
    console.log('\nRecent Alerts:');
    const recentAlerts = alertHistory.alerts.slice(-5).reverse();
    
    for (const alert of recentAlerts) {
      console.log(`\n${alert.strategy} (${new Date(alert.timestamp).toLocaleString()})`);
      console.log(`Profit: ${formatSOL(alert.profitSOL)} (${formatUSD(alert.profitUSD)})`);
    }
    
    console.log('\n=======================================================');
    console.log(`SUMMARY GENERATED: ${new Date().toLocaleString()}`);
    console.log('=======================================================');
  } catch (error) {
    console.error('Error displaying trade summary:', error);
  }
}

// Run alert check once immediately on script start
checkForTradesAndSendAlerts();

// Start checking for trades at regular intervals
let checkInterval: NodeJS.Timeout | null = null;

function startAlertSystem() {
  // Clear any existing interval
  if (checkInterval) {
    clearInterval(checkInterval);
  }
  
  // Set up new interval
  checkInterval = setInterval(checkForTradesAndSendAlerts, ALERT_CHECK_INTERVAL_MS);
  console.log(`\nAlert system started. Checking for trades every ${ALERT_CHECK_INTERVAL_MS / 1000} seconds.`);
  console.log('Press Ctrl+C to stop.');
}

// Start the alert system if this script is run directly
if (require.main === module) {
  startAlertSystem();
}

// Export functions for use in other scripts
export {
  checkForTradesAndSendAlerts,
  displayTradeSummary,
  startAlertSystem
};