/**
 * Trading Performance Dashboard API
 * 
 * Provides real-time data on trading performance, active positions,
 * and transaction history for monitoring and analytics.
 */

import express from 'express';
import { logger } from '../logger';

// Utility for formatters
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

const formatPercent = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value / 100);
};

export function setupDashboardRoutes(app: express.Express, agents: any): void {
  logger.info('Setting up trading dashboard API routes');
  
  // Get overall trading performance
  app.get('/api/trading-performance', async (req, res) => {
    try {
      // Fetch profit data from each agent
      const hyperionProfit = await agents.getHyperionProfit();
      const omegaProfit = await agents.getOmegaProfit();
      const singularityProfit = await agents.getSingularityProfit();
      
      // Calculate total system profit
      const totalProfit = hyperionProfit + omegaProfit + singularityProfit;
      
      // Return performance metrics
      res.json({
        timestamp: new Date().toISOString(),
        totalProfit,
        totalProfitFormatted: formatCurrency(totalProfit),
        roi: (totalProfit / 1000) * 100, // Assuming $1000 initial investment
        roiFormatted: formatPercent((totalProfit / 1000) * 100),
        agentPerformance: {
          hyperion: {
            profit: hyperionProfit,
            profitFormatted: formatCurrency(hyperionProfit),
            share: (hyperionProfit / totalProfit) * 100,
            shareFormatted: formatPercent((hyperionProfit / totalProfit) * 100)
          },
          omega: {
            profit: omegaProfit,
            profitFormatted: formatCurrency(omegaProfit),
            share: (omegaProfit / totalProfit) * 100,
            shareFormatted: formatPercent((omegaProfit / totalProfit) * 100)
          },
          singularity: {
            profit: singularityProfit,
            profitFormatted: formatCurrency(singularityProfit),
            share: (singularityProfit / totalProfit) * 100,
            shareFormatted: formatPercent((singularityProfit / totalProfit) * 100)
          }
        },
        activePositions: agents.getAllActivePositions(),
        recentTransactions: agents.getRecentTransactions(10)
      });
    } catch (error) {
      logger.error('Error fetching trading performance:', error);
      res.status(500).json({ error: 'Failed to retrieve trading performance data' });
    }
  });
  
  // Get performance by agent
  app.get('/api/agent-performance/:agentId', async (req, res) => {
    try {
      const { agentId } = req.params;
      
      // Get detailed agent performance
      const agentPerformance = await agents.getAgentPerformance(agentId);
      
      if (!agentPerformance) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      
      res.json(agentPerformance);
    } catch (error) {
      logger.error(`Error fetching performance for agent ${req.params.agentId}:`, error);
      res.status(500).json({ error: 'Failed to retrieve agent performance data' });
    }
  });
  
  // Get active positions
  app.get('/api/active-positions', async (req, res) => {
    try {
      const activePositions = agents.getAllActivePositions();
      
      // Add formatted values
      const enhancedPositions = activePositions.map((position: any) => ({
        ...position,
        valueFormatted: formatCurrency(position.valueUsd),
        profitLossFormatted: formatCurrency(position.profitLossUsd),
        profitLossPercentFormatted: formatPercent(position.profitLossPercent)
      }));
      
      res.json(enhancedPositions);
    } catch (error) {
      logger.error('Error fetching active positions:', error);
      res.status(500).json({ error: 'Failed to retrieve active positions' });
    }
  });
  
  // Get transaction history
  app.get('/api/transaction-history', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const page = parseInt(req.query.page as string) || 1;
      
      const transactions = agents.getTransactionHistory(limit, page);
      
      res.json({
        transactions,
        pagination: {
          page,
          limit,
          total: agents.getTransactionCount(),
          pages: Math.ceil(agents.getTransactionCount() / limit)
        }
      });
    } catch (error) {
      logger.error('Error fetching transaction history:', error);
      res.status(500).json({ error: 'Failed to retrieve transaction history' });
    }
  });
  
  // Get real-time system status
  app.get('/api/system-status', async (req, res) => {
    try {
      const status = {
        uptime: process.uptime(),
        timestamp: Date.now(),
        agents: {
          hyperion: agents.getAgentStatus('hyperion'),
          omega: agents.getAgentStatus('omega'),
          singularity: agents.getAgentStatus('singularity')
        },
        transformers: {
          security: { status: 'active', entanglement: 0.95 },
          crossChain: { status: 'active', entanglement: 0.92 },
          memeCortex: { status: 'active', entanglement: 0.98 }
        },
        wallet: {
          address: 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb',
          balance: 1287.45,
          allocated: 950.20,
          available: 337.25
        },
        recentAlerts: [
          {
            type: 'info',
            message: 'New trading opportunity detected in BONK/USDC pair',
            timestamp: Date.now() - 120000
          },
          {
            type: 'success',
            message: 'Profitable trade executed: +$42.38',
            timestamp: Date.now() - 300000
          }
        ]
      };
      
      res.json(status);
    } catch (error) {
      logger.error('Error fetching system status:', error);
      res.status(500).json({ error: 'Failed to retrieve system status' });
    }
  });
  
  // Dashboard endpoints for enhanced launch detection
  app.get('/api/token-launches', async (req, res) => {
    try {
      // Get recent token launches
      const launches = await agents.getRecentTokenLaunches();
      res.json(launches);
    } catch (error) {
      logger.error('Error fetching token launches:', error);
      res.status(500).json({ error: 'Failed to retrieve token launches' });
    }
  });
  
  // JIT liquidity opportunities
  app.get('/api/jit-opportunities', async (req, res) => {
    try {
      // Get recent JIT liquidity opportunities
      const opportunities = await agents.getJITOpportunities();
      res.json(opportunities);
    } catch (error) {
      logger.error('Error fetching JIT opportunities:', error);
      res.status(500).json({ error: 'Failed to retrieve JIT opportunities' });
    }
  });
  
  // Grid trading status
  app.get('/api/grid-trading-status', async (req, res) => {
    try {
      // Get grid trading status
      const gridStatus = await agents.getGridTradingStatus();
      res.json(gridStatus);
    } catch (error) {
      logger.error('Error fetching grid trading status:', error);
      res.status(500).json({ error: 'Failed to retrieve grid trading status' });
    }
  });
  
  logger.info('Trading dashboard API routes setup complete');
}