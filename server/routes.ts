import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import storage from './storage';
import { WebSocketServer } from 'ws';
import { Server } from 'http';
import * as solanaWeb3 from '@solana/web3.js';
import {
  walletSchema, 
  insertWalletSchema,
  strategySchema,
  insertStrategySchema,
  tradingSignalSchema,
  insertTradingSignalSchema,
  transactionSchema,
  insertTransactionSchema,
  StrategyType,
  SignalType,
  SignalStrength,
  TransactionType,
  TransactionStatus
} from '../shared/schema';

const router = express.Router();

// API Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get Solana connection status
router.get('/solana/status', async (req, res) => {
  try {
    // Use custom RPC URL from environment or fall back to public endpoint
    const endpoint = process.env.SOLANA_RPC_API_KEY 
      ? `https://mainnet.helius-rpc.com/?api-key=${process.env.SOLANA_RPC_API_KEY}`
      : 'https://api.mainnet-beta.solana.com';
    
    const connection = new solanaWeb3.Connection(endpoint);
    const version = await connection.getVersion();
    
    res.json({
      status: 'connected',
      version,
      endpoint: endpoint.includes('api-key') 
        ? 'Custom RPC with API key' 
        : endpoint,
      network: 'mainnet-beta'
    });
  } catch (error) {
    console.error('Failed to connect to Solana:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to connect to Solana network',
      error: error.message
    });
  }
});

// Get all wallets
router.get('/wallets', async (req, res) => {
  try {
    const wallets = await storage.getWallets();
    res.json(wallets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create wallet
router.post('/wallets', async (req, res) => {
  try {
    const parsedData = insertWalletSchema.parse(req.body);
    
    // Generate keypair for new wallet
    const keypair = solanaWeb3.Keypair.generate();
    
    const wallet = {
      id: uuidv4(),
      name: parsedData.name,
      address: keypair.publicKey.toString(),
      balance: 0,
      created_at: new Date()
    };
    
    const newWallet = await storage.createWallet(wallet);
    res.status(201).json(newWallet);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all strategies
router.get('/strategies', async (req, res) => {
  try {
    const strategies = await storage.getStrategies();
    res.json(strategies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create strategy
router.post('/strategies', async (req, res) => {
  try {
    const parsedData = insertStrategySchema.parse(req.body);
    
    const strategy = {
      id: uuidv4(),
      ...parsedData,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    const newStrategy = await storage.createStrategy(strategy);
    res.status(201).json(newStrategy);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update strategy
router.patch('/strategies/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const updates = req.body;
    
    const updatedStrategy = await storage.updateStrategy(id, {
      ...updates,
      updated_at: new Date()
    });
    
    if (!updatedStrategy) {
      return res.status(404).json({ error: 'Strategy not found' });
    }
    
    res.json(updatedStrategy);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all trading signals
router.get('/signals', async (req, res) => {
  try {
    const signals = await storage.getSignals();
    res.json(signals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create trading signal
router.post('/signals', async (req, res) => {
  try {
    const parsedData = insertTradingSignalSchema.parse(req.body);
    
    const signal = {
      id: uuidv4(),
      ...parsedData,
      created_at: new Date()
    };
    
    const newSignal = await storage.createSignal(signal);
    res.status(201).json(newSignal);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all transactions
router.get('/transactions', async (req, res) => {
  try {
    const transactions = await storage.getTransactions();
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create transaction
router.post('/transactions', async (req, res) => {
  try {
    const parsedData = insertTransactionSchema.parse(req.body);
    
    const transaction = {
      id: uuidv4(),
      ...parsedData,
      created_at: new Date()
    };
    
    const newTransaction = await storage.createTransaction(transaction);
    res.status(201).json(newTransaction);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update transaction status
router.patch('/transactions/:id/status', async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body;
    
    if (!Object.values(TransactionStatus).includes(status)) {
      return res.status(400).json({ error: 'Invalid transaction status' });
    }
    
    const updatedTransaction = await storage.updateTransactionStatus(id, status);
    
    if (!updatedTransaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    res.json(updatedTransaction);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;