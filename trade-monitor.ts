/**
 * Trade Monitor
 * 
 * This script monitors the status of trades and provides real-time updates.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getTrades, logStatus } from './src/trade-orchestrator';

console.log('=======================================================');
console.log('📊 TRADE MONITOR');
console.log('=======================================================');

// Check for successful trades
function checkSuccessfulTrades(): void {
  const logDir = './logs/trades';
  if (!fs.existsSync(logDir)) {
    console.log('No trade logs found.');
    return;
  }
  
  // Look for today's successful trades log
  const today = new Date().toISOString().split('T')[0];
  const successfulTradesPath = path.join(logDir, `successful-trades-${today}.json`);
  
  if (fs.existsSync(successfulTradesPath)) {
    try {
      const trades = JSON.parse(fs.readFileSync(successfulTradesPath, 'utf-8'));
      
      console.log(`\nSuccessful Trades Today: ${trades.length}`);
      
      trades.forEach((trade: any, index: number) => {
        console.log(`${index + 1}. ${trade.strategy} | ${trade.action} ${trade.tokenSymbol} | Amount: ${trade.amount} SOL`);
        console.log(`   Transaction: ${trade.signature}`);
        console.log(`   Time: ${new Date(trade.timestamp).toLocaleTimeString()}`);
        
        // Calculate processing time in seconds
        const processingTimeSec = trade.processingTimeMs / 1000;
        console.log(`   Processing Time: ${processingTimeSec.toFixed(2)} seconds`);
      });
    } catch (error) {
      console.error('Error reading successful trades:', error);
    }
  } else {
    console.log('\nNo successful trades today yet.');
  }
  
  // Check for failed trades
  const failedTradesPath = path.join(logDir, `failed-trades-${today}.json`);
  
  if (fs.existsSync(failedTradesPath)) {
    try {
      const trades = JSON.parse(fs.readFileSync(failedTradesPath, 'utf-8'));
      
      console.log(`\nFailed Trades Today: ${trades.length}`);
      
      trades.forEach((trade: any, index: number) => {
        console.log(`${index + 1}. ${trade.strategy} | ${trade.action} ${trade.tokenSymbol} | Amount: ${trade.amount} SOL`);
        console.log(`   Error: ${trade.error}`);
        console.log(`   Retry Count: ${trade.retryCount}`);
        console.log(`   Time: ${new Date(trade.timestamp).toLocaleTimeString()}`);
      });
    } catch (error) {
      console.error('Error reading failed trades:', error);
    }
  } else {
    console.log('\nNo failed trades today.');
  }
}

// Get current trade queue status
function getCurrentQueueStatus(): void {
  console.log('\nCurrent Trade Queue:');
  
  // Get all trades
  const allTrades = getTrades();
  
  // Count by status
  const pending = allTrades.filter(t => t.status === 'PENDING').length;
  const processing = allTrades.filter(t => t.status === 'PROCESSING').length;
  const completed = allTrades.filter(t => t.status === 'COMPLETED').length;
  const failed = allTrades.filter(t => t.status === 'FAILED').length;
  
  console.log(`Pending: ${pending} | Processing: ${processing} | Completed: ${completed} | Failed: ${failed}`);
  
  // Show details of pending and processing trades
  const activeTrades = allTrades.filter(t => t.status === 'PENDING' || t.status === 'PROCESSING');
  
  if (activeTrades.length > 0) {
    console.log('\nActive Trades:');
    
    activeTrades.forEach((trade, index) => {
      console.log(`${index + 1}. ${trade.strategy} | ${trade.action} ${trade.tokenSymbol} | Amount: ${trade.amount} SOL`);
      console.log(`   Status: ${trade.status} | Priority: ${trade.priority} | Retries: ${trade.retryCount}/${trade.maxRetries}`);
      
      // Show how long ago the trade was queued
      const queuedTimeAgo = Math.floor((Date.now() - trade.timestamp) / 1000);
      console.log(`   Queued: ${queuedTimeAgo} seconds ago`);
      
      // Show the last attempt time if any
      if (trade.lastAttempt > 0) {
        const lastAttemptAgo = Math.floor((Date.now() - trade.lastAttempt) / 1000);
        console.log(`   Last Attempt: ${lastAttemptAgo} seconds ago`);
      }
    });
  }
}

// Call the functions
logStatus();
checkSuccessfulTrades();
getCurrentQueueStatus();

console.log('\n=======================================================');
console.log('Run this script anytime to check the status of your trades');
console.log('=======================================================');
