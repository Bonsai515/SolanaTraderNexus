/**
 * Live Trading Routes
 * 
 * API endpoints for activating and managing live trading with real funds.
 */

import express, { Request, Response, Router } from 'express';
import { logger } from '../logger';
import * as transactionEngine from '../transaction-engine';
import * as agents from '../agents';
import { exec } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import { PublicKey, Keypair } from '@solana/web3.js';

const execAsync = promisify(exec);
const router = Router();

// Track active processes and agents
let activeProcesses: Record<string, number> = {};
let tradingEnabled = false;

/**
 * GET /api/live-trading/status
 * Check live trading status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const agentStatuses = {
      hyperion: {
        id: 'hyperion-agent',
        name: 'Hyperion Flash Arbitrage',
        status: activeProcesses['hyperion'] ? 'active' : 'stopped',
        active: !!activeProcesses['hyperion'],
        wallets: {
          trading: process.env.HYPERION_TRADING_WALLET,
          profit: process.env.HYPERION_PROFIT_WALLET
        },
        metrics: {
          totalExecutions: 0,
          successRate: 0,
          totalProfit: 0,
          lastExecution: null
        }
      },
      quantum_omega: {
        id: 'quantum-omega',
        name: 'Quantum Omega Sniper',
        status: activeProcesses['quantum_omega'] ? 'active' : 'stopped',
        active: !!activeProcesses['quantum_omega'],
        wallets: {
          trading: process.env.QUANTUM_TRADING_WALLET,
          profit: process.env.QUANTUM_PROFIT_WALLET
        },
        metrics: {
          totalExecutions: 0,
          successRate: 0,
          totalProfit: 0,
          lastExecution: null
        }
      },
      singularity: {
        id: 'singularity',
        name: 'Singularity Cross-Chain',
        status: activeProcesses['singularity'] ? 'active' : 'stopped',
        active: !!activeProcesses['singularity'],
        wallets: {
          trading: process.env.SINGULARITY_TRADING_WALLET,
          profit: process.env.SINGULARITY_PROFIT_WALLET
        },
        metrics: {
          totalExecutions: 0,
          successRate: 0,
          totalProfit: 0,
          lastExecution: null
        }
      }
    };

    // Check transaction engine initialization
    const transactionEngineStatus = {
      initialized: transactionEngine.isInitialized(),
      rpcUrl: transactionEngine.getRpcUrl(),
      transactionCount: transactionEngine.getTransactionCount(),
      registeredWallets: transactionEngine.getRegisteredWallets()
    };

    return res.json({
      status: "success",
      liveTradingEnabled: tradingEnabled,
      agents: agentStatuses,
      transactionEngine: transactionEngineStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error checking live trading status:', error);
    return res.status(500).json({
      status: "error",
      message: "Failed to check live trading status",
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/live-trading/activate
 * Activate live trading with real funds
 */
router.post('/activate', async (req: Request, res: Response) => {
  try {
    logger.info('🚀 Activating live trading with real funds');

    // Initialize the transaction engine
    const rpcUrl = process.env.INSTANT_NODES_RPC_URL || process.env.SOLANA_RPC_API_KEY;
    const engineInitialized = transactionEngine.initializeTransactionEngine(rpcUrl);
    
    if (!engineInitialized) {
      throw new Error('Failed to initialize transaction engine');
    }
    
    // Activate the Hyperion agent for flash arbitrage
    const hyperionAgentResult = await agents.activateAgent('hyperion', true);
    
    // Activate the Quantum Omega agent for token sniping
    const quantumOmegaAgentResult = await agents.activateAgent('quantum_omega', true);
    
    // Activate the Singularity agent for cross-chain arbitrage
    const singularityAgentResult = await agents.activateAgent('singularity', true);
    
    // Set all agents to use real funds
    await agents.setUseRealFunds(true);
    
    // Register all trading wallets with the transaction engine
    const tradingWallets = [
      process.env.HYPERION_TRADING_WALLET,
      process.env.QUANTUM_TRADING_WALLET,
      process.env.SINGULARITY_TRADING_WALLET,
      process.env.PROFIT_COLLECTION_WALLET
    ].filter(Boolean);
    
    for (const wallet of tradingWallets) {
      if (wallet) {
        transactionEngine.registerWallet(wallet);
      }
    }
    
    // Execute a test transaction to verify the transaction engine
    const testKeyPair = Keypair.generate();
    const testTx = await transactionEngine.executeTransaction({
      type: 'TEST',
      instructions: [],
      signers: [testKeyPair],
      walletAddress: testKeyPair.publicKey.toString(),
      priorityLevel: 'low',
      estimatedValue: 0.001
    });
    
    if (!testTx.success) {
      throw new Error(`Test transaction failed: ${testTx.error || 'Unknown reason'}`);
    }
    
    // Record active state
    tradingEnabled = true;
    activeProcesses['hyperion'] = Date.now();
    activeProcesses['quantum_omega'] = Date.now();
    activeProcesses['singularity'] = Date.now();
    
    logger.info('✅ Live trading activated successfully with real funds');
    
    return res.json({
      status: "success",
      message: "Live trading activated successfully with real funds",
      timestamp: new Date().toISOString(),
      transactionEngine: {
        initialized: true,
        transactionCount: transactionEngine.getTransactionCount(),
        registeredWallets: transactionEngine.getRegisteredWallets()
      },
      agents: {
        hyperion: { active: true },
        quantum_omega: { active: true },
        singularity: { active: true }
      },
      testTransactionSignature: testTx.signature
    });
  } catch (error) {
    logger.error('❌ Error activating live trading:', error);
    return res.status(500).json({
      status: "error",
      message: `Failed to activate live trading: ${(error as Error).message}`,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/live-trading/deactivate
 * Deactivate live trading
 */
router.post('/deactivate', async (req: Request, res: Response) => {
  try {
    logger.info('🛑 Deactivating live trading');
    
    // Set all agents to not use real funds
    await agents.setUseRealFunds(false);
    
    // Clear active processes
    activeProcesses = {};
    tradingEnabled = false;
    
    logger.info('✅ Live trading deactivated successfully');
    
    return res.json({
      status: "success",
      message: "Live trading deactivated successfully",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Error deactivating live trading:', error);
    return res.status(500).json({
      status: "error",
      message: `Failed to deactivate live trading: ${(error as Error).message}`,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/live-trading/transactions
 * Get recent live transactions
 */
router.get('/transactions', (req: Request, res: Response) => {
  try {
    // In a real implementation, we'd fetch the transactions from a database or log
    // For now, return a simple response
    return res.json({
      status: "success",
      transactions: [],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching live transactions:', error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch live transactions",
      timestamp: new Date().toISOString()
    });
  }
});

export default router;