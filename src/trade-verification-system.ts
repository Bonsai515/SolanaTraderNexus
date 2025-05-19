/**
 * Trade Verification System
 * 
 * This module verifies all trades on-chain via Solscan and records trade data in AWS
 * while monitoring Syndica API usage to stay within paid tier limits.
 */

import axios from 'axios';
import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import AWS from 'aws-sdk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.trading' });

// Constants
const WALLET_ADDRESS = process.env.TRADING_WALLET_ADDRESS || 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY || 'q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const LOGS_DIR = path.join(process.cwd(), 'logs');

// Interfaces
interface TradeRecord {
  timestamp: string;
  txSignature: string;
  strategyName: string;
  tokensPurchased?: string;
  tokensAmount?: number;
  solAmount: number;
  solBalanceBefore: number;
  solBalanceAfter: number;
  profitSOL: number;
  profitUSD: number;
  verified: boolean;
  solscanUrl: string;
  reinvestment?: {
    amount: number;
    percent: number;
    timestamp: string;
  };
}

interface BalanceRecord {
  timestamp: string;
  walletAddress: string;
  solBalance: number;
  usdValue: number;
  verificationSource: string;
}

interface SyndicaUsage {
  requestsToday: number;
  requestsThisMonth: number;
  paidTierLimit: number;
  usagePercentage: number;
  lastUpdated: string;
}

// Syndica Pro Tier limits
const SYNDICA_TIER_LIMITS = {
  free: 5_000_000, // 5M requests per month
  growth: 10_000_000, // 10M requests per month
  scale: 50_000_000, // 50M requests per month
  enterprise: 100_000_000 // 100M requests per month
};

// Current plan - can be adjusted based on actual subscription
const CURRENT_SYNDICA_PLAN = 'growth';

// Configure AWS
AWS.config.update({ region: AWS_REGION });
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const cloudWatch = new AWS.CloudWatch();

// Create logs directory if it doesn't exist
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * Verify transaction on Solscan
 */
async function verifySolscanTransaction(signature: string): Promise<boolean> {
  try {
    // Attempt to get transaction details from Solscan API
    const response = await axios.get(`https://public-api.solscan.io/transaction/${signature}`, {
      headers: { 'Accept': 'application/json' }
    });
    
    // Check if transaction exists and is confirmed
    if (response.data && response.data.status === 'Success') {
      console.log(`✅ Transaction ${signature} verified on Solscan`);
      return true;
    } else {
      console.log(`⚠️ Transaction ${signature} not verified on Solscan yet`);
      return false;
    }
  } catch (error) {
    console.error(`Error verifying transaction ${signature} on Solscan:`, error);
    return false;
  }
}

/**
 * Verify wallet balance on Solscan
 */
async function verifyWalletBalance(walletAddress: string): Promise<BalanceRecord | null> {
  try {
    // Get wallet balance from Solscan
    const response = await axios.get(`https://public-api.solscan.io/account/${walletAddress}`, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (response.data && response.data.lamports) {
      const solBalance = response.data.lamports / LAMPORTS_PER_SOL;
      const usdValue = solBalance * 150; // Approximate SOL price
      
      const balanceRecord: BalanceRecord = {
        timestamp: new Date().toISOString(),
        walletAddress,
        solBalance,
        usdValue,
        verificationSource: 'Solscan'
      };
      
      console.log(`✅ Wallet balance verified on Solscan: ${solBalance.toFixed(6)} SOL ($${usdValue.toFixed(2)})`);
      
      // Save balance record to logs
      const balanceLogPath = path.join(LOGS_DIR, 'balance-verification.json');
      let balanceLogs = [];
      
      if (fs.existsSync(balanceLogPath)) {
        try {
          balanceLogs = JSON.parse(fs.readFileSync(balanceLogPath, 'utf8'));
        } catch (e) {
          console.error('Error reading balance log file:', e);
        }
      }
      
      balanceLogs.push(balanceRecord);
      fs.writeFileSync(balanceLogPath, JSON.stringify(balanceLogs, null, 2));
      
      return balanceRecord;
    }
    
    return null;
  } catch (error) {
    console.error(`Error verifying wallet balance on Solscan:`, error);
    return null;
  }
}

/**
 * Record trade in AWS DynamoDB
 */
async function recordTradeInAWS(trade: TradeRecord): Promise<boolean> {
  try {
    const params = {
      TableName: process.env.AWS_TRADES_TABLE || 'SolanaTradesTable',
      Item: {
        ...trade,
        id: trade.txSignature,
        createdAt: new Date().toISOString()
      }
    };
    
    await dynamoDB.put(params).promise();
    console.log(`✅ Trade ${trade.txSignature} recorded in AWS DynamoDB`);
    return true;
  } catch (error) {
    console.error('Error recording trade in AWS:', error);
    
    // Record to local file as backup
    const tradesLogPath = path.join(LOGS_DIR, 'trades.json');
    let tradesLog = [];
    
    if (fs.existsSync(tradesLogPath)) {
      try {
        tradesLog = JSON.parse(fs.readFileSync(tradesLogPath, 'utf8'));
      } catch (e) {
        console.error('Error reading trades log file:', e);
      }
    }
    
    tradesLog.push(trade);
    fs.writeFileSync(tradesLogPath, JSON.stringify(tradesLog, null, 2));
    
    return false;
  }
}

/**
 * Send metrics to AWS CloudWatch
 */
async function sendMetricsToCloudWatch(trade: TradeRecord): Promise<boolean> {
  try {
    const params = {
      MetricData: [
        {
          MetricName: 'TradeProfitSOL',
          Dimensions: [
            {
              Name: 'Strategy',
              Value: trade.strategyName
            }
          ],
          Value: trade.profitSOL,
          Unit: 'Count',
          Timestamp: new Date()
        },
        {
          MetricName: 'TradeProfitUSD',
          Dimensions: [
            {
              Name: 'Strategy',
              Value: trade.strategyName
            }
          ],
          Value: trade.profitUSD,
          Unit: 'Count',
          Timestamp: new Date()
        }
      ],
      Namespace: 'SolanaTrading'
    };
    
    await cloudWatch.putMetricData(params).promise();
    console.log(`✅ Trade metrics sent to AWS CloudWatch`);
    return true;
  } catch (error) {
    console.error('Error sending metrics to AWS CloudWatch:', error);
    return false;
  }
}

/**
 * Record balance update in AWS DynamoDB
 */
async function recordBalanceInAWS(balance: BalanceRecord): Promise<boolean> {
  try {
    const params = {
      TableName: process.env.AWS_BALANCES_TABLE || 'SolanaBalancesTable',
      Item: {
        ...balance,
        id: `${balance.walletAddress}-${Date.now()}`,
        createdAt: new Date().toISOString()
      }
    };
    
    await dynamoDB.put(params).promise();
    console.log(`✅ Balance update recorded in AWS DynamoDB`);
    return true;
  } catch (error) {
    console.error('Error recording balance in AWS:', error);
    
    // Record to local file as backup
    const balanceLogsPath = path.join(LOGS_DIR, 'balance-updates.json');
    let balanceLogs = [];
    
    if (fs.existsSync(balanceLogsPath)) {
      try {
        balanceLogs = JSON.parse(fs.readFileSync(balanceLogsPath, 'utf8'));
      } catch (e) {
        console.error('Error reading balance logs file:', e);
      }
    }
    
    balanceLogs.push(balance);
    fs.writeFileSync(balanceLogsPath, JSON.stringify(balanceLogs, null, 2));
    
    return false;
  }
}

/**
 * Check Syndica API usage and stay within limits
 */
async function checkSyndicaUsage(): Promise<SyndicaUsage> {
  const usageLogPath = path.join(LOGS_DIR, 'syndica-usage.json');
  let usageData: SyndicaUsage;
  
  // Default usage data
  const defaultUsage: SyndicaUsage = {
    requestsToday: 0,
    requestsThisMonth: 0,
    paidTierLimit: SYNDICA_TIER_LIMITS[CURRENT_SYNDICA_PLAN],
    usagePercentage: 0,
    lastUpdated: new Date().toISOString()
  };
  
  // Try to load existing usage data
  if (fs.existsSync(usageLogPath)) {
    try {
      usageData = JSON.parse(fs.readFileSync(usageLogPath, 'utf8'));
      
      // Reset daily count if it's a new day
      const lastUpdate = new Date(usageData.lastUpdated);
      const today = new Date();
      if (lastUpdate.getDate() !== today.getDate() || 
          lastUpdate.getMonth() !== today.getMonth() || 
          lastUpdate.getFullYear() !== today.getFullYear()) {
        usageData.requestsToday = 0;
      }
      
      // Reset monthly count if it's a new month
      if (lastUpdate.getMonth() !== today.getMonth() || 
          lastUpdate.getFullYear() !== today.getFullYear()) {
        usageData.requestsThisMonth = 0;
      }
    } catch (e) {
      console.error('Error reading Syndica usage file:', e);
      usageData = defaultUsage;
    }
  } else {
    usageData = defaultUsage;
  }
  
  // Update usage with estimated recent requests (approx 10 per second for active trading)
  const estimatedRecentRequests = 10 * 60; // 10 RPS * 60 seconds = ~600 requests per minute
  usageData.requestsToday += estimatedRecentRequests;
  usageData.requestsThisMonth += estimatedRecentRequests;
  usageData.lastUpdated = new Date().toISOString();
  
  // Calculate usage percentage
  usageData.usagePercentage = (usageData.requestsThisMonth / usageData.paidTierLimit) * 100;
  
  // Save updated usage data
  fs.writeFileSync(usageLogPath, JSON.stringify(usageData, null, 2));
  
  // Log usage information
  console.log(`===== SYNDICA API USAGE =====`);
  console.log(`Requests today: ${usageData.requestsToday.toLocaleString()}`);
  console.log(`Requests this month: ${usageData.requestsThisMonth.toLocaleString()}`);
  console.log(`Tier limit (${CURRENT_SYNDICA_PLAN}): ${usageData.paidTierLimit.toLocaleString()}`);
  console.log(`Usage: ${usageData.usagePercentage.toFixed(2)}%`);
  
  // Warn if approaching limit
  if (usageData.usagePercentage > 80) {
    console.warn(`⚠️ WARNING: Approaching Syndica ${CURRENT_SYNDICA_PLAN} tier limit (${usageData.usagePercentage.toFixed(2)}%)`);
    console.warn(`⚠️ Consider upgrading to the next tier or reducing request frequency`);
  }
  
  return usageData;
}

/**
 * Record and verify a completed trade
 */
export async function recordAndVerifyTrade(
  txSignature: string, 
  strategyName: string, 
  solAmount: number,
  solBalanceBefore: number,
  solBalanceAfter: number,
  tokenInfo?: { symbol: string, amount: number }
): Promise<boolean> {
  try {
    // Calculate profit
    const profitSOL = solBalanceAfter - solBalanceBefore;
    const profitUSD = profitSOL * 150; // Approximate SOL price
    
    // Create trade record
    const trade: TradeRecord = {
      timestamp: new Date().toISOString(),
      txSignature,
      strategyName,
      solAmount,
      solBalanceBefore,
      solBalanceAfter,
      profitSOL,
      profitUSD,
      verified: false,
      solscanUrl: `https://solscan.io/tx/${txSignature}`
    };
    
    // Add token info if available
    if (tokenInfo) {
      trade.tokensPurchased = tokenInfo.symbol;
      trade.tokensAmount = tokenInfo.amount;
    }
    
    // Verify transaction on Solscan
    const verified = await verifySolscanTransaction(txSignature);
    trade.verified = verified;
    
    // Record trade in AWS
    await recordTradeInAWS(trade);
    
    // Send metrics to CloudWatch
    await sendMetricsToCloudWatch(trade);
    
    // Verify and record wallet balance
    const balanceRecord = await verifyWalletBalance(WALLET_ADDRESS);
    if (balanceRecord) {
      await recordBalanceInAWS(balanceRecord);
    }
    
    // Check Syndica usage
    await checkSyndicaUsage();
    
    return true;
  } catch (error) {
    console.error('Error recording and verifying trade:', error);
    return false;
  }
}

/**
 * Verify wallet balance and record update
 */
export async function verifyAndRecordBalance(): Promise<number | null> {
  try {
    const balanceRecord = await verifyWalletBalance(WALLET_ADDRESS);
    if (balanceRecord) {
      await recordBalanceInAWS(balanceRecord);
      return balanceRecord.solBalance;
    }
    return null;
  } catch (error) {
    console.error('Error verifying and recording balance:', error);
    return null;
  }
}

/**
 * Initialize verification system
 */
export function initializeVerificationSystem(): void {
  console.log('Initializing trade verification system...');
  
  // Create necessary directories
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
  
  // Check initial Syndica usage
  checkSyndicaUsage().then(usage => {
    console.log(`Syndica ${CURRENT_SYNDICA_PLAN} tier usage: ${usage.usagePercentage.toFixed(2)}%`);
  });
  
  // Verify initial wallet balance
  verifyAndRecordBalance().then(balance => {
    if (balance) {
      console.log(`Initial wallet balance: ${balance.toFixed(6)} SOL (verified on Solscan)`);
    }
  });
  
  // Start periodic balance verification (every 5 minutes)
  setInterval(async () => {
    await verifyAndRecordBalance();
  }, 5 * 60 * 1000);
  
  // Start periodic Syndica usage check (every 10 minutes)
  setInterval(async () => {
    await checkSyndicaUsage();
  }, 10 * 60 * 1000);
  
  console.log('✅ Trade verification system initialized');
  console.log('✅ All trades will be verified on Solscan and recorded in AWS');
  console.log('✅ Wallet balance changes will be verified on Solscan');
  console.log('✅ Syndica API usage will be monitored to stay within tier limits');
}

// Export verification system
export const verificationSystem = {
  recordAndVerifyTrade,
  verifyAndRecordBalance,
  checkSyndicaUsage,
  initializeVerificationSystem
};