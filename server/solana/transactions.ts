import { Router } from 'express';
import { Connection, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import { storage } from '../storage';

/**
 * Sets up routes for handling Solana transactions
 */
export function setupTransactionRoutes(solanaConnection: Connection) {
  const router = Router();

  // Get recent transactions
  router.get('/recent', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const transactions = await storage.getRecentTransactions(limit);
      
      // Map to the format expected by frontend
      const formattedTransactions = transactions.map(tx => ({
        id: tx.id.toString(),
        strategy: {
          name: getStrategyName(tx.strategyId),
          icon: 'smart_toy',
          color: getStrategyColor(tx.strategyId)
        },
        type: tx.type,
        amount: `${tx.amount.toFixed(2)} SOL`,
        status: getTransactionStatus(tx.status),
        profit: tx.profit !== null ? (tx.profit > 0 ? `+${tx.profit.toFixed(2)} SOL` : `${tx.profit.toFixed(2)} SOL`) : null,
        timestamp: tx.timestamp
      }));
      
      res.json({
        transactions: formattedTransactions,
        total: formattedTransactions.length
      });
    } catch (error) {
      console.error('Error fetching recent transactions:', error);
      res.status(500).json({ message: 'Failed to fetch recent transactions' });
    }
  });

  // Get wallet transactions
  router.get('/wallet', async (req, res) => {
    try {
      // In a real app, we would get the specific wallet ID from authenticated user
      // Here we're using the sample wallet's transactions
      const walletId = 1;
      const transactions = await storage.getTransactionsByWalletId(walletId);
      
      // Map to the format expected by frontend
      const formattedTransactions = transactions.map(tx => ({
        id: tx.id.toString(),
        strategy: {
          name: getStrategyName(tx.strategyId),
          icon: 'smart_toy',
          color: getStrategyColor(tx.strategyId)
        },
        type: tx.type,
        amount: `${tx.amount.toFixed(2)} SOL`,
        status: getTransactionStatus(tx.status),
        profit: tx.profit !== null ? (tx.profit > 0 ? `+${tx.profit.toFixed(2)} SOL` : `${tx.profit.toFixed(2)} SOL`) : null,
        timestamp: tx.timestamp
      }));
      
      res.json({
        transactions: formattedTransactions,
        total: formattedTransactions.length
      });
    } catch (error) {
      console.error('Error fetching wallet transactions:', error);
      res.status(500).json({ message: 'Failed to fetch wallet transactions' });
    }
  });

  // Create new transaction through transaction engine
  router.post('/execute', async (req, res) => {
    try {
      const { walletId, strategyId, type, amount } = req.body;
      
      if (!walletId || !strategyId || !type || !amount) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      // In a real app, we would execute the transaction on Solana blockchain
      // For demo purposes, we'll create a record in storage
      
      const transaction = await storage.createTransaction({
        walletId,
        strategyId,
        type,
        amount,
        status: 'PROCESSING',
        profit: null,
        timestamp: new Date().toISOString()
      });
      
      // Simulate transaction processing
      setTimeout(async () => {
        // Update transaction status
        const profit = type === 'BUY' ? 0.05 : 0.08; // Simple simulated profit
        
        const completedTransaction = await storage.createTransaction({
          ...transaction,
          status: 'COMPLETED',
          profit
        });
        
        // Notify via WebSocket
        const app = req.app as any;
        if (app.wsBroadcast) {
          app.wsBroadcast({
            type: 'transaction_completed',
            transaction: {
              id: completedTransaction.id.toString(),
              strategy: {
                name: getStrategyName(completedTransaction.strategyId),
                icon: 'smart_toy',
                color: getStrategyColor(completedTransaction.strategyId)
              },
              type: completedTransaction.type,
              amount: `${completedTransaction.amount.toFixed(2)} SOL`,
              status: 'Completed',
              profit: profit > 0 ? `+${profit.toFixed(2)} SOL` : `${profit.toFixed(2)} SOL`,
              timestamp: completedTransaction.timestamp
            }
          });
        }
      }, 3000);
      
      res.status(201).json({
        message: 'Transaction submitted successfully',
        transactionId: transaction.id
      });
    } catch (error) {
      console.error('Error executing transaction:', error);
      res.status(500).json({ message: 'Failed to execute transaction' });
    }
  });

  return router;
}

/**
 * Helper functions for transaction formatting
 */
function getStrategyName(strategyId: number): string {
  switch (strategyId) {
    case 1: return 'Alpha-7';
    case 2: return 'Beta-3';
    case 3: return 'Gamma-1';
    default: return `Strategy-${strategyId}`;
  }
}

function getStrategyColor(strategyId: number): string {
  switch (strategyId) {
    case 1: return 'info';
    case 2: return 'warning';
    case 3: return 'danger';
    default: return 'primary';
  }
}

function getTransactionStatus(status: string): 'Completed' | 'Processing' | 'Failed' {
  switch (status) {
    case 'COMPLETED': return 'Completed';
    case 'PROCESSING': return 'Processing';
    case 'FAILED': return 'Failed';
    default: return 'Processing';
  }
}
